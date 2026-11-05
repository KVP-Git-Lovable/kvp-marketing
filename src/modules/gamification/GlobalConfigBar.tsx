import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Zap } from "lucide-react";
import { LEADERBOARD_TABS, type PolicyDraft } from "./policyDraft";

const INK = "#1c2440";
const MUT = "#9aa1b5";
const LINE = "#e7e9f0";

/**
 * Global configuration, as a section of the Policy tab.
 *
 * It used to own its own state and its own "Edit" — which only expanded the
 * panel; the fields underneath wrote straight to the database on blur. The tab
 * now has one Edit button and one Save, so this renders from the shared draft
 * and reports changes back rather than saving anything itself.
 */
export function GlobalConfigBar({
  draft, set, readOnly,
}: {
  draft: PolicyDraft;
  set: <K extends keyof PolicyDraft>(k: K, v: PolicyDraft[K]) => void;
  readOnly: boolean;
}) {
  return (
    <div className="bg-white rounded-[14px] overflow-hidden"
         style={{ border: `1px solid ${LINE}`, boxShadow: "0 4px 18px -14px rgba(20,18,10,.4)" }}>
      <div className="flex items-center gap-3.5 px-4 py-3.5" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
             style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
          <Zap className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: INK }}>Global configuration</div>
          <div className="text-[11px] mt-0.5" style={{ color: MUT }}>Applies to every game</div>
        </div>
      </div>

      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: LINE }}>
        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Gamification engine</div>
          <Select value={draft.engine_enabled ? "on" : "off"} disabled={readOnly}
                  onValueChange={(v) => set("engine_enabled", v === "on")}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on">Enabled</SelectItem>
              <SelectItem value="off">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Point currency name</div>
          <Input className="h-8 text-[13px]" disabled={readOnly}
                 value={draft.currency_name}
                 onChange={(e) => set("currency_name", e.target.value)} />
        </div>

        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Point → rupee</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px]">1 pt =</span>
            <Input className="h-8 w-16 text-[13px]" type="number" disabled={readOnly}
                   value={draft.point_conversion}
                   onChange={(e) => set("point_conversion", Number(e.target.value))} />
            <span className="text-[12.5px]">₹</span>
          </div>
        </div>

        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Default award mode</div>
          <Select value={draft.default_award_mode} disabled={readOnly}
                  onValueChange={(v) => set("default_award_mode", v)}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="approval">Manager approval</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white px-3.5 py-3 flex items-center justify-between">
          <div className="text-[10.5px] uppercase tracking-wider" style={{ color: MUT }}>Notifications</div>
          <Switch checked={draft.notifications_enabled} disabled={readOnly}
                  aria-label="Gamification notifications"
                  onCheckedChange={(v) => set("notifications_enabled", v)} />
        </div>

        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Approval fallback</div>
          <Select value={draft.approval_fallback} disabled={readOnly}
                  onValueChange={(v) => set("approval_fallback", v)}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>Default timezone</div>
          <Input className="h-8 text-[13px]" disabled={readOnly}
                 value={draft.timezone}
                 onChange={(e) => set("timezone", e.target.value)} />
        </div>
      </div>

      <div className="px-3.5 py-3.5" style={{ borderTop: `1px solid ${LINE}` }}>
        <div className="text-[10.5px] uppercase tracking-wider" style={{ color: MUT }}>
          Leaderboard tabs
        </div>
        <div className="text-[11px] mt-0.5 mb-2.5" style={{ color: MUT }}>
          Switch a tab off and it disappears from the rep&apos;s Rewards screen. Hiding
          Redemptions also hides the Redeem action, so points can&apos;t be redeemed from a
          tab that isn&apos;t there — approvers keep their own Redemptions tab either way.
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEADERBOARD_TABS.map((t) => {
            const key = t.field as keyof PolicyDraft;
            return (
              <div
                key={t.field}
                className="flex items-center justify-between rounded-[10px] px-3 py-2"
                style={{ border: `1px solid ${LINE}` }}
              >
                <span className="text-[12.5px]" style={{ color: INK }}>{t.label}</span>
                {/* A tab strip with nothing in it is a broken screen, but the
                    rule is enforced on Save rather than by refusing the click,
                    so you can switch one off and another on in either order. */}
                <Switch
                  checked={draft[key] === true}
                  disabled={readOnly}
                  aria-label={`Show the ${t.label} tab`}
                  onCheckedChange={(v) => set(key, v as PolicyDraft[typeof key])}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
