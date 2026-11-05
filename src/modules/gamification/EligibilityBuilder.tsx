import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, UserMinus, Users, X } from "lucide-react";
import {
  CRITERION_META, describeRules, EXCLUDE_TYPES, INCLUDE_TYPES,
  type Criterion, type CriterionType, type EligibilityRules,
} from "./eligibilityRules";

interface Props {
  value: EligibilityRules;
  onChange: (next: EligibilityRules) => void;
}

type Bucket = "include" | "exclude";

export function EligibilityBuilder({ value, onChange }: Props) {
  const { data: users = [] } = useQuery({
    queryKey: ["gam-elig-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, full_name").eq("is_active", true)
        .order("full_name").limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: territories = [] } = useQuery({
    queryKey: ["gam-elig-territories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("territories").select("id, name").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Roles are security profiles — the only grouping every user actually has. */
  const { data: roles = [] } = useQuery({
    queryKey: ["gam-elig-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_profiles").select("id, name").order("name").limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const optionsFor = (type: CriterionType) => {
    switch (CRITERION_META[type].picker) {
      case "users": return users.map((u: any) => ({ id: u.id, label: u.full_name }));
      case "territories": return territories.map((t: any) => ({ id: t.id, label: t.name }));
      case "roles": return roles.map((r: any) => ({ id: r.id, label: r.name }));
      default: return [];
    }
  };

  const nameOf = (type: CriterionType, id: string) =>
    optionsFor(type).find((o) => o.id === id)?.label ?? "…";

  const summary = useMemo(() => describeRules(value, nameOf), [value, users, territories, roles]);

  const list = (b: Bucket) => value[b] ?? [];
  const setList = (b: Bucket, next: Criterion[]) => {
    const merged = { ...value, [b]: next };
    if (!next.length) delete (merged as any)[b];
    onChange(merged);
  };
  const addRow = (b: Bucket) =>
    setList(b, [...list(b), { type: b === "include" ? "role" : "users", ids: [] }]);
  const setRow = (b: Bucket, i: number, patch: Partial<Criterion>) =>
    setList(b, list(b).map((c, n) => (n === i ? { ...c, ...patch } : c)));
  const removeRow = (b: Bucket, i: number) => setList(b, list(b).filter((_, n) => n !== i));

  const renderRow = (b: Bucket, c: Criterion, i: number) => {
    const meta = CRITERION_META[c.type];
    const opts = optionsFor(c.type);
    return (
      <div key={`${b}-${i}`} className="rounded-[10px] border p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <Select
            value={c.type}
            // switching the kind of thing invalidates the ids picked for the old one
            onValueChange={(v) => setRow(b, i, { type: v as CriterionType, ids: [] })}
          >
            <SelectTrigger className="h-8 w-[150px] text-[12.5px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(b === "include" ? INCLUDE_TYPES : EXCLUDE_TYPES).map((t) => (
                <SelectItem key={t} value={t} className="text-[12.5px]">{CRITERION_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {meta.picker !== "none" && (
            <MultiPicker
              options={opts}
              selected={c.ids}
              onChange={(ids) => setRow(b, i, { ids })}
              label={meta.label}
            />
          )}

          <span className="text-[11.5px] text-muted-foreground truncate hidden sm:block">{meta.blurb}</span>

          <Button
            type="button" size="icon" variant="ghost"
            className="h-8 w-8 ml-auto shrink-0 text-destructive hover:text-destructive"
            aria-label="Remove condition"
            onClick={() => removeRow(b, i)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {meta.picker !== "none" && c.ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.ids.map((id) => (
              <Badge key={id} variant="secondary" className="text-[11px] gap-1">
                {nameOf(c.type, id)}
                <button
                  type="button"
                  aria-label={`Remove ${nameOf(c.type, id)}`}
                  onClick={() => setRow(b, i, { ids: c.ids.filter((x) => x !== id) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {meta.picker !== "none" && c.ids.length === 0 && (
          <p className="text-[11px] text-destructive">
            Nothing picked — this condition currently matches nobody.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[12.5px]">Applies to (eligibility)</Label>
        <p className="text-[11.5px] text-muted-foreground">
          Leave empty for everyone. Add conditions and a user needs to match <strong>any one</strong> of them.
        </p>
      </div>

      <div className="space-y-2">
        {list("include").map((c, i) => renderRow("include", c, i))}
        <Button type="button" size="sm" variant="outline" className="h-8 text-[11.5px]" onClick={() => addRow("include")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add condition
        </Button>
      </div>

      <div className="pt-1">
        <Label className="text-[12.5px] flex items-center gap-1.5">
          <UserMinus className="h-3.5 w-3.5 text-destructive" /> Except
        </Label>
        <p className="text-[11.5px] text-muted-foreground">
          Anyone matched here is out, even if a condition above includes them.
        </p>
      </div>

      <div className="space-y-2">
        {list("exclude").map((c, i) => renderRow("exclude", c, i))}
        <Button type="button" size="sm" variant="outline" className="h-8 text-[11.5px]" onClick={() => addRow("exclude")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add exclusion
        </Button>
      </div>

      <p className="rounded-[10px] bg-primary/5 px-3 py-2 text-[12.5px]">
        <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-primary" />
        {summary}
      </p>
    </div>
  );
}

function MultiPicker({
  options, selected, onChange, label,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const shown = useMemo(
    () => options.filter((o) => o.label?.toLowerCase().includes(search.toLowerCase())).slice(0, 200),
    [options, search],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]">
          {selected.length ? `${selected.length} selected` : `Pick ${label.toLowerCase()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search" className="h-8 pl-7 text-[12.5px]"
            />
          </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="text-[12px] text-muted-foreground p-3 text-center">Nothing matches.</p>
          ) : (
            shown.map((o) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange(on ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
                  className={`w-full text-left px-2 py-1.5 rounded-[6px] text-[12.5px] hover:bg-muted ${on ? "bg-muted font-semibold" : ""}`}
                >
                  {on ? "✓ " : ""}{o.label}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
