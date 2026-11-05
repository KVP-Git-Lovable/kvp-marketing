import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare, Paintbrush, Users, Star, ClipboardList, Camera, Truck,
  ShoppingBag, ThumbsUp, AlertTriangle, Megaphone, Package,
} from "lucide-react";

/**
 * Tiles for feedback types an admin created, appended to the built-in ones on
 * the visit card. Built-ins keep their own components and tables; these are
 * rendered entirely from configuration.
 */

export interface CustomFeedbackType {
  module: string;
  label: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
}

/** A closed set, because an arbitrary icon name from the database must never
 *  become a dynamic import or an eval. Unknown names fall back. */
export const ICON_MAP: Record<string, typeof MessageSquare> = {
  MessageSquare, Paintbrush, Users, Star, ClipboardList, Camera, Truck,
  ShoppingBag, ThumbsUp, AlertTriangle, Megaphone, Package,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  blue:   { bg: "bg-blue-100 dark:bg-blue-900/30",     fg: "text-blue-600 dark:text-blue-400" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/30", fg: "text-orange-600 dark:text-orange-400" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/30", fg: "text-purple-600 dark:text-purple-400" },
  green:  { bg: "bg-green-100 dark:bg-green-900/30",   fg: "text-green-600 dark:text-green-400" },
  amber:  { bg: "bg-amber-100 dark:bg-amber-900/30",   fg: "text-amber-600 dark:text-amber-400" },
  rose:   { bg: "bg-rose-100 dark:bg-rose-900/30",     fg: "text-rose-600 dark:text-rose-400" },
  slate:  { bg: "bg-slate-100 dark:bg-slate-800/50",   fg: "text-slate-600 dark:text-slate-300" },
};

export const COLOR_NAMES = Object.keys(COLOR_MAP);

/** Custom (non-builtin) types that should appear on a visit. */
export function useCustomFeedbackTypes() {
  return useQuery({
    queryKey: ["custom-feedback-types"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CustomFeedbackType[]> => {
      const { data, error } = await (supabase as any)
        .from("feedback_module_config")
        .select("module,label,description,icon,color,sort_order")
        .eq("is_active", true)
        .eq("is_builtin", false)
        .eq("show_on_visit", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Tiles only. The modal is deliberately NOT rendered here: the host closes its
 * own menu when a tile is picked, which would unmount anything nested inside
 * it. The host owns the selection and renders CustomFeedbackModal at its top
 * level instead.
 */
export function CustomFeedbackTiles({
  onPick,
}: {
  onPick: (type: CustomFeedbackType) => void;
}) {
  const { data: types = [] } = useCustomFeedbackTypes();

  if (!types.length) return null;

  return (
    <>
      {types.map((t) => {
        const Icon = ICON_MAP[t.icon] ?? MessageSquare;
        const c = COLOR_MAP[t.color] ?? COLOR_MAP.blue;
        return (
          <Button
            key={t.module}
            variant="outline"
            className="w-full h-auto py-4 px-4 flex items-center gap-4 hover:bg-primary/5 hover:border-primary/50 transition-all group"
            onClick={() => onPick(t)}
          >
            <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${c.bg}`}>
              <Icon size={22} className={c.fg} />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base">{t.label}</div>
              {t.description && (
                <div className="text-xs text-muted-foreground">{t.description}</div>
              )}
            </div>
          </Button>
        );
      })}
    </>
  );
}
