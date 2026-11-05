import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AIType =
  | "generate_subtasks"
  | "write_description"
  | "predict_risks"
  | "health_check"
  | "workload_analysis"
  | "knowledge_query"
  | "knowledge_gaps"
  | "evaluate_idea"
  | "triage_support"
  | "project_summary";

interface UsePMAIOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function usePMAI(options?: UsePMAIOptions) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const invoke = async (type: AIType, projectId: string, context?: any) => {
    setLoading(true);
    setData(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("pm-ai-assistant", {
        body: { type, projectId, context },
      });
      if (error) {
        const msg = error.message || "AI request failed";
        toast.error(msg);
        options?.onError?.(msg);
        return null;
      }
      if (result?.error) {
        toast.error(result.error);
        options?.onError?.(result.error);
        return null;
      }
      setData(result);
      options?.onSuccess?.(result);
      return result;
    } catch (e: any) {
      const msg = e.message || "AI request failed";
      toast.error(msg);
      options?.onError?.(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { invoke, loading, data, setData };
}
