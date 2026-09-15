// Builds dist/web.config from public/web.config, adding an IIS reverse proxy rule for the AI server.
// The rule needs the IIS URL Rewrite and ARR modules, so it is only added when a target is configured;
// without a target the marker is removed and web.config stays compatible with plain static hosting.

export const PROXY_MARKER = "<!-- AI_PROXY_RULE -->";
export const PROXY_PATH = "ai";

const escapeXml = value => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function normalizeProxyTarget(target = "") {
  const trimmed = target.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) throw new Error(`AI_PROXY_TARGET must start with http:// or https://, got "${target}"`);
  return trimmed;
}

export function buildWebConfig(template, { target = "", clearOrigin = false } = {}) {
  if (!template.includes(PROXY_MARKER)) throw new Error(`public/web.config is missing the ${PROXY_MARKER} marker`);
  const url = normalizeProxyTarget(target);
  if (!url) return template.replace(new RegExp(`[ \\t]*${PROXY_MARKER}\\r?\\n?`), "");
  const originReset = clearOrigin
    ? `
          <serverVariables>
            <set name="HTTP_ORIGIN" value="" />
          </serverVariables>`
    : "";
  const rule = `<rewrite>
      <rules>
        <rule name="AI proxy" stopProcessing="true">
          <match url="^${PROXY_PATH}/(.*)" />${originReset}
          <action type="Rewrite" url="${escapeXml(url)}/{R:1}" />
        </rule>
      </rules>
    </rewrite>`;
  return template.replace(PROXY_MARKER, rule);
}
