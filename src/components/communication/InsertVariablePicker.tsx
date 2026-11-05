import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { getResolvableRegistry, type VariableEntity, type VariableCategory } from "@/lib/whatsappVariables";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LAST_ENTITY_KEY = "wa.insertVar.lastEntity";

type Step = "entity" | "category" | "variable";

interface Props {
  onInsert: (varName: string) => void;
}

export function InsertVariablePicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("entity");
  const [entity, setEntity] = useState<VariableEntity | null>(null);
  const [category, setCategory] = useState<VariableCategory | null>(null);
  const [search, setSearch] = useState("");

  const registry = useMemo(() => getResolvableRegistry(), []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    try {
      const lastKey = window.localStorage.getItem(LAST_ENTITY_KEY);
      const found = lastKey ? registry.find((e) => e.key === lastKey) : null;
      if (found) {
        setEntity(found);
        setCategory(null);
        setStep("category");
      } else {
        setEntity(null);
        setCategory(null);
        setStep("entity");
      }
    } catch {
      setStep("entity");
    }
  }, [open, registry]);

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return registry;
    return registry.filter((e) => e.label.toLowerCase().includes(q));
  }, [search, registry]);

  const filteredCategories = useMemo(() => {
    if (!entity) return [];
    const q = search.trim().toLowerCase();
    if (!q) return entity.categories;
    return entity.categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [entity, search]);

  const filteredVariables = useMemo(() => {
    if (!category) return [];
    const q = search.trim().toLowerCase();
    if (!q) return category.variables;
    return category.variables.filter(
      (v) => v.label.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)
    );
  }, [category, search]);

  const goBack = () => {
    setSearch("");
    if (step === "variable") {
      setCategory(null);
      setStep("category");
    } else if (step === "category") {
      setEntity(null);
      setStep("entity");
    }
  };

  const pickEntity = (e: VariableEntity) => {
    setEntity(e);
    setSearch("");
    setStep("category");
    try {
      window.localStorage.setItem(LAST_ENTITY_KEY, e.key);
    } catch {
      /* ignore */
    }
  };

  const pickCategory = (c: VariableCategory) => {
    setCategory(c);
    setSearch("");
    setStep("variable");
  };

  const pickVariable = (name: string) => {
    onInsert(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Insert Variable
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">Variables are auto-mapped to WhatsApp format on submission</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-72 p-0 bg-popover">
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          {step !== "entity" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goBack}
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-7" />
          )}
          <div className="flex-1 text-xs text-muted-foreground truncate">
            {step === "entity" && "Choose data source"}
            {step === "category" && entity && (
              <span className="font-medium text-foreground">{entity.label}</span>
            )}
            {step === "variable" && entity && category && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    setCategory(null);
                    setSearch("");
                    setStep("category");
                  }}
                >
                  {entity.label}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-foreground">{category.label}</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-2 border-b">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              step === "entity"
                ? "Search entities..."
                : step === "category"
                ? "Search categories..."
                : "Search variables..."
            }
            className="h-8 text-sm"
          />
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {step === "entity" && (
            <>
              {filteredEntities.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No entities found
                </p>
              )}
              {filteredEntities.map((e) => (
                <button
                  type="button"
                  key={e.key}
                  onClick={() => pickEntity(e)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span>{e.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </>
          )}

          {step === "category" && entity && (
            <>
              {filteredCategories.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No categories found
                </p>
              )}
              {filteredCategories.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => pickCategory(c)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span>{c.label}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {c.variables.length}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </>
          )}

          {step === "variable" && category && (
            <>
              {filteredVariables.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No variables found
                </p>
              )}
              {filteredVariables.map((v) => (
                <button
                  type="button"
                  key={v.name}
                  onClick={() => pickVariable(v.name)}
                  className="w-full flex flex-col items-start px-3 py-1.5 hover:bg-accent text-left"
                >
                  <span className="text-sm">{v.label}</span>
                  <code className="text-[10px] text-muted-foreground">{`{{${v.name}}}`}</code>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="border-t px-2 py-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Info className="h-3 w-3" />
          Auto-mapped to {"{{1}}, {{2}}"} on submission
        </div>
      </PopoverContent>
    </Popover>
  );
}
