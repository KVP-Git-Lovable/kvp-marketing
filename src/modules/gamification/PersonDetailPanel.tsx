import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EyeOff } from "lucide-react";
import {
  useCanViewDetail, usePersonActivity, usePersonDetail, usePersonProfile,
} from "./hooks";
import { PersonCompare } from "./PersonCompare";
import { PointsCharts } from "./PointsCharts";

interface PersonDetailPanelProps {
  /** Drives the gated per-award fetch; the panel only mounts when a row is open. */
  open: boolean;
  userId?: string;
  fullName?: string;
  rank?: number;
  points?: number;
  from?: Date;
  to?: Date;
  /** The signed-in user, so the panel can tell "you" from everyone else. */
  viewerId?: string;
  /** points → currency, from gamification_settings */
  conversionRate: number;
  currencyName: string;
  periodLabel: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Person 360, rendered inline under the row it belongs to rather than in a
 * modal — a leaderboard is read by comparing, and a dialog hides the board you
 * are comparing against.
 *
 * Every row on the board opens this, and it is read-only. The drill-down is
 * the same for everyone; what differs is how much of a record the server hands
 * back. For your own board, and for anyone reporting to you, an award carries
 * the shop, the beat and what the order was worth. For a peer those come back
 * null, so the same charts render without naming that person's customers.
 * gam_person_detail decides it — this only says so on screen.
 */
export function PersonDetailPanel({
  open, userId, fullName, rank, points, viewerId,
  from, to, conversionRate, currencyName, periodLabel,
}: PersonDetailPanelProps) {
  const isSelf = !!userId && userId === viewerId;
  const { data: canViewDetail = false, isLoading: loadingPerm } = useCanViewDetail(userId);
  const { data: awards = [], isLoading: loadingAwards } = usePersonDetail(userId, from, to, open);

  // Aggregates, so they load for anyone on the board.
  const { data: theirProfile } = usePersonProfile(userId, from, to);
  const { data: myProfile } = usePersonProfile(viewerId, from, to);
  const { data: theirActivity = [] } = usePersonActivity(userId, from, to);
  const { data: myActivity = [] } = usePersonActivity(viewerId, from, to);

  const total = theirProfile?.points ?? 0;

  return (
    <div className="rounded-[14px] border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="font-bold">{fullName?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold truncate">{fullName}</div>
          <div className="text-[11px] text-muted-foreground">
            {rank ? `Rank #${rank} · ` : ""}{periodLabel}
          </div>
        </div>
      </div>

        {/* headline numbers */}
        <div className="flex flex-wrap gap-5 pb-1">
          <div>
            <p className="text-2xl font-extrabold tabular-nums leading-none text-amber-500">
              {(points ?? total).toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
              {currencyName}
            </p>
          </div>
          <div>
            <p className="text-2xl font-extrabold tabular-nums leading-none">
              {inr(Math.round((points ?? total) * conversionRate))}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">Value</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold tabular-nums leading-none">{theirProfile?.programs ?? 0}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">Games</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold tabular-nums leading-none">{theirProfile?.days ?? 0}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
              {theirProfile?.days === 1 ? "Day" : "Days"} earning
            </p>
          </div>
        </div>

        {/* You against them. The board says who is ahead; this says what they
            are doing differently, which is the part anyone can act on. */}
        {!isSelf && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2.5">
              Against you
            </p>
            <PersonCompare
              theirName={fullName ?? "They"}
              mine={myProfile}
              theirs={theirProfile}
              mineByActivity={myActivity}
              theirsByActivity={theirActivity}
            />
          </div>
        )}

        {/* the same cross-filtering breakdown the tab used to show for the
            viewer only — it is per-award data, so it is gated the same way */}
        <div className="mt-4 pt-4 border-t">
          <PointsCharts
            awards={awards}
            loading={loadingAwards}
            conversionRate={conversionRate}
            currencyName={currencyName}
            periodLabel={periodLabel}
          />
        </div>

        {/* The records above are real either way; for a peer the columns that
            name this person's customers come back empty. Saying so beats a
            reader assuming the data is missing. */}
        {!loadingPerm && !canViewDetail && !isSelf && (
          <div className="mt-3 flex gap-2.5 rounded-[10px] bg-muted/60 p-3">
            <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-[12.5px] text-muted-foreground">
              The retailer, the beat and the order value behind each award are shown only on your own
              record and on people who report to you. Everything else here — points, activity, tier,
              date and every total — is the same for everyone.
            </p>
          </div>
        )}
    </div>
  );
}