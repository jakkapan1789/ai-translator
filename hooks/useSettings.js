import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "@/utils/storage";
import { modes } from "@/data/terminology";
import { toast } from "sonner";
export const defaultSettings = { defaultMode: "professional", terminology: true, autoCopy: false, saveHistory: true, processingTime: true };
export function useSettings() { const { t } = useLanguage();
 const [settings, setSettings] = useState(defaultSettings);
 const [ready, setReady] = useState(false);
 useEffect(() => { const saved = readStorage("ai-translator-settings", defaultSettings, v => v && typeof v === "object"); setSettings(Object.fromEntries(Object.entries(defaultSettings).map(([key, value]) => [key, key === "defaultMode" ? (modes.some(m => m.id === saved[key]) ? saved[key] : value) : (typeof saved[key] === "boolean" ? saved[key] : value)]))); setReady(true); }, []);
 function update(key, value) { setSettings(previous => { const next = { ...previous, [key]: value }; if (!writeStorage("ai-translator-settings", next)) toast.error(t("Settings could not be saved on this device")); return next; }); }
 return { settings, update, ready };
}
