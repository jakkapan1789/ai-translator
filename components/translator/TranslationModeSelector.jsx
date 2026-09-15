
import { BriefcaseBusiness, Factory, Mail, Code2, MessageSquare, Info } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { Select } from "@/components/ui/select";
import { modes } from "@/data/terminology";

const icons = {
  professional: BriefcaseBusiness,
  manufacturing: Factory,
  email: Mail,
  technical: Code2,
  simple: MessageSquare,
};

export default function TranslationModeSelector({ mode, onChange }) {
  const { t } = useLanguage();
  const options = modes.map(item => ({
    id: item.id,
    label: t(item.label),
    icon: icons[item.id],
    disabled: !item.available,
    badge: item.available ? undefined : t("Soon"),
  }));

  return (
    <div className="mb-3 shrink-0">
      <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="translation-mode" className="text-xs text-slate-500">
          {t("Translation mode")}
        </label>
        <Select
          id="translation-mode"
          value={mode}
          onValueChange={onChange}
          options={options}
          describedBy="translation-mode-description"
          className="sm:w-56"
        />
      </div>
      <p id="translation-mode-description" className="flex items-center gap-1.5 text-xs font-light text-slate-500">
        <Info size={13} aria-hidden="true" className="shrink-0" />
        {t(modes.find(item => item.id === mode)?.description)}
      </p>
    </div>
  );
}
