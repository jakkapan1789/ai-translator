# AI Translator

An anonymous internal Thai/English translation tool built with React, Vite, JavaScript, Tailwind CSS, Radix-based UI components, Lucide, and Sonner. There is no login or Node.js server in the deployed application. The browser sends translation requests to a small PHP backend (api/chat.php) on the same site, and the AI server, model, and API key are configured on the server in api/config.php (see AI configuration).

## Local development

Requires Node.js 22.12+ and npm on the development/build machine.

```sh
npm install
npm run dev
```

Open http://localhost:3001.

## Build and preview

```sh
npm run build
npm start
```

The build creates **dist/** containing HTML, JavaScript, CSS, fonts, and an IIS web.config. npm start is a local preview only; IIS serves the production files directly.

## Deploy to IIS

1. Run npm install and npm run build on your development or build machine. No .env file is needed.
2. Copy the **contents** of dist/ into the IIS site's physical directory, or a virtual directory such as translator.
3. On the server, copy api/config.example.php to **api/config.php** and set the AI server (see PHP backend). Keep this file when copying later builds.
4. Ensure IIS **Static Content** and **Default Document** features are enabled, PHP runs through FastCGI, and the site allows anonymous access.
5. Browse to the site URL or https://your-internal-host/translator/.

dist/web.config is generated from iis/web.config: it selects index.html as the default document, supplies font MIME types, and adds the AI proxy rule when AI_PROXY_TARGET is set (see AI reverse proxy on IIS). If server policy locks these settings, ask the IIS administrator to configure them at the server/site level instead.

No Node.js runtime or ASP.NET hosting bundle is required. URL Rewrite and ARR are only needed for the optional AI proxy. Relative asset URLs support both root and subfolder deployment. There are no client-side URL routes to rewrite. Do not open index.html directly from disk; serve it over HTTP or HTTPS.

Use HTTPS on the internal site for browser clipboard features. On plain HTTP outside localhost, browsers may block automatic copy/paste; users can still select text and use keyboard shortcuts.

Kanit fonts are bundled and served by IIS. The app does not fetch Google Fonts. The browser only calls api/chat.php on the same site; PHP contacts the AI server.

References: [Vite static deployment](https://vite.dev/guide/static-deploy), [IIS static websites](https://learn.microsoft.com/en-us/iis/manage/creating-websites/scenario-build-a-static-website-on-iis).

## AI configuration

**Production needs no .env file.** By default the app posts to ./api/chat.php, and the AI server, model, and API key are set on the server in api/config.php (see PHP backend below).

The Vite variables below are optional overrides read by services/aiClient.js, mainly for local development. Put them in **.env.development.local** (read by npm run dev only, so npm run build is not affected). A .env.local or .env.production.local file would also change npm run build, so avoid those unless you mean to.

| Variable | Purpose |
| --- | --- |
| VITE_AI_PROVIDER | backend (default: the PHP endpoint), mock, ollama, or openai for any OpenAI-compatible /chat/completions API |
| VITE_AI_API_URL | Default ./api/chat.php for backend. For direct calls, for example http://localhost:11434 (Ollama) or https://api.openai.com/v1 |
| VITE_AI_MODEL | Model name, for example qwen2.5-coder:7b |
| VITE_AI_API_KEY | Optional; sent as Authorization: Bearer when set |
| VITE_AI_TIMEOUT_MS | Request timeout in milliseconds, default 60000 |
| VITE_AI_TEMPERATURE | 0–2; lower values give more consistent wording. Default 0.2; use 0 for the most repeatable results |
| VITE_AI_SEED | Optional whole number. With the same model, prompt, and temperature 0, Ollama repeats the same answer; hosted APIs treat it as best effort |

Language models sample their wording, so the same input can produce different translations. Set VITE_AI_TEMPERATURE=0 and a VITE_AI_SEED for repeatable output. A retry after a rule violation (wrong language or a missing protected term) always uses temperature 0.

Values are compiled into dist/ at build time, so change them and rebuild. Restart npm run dev after editing an .env file.

**Security:** every VITE_ value, including VITE_AI_API_KEY, is readable by anyone who can open the site. Keep keys out of VITE_ variables and add them on the server side of the proxy instead.

### AI reverse proxy on IIS (recommended for HTTPS sites)

A browser on an HTTPS site cannot call an AI server on another origin unless that server sends CORS headers, and it blocks http:// endpoints (mixed content) and private network addresses. Routing AI requests through the same site avoids all three:

    https://your-site/ai/...  →  IIS (URL Rewrite + ARR)  →  AI_PROXY_TARGET/...

1. On the IIS server, install URL Rewrite and Application Request Routing (ARR). In IIS Manager, select the server node, open Application Request Routing Cache → Server Proxy Settings, and check Enable proxy.
2. For an HTTPS target on another host, stop ARR from forwarding the site's host name:
   `%windir%\system32\inetsrv\appcmd.exe set config -section:system.webServer/proxy -preserveHostHeader:false /commit:apphost`
3. In .env.production.local on the build machine, set:

       VITE_AI_API_URL=./ai
       AI_PROXY_TARGET=https://ai.company.local

   AI_PROXY_TARGET is the real AI base URL: the server root for Ollama (for example http://10.0.0.5:11434), or the URL including /v1 for OpenAI-compatible APIs. It has no VITE_ prefix, so it is not compiled into the JavaScript.
4. Run npm run build. dist/web.config now contains the "AI proxy" rewrite rule. Copy the contents of dist/ to the site as usual.
5. Open https://your-site/ai/api/tags (Ollama) or https://your-site/ai/models (OpenAI-compatible); it should return JSON.

If the AI server rejects the forwarded Origin header (Ollama answers 403), either add the site to OLLAMA_ORIGINS on the Ollama machine, or set AI_PROXY_CLEAR_ORIGIN=true and allow the HTTP_ORIGIN server variable once on the IIS server:
`%windir%\system32\inetsrv\appcmd.exe set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_ORIGIN']" /commit:apphost`

Without AI_PROXY_TARGET the rule is not added, so sites without URL Rewrite keep working. npm run dev and npm start proxy ./ai the same way when AI_PROXY_TARGET is set.

Without a proxy, the browser calls VITE_AI_API_URL directly: use an HTTPS address that users' browsers can reach (not localhost) and allow the site origin in the AI server's CORS settings.

### PHP backend (api/chat.php)

This is the default. Every build includes a small backend at api/chat.php. The browser posts to it on the same site (no CORS), and PHP calls the AI server with the model and API key kept on the server.

    https://your-site/api/chat.php  →  PHP (server)  →  AI server

1. On the IIS server, install PHP with FastCGI (for example with the PHP Manager for IIS) and enable the curl and openssl extensions in php.ini. If the AI server uses HTTPS, point curl.cainfo and openssl.cafile in php.ini to a CA bundle (cacert.pem, plus your company CA if it issues the AI server's certificate).
2. Run npm run build (no .env needed) and copy the contents of dist/ to the site.
3. Open https://your-site/api/chat.php in a browser. {"error":"Method not allowed"} means PHP is running; a download or PHP source means .php is not mapped to PHP in IIS.
4. On the server, copy api/config.example.php to api/config.php and set provider (ollama or openai), base_url, model, and api_key. Environment variables AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_API_KEY, AI_TIMEOUT, and AI_ALLOWED_ORIGINS override the file. web.config blocks downloading config.php, and git ignores public/api/config.php.
5. Check that the IIS server itself can reach base_url (curl or Postman on that machine), then translate in the app.

api/chat.php accepts only POST with up to four system/user messages, always uses the model from its config, and returns { content } or { error } using the same error messages as the app. When copying a new build, keep the existing api/config.php on the server.

Translation prompts for each mode and direction, the company glossary, and protected terms are built in services/aiClient.js. The service keeps the same response contract as the mock, so the UI does not change.

## Validation

```sh
npm test
npx playwright install chromium
npm run test:static
npm run test:browser
node tests/language.mjs
node tests/layout.mjs
```

npm test always uses the mock service. Browser suites expect deterministic mock output: run **npm run dev:mock** (uses .env.mock) on port 3001 instead of npm run dev. Browser and language suites accept BASE_URL for another address.

Run npx vite build --mode mock before test:static. It serves dist/ through a plain static HTTP server and verifies root/subfolder hosting without SPA rewrites, local fonts, and no external requests.

## Structure

- app/main.jsx: React entry point; app/globals.css: Tailwind theme.
- components/: reusable JSX components for translator, settings, UI, and localization.
- hooks/: translation lifecycle, saved settings, and history.
- services/translatorService.js: translation service used by the UI; services/aiClient.js: AI provider requests and prompts.
- data/: fixtures, terminology, and Thai/English interface wording.
- utils/: safe localStorage, clipboard, and class merging.
- iis/web.config: IIS configuration template; scripts/webConfig.js writes dist/web.config and adds the optional AI proxy rule.
- public/api/chat.php: PHP backend used by default, copied into dist/api/; public/api/config.example.php documents its settings.
- tests/: service, browser, localization, layout, and static deployment checks.

## Interface and mock behavior

The language dropdown switches English/Thai wording and remembers the preference. Input and output remain unchanged when switching. Add interface languages in data/messages.js.

The swap button switches between Thai → English and English → Thai, trades the input and translation, and remembers the direction in localStorage (ai-translator-direction).

In mock mode, the three supplied translation examples have deterministic results; unknown input returns a labeled generic sample. Refinements are simulated. Up to five recent translations remain local to the browser. The settings panel, history, and terminology cards are not displayed; the app uses the defaults in hooks/useSettings.js.
