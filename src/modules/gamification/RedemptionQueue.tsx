import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BadgeIndianRupee, Check, Clock, Loader2, Send, X } from "lucide-react";
import {
  useDecideRedemption, useMarkRedemptionPaid, useRedemptionQueue,
  type RedemptionRow, type RedemptionStatus,
} from "./hooks";

/**
 * The manager's redemption queue.
 *
 * Approval and payment are two different events, and this screen is built
 * around that: "To review" holds decisions, "To pay" holds obligations, and a
 * request only leaves the second one when a human confirms the money actually
 * went out. Approving deducts nothing — the points are burned by the payment
 * step, which is the only place that touches the ledger.
 *
 * There was no approval screen at all before this. Requests landed at pending
 * and stayed there, because the component that could have actioned them was
 * orphaned and unreachable.
 */

const INK = "#1c2440";
const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

const PAYMENT_MODES = ["UPI", "Bank transfer", "Cash", "Voucher", "Payroll"];

const inr = (n: number) =>
  `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

const when = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

type View = "review" | "pay" | "done";

const VIEWS: { key: View; label: string; statuses: RedemptionStatus[]; hint: string }[] = [
  { key: "review", label: "To review", statuses: ["pending"],
    hint: "Waiting on a decision. Approving does not pay anything out." },
  { key: "pay", label: "To pay", statuses: ["approved"],
    hint: "Approved and owed. Points are deducted when you confirm the reward was sent." },
  { key: "done", label: "Done", statuses: ["paid", "rejected", "cancelled"],
    hint: "Settled, refused and withdrawn requests." },
];

const STATUS_STYLE: Record<RedemptionStatus, { label: string; bg: string; fg: string }> = {
  pending:   { label: "Waiting",   bg: "#fbf2dd", fg: "#8a6508" },
  approved:  { label: "Approved",  bg: "#e8eefb", fg: "#2a63c8" },
  paid:      { label: "Sent",      bg: "#e4f4ec", fg: "#127a52" },
  rejected:  { label: "Rejected",  bg: "#fbeee6", fg: "#b8501d" },
  cancelled: { label: "Withdrawn", bg: "#f1f2f6", fg: "#5a6284" },
};

function StatusPill({ status }: { status: RedemptionStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide"
          style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

/**
 * `page` is the admin console. `embedded` is the rep Leaderboard, where the
 * surrounding tab already supplies a heading — and where most managers will
 * actually use this, because six of the eight managers here have no admin
 * console access at all and /gamification-admin simply redirects them away.
 */
export function RedemptionQueue({ variant = "page" }: { variant?: "page" | "embedded" } = {}) {
  const embedded = variant === "embedded";
  const [view, setView] = useState<View>("review");
  const current = VIEWS.find((v) => v.key === view)!;

  const { data: rows = [], isLoading } = useRedemptionQueue(current.statuses);
  // Counts for the other tabs, so a manager can see there is work elsewhere.
  const { data: pending = [] } = useRedemptionQueue(["pending"]);
  const { data: owed = [] } = useRedemptionQueue(["approved"]);

  const [rejecting, setRejecting] = useState<RedemptionRow | null>(null);
  const [paying, setPaying] = useState<RedemptionRow | null>(null);

  const counts = useMemo(
    () => ({ review: pending.length, pay: owed.length, done: null as number | null }),
    [pending.length, owed.length],
  );

  const decide = useDecideRedemption();
  const markPaid = useMarkRedemptionPaid();

  const owedTotal = owed.reduce((s, r) => s + r.voucher_amount, 0);

  return (
    <div style={{ color: INK }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        {!embedded && (
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
              <BadgeIndianRupee className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-tight">Redemptions</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: MUT }}>
                Approve requests, then confirm each reward once it has actually been sent
              </div>
            </div>
          </div>
        )}
        {owed.length > 0 && (
          <div className={`rounded-[12px] px-3.5 py-2 text-right ${embedded ? "ml-auto" : ""}`}
               style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUT }}>
              Approved and owed
            </div>
            <div className="text-[17px] font-extrabold tabular-nums leading-tight mt-0.5">{inr(owedTotal)}</div>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {VIEWS.map((v) => {
          const on = v.key === view;
          const n = counts[v.key];
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`text-[12.5px] font-semibold rounded-[10px] px-3.5 min-h-[38px] transition-colors ${
                on ? "text-white" : "hover:bg-[#f4f5f9]"
              }`}
              style={on
                ? { background: INK, border: `1px solid ${INK}` }
                : { border: `1px solid ${LINE}`, background: "#fff", color: SEC }}
            >
              {v.label}
              {n != null && n > 0 && (
                <span className={`ml-1.5 tabular-nums ${on ? "opacity-80" : "opacity-60"}`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[11.5px] mb-3" style={{ color: MUT }}>{current.hint}</p>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-[14px] py-12 text-center" style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
          <Clock className="h-5 w-5 mx-auto" style={{ color: MUT }} />
          <p className="text-[13.5px] font-semibold mt-2.5">
            {view === "review" ? "No requests waiting"
              : view === "pay" ? "Nothing approved and unpaid"
              : "Nothing settled yet"}
          </p>
          <p className="text-[12px] mt-1" style={{ color: MUT }}>
            {view === "pay"
              ? "Approved requests appear here until you confirm the reward was sent."
              : "Requests from the people you manage show up here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <RequestCard
              key={r.id}
              row={r}
              busy={decide.isPending || markPaid.isPending}
              onApprove={() => decide.mutate({ id: r.id, approve: true })}
              onReject={() => setRejecting(r)}
              onPay={() => setPaying(r)}
            />
          ))}
        </div>
      )}

      <RejectDialog
        row={rejecting}
        busy={decide.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) =>
          decide.mutate({ id: rejecting!.id, approve: false, reason }, {
            onSuccess: () => setRejecting(null),
          })
        }
      />

      <PayDialog
        row={paying}
        busy={markPaid.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(mode, reference, note) =>
          markPaid.mutate({ id: paying!.id, mode, reference, note }, {
            onSuccess: () => setPaying(null),
          })
        }
      />
    </div>
  );
}

function RequestCard({
  row, busy, onApprove, onReject, onPay,
}: {
  row: RedemptionRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPay: () => void;
}) {
  // The balance shown is what they hold NOW, and "available" already excludes
  // this request. Approving without it is approving blind, which is how a
  // request got raised against points a tier bug had inflated.
  const short = row.status === "pending" && row.points_redeemed > row.balance;

  return (
    <div className="rounded-[13px] p-3.5" style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-bold">{row.person}</span>
            <StatusPill status={row.status} />
          </div>
          <div className="text-[11.5px] mt-1" style={{ color: MUT }}>
            Requested {when(row.requested_at)}
            {row.status === "pending" && ` · holds ${Math.trunc(row.balance).toLocaleString("en-IN")} pts`}
            {row.approved_by_name && row.status !== "pending" &&
              ` · approved by ${row.approved_by_name} ${when(row.approved_at)}`}
            {row.paid_at && ` · sent ${when(row.paid_at)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[17px] font-extrabold tabular-nums leading-none">{inr(row.voucher_amount)}</div>
          <div className="text-[11px] mt-1" style={{ color: MUT }}>
            {Math.trunc(row.points_redeemed).toLocaleString("en-IN")} pts
          </div>
        </div>
      </div>

      {short && (
        <p className="text-[11.5px] mt-2.5 rounded-[9px] px-2.5 py-2" style={{ background: "#fbeee6", color: "#b8501d" }}>
          They hold fewer points than they asked for. Approving will be refused.
        </p>
      )}

      {(row.payment_reference || row.rejection_reason) && (
        <p className="text-[11.5px] mt-2.5 rounded-[9px] px-2.5 py-2"
           style={{ background: "#f6f7fb", color: SEC }}>
          {row.rejection_reason
            ? row.rejection_reason
            : `${row.payment_mode ?? "Paid"} · ${row.payment_reference}${row.paid_by_name ? ` · by ${row.paid_by_name}` : ""}`}
        </p>
      )}

      {row.status === "pending" && (
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <Button size="sm" className="h-9 text-[12.5px] font-semibold"
                  disabled={busy || !row.my_turn} onClick={onApprove}>
            <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[12.5px] font-semibold"
                  disabled={busy || !row.my_turn} onClick={onReject}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Reject
          </Button>
          {/* Naming who it is with beats a disabled button and no explanation.
              A manager still sees their team's requests when the configured
              route sent them elsewhere, and "waiting on an earlier approver"
              would be untrue in that case — nobody earlier is involved. */}
          {!row.my_turn && (
            <span className="text-[11px]" style={{ color: MUT }}>
              {row.routed_to ? `With ${row.routed_to}` : "Not routed to you"}
            </span>
          )}
        </div>
      )}

      {row.status === "approved" && (
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <Button size="sm" className="h-9 text-[12.5px] font-semibold" disabled={busy} onClick={onPay}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Confirm reward sent
          </Button>
          <span className="text-[11px]" style={{ color: MUT }}>Deducts the points</span>
        </div>
      )}
    </div>
  );
}

