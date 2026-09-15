import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const root = resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer(async (request, response) => {
  let pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/translator/")) pathname = pathname.slice("/translator".length);
  const file = resolve(root, "." + pathname + (pathname.endsWith("/") ? "index.html" : ""));
  if (!file.startsWith(root + "/")) { response.writeHead(403).end(); return; }
  try {
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
try {
  for (const base of ["/", "/translator/"]) {
    const page = await browser.newPage();
    const failures = [];
    const external = [];
    const loadedFonts = [];
    page.on("pageerror", error => failures.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400) failures.push(response.url());
      if (response.url().includes(".woff")) loadedFonts.push(response.url());
    });
    await page.route("**/*", route => {
      if (!route.request().url().startsWith(origin + "/")) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(origin + base);
    await page.locator("#source-text").fill("เครื่องจักรมีปัญหา ช่างกำลังตรวจสอบ");
    await page.locator("#source-text").press("Control+Enter");
    await expect(page.locator('p[lang="en"]')).toContainText("The machine is currently experiencing an issue");
    await page.getByRole("combobox", { name: "Interface language" }).click();
    await page.getByRole("option", { name: "ไทย", exact: true }).click();
    await expect(page.getByRole("button", { name: "แปลเป็นภาษาอังกฤษ", exact: true })).toBeVisible();
    await page.locator("header a").click();
    await expect(page.getByRole("combobox", { name: "ภาษาที่แสดง" })).toBeVisible();
    assert.equal(new URL(page.url()).pathname, base);
    await page.evaluate(() => document.fonts.ready);
    assert.ok(loadedFonts.length > 0, "Bundled fonts must load");
    assert.ok(loadedFonts.every(url => url.startsWith(origin + base + "assets/")));
    assert.deepEqual(external, []);
    assert.deepEqual(failures, []);
    await page.close();
  }
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.ok(html.includes('./assets/'));
  assert.ok((await readFile(resolve(root, "web.config"), "utf8")).includes("index.html"));
  console.log("PASS: static root/subfolder hosting, refresh, translation, language persistence, bundled fonts, and zero external requests.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
