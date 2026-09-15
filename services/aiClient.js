import { protectedTerms, terminology } from "../data/terminology.js";

const readNumber = value => value === undefined || value === "" ? NaN : Number(value);

// Empty or invalid values fall back to defaults; the seed is only sent when it is a whole number.
// Without settings the app uses the PHP backend at ./api/chat.php, so production builds need no .env file.
export function parseAiConfig(env = {}) {
  const temperature = readNumber(env.VITE_AI_TEMPERATURE);
  const seed = readNumber(env.VITE_AI_SEED);
  const provider = (env.VITE_AI_PROVIDER || "backend").toLowerCase();
  // Without VITE_AI_API_URL the backend tries the ASP.NET handler first, then PHP.
  const apiUrls = env.VITE_AI_API_URL
    ? [env.VITE_AI_API_URL.replace(/\/+$/, "")]
    : provider === "backend" ? ["./api/chat.ashx", "./api/chat.php"] : [];
  return {
    provider,
    apiUrl: apiUrls[0] || "",
    apiUrls,
    model: env.VITE_AI_MODEL || "",
    apiKey: env.VITE_AI_API_KEY || "",
    timeoutMs: Number(env.VITE_AI_TIMEOUT_MS) || 60000,
    temperature: temperature >= 0 && temperature <= 2 ? temperature : 0.2,
    seed: Number.isInteger(seed) ? seed : undefined,
  };
}
// import.meta.env only exists in Vite; plain Node (npm test) uses the mock service.
export const aiConfig = parseAiConfig(import.meta.env || { VITE_AI_PROVIDER: "mock" });
// "backend" needs no model in the browser: api/chat.php picks the model on the server.
export const isLiveAi = config => config.provider !== "mock" && !!config.apiUrl && (config.provider === "backend" || !!config.model);
export const usesLiveAi = isLiveAi(aiConfig);

const languageNames = { th: "Thai", en: "English" };

// Kept short on purpose: long prompts made 7B models drift into other languages.
const modeStyles = {
  professional: {
    style: "Professional: clear, respectful workplace language. Turn casual or chat-style phrasing into complete, well-formed sentences. Remove slang and filler words.",
    en: "Use natural, professional workplace English.",
    th: "Use polite, semi-formal Thai workplace language. Write requests as polite statements, such as รบกวนช่วย... or ขอให้...",
  },
  manufacturing: {
    style: "Manufacturing: factual shop-floor reporting for production, maintenance, and quality teams. Use standard manufacturing terms such as downtime, breakdown, spare parts, WIP, defect, output, and shift. Short, direct sentences.",
    en: "Write like a production supervisor reporting to a plant manager.",
    th: "Use common Thai factory wording, and keep shop-floor terms that Thai factories normally write in English, such as WIP, CNC, and downtime.",
  },
  email: {
    style: "Email: polite, courteous business email wording. Phrase requests politely, and express apologies or thanks where the original implies them. Split separate points into short paragraphs. Write only the body.",
    en: "Use polished business-email English, such as \"Could you please...\" for requests.",
    th: "Use formal, polite Thai for business email, such as รบกวน, ขอความกรุณา, or ขออภัยในความไม่สะดวก where the original implies them.",
  },
  technical: {
    style: "Technical: precise, unambiguous wording for engineers and technicians. Use standard technical vocabulary. Keep codes, model numbers, error messages, values, and units exactly.",
    en: "Use concise technical English.",
    th: "Use formal Thai, and keep widely used English technical terms in English.",
  },
  simple: {
    style: "Simple: easy to read for readers with basic language skills. Short sentences with one idea each, common everyday words, and no jargon.",
    en: "Use plain English.",
    th: "Use plain, everyday Thai.",
  },
};

const transformPrompts = {
  improve: "Improve the grammar, clarity, and flow of the user's English text while keeping its meaning.",
  formal: "Rewrite the user's English text in a more formal business tone while keeping its meaning.",
  shorter: "Make the user's English text shorter and more concise while keeping the key information.",
};

