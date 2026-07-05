import { cn } from "@/lib/utils";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
}

// direct/allなどの二択セグメント(design-refs/geist-final.dc.html §プロジェクト詳細Todo列:
// border radius6 mono11px、選択中=bg:fg文字:bg)。
export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex h-6 items-center overflow-hidden rounded-md border border-border font-mono text-[11px]">
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-full px-2.5 transition-colors",
            i > 0 && "border-l border-border",
            value === option.value ? "bg-fg text-bg" : "text-muted-foreground hover:bg-hairline"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
