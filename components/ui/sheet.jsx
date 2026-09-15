import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Tooltip } from "./tooltip";
export const Sheet = Dialog.Root;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({ children }) { const { t } = useLanguage(); const contentRef = useRef(null); return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px]" /><Dialog.Content ref={contentRef} onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus(); }} className="fixed inset-y-0 right-0 z-50 w-[94vw] max-w-[400px] overflow-y-auto border-l bg-white p-7 shadow-xl"><Tooltip label={t("Close settings")}><Dialog.Close aria-label={t("Close settings")} className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></Dialog.Close></Tooltip>{children}</Dialog.Content></Dialog.Portal>; }
