import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { Languages } from "lucide-react";
export default function AppHeader() { const { t } = useLanguage();
 return <header className="sticky top-0 z-30 h-16 shrink-0 border-b bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 md:px-8 xl:px-12"><a href="./" className="flex items-center gap-2 sm:gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm"><Languages size={23} /></span><span><span className="block text-sm sm:text-lg font-medium tracking-tight">AI Translator</span><span className="hidden text-[11px] font-light text-slate-500 sm:block">{t("Internal Communication Assistant")}</span></span></a><div className="flex items-center gap-2 sm:gap-5"><LanguageSwitcher /></div></div></header>;
}
export function AppFooter() { const { t } = useLanguage(); return <footer className="mx-auto flex w-full max-w-[1440px] shrink-0 flex-col items-center justify-end gap-3 px-4 pb-3 pt-2 text-[11px] font-light text-slate-500 sm:flex-row md:px-8 xl:px-12"><span>AI Translator <span className="mx-2">·</span> {t("Internal use only")} <span className="mx-2">·</span> v1.0</span></footer>; }
