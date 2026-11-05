import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";

interface Props {
  projectId: string;
}

export function AIWorkloadAnalysis({ projectId }: Props) {
  const { invoke, loading, data, setData } = usePMAI();
  const [show, setShow] = useState(false);

  const run = async () => {
    const result = await invoke("workload_analysis", projectId);
    if (result) setShow(true);
  };

  return (
    <div>
      <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
        {loading ? "Analyzing..." : "AI: Workload Analysis"}
      </Button>

      {show && data?.analysis && (
        <div className="mt-3 border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> AI Workload Analysis
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShow(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown>{data.analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