function buildTranslationPrompt({ text, sourceLanguage, targetLanguage, mode, useCompanyTerminology }) {
  const style = modeStyles[mode] || modeStyles.professional;
  const target = languageNames[targetLanguage];
  const lowerText = text.toLowerCase();
  // Only terms that occur in the text, so the model is not primed with unrelated words.
  const terms = useCompanyTerminology ? protectedTerms.filter(term => lowerText.includes(term.toLowerCase())) : [];
  const glossary = useCompanyTerminology
    ? terminology.filter(item => sourceLanguage === "th" ? text.includes(item.thai) : lowerText.includes(item.english.toLowerCase()))
    : [];
  const lines = [
    `You translate workplace messages from ${languageNames[sourceLanguage]} to ${target}.`,
    `Style: ${style.style}`,
    `${target} style: ${style[targetLanguage]}`,
    "Rules:",
    "- Keep every fact from the original. Change only wording and tone; do not add or remove information.",
    "- Do not add a greeting, closing, subject line, signature, placeholder, or note.",
    "- Keep names, numbers, dates, times, and units accurate.",
  ];
  if (terms.length) lines.push(`- Protected terms: ${terms.map(term => `"${term}"`).join(", ")}. Never translate them. Copy them character for character, in English.`);
  if (glossary.length) lines.push(`- Glossary: ${glossary.map(item => sourceLanguage === "th" ? `${item.thai} = ${item.english}` : `${item.english} = ${item.thai}`).join("; ")}.`);
  if (targetLanguage === "th") lines.push("- End sentences without politeness particles and leave out first-person pronouns, as in written Thai workplace messages. Keep English words from the original in English, with a space before and after them.");
  lines.push(targetLanguage === "th"
    ? "Output only the Thai translation, written in Thai script except for English words copied from the original."
    : "Output only the English translation, written entirely in English.");
  return lines.join("\n");
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const thaiCharacter = "[\\u0E00-\\u0E7F]";
// ครับผม, ครับ, ค่ะ (both tone-mark orders), คะ
const thaiParticle = "(?:\\u0E04\\u0E23\\u0E31\\u0E1A\\u0E1C\\u0E21|\\u0E04\\u0E23\\u0E31\\u0E1A|\\u0E04\\u0E48\\u0E30|\\u0E04\\u0E30\\u0E48|\\u0E04\\u0E30)";
const thaiParticlePattern = new RegExp(`[ \\t]*${thaiParticle}(?:\\s*[/\\uFF0F]\\s*${thaiParticle})*(?=[\\s?.!]|$)`, "g");

// Restores protected terms that appear exactly in the source text, so ordinary words like "operation" are left alone.
// stripThaiParticles removes sentence-final ครับ/ค่ะ/คะ; the lookahead leaves words such as คะแนน intact.
export function cleanOutput(text, { sourceText = "", stripThaiParticles = false } = {}) {
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim().replace(/^```\w*\n?|\n?```$/g, "").trim();
  result = result.split("\n").filter(line => !/^\s*\[[^\]\n]{1,40}\]\s*$/.test(line)).map(line => line.trimEnd()).join("\n");
  if (stripThaiParticles) result = result.replace(thaiParticlePattern, "");
  for (const term of protectedTerms.filter(item => sourceText.includes(item))) {
    const pattern = escapeRegExp(term).replace(/\\\.$/, "\\.?").replace(/ /g, "\\s*");
    result = result
      .replace(new RegExp(`(?<![A-Za-z])${pattern}(?![A-Za-z])`, "gi"), term)
      .replace(new RegExp(`(${thaiCharacter})(${escapeRegExp(term)})`, "g"), "$1 $2")
      .replace(new RegExp(`(${escapeRegExp(term)})(${thaiCharacter})`, "g"), "$1 $2");
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

// Cyrillic, Japanese kana, CJK ideographs, Hangul, and accented Latin letters (excluding × and ÷).
const foreignScript = /[\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/;
const thaiScript = /[\u0E00-\u0E7F]/;

// Detects output that drifted into another language or was not translated.
export function hasUnexpectedScript(output, targetLanguage, source = "") {
  if (foreignScript.test(output) && !foreignScript.test(source)) return true;
  if (targetLanguage === "en") return thaiScript.test(output);
  if (targetLanguage === "th") return !thaiScript.test(output);
  return false;
}

// The backend file that answered last (chat.ashx or chat.php), so later requests skip the failed one.
let backendUrl = null;

// A backend is unavailable when the file or its handler is not installed (404/405), or when it runs but has
// no settings (500 "AI backend is not configured"), e.g. ASP.NET is enabled but only PHP is configured.
async function isUnavailable(response) {
  if (response.status === 404 || response.status === 405) return true;
  if (response.status !== 500 || typeof response.clone !== "function") return false;
  const data = await response.clone().json().catch(() => null);
  return data?.error === "AI backend is not configured";
}

// Tries each backend file in order and returns the first one that is available.
export async function postToBackend(request, urls = aiConfig.apiUrls, fetchImpl = fetch) {
  const candidates = backendUrl && urls.includes(backendUrl) ? [backendUrl] : urls;
  let response;
  for (const [index, url] of candidates.entries()) {
    response = await fetchImpl(url, request);
    const missing = await isUnavailable(response);
    if (!missing) {
      backendUrl = url;
      return response;
    }
    if (index === candidates.length - 1) break;
  }
  return response;
}

async function chat(system, user, cleanOptions, temperature = aiConfig.temperature) {
  const ollama = aiConfig.provider === "ollama";
  // "backend" posts to our own PHP endpoint (api/chat.php), which adds the model and API key on the server.
  const backend = aiConfig.provider === "backend";
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  const headers = { "Content-Type": "application/json" };
  if (aiConfig.apiKey && !backend) headers.Authorization = "Bearer " + aiConfig.apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);
  try {
    const body = backend
      ? { messages, temperature, seed: aiConfig.seed }
      : ollama
        ? { model: aiConfig.model, messages, stream: false, options: { temperature, seed: aiConfig.seed } }
        : { model: aiConfig.model, messages, temperature, seed: aiConfig.seed };
    const request = { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal };
    const response = backend
      ? await postToBackend(request)
      : await fetch(aiConfig.apiUrl + (ollama ? "/api/chat" : "/chat/completions"), request);
    if (backend && !response.ok) {
      const failure = await response.json().catch(() => ({}));
      const missing = response.status === 404 || response.status === 405;
      throw new Error(typeof failure.error === "string" ? failure.error : missing ? "AI backend is not configured" : "Unable to connect to AI server");
    }
    if (response.status === 404) throw new Error("AI model or endpoint not found");
    if (response.status === 401 || response.status === 403) throw new Error("AI server rejected the API key");
    if (response.status === 429) throw new Error("AI server is busy. Try again shortly.");
    if (!response.ok) throw new Error("Unable to connect to AI server");
    const data = await response.json();
    const content = backend ? data?.content : ollama ? data?.message?.content : data?.choices?.[0]?.message?.content;
    const cleaned = typeof content === "string" ? cleanOutput(content, cleanOptions) : "";
    if (!cleaned) throw new Error("Unexpected response from AI server");
    return cleaned;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI server timed out");
    if (error instanceof SyntaxError) throw new Error("Unexpected response from AI server");
    if (error instanceof TypeError) throw new Error("Unable to connect to AI server");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Protected terms that appear in the source but not in the output.
export function missingTerms(output, source = "") {
  return protectedTerms.filter(term => source.includes(term) && !output.includes(term));
}

// Retries once with a stricter reminder when the answer is in the wrong script or dropped protected terms.
// A wrong script after the retry is an error; missing terms after the retry are returned as a best effort.
async function chatInLanguage(system, user, cleanOptions, targetLanguage) {
  const first = await chat(system, user, cleanOptions);
  const dropped = missingTerms(first, cleanOptions.sourceText);
  if (!hasUnexpectedScript(first, targetLanguage, user) && !dropped.length) return first;
  const termReminder = dropped.length ? ` Keep these terms in English exactly as written: ${dropped.map(term => `"${term}"`).join(", ")}.` : "";
  const reminder = `\nYour previous answer did not follow the rules. Answer again in ${languageNames[targetLanguage]} only.${termReminder}`;
  const second = await chat(system + reminder, user, cleanOptions, 0);
  if (hasUnexpectedScript(second, targetLanguage, user)) throw new Error("Unexpected response from AI server");
  return second;
}

export function translateWithAi(options) {
  return chatInLanguage(buildTranslationPrompt(options), options.text, {
    sourceText: options.useCompanyTerminology ? options.text : "",
    stripThaiParticles: options.targetLanguage === "th" && !new RegExp(thaiParticle).test(options.text),
  }, options.targetLanguage);
}

export function transformWithAi(text, action) {
  return chatInLanguage(`${transformPrompts[action] || transformPrompts.improve}\nDo not add placeholders or notes.\nOutput only the revised English text.`, text, { sourceText: text }, "en");
}
