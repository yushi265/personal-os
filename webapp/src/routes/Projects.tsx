import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, FolderKanban, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PROJECT_STATUSES, type Entity } from "@domain/entity";
import { today } from "@domain/date";
import { useEntities } from "@/hooks/useEntities";
import { useChangeEntityStatus, useCreateEntity, useUpdateEntityField } from "@/hooks/useEntityMutations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSelect } from "@/components/EditableCell/StatusSelect";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { DueLabel } from "@/components/DueLabel";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { SortableColumnHeader, type SortableColumn } from "@/components/SortableColumnHeader";
import { listTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { DEFAULT_SORT_STATE, nextSortState, sortEntities, type SortState } from "@/lib/sortEntities";
import { collectLabelOptions, matchesFilter } from "@/lib/entityFilter";
import { t } from "@i18n/ja";

// ProjectRow/TicketRow(ProjectDetail.tsx)の行セル幅と揃える(SortableColumnHeaderの列位置合わせ)
const PROJECT_COLUMNS: SortableColumn[] = [
  { key: "title", label: t("modal.createEntity.titleField"), className: "w-[300px] shrink-0 text-left" },
  { key: "status", label: t("preview.field.status"), className: "w-24 shrink-0 text-left" },
  { key: "priority", label: t("preview.field.priority"), className: "w-20 shrink-0 text-left" },
  { key: "progress", label: t("preview.field.progress"), className: "w-40 shrink-0 text-left" },
  { key: "due", label: t("preview.field.due"), className: "w-24 shrink-0 text-left" },
];

const MotionRow = motion.create("div");

// 一覧行(design-browser-ui.md §9 P3行の拡張): status/priorityをインライン編集可能にするため、
// 行ごとにmutationフックを呼ぶ専用コンポーネントに分離する(Rules of Hooks: .map()コールバック内で
// 直接フックを呼べないため)。
function ProjectRow({
  project,
  today: now,
  reduced,
  onNavigate,
}: {
  project: Entity;
  today: string;
  reduced: boolean;
  onNavigate: () => void;
}) {
  const changeStatus = useChangeEntityStatus(project);
  const updateField = useUpdateEntityField(project);

  return (
    <MotionRow
      variants={staggerItem}
      transition={listTransition(reduced)}
      className="group flex h-[52px] cursor-pointer items-center gap-6 border-b border-hairline px-5 transition-colors hover:bg-surface"
      onClick={onNavigate}
    >
      <span className="w-[300px] shrink-0 truncate text-sm font-medium">{project.title}</span>
      <span className="w-24 shrink-0">
        <StatusSelect status={project.status} options={PROJECT_STATUSES} onCommit={(next) => changeStatus.mutate(next)} />
      </span>
      <span className="w-20 shrink-0">
        <PrioritySelect priority={project.priority} onCommit={(priority) => updateField.mutate({ key: "priority", value: priority })} />
      </span>
      <span className="shrink-0">
        <ProgressBar value={project.progress} />
      </span>
      <span className="w-24 shrink-0 font-mono text-xs">
        <DueLabel due={project.due} today={now} />
      </span>
      <span className="flex w-40 shrink-0 gap-1 overflow-hidden">
        {project.labels.map((label) => (
          <Badge key={label} variant="secondary" className="whitespace-nowrap">
            {label}
          </Badge>
        ))}
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ghost transition-transform duration-150 group-hover:translate-x-0.5" />
    </MotionRow>
  );
}

// プロジェクト一覧(design-refs/geist-final.dc.html §一覧画面)。
// デザインはGoal別ヘッダ行を持つが、現行モデルはGoal概念廃止(design-remove-goal.md G3)によりフラットな
// 単一テーブルとする(このファイルの§一覧画面の適合ルール参照)。
// フィルタは簡易(キーワード+statusチップ、design-browser-ui.md §9 P3行の指定通り)。ロジックは既存のまま維持。
export function Projects() {
  const { data: projects, isLoading, isError } = useEntities("project");
  const navigate = useNavigate();
  const createProject = useCreateEntity();
  const [keyword, setKeyword] = React.useState("");
  const [statuses, setStatuses] = React.useState<Set<string>>(new Set());
  const [labels, setLabels] = React.useState<Set<string>>(new Set());
  const [newProjectTitle, setNewProjectTitle] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT_STATE);
  const now = today();
  const reduced = useReducedMotion();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.projects.title")}</h1>
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (isError) return <p className="text-destructive">{t("webapp.loadError")}</p>;
  if ((projects ?? []).length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.projects.title")}</h1>
        <EmptyState
          icon={FolderKanban}
          title={t("webapp.empty.projects.title")}
          body={t("webapp.empty.projects.body")}
        />
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

  const labelOptions = collectLabelOptions(projects ?? []);

  const visibleProjects = sortEntities(
    (projects ?? []).filter((p) => matchesFilter(p, keyword, statuses, labels)),
    sort
  );

  const submitNewProject = () => {
    const title = newProjectTitle.trim();
    if (!title) return;
    createProject.mutate(
      { type: "project", title },
      {
        onSuccess: () => setNewProjectTitle(""),
        onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.projects.title")}</h1>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-[280px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
            <input
              className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              placeholder={t("webapp.projects.filterKeyword")}
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
                <span className="text-[10px] text-faint">▼</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                {PROJECT_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={statuses.has(status)} onCheckedChange={() => toggleStatus(status)} />
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
                <span className="text-[10px] text-faint">▼</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              {labelOptions.length === 0 ? (
                <p className="text-sm text-faint">{t("webapp.projects.filterLabelsEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {labelOptions.map((label) => (
                    <label key={label} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={labels.has(label)} onCheckedChange={() => toggleLabel(label)} />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <SortableColumnHeader
          columns={PROJECT_COLUMNS}
          sort={sort}
          onSort={(key) => setSort((prev) => nextSortState(prev, key))}
          staticColumns={[{ label: t("manage.column.labels"), className: "w-40 shrink-0 text-left" }]}
        />
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          {visibleProjects.map((project) => (
            <ProjectRow
              key={project.path}
              project={project}
              today={now}
              reduced={!!reduced}
              onNavigate={() => navigate(`/projects/${encodeURIComponent(project.path)}`)}
            />
          ))}
          <div className="flex h-10 cursor-text items-center px-5">
            <input
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewProject();
              }}
              placeholder={t("webapp.detail.addProjectPlaceholder")}
              className="h-full w-full bg-transparent text-[13px] text-faint outline-none placeholder:text-faint"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
