import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Star, Loader2, Building2 } from "lucide-react";
import { supabase } from '@/lib/supabaseLoose';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Which distributors a user serves.
 *
 * Two modes. Given a userId it loads and saves user_distributors directly --
 * that is the edit case on an existing user. Without one it is a controlled
 * picker, for the create-user wizard, where the rows can only be written once
 * the user exists.
 *
 * A user with NO distributor is unrestricted and sees all of them. Assigning
 * even one narrows them, so the empty state is "serves everyone", not "serves
 * nobody" -- switching this on must not empty the dropdown for every rep.
 */

export interface DistributorChoice {
  ids: string[];
  primaryId: string | null;
}

interface Option { id: string; name: string }

interface Props {
  /** Existing user: load and save immediately. */
  userId?: string;
  /** Create flow: the caller holds the value and writes the rows itself. */
  value?: DistributorChoice;
  onChange?: (v: DistributorChoice) => void;
  disabled?: boolean;
}

/** Writes a user's distributor set. Exported so the create wizard can call it. */
export async function saveUserDistributors(
  userId: string,
  choice: DistributorChoice,
  assignedBy?: string | null,
) {
  await supabase.from("user_distributors").delete().eq("user_id", userId);
  if (choice.ids.length === 0) return;
  const { error } = await supabase.from("user_distributors").insert(
    choice.ids.map((id) => ({
      user_id: userId,
      distributor_id: id,
      is_primary: id === choice.primaryId,
      assigned_by: assignedBy ?? null,
    })),
  );
  if (error) throw error;
}

export function UserDistributorsPicker({ userId, value, onChange, disabled }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [choice, setChoice] = useState<DistributorChoice>(value ?? { ids: [], primaryId: null });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const controlled = !userId;
  const current = controlled ? (value ?? { ids: [], primaryId: null }) : choice;

  const load = useCallback(async () => {
    const [{ data: all }, assigned] = await Promise.all([
      supabase.from("distributors").select("id, name").eq("status", "active").order("name"),
      userId
        ? supabase
            .from("user_distributors")
            .select("distributor_id, is_primary")
            .eq("user_id", userId)
            .eq("is_active", true)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setOptions((all as Option[]) ?? []);
    if (userId) {
      const rows = (assigned as any).data ?? [];
      setChoice({
        ids: rows.map((r: any) => r.distributor_id),
        primaryId: rows.find((r: any) => r.is_primary)?.distributor_id ?? null,
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const apply = (next: DistributorChoice) => {
    if (controlled) onChange?.(next);
    else setChoice(next);
  };

  const toggle = (id: string) => {
    const has = current.ids.includes(id);
    const ids = has ? current.ids.filter((x) => x !== id) : [...current.ids, id];
    const primaryId = has && current.primaryId === id
      ? (ids[0] ?? null)
      : (current.primaryId ?? (ids.length === 1 ? ids[0] : null));
    apply({ ids, primaryId });
  };

  const makePrimary = (id: string) => {
    const ids = current.ids.includes(id) ? current.ids : [...current.ids, id];
    apply({ ids, primaryId: id });
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      await saveUserDistributors(userId, current, me?.user?.id);
      toast.success(
        current.ids.length === 0
          ? "Cleared — this user can pick any distributor again"
          : `Saved. This user serves ${current.ids.length} distributor${current.ids.length === 1 ? "" : "s"}.`,
      );
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading distributors…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          Distributors this user serves
        </Label>
        {current.ids.length === 0 ? (
          <Badge variant="outline" className="text-[10px]">Can pick any</Badge>
        ) : (
          <Badge className="text-[10px]">{current.ids.length} selected</Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {current.ids.length === 0
          ? "None chosen, so every distributor is offered when this user adds a retailer. Choose some to narrow it."
          : "Only these are offered when this user adds a retailer. The starred one is pre-selected."}
      </p>

      {options.length > 6 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-sm"
            placeholder="Search distributors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No matches.</p>
        ) : (
          filtered.map((o) => {
            const picked = current.ids.includes(o.id);
            const primary = current.primaryId === o.id;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 text-sm",
                  picked && "bg-primary/5",
                )}
              >
                <Checkbox
                  checked={picked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(o.id)}
                />
                <span className="flex-1 truncate">{o.name}</span>
                <button
                  type="button"
                  title={primary ? "Pre-selected for this user" : "Make this the default"}
                  disabled={disabled}
                  onClick={() => makePrimary(o.id)}
                  className="shrink-0 p-1 rounded hover:bg-muted"
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      primary ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40",
                    )}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>

      {!controlled && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || disabled}>
            {saving ? "Saving…" : "Save distributors"}
          </Button>
        </div>
      )}
    </div>
  );
}
