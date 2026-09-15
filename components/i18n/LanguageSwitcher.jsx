
import * as Select from "@radix-ui/react-select";
import { Languages } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { languages } from "@/data/messages";
import { SelectCaret, SelectCheck, selectContentClass, selectItemClass, selectTriggerClass } from "@/components/ui/select";
import { cn } from "@/utils/cn";

export default function LanguageSwitcher() {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <Select.Root value={language} onValueChange={changeLanguage}>
      <Select.Trigger
        aria-label={t("Interface language")}
        className={cn(selectTriggerClass, "shrink-0 gap-2 px-3 text-sm sm:gap-3 sm:px-4 sm:text-[15px]")}
      >
        <Languages size={20} aria-hidden="true" className="shrink-0 text-slate-600" />
        <span className="min-w-9 text-left sm:min-w-14">
          <Select.Value />
        </span>
        <Select.Icon>
          <SelectCaret />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(selectContentClass, "w-52")}
        >
          <Select.Viewport>
            <Select.Group>
              <Select.Label className="px-3 pb-2 pt-1.5 text-sm text-slate-500">
                {t("Language")}
              </Select.Label>
              {languages.map(item => (
                <Select.Item
                  key={item.id}
                  value={item.id}
                  lang={item.id}
                  aria-label={item.label}
                  className={selectItemClass}
                >
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3">
                    <SelectCheck />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
