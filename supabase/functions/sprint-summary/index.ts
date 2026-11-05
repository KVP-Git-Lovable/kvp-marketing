import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sprintId, projectId } = await req.json();
    if (!sprintId || !projectId) throw new Error("sprintId and projectId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch sprint
    const { data: sprint, error: sprintErr } = await supabase
      .from("pm_sprints")
      .select("*")
      .eq("id", sprintId)
      .single();
    if (sprintErr) throw sprintErr;

    // Fetch sections
    const { data: sections } = await supabase
      .from("pm_sections")
      .select("*")
      .eq("project_id", projectId)
      .order("position");

    // Fetch tasks in sprint date range
    let tasks: any[] = [];
    if (sprint.start_date && sprint.end_date) {
      const { data } = await supabase
        .from("pm_tasks")
        .select("*")
        .eq("project_id", projectId)
        .gte("due_date", sprint.start_date)
        .lte("due_date", sprint.end_date)
        .is("parent_task_id", null);
      tasks = data || [];
    }

    // Group tasks by section
    const sectionMap: Record<string, { name: string; tasks: any[] }> = {};
    for (const s of (sections || [])) {
      sectionMap[s.id] = { name: s.name, tasks: [] };
    }
    sectionMap["unsectioned"] = { name: "Unsectioned", tasks: [] };

    for (const t of tasks) {
      const key = t.section_id && sectionMap[t.section_id] ? t.section_id : "unsectioned";
      sectionMap[key].tasks.push(t);
    }

    // Build context for AI
    const sectionSummaries = Object.values(sectionMap)
      .filter(s => s.tasks.length > 0)
      .map(s => {
        const done = s.tasks.filter((t: any) => t.status === "done").length;
        const inProgress = s.tasks.filter((t: any) => t.status === "in_progress").length;
        const todo = s.tasks.filter((t: any) => t.status === "todo" || t.status === "backlog").length;
        const taskList = s.tasks.map((t: any) => `- ${t.title} [${t.status}] (Priority: ${t.priority})`).join("\n");
        return `## ${s.name}\nTotal: ${s.tasks.length} | Done: ${done} | In Progress: ${inProgress} | To Do: ${todo}\n${taskList}`;
      })
      .join("\n\n");

    const totalTasks = tasks.length;
    const totalDone = tasks.filter(t => t.status === "done").length;
    const progress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

    const prompt = `You are a project management assistant. Summarize the following sprint concisely.

Sprint: ${sprint.name}
Goal: ${sprint.goal || "No goal set"}
Period: ${sprint.start_date || "N/A"} to ${sprint.end_date || "N/A"}
Status: ${sprint.status}
Overall Progress: ${totalDone}/${totalTasks} tasks completed (${progress}%)

Section-wise breakdown:
${sectionSummaries || "No tasks in this sprint."}

Provide a clear, structured summary with:
1. Overall sprint health (1-2 sentences)
2. Section-by-section highlights (key accomplishments and blockers)
3. Risks or attention areas
4. Recommendation for next steps

Keep it concise and actionable. Use markdown formatting.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a concise project management analyst." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "Unable to generate summary.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sprint-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
