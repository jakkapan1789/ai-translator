# Repository Guidelines

## Project Structure & Module Organization

This is a React 19 single-page app built with Vite (not Next.js).

- `index.html` is the Vite entry; it loads `app/main.jsx`, which mounts `TranslatorApp` and the toaster into `#root`.
- `app/` contains `main.jsx` and the Tailwind styles in `globals.css`.
- `components/` groups translator, layout, settings, and language UI; `components/ui/` contains reusable Radix-based controls.
- `hooks/` manages translation state and locally saved preferences/history.
- `services/translatorService.js` owns translation and refinement; it uses `services/aiClient.js` when an AI provider is configured and the mock otherwise.
- `data/` holds fixtures, terminology, and interface translations in `messages.js`.
- `utils/` contains clipboard, storage, and class-name helpers; `public/` is for static assets.
- `tests/` contains service and browser checks. History, terminology, settings, and refinement actions (`TranslationActions`) remain available but are not rendered on the main page; the app uses `defaultSettings` from `hooks/useSettings.js`.
- `dist/` is the generated production build; do not edit it by hand. Its `web.config` is generated from `iis/web.config` by `scripts/webConfig.js` during the build.

## AI Configuration

By default the frontend posts to the ASP.NET backend `./api/chat.ashx` (C# 5, .NET Framework, configured by `api/chat.config.json`), and falls back to the PHP backend `./api/chat.php` (configured by `api/config.php`) when chat.ashx answers 404/405 or 500 "AI backend is not configured". Both config files are git-ignored and live only on the server, so production builds need no `.env`. Keep both backends in sync when changing the request or error contract. Optional overrides are `VITE_AI_PROVIDER` (`backend` default, `mock`, `ollama`, `openai`), `VITE_AI_API_URL`, `VITE_AI_MODEL`, `VITE_AI_API_KEY`, `VITE_AI_TIMEOUT_MS`, `VITE_AI_TEMPERATURE` (default 0.2), and `VITE_AI_SEED` (optional integer); put local ones in `.env.development.local` (dev only, ignored by git; template in `.env.example`) so builds are unaffected. `VITE_` values are compiled into the bundle and visible in the browser, so never treat them as secret. `.env.mock` forces the mock for tests. For HTTPS deployments set `VITE_AI_API_URL=./ai` and `AI_PROXY_TARGET` (not exposed to the browser): the build adds an IIS URL Rewrite + ARR proxy rule to `dist/web.config`, and the dev/preview servers proxy `/ai` the same way. Alternatively, `VITE_AI_PROVIDER=backend` with `VITE_AI_API_URL=./api/chat.php` uses the PHP backend in `public/api/chat.php`, configured on the server through `api/config.php` (git-ignored) or `AI_*` environment variables.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: run the Vite dev server on port 3001 (fixed via `strictPort` in `vite.config.js`) using `.env.development.local` when present (otherwise it calls `./api/chat.ashx` and `./api/chat.php`, which Vite does not serve).
- `npm run dev:mock`: run the dev server with the mock service; use this for browser tests.
- `npm run build`: create the production build in `dist/` with Vite. Kanit fonts are bundled from `@fontsource/kanit`, so no network access is needed.
- `npm start` (or `npm run preview`): serve the production build on port 3001.
- `npm test`: run Node service tests (always mock).
- `npx playwright install chromium`: install the browser required by UI checks.
- `npm run test:browser`, `node tests/language.mjs`, and `node tests/layout.mjs`: check workflows, localization, and layout against a running mock server. The first two accept `BASE_URL`; layout checks use port 3001.
- `npm run test:static`: after a mock `npm run build`, serve `dist/` at both `/` and `/translator/` to confirm the relative `base: "./"` build works from a subpath.

## Coding Style & Naming Conventions

Use JavaScript and ES modules only; do not introduce TypeScript. Prefer two-space indentation, double quotes, semicolons, and readable multiline JSX. No formatter or lint script is configured.

Use PascalCase component filenames, `useCamelCase` hooks, and camelCase utilities. Use `@/` imports for application modules (aliased to the project root in `vite.config.js` and `jsconfig.json`). Prefer Tailwind utilities and existing UI controls. Keep service logic outside components. Do not add Next.js-specific APIs or directives such as `"use client"`.

## Testing Guidelines

Service checks use Node's test runner and assertions in `*.test.mjs`; browser scripts use Playwright. No coverage threshold is configured. Run relevant checks and the build before review. Preserve keyboard access, clipboard behavior, language persistence, and desktop layouts without page scrolling. Check Thai and English at mobile widths.

## Commit & Pull Request Guidelines

This checkout has no Git history, so no existing commit convention can be inferred. Use concise imperative subjects, such as `Replace language toggle with dropdown`. Keep changes focused.

PRs should explain behavior, include validation results, link applicable issues, and provide desktop/mobile screenshots for visual changes.

## Product Constraints

Keep the tool anonymous. Keep the mock service working for tests and unconfigured builds. Centralize interface wording in `data/messages.js`. Preserve input and output when switching languages; guard browser storage access.
