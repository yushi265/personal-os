import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { TICKET_STATUSES } from "@domain/entity";
import { today } from "@domain/date";
import { useEntities } from "@/hooks/useEntities";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DueLabel } from "@/components/DueLabel";
import { EmptyState } from "@/components/EmptyState";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { Button } from "@/components/ui/button";
import { staggerContainer, waveItem, waveTransition } from "@/lib/motion";
import { collectLabelOptions, matchesFilter } from "@/lib/entityFilter";
import { entityDetailPath } from "@/lib/links";
import { t } from "@i18n/ja";

// プロジェクト横断のチケット一覧(タスク#7)。データ源は useEntities("ticket") で全プロジェクトのチケットを取得。
// フィルタバーは Projects.tsx と同じ構成(キーワード + status + labels + 完了済み表示)。
// 行は読み取り専用の StatusBadge/PriorityBadge/DueLabel で表示し、クリックでチケット詳細へ遷移する。
export function Tickets() {
  const { data: tickets, isLoading, isError } = useEntities("ticket");
  const [keyword, setKeyword] = React.useState("");
  const [statuses, setStatuses] = React.useState<Set<string>>(new Set());
  const [labels, setLabels] = React.useState<Set<string>>(new Set());
  const [showDone, setShowDone] = React.useState(false);
  const [createTicketOpen, setCreateTicketOpen] = React.useState(false);
  const now = today();
  const reduced = useReducedMotion();
  usePageTitle(t("webapp.tickets.title"));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.tickets.title")}</h1>
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (isError) return <p className="text-destructive">{t("webapp.loadError")}</p>;
  if ((tickets ?? []).length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.tickets.title")}</h1>
          <Button onClick={() => setCreateTicketOpen(true)}>{t("webapp.createTicket.action")}</Button>
        </div>
        <EmptyState icon={FileText} title={t("webapp.empty.tickets.title")} body={t("webapp.empty.tickets.body")} />
        <CreateTicketDialog open={createTicketOpen} onOpenChange={setCreateTicketOpen} />
      </div>
    );
  }

  const toggleStatus = (status: string) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleLabel = (label: string) => {
    setLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const labelOptions = collectLabelOptions(tickets ?? []);
  const visibleTickets = (tickets ?? []).filter((ticket) => matchesFilter(ticket, keyword, statuses, labels, !showDone));

  return (
    <div className="flex flex-col gap-6">
      <CreateTicketDialog open={createTicketOpen} onOpenChange={setCreateTicketOpen} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.tickets.title")}</h1>
          <Button onClick={() => setCreateTicketOpen(true)}>{t("webapp.createTicket.action")}</Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-[280px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
            <input
              className="h-full w-full rounded bg-transparent text-[13px] outline-none placeholder:text-faint focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t("webapp.projects.filterKeyword")}
              aria-label={t("webapp.projects.filterKeyword")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] text-fg transition-colors hover:bg-hairline"
              >
                {t("webapp.projects.filterStatus")}
                {statuses.size > 0 ? ` (${statuses.size})` : ""}
                <span className="text-[10px] text-faint" aria-hidden="true">
                  ▼
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                {TICKET_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <Checkbox aria-label={status} checked={statuses.has(status)} onCheckedChange={() => toggleStatus(status)} />
                    {status}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] text-fg transition-colors hover:bg-hairline"
              >
                {t("webapp.projects.filterLabels")}
                {labels.size > 0 ? ` (${labels.size})` : ""}
                <span className="text-[10px] text-faint" aria-hidden="true">
                  ▼
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              {labelOptions.length === 0 ? (
                <p className="text-sm text-faint">{t("webapp.projects.filterLabelsEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {labelOptions.map((label) => (
                    <label key={label} className="flex items-center gap-2 text-sm">
                      <Checkbox aria-label={label} checked={labels.has(label)} onCheckedChange={() => toggleLabel(label)} />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Checkbox aria-label={t("manage.filter.showDone")} checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
            {t("manage.filter.showDone")}
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          {visibleTickets.map((ticket, i) => (
            <motion.div key={ticket.path} variants={waveItem} transition={waveTransition(!!reduced, i, 0.02)}>
              <Link
                to={entityDetailPath(ticket) ?? "#"}
                className="group flex h-[52px] items-center gap-6 border-b border-hairline px-5 transition-colors last:border-b-0 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="w-[300px] shrink-0 truncate text-sm font-medium">{ticket.title}</span>
                <span className="w-24 shrink-0">
                  <StatusBadge status={ticket.status} />
                </span>
                <span className="w-20 shrink-0">
                  <PriorityBadge priority={ticket.priority} />
                </span>
                <span className="w-24 shrink-0 font-mono text-xs">
                  <DueLabel due={ticket.due} today={now} />
                </span>
                <span className="flex w-40 shrink-0 gap-1 overflow-hidden">
                  {ticket.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="whitespace-nowrap">
                      {label}
                    </Badge>
                  ))}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto h-4 w-4 shrink-0 text-ghost transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
