# AI Translator

An anonymous internal Thai/English translation tool built with React, Vite, JavaScript, Tailwind CSS, Radix-based UI components, Lucide, and Sonner. There is no login or Node.js server in the deployed application. Translations use a mock service unless an AI provider is configured (see AI configuration).

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

1. Run npm install and npm run build on your development or build machine.
2. Copy the **contents** of dist/ into the IIS site's physical directory, or a virtual directory such as translator.
3. Ensure IIS **Static Content** and **Default Document** features are enabled and the site allows anonymous access.
4. Browse to the site URL or https://your-internal-host/translator/.

The included web.config selects index.html as the default document and supplies font MIME types. If server policy locks these settings, ask the IIS administrator to configure them at the server/site level instead.

No Node.js runtime, ASP.NET hosting bundle, or URL Rewrite module is required for this single-page application. Relative asset URLs support both root and subfolder deployment. There are no client-side URL routes to rewrite. Do not open index.html directly from disk; serve it over HTTP or HTTPS.

Use HTTPS on the internal site for browser clipboard features. On plain HTTP outside localhost, browsers may block automatic copy/paste; users can still select text and use keyboard shortcuts.

Kanit fonts are bundled and served by IIS. The app does not fetch Google Fonts. It contacts an AI service only when one is configured.

References: [Vite static deployment](https://vite.dev/guide/static-deploy), [IIS static websites](https://learn.microsoft.com/en-us/iis/manage/creating-websites/scenario-build-a-static-website-on-iis).

## AI configuration

AI settings are Vite environment variables read by services/aiClient.js. Copy .env.example to **.env.local** (used by npm run dev and npm run build) or **.env.production.local** (build only, takes priority) and fill in the values.

| Variable | Purpose |
| --- | --- |
| VITE_AI_PROVIDER | mock (default), ollama, or openai for any OpenAI-compatible /chat/completions API |
| VITE_AI_API_URL | For example http://localhost:11434 (Ollama) or https://api.openai.com/v1 |
| VITE_AI_MODEL | Model name, for example qwen2.5-coder:7b |
| VITE_AI_API_KEY | Optional; sent as Authorization: Bearer when set |
| VITE_AI_TIMEOUT_MS | Request timeout in milliseconds, default 60000 |
| VITE_AI_TEMPERATURE | 0–2; lower values give more consistent wording. Default 0.2; use 0 for the most repeatable results |
| VITE_AI_SEED | Optional whole number. With the same model, prompt, and temperature 0, Ollama repeats the same answer; hosted APIs treat it as best effort |

Language models sample their wording, so the same input can produce different translations. Set VITE_AI_TEMPERATURE=0 and a VITE_AI_SEED for repeatable output. A retry after a rule violation (wrong language or a missing protected term) always uses temperature 0.

Values are compiled into dist/ at build time, so change them and rebuild. Restart npm run dev after editing an .env file.

**Security:** every VITE_ value, including VITE_AI_API_KEY, is readable by anyone who can open the site. To keep a key private, set VITE_AI_API_URL to a path on the same IIS site (for example /translator/api) and configure an IIS reverse proxy (URL Rewrite + ARR) that forwards to the provider and adds the key header on the server.

The browser calls the AI URL directly. For an IIS build, use an address that users' browsers can reach (not localhost) and allow the site origin in the AI server's CORS settings (for Ollama, set OLLAMA_ORIGINS).

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

Run the build before test:static, with VITE_AI_PROVIDER=mock or no AI configuration. It serves dist/ through a plain static HTTP server and verifies root/subfolder hosting without SPA rewrites, local fonts, and no external requests.

## Structure

- app/main.jsx: React entry point; app/globals.css: Tailwind theme.
- components/: reusable JSX components for translator, settings, UI, and localization.
- hooks/: translation lifecycle, saved settings, and history.
- services/translatorService.js: translation service used by the UI; services/aiClient.js: AI provider requests and prompts.
- data/: fixtures, terminology, and Thai/English interface wording.
- utils/: safe localStorage, clipboard, and class merging.
- public/web.config: IIS configuration copied into dist/.
- tests/: service, browser, localization, layout, and static deployment checks.

## Interface and mock behavior

The language dropdown switches English/Thai wording and remembers the preference. Input and output remain unchanged when switching. Add interface languages in data/messages.js.

The swap button switches between Thai → English and English → Thai, trades the input and translation, and remembers the direction in localStorage (ai-translator-direction).

In mock mode, the three supplied translation examples have deterministic results; unknown input returns a labeled generic sample. Refinements are simulated. Up to five recent translations remain local to the browser. The settings panel, history, and terminology cards are not displayed; the app uses the defaults in hooks/useSettings.js.
