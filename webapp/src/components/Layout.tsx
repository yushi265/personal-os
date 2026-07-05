import * as React from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { CommandPalette } from "@/components/CommandPalette";
import { PageTransition } from "@/components/PageTransition";
import { useEntity } from "@/hooks/useEntity";
import { useMeta } from "@/hooks/useMeta";
import { useSseSync } from "@/hooks/useSseSync";
import { obsidianOpenUri } from "@/lib/obsidian";
import { t } from "@i18n/ja";

interface BreadcrumbInfo {
  items: { label: string; to?: string }[];
  /** 詳細ルート(project/ticket)表示中のみ設定される、Obsidianで開く対象のエンティティ */
  detailEntity?: { path: string };
}

// パンくず(design-browser-ui.md §6.2)。詳細画面は 一覧 > Project名(ticket) > 自身の名前 とする(P4)。
// Goal概念の廃止(design-remove-goal.md G3)によりprojectは一覧直下のフラット階層となり、中間の親breadcrumbは持たない。
function useBreadcrumbInfo(): BreadcrumbInfo {
  const location = useLocation();
  const params = useParams();
  const path = params.path ? decodeURIComponent(params.path) : undefined;
  const isProject = location.pathname.startsWith("/projects/");
  const isTicket = location.pathname.startsWith("/tickets/");

  const { data: entity } = useEntity(isProject || isTicket ? path : undefined);
  const { data: parent } = useEntity(isTicket ? entity?.project : undefined);

  if (location.pathname === "/") return { items: [{ label: t("webapp.home.title") }] };
  if (location.pathname === "/projects") return { items: [{ label: t("webapp.projects.title") }] };
  if (isProject) {
    return {
      items: [
        { label: t("webapp.projects.title"), to: "/projects" },
        { label: entity?.title ?? path ?? "" },
      ],
      detailEntity: entity ? { path: entity.path } : undefined,
    };
  }
  if (isTicket) {
    return {
      items: [
        { label: t("webapp.projects.title"), to: "/projects" },
        ...(parent ? [{ label: parent.title, to: `/projects/${encodeURIComponent(parent.path)}` }] : []),
        { label: entity?.title ?? path ?? "" },
      ],
      detailEntity: entity ? { path: entity.path } : undefined,
    };
  }
  return { items: [] };
}

export function Layout() {
  const { items, detailEntity } = useBreadcrumbInfo();
  const { connected } = useSseSync();
  const { data: meta } = useMeta();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar connected={connected} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {!connected && <ConnectionBanner />}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-8">
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
            {items.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="text-[18px] font-light text-border" aria-hidden="true">
                    /
                  </span>
                )}
                {item.to ? (
                  <Link to={item.to} className="truncate text-muted-foreground transition-colors hover:text-fg">
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-fg">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {detailEntity && meta?.vaultName && (
              <a
                href={obsidianOpenUri(meta.vaultName, detailEntity.path)}
                className="flex h-8 items-center rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:bg-surface hover:text-fg"
              >
                {t("webapp.detail.openInObsidian")} ↗
              </a>
            )}
            <kbd className="hidden select-none items-center rounded-md border border-border px-[7px] py-0.5 font-mono text-[10px] text-faint sm:inline-flex">
              ⌘K
            </kbd>
          </div>
        </header>
        <main className="flex-1 px-10 pb-16 pt-10">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
