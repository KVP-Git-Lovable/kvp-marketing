import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DATE_PRESETS, presetKeyFor } from "./dateRange";

/**
 * The module's one date-range control: a single dropdown, with the two date
 * pickers appearing only for "Custom range" so they don't take 300px of toolbar
 * the rest of the time. Empty bounds mean all time.
 */
export function RangeSelect({
  from, to, onChange, showCustom, onShowCustomChange, width = "w-[150px]",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  showCustom: boolean;
  onShowCustomChange: (v: boolean) => void;
  width?: string;
}) {
  const activePreset = presetKeyFor(from, to);
  const value = showCustom || activePreset === "" ? "custom" : activePreset;

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "custom") { onShowCustomChange(true); return; }
          onShowCustomChange(false);
          if (v === "all") { onChange("", ""); return; }
          const p = DATE_PRESETS.find((x) => x.key === v);
          if (p) { const [f, t] = p.range(); onChange(f, t); }
        }}
      >
        <SelectTrigger className={`h-9 ${width} text-[13px] bg-white`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          {DATE_PRESETS.map((p) => (<SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>))}
          <SelectItem value="custom">Custom range…</SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="From date"
            value={from}
            max={to || undefined}
            onChange={(e) => onChange(e.target.value, to)}
            className="h-9 w-[142px] text-[13px] bg-white"
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={to}
            min={from || undefined}
            onChange={(e) => onChange(from, e.target.value)}
            className="h-9 w-[142px] text-[13px] bg-white"
          />
        </div>
      )}
    </>
  );
}
