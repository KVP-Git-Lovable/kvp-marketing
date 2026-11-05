import { useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { useActivityTiers } from "./hooks";

/**
 * ActivityForm seeds its milestone ladder from an effect keyed on the tier
 * query's result:
 *
 *   const { data: existingTiers = [] } = useActivityTiers(activity?.id);
 *   useEffect(() => { ...setTiers(...) }, [existingTiers, open, isOrderMilestone]);
 *
 * For a NEW activity there is no id, so the query is disabled and `data` is
 * undefined. A destructured `= []` then mints a fresh array on every render.
 * That array is the dependency, so the effect re-seeds the ladder, which sets
 * state, which renders, which mints another array -- a runaway that re-seeds
 * forever and makes every field in a new milestone row impossible to change.
 *
 * The runaway is the thing under test, so the effect carries a run cap: with
 * the cap removed this file hangs the vitest worker outright, which is the
 * plainest demonstration of the bug there is, but not a result anyone can read.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
    }),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

/** One array, so an effect depending on it does not re-run every render. */
const NO_TIERS: any[] = [];

const CAP = 20;

/** ActivityForm's effect shape, over the ladder it seeds. */
function Ladder({ stable, runs }: { stable: boolean; runs: { n: number } }) {
  const { data } = useActivityTiers(undefined);
  const existingTiers = data ?? (stable ? NO_TIERS : []);

  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    runs.n += 1;
    if (runs.n > CAP) return; // keeps the runaway observable without hanging
    if (existingTiers.length) return;
    setTiers([{ order_ordinal: 1, basis: "order_value", threshold: 5000 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTiers]);

  return (
    <div>
      <button
        onClick={() => setTiers((p) => p.map((t) => ({ ...t, basis: "order_quantity" })))}
      >
        pick quantity
      </button>
      <span data-testid="basis">{tiers[0]?.basis ?? "-"}</span>
    </div>
  );
}

describe("seeding a milestone ladder for a brand-new activity", () => {
  it("re-seeds on every render while the dependency is unstable", () => {
    const runs = { n: 0 };
    render(<Ladder stable={false} runs={runs} />, { wrapper });
    // Nothing touched the form, yet the effect has run until its cap: each
    // render produced a new [] and re-triggered the seed.
    expect(runs.n).toBeGreaterThan(CAP);
  });

  it("seeds exactly once when the dependency is stable (the fix)", () => {
    const runs = { n: 0 };
    const { rerender } = render(<Ladder stable runs={runs} />, { wrapper });
    rerender(<Ladder stable runs={runs} />);
    rerender(<Ladder stable runs={runs} />);
    expect(runs.n).toBe(1);
  });

  it("keeps the chosen basis across later renders when stable", () => {
    const runs = { n: 0 };
    const { rerender } = render(<Ladder stable runs={runs} />, { wrapper });
    expect(screen.getByTestId("basis").textContent).toBe("order_value");

    fireEvent.click(screen.getByText("pick quantity"));
    expect(screen.getByTestId("basis").textContent).toBe("order_quantity");

    rerender(<Ladder stable runs={runs} />);
    rerender(<Ladder stable runs={runs} />);
    expect(screen.getByTestId("basis").textContent).toBe("order_quantity");
  });
});
