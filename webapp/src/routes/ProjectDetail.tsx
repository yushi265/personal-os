import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PROJECT_STATUSES, TICKET_STATUSES, type Entity } from "@domain/entity";
import { today } from "@domain/date";
import { ApiError } from "@/api/client";
import { useEntity, useChildren } from "@/hooks/useEntity";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useArchiveEntity,
  useChangeEntityStatus,
  useCreateEntity,
  useDeleteEntity,
  useUpdateEntityField,
} from "@/hooks/useEntityMutations";
import { TitleEditable } from "@/components/EditableCell/TitleEditable";
import { StatusSelect } from "@/components/EditableCell/StatusSelect";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { DateEdit } from "@/components/EditableCell/DateEdit";
import { PropertyLabel } from "@/components/PropertyLabel";
import { TagChipsEdit } from "@/components/TagChipsEdit";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ProgressBar } from "@/components/ProgressBar";
import { DueLabel } from "@/components/DueLabel";
import { TodoListPanel } from "@/components/TodoListPanel";
import { NotePanel } from "@/components/NotePanel";
import { CommentPanel } from "@/components/CommentPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableColumnHeader, type SortableColumn } from "@/components/SortableColumnHeader";
import { listTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { DEFAULT_SORT_STATE, nextSortState, sortEntities, type SortState } from "@/lib/sortEntities";
import { confirmArchiveMessage, confirmDeleteMessage, t } from "@i18n/ja";

const MotionRow = motion.create("div");

// TicketRowの行セル幅と揃える(SortableColumnHeaderの列位置合わせ)
const TICKET_COLUMNS: SortableColumn[] = [
  { key: "title", label: t("modal.createEntity.titleField"), className: "min-w-0 flex-1 text-left" },
  { key: "status", label: t("preview.field.status"), className: "w-[110px] shrink-0 text-left" },
  { key: "priority", label: t("preview.field.priority"), className: "w-[90px] shrink-0 text-left" },
  { key: "progress", label: t("preview.field.progress"), className: "w-[200px] shrink-0 text-left" },
  { key: "due", label: t("preview.field.due"), className: "w-20 shrink-0 text-left" },
];

// チケットテーブル行(Projects.tsxのProjectRowと同様、行ごとのmutationフック呼び出しのため専用コンポーネントに分離)。
function TicketRow({
  ticket,
  today: now,
  reduced,
  onNavigate,
}: {
  ticket: Entity;
  today: string;
  reduced: boolean;
  onNavigate: () => void;
}) {
  const changeStatus = useChangeEntityStatus(ticket);
  const updateField = useUpdateEntityField(ticket);

  return (
    <MotionRow
      variants={staggerItem}
      transition={listTransition(reduced)}
      // 押し込みの触感(Projects.tsxのProjectRowと同じ)。motionがtransformを持つためwhileTapで行う
      whileTap={reduced ? undefined : { scale: 0.995 }}
      className="group flex h-12 cursor-pointer items-center gap-6 border-b border-hairline px-5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={onNavigate}
      role="link"
      tabIndex={0}
      aria-label={ticket.title}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return; // 行内のセル編集UI(Select等)のキー操作を奪わない
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate();
        }
      }}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{ticket.title}</span>
      <span className="w-[110px] shrink-0">
        <StatusSelect status={ticket.status} options={TICKET_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
      </span>
      <span className="w-[90px] shrink-0">
        <PrioritySelect priority={ticket.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
      </span>
      <span className="flex w-[200px] shrink-0 items-center gap-2">
        <ProgressBar value={ticket.progress} />
      </span>
      <span className="w-20 shrink-0 font-mono text-xs">
        <DueLabel due={ticket.due} today={now} />
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ghost transition-transform duration-150 group-hover:translate-x-0.5" />
    </MotionRow>
  );
}

