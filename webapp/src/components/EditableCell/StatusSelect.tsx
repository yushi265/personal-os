import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";

interface StatusSelectProps {
  status: string;
  options: readonly string[];
  onCommit: (next: string) => void;
}

// 表示モードはP3のStatusBadgeを流用(design §6.4)。トリガー自体をBadge化しクリックでSelect展開する。
export function StatusSelect({ status, options, onCommit }: StatusSelectProps) {
  return (
    <Select value={status} onValueChange={onCommit}>
      <SelectTrigger
        className="h-auto w-auto gap-1 border-none bg-transparent px-0 py-0 shadow-none hover:bg-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <StatusBadge status={status} />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
