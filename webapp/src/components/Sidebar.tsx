import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Home as HomeIcon, LayoutGrid, Search } from "lucide-react";
import { ConnectionDot } from "@/components/ConnectionDot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t } from "@i18n/ja";

const STORAGE_KEY = "pos.sidebar.collapsed";
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

export function Sidebar({ connected }: { connected: boolean }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const location = useLocation();

  const navItems = [
    { to: "/", label: t("webapp.home.title"), icon: HomeIcon, active: location.pathname === "/" },
    {
      to: "/projects",
      label: t("webapp.projects.title"),
      icon: LayoutGrid,
      // プロジェクト詳細・チケット詳細もこのナビの延長線上にあるため、それらの画面滞在中も
      // 「プロジェクト一覧」をアクティブ表示にする。
      active: location.pathname.startsWith("/projects") || location.pathname.startsWith("/tickets"),
    },
  ];

  return (
    <aside
      className="flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? COLLAPSED_WIDTH : OPEN_WIDTH }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span
          className="h-5 w-5 shrink-0 bg-fg"
          style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
          aria-hidden="true"
        />
        {!collapsed && <span className="flex-1 truncate text-sm font-semibold">{t("webapp.projects.title")}</span>}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-hairline hover:text-fg"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("pos:open-command-palette"))}
            className="flex h-8 w-full items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-left text-muted-foreground transition-colors hover:text-fg"
          >
            <Search className="h-3 w-3 shrink-0 text-faint" />
            <span className="flex-1 truncate text-xs text-faint">{t("webapp.commandPalette.placeholder")}</span>
            <kbd className="shrink-0 rounded border border-border px-1 font-mono text-[10px] text-faint">⌘K</kbd>
          </button>
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
                collapsed ? "justify-center" : ""
              } ${item.active ? "bg-hairline font-medium text-fg" : "text-muted-foreground hover:bg-hairline hover:text-fg"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
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
