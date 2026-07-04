import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { obsidianOpenUri } from "@/lib/obsidian";
import { confirmArchiveMessage, confirmDeleteMessage, t } from "@i18n/ja";

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

  if (entityQuery.isError) {
    if (entityQuery.error instanceof ApiError && entityQuery.error.status === 404) return <NotFoundScreen />;
    return <p className="text-destructive">{t("webapp.loadError")}</p>;
  }
  if (!entityQuery.data) return <p className="text-muted-foreground">{t("webapp.loading")}</p>;

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.path} className="cursor-pointer" onClick={() => navigate(`/tickets/${encodeURIComponent(ticket.path)}`)}>
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
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5}>
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
          </TableBody>
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
