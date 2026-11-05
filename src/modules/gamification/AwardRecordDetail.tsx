import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Store, ReceiptText, Trophy, UserRound } from "lucide-react";
import { categoryMeta } from "./constants";
import type { AwardRecord } from "./hooks";

const MUT = "#9aa1b5";
const SEC = "#5a6284";
const LINE = "#e7e9f0";

const nfInr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Negatives read "-₹1,425", never "₹-1,425" — corrections are ordinary rows here. */
const inr = (n: number) => `${n < 0 ? "-" : ""}₹${nfInr.format(Math.abs(n))}`;
const fmtWhen = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * The bottom of the drill-down: one award, and everything it is attached to.
 *
 * The same component serves the Overview's stack and a Points-ledger row,
 * because "what is this award" has one answer wherever it is asked from.
 *
 * Nothing here is editable. An admin changing a rep's points is a different
 * action with different consequences, and it does not belong behind a chart.
 */
export function AwardRecordDetail({
  record, rate, onClose, onOpenGame, onOpenPerson,
}: {
  record: AwardRecord;
  /** Rupees per point for the game this award belongs to. */
  rate: number;
  onClose?: () => void;
  onOpenGame?: (gameId: string) => void;
  onOpenPerson?: (userId: string) => void;
}) {
  const navigate = useNavigate();
  const cat = categoryMeta(record.category ?? undefined);
  const correction = record.points < 0;

  const facts: [string, string][] = [
    ["Points", `${record.points > 0 ? "+" : ""}${record.points.toLocaleString("en-IN")}`],
    ["Value", inr(record.points * rate)],
    ["Person", record.person],
    ["Game", record.program ?? "Not linked to a game"],
    ["Activity", record.activity ?? "—"],
    ["Earned", fmtWhen(record.earned_at)],
  ];
  if (record.beat_name) facts.push(["Beat", record.beat_name]);
  if (record.achievement_pct != null) facts.push(["Achieved", `${record.achievement_pct}%`]);
  if (record.tier_pct != null) facts.push(["Tier reached", `${record.tier_pct}%`]);
  if (record.period_key) facts.push(["Period", record.period_key]);
  if (record.order_value != null) facts.push(["Order value", inr(record.order_value)]);
  if (record.order_status) facts.push(["Order status", record.order_status]);
  if (record.reference_type) facts.push(["Source", String(record.reference_type).replace(/_/g, " ")]);
  if (record.status && record.status !== "active") facts.push(["Status", record.status]);
  if (record.expires_at) facts.push(["Expires", fmtWhen(record.expires_at)]);

  /**
   * Where this award actually lives — decided on the ids, never on
   * order_value. A Productive visit carries an order value in its metadata but
   * is attached to a RETAILER, so choosing by value would offer "Open order"
   * on awards that have no order to open.
   */
  const go = (to: string) => { onClose?.(); navigate(to); };
  const related: { key: string; label: string; icon: typeof Store; onClick: () => void }[] = [];
  if (record.retailer_id) {
    related.push({
      key: "retailer", label: record.retailer_name ?? "Retailer", icon: Store,
      onClick: () => go(`/retailer/${record.retailer_id}`),
    });
  }
  if (record.order_id) {
    related.push({
      key: "order",
      label: record.order_value != null ? `Order · ${inr(record.order_value)}` : "Order",
      icon: ReceiptText,
      onClick: () =>
        go(
          `/order-entry?editOrderId=${encodeURIComponent(record.order_id!)}` +
          (record.retailer_id ? `&retailerId=${encodeURIComponent(record.retailer_id)}` : "") +
          (record.retailer_name ? `&retailer=${encodeURIComponent(record.retailer_name)}` : "")
        ),
    });
  }
  if (record.game_id && onOpenGame) {
    related.push({
      key: "game", label: record.program ?? "Game", icon: Trophy,
      onClick: () => onOpenGame(record.game_id!),
    });
  }
  if (record.user_id && onOpenPerson) {
    related.push({
      key: "person", label: record.person, icon: UserRound,
      onClick: () => onOpenPerson(record.user_id!),
    });
  }

  /**
   * Why there is nothing to open — said plainly, rather than left blank.
   *
   * Redaction is tested FIRST, and comes from the server rather than being
   * inferred here. A withheld order is indistinguishable from an absent one
   * on the client: these rows keep their period_key, so the period sentence
   * below used to tell a peer that a real order did not exist. Not being
   * allowed to see something is not the same as there being nothing to see.
   */
  const noLink =
    record.retailer_id || record.order_id
      ? null
      : record.redacted
        ? "The shop and order behind this award are hidden for this person."
        : record.tier_pct != null || record.period_key
          ? "Settles against a period, so there is no shop or order behind it."
          : record.user_id
            ? "Nothing further is attached to this award."
            : null;

  return (
    <div className="px-1">
      <div className="flex items-start gap-3 pb-3">
        <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0"
             style={{ background: cat.fill, color: cat.ac }}>
          <Trophy className="h-[15px] w-[15px]" />
        </div>
        <div className="min-w-0">
          <div className="text-[24px] font-extrabold leading-none tracking-tight tabular-nums"
               style={{ color: correction ? "#b8501d" : "#178a5a" }}>
            {record.points > 0 ? "+" : ""}{record.points.toLocaleString("en-IN")}
          </div>
          <div className="text-[11.5px] mt-1" style={{ color: SEC }}>
            {correction ? "Correction" : record.activity ?? "Award"}
            {record.retailer_name ? ` · ${record.retailer_name}` : ""}
          </div>
        </div>
      </div>

      <dl className="text-[12.5px]" style={{ borderTop: `1px solid ${LINE}` }}>
        {facts.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-3 py-2" style={{ borderBottom: `1px solid #f2f3f7` }}>
            <dt className="w-[108px] shrink-0 text-[10px] uppercase tracking-[0.1em]" style={{ color: MUT }}>{k}</dt>
            <dd className="font-semibold break-words tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {related.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {related.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={r.onClick}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors hover:bg-[#eef1f7]"
              style={{ border: `1px solid ${LINE}`, color: SEC }}
            >
              <r.icon className="h-3.5 w-3.5" />
              <span className="max-w-[170px] truncate">{r.label}</span>
              <ChevronRight className="h-3.5 w-3.5" style={{ color: MUT }} />
            </button>
          ))}
        </div>
      )}

      {noLink && <p className="pt-3 text-[11.5px]" style={{ color: MUT }}>{noLink}</p>}
    </div>
  );
}

/** The same panel, fetched by id — for callers that hold only an award id. */
export function AwardRecordDetailById({
  record, isLoading, error, rate, onClose, onOpenGame, onOpenPerson,
}: {
  record: AwardRecord | null | undefined;
  isLoading: boolean;
  error: unknown;
  rate: number;
  onClose?: () => void;
  onOpenGame?: (gameId: string) => void;
  onOpenPerson?: (userId: string) => void;
}) {
  if (isLoading) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: MUT }} /></div>;
  }
  if (error || !record) {
    return (
      <div className="py-8 text-center text-[12.5px]" style={{ color: MUT }}>
        This award could not be loaded.
      </div>
    );
  }
  return (
    <AwardRecordDetail
      record={record}
      rate={rate}
      onClose={onClose}
      onOpenGame={onOpenGame}
      onOpenPerson={onOpenPerson}
    />
  );
}
