import { useState } from "react";
import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, X, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  projectId: string;
  taskTitle?: string;
  taskDescription?: string;
}

export function AIKnowledgeAssistant({ projectId, taskTitle, taskDescription }: Props) {
  const { invoke, loading, data, setData } = usePMAI();
  const [question, setQuestion] = useState("");
  const [show, setShow] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    const result = await invoke("knowledge_query", projectId, { question, taskTitle, taskDescription });
    if (result) setShow(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="Ask the knowledge base..."
          className="text-sm h-8"
        />
        <Button size="sm" onClick={ask} disabled={loading || !question.trim()} className="gap-1 h-8 px-3">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {show && data?.answer && (
        <div className="border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Knowledge Base Answer
            </span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setShow(false); setData(null); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground">
            <ReactMarkdown>{data.answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
