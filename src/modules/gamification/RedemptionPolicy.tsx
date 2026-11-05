import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Coins, CalendarClock, Check, ChevronDown, Loader2, Pencil, ShieldCheck, Info, X,
} from "lucide-react";
import {
  useGamSettings, useRedemptionApprovalPolicy, useSaveRedemptionConfig,
  useApproverChoices, useApproverRoles, useResetPreview,
  APPROVAL_MODES, type ApprovalMode,
} from "./hooks";
import { GlobalConfigBar } from "./GlobalConfigBar";
import { policyDraftFrom, policyProblem, type PolicyDraft } from "./policyDraft";

const INK = "#1c2440";
const MUT = "#9aa1b5";
const LINE = "#e7e9f0";

/** Blank input -> null (means "no limit"), not 0 (which would mean "block everything"). */
const orNull = (v: string) => (v.trim() === "" ? null : Number(v));

const CADENCES = [
  { value: "never",          label: "Never — points don't lapse" },
  { value: "monthly",        label: "Every month" },
  { value: "quarterly",      label: "Every quarter (Jan / Apr / Jul / Oct)" },
  { value: "half_yearly",    label: "Every six months" },
  { value: "annual",         label: "Every calendar year" },
  { value: "financial_year", label: "Every financial year (Apr – Mar)" },
];

function Section({
  icon: Icon, title, blurb, tint, children,
}: {
  icon: any; title: string; blurb: string; tint: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[14px] overflow-hidden"
         style={{ border: `1px solid ${LINE}`, boxShadow: "0 4px 18px -14px rgba(20,18,10,.4)" }}>
      <div className="flex items-center gap-3.5 px-4 py-3.5" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
             style={{ background: tint }}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: INK }}>{title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: MUT }}>{blurb}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Pick several of something, by name.
 *
 * Used for the routes, the people and the roles. The search is a plain
 * substring rather than cmdk's default fuzzy scorer, which offers matches
 * nobody typed — searching "shra" otherwise suggests "Akshat Prabhu", and a
 * picker that argues with you reads as broken.
 */
function MultiPicker({
  options, selected, onChange, placeholder, empty, disabled,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  empty: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(options.map((o) => [o.id, o.label]));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-1.5">
      <Popover open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" disabled={disabled}
                  className="h-8 w-full justify-between text-[13px] font-normal">
            {selected.length === 0 ? placeholder : `${selected.length} selected`}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(320px,calc(100vw-40px))] p-0">
          <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder="Search…" className="text-[13px]" />
            <CommandList>
              <CommandEmpty className="py-6 text-center text-[12.5px]" style={{ color: MUT }}>
                {empty}
              </CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.id} value={o.label} onSelect={() => toggle(o.id)}
                               className="gap-2 text-[13px] min-h-[36px]">
                    <span className="flex-1 truncate">{o.label}</span>
                    {selected.includes(o.id) && <Check className="h-3.5 w-3.5 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[10.5px] font-medium">
              {byId.get(id) ?? "Unknown"}
              {!disabled && (
                <button type="button" onClick={() => toggle(id)}
                        aria-label={`Remove ${byId.get(id) ?? "item"}`}
                        className="rounded-full p-0.5 hover:bg-foreground/10">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-3.5 py-3">
      <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: MUT }}>{label}</div>
      {children}
      {hint && <div className="text-[11px] mt-1.5 leading-snug" style={{ color: MUT }}>{hint}</div>}
    </div>
  );
}

/**
 * The whole Policy & Configuration tab: global settings, redemption rules,
 * period close and the approval route, under ONE Edit button.
 *
 * View first, edit deliberately. Every control used to write straight to the
 * database on blur or toggle, so changing your mind meant changing it back, and
 * a stray click on a Switch was already live policy. The tab now edits a single
 * draft and commits all four sections on Save.
 *
 * Global configuration had an "Edit" of its own that only expanded the panel —
 * the fields inside saved themselves regardless — which made the page look like
 * it had two editing models when it had none.
 *
 * Every rule here is enforced in the database (gam_redeem_request), never only
 * in this form — the rep's app, an offline sync and a direct API call all hit
 * the same gates.
 */
