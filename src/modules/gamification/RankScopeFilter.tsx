import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Loader2, Users, UserRound, ListChecks, X } from "lucide-react";
import { RANK_SCOPES, useSelectableUsers, type RankScope } from "./hooks";

/**
 * Whose rankings you are looking at.
 *
 * Three scopes, resolved server-side from the signed-in user: your whole
 * organisation tree, found by climbing to its root; just you and your reports;
 * or people you pick. Two unrelated trees never mix. Deactivated users never
 * appear in any of them — the rpc excludes them, so this control cannot offer
 * someone the board would refuse to draw.
 */

const SCOPE_ICON: Record<RankScope, typeof Users> = {
  hierarchy: Users,
  mine: UserRound,
  selected: ListChecks,
};

export function RankScopeFilter({
  scope, onScopeChange, selected, onSelectedChange,
}: {
  scope: RankScope;
  onScopeChange: (s: RankScope) => void;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
}) {
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only fetched once the picker is actually needed.
  const { data: people = [], isLoading } = useSelectableUsers(scope === "selected");
  const byId = useMemo(
    () => new Map(people.map((p) => [p.user_id, p.full_name])),
    [people],
  );

  const current = RANK_SCOPES.find((s) => s.value === scope) ?? RANK_SCOPES[0];
  const CurrentIcon = SCOPE_ICON[current.value];

  const toggle = (id: string) =>
    onSelectedChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          View rankings by
        </span>

        <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline" size="sm"
              className="ml-auto h-8 gap-1.5 text-[12px] font-semibold"
            >
              <CurrentIcon className="h-3.5 w-3.5" />
              {current.label}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[266px] p-1.5">
            {RANK_SCOPES.map((s) => {
              const Icon = SCOPE_ICON[s.value];
              const on = s.value === scope;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    onScopeChange(s.value);
                    setScopeOpen(false);
                    if (s.value === "selected") setPickerOpen(true);
                  }}
                  className={`w-full flex items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left min-h-[44px] transition-colors ${
                    on ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold">{s.label}</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">{s.hint}</span>
                  </span>
                  {on && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {scope === "selected" && (
        <div className="space-y-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-9 justify-between text-[12.5px] font-medium">
                {selected.length === 0
                  ? "Choose people to compare"
                  : `${selected.length} ${selected.length === 1 ? "person" : "people"} selected`}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(320px,calc(100vw-40px))] p-0">
              {/* Plain substring, not the default fuzzy scorer: searching
                  "shra" otherwise offered "Akshat Prabhu", which reads as a
                  broken search rather than a clever one. */}
              <Command
                filter={(value, search) =>
                  value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                }
              >
                <CommandInput placeholder="Search people…" className="text-[13px]" />
                <CommandList>
                  {isLoading ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty className="py-6 text-center text-[12.5px] text-muted-foreground">
                        Nobody matches that.
                      </CommandEmpty>
                      <CommandGroup>
                        {people.map((p) => {
                          const on = selected.includes(p.user_id);
                          return (
                            <CommandItem
                              key={p.user_id}
                              value={p.full_name}
                              onSelect={() => toggle(p.user_id)}
                              className="gap-2.5 min-h-[40px]"
                            >
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="text-[10px] font-semibold">
                                  {p.full_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[12.5px] truncate flex-1">{p.full_name}</span>
                              {on && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1 text-[11px] font-medium">
                  {byId.get(id) ?? "Selected"}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${byId.get(id) ?? "person"}`}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={() => onSelectedChange([])}
                className="text-[11px] font-semibold text-muted-foreground px-2 py-1 min-h-[26px]"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
