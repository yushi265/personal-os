import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t } from "@i18n/ja";

// パンくず(design-browser-ui.md §6.2)。P3時点ではルート単位の簡易対応。詳細画面のGoal/Project名を挟んだ
// 動的パンくずはP4(実データを持つ画面)で拡張する。
function useBreadcrumbItems(): { label: string; to?: string }[] {
  const location = useLocation();
  const params = useParams();

  if (location.pathname === "/") return [{ label: t("webapp.home.title") }];
  if (location.pathname === "/projects") return [{ label: t("webapp.projects.title") }];
  if (location.pathname.startsWith("/projects/")) {
    return [
      { label: t("webapp.projects.title"), to: "/projects" },
      { label: params.path ? decodeURIComponent(params.path) : "" },
    ];
  }
  if (location.pathname.startsWith("/tickets/")) {
    return [
      { label: t("webapp.projects.title"), to: "/projects" },
      { label: params.path ? decodeURIComponent(params.path) : "" },
    ];
  }
  return [];
}

export function Layout() {
  const items = useBreadcrumbItems();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
          <ThemeToggle />
        </div>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
