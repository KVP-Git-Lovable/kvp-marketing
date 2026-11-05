import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/db";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Fleet management for van sales.                                     */
/*                                                                     */
/* The per-km numbers come from the database, not from arithmetic here:*/
/* km lives on the daily van_stock sheet, sales on orders via          */
/* assigned_van_id, and cost in van_expenses. One function joins them  */
/* so the figure on screen can never drift from the figure in a report.*/
/* ------------------------------------------------------------------ */

export const EXPENSE_CATEGORIES = [
  { value: "fuel",          label: "Fuel",            metered: true },
  { value: "service",       label: "Service",         metered: false },
  { value: "repair",        label: "Repair",          metered: false },
  { value: "tyre",          label: "Tyres",           metered: false },
  { value: "toll",          label: "Toll / FASTag",   metered: false },
  { value: "permit",        label: "Permit / tax",    metered: false },
  { value: "insurance",     label: "Insurance",       metered: false },
  { value: "rent",          label: "Rent",            metered: false },
  { value: "driver_salary", label: "Driver salary",   metered: false },
  { value: "fine",          label: "Fine",            metered: false },
  { value: "cleaning",      label: "Cleaning",        metered: false },
  { value: "other",         label: "Other",           metered: false },
] as const;

export const OWNERSHIP_TYPES = [
  { value: "owned",       label: "Owned" },
  { value: "rented",      label: "Rented" },
  { value: "leased",      label: "Leased" },
  { value: "distributor", label: "Distributor's vehicle" },
] as const;

export interface VanPerformanceRow {
  van_id: string;
  registration_number: string | null;
  make_model: string | null;
  ownership_type: string | null;
  assigned_user: string | null;
  days_run: number;
  total_km: number;
  orders: number;
  sales: number;
  fuel_litres: number;
  fuel_cost: number;
  actual_kmpl: number | null;
  expected_kmpl: number | null;
  recorded_cost: number;
  standing_cost: number;
  total_cost: number;
  /** null, not zero, when nothing was driven — see the sql for why. */
  sales_per_km: number | null;
  cost_per_km: number | null;
  margin_per_km: number | null;
  cost_as_pct_of_sales: number | null;
}

export interface ServiceDueRow {
  van_id: string;
  registration_number: string | null;
  service_type: string;
  due_reason: string;
  km_remaining: number | null;
  days_remaining: number | null;
  next_due_km: number | null;
  next_due_date: string | null;
  urgency: "overdue" | "due soon";
}

/** Per-km performance for a window. Null dates mean all time, in which case
 *  standing cost is not charged — prorating a monthly rent across "ever" would
 *  be a made-up number. */
export const useVanPerformance = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["van-performance", from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("van_performance" as any, {
        p_from: from ?? null,
        p_to: to ?? null,
      });
      if (error) throw error;
      return (data ?? []) as VanPerformanceRow[];
    },
  });

export const useVanBeatPerformance = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["van-beat-performance", from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("van_beat_performance" as any, {
        p_from: from ?? null,
        p_to: to ?? null,
      });
      if (error) throw error;
      return (data ?? []) as {
        beat_id: string; beat_name: string; vans: number;
        total_km: number; orders: number; sales: number; sales_per_km: number | null;
      }[];
    },
  });

export const useServiceDue = () =>
  useQuery({
    queryKey: ["van-service-due"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("van_service_due" as any);
      if (error) throw error;
      return (data ?? []) as ServiceDueRow[];
    },
  });

export const useFleetVans = () =>
  useQuery({
    queryKey: ["fleet-vans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vans")
        .select("*")
        .eq("is_active", true)
        .order("registration_number");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

export const useVanExpenses = (vanId?: string, from?: string, to?: string) =>
  useQuery({
    queryKey: ["van-expenses", vanId ?? null, from ?? null, to ?? null],
    queryFn: async () => {
      let q = supabase
        .from("van_expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .limit(500);
      if (vanId) q = q.eq("van_id", vanId);
      if (from) q = q.gte("expense_date", from);
      if (to) q = q.lte("expense_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

/** Everything that changes a cost figure invalidates the per-km numbers too,
 *  so the headline can never lag the ledger it is built from. */
const useFleetInvalidation = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["van-expenses"] });
    qc.invalidateQueries({ queryKey: ["van-performance"] });
    qc.invalidateQueries({ queryKey: ["van-beat-performance"] });
    qc.invalidateQueries({ queryKey: ["van-service-due"] });
    qc.invalidateQueries({ queryKey: ["fleet-vans"] });
  };
};

export const useAddVanExpense = () => {
  const refresh = useFleetInvalidation();
  return useMutation({
    mutationFn: async (e: {
      van_id: string; expense_date: string; category: string; amount: number;
      quantity?: number | null; rate?: number | null; odometer_km?: number | null;
      vendor?: string | null; reference_no?: string | null; notes?: string | null;
    }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("van_expenses").insert({
        ...e,
        recorded_by: me?.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Expense recorded"); },
    onError: (e: any) => toast.error(e.message ?? "Could not record the expense"),
  });
};

export const useDeleteVanExpense = () => {
  const refresh = useFleetInvalidation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("van_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Expense removed"); },
    onError: (e: any) => toast.error(e.message ?? "Could not remove the expense"),
  });
};

export const useUpdateVanFleetDetails = () => {
  const refresh = useFleetInvalidation();
  return useMutation({
    mutationFn: async (v: { id: string } & Record<string, any>) => {
      const { id, ...rest } = v;
      const { error } = await supabase.from("vans").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Vehicle updated"); },
    onError: (e: any) => toast.error(e.message ?? "Could not update the vehicle"),
  });
};

/** Pull the day's distance off the tracker instead of keying it. Values someone
 *  actually typed are left alone by the function. */
export const useAutofillDayKm = () => {
  const refresh = useFleetInvalidation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { vanId: string; date: string }) => {
      const { data, error } = await supabase.rpc("van_autofill_day_km" as any, {
        p_van: v.vanId, p_date: v.date,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { start_km: number; end_km: number; total_km: number; note: string };
    },
    onSuccess: (row) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["van-stock"] });
      toast.success(`${row?.total_km ?? 0} km — ${row?.note ?? "updated"}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not read the tracker"),
  });
};

export const useCompleteService = () => {
  const refresh = useFleetInvalidation();
  return useMutation({
    mutationFn: async (v: {
      scheduleId: string; doneKm: number; doneDate: string;
      amount?: number | null; vendor?: string | null; notes?: string | null;
    }) => {
      const { error } = await supabase.rpc("van_complete_service" as any, {
        p_schedule: v.scheduleId, p_done_km: v.doneKm, p_done_date: v.doneDate,
        p_amount: v.amount ?? null, p_vendor: v.vendor ?? null, p_notes: v.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Service recorded and the next one scheduled"); },
    onError: (e: any) => toast.error(e.message ?? "Could not record the service"),
  });
};
