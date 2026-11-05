import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function RetailerInsightLine({ line, className }: { line?: string; className?: string }) {
  if (!line) return null;
  return (
    <div
      className={cn("flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-foreground", className)}
      title="AI Retailer Insight — from Retailer Overview & Payments"
    >
      <Sparkles size={13} className="mt-0.5 shrink-0 text-warning" />
      <span className="min-w-0 break-words text-[12px] leading-snug">{line}</span>
    </div>
  );
}