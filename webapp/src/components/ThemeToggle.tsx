import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const reduced = useReducedMotion();

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="テーマ切替" className="overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={reduced ? false : { rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={reduced ? undefined : { rotate: 90, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
