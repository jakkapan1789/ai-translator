import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROXY_PATH, buildWebConfig, normalizeProxyTarget } from "./scripts/webConfig.js";

// Emits dist/web.config from iis/web.config, with the AI proxy rule when AI_PROXY_TARGET is set.
function iisWebConfig({ target, clearOrigin }) {
  return {
    name: "iis-web-config",
    apply: "build",
    generateBundle() {
      const template = readFileSync(fileURLToPath(new URL("./iis/web.config", import.meta.url)), "utf8");
      this.emitFile({ type: "asset", fileName: "web.config", source: buildWebConfig(template, { target, clearOrigin }) });
    },
  };
}

export default defineConfig(({ mode }) => {
  // AI_PROXY_* have no VITE_ prefix, so they stay on the server and are not compiled into the bundle.
  const env = loadEnv(mode, process.cwd(), "");
  const target = normalizeProxyTarget(env.AI_PROXY_TARGET);
  const clearOrigin = env.AI_PROXY_CLEAR_ORIGIN === "true";
  // Same ./ai route as the IIS rule, so npm run dev and npm start behave like the deployed site.
  const proxy = target
    ? {
        [`/${PROXY_PATH}`]: {
          target,
          changeOrigin: true,
          rewrite: path => path.replace(new RegExp(`^/${PROXY_PATH}`), ""),
          configure: server => server.on("proxyReq", request => request.removeHeader("origin")),
        },
      }
    : undefined;

  return {
    plugins: [react(), iisWebConfig({ target, clearOrigin })],
    base: "./",
    resolve: {
      alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    server: { port: 3001, strictPort: true, proxy },
    preview: { port: 3001, strictPort: true, proxy },
  };
});
