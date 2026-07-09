import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FolderKanban, Home, Moon, Plus, Sun } from "lucide-react";
import { useEntities } from "@/hooks/useEntities";
import { useTheme } from "@/components/theme-provider";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { entityDetailPath } from "@/lib/links";
import { t } from "@i18n/ja";

/**
 * Cmd+K コマンドパレット(design-browser-ui.md §6.4、design P6-D14)。
 * プロジェクト/チケットのあいまい検索によるジャンプ + テーマ切替などのアクションを1画面に集約する。
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [createTicketOpen, setCreateTicketOpen] = React.useState(false);
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

  // サイドバーの検索ボックス(design-refs/geist-final.dc.html §サイドバー)からのクリックでも
  // このコマンドパレットを起動できるようにする(design-browser-ui.md §6.4の機能を維持したまま
  // 起動口を追加するだけなので、CustomEventで疎結合に連携する)。
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("pos:open-command-palette", handler);
    return () => window.removeEventListener("pos:open-command-palette", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
    <CreateTicketDialog open={createTicketOpen} onOpenChange={setCreateTicketOpen} />
    <CommandDialog open={open} onOpenChange={setOpen} title={t("webapp.commandPalette.title")}>
      <Command shouldFilter>
        <CommandInput placeholder={t("webapp.commandPalette.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("webapp.commandPalette.empty")}</CommandEmpty>
          <CommandGroup heading={t("webapp.commandPalette.actions")}>
            <CommandItem
              value={t("webapp.createTicket.action")}
              onSelect={() => {
                setOpen(false);
                setCreateTicketOpen(true);
              }}
            >
              <Plus className="opacity-60" />
              {t("webapp.createTicket.action")}
            </CommandItem>
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
    </>
  );
}
