import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);
async function chooseLanguage(name) {
 await page.getByRole("combobox", { name: /Interface language|ภาษาที่แสดง/ }).click();
 await page.getByRole("option", { name, exact: true }).click();
}
try {
 await page.goto("http://localhost:3001");
 await page.locator("#source-text").fill("เครื่องจักรมีปัญหา ช่างกำลังตรวจสอบ");
 await page.locator("#source-text").press("Control+Enter");
 await page.locator('p[lang="en"]').waitFor();
 for (const language of ["English", "ไทย"]) {
  await chooseLanguage(language);
  for (const [width, height] of [[1440,900],[1366,768],[1280,720],[1024,768],[768,900]]) {
   await page.setViewportSize({ width, height });
   const metrics = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth,
    input: document.querySelector("textarea").getBoundingClientRect().height,
    footer: document.querySelector("footer").getBoundingClientRect().bottom
   }));
   assert.ok(metrics.height <= height, JSON.stringify({ language, width, height, metrics }));
   assert.ok(metrics.width <= width);
   assert.ok(metrics.input >= 100);
   assert.ok(metrics.footer <= height);
  }
 }
 await page.setViewportSize({ width: 1366, height: 768 });
 await page.screenshot({ path: "/tmp/translator-fit-desktop.png" });
 await page.locator('p[lang="en"]').evaluate(el => el.textContent = "A long translation for testing. ".repeat(500));
 assert.ok(await page.locator('p[lang="en"]').evaluate(el => el.scrollHeight > el.clientHeight));
 assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 768);
 await page.setViewportSize({ width: 390, height: 844 });
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
 console.log("PASS: no desktop page scrolling in both languages, usable panel heights, contained long output, mobile width.");
} finally { await browser.close(); }
