import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function metaAgentRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-agent", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
    }
    throw new Error(error.message === "Failed to send a request to the Edge Function" ? "The agent is not available. Has the meta-agent function been deployed?" : error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
