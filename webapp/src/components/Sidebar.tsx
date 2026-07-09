import * as React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Home as HomeIcon, Inbox as InboxIcon, LayoutGrid, ListChecks, Search } from "lucide-react";
import { ConnectionDot } from "@/components/ConnectionDot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEntities } from "@/hooks/useEntities";
import { t } from "@i18n/ja";

const STORAGE_KEY = "pos.sidebar.collapsed";
const PROJECTS_EXPANDED_KEY = "pos.sidebar.projectsExpanded";
const OPEN_WIDTH = 224;
const COLLAPSED_WIDTH = 56;

// 折りたたみ可能なサイドバー(design-refs/geist-final.dc.html §サイドバー)。
// 開224px/閉56pxをwidth 0.2s easeで切替、状態はlocalStorageへ永続化する。
function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsedState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  const setCollapsed = React.useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    setCollapsedState(next);
  }, []);

  return [collapsed, setCollapsed];
}

function useProjectsExpanded(): [boolean, (next: boolean) => void] {
  const [expanded, setExpandedState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PROJECTS_EXPANDED_KEY) === "1";
  });

  const setExpanded = React.useCallback((next: boolean) => {
    window.localStorage.setItem(PROJECTS_EXPANDED_KEY, next ? "1" : "0");
    setExpandedState(next);
  }, []);

  return [expanded, setExpanded];
}