export function RedemptionPolicy() {
  const { data: settings } = useGamSettings();
  const { data: approval } = useRedemptionApprovalPolicy();
  const { data: people = [] } = useApproverChoices();
  const { data: roles = [] } = useApproverRoles();
  const { data: preview } = useResetPreview();
  const save = useSaveRedemptionConfig();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);

  // Reseed from the server whenever we are NOT editing, so a save by somebody
  // else shows up — and an in-flight edit is never overwritten underneath.
  useEffect(() => {
    if (!editing && settings) setDraft(policyDraftFrom(settings, approval));
  }, [editing, settings, approval]);

  if (!settings || !draft) return null;

  const set = <K extends keyof PolicyDraft>(k: K, v: PolicyDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const unit = settings.currency_name || "points";
  const resets = draft.reset_cadence !== "never";
  const modes = draft.approval_modes;
  const ro = !editing;

  // Only a lone manager route is a ladder with levels at all. Mixed with
  // anything else, everyone sits on one level as alternatives.
  const isLadder = modes.length === 1 && modes[0] === "manager";

  /** One phrase per selected route, so the summary describes the whole union. */
  const routeParts: string[] = [];
  if (modes.includes("admin")) routeParts.push("every system admin");
  if (modes.includes("manager")) {
    routeParts.push(draft.max_levels > 1
      ? `the rep's first ${draft.max_levels} managers`
      : "the rep's manager");
  }
  if (modes.includes("users")) {
    const n = draft.approver_user_ids.length;
    routeParts.push(n ? `${n} named ${n === 1 ? "person" : "people"}` : "named people (none picked yet)");
  }
  if (modes.includes("roles")) {
    const n = draft.approver_role_ids.length;
    routeParts.push(n ? `anyone holding ${n} selected ${n === 1 ? "role" : "roles"}` : "a role (none picked yet)");
  }
  if (modes.includes("specific")) routeParts.push("one named person");

  const onSave = () => {
    const bad = policyProblem(draft, !!approval);
    if (bad) { toast.error(bad); return; }
    save.mutate(
      {
        settingsId: settings.id,
        settings: {
          engine_enabled: draft.engine_enabled,
          currency_name: draft.currency_name.trim(),
          point_conversion: draft.point_conversion,
          default_award_mode: draft.default_award_mode,
          notifications_enabled: draft.notifications_enabled,
          approval_fallback: draft.approval_fallback,
          timezone: draft.timezone.trim(),
          tab_games_enabled: draft.tab_games_enabled,
          tab_badges_enabled: draft.tab_badges_enabled,
          leaderboard_enabled: draft.leaderboard_enabled,
          tab_redemptions_enabled: draft.tab_redemptions_enabled,
          redeem_min_points: draft.redeem_min_points,
          redeem_multiple_of: draft.redeem_multiple_of,
          redeem_max_per_request: draft.redeem_max_per_request,
          redeem_cooldown_days: draft.redeem_cooldown_days,
          redeem_requires_approval: draft.redeem_requires_approval,
          reset_cadence: draft.reset_cadence,
          reset_mode: draft.reset_mode,
          reset_grace_days: draft.reset_grace_days,
          reset_lifetime_visible: draft.reset_lifetime_visible,
        },
        approvalId: approval?.id,
        approval: approval
          ? {
              approval_modes: modes,
              // Kept in step for anything still reading the singular column.
              approval_mode: modes[0] ?? "admin",
              approver_user_ids: modes.includes("users") ? draft.approver_user_ids : [],
              approver_role_ids: modes.includes("roles") ? draft.approver_role_ids : [],
              specific_approver_id: modes.includes("specific") ? draft.specific_approver_id : null,
              max_levels: draft.max_levels,
            }
          : undefined,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const onCancel = () => {
    setDraft(policyDraftFrom(settings, approval));
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-[14px] px-4 py-3"
           style={{ border: `1px solid ${LINE}`, boxShadow: "0 4px 18px -14px rgba(20,18,10,.4)" }}>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: INK }}>Policy &amp; configuration</div>
          <div className="text-[11px] mt-0.5" style={{ color: MUT }}>
            {editing
              ? "Everything on this tab is editable. Nothing is saved until you press Save."
              : "Viewing the live configuration. Press Edit to change anything on this tab."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" className="h-8 text-[12.5px]"
                      disabled={save.isPending} onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-[12.5px]" disabled={save.isPending} onClick={onSave}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-[12.5px] gap-1.5"
                    onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      <GlobalConfigBar draft={draft} set={set} readOnly={ro} />

      {/* ---------------------------------------------------------- */}
      <Section
        icon={Coins}
        tint="linear-gradient(135deg,#f59e0b,#d97706)"
        title="Redemption rules"
        blurb={`What a rep has to satisfy before ${unit.toLowerCase()} can be claimed`}
      >
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: LINE }}>
          <Field
            label="Minimum balance to redeem"
            hint={draft.redeem_min_points > 0
              ? `Redeem is refused below ${draft.redeem_min_points} ${unit.toLowerCase()}.`
              : "No minimum — any amount can be claimed."}
          >
            <Input
              className="h-8 text-[13px]" type="number" min={0} disabled={ro}
              value={draft.redeem_min_points}
              onChange={(e) => set("redeem_min_points", Number(e.target.value || 0))}
            />
          </Field>

          <Field label="Redeem in multiples of" hint="Leave blank to allow any amount.">
            <Input
              className="h-8 text-[13px]" type="number" min={0} disabled={ro}
              value={draft.redeem_multiple_of ?? ""}
              placeholder="any"
              onChange={(e) => set("redeem_multiple_of", orNull(e.target.value))}
            />
          </Field>

          <Field label="Most per request" hint="Leave blank for no ceiling.">
            <Input
              className="h-8 text-[13px]" type="number" min={0} disabled={ro}
              value={draft.redeem_max_per_request ?? ""}
              placeholder="no limit"
              onChange={(e) => set("redeem_max_per_request", orNull(e.target.value))}
            />
          </Field>

          <Field label="Wait between requests" hint="Days a rep must wait before asking again. 0 = no wait.">
            <Input
              className="h-8 text-[13px]" type="number" min={0} disabled={ro}
              value={draft.redeem_cooldown_days}
              onChange={(e) => set("redeem_cooldown_days", Number(e.target.value || 0))}
            />
          </Field>

          <div className="bg-white px-3.5 py-3 flex items-center justify-between sm:col-span-2">
            <div className="pr-3">
              <div className="text-[10.5px] uppercase tracking-wider" style={{ color: MUT }}>
                Needs approval
              </div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: MUT }}>
                {draft.redeem_requires_approval
                  ? "Requests are held and the points are locked until someone approves."
                  : "Requests settle instantly. Points are deducted with no review."}
              </div>
            </div>
            <Switch
              checked={draft.redeem_requires_approval}
              disabled={ro}
              aria-label="Redemptions need approval"
              onCheckedChange={(v) => set("redeem_requires_approval", v)}
            />
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        icon={CalendarClock}
        tint="linear-gradient(135deg,#6366f1,#4f46e5)"
        title="Points reset & history"
        blurb="When the balance closes, and what is kept afterwards"
      >
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: LINE }}>
          <Field label="Reset cycle">
            <Select value={draft.reset_cadence} disabled={ro}
                    onValueChange={(v) => set("reset_cadence", v as PolicyDraft["reset_cadence"])}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CADENCES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="At the end of a cycle">
            <Select
              value={draft.reset_mode}
              onValueChange={(v) => set("reset_mode", v as PolicyDraft["reset_mode"])}
              disabled={ro || !resets}
            >
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expire">Unused points lapse</SelectItem>
                <SelectItem value="carry_forward">Carry the balance forward</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Grace period (days)" hint="Extra days to claim after the cycle ends.">
            <Input
              className="h-8 text-[13px]" type="number" min={0} disabled={ro || !resets}
              value={draft.reset_grace_days}
              onChange={(e) => set("reset_grace_days", Number(e.target.value || 0))}
            />
          </Field>

          <div className="bg-white px-3.5 py-3 flex items-center justify-between">
            <div className="pr-3">
              <div className="text-[10.5px] uppercase tracking-wider" style={{ color: MUT }}>
                Show lifetime total
              </div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: MUT }}>
                Keeps the rep&apos;s all-time earned figure on screen after a reset.
              </div>
            </div>
            <Switch
              checked={draft.reset_lifetime_visible}
              disabled={ro}
              aria-label="Show the lifetime earned total"
              onCheckedChange={(v) => set("reset_lifetime_visible", v)}
            />
          </div>
        </div>

        <div className="px-3.5 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-[2px] shrink-0" style={{ color: MUT }} />
            <div className="text-[11.5px] leading-relaxed" style={{ color: MUT }}>
              Every closed cycle is archived per person — opening balance, earned, redeemed,
              lapsed, closing balance and the running lifetime total — so a reset never loses
              the record. <span style={{ color: INK }}>Total earned is always kept</span>, whichever
              options are set above.
              {settings.last_reset_period && (
                <> Last cycle closed: <span style={{ color: INK }}>{settings.last_reset_period}</span>.</>
              )}
              {/* The preview describes what is SAVED, so while editing it would
                  be answering a question about the old settings. */}
              {!editing && preview?.note && (
                <> Next close{preview.period_key ? ` (${preview.period_key})` : ""}: {preview.note}
                  {Number(preview.points_expired) > 0 && (
                    <> — <span style={{ color: INK }}>
                      {Number(preview.points_expired).toLocaleString("en-IN")} {unit.toLowerCase()} would lapse
                    </span></>
                  )}.
                </>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        icon={ShieldCheck}
        tint="linear-gradient(135deg,#22c55e,#16a34a)"
        title="Approval workflow"
        blurb="Who signs off a redemption, and in what order"
      >
        {!approval ? (
          <div className="px-3.5 py-4 text-[12.5px]" style={{ color: MUT }}>
            No approval policy row exists yet for redemptions.
          </div>
        ) : (
          <>
            <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: LINE }}>
              <Field
                label="Approval process *"
                hint={modes.length === 0
                  ? "Pick at least one — with none, a request has nobody to go to and is refused."
                  : modes.length === 1
                    ? APPROVAL_MODES.find((m) => m.value === modes[0])?.hint
                    : "Everyone these resolve to can approve, and the first response decides."}
              >
                <MultiPicker
                  options={APPROVAL_MODES.map((m) => ({ id: m.value, label: m.label }))}
                  selected={modes}
                  disabled={ro}
                  onChange={(ids) => set("approval_modes", ids as ApprovalMode[])}
                  placeholder="Select approval process"
                  empty="No such option."
                />
              </Field>

              {modes.includes("users") && (
                <Field label="Users *" hint="Any one of them can approve.">
                  <MultiPicker
                    options={people.map((p) => ({
                      id: p.id, label: p.full_name || p.username || "Unnamed",
                    }))}
                    selected={draft.approver_user_ids}
                    disabled={ro}
                    onChange={(ids) => set("approver_user_ids", ids)}
                    placeholder="Search & select users"
                    empty="Nobody matches that."
                  />
                </Field>
              )}

              {modes.includes("roles") && (
                <Field label="Roles *" hint="Everyone holding one of these can approve.">
                  <MultiPicker
                    options={roles.map((r) => ({ id: r.id, label: r.name }))}
                    selected={draft.approver_role_ids}
                    disabled={ro}
                    onChange={(ids) => set("approver_role_ids", ids)}
                    placeholder="Search & select roles"
                    empty="No roles match that."
                  />
                </Field>
              )}

              {modes.includes("specific") && (
                <Field label="Approver *" hint="Every redemption goes to this person.">
                  <Select
                    value={draft.specific_approver_id ?? ""}
                    disabled={ro}
                    onValueChange={(v) => set("specific_approver_id", v)}
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Choose a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.username || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {modes.includes("manager") && (
                <Field
                  label="How many levels"
                  hint="How far up the reporting line the request travels."
                >
                  <Input
                    className="h-8 text-[13px]" type="number" min={1} max={10} disabled={ro}
                    value={draft.max_levels}
                    onChange={(e) => set("max_levels", Number(e.target.value || 1))}
                  />
                </Field>
              )}
            </div>

            <div className="px-3.5 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-[2px] shrink-0" style={{ color: MUT }} />
                <div className="text-[11.5px] leading-relaxed" style={{ color: MUT }}>
                  {/* Describes the UNION, not just the first mode ticked — the
                      routes combine, so a sentence about one of them would be
                      true and still misleading. */}
                  {modes.length === 0 ? (
                    <>No route is selected, so a request has nobody to go to and will be
                      refused when a rep tries to redeem.</>
                  ) : isLadder ? (
                    <>Everyone in the first {draft.max_levels} level(s) of the reporting line
                      can see the request, and whoever acts first settles it.</>
                  ) : (
                    <>Requests go to {routeParts.join("; ")}. They all see it in their own
                      Redemptions tab — no admin console access needed — and whoever acts first
                      settles it. Nobody is ever sent their own request.</>
                  )}{" "}
                  While a request is open its points are <span style={{ color: INK }}>held</span> —
                  they can&apos;t be spent twice, and a rejection puts them straight back.
                </div>
              </div>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
