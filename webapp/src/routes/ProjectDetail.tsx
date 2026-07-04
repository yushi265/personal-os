import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PROJECT_STATUSES } from "@domain/entity";
import { today } from "@domain/date";
import { ApiError } from "@/api/client";
import { useEntity, useChildren } from "@/hooks/useEntity";
import { useMeta } from "@/hooks/useMeta";
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
import { ParentSelect } from "@/components/EditableCell/ParentSelect";
import { ProgressBar } from "@/components/ProgressBar";
import { DueLabel } from "@/components/DueLabel";
import { TodoListPanel } from "@/components/TodoListPanel";
import { MemoPanel } from "@/components/MemoPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { obsidianOpenUri } from "@/lib/obsidian";
import { listTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { confirmArchiveMessage, confirmDeleteMessage, t } from "@i18n/ja";

const MotionTableRow = motion.create(TableRow);

// プロジェクト詳細画面(design-browser-ui.md §9 P4行、requirements §3.2/§3.3)。
export function ProjectDetail() {
  const { path: encodedPath } = useParams();
  const path = encodedPath ? decodeURIComponent(encodedPath) : "";
  const navigate = useNavigate();
  const now = today();

  const entityQuery = useEntity(path);
  const childrenQuery = useChildren(path);
  const { data: meta } = useMeta();

  const updateField = useUpdateEntityField(entityQuery.data);
  const changeStatus = useChangeEntityStatus(entityQuery.data);
  const archive = useArchiveEntity(entityQuery.data);
  const del = useDeleteEntity(entityQuery.data);
  const createTicket = useCreateEntity();

  const [todoScope, setTodoScope] = React.useState<"direct" | "all">("direct");
  const [confirmAction, setConfirmAction] = React.useState<"archive" | "delete" | null>(null);
  const [newTicketTitle, setNewTicketTitle] = React.useState("");
  const reduced = useReducedMotion();

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
  const tickets = (childrenQuery.data ?? []).filter((c) => c.type === "ticket");

  const submitNewTicket = () => {
    if (!newTicketTitle.trim()) return;
    createTicket.mutate(
      { type: "ticket", title: newTicketTitle.trim(), project: path },
      { onSuccess: () => setNewTicketTitle(""), onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <TitleEditable
            value={entity.title}
            as="h1"
            className="text-2xl font-semibold"
            onCommit={(title) => updateField.mutate({ key: "title", value: title })}
          />
          {meta && (
            <Button variant="outline" size="sm" asChild>
              <a href={obsidianOpenUri(meta.vaultName, entity.path)}>{t("webapp.detail.openInObsidian")}</a>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <StatusSelect status={entity.status} options={PROJECT_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
          <PrioritySelect priority={entity.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("preview.field.due")}</span>
            <DateEdit value={entity.due} today={now} onCommit={(due) => updateField.mutate({ key: "due", value: due })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("preview.field.goal")}</span>
            <ParentSelect type="goal" value={entity.goal} onCommit={(goal) => updateField.mutate({ key: "goal", value: goal })} />
          </div>
          <ProgressBar value={entity.progress} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("archive")}>
            {t("preview.action.archive")}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmAction("delete")}>
            {t("preview.action.delete")}
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("webapp.detail.tickets")}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-6" />
            </TableRow>
          </TableHeader>
          <motion.tbody variants={staggerContainer} initial="initial" animate="animate">
            {tickets.map((ticket) => (
              <MotionTableRow
                key={ticket.path}
                variants={staggerItem}
                transition={listTransition(!!reduced)}
                className="group cursor-pointer"
                onClick={() => navigate(`/tickets/${encodeURIComponent(ticket.path)}`)}
              >
                <TableCell className="font-medium">{ticket.title}</TableCell>
                <TableCell>
                  <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">{ticket.status}</span>
                </TableCell>
                <TableCell>{ticket.priority ?? "—"}</TableCell>
                <TableCell>
                  <ProgressBar value={ticket.progress} />
                </TableCell>
                <TableCell>
                  <DueLabel due={ticket.due} today={now} />
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                </TableCell>
              </MotionTableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6}>
                <Input
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewTicket();
                  }}
                  placeholder={t("webapp.detail.addTicketPlaceholder")}
                  className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
                />
              </TableCell>
            </TableRow>
          </motion.tbody>
        </Table>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("manage.projectDetail.todoScope")}</span>
          <Button variant={todoScope === "direct" ? "secondary" : "ghost"} size="sm" onClick={() => setTodoScope("direct")}>
            {t("manage.projectDetail.scopeDirect")}
          </Button>
          <Button variant={todoScope === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setTodoScope("all")}>
            {t("manage.projectDetail.scopeAll")}
          </Button>
        </div>
        <TodoListPanel parent={path} scope={todoScope} today={now} />
      </section>

      <section>
        <MemoPanel path={path} />
      </section>

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
