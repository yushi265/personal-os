import * as React from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { ConnectionDot } from "@/components/ConnectionDot";
import { CommandPalette } from "@/components/CommandPalette";
import { PageTransition } from "@/components/PageTransition";
import { useEntity } from "@/hooks/useEntity";
import { useSseSync } from "@/hooks/useSseSync";
import { t } from "@i18n/ja";

// パンくず(design-browser-ui.md §6.2)。詳細画面は 一覧 > Goal名(project) / Project名(ticket) > 自身の名前 とする(P4)。
function useBreadcrumbItems(): { label: string; to?: string }[] {
  const location = useLocation();
  const params = useParams();
  const path = params.path ? decodeURIComponent(params.path) : undefined;
  const isProject = location.pathname.startsWith("/projects/");
  const isTicket = location.pathname.startsWith("/tickets/");

  const { data: entity } = useEntity(isProject || isTicket ? path : undefined);
  const { data: parent } = useEntity(entity?.goal ?? entity?.project);

  if (location.pathname === "/") return [{ label: t("webapp.home.title") }];
  if (location.pathname === "/projects") return [{ label: t("webapp.projects.title") }];
  if (isProject) {
    return [
      { label: t("webapp.projects.title"), to: "/projects" },
      ...(parent ? [{ label: parent.title }] : []),
      { label: entity?.title ?? path ?? "" },
    ];
  }
  if (isTicket) {
    return [
      { label: t("webapp.projects.title"), to: "/projects" },
      ...(parent ? [{ label: parent.title, to: `/projects/${encodeURIComponent(parent.path)}` }] : []),
      { label: entity?.title ?? path ?? "" },
    ];
  }
  return [];
}

export function Layout() {
  const items = useBreadcrumbItems();
  const { connected } = useSseSync();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!connected && <ConnectionBanner />}
      <header
        className={`sticky top-0 z-10 border-b bg-background/70 backdrop-blur-md transition-shadow duration-200 supports-[backdrop-filter]:bg-background/60 ${
          scrolled ? "shadow-sm" : "shadow-none"
        }`}
      >
        <div className="container flex h-14 items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {item.to ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.to}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-3">
            <ConnectionDot connected={connected} />
            <kbd className="hidden select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container py-6">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <CommandPalette />
    </div>
  );
}
