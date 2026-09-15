
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

// Shared dropdown styles so the translation mode and language dropdowns look the same.
export const selectTriggerClass = "group flex min-h-11 items-center rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-700 transition-colors duration-200 hover:border-brand-400 hover:bg-neutral-50 focus-visible:border-brand-600 focus-visible:outline-none data-[state=open]:border-brand-600 data-[state=open]:bg-neutral-100";
export const selectContentClass = "z-[60] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg";
export const selectItemClass = "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 pr-10 text-[15px] text-slate-800 outline-none transition-colors data-[highlighted]:bg-slate-100 data-[state=checked]:bg-brand-100 data-[highlighted]:data-[state=checked]:bg-brand-100";

export function SelectCaret() {
  return (
    <svg viewBox="0 0 10 6" aria-hidden="true" className="h-1.5 w-2.5 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180">
      <path d="M0 0h10L5 6z" fill="currentColor" />
    </svg>
  );
}

export function SelectCheck() {
  return (
    <Check size={18} strokeWidth={3} className="text-brand-600" />
  );
}

export function Select({ value, onValueChange, options, id, className, describedBy }) {
  const selected = options.find(option => option.id === value);
  const Icon = selected?.icon;

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-describedby={describedBy}
        className={cn(selectTriggerClass, "w-full gap-2.5 px-3 text-sm", className)}
      >
        {Icon && <Icon size={16} aria-hidden="true" className="shrink-0 text-brand-700" />}
        <span className="flex-1 text-left"><SelectPrimitive.Value /></span>
        <SelectPrimitive.Icon>
          <SelectCaret />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className={cn(selectContentClass, "min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)]")}
        >
          <SelectPrimitive.Viewport className="max-h-[var(--radix-select-content-available-height)]">
            {options.map(option => {
              const OptionIcon = option.icon;
              return (
                <SelectPrimitive.Item
                  key={option.id}
                  value={option.id}
                  disabled={option.disabled}
                  className={cn(selectItemClass, "data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-400")}
                >
                  {OptionIcon && <OptionIcon size={16} aria-hidden="true" className="shrink-0" />}
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.badge && <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{option.badge}</span>}
                  <SelectPrimitive.ItemIndicator className="absolute right-3">
                    <SelectCheck />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
