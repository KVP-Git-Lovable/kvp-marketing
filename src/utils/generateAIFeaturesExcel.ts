import * as XLSX from 'xlsx';

interface AIFeature {
  name: string;
  description: string;
  module: string;
  benefit: string;
}

const AI_FEATURES: AIFeature[] = [
  // Attendance & Verification
  {
    name: "Face Verification (Check-in/Check-out)",
    description: "Server-side face matching using AI to verify that the person checking in/out matches their registered profile photo. Compares selfie with stored reference image.",
    module: "Attendance",
    benefit: "Prevents proxy attendance and buddy-punching fraud. Ensures only the actual employee can mark attendance, improving workforce integrity and accountability."
  },
  {
    name: "AI Address Translation",
    description: "Translates addresses written in Indian regional languages (Kannada, Hindi, Tamil, Telugu, etc.) to English using Google Gemini AI for standardized record-keeping.",
    module: "Retailer Management / Orders",
    benefit: "Enables field reps to input addresses in their local language while maintaining a standardized English database. Improves invoice accuracy and logistics efficiency."
  },

  // Retailer Onboarding
  {
    name: "Shop Board OCR Scanner",
    description: "AI-powered optical character recognition that scans retailer shop boards/signage to automatically extract shop name, owner name, and business details during onboarding.",
    module: "Retailer Onboarding",
    benefit: "Speeds up retailer onboarding by 70%+ by auto-filling form fields. Reduces manual data entry errors and ensures accurate retailer records from day one."
  },

  // Orders & Sales
  {
    name: "Voice-to-Order Parser",
    description: "Converts spoken voice input into structured order data. Field reps can dictate orders naturally (e.g., '5 boxes of Product X') and the AI parses product names, quantities, and units.",
    module: "Order Management",
    benefit: "Enables hands-free order taking during busy store visits. Reduces order entry time by 50%+, minimizes typing errors, and allows reps to focus on customer engagement."
  },
  {
    name: "Smart Basket Suggestions",
    description: "Analyzes retailer's purchase history, buying patterns, and seasonal trends to suggest relevant products the retailer is likely to order. Recommends quantities based on past behavior.",
    module: "Order Management",
    benefit: "Increases average order value by suggesting complementary products. Reduces stockouts at retailer level and helps reps make data-driven product recommendations."
  },

  // Visit Intelligence
  {
    name: "Real-time Visit AI Insights",
    description: "Generates actionable cross-sell/upsell recommendations, discussion points, and retailer-specific insights when a field rep starts a visit. Analyzes purchase history and market data.",
    module: "Field Visits",
    benefit: "Transforms every visit into a strategic conversation. Helps reps identify revenue opportunities, discuss relevant promotions, and address retailer concerns proactively."
  },

  // Beat Management
  {
    name: "Beat Health Insights Engine",
    description: "Calculates a transparent health score (0-100) for each beat using 6 weighted KPIs: Revenue Trend (25%), Visit Coverage (20%), Conversion Quality (20%), Retailer Activity (15%), Sales Rep Productivity (10%), SKU Penetration (10%). AI generates actionable summaries.",
    module: "Beat Management",
    benefit: "Provides managers with instant visibility into beat performance. Identifies underperforming areas, highlights growth opportunities, and enables data-driven territory decisions."
  },
  {
    name: "Auto-Generate Beat Plan",
    description: "AI automatically generates optimized daily beat plans based on retailer visit frequency requirements, geographic proximity, and pending visit schedules.",
    module: "Beat Planning",
    benefit: "Saves 30+ minutes daily on route planning. Ensures optimal territory coverage, reduces travel time, and ensures no retailer is missed in the visit cycle."
  },

  // Competition Intelligence
  {
    name: "Competition Photo Scanner",
    description: "Analyzes photos of competitor products, displays, or promotions using AI vision. Extracts competitor brand name, product category, and competitive insights automatically.",
    module: "Competition Tracking",
    benefit: "Enables rapid competitive intelligence gathering in the field. Provides structured data from visual observations, helping management track market dynamics in real-time."
  },
  {
    name: "Competition AI Summary",
    description: "Generates comprehensive AI summaries of competitive landscape based on accumulated field observations, photos, and rep notes across territories.",
    module: "Competition Tracking",
    benefit: "Transforms scattered field observations into strategic competitive intelligence reports for management decision-making and sales strategy formulation."
  },

  // Stock & Inventory
  {
    name: "Stock Image Analyzer",
    description: "AI vision system that analyzes photos of retail shelves/stock to estimate inventory levels, identify product placement, and detect stockout situations.",
    module: "Stock Management",
    benefit: "Provides real-time shelf visibility without manual counting. Helps identify restocking needs, optimize shelf placement, and ensure product availability."
  },
  {
    name: "Wall Measurement Scanner",
    description: "AI-powered image analysis to measure wall dimensions from photos for branding material sizing (banners, boards, etc.).",
    module: "Branding / Merchandising",
    benefit: "Eliminates manual measurement errors for branding installations. Speeds up branding request process and ensures correct material sizing, reducing waste and rework."
  },

  // Target & Performance
  {
    name: "AI Target Achievement Advisor",
    description: "Provides personalized AI-driven guidance for closing gaps in sales targets. Analyzes current performance vs targets and suggests specific actions for gap closure.",
    module: "Target Management",
    benefit: "Gives each rep a personalized coach for target achievement. Identifies specific actions to close revenue gaps, improving target hit rates across the team."
  },

  // Proactive Intelligence
  {
    name: "Proactive AI Insights Engine",
    description: "Automatically generates contextual insights, alerts, opportunities, and recommendations based on user's data patterns. Includes alerts for declining retailers, missed visits, and growth opportunities.",
    module: "Dashboard / Home",
    benefit: "Shifts from reactive to proactive management. Surfaces critical issues before they escalate and highlights opportunities that might otherwise be missed."
  },
  {
    name: "AI Recommendations Engine",
    description: "Generates personalized recommendations for beat visits, retailer priorities, discussion points, beat performance improvements, and optimal visit days.",
    module: "Dashboard / Visits",
    benefit: "Provides data-driven guidance for daily planning. Helps reps prioritize high-value activities and optimize their daily workflow for maximum impact."
  },

  // Chat & Conversational AI
  {
    name: "AI Chat Assistant",
    description: "Full conversational AI assistant that answers questions about sales data, performance metrics, and provides on-demand analysis. Supports multi-turn conversations with context memory.",
    module: "AI Assistant (Global)",
    benefit: "Provides instant answers to data questions without navigating multiple screens. Acts as a personal sales analyst available 24/7 for any team member."
  },
  {
    name: "Voice Conversation (ElevenLabs)",
    description: "Voice-enabled AI assistant using ElevenLabs for natural speech interaction. Supports both text-to-speech responses and voice conversation mode.",
    module: "AI Assistant (Global)",
    benefit: "Enables hands-free interaction while driving or in the field. Makes AI assistance accessible even for users less comfortable with text-based interfaces."
  },
  {
    name: "Report Voice Assistant",
    description: "Voice-enabled assistant specifically for generating and querying reports through natural language voice commands.",
    module: "Reports",
    benefit: "Allows managers to request reports verbally (e.g., 'Show me this week's top performers'), making analytics accessible during meetings and on-the-go."
  },
  {
    name: "Weekly AI Summary",
    description: "Generates an AI-powered weekly performance summary with strategic insights, highlighting key achievements, areas of concern, and recommendations for the coming week.",
    module: "Dashboard / Home",
    benefit: "Provides a concise weekly briefing that saves 30+ minutes of manual analysis. Helps reps and managers start each week with clear priorities."
  },

  // Scheme & Promotion Intelligence
  {
    name: "AI Scheme Suggestion Engine",
    description: "Analyzes sales data, retailer behavior, and market signals to proactively suggest promotional schemes. Recommends scheme type, target audience, discount levels, and expected ROI.",
    module: "Schemes / Promotions",
    benefit: "Replaces guesswork in promotion planning with data-driven suggestions. Improves scheme effectiveness, reduces wasted promotional spend, and targets the right retailers."
  },

  // Credit & Financial
  {
    name: "AI Credit Score Calculator",
    description: "Calculates retailer creditworthiness scores based on payment history, order frequency, relationship duration, and business metrics.",
    module: "Retailer Management / Finance",
    benefit: "Helps distributors make informed credit decisions. Reduces bad debt risk, optimizes credit limits, and supports healthy cash flow management."
  },

  // Coaching & Learning
  {
    name: "AI Competency Score Calculator",
    description: "Calculates multi-dimensional competency scores for sales reps across defined skill areas. Combines quiz performance, practical assessments, and learning engagement metrics.",
    module: "Sales Coaching",
    benefit: "Provides objective, data-driven competency assessment. Identifies skill gaps for targeted training and tracks improvement over time for each team member."
  },
  {
    name: "AI Competency Improvement Tips",
    description: "Generates personalized improvement recommendations based on individual competency scores, recent performance, and identified skill gaps.",
    module: "Sales Coaching",
    benefit: "Provides each rep with a customized development plan. Focuses training efforts where they'll have maximum impact on performance improvement."
  },
  {
    name: "AI Competency Score Breakdown",
    description: "Provides detailed AI-generated analysis of how each competency score was calculated, including contributing factors and comparison with peers.",
    module: "Sales Coaching",
    benefit: "Ensures transparency in assessments. Helps reps understand exactly where they excel and where they need improvement, building trust in the evaluation system."
  },
  {
    name: "AI Competency Insights Generator",
    description: "Generates strategic insights from competency data across the team, identifying training needs, top performers, and skill distribution patterns.",
    module: "Sales Coaching (Admin)",
    benefit: "Helps L&D and HR teams design targeted training programs. Identifies systemic skill gaps and tracks the effectiveness of training initiatives."
  },

  // Project Management AI
  {
    name: "AI Description Writer",
    description: "Generates or elaborates task descriptions in markdown format based on task title, section context, and project name. Supports both fresh writing and elaboration of existing content.",
    module: "Project Management",
    benefit: "Saves time writing detailed task descriptions. Ensures consistent documentation quality and helps team members create clear, actionable task specs."
  },
  {
    name: "AI Task Breakdown (Sub-tasks)",
    description: "Automatically breaks down a parent task into logical sub-tasks with titles, descriptions, and effort estimates based on the task context.",
    module: "Project Management",
    benefit: "Accelerates sprint planning by auto-generating work breakdown structures. Ensures no critical sub-tasks are missed and provides consistent task granularity."
  },
  {
    name: "AI Risk Prediction",
    description: "Predicts potential risks for tasks/projects including schedule overruns, effort underestimation, and dependency conflicts based on project context.",
    module: "Project Management",
    benefit: "Enables proactive risk management. Helps PMs identify and mitigate risks before they impact delivery timelines and project quality."
  },
  {
    name: "AI Workload Analysis",
    description: "Analyzes team member workload distribution across projects and sprints, identifying overloaded and underutilized resources.",
    module: "Project Management",
    benefit: "Prevents burnout from uneven work distribution. Helps managers balance workloads and make informed resource allocation decisions."
  },
  {
    name: "AI Knowledge Assistant",
    description: "Task-level knowledge base query system that answers questions related to specific tasks using project context, documentation, and historical data.",
    module: "Project Management",
    benefit: "Reduces context-switching and information seeking time. Provides instant answers to task-related questions, accelerating development velocity."
  },
  {
    name: "AI Support Ticket Triage",
    description: "Automatically suggests priority level and category for incoming support tickets based on content analysis and historical ticket patterns.",
    module: "Project Management (Support)",
    benefit: "Speeds up ticket processing and ensures consistent prioritization. Reduces manual triage effort and ensures critical issues are escalated immediately."
  },
  {
    name: "AI Project Summary",
    description: "Generates comprehensive project status summaries including progress metrics, blockers, and upcoming milestones.",
    module: "Project Management",
    benefit: "Saves hours of manual status report preparation. Provides consistent, data-driven project updates for stakeholders."
  },
  {
    name: "AI Sprint Summary",
    description: "Generates AI-powered sprint retrospective summaries analyzing completed work, velocity, and team performance within a sprint.",
    module: "Project Management",
    benefit: "Automates sprint review preparation. Provides objective analysis of sprint performance and identifies patterns for continuous improvement."
  },
  {
    name: "AI Idea Evaluator",
    description: "Evaluates new feature/product ideas based on feasibility, market fit, effort estimation, and strategic alignment.",
    module: "Project Management",
    benefit: "Provides structured evaluation framework for new ideas. Helps prioritize the product backlog with data-driven assessments."
  },
  {
    name: "AI Knowledge Gaps Finder",
    description: "Identifies gaps in project documentation and knowledge base, suggesting areas that need better documentation or knowledge transfer.",
    module: "Project Management",
    benefit: "Ensures comprehensive project documentation. Reduces knowledge silos and onboarding time for new team members."
  },

  // Notifications & Scheduling
  {
    name: "AI Scheduled Content Generator",
    description: "Generates scheduled notification content and motivational messages for the team based on context, performance data, and timing.",
    module: "Notifications / Engagement",
    benefit: "Maintains team engagement with personalized, timely communications. Reduces manual effort in crafting motivational messages and announcements."
  },
  {
    name: "Auto End-of-Day Processing",
    description: "AI-driven automatic end-of-day processing that handles attendance closure, summary generation, and next-day preparation tasks.",
    module: "Attendance / Operations",
    benefit: "Eliminates manual end-of-day administrative tasks. Ensures consistent daily closure and accurate attendance records without manager intervention."
  },

  // Autonomous Actions
  {
    name: "AI Autonomous Actions",
    description: "System for AI to take pre-approved autonomous actions (with undo capability) such as auto-scheduling visits, sending reminders, and updating statuses based on predefined rules.",
    module: "System-wide",
    benefit: "Reduces repetitive manual tasks across the platform. Provides guardrails with undo capability, balancing automation efficiency with user control."
  },

  // Coach Nudges
  {
    name: "AI Daily Coaching Nudges",
    description: "Delivers personalized daily nudges and micro-coaching tips based on the rep's recent performance, learning progress, and upcoming activities.",
    module: "Sales Coaching",
    benefit: "Provides bite-sized, timely coaching that fits into daily workflow. Reinforces learning and drives behavior change through consistent micro-interventions."
  },
];

export function downloadAIFeaturesExcel() {
  const wsData = [
    ["AI Feature Name", "Description", "Module", "Business Benefit / How It Helps"],
    ...AI_FEATURES.map(f => [f.name, f.description, f.module, f.benefit])
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 35 },
    { wch: 80 },
    { wch: 30 },
    { wch: 80 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "AI Features");
  XLSX.writeFile(wb, "AI_Features_Documentation.xlsx");
}
