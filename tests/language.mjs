import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { messages } from "../data/messages.js";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
async function chooseLanguage(name) {
 await page.getByRole("combobox", { name: /Interface language|ภาษาที่แสดง/ }).click();
 await page.getByRole("option", { name, exact: true }).click();
}
try {
 await page.goto(process.env.BASE_URL || "http://localhost:3001");
 const languageField = page.getByRole("combobox", { name: "Interface language" });
 await languageField.focus();
 await page.keyboard.press("Enter");
 await expect(page.getByRole("option", { name: "English", exact: true })).toBeFocused();
 await page.keyboard.press("ArrowDown");
 await expect(page.getByRole("option", { name: "ไทย", exact: true })).toBeFocused();
 await page.keyboard.press("Enter");
 await page.getByRole("button", { name: "แปลเป็นภาษาอังกฤษ", exact: true }).waitFor();
 assert.equal(await page.locator("html").getAttribute("lang"), "th");
 assert.equal(await page.getByRole("combobox", { name: "ภาษาที่แสดง" }).textContent(), "ไทย");
 const source = page.locator("#source-text");
 assert.equal(await page.getByText("ลองใช้ตัวอย่าง:").count(), 0);
 await source.fill("เครื่องจักรมีปัญหา ช่างกำลังตรวจสอบ");
 const original = await source.inputValue();
 await source.press("Control+Enter");
 await page.getByText("แปลข้อความเรียบร้อยแล้ว", { exact: true }).waitFor();
 const output = await page.locator('p[lang="en"]').textContent();
 await page.getByRole("button", { name: "คัดลอกคำแปล", exact: true }).click();
 await page.getByText("คัดลอกคำแปลแล้ว", { exact: true }).waitFor();
 assert.equal(await page.evaluate(() => navigator.clipboard.readText()), output);
 await chooseLanguage("English");
 assert.equal(await source.inputValue(), original);
 assert.equal(await page.locator('p[lang="en"]').textContent(), output);
 await chooseLanguage("ไทย");
 assert.equal(await page.getByRole("button", { name: "เปิดการตั้งค่า" }).count(), 0);
 await page.getByRole("combobox", { name: "รูปแบบการแปล", exact: true }).click();
 assert.equal(await page.getByRole("option", { name: /อีเมล/ }).getAttribute("aria-disabled"), "true");
 assert.equal(await page.getByRole("option").getByText("เร็วๆ นี้", { exact: true }).count(), 4);
 await page.keyboard.press("Escape");
 assert.equal(await page.getByRole("combobox", { name: "รูปแบบการแปล", exact: true }).textContent(), "มืออาชีพ");
 await page.reload();
 await page.getByRole("button", { name: "แปลเป็นภาษาอังกฤษ", exact: true }).waitFor();
 assert.equal(await page.locator("html").getAttribute("lang"), "th");
 for (const language of ["ไทย", "English"]) {
  await chooseLanguage(language);
  for (const width of [1440, 768, 390, 320]) {
   await page.setViewportSize({ width, height: 900 });
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), language + " overflow at " + width);
  }
 }
 await chooseLanguage("ไทย");
 await page.setViewportSize({ width: 390, height: 844 });
 await page.evaluate(() => window.scrollTo(0, 0));
 await page.screenshot({ path: "/tmp/translator-th-mobile.png", fullPage: true });
 const englishText = await page.locator("body").innerText();
 for (const key of Object.keys(messages.en)) {
  if (key.length > 12) assert.ok(!englishText.includes(key), "Untranslated visible wording: " + key);
 }
 await page.evaluate(() => localStorage.setItem("ai-translator-language", JSON.stringify("invalid")));
 await page.reload();
 await page.getByRole("button", { name: "Translate to English", exact: true }).waitFor();
 assert.equal(await page.locator("html").getAttribute("lang"), "en");
 assert.deepEqual(errors, []);
 console.log("PASS: Thai/English wording, copy toast, preserved input/output, persisted locale, localized mode selector, invalid locale fallback, responsive layouts, no runtime errors.");
} finally { await browser.close(); }
