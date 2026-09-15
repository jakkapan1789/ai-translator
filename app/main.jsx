import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import TranslatorApp from "@/components/TranslatorApp";
import "@fontsource/kanit/300.css";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/700.css";
import "./globals.css";

createRoot(document.getElementById("root")).render(
  <>
    <TranslatorApp />
    <Toaster richColors position="bottom-right" closeButton />
  </>
);
