import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEntities } from "@/hooks/useEntities";
import { useCreateEntity } from "@/hooks/useEntityMutations";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entityCreatedNotice, t } from "@i18n/ja";

const NONE = "__none__";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * プロジェクト非依存のチケット作成ダイアログ(bug #6)。
 * プロジェクトが0件でもチケットを作成できるよう、「プロジェクトなし」を既定かつ常設の選択肢として持つ。
 * 送信は useCreateEntity() 経由(サーバーは project 省略時に project 未リンクのチケットを作成する)。
 * 成功時は作成された {path} からチケット詳細へ遷移する。複数の呼び出し口から駆動できる制御コンポーネント。
 */
export function CreateTicketDialog({ open, onOpenChange }: CreateTicketDialogProps) {
  const { data: projects } = useEntities("project");
  const createEntity = useCreateEntity();
  const navigate = useNavigate();
  const [title, setTitle] = React.useState("");
  const [projectPath, setProjectPath] = React.useState<string | undefined>(undefined);

  // 開閉のたびにフィールドを初期化する(既定は「プロジェクトなし」)
  React.useEffect(() => {
    if (open) {
      setTitle("");
      setProjectPath(undefined);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const created = (await createEntity.mutateAsync({
        type: "ticket",
        title: trimmed,
        project: projectPath || undefined,
      })) as { path: string };
      toast.success(entityCreatedNotice(trimmed));
      onOpenChange(false);
      navigate(`/tickets/${encodeURIComponent(created.path)}`);
    } catch {
      // エラートーストは useOptimisticMutation 側で表示済み
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 説明文を持たないダイアログのため、Radixのaria-describedby警告を明示的に無効化する */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("webapp.createTicket.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="create-ticket-title" className="text-sm text-muted-foreground">
              {t("modal.createEntity.titleField")}
            </label>
            <Input
              id="create-ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modal.createEntity.titleFieldPlaceholder")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("webapp.createTicket.project")}</label>
            <Select value={projectPath ?? NONE} onValueChange={(v) => setProjectPath(v === NONE ? undefined : v)}>
              <SelectTrigger aria-label={t("webapp.createTicket.project")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("webapp.createTicket.noProject")}</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.path} value={p.path}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!title.trim() || createEntity.isPending}>
            {t("modal.createEntity.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
