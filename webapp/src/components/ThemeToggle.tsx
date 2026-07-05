import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

// テーマ切替ボタン(design-refs/geist-final.dc.html §サイドバー フッタ: 26px border radius6、
// light時=月アイコン/dark時=太陽)。
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const reduced = useReducedMotion();

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="テーマ切替"
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border text-muted-foreground transition-colors hover:bg-hairline hover:text-fg"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={reduced ? false : { rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={reduced ? undefined : { rotate: 90, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
