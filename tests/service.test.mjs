import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWebConfig, normalizeProxyTarget } from "../scripts/webConfig.js";
import { translateText, transformText } from "../services/translatorService.js";
import { mockTranslations } from "../data/mockTranslations.js";
import { cleanOutput, hasUnexpectedScript, missingTerms, parseAiConfig } from "../services/aiClient.js";
test("known translations, mode formatting, and protected terms", async () => {
 for (const item of mockTranslations) {
  const response = await translateText({ text: item.source, mode: "manufacturing" });
  assert.equal(response.data.translatedText, item.result);
  assert.equal(response.success, true);
  assert.ok(response.data.processingTime >= 590);
 }
 const email = await translateText({ text: mockTranslations[0].source, mode: "email" });
 assert.equal(email.data.translatedText, mockTranslations[0].result);
 const generic = await translateText({ text: "ตรวจสอบ BPNO และ Serial No." });
 assert.ok(generic.data.isGeneric);
 assert.ok(generic.data.translatedText.includes("BPNO"));
 assert.ok(generic.data.translatedText.includes("Serial No."));
});
test("English to Thai translations", async () => {
 for (const item of mockTranslations) {
  const response = await translateText({ text: item.result, sourceLanguage: "en", targetLanguage: "th" });
  assert.equal(response.data.translatedText, item.source);
  assert.equal(response.data.targetLanguage, "th");
  assert.equal(response.data.isGeneric, false);
 }
 const short = await translateText({ text: mockTranslations[1].short, sourceLanguage: "en", targetLanguage: "th" });
 assert.equal(short.data.translatedText, mockTranslations[1].source);
 const email = await translateText({ text: mockTranslations[0].result, sourceLanguage: "en", targetLanguage: "th", mode: "email" });
 assert.equal(email.data.translatedText, mockTranslations[0].source);
 const generic = await translateText({ text: "Please check the Lot Number.", sourceLanguage: "en", targetLanguage: "th" });
 assert.ok(generic.data.isGeneric);
 assert.ok(generic.data.translatedText.includes("Lot Number"));
});
test("AI output cleanup", () => {
 const source = "Please check the Lot Number and Serial No. before the next shift starts.";
 assert.equal(cleanOutput("กรุณาตรวจสอบLOT NUMBER และ SERIAL NO. ก่อนเริ่มกะถัดไป", { sourceText: source }), "กรุณาตรวจสอบ Lot Number และ Serial No. ก่อนเริ่มกะถัดไป");
 assert.equal(cleanOutput("ตรวจ bpno กับ serial no ก่อน", { sourceText: "Check BPNO and Serial No." }), "ตรวจ BPNO กับ Serial No. ก่อน");
 assert.equal(cleanOutput("Dear Team,\n\nThe line stopped.\n\nBest regards,  \n[Your Name]"), "Dear Team,\n\nThe line stopped.\n\nBest regards,");
 assert.equal(cleanOutput("<think>draft</think>\n```\nThe Operation team is ready.\n```"), "The Operation team is ready.");
 assert.equal(cleanOutput("Normal operation resumed. Cooperation matters [note inline]", { sourceText: "Check the Operation step." }), "Normal Operation resumed. Cooperation matters [note inline]");
 assert.equal(cleanOutput("Normal operation resumed.", { sourceText: "การทำงานกลับมาปกติ" }), "Normal operation resumed.");
 assert.equal(cleanOutput("แจ้งผลกลับมาได้มั้ยครับ/ค่ะ", { stripThaiParticles: true }), "แจ้งผลกลับมาได้มั้ย");
 assert.equal(cleanOutput("คะแนนผ่านแล้วค่ะ ขอบคุณครับ\nรบกวนตรวจสอบนะคะ?", { stripThaiParticles: true }), "คะแนนผ่านแล้ว ขอบคุณ\nรบกวนตรวจสอบนะ?");
 assert.equal(cleanOutput("ขอบคุณครับ", { stripThaiParticles: false }), "ขอบคุณครับ");
 assert.equal(cleanOutput("แจ้งผลได้มั้ยครับ/คะ่", { stripThaiParticles: true }), "แจ้งผลได้มั้ย");
 assert.equal(hasUnexpectedScript("รบกวนตรวจสอบ 번호를 확인해 주십시오.", "th", "Please check the number."), true);
 assert.equal(hasUnexpectedScript("líne 3 หยุดทำงาน", "th", "line 3 went down"), true);
 assert.equal(hasUnexpectedScript("ช่าง alguien查漏补缺", "th", "can someone check"), true);
 assert.equal(hasUnexpectedScript("กรุณาตรวจสอบ Lot Number ก่อนเริ่มกะถัดไป", "th", "Please check the Lot Number."), false);
 assert.equal(hasUnexpectedScript("The line stopped for 10×20 minutes.", "en", "ไลน์หยุด"), false);
 assert.equal(hasUnexpectedScript("The เครื่อง stopped.", "en", "เครื่องหยุด"), true);
 assert.equal(hasUnexpectedScript("Please check the Part Number.", "th", "Please check the Part Number."), true);
 assert.deepEqual(missingTerms("กรุณาตรวจสอบเลขล็อตและ Serial No.", "Check the Lot Number and Serial No."), ["Lot Number"]);
 assert.deepEqual(missingTerms("กรุณาตรวจสอบ Lot Number", "Check the Lot Number"), []);
 assert.deepEqual(missingTerms("ตรวจสอบเลขล็อต", ""), []);});
