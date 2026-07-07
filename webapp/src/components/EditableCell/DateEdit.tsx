import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DueLabel } from "@/components/DueLabel";
import { t } from "@i18n/ja";

interface DateEditProps {
  value?: string;
  today: string;
  onCommit: (next: string | undefined) => void;
}

// Popover+input type=date、クリア可(design §9 P4行)。表示モードはP3のDueLabelを流用。
export function DateEdit({ value, today, onCommit }: DateEditProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");

  React.useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("preview.field.due")}
          className="rounded px-1 py-0.5 text-[13px] hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <DueLabel due={value} today={today} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={draft}
            aria-label={t("preview.field.due")}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onCommit(undefined);
              setOpen(false);
            }}
          >
            {t("webapp.dateEdit.clear")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onCommit(draft || undefined);
              setOpen(false);
            }}
          >
            {t("webapp.dateEdit.confirm")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
