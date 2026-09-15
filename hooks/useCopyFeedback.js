import { useEffect, useRef, useState } from "react";
import { copyText } from "@/utils/clipboard";

// A flag that turns on when flash() is called and turns itself off after `duration` ms.
export function useFlash(duration = 1600) {
  const [active, setActive] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  function flash() {
    setActive(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), duration);
  }
  return { active, flash };
}

// Copies text and keeps a short "copied" state after a successful copy, for icon feedback.
export function useCopyFeedback(t, duration) {
  const { active, flash } = useFlash(duration);
  async function copy(text) {
    if (await copyText(text, t)) flash();
  }
  return { copied: active, copy };
}
