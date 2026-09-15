import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "@/utils/storage";
import { toast } from "sonner";
export function useTranslationHistory() { const { t } = useLanguage();
 const [history, setHistory] = useState([]);
 useEffect(() => { setHistory(readStorage("ai-translator-history", [], v => Array.isArray(v) && v.every(i => i && typeof i.id === "string" && typeof i.sourceText === "string" && typeof i.translatedText === "string" && typeof i.mode === "string" && Number.isFinite(Date.parse(i.timestamp)))).slice(0, 5)); }, []);
 function persist(next) { if (!writeStorage("ai-translator-history", next)) toast.error(t("History could not be saved on this device")); return next; }
 function add(record) { setHistory(previous => persist([{ ...record, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...previous].slice(0, 5))); }
 function clear() { setHistory(persist([])); toast.success(t("Translation history cleared")); }
 return { history, add, clear };
}
