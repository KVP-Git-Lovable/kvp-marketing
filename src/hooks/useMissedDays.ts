import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface MissedBeatDay {
  missed_date: string;
  /** Retailers still pending on that day. */
  retailer_count: number;
  on_leave: boolean;
  /** How many were actually visited, so a partly-worked day reads as one. */
  attended_count: number;
  /** Whether the day was ended, manually or by the auto-end job. */
  day_ended: boolean;
}

/**
 * The day a carry-forward would land on if the rep does not pick one.
 * Resolved up front so the dialog can name the date instead of promising
 * "next free day" and revealing which day only after the move.
 */
export function useNextFreeDay(userId?: string | null, fromDate?: string | null) {
  return useQuery<string | null>({
    queryKey: ["next-free-day", userId, fromDate],
    enabled: !!userId && !!fromDate,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("next_free_day", { p_user: userId, p_from: fromDate });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

export function useMissedBeatDays(
  userId: string | null | undefined,
  lookback = 14,
  opts: { enabled?: boolean } = {},
) {
  return useQuery<MissedBeatDay[]>({
    queryKey: ["missed-beat-days", userId, lookback],
    enabled: !!userId && opts.enabled !== false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_missed_beat_days", {
        p_user: userId,
        p_lookback: lookback,
      });
      if (error) throw error;
      return (data || []) as MissedBeatDay[];
    },
  });
}

export function useRescheduleMissedDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; fromDate: string; toDate?: string | null }) => {
      const { data, error } = await sb.rpc("reschedule_missed_day", {
        p_user: args.userId,
        p_from_date: args.fromDate,
        p_to_date: args.toDate ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        moved: (row?.moved as number) || 0,
        toDate: (row?.to_date as string) || args.toDate || "",
      };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["missed-beat-days", args.userId] });
      qc.invalidateQueries({ queryKey: ["bc-day", args.userId] });
    },
  });
}

export interface MissedDayRetailer {
  visit_id: string;
  retailer_id: string;
  retailer_name: string | null;
  city: string | null;
  beat_id: string | null;
  beat_name: string | null;
}

export function useMissedDayRetailers(userId: string | null | undefined, date: string | null) {
  return useQuery<MissedDayRetailer[]>({
    queryKey: ["missed-day-retailers", userId, date],
    enabled: !!userId && !!date,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_missed_day_retailers", {
        p_user: userId,
        p_date: date,
      });
      if (error) throw error;
      return (data || []) as MissedDayRetailer[];
    },
  });
}

export function useRescheduleSelectedVisits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      userId: string;
      fromDate: string;
      visitIds: string[];
      toDate?: string | null;
    }) => {
      const { data, error } = await sb.rpc("reschedule_missed_visits", {
        p_user: args.userId,
        p_from_date: args.fromDate,
        p_visit_ids: args.visitIds,
        p_to_date: args.toDate ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        moved: (row?.moved as number) || 0,
        toDate: (row?.to_date as string) || args.toDate || "",
      };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["missed-beat-days", args.userId] });
      qc.invalidateQueries({ queryKey: ["missed-day-retailers", args.userId] });
      qc.invalidateQueries({ queryKey: ["bc-day", args.userId] });
    },
  });
}
