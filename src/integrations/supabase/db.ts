// Loosely-typed client for code whose tables are not yet in the generated database types.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedClient } from "./client";

export const supabase = typedClient as unknown as SupabaseClient<any, "public", any>;