test("AI config parsing", () => {
 const defaults = parseAiConfig({});
 assert.equal(defaults.provider, "mock");
 assert.equal(defaults.temperature, 0.2);
 assert.equal(defaults.seed, undefined);
 assert.equal(defaults.timeoutMs, 60000);
 const custom = parseAiConfig({ VITE_AI_PROVIDER: "Ollama", VITE_AI_API_URL: "http://localhost:11434/", VITE_AI_MODEL: "qwen2.5:7b", VITE_AI_TEMPERATURE: "0", VITE_AI_SEED: "42" });
 assert.equal(custom.provider, "ollama");
 assert.equal(custom.apiUrl, "http://localhost:11434");
 assert.equal(custom.temperature, 0);
 assert.equal(custom.seed, 42);
 const invalid = parseAiConfig({ VITE_AI_TEMPERATURE: "hot", VITE_AI_SEED: "1.5" });
 assert.equal(invalid.temperature, 0.2);
 assert.equal(invalid.seed, undefined);
 const outOfRange = parseAiConfig({ VITE_AI_TEMPERATURE: "3", VITE_AI_SEED: "" });
 assert.equal(outOfRange.temperature, 0.2);
 assert.equal(outOfRange.seed, undefined);
});
test("IIS web.config proxy rule", () => {
 const template = readFileSync(new URL("../iis/web.config", import.meta.url), "utf8");
 const plain = buildWebConfig(template);
 assert.ok(!plain.includes("AI_PROXY_RULE") && !plain.includes("<rewrite>"));
 assert.ok(plain.includes('<add value="index.html" />'));
 const proxied = buildWebConfig(template, { target: "https://ai.company.local/v1/" });
 assert.ok(proxied.includes('<match url="^ai/(.*)" />'));
 assert.ok(proxied.includes('<action type="Rewrite" url="https://ai.company.local/v1/{R:1}" />'));
 assert.ok(!proxied.includes("HTTP_ORIGIN"));
 assert.ok(buildWebConfig(template, { target: "http://10.0.0.5:11434", clearOrigin: true }).includes('<set name="HTTP_ORIGIN" value="" />'));
 assert.ok(buildWebConfig(template, { target: "https://ai.local/a&b" }).includes("https://ai.local/a&amp;b/{R:1}"));
 assert.equal(normalizeProxyTarget("  "), "");
 assert.throws(() => normalizeProxyTarget("ai.company.local"), /http/);
});
test("validation and simulated server errors", async () => {
 await assert.rejects(translateText({ text: " " }), /required/);
 await assert.rejects(translateText({ text: "x".repeat(5001) }), /5000/);
 await assert.rejects(translateText({ text: "test", simulateError: true }), /Unable to connect/);
});
test("mock English improvement", async () => {
 assert.equal(await transformText("Machine have problem technician checking.", "improve"), mockTranslations[0].result);
 assert.equal(await transformText(mockTranslations[0].result, "shorter"), mockTranslations[0].short);
});
