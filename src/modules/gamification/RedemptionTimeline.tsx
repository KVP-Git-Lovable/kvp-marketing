import { Check } from "lucide-react";

/** Structural on purpose: both the rep's page and the admin queue hold rows of
 *  this shape, and neither should have to cast to render a timeline. */
export interface RedemptionProgress {
  status: string;
  points_redeemed: number;
  requested_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
}

/**
 * Where a rep's request has actually got to.
 *
 * A single status chip could not say the one thing that matters most here:
 * approved is NOT paid. The chip read "Approved" while no money had moved and
 * no points had been deducted, so the timeline spells out all three steps and
 * names the person behind each decision.
 */

const when = (v?: string | null) =>
  v
    ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

type Step = { title: string; sub: string; done: boolean; current: boolean };

export function RedemptionTimeline({ row }: { row: RedemptionProgress }) {
  // Rejected and withdrawn requests stop rather than continue, so they get the
  // two steps that really happened instead of a greyed-out "Reward sent" that
  // never will.
  const stopped = row.status === "rejected" || row.status === "cancelled";

  const steps: Step[] = [
    {
      title: "Requested",
      sub: [when(row.requested_at), `${Math.trunc(row.points_redeemed).toLocaleString("en-IN")} pts held`]
        .filter(Boolean).join(" · "),
      done: true,
      current: row.status === "pending",
    },
  ];

  if (stopped) {
    steps.push({
      title: row.status === "rejected" ? "Rejected" : "Withdrawn",
      sub: row.status === "rejected"
        ? "Your points were released"
        : "You withdrew this — your points are available again",
      done: true,
      current: true,
    });
  } else {
    steps.push({
      title: row.approved_by_name ? `Approved by ${row.approved_by_name}` : "Approved",
      sub: row.approved_at
        ? `${when(row.approved_at)} · payment being arranged`
        : "Waiting for your manager",
      done: !!row.approved_at,
      current: row.status === "approved",
    });
    steps.push({
      title: "Reward sent",
      sub: row.paid_at
        ? [when(row.paid_at), row.payment_mode, row.payment_reference].filter(Boolean).join(" · ")
        : "Not yet — your points stay held until it is",
      done: !!row.paid_at,
      current: row.status === "paid",
    });
  }

  return (
    <ol className="mt-4 space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className="grid grid-cols-[18px_1fr] gap-3 relative pb-3.5 last:pb-0">
            {!last && (
              <span className="absolute left-[8px] top-[18px] bottom-0 w-[2px] bg-border" aria-hidden="true" />
            )}
            <span
              className={`h-[18px] w-[18px] rounded-full border-2 grid place-items-center z-[1] ${
                s.done
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : s.current
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
              }`}
            >
              {s.done && <Check className="h-[10px] w-[10px]" strokeWidth={3.5} />}
            </span>
            <div className="min-w-0 -mt-0.5">
              <p className={`text-[12.5px] ${s.done || s.current ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                {s.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