export function Sidebar({ connected }: { connected: boolean }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [projectsExpanded, setProjectsExpanded] = useProjectsExpanded();
  const location = useLocation();
  const params = useParams();
  // プロジェクト詳細画面(/projects/:path)滞在中のみ、サブリストの該当行をアクティブ表示する対象パス。
  const currentProjectPath = location.pathname.startsWith("/projects/") && params.path ? decodeURIComponent(params.path) : undefined;
  const { data: projects } = useEntities("project");

  const homeActive = location.pathname === "/";
  const inboxActive = location.pathname.startsWith("/inbox");
  // プロジェクト詳細もこのナビの延長線上にあるため滞在中も「プロジェクト一覧」をアクティブにする。
  const projectsActive = location.pathname.startsWith("/projects");
  // チケット一覧・チケット詳細(/tickets/:path)は「チケット」ナビをアクティブにする。
  const ticketsActive = location.pathname.startsWith("/tickets");
  const todosActive = location.pathname.startsWith("/todos");
  const showProjectsSublist = !collapsed && projectsExpanded;

  return (
    <aside
      // ページ地(--bg)とサイドバー(--surface)が同トーンになったぶん、右方向のうっすらとした影で
      // メイン領域との境目を補強する(darkはborderの明度差が効くため影はほぼ効かない=補助として無害)。
      className="flex h-screen shrink-0 flex-col border-r border-border bg-surface shadow-[2px_0_8px_rgba(0,0,0,0.03)] transition-[width] duration-200 ease-in-out dark:shadow-[2px_0_8px_rgba(0,0,0,0.4)]"
      style={{ width: collapsed ? COLLAPSED_WIDTH : OPEN_WIDTH }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        {/* 触感演出: 意味は無いがhoverでクルッと一回転する(ease-bounceで着地が弾む) */}
        <span
          className="h-5 w-5 shrink-0 bg-fg transition-[background-color,transform] duration-500 ease-bounce hover:rotate-[360deg]"
          style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
          aria-hidden="true"
        />
        {!collapsed && <span className="flex-1 truncate text-sm font-semibold">{t("webapp.projects.title")}</span>}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-faint transition-[background-color,color,transform] duration-150 hover:bg-hairline hover:text-fg active:scale-90"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("pos:open-command-palette"))}
            className="flex h-8 w-full items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-left text-muted-foreground transition-[background-color,color,border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:text-fg hover:shadow-sm active:translate-y-0 active:scale-[0.98] active:shadow-none"
          >
            <Search className="h-3 w-3 shrink-0 text-faint" />
            <span className="flex-1 truncate text-xs text-faint">{t("webapp.commandPalette.placeholder")}</span>
            <kbd className="shrink-0 rounded border border-border px-1 font-mono text-[10px] text-faint">⌘K</kbd>
          </button>
        </div>
      )}

      {/* breadcrumb navと区別できるようアクセシブルネームを付ける(WCAG 1.3.1) */}
      <nav aria-label={t("webapp.nav.label")} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        <Link
          to="/"
          className={`group flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
            collapsed ? "justify-center" : ""
          } ${homeActive ? "bg-brand-tint font-medium text-brand" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
        >
          {/* ナビアイコンはhoverで弾んで膨らむ(触感) */}
          <HomeIcon className="h-4 w-4 shrink-0 transition-transform duration-200 ease-bounce group-hover:scale-110 group-active:scale-90" />
          {!collapsed && <span className="truncate">{t("webapp.home.title")}</span>}
        </Link>

        <Link
          to="/inbox"
          className={`group flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
            collapsed ? "justify-center" : ""
          } ${inboxActive ? "bg-brand-tint font-medium text-brand" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
        >
          <InboxIcon className="h-4 w-4 shrink-0 transition-transform duration-200 ease-bounce group-hover:scale-110 group-active:scale-90" />
          {!collapsed && <span className="truncate">{t("webapp.inbox.title")}</span>}
        </Link>

        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            to="/projects"
            className={`group flex h-8 flex-1 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
              collapsed ? "justify-center" : ""
            } ${projectsActive ? "bg-brand-tint font-medium text-brand" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 transition-transform duration-200 ease-bounce group-hover:scale-110 group-active:scale-90" />
            {!collapsed && <span className="truncate">{t("webapp.projects.title")}</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              aria-label={projectsExpanded ? "プロジェクト一覧を閉じる" : "プロジェクト一覧を展開する"}
              aria-expanded={projectsExpanded}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint transition-[background-color,color,transform] duration-150 hover:bg-hairline hover:text-fg active:scale-90"
            >
              {projectsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {showProjectsSublist && (
          <div className="flex flex-col gap-0.5 pb-1">
            {(projects ?? []).map((project) => (
              <Link
                key={project.path}
                to={`/projects/${encodeURIComponent(project.path)}`}
                title={project.title}
                className={`flex h-7 items-center truncate rounded-md py-1 pl-8 pr-2 text-[13px] transition-colors ${
                  currentProjectPath === project.path
                    ? "bg-brand-tint font-medium text-brand"
                    : "text-muted-foreground hover:bg-hairline hover:text-fg"
                }`}
              >
                <span className="truncate">{project.title}</span>
              </Link>
            ))}
          </div>
        )}

        <Link
          to="/tickets"
          className={`group flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
            collapsed ? "justify-center" : ""
          } ${ticketsActive ? "bg-brand-tint font-medium text-brand" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
        >
          <FileText className="h-4 w-4 shrink-0 transition-transform duration-200 ease-bounce group-hover:scale-110 group-active:scale-90" />
          {!collapsed && <span className="truncate">{t("webapp.tickets.title")}</span>}
        </Link>

        <Link
          to="/todos"
          className={`group flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
            collapsed ? "justify-center" : ""
          } ${todosActive ? "bg-brand-tint font-medium text-brand" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
        >
          <ListChecks className="h-4 w-4 shrink-0 transition-transform duration-200 ease-bounce group-hover:scale-110 group-active:scale-90" />
          {!collapsed && <span className="truncate">{t("webapp.todos.title")}</span>}
        </Link>
      </nav>

      <div
        className={`mt-auto flex items-center gap-2 ${collapsed ? "flex-col p-2" : "p-3.5"}`}
      >
        <ConnectionDot connected={connected} showLabel={!collapsed} />
        <div className={collapsed ? undefined : "ml-auto"}>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
