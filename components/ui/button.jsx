import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-normal transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 shrink-0", {
  variants: { variant: { default: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm", outline: "border bg-white hover:bg-slate-50 text-slate-600", ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900", secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100" }, size: { default: "min-h-11 px-4 py-2", sm: "min-h-11 px-3 py-2 text-xs", icon: "size-11" } }, defaultVariants: { variant: "default", size: "default" },
});
export function Button({ className, variant, size, asChild = false, ...props }) { const Comp = asChild ? Slot : "button"; return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />; }
