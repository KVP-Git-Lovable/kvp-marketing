import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedClient } from "./client";

// Loosely-typed client for code whose tables are not yet in this project's database description.
export const supabase = typedClient as unknown as SupabaseClient<any, "public", any>;
