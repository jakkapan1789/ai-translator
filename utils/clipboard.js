import { toast } from "sonner";
export async function copyText(text, t = value => value) { try { await navigator.clipboard.writeText(text); toast.success(t("Translation copied")); return true; } catch { toast.error(t("Clipboard unavailable. Select the translation to copy it.")); return false; } }
