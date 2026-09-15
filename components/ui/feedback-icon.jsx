import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

// Shows `icon`, and turns it into a check mark while `done` is true.
export function FeedbackIcon({ icon: Icon, done }) {
  return (
    <span data-done={done || undefined} className="relative inline-flex size-4 shrink-0">
      <Icon aria-hidden="true" className={cn("absolute inset-0 transition-all duration-200 ease-out motion-reduce:transition-none", done ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
      <Check aria-hidden="true" strokeWidth={3} className={cn("absolute inset-0 text-brand-600 transition-all duration-200 ease-out motion-reduce:transition-none", done ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0")} />
    </span>
  );
}
