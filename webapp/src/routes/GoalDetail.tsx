import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { GOAL_STATUSES } from "@domain/entity";
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
import { ProgressBar } from "@/components/ProgressBar";
import { DueLabel } from "@/components/DueLabel";
import { NotePanel } from "@/components/NotePanel";
import { CommentPanel } from "@/components/CommentPanel";
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

// Goal詳細画面(ProjectDetail.tsxの構成を踏襲、design: Goalの編集・削除導線がノートを開く以外に無かった穴を埋める)。
export function GoalDetail() {
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
  const createProject = useCreateEntity();

  const [confirmAction, setConfirmAction] = React.useState<"archive" | "delete" | null>(null);
  const [newProjectTitle, setNewProjectTitle] = React.useState("");
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
  const projects = (childrenQuery.data ?? []).filter((c) => c.type === "project");
  const groupProgress =
    projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.progress ?? 0), 0) / projects.length) : null;

  const submitNewProject = () => {
    if (!newProjectTitle.trim()) return;
    createProject.mutate(
      { type: "project", title: newProjectTitle.trim(), goal: path },
      { onSuccess: () => setNewProjectTitle(""), onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) }
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
          <StatusSelect status={entity.status} options={GOAL_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
          <PrioritySelect priority={entity.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
          {groupProgress !== null && <ProgressBar value={groupProgress} />}
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
        <h2 className="text-sm font-medium text-muted-foreground">{t("webapp.detail.projects")}</h2>
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
            {projects.map((project) => (
              <MotionTableRow
                key={project.path}
                variants={staggerItem}
                transition={listTransition(!!reduced)}
                className="group cursor-pointer"
                onClick={() => navigate(`/projects/${encodeURIComponent(project.path)}`)}
              >
                <TableCell className="font-medium">{project.title}</TableCell>
                <TableCell>
                  <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">{project.status}</span>
                </TableCell>
                <TableCell>{project.priority ?? "—"}</TableCell>
                <TableCell>
                  <ProgressBar value={project.progress} />
                </TableCell>
                <TableCell>
                  <DueLabel due={project.due} today={now} />
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                </TableCell>
              </MotionTableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6}>
                <Input
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewProject();
                  }}
                  placeholder={t("webapp.detail.addProjectPlaceholder")}
                  className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
                />
              </TableCell>
            </TableRow>
          </motion.tbody>
        </Table>
      </section>

      <section>
        <NotePanel path={path} />
      </section>

      <section>
        <CommentPanel path={path} />
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