function RejectDialog({
  row, busy, onClose, onConfirm,
}: {
  row: RedemptionRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) { setReason(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] text-left">Reject this request</DialogTitle>
          <DialogDescription className="text-[12.5px] text-left">
            {row ? `${row.person} · ${inr(row.voucher_amount)}. ` : ""}
            The reason is the only thing they will see, so write it for them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rejectReason" className="text-[12px]">Reason</Label>
          <Textarea
            id="rejectReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="text-[13px]"
            placeholder="e.g. Raised against points that are being corrected — please re-request."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setReason(""); onClose(); }}>Cancel</Button>
          <Button
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({
  row, busy, onClose, onConfirm,
}: {
  row: RedemptionRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (mode: string, reference: string, note: string) => void;
}) {
  const [mode, setMode] = useState(PAYMENT_MODES[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const reset = () => { setMode(PAYMENT_MODES[0]); setReference(""); setNote(""); };

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] text-left">Confirm the reward was sent</DialogTitle>
          <DialogDescription className="text-[12.5px] text-left">
            {row ? `${row.person} · ${inr(row.voucher_amount)} · ${Math.trunc(row.points_redeemed).toLocaleString("en-IN")} pts. ` : ""}
            Only confirm once the money has actually gone out — this deducts their points.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="payMode" className="text-[12px]">How it was paid</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="payMode" className="text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m} className="text-[13px]">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payRef" className="text-[12px]">Reference</Label>
            <Input
              id="payRef"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="text-[13px]"
              placeholder="UTR, voucher code or payroll run"
            />
            <p className="text-[11px]" style={{ color: MUT }}>
              What you would point them at if they ask where the money went.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payNote" className="text-[12px]">Note (optional)</Label>
            <Input
              id="payNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-[13px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button disabled={busy || !reference.trim()} onClick={() => onConfirm(mode, reference.trim(), note.trim())}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Confirm sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
