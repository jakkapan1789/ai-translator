<%@ WebHandler Language="C#" Class="TranslatorChat" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

// Server-side AI endpoint for IIS with ASP.NET 4.x, as an alternative to chat.php.
// Same request/response contract as chat.php. .NET uses the Windows certificate store and the
// system proxy, so AI servers with an internal company CA work without extra certificate settings.
// Written for the C# 5 compiler that IIS uses for .ashx files on .NET Framework.
public class TranslatorChat : IHttpHandler
{
    const int MaxBodyBytes = 100000;

    public bool IsReusable
    {
        get { return true; }
    }

    public void ProcessRequest(HttpContext context)
    {
        ChatResult result;
        try
        {
            string method = context.Request.HttpMethod;
            string body = "";
            if (method == "POST")
            {
                if (context.Request.ContentLength > MaxBodyBytes)
                {
                    Write(context, ChatResult.Error(413, "Request is too large"));
                    return;
                }
                using (StreamReader reader = new StreamReader(context.Request.InputStream, Encoding.UTF8))
                {
                    body = reader.ReadToEnd();
                }
            }
            IDictionary<string, object> config = LoadConfig(context.Server.MapPath("chat.config.json"));
            result = Process(method, context.Request.Headers["Origin"] ?? "", body, config);
        }
        catch (Exception)
        {
            result = ChatResult.Error(500, "Unexpected response from AI server");
        }
        Write(context, result);
    }

    static void Write(HttpContext context, ChatResult result)
    {
        HttpResponse response = context.Response;
        response.TrySkipIisCustomErrors = true;
        response.StatusCode = result.Status;
        response.Cache.SetCacheability(HttpCacheability.NoCache);
        response.AppendHeader("X-Content-Type-Options", "nosniff");
        foreach (KeyValuePair<string, string> header in result.Headers)
        {
            response.AppendHeader(header.Key, header.Value);
        }
        if (result.Json != null)
        {
            response.ContentType = "application/json";
            response.ContentEncoding = Encoding.UTF8;
            response.Write(result.Json);
        }
    }

    // Settings come from chat.config.json next to this file; AI_* environment variables override them.
    public static IDictionary<string, object> LoadConfig(string path)
    {
        Dictionary<string, object> config = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        if (File.Exists(path))
        {
            try
            {
                IDictionary<string, object> fromFile = Serializer().DeserializeObject(File.ReadAllText(path, Encoding.UTF8)) as IDictionary<string, object>;
                if (fromFile != null)
                {
                    foreach (KeyValuePair<string, object> item in fromFile)
                    {
                        config[item.Key] = item.Value;
                    }
                }
            }
            catch (ArgumentException)
            {
                // Invalid JSON: treated as not configured.
            }
        }
        Override(config, "provider", "AI_PROVIDER");
        Override(config, "base_url", "AI_BASE_URL");
        Override(config, "model", "AI_MODEL");
        Override(config, "api_key", "AI_API_KEY");
        Override(config, "timeout", "AI_TIMEOUT");
        Override(config, "allowed_origins", "AI_ALLOWED_ORIGINS");
        return config;
    }

    public static ChatResult Process(string method, string origin, string body, IDictionary<string, object> config)
    {
        List<string> allowedOrigins = TextList(config, "allowed_origins");
        ChatResult result = Handle(method, body, config);
        // Same-site requests need no CORS headers. allowed_origins is only for calls from another domain.
        if (origin != "" && allowedOrigins.Contains(origin))
        {
            result.Headers.Add(new KeyValuePair<string, string>("Access-Control-Allow-Origin", origin));
            result.Headers.Add(new KeyValuePair<string, string>("Vary", "Origin"));
            result.Headers.Add(new KeyValuePair<string, string>("Access-Control-Allow-Methods", "POST, OPTIONS"));
            result.Headers.Add(new KeyValuePair<string, string>("Access-Control-Allow-Headers", "Content-Type"));
            result.Headers.Add(new KeyValuePair<string, string>("Access-Control-Max-Age", "86400"));
        }
        return result;
    }

