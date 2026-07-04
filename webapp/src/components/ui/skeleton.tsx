import type * as React from "react";
import { cn } from "@/lib/utils";

// shadcn標準Skeleton + shimmer(design P6-C10)。真っ白/スピナーのみの読み込み状態を廃止するため各画面から使う。
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", "relative overflow-hidden", "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent", className)} {...props} />;
}

export { Skeleton };
