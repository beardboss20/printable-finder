import { useEffect } from "react";
import { applyTheme, getPreferredTheme } from "@/lib/theme";

export function ThemeInit() {
  useEffect(() => {
    applyTheme(getPreferredTheme());
  }, []);
  return null;
}