// プロジェクト詳細画面(design-refs/geist-final.dc.html §プロジェクト詳細、requirements §3.2/§3.3)。
export function ProjectDetail() {
  const { path: encodedPath } = useParams();
  const path = encodedPath ? decodeURIComponent(encodedPath) : "";
  const navigate = useNavigate();
  const now = today();

  const entityQuery = useEntity(path);
  const childrenQuery = useChildren(path);

  const updateField = useUpdateEntityField(entityQuery.data);
  const changeStatus = useChangeEntityStatus(entityQuery.data);
  const archive = useArchiveEntity(entityQuery.data);
  const del = useDeleteEntity(entityQuery.data);
  const createTicket = useCreateEntity();

  const [todoScope, setTodoScope] = React.useState<"direct" | "all">("direct");
  const [confirmAction, setConfirmAction] = React.useState<"archive" | "delete" | null>(null);
  const [newTicketTitle, setNewTicketTitle] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT_STATE);
  const reduced = useReducedMotion();
  usePageTitle(entityQuery.data?.title);

  if (entityQuery.isError) {
    if (entityQuery.error instanceof ApiError && entityQuery.error.status === 404) return <NotFoundScreen />;
    return <p className="text-destructive">{t("webapp.loadError")}</p>;
  }
  if (!entityQuery.data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const entity = entityQuery.data;
  const tickets = sortEntities(
    (childrenQuery.data ?? []).filter((c) => c.type === "ticket"),
    sort
  );
  const progress = entity.progress ?? 0;

  const submitNewTicket = () => {
    if (!newTicketTitle.trim()) return;
    createTicket.mutate(
      { type: "ticket", title: newTicketTitle.trim(), project: path },
      { onSuccess: () => setNewTicketTitle(""), onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) }
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-5 border-b border-border pb-7">
        <TitleEditable
          value={entity.title}
          as="h1"
          className="text-[28px] font-semibold tracking-[-0.03em]"
          onCommit={(title) => updateField.mutate({ key: "title", value: title })}
        />
        <div className="flex flex-wrap items-end gap-12">
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.status")}</PropertyLabel>
            <StatusSelect status={entity.status} options={PROJECT_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.priority")}</PropertyLabel>
            <PrioritySelect priority={entity.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.due")}</PropertyLabel>
            <DateEdit value={entity.due} today={now} onCommit={(due) => updateField.mutate({ key: "due", value: due })} />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <PropertyLabel>
              {t("preview.field.progress")} — {progress}%
            </PropertyLabel>
            <ProgressBar value={entity.progress} showPercent={false} className="max-w-[260px]" />
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setConfirmAction("archive")}>
              {t("preview.action.archive")}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-destructive" onClick={() => setConfirmAction("delete")}>
              {t("preview.action.delete")}
            </Button>
          </div>
        </div>
        {/* labelsはチップ数で幅が伸縮するため、gap-12のフィールド行に入れず専用行で折り返す */}
        <div className="flex flex-col gap-1.5">
          <PropertyLabel>{t("preview.section.labels")}</PropertyLabel>
          <TagChipsEdit
            values={entity.labels}
            onCommit={(next) => updateField.mutate({ key: "labels", value: next })}
          />
        </div>
      </div>

      <section className="space-y-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">
          {t("webapp.detail.tickets")} — {tickets.length}
        </span>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <SortableColumnHeader
            columns={TICKET_COLUMNS}
            sort={sort}
            onSort={(key) => setSort((prev) => nextSortState(prev, key))}
          />
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.path}
                ticket={ticket}
                today={now}
                reduced={!!reduced}
                onNavigate={() => navigate(`/tickets/${encodeURIComponent(ticket.path)}`)}
              />
            ))}
            <div className="flex h-10 cursor-text items-center px-5">
              <Input
                value={newTicketTitle}
                onChange={(e) => setNewTicketTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewTicket();
                }}
                placeholder={t("webapp.detail.addTicketPlaceholder")}
                aria-label={t("webapp.detail.addTicketPlaceholder")}
                className="h-full border-none bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="flex-1">
          <TodoListPanel
            parent={path}
            scope={todoScope}
            today={now}
            scopeControl={
              <SegmentedControl
                value={todoScope}
                onChange={setTodoScope}
                options={[
                  { value: "direct", label: t("manage.projectDetail.scopeDirect") },
                  { value: "all", label: t("manage.projectDetail.scopeAll") },
                ]}
              />
            }
          />
        </section>

        <section className="flex-1 space-y-6">
          <NotePanel path={path} />
          <CommentPanel path={path} />
        </section>
      </div>

      <ConfirmDialog
        open={confirmAction === "archive"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t("preview.action.archive")}
        description={confirmArchiveMessage(entity.title)}
        confirmLabel={t("preview.action.archive")}
        onConfirm={() => archive.mutate(undefined, { onSuccess: () => navigate("/projects") })}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t("preview.action.delete")}
        description={confirmDeleteMessage(entity.title)}
        confirmLabel={t("preview.action.delete")}
        destructive
        onConfirm={() => del.mutate(undefined, { onSuccess: () => navigate("/projects") })}
      />
    </div>
  );
}