    static ChatResult Handle(string method, string body, IDictionary<string, object> config)
    {
        if (method == "OPTIONS")
        {
            return new ChatResult(204, null);
        }
        if (method != "POST")
        {
            ChatResult notAllowed = ChatResult.Error(405, "Method not allowed");
            notAllowed.Headers.Add(new KeyValuePair<string, string>("Allow", "POST, OPTIONS"));
            return notAllowed;
        }

        string provider = Text(config, "provider", "ollama").ToLowerInvariant();
        string baseUrl = Text(config, "base_url", "").TrimEnd('/');
        string model = Text(config, "model", "");
        string apiKey = Text(config, "api_key", "");
        int timeout = Math.Max(5, Number(config, "timeout", 60));
        if (baseUrl == "" || model == "" || (provider != "ollama" && provider != "openai"))
        {
            return ChatResult.Error(500, "AI backend is not configured");
        }
        if (Encoding.UTF8.GetByteCount(body) > MaxBodyBytes)
        {
            return ChatResult.Error(413, "Request is too large");
        }

        IDictionary<string, object> input = null;
        try
        {
            input = Serializer().DeserializeObject(body) as IDictionary<string, object>;
        }
        catch (ArgumentException)
        {
        }
        catch (InvalidOperationException)
        {
        }
        object rawMessages = null;
        if (input == null || !input.TryGetValue("messages", out rawMessages) || !(rawMessages is object[]))
        {
            return ChatResult.Error(400, "Input text is required");
        }

        // Only system and user messages with text are forwarded; the model always comes from server config.
        object[] items = (object[])rawMessages;
        if (items.Length == 0 || items.Length > 4)
        {
            return ChatResult.Error(400, "Input text is required");
        }
        List<Dictionary<string, object>> messages = new List<Dictionary<string, object>>();
        foreach (object item in items)
        {
            IDictionary<string, object> message = item as IDictionary<string, object>;
            object role = null;
            object content = null;
            if (message == null || !message.TryGetValue("role", out role) || !message.TryGetValue("content", out content)
                || !(content is string) || !("system".Equals(role) || "user".Equals(role)))
            {
                return ChatResult.Error(400, "Input text is required");
            }
            Dictionary<string, object> clean = new Dictionary<string, object>();
            clean["role"] = role;
            clean["content"] = content;
            messages.Add(clean);
        }

        double temperature = 0.2;
        object rawTemperature;
        if (input.TryGetValue("temperature", out rawTemperature) && IsNumber(rawTemperature))
        {
            temperature = Math.Max(0.0, Math.Min(2.0, Convert.ToDouble(rawTemperature, CultureInfo.InvariantCulture)));
        }
        object rawSeed;
        int? seed = null;
        if (input.TryGetValue("seed", out rawSeed) && rawSeed is int)
        {
            seed = (int)rawSeed;
        }

        Dictionary<string, object> payload = new Dictionary<string, object>();
        payload["model"] = model;
        payload["messages"] = messages;
        string url;
        if (provider == "ollama")
        {
            url = baseUrl + "/api/chat";
            payload["stream"] = false;
            Dictionary<string, object> options = new Dictionary<string, object>();
            options["temperature"] = temperature;
            if (seed.HasValue)
            {
                options["seed"] = seed.Value;
            }
            payload["options"] = options;
        }
        else
        {
            url = baseUrl + "/chat/completions";
            payload["temperature"] = temperature;
            if (seed.HasValue)
            {
                payload["seed"] = seed.Value;
            }
        }

        int status;
        string responseText;
        bool timedOut;
        Send(url, apiKey, Serializer().Serialize(payload), timeout, out status, out responseText, out timedOut);
        if (status == 0)
        {
            return timedOut ? ChatResult.Error(504, "AI server timed out") : ChatResult.Error(502, "Unable to connect to AI server");
        }
        if (status == 404)
        {
            return ChatResult.Error(502, "AI model or endpoint not found");
        }
        if (status == 401 || status == 403)
        {
            return ChatResult.Error(502, "AI server rejected the API key");
        }
        if (status == 429)
        {
            return ChatResult.Error(429, "AI server is busy. Try again shortly.");
        }
        if (status < 200 || status >= 300)
        {
            return ChatResult.Error(502, "Unable to connect to AI server");
        }

        string text = ExtractContent(provider, responseText);
        if (text == null)
        {
            return ChatResult.Error(502, "Unexpected response from AI server");
        }
        Dictionary<string, object> success = new Dictionary<string, object>();
        success["content"] = text;
        return new ChatResult(200, Serializer().Serialize(success));
    }

