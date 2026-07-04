import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TICKET_STATUSES } from "@domain/entity";
import { today } from "@domain/date";
import { ApiError } from "@/api/client";
import { useEntity } from "@/hooks/useEntity";
import { useMeta } from "@/hooks/useMeta";
import { useArchiveEntity, useChangeEntityStatus, useDeleteEntity, usePromoteTicket, useUpdateEntityField } from "@/hooks/useEntityMutations";
import { TitleEditable } from "@/components/EditableCell/TitleEditable";
import { StatusSelect } from "@/components/EditableCell/StatusSelect";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { DateEdit } from "@/components/EditableCell/DateEdit";
import { ParentSelect } from "@/components/EditableCell/ParentSelect";
import { BlockerListEdit } from "@/components/BlockerListEdit";
import { TodoListPanel } from "@/components/TodoListPanel";
import { MemoPanel } from "@/components/MemoPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { Button } from "@/components/ui/button";
import { obsidianOpenUri } from "@/lib/obsidian";
import { confirmArchiveMessage, confirmDeleteMessage, t } from "@i18n/ja";

// チケット詳細画面(design-browser-ui.md §9 P4行、requirements §3.2/§3.3)。
export function TicketDetail() {
  const { path: encodedPath } = useParams();
  const path = encodedPath ? decodeURIComponent(encodedPath) : "";
  const navigate = useNavigate();
  const now = today();

  const entityQuery = useEntity(path);
  const { data: meta } = useMeta();

  const updateField = useUpdateEntityField(entityQuery.data);
  const changeStatus = useChangeEntityStatus(entityQuery.data);
  const archive = useArchiveEntity(entityQuery.data);
  const del = useDeleteEntity(entityQuery.data);
  const promote = usePromoteTicket(entityQuery.data);

  const [confirmAction, setConfirmAction] = React.useState<"archive" | "delete" | "promote" | null>(null);

  if (entityQuery.isError) {
    if (entityQuery.error instanceof ApiError && entityQuery.error.status === 404) return <NotFoundScreen />;
    return <p className="text-destructive">{t("webapp.loadError")}</p>;
  }
  if (!entityQuery.data) return <p className="text-muted-foreground">{t("webapp.loading")}</p>;

  const entity = entityQuery.data;

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
          <StatusSelect status={entity.status} options={TICKET_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
          <PrioritySelect priority={entity.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("preview.field.due")}</span>
            <DateEdit value={entity.due} today={now} onCommit={(due) => updateField.mutate({ key: "due", value: due })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("preview.field.project")}</span>
            <ParentSelect type="project" value={entity.project} onCommit={(project) => updateField.mutate({ key: "project", value: project })} />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">{t("preview.section.blockers")}</span>
          <BlockerListEdit values={entity.blockers} onCommit={(next) => updateField.mutate({ key: "blockers", value: next })} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("promote")}>
            {t("preview.action.promote")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("archive")}>
            {t("preview.action.archive")}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmAction("delete")}>
            {t("preview.action.delete")}
          </Button>
        </div>
      </div>

      <section>
        <TodoListPanel parent={path} scope="direct" today={now} />
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
      <ConfirmDialog
        open={confirmAction === "promote"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t("modal.promoteTicket.title")}
        description={`${t("modal.promoteTicket.confirmPrefix")}${entity.title}${t("modal.promoteTicket.confirmSuffix")}`}
        confirmLabel={t("modal.promoteTicket.submit")}
        onConfirm={() => promote.mutate(undefined, { onSuccess: () => setConfirmAction(null) })}
      />
    </div>
  );
}
