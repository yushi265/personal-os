import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FolderKanban, Home, Moon, Sun } from "lucide-react";
import { useEntities } from "@/hooks/useEntities";
import { useTheme } from "@/components/theme-provider";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { entityDetailPath } from "@/lib/links";
import { t } from "@i18n/ja";

/**
 * Cmd+K コマンドパレット(design-browser-ui.md §6.4、design P6-D14)。
 * プロジェクト/チケットのあいまい検索によるジャンプ + テーマ切替などのアクションを1画面に集約する。
 * Goalは詳細画面を持たないため一覧側の対象外(entityDetailPathの仕様に合わせる)。
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const { data: projects } = useEntities("project");
  const { data: tickets } = useEntities("ticket");

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t("webapp.commandPalette.title")}>
      <Command shouldFilter>
        <CommandInput placeholder={t("webapp.commandPalette.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("webapp.commandPalette.empty")}</CommandEmpty>
          <CommandGroup heading={t("webapp.commandPalette.actions")}>
            <CommandItem value="home" onSelect={() => go("/")}>
              <Home className="opacity-60" />
              {t("webapp.home.title")}
            </CommandItem>
            <CommandItem value="projects" onSelect={() => go("/projects")}>
              <FolderKanban className="opacity-60" />
              {t("webapp.projects.title")}
            </CommandItem>
            <CommandItem
              value={t("webapp.commandPalette.toggleTheme")}
              onSelect={() => {
                setTheme(isDark ? "light" : "dark");
                setOpen(false);
              }}
            >
              {isDark ? <Sun className="opacity-60" /> : <Moon className="opacity-60" />}
              {t("webapp.commandPalette.toggleTheme")}
            </CommandItem>
          </CommandGroup>
          {projects && projects.length > 0 && (
            <CommandGroup heading={t("webapp.projects.title")}>
              {projects.map((project) => (
                <CommandItem key={project.path} value={project.title} onSelect={() => go(entityDetailPath(project) ?? "/projects")}>
                  <FolderKanban className="opacity-60" />
                  {project.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tickets && tickets.length > 0 && (
            <CommandGroup heading={t("webapp.detail.tickets")}>
              {tickets.map((ticket) => (
                <CommandItem key={ticket.path} value={ticket.title} onSelect={() => go(entityDetailPath(ticket) ?? "/projects")}>
                  <FileText className="opacity-60" />
                  {ticket.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
