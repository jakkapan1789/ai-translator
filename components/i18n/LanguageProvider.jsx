import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { languages, translateMessage } from "@/data/messages";
import { readStorage, writeStorage } from "@/utils/storage";
const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
 const [language, setLanguage] = useState("en");
 useEffect(() => { setLanguage(readStorage("ai-translator-language", "en", value => languages.some(item => item.id === value))); }, []);
 useEffect(() => { document.documentElement.lang = language; }, [language]);
 function changeLanguage(value) {
  if (!languages.some(item => item.id === value)) return;
  setLanguage(value);
  toast.dismiss();
  if (!writeStorage("ai-translator-language", value)) toast.error(translateMessage(value, "Settings could not be saved on this device"));
 }
 const t = key => translateMessage(language, key);
 return <LanguageContext.Provider value={{ language, changeLanguage, t }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
 const context = useContext(LanguageContext);
 if (!context) throw new Error("useLanguage requires LanguageProvider");
 return context;
}
