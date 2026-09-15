import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { translateText, transformText } from "@/services/translatorService";
import { copyText } from "@/utils/clipboard";
import { readStorage, writeStorage } from "@/utils/storage";
const directions = ["th-en", "en-th"];
const directionKey = "ai-translator-direction";
export function useTranslator({ settings, addHistory }) { const { t } = useLanguage();
 const [text, setText] = useState("");
 const [mode, setMode] = useState("professional");
 const [direction, setDirection] = useState(() => readStorage(directionKey, "th-en", value => directions.includes(value)));
 const [result, setResult] = useState(null);
 const [loading, setLoading] = useState(false);
 const busy = useRef(false);
 const inputRef = useRef(null);
 const [sourceLanguage, targetLanguage] = direction.split("-");
 function updateText(value) { if (value.length > 5000) toast.error(t("Maximum 5000 characters allowed")); setText(value.slice(0, 5000)); }
 // Swaps both panels: the translation becomes the input, and the previous input is shown as the translation.
 function swapLanguages() {
  if (busy.current) return;
  const nextDirection = `${targetLanguage}-${sourceLanguage}`;
  setDirection(nextDirection);
  writeStorage(directionKey, nextDirection);
  if (result) {
   const previousText = text;
   setText(result.translatedText.slice(0, 5000));
   setResult(previousText.trim() ? { ...result, translatedText: previousText, sourceLanguage: targetLanguage, targetLanguage: sourceLanguage, isGeneric: false, processingTime: null } : null);
  }
  inputRef.current?.focus();
 }
 async function translate() {
  if (busy.current) return;
  if (!text.trim()) { toast.error(t("Input text is required")); inputRef.current?.focus(); return; }
  busy.current = true; setLoading(true);
  try {
   const response = await translateText({ text, sourceLanguage, targetLanguage, mode, useCompanyTerminology: settings.terminology });
   if (!response.success || typeof response.data?.translatedText !== "string") throw new Error("Unexpected response from AI server");
   setResult(response.data);
   if (settings.saveHistory) addHistory({ sourceText: text, translatedText: response.data.translatedText, mode, sourceLanguage, targetLanguage });
   toast.success(t("Translation completed"));
   if (settings.autoCopy) await copyText(response.data.translatedText, t);
  } catch (error) { toast.error(t(error.message || "Unable to connect to AI server")); }
  finally { busy.current = false; setLoading(false); }
 }
 async function transform(action) {
  if (busy.current || !result || result.targetLanguage !== "en") return;
  busy.current = true; setLoading(true);
  const start = performance.now();
  try { const translatedText = await transformText(result.translatedText, action); setResult({ ...result, translatedText, processingTime: Math.round(performance.now() - start) }); toast.success(t(action === "improve" ? "English improved" : action === "formal" ? "Translation made formal" : "Translation shortened")); if (settings.autoCopy) await copyText(translatedText, t); }
  catch (error) { toast.error(t(error.message || "An unexpected error occurred")); }
  finally { busy.current = false; setLoading(false); }
 }
 return { text, updateText, mode, setMode, sourceLanguage, targetLanguage, swapLanguages, result, loading, inputRef, translate, transform };
}