    static void Send(string url, string apiKey, string json, int timeoutSeconds, out int status, out string text, out bool timedOut)
    {
        status = 0;
        text = "";
        timedOut = false;
        try
        {
            // Older .NET Framework versions do not enable TLS 1.2 by default.
            ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Accept = "application/json";
            request.Timeout = timeoutSeconds * 1000;
            request.ReadWriteTimeout = timeoutSeconds * 1000;
            if (apiKey != "")
            {
                request.Headers["Authorization"] = "Bearer " + apiKey;
            }
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            request.ContentLength = bytes.Length;
            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                status = (int)response.StatusCode;
                text = ReadAll(response);
            }
        }
        catch (WebException error)
        {
            HttpWebResponse response = error.Response as HttpWebResponse;
            if (response != null)
            {
                using (response)
                {
                    status = (int)response.StatusCode;
                    text = ReadAll(response);
                }
            }
            else
            {
                timedOut = error.Status == WebExceptionStatus.Timeout;
            }
        }
        catch (UriFormatException)
        {
        }
        catch (NotSupportedException)
        {
        }
    }

    static string ReadAll(HttpWebResponse response)
    {
        using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
        {
            return reader.ReadToEnd();
        }
    }

    static string ExtractContent(string provider, string text)
    {
        IDictionary<string, object> data;
        try
        {
            data = Serializer().DeserializeObject(text) as IDictionary<string, object>;
        }
        catch (Exception)
        {
            return null;
        }
        if (data == null)
        {
            return null;
        }
        object value;
        if (provider == "ollama")
        {
            IDictionary<string, object> message = data.TryGetValue("message", out value) ? value as IDictionary<string, object> : null;
            return message != null && message.TryGetValue("content", out value) ? value as string : null;
        }
        object[] choices = data.TryGetValue("choices", out value) ? value as object[] : null;
        if (choices == null || choices.Length == 0)
        {
            return null;
        }
        IDictionary<string, object> choice = choices[0] as IDictionary<string, object>;
        IDictionary<string, object> choiceMessage = choice != null && choice.TryGetValue("message", out value) ? value as IDictionary<string, object> : null;
        return choiceMessage != null && choiceMessage.TryGetValue("content", out value) ? value as string : null;
    }

    public static string ToJson(object value)
    {
        return Serializer().Serialize(value);
    }

    static JavaScriptSerializer Serializer()
    {
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        serializer.MaxJsonLength = int.MaxValue;
        return serializer;
    }

    static void Override(IDictionary<string, object> config, string key, string variable)
    {
        string value = Environment.GetEnvironmentVariable(variable);
        if (!string.IsNullOrEmpty(value))
        {
            config[key] = value;
        }
    }

    static string Text(IDictionary<string, object> config, string key, string fallback)
    {
        object value;
        if (config.TryGetValue(key, out value) && value != null)
        {
            return Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
        }
        return fallback;
    }

    static int Number(IDictionary<string, object> config, string key, int fallback)
    {
        object value;
        if (!config.TryGetValue(key, out value) || value == null)
        {
            return fallback;
        }
        try
        {
            return Convert.ToInt32(value, CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return fallback;
        }
        catch (InvalidCastException)
        {
            return fallback;
        }
        catch (OverflowException)
        {
            return fallback;
        }
    }

    static List<string> TextList(IDictionary<string, object> config, string key)
    {
        List<string> list = new List<string>();
        object value;
        if (!config.TryGetValue(key, out value) || value == null)
        {
            return list;
        }
        IEnumerable items = value is string ? ((string)value).Split(',') : value as IEnumerable;
        if (items == null)
        {
            return list;
        }
        foreach (object item in items)
        {
            string text = Convert.ToString(item, CultureInfo.InvariantCulture).Trim();
            if (text != "")
            {
                list.Add(text);
            }
        }
        return list;
    }

    static bool IsNumber(object value)
    {
        return value is int || value is long || value is decimal || value is double;
    }
}

public class ChatResult
{
    public int Status;
    public string Json;
    public List<KeyValuePair<string, string>> Headers = new List<KeyValuePair<string, string>>();

    public ChatResult(int status, string json)
    {
        Status = status;
        Json = json;
    }

    public static ChatResult Error(int status, string message)
    {
        Dictionary<string, object> payload = new Dictionary<string, object>();
        payload["error"] = message;
        return new ChatResult(status, TranslatorChat.ToJson(payload));
    }
}
