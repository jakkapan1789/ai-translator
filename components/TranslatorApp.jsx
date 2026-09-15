import { LanguageProvider, useLanguage } from "@/components/i18n/LanguageProvider";
import { useEffect } from "react";
import AppHeader, { AppFooter } from "@/components/layout/AppHeader";
import TranslationModeSelector from "@/components/translator/TranslationModeSelector";
import TranslatorWorkspace from "@/components/translator/TranslatorWorkspace";
import { defaultSettings } from "@/hooks/useSettings";
import { useTranslationHistory } from "@/hooks/useTranslationHistory";
import { useTranslator } from "@/hooks/useTranslator";
export default function TranslatorApp() { return <LanguageProvider><TranslatorScreen /></LanguageProvider>; }
function TranslatorScreen() { const { t } = useLanguage();
 const settings = defaultSettings;
 const { add } = useTranslationHistory();
 const translator = useTranslator({ settings, addHistory: add });
 const { translate } = translator;
 const toThai = translator.targetLanguage === "th";
 useEffect(() => { const handleKey = event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing) { event.preventDefault(); translate(); } }; window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [translate]);
 return <div className="flex min-h-dvh flex-col md:h-dvh md:min-h-[640px]"><AppHeader /><main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pt-5 md:min-h-0 md:px-8 md:pt-4 xl:px-12"><section className="mb-3 flex shrink-0 items-center justify-between gap-4"><div><h1 className="text-[32px] font-medium leading-tight tracking-tight">AI Translator</h1><p className="mt-1 text-sm font-light leading-6 text-slate-500">{t(toThai ? "Translate English into clear, natural Thai for workplace communication." : "Translate Thai into clear, professional English for workplace communication.")}</p></div><span className="hidden items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-[10px] text-slate-500 lg:flex"><span className="size-1.5 rounded-full bg-brand-400" />{t("Workspace")} <span className="text-slate-300">/</span> {t("Translator")}</span></section><TranslationModeSelector mode={translator.mode} onChange={translator.setMode} /><TranslatorWorkspace translator={translator} settings={settings} /></main><AppFooter /></div>;
}
