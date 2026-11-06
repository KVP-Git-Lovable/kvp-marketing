import { supabase } from "@/integrations/supabase/client";

// Retries edge function calls on transient platform outages (502/503/504),
// e.g. SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED, so brief blips don't surface as crashes.
const fns = supabase.functions as any;
if (!fns.__retryPatched) {
  const original = fns.invoke.bind(fns);
  fns.invoke = async (name: string, options?: unknown) => {
    let result: any;
    for (let attempt = 0; attempt < 4; attempt++) {
      result = await original(name, options);
      const status = result?.error?.context?.status;
      if (!result?.error || ![502, 503, 504].includes(status)) return result;
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
    return result;
  };
  fns.__retryPatched = true;
}

export {};
