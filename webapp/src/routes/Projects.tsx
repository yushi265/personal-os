import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, FolderKanban } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PROJECT_STATUSES, type Entity } from "@domain/entity";
import { today } from "@domain/date";
import { useEntities } from "@/hooks/useEntities";
import { useCreateEntity } from "@/hooks/useEntityMutations";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DueLabel } from "@/components/DueLabel";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { listTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { t } from "@i18n/ja";

const MotionTableRow = motion.create(TableRow);

function matchesFilter(project: Entity, keyword: string, statuses: Set<string>): boolean {
  if (statuses.size > 0 && !statuses.has(project.status)) return false;
  if (!keyword.trim()) return true;
  return project.title.toLowerCase().includes(keyword.trim().toLowerCase());
}

// プロジェクト一覧(design-browser-ui.md §6.2・§6.4)。Goal概念廃止(design-remove-goal.md G3)によりフラットなTable 1枚とする。
// フィルタは簡易(キーワード+statusチップ、design §9 P3行の指定通り)。
export function Projects() {
  const { data: projects, isLoading, isError } = useEntities("project");
  const navigate = useNavigate();
  const createProject = useCreateEntity();
  const [keyword, setKeyword] = React.useState("");
  const [statuses, setStatuses] = React.useState<Set<string>>(new Set());
  const [newProjectTitle, setNewProjectTitle] = React.useState("");
  const now = today();
  const reduced = useReducedMotion();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("webapp.projects.title")}</h1>
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("webapp.projects.title")}</h1>
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

  const visibleProjects = (projects ?? []).filter((p) => matchesFilter(p, keyword, statuses));

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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("webapp.projects.title")}</h1>

      <div className="flex items-center gap-2">
        <input
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
          placeholder={t("webapp.projects.filterKeyword")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {t("webapp.projects.filterStatus")}
              {statuses.size > 0 ? ` (${statuses.size})` : ""}
            </Button>
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
      </div>

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
          {visibleProjects.map((project) => (
            <MotionTableRow
              key={project.path}
              variants={staggerItem}
              transition={listTransition(!!reduced)}
              className="group cursor-pointer"
              onClick={() => navigate(`/projects/${encodeURIComponent(project.path)}`)}
            >
              <TableCell className="font-medium">{project.title}</TableCell>
              <TableCell>
                <StatusBadge status={project.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={project.priority} />
              </TableCell>
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
    </div>
  );
}
