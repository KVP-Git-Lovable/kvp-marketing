import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, projectId, context } = await req.json();
    if (!type || !projectId) throw new Error("type and projectId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Helper to call AI
    const callAI = async (systemPrompt: string, userPrompt: string, tools?: any[], toolChoice?: any) => {
      const body: any = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };
      if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        if (resp.status === 429) throw { status: 429, message: "Rate limit exceeded. Try again later." };
        if (resp.status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits." };
        throw new Error(`AI gateway error: ${resp.status}`);
      }
      return await resp.json();
    };

    // Fetch project data helper
    const fetchProjectSnapshot = async () => {
      const [tasksRes, sectionsRes, risksRes, milestonesRes, resourcesRes] = await Promise.all([
        supabase.from("pm_tasks").select("*").eq("project_id", projectId),
        supabase.from("pm_sections").select("*").eq("project_id", projectId).order("position"),
        supabase.from("pm_risks").select("*").eq("project_id", projectId),
        supabase.from("pm_milestones").select("*").eq("project_id", projectId),
        supabase.from("pm_project_resources").select("*, profile:profiles!pm_project_resources_user_id_fkey(full_name)").eq("project_id", projectId),
      ]);
      return {
        tasks: tasksRes.data || [],
        sections: sectionsRes.data || [],
        risks: risksRes.data || [],
        milestones: milestonesRes.data || [],
        resources: resourcesRes.data || [],
      };
    };

    let result: any;

    switch (type) {
      // ─── GENERATE SUB-TASKS ──────────────────────────────────
      case "generate_subtasks": {
        const { taskTitle, taskDescription, sectionName } = context || {};
        const tools = [{
          type: "function",
          function: {
            name: "create_subtasks",
            description: "Generate actionable sub-tasks for a parent task",
            parameters: {
              type: "object",
              properties: {
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      estimated_hours: { type: "number" },
                    },
                    required: ["title", "priority", "estimated_hours"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["subtasks"],
              additionalProperties: false,
            },
          },
        }];

        const aiData = await callAI(
          "You are a project management expert. Break down tasks into actionable sub-tasks.",
          `Break this task into 3-7 actionable sub-tasks:\n\nTask: ${taskTitle}\nDescription: ${taskDescription || "None"}\nSection: ${sectionName || "General"}\n\nEach sub-task should be specific, measurable, and achievable. Estimate hours realistically.`,
          tools,
          { type: "function", function: { name: "create_subtasks" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : { subtasks: [] };
        break;
      }

      // ─── WRITE DESCRIPTION ──────────────────────────────────
      case "write_description": {
        const { taskTitle, sectionName, projectName, existingDescription } = context || {};
        const isElaboration = !!existingDescription?.trim();

        const prompt = isElaboration
          ? `The user has written a short note for a task. Elaborate it into a professional, detailed task description.\n\nTask Title: ${taskTitle}\nProject: ${projectName || "Unknown"}\nSection: ${sectionName || "General"}\nUser's Note:\n${existingDescription}\n\nElaborate and expand the note into a complete description with:\n1. Objective (1-2 sentences expanding on the note)\n2. Detailed scope & requirements\n3. Acceptance criteria (as markdown checklist)\n4. Notes/considerations\n\nPreserve the user's intent and key points. Use markdown. Do NOT suggest sub-tasks.`
          : `Write a professional task description for:\n\nTask: ${taskTitle}\nProject: ${projectName || "Unknown"}\nSection: ${sectionName || "General"}\n\nInclude:\n1. Objective (1-2 sentences)\n2. Scope & requirements\n3. Acceptance criteria (as markdown checklist)\n4. Notes/considerations\n\nKeep it concise and actionable. Use markdown. Do NOT suggest sub-tasks.`;

        const aiData = await callAI(
          "You are a project management expert. Write clear, detailed task descriptions. Only return the description text, no sub-tasks.",
          prompt
        );

        result = { description: aiData.choices?.[0]?.message?.content || "" };
        break;
      }

      // ─── PREDICT RISKS ──────────────────────────────────────
      case "predict_risks": {
        const snapshot = await fetchProjectSnapshot();
        const tasksSummary = snapshot.tasks.map((t: any) => 
          `- ${t.title} [${t.status}] P:${t.priority} Est:${t.estimated_hours || 0}h Logged:${t.logged_hours || 0}h Due:${t.due_date || "none"}`
        ).join("\n");
        const existingRisks = snapshot.risks.map((r: any) => `- ${r.title} (${r.status})`).join("\n");
        const resourcesSummary = snapshot.resources.map((r: any) =>
          `- ${r.profile?.full_name || "Unknown"} (${r.role}) Budget:${r.budget_allocated}h`
        ).join("\n");

        const tools = [{
          type: "function",
          function: {
            name: "predict_risks",
            description: "Predict project risks based on current data",
            parameters: {
              type: "object",
              properties: {
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      probability: { type: "string", enum: ["low", "medium", "high"] },
                      impact: { type: "string", enum: ["low", "medium", "high"] },
                      mitigation_plan: { type: "string" },
                      category: { type: "string", enum: ["schedule_overrun", "effort_overrun", "resource_bottleneck", "scope_creep", "milestone_at_risk", "dependency_risk", "quality_risk"] },
                    },
                    required: ["title", "description", "probability", "impact", "mitigation_plan", "category"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["risks"],
              additionalProperties: false,
            },
          },
        }];

        const aiData = await callAI(
          "You are a risk management expert. Analyze project data to predict risks.",
          `Analyze this project and predict 3-6 risks:\n\nTasks (${snapshot.tasks.length} total):\n${tasksSummary}\n\nExisting Risks:\n${existingRisks || "None"}\n\nResources:\n${resourcesSummary || "None"}\n\nMilestones: ${snapshot.milestones.map((m: any) => `${m.name} (due: ${m.due_date || "none"}, done: ${m.is_completed})`).join(", ") || "None"}\n\nToday: ${new Date().toISOString().split("T")[0]}\n\nIdentify risks NOT already in the existing risks list. Focus on schedule overruns, effort overruns, resource bottlenecks, and milestone risks.`,
          tools,
          { type: "function", function: { name: "predict_risks" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : { risks: [] };
        break;
      }

      // ─── HEALTH CHECK (overrun alerts) ──────────────────────
      case "health_check": {
        const snapshot = await fetchProjectSnapshot();
        const today = new Date().toISOString().split("T")[0];

        const tools = [{
          type: "function",
          function: {
            name: "health_check",
            description: "Analyze project health and flag overruns",
            parameters: {
              type: "object",
              properties: {
                overall_health: { type: "string", enum: ["healthy", "at_risk", "critical"] },
                summary: { type: "string" },
                schedule_overruns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task_id: { type: "string" },
                      task_title: { type: "string" },
                      severity: { type: "string", enum: ["warning", "critical"] },
                      reason: { type: "string" },
                    },
                    required: ["task_id", "task_title", "severity", "reason"],
                    additionalProperties: false,
                  },
                },
                effort_overruns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task_id: { type: "string" },
                      task_title: { type: "string" },
                      estimated: { type: "number" },
                      logged: { type: "number" },
                      severity: { type: "string", enum: ["warning", "critical"] },
                    },
                    required: ["task_id", "task_title", "estimated", "logged", "severity"],
                    additionalProperties: false,
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["overall_health", "summary", "schedule_overruns", "effort_overruns", "recommendations"],
              additionalProperties: false,
            },
          },
        }];

        const taskDetails = snapshot.tasks.map((t: any) =>
          `ID:${t.id} "${t.title}" status:${t.status} priority:${t.priority} est:${t.estimated_hours || 0}h logged:${t.logged_hours || 0}h due:${t.due_date || "none"} start:${t.start_date || "none"}`
        ).join("\n");

        const aiData = await callAI(
          "You are a project health analyst. Identify schedule and effort overruns.",
          `Analyze project health. Today is ${today}.\n\nTasks:\n${taskDetails}\n\nFlag tasks where:\n- logged_hours > estimated_hours (effort overrun)\n- due_date < today AND status != done (schedule overrun)\n- Tasks at risk of overrunning based on progress vs time remaining`,
          tools,
          { type: "function", function: { name: "health_check" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : { overall_health: "healthy", summary: "Unable to analyze", schedule_overruns: [], effort_overruns: [], recommendations: [] };
        break;
      }

      // ─── WORKLOAD ANALYSIS ──────────────────────────────────
      case "workload_analysis": {
        const snapshot = await fetchProjectSnapshot();
        const timeLogsRes = await supabase.from("pm_time_logs").select("user_id, hours").eq("project_id", projectId);
        const timeLogs = timeLogsRes.data || [];

        const resourceDetails = snapshot.resources.map((r: any) => {
          const logged = timeLogs.filter((l: any) => l.user_id === r.user_id).reduce((s: number, l: any) => s + l.hours, 0);
          const tasks = snapshot.tasks.filter((t: any) => t.assignee_id === r.user_id && t.status !== "done" && t.status !== "cancelled");
          return `${r.profile?.full_name || "Unknown"} (${r.role}): Budget ${r.budget_allocated}h, Logged ${logged}h, Active tasks: ${tasks.length}`;
        }).join("\n");

        const aiData = await callAI(
          "You are a resource management expert. Analyze workload distribution and identify risks.",
          `Analyze resource workload:\n\n${resourceDetails}\n\nIdentify:\n1. Over-allocated resources (>90% utilization with many active tasks)\n2. Under-utilized resources\n3. Single-point-of-failure risks (critical tasks assigned to one person)\n4. Rebalancing recommendations\n\nProvide a structured analysis with specific, actionable recommendations.`
        );

        result = { analysis: aiData.choices?.[0]?.message?.content || "" };
        break;
      }

      // ─── KNOWLEDGE QUERY ────────────────────────────────────
      case "knowledge_query": {
        const { question, taskTitle, taskDescription } = context || {};
        const docsRes = await supabase.from("pm_knowledge_documents").select("document_name, description").eq("project_id", projectId);
        const docs = docsRes.data || [];
        const docsList = docs.map((d: any) => `- ${d.document_name}: ${d.description || "No description"}`).join("\n");

        const aiData = await callAI(
          "You are a knowledgeable project assistant. Use the available knowledge base to answer questions.",
          `Knowledge Base Documents:\n${docsList || "No documents available"}\n\nTask Context: ${taskTitle || "General"}\nTask Description: ${taskDescription || "None"}\n\nQuestion: ${question}\n\nAnswer based on the available knowledge. If relevant documents exist, reference them. If the knowledge base doesn't cover this topic, provide general best-practice guidance and suggest adding relevant documentation.`
        );

        result = { answer: aiData.choices?.[0]?.message?.content || "" };
        break;
      }

      // ─── KNOWLEDGE GAPS ─────────────────────────────────────
      case "knowledge_gaps": {
        const snapshot = await fetchProjectSnapshot();
        const docsRes = await supabase.from("pm_knowledge_documents").select("document_name, description").eq("project_id", projectId);
        const docs = docsRes.data || [];

        const sectionNames = snapshot.sections.map((s: any) => s.name).join(", ");
        const taskTitles = snapshot.tasks.slice(0, 30).map((t: any) => t.title).join(", ");
        const existingDocs = docs.map((d: any) => d.document_name).join(", ");

        const tools = [{
          type: "function",
          function: {
            name: "suggest_knowledge",
            description: "Suggest missing knowledge documents",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      document_name: { type: "string" },
                      description: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["document_name", "description", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }];

        const aiData = await callAI(
          "You are a knowledge management expert.",
          `Analyze this project and suggest 3-5 knowledge documents that are missing:\n\nSections: ${sectionNames || "None"}\nSample tasks: ${taskTitles || "None"}\nExisting docs: ${existingDocs || "None"}\n\nSuggest documents that would help the team work more effectively. Focus on gaps.`,
          tools,
          { type: "function", function: { name: "suggest_knowledge" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : { suggestions: [] };
        break;
      }

      // ─── EVALUATE IDEA ──────────────────────────────────────
      case "evaluate_idea": {
        const { ideaTitle, ideaDescription, ideaPriority } = context || {};
        const snapshot = await fetchProjectSnapshot();
        const activeTasks = snapshot.tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;

        const tools = [{
          type: "function",
          function: {
            name: "evaluate_idea",
            description: "Evaluate a project idea",
            parameters: {
              type: "object",
              properties: {
                feasibility_score: { type: "number", description: "1-10 score" },
                impact_score: { type: "number", description: "1-10 score" },
                effort_estimate: { type: "string", enum: ["small", "medium", "large", "extra_large"] },
                recommendation: { type: "string", enum: ["implement_now", "schedule_next", "park_for_later", "needs_more_detail", "not_recommended"] },
                reasoning: { type: "string" },
                suggested_tasks: { type: "array", items: { type: "string" } },
              },
              required: ["feasibility_score", "impact_score", "effort_estimate", "recommendation", "reasoning"],
              additionalProperties: false,
            },
          },
        }];

        const aiData = await callAI(
          "You are a product strategist. Evaluate ideas for feasibility and impact.",
          `Evaluate this idea:\n\nTitle: ${ideaTitle}\nDescription: ${ideaDescription || "No description"}\nPriority: ${ideaPriority || "medium"}\n\nProject context: ${activeTasks} active tasks, ${snapshot.resources.length} resources\n\nProvide an objective assessment.`,
          tools,
          { type: "function", function: { name: "evaluate_idea" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : null;
        break;
      }

      // ─── TRIAGE SUPPORT ─────────────────────────────────────
      case "triage_support": {
        const { title: reqTitle, description: reqDesc } = context || {};
        const existingRes = await supabase.from("pm_support_requests").select("title, status, priority").eq("project_id", projectId).eq("status", "resolved").limit(20);
        const resolved = existingRes.data || [];

        const tools = [{
          type: "function",
          function: {
            name: "triage_support",
            description: "Triage a support request",
            parameters: {
              type: "object",
              properties: {
                suggested_priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                category: { type: "string" },
                suggested_solution: { type: "string" },
                similar_resolved: { type: "array", items: { type: "string" } },
              },
              required: ["suggested_priority", "category", "suggested_solution"],
              additionalProperties: false,
            },
          },
        }];

        const aiData = await callAI(
          "You are a support triage expert.",
          `Triage this support request:\n\nTitle: ${reqTitle}\nDescription: ${reqDesc || "None"}\n\nPreviously resolved requests:\n${resolved.map((r: any) => `- ${r.title} (${r.priority})`).join("\n") || "None"}\n\nSuggest priority, category, and potential solution.`,
          tools,
          { type: "function", function: { name: "triage_support" } }
        );

        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        result = toolCall ? JSON.parse(toolCall.function.arguments) : null;
        break;
      }

      // ─── PROJECT SUMMARY ────────────────────────────────────
      case "project_summary": {
        const snapshot = await fetchProjectSnapshot();
        const projectRes = await supabase.from("pm_projects").select("*").eq("id", projectId).single();
        const project = projectRes.data;

        const totalTasks = snapshot.tasks.length;
        const doneTasks = snapshot.tasks.filter((t: any) => t.status === "done").length;
        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        const openRisks = snapshot.risks.filter((r: any) => r.status === "open").length;

        const aiData = await callAI(
          "You are a project management analyst. Create executive project summaries.",
          `Generate a comprehensive project health report:\n\nProject: ${project?.name || "Unknown"}\nStatus: ${project?.status}\nProgress: ${progress}% (${doneTasks}/${totalTasks} tasks done)\nBudget: ${project?.estimated_hours || 0}h estimated, ${project?.logged_hours || 0}h logged\nOpen Risks: ${openRisks}\nResources: ${snapshot.resources.length}\nMilestones: ${snapshot.milestones.length} (${snapshot.milestones.filter((m: any) => m.is_completed).length} completed)\n\nTask Status Breakdown:\n- Backlog: ${snapshot.tasks.filter((t: any) => t.status === "backlog").length}\n- To Do: ${snapshot.tasks.filter((t: any) => t.status === "todo").length}\n- In Progress: ${snapshot.tasks.filter((t: any) => t.status === "in_progress").length}\n- In Review: ${snapshot.tasks.filter((t: any) => t.status === "in_review").length}\n- Done: ${doneTasks}\n\nProvide:\n1. Executive Summary (2-3 sentences)\n2. Key Achievements\n3. Areas of Concern\n4. Risk Exposure\n5. Resource Utilization Insights\n6. Recommended Actions\n\nUse markdown formatting.`
        );

        result = { summary: aiData.choices?.[0]?.message?.content || "" };
        break;
      }

      default:
        throw new Error(`Unknown AI type: ${type}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("pm-ai-assistant error:", e);
    const status = e.status || 500;
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
