import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Truck, IndianRupee, Gauge, Wrench, AlertTriangle, Plus, Radio, Fuel, Trash2,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES, OWNERSHIP_TYPES,
  useVanPerformance, useVanBeatPerformance, useServiceDue, useFleetVans,
  useVanExpenses, useAddVanExpense, useDeleteVanExpense,
  useUpdateVanFleetDetails, useAutofillDayKm,
} from "@/hooks/useFleet";

const rs = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const km = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("en-IN")} km`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const RANGES = [
  { value: "month", label: "This month" },
  { value: "last30", label: "Last 30 days" },
  { value: "quarter", label: "Last 90 days" },
  { value: "fy", label: "This financial year" },
  { value: "all", label: "All time" },
];

function rangeDates(kind: string): [string | undefined, string | undefined] {
  const today = new Date();
  const back = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
  switch (kind) {
    case "month": return [iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(today)];
    case "last30": return [back(30), iso(today)];
    case "quarter": return [back(90), iso(today)];
    case "fy": {
      const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return [`${y}-04-01`, iso(today)];
    }
    default: return [undefined, undefined];
  }
}

/**
 * Fleet management for van sales.
 *
 * The point of this screen is one pair of numbers — sales per km against cost
 * per km — so they lead, and everything else exists to make them trustworthy.
 */
export function FleetManagement() {
  const [range, setRange] = useState("month");
  const [from, to] = rangeDates(range);

  const { data: perf = [], isLoading } = useVanPerformance(from, to);
  const { data: beats = [] } = useVanBeatPerformance(from, to);
  const { data: due = [] } = useServiceDue();
  const { data: vans = [] } = useFleetVans();

  const totals = useMemo(() => {
    const t = perf.reduce((a, r) => ({
      km: a.km + Number(r.total_km ?? 0),
      sales: a.sales + Number(r.sales ?? 0),
      cost: a.cost + Number(r.total_cost ?? 0),
      fuel: a.fuel + Number(r.fuel_cost ?? 0),
    }), { km: 0, sales: 0, cost: 0, fuel: 0 });
    return {
      ...t,
      salesPerKm: t.km > 0 ? t.sales / t.km : null,
      costPerKm: t.km > 0 ? t.cost / t.km : null,
      marginPerKm: t.km > 0 ? (t.sales - t.cost) / t.km : null,
    };
  }, [perf]);

  const noTracker = vans.filter((v: any) => !v.device_id).length;

  return (
    <div className="space-y-4">
      {/* --- the two numbers this screen exists for --- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Fleet performance</h2>
          <p className="text-sm text-muted-foreground">
            What each van earns per kilometre, against what it costs to run
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Sales per km", value: rs(totals.salesPerKm), sub: rs(totals.sales) + " booked",
              icon: IndianRupee, tone: "bg-emerald-500/10 text-emerald-600" },
            { label: "Cost per km", value: rs(totals.costPerKm), sub: rs(totals.cost) + " spent",
              icon: Fuel, tone: "bg-rose-500/10 text-rose-600" },
            { label: "Margin per km", value: rs(totals.marginPerKm),
              sub: totals.salesPerKm && totals.costPerKm
                   ? (totals.marginPerKm! >= 0 ? "earning" : "losing") + " per km run" : "—",
              icon: Gauge, tone: "bg-primary/5 text-primary" },
            { label: "Distance run", value: km(totals.km), sub: `${perf.length} vehicle(s)`,
              icon: Truck, tone: "bg-accent text-accent-foreground" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{k.label}</p>
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground">{k.sub}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
                  <k.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* --- things that need attention --- */}
      {(due.length > 0 || noTracker > 0) && (
        <div className="space-y-2">
          {due.map((d) => (
            <div key={`${d.van_id}-${d.service_type}`}
                 className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                 style={{ borderColor: d.urgency === "overdue" ? "#fca5a5" : "#fcd34d",
                          background: d.urgency === "overdue" ? "#fef2f2" : "#fffbeb" }}>
              <AlertTriangle className="h-4 w-4 shrink-0"
                             style={{ color: d.urgency === "overdue" ? "#dc2626" : "#d97706" }} />
              <span className="font-medium">{d.registration_number}</span>
              <span>{d.service_type}</span>
              <Badge variant={d.urgency === "overdue" ? "destructive" : "secondary"}>
                {d.urgency}
              </Badge>
              <span className="text-muted-foreground">
                {d.due_reason}
                {d.km_remaining != null && ` · ${Math.round(d.km_remaining)} km to go`}
                {d.days_remaining != null && ` · ${d.days_remaining} day(s)`}
              </span>
            </div>
          ))}
          {noTracker > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Radio className="h-4 w-4 shrink-0" />
              {noTracker} vehicle(s) have no tracker ID set, so their distance has to be
              keyed by hand. Add the device ID on the Vehicles tab to automate it.
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Per vehicle</TabsTrigger>
          <TabsTrigger value="beats">Per beat</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="costs">Running costs</TabsTrigger>
        </TabsList>

        {/* ---------------- per vehicle ---------------- */}
        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
                      <th>Vehicle</th><th>Held as</th><th className="text-right">Km</th>
                      <th className="text-right">Sales</th><th className="text-right">Cost</th>
                      <th className="text-right">Sales/km</th><th className="text-right">Cost/km</th>
                      <th className="text-right">Margin/km</th><th className="text-right">km/l</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((r) => (
                      <tr key={r.van_id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                        <td>
                          <div className="font-medium">{r.registration_number ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {[r.make_model, r.assigned_user].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="capitalize">{r.ownership_type ?? "—"}</td>
                        <td className="text-right tabular-nums">{km(r.total_km)}</td>
                        <td className="text-right tabular-nums">{rs(r.sales)}</td>
                        <td className="text-right tabular-nums">{rs(r.total_cost)}</td>
                        <td className="text-right font-semibold tabular-nums text-emerald-600">
                          {rs(r.sales_per_km)}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-rose-600">
                          {rs(r.cost_per_km)}
                        </td>
                        <td className="text-right font-semibold tabular-nums"
                            style={{ color: (r.margin_per_km ?? 0) >= 0 ? "#059669" : "#dc2626" }}>
                          {rs(r.margin_per_km)}
                        </td>
                        <td className="text-right tabular-nums">
                          {r.actual_kmpl ?? "—"}
                          {r.expected_kmpl != null && (
                            <span className="text-[11px] text-muted-foreground"> /{r.expected_kmpl}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {perf.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                        No vehicles yet.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                Cost per km includes the running ledger plus rent and driver salary prorated
                across the window. A per-km figure is blank rather than zero when nothing was
                driven — dividing by no distance says nothing. Choose &quot;All time&quot; and the
                standing costs are not charged, because prorating a monthly rent across
                &quot;ever&quot; would be a made-up number.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- per beat ---------------- */}
        <TabsContent value="beats" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                      <th>Beat</th><th className="text-right">Vans</th>
                      <th className="text-right">Km</th><th className="text-right">Orders</th>
                      <th className="text-right">Sales</th><th className="text-right">Sales/km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beats.map((b) => (
                      <tr key={b.beat_id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                        <td className="font-medium">{b.beat_name}</td>
                        <td className="text-right tabular-nums">{b.vans}</td>
                        <td className="text-right tabular-nums">{km(b.total_km)}</td>
                        <td className="text-right tabular-nums">{b.orders}</td>
                        <td className="text-right tabular-nums">{rs(b.sales)}</td>
                        <td className="text-right font-semibold tabular-nums">{rs(b.sales_per_km)}</td>
                      </tr>
                    ))}
                    {beats.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                        No van activity against a beat in this window.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <VehiclesTab vans={vans} />
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <CostsTab vans={vans} from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VehiclesTab({ vans }: { vans: any[] }) {
  const update = useUpdateVanFleetDetails();
  const autofill = useAutofillDayKm();
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="space-y-3">
      {vans.map((v) => (
        <Card key={v.id}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {v.registration_number ?? "Unregistered"}
              <Badge variant="secondary" className="capitalize">{v.ownership_type}</Badge>
              {v.device_id
                ? <Badge className="gap-1"><Radio className="h-3 w-3" /> tracker on</Badge>
                : <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Radio className="h-3 w-3" /> no tracker
                  </Badge>}
            </CardTitle>
            <div className="flex gap-2">
              {v.device_id && (
                <Button size="sm" variant="outline"
                        onClick={() => autofill.mutate({ vanId: v.id, date: iso(new Date()) })}
                        disabled={autofill.isPending}>
                  <Gauge className="mr-1.5 h-3.5 w-3.5" /> Pull today&apos;s km
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing(v)}>Edit</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Odometer" value={km(v.current_odometer_km)}
                   hint={v.odometer_updated_at
                         ? `read ${new Date(v.odometer_updated_at).toLocaleString("en-IN")}`
                         : "never read"} />
            <Field label="Driver" value={v.driver_name ?? "—"}
                   hint={v.driver_licence_expiry
                         ? `licence to ${v.driver_licence_expiry}` : undefined} />
            <Field label="Monthly rent" value={v.monthly_rent ? rs(v.monthly_rent) : "—"} />
            <Field label="Driver salary" value={v.monthly_driver_salary ? rs(v.monthly_driver_salary) : "—"} />
            <Field label="Insurance to" value={v.insurance_expiry_date ?? "—"}
                   warn={isSoon(v.insurance_expiry_date)} />
            <Field label="RC to" value={v.rc_expiry_date ?? "—"} warn={isSoon(v.rc_expiry_date)} />
            <Field label="Pollution to" value={v.pollution_expiry_date ?? "—"}
                   warn={isSoon(v.pollution_expiry_date)} />
            <Field label="FASTag" value={v.fastag_number ?? "—"} hint={v.fastag_provider ?? undefined} />
          </CardContent>
        </Card>
      ))}
      {vans.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No active vehicles.
        </CardContent></Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>
            {editing?.registration_number ?? "Vehicle"} — fleet details
          </DialogTitle></DialogHeader>
          {editing && (
            <form className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget as HTMLFormElement);
                    const num = (k: string) => {
                      const v = String(f.get(k) ?? "").trim();
                      return v === "" ? null : Number(v);
                    };
                    const txt = (k: string) => {
                      const v = String(f.get(k) ?? "").trim();
                      return v === "" ? null : v;
                    };
                    update.mutate({
                      id: editing.id,
                      ownership_type: String(f.get("ownership_type")),
                      device_id: txt("device_id"),
                      device_provider: txt("device_provider"),
                      monthly_rent: num("monthly_rent"),
                      monthly_driver_salary: num("monthly_driver_salary"),
                      expected_kmpl: num("expected_kmpl"),
                      fastag_number: txt("fastag_number"),
                      driver_licence_number: txt("driver_licence_number"),
                      driver_licence_expiry: txt("driver_licence_expiry"),
                      purchase_cost: num("purchase_cost"),
                    }, { onSuccess: () => setEditing(null) });
                  }}>
              <div className="sm:col-span-2">
                <Label>Held as</Label>
                <Select name="ownership_type" defaultValue={editing.ownership_type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OWNERSHIP_TYPES.map((o) =>
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Text name="device_id" label="Tracker device ID" def={editing.device_id}
                    hint="From the unit fitted to the van — this is what automates the km." />
              <Text name="device_provider" label="Tracker provider" def={editing.device_provider} />
              <Text name="monthly_rent" label="Monthly rent (₹)" def={editing.monthly_rent} type="number" />
              <Text name="monthly_driver_salary" label="Driver salary / month (₹)"
                    def={editing.monthly_driver_salary} type="number" />
              <Text name="purchase_cost" label="Purchase cost (₹)" def={editing.purchase_cost} type="number" />
              <Text name="expected_kmpl" label="Expected km per litre" def={editing.expected_kmpl} type="number" />
              <Text name="fastag_number" label="FASTag number" def={editing.fastag_number} />
              <Text name="driver_licence_number" label="Driver licence no." def={editing.driver_licence_number} />
              <Text name="driver_licence_expiry" label="Licence expiry"
                    def={editing.driver_licence_expiry} type="date" />
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={update.isPending}>Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CostsTab({ vans, from, to }: { vans: any[]; from?: string; to?: string }) {
  const [vanId, setVanId] = useState<string>("all");
  const { data: expenses = [] } = useVanExpenses(vanId === "all" ? undefined : vanId, from, to);
  const add = useAddVanExpense();
  const del = useDeleteVanExpense();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("fuel");

  const metered = EXPENSE_CATEGORIES.find((c) => c.value === category)?.metered;
  const total = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const nameOf = (id: string) =>
    vans.find((v) => v.id === id)?.registration_number ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">
          Running costs <span className="font-normal text-muted-foreground">({rs(total)})</span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={vanId} onValueChange={setVanId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {vans.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add cost</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record a vehicle cost</DialogTitle></DialogHeader>
              <form className="grid gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget as HTMLFormElement);
                      const num = (k: string) => {
                        const v = String(f.get(k) ?? "").trim();
                        return v === "" ? null : Number(v);
                      };
                      add.mutate({
                        van_id: String(f.get("van_id")),
                        expense_date: String(f.get("expense_date")),
                        category,
                        amount: Number(f.get("amount")),
                        quantity: num("quantity"),
                        rate: num("rate"),
                        odometer_km: num("odometer_km"),
                        vendor: String(f.get("vendor") ?? "") || null,
                        reference_no: String(f.get("reference_no") ?? "") || null,
                        notes: String(f.get("notes") ?? "") || null,
                      }, { onSuccess: () => setOpen(false) });
                    }}>
                <div className="sm:col-span-2">
                  <Label>Vehicle</Label>
                  <Select name="van_id" defaultValue={vanId !== "all" ? vanId : vans[0]?.id} required>
                    <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vans.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) =>
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Text name="expense_date" label="Date" type="date" def={iso(new Date())} required />
                <Text name="amount" label="Amount (₹)" type="number" required />
                <Text name="odometer_km" label="Odometer (km)" type="number"
                      hint="Lets cost be traced to distance." />
                {metered && <Text name="quantity" label="Litres" type="number" />}
                {metered && <Text name="rate" label="Rate per litre (₹)" type="number" />}
                <Text name="vendor" label="Vendor" />
                <Text name="reference_no" label="Bill / reference" />
                <div className="sm:col-span-2">
                  <Text name="notes" label="Notes" />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={add.isPending}>Record</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Date</th><th>Vehicle</th><th>Category</th>
                <th className="text-right">Amount</th><th className="text-right">Odometer</th>
                <th>Vendor</th><th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                  <td className="whitespace-nowrap">{e.expense_date}</td>
                  <td>{nameOf(e.van_id)}</td>
                  <td className="capitalize">
                    {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                    {e.quantity ? <span className="text-[11px] text-muted-foreground"> · {e.quantity}L</span> : null}
                  </td>
                  <td className="text-right tabular-nums">{rs(e.amount)}</td>
                  <td className="text-right tabular-nums">{e.odometer_km ? km(e.odometer_km) : "—"}</td>
                  <td className="text-muted-foreground">{e.vendor ?? "—"}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)}
                            aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  Nothing recorded in this window.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const isSoon = (d?: string | null) =>
  !!d && (new Date(d).getTime() - Date.now()) / 86400000 <= 30;

function Field({ label, value, hint, warn }:
  { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-medium ${warn ? "text-amber-600" : ""}`}>
        {value}{warn && <AlertTriangle className="ml-1 inline h-3 w-3" />}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Text({ name, label, def, type = "text", hint, required }:
  { name: string; label: string; def?: any; type?: string; hint?: string; required?: boolean }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={def ?? ""} required={required} />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
