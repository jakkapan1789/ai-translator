import { mockTranslations } from "../data/mockTranslations.js";
import { protectedTerms } from "../data/terminology.js";
import { usesLiveAi, translateWithAi, transformWithAi } from "./aiClient.js";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export async function translateText({ text, sourceLanguage = "th", targetLanguage = "en", mode = "professional", useCompanyTerminology = true, simulateError = false }) {
  if (!text?.trim()) throw new Error("Input text is required");
  if (text.length > 5000) throw new Error("Maximum 5000 characters allowed");
  const started = performance.now();
  if (usesLiveAi && !simulateError) {
    const translatedText = await translateWithAi({ text, sourceLanguage, targetLanguage, mode, useCompanyTerminology });
    return { success: true, data: { translatedText, sourceLanguage, targetLanguage, mode, isMock: false, isGeneric: false, processingTime: Math.round(performance.now() - started) } };
  }
  await delay(600 + Math.floor(Math.random() * 401));
  if (simulateError) throw new Error("Unable to connect to AI server");
  const input = text.trim();
  let match;
  let translatedText;
  if (targetLanguage === "th") {
    match = mockTranslations.find(item => item.result === input || item.short === input);
    translatedText = match?.source || "ทีมงานกำลังตรวจสอบสถานการณ์ และจะแจ้งความคืบหน้าให้ทราบโดยเร็วที่สุด";
  } else {
    match = mockTranslations.find(item => item.source === input);
    translatedText = match?.result || "The team is reviewing the current situation and will provide an update as soon as more information is available.";
    if (/^machine have problem technician checking\.?$/i.test(input)) translatedText = mockTranslations[0].result;
    if (mode === "simple" && match) translatedText = match.short;
  }
  if (useCompanyTerminology) {
    for (const term of protectedTerms) if (text.includes(term) && !translatedText.includes(term)) translatedText += "\n" + term;
  }
  return { success: true, data: { translatedText, sourceLanguage, targetLanguage, mode, isMock: true, isGeneric: !match, processingTime: Math.round(performance.now() - started) } };
}
export async function transformText(text, action) {
  if (!text?.trim()) throw new Error("Input text is required");
  if (usesLiveAi) return transformWithAi(text, action);
  await delay(650);
  const match = mockTranslations.find(item => item.result === text);
  if (action === "shorter") return match?.short || "The team is reviewing the situation and will share an update.";
  if (action === "formal") return "Please be advised that " + text.charAt(0).toLowerCase() + text.slice(1);
  if (/machine have problem/i.test(text)) return mockTranslations[0].result;
  return text.replace("currently experiencing an issue", "experiencing a technical issue").replace("The team is reviewing", "Our team is carefully reviewing");
}
