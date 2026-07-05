import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TICKET_STATUSES } from "@domain/entity";
import { today } from "@domain/date";
import { ApiError } from "@/api/client";
import { useEntity } from "@/hooks/useEntity";
import { useArchiveEntity, useChangeEntityStatus, useDeleteEntity, usePromoteTicket, useUpdateEntityField } from "@/hooks/useEntityMutations";
import { TitleEditable } from "@/components/EditableCell/TitleEditable";
import { StatusSelect } from "@/components/EditableCell/StatusSelect";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { DateEdit } from "@/components/EditableCell/DateEdit";
import { ParentSelect } from "@/components/EditableCell/ParentSelect";
import { PropertyLabel } from "@/components/PropertyLabel";
import { TodoListPanel } from "@/components/TodoListPanel";
import { NotePanel } from "@/components/NotePanel";
import { CommentPanel } from "@/components/CommentPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmArchiveMessage, confirmDeleteMessage, t } from "@i18n/ja";

// チケット詳細画面(design-refs/geist-final.dc.html §チケット詳細、requirements §3.2/§3.3)。
export function TicketDetail() {
  const { path: encodedPath } = useParams();
  const path = encodedPath ? decodeURIComponent(encodedPath) : "";
  const navigate = useNavigate();
  const now = today();

  const entityQuery = useEntity(path);

  const updateField = useUpdateEntityField(entityQuery.data);
  const changeStatus = useChangeEntityStatus(entityQuery.data);
  const archive = useArchiveEntity(entityQuery.data);
  const del = useDeleteEntity(entityQuery.data);
  const promote = usePromoteTicket(entityQuery.data);

  // Projectプロパティのアクセントリンク先タイトル解決用(design-refs/geist-final.dc.html §チケット詳細)。
  const parentQuery = useEntity(entityQuery.data?.project);

  const [confirmAction, setConfirmAction] = React.useState<"archive" | "delete" | "promote" | null>(null);

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
            <StatusSelect status={entity.status} options={TICKET_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.priority")}</PropertyLabel>
            <PrioritySelect priority={entity.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.due")}</PropertyLabel>
            <DateEdit value={entity.due} today={now} onCommit={(due) => updateField.mutate({ key: "due", value: due })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PropertyLabel>{t("preview.field.project")}</PropertyLabel>
            <div className="flex items-center gap-1">
              {entity.project ? (
                <Link
                  to={`/projects/${encodeURIComponent(entity.project)}`}
                  className="text-[13px] text-brand underline-offset-2 hover:underline"
                >
                  {parentQuery.data?.title ?? entity.project}
                </Link>
              ) : (
                <span className="text-[13px] text-faint">—</span>
              )}
              <ParentSelect
                type="project"
                value={entity.project}
                onCommit={(project) => updateField.mutate({ key: "project", value: project })}
                variant="icon"
              />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <Button size="sm" className="h-8" onClick={() => setConfirmAction("promote")}>
              {t("preview.action.promote")}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setConfirmAction("archive")}>
              {t("preview.action.archive")}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-destructive" onClick={() => setConfirmAction("delete")}>
              {t("preview.action.delete")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="flex-1">
          <TodoListPanel parent={path} scope="direct" today={now} />
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
