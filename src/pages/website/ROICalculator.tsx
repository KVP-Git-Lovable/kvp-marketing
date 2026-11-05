import { useState } from "react";
import { 
  ArrowRight, ArrowLeft, Calculator, Users, Target, Clock, 
  TrendingUp, AlertTriangle, CheckCircle2, Sparkles, Calendar,
  BarChart3, Smartphone, Award, Zap, Building2, Brain, Truck,
  LineChart, FileText, ShieldCheck, Lightbulb, Handshake
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { WebsiteHeader, WebsiteFooter } from "@/components/website";
import { cn } from "@/lib/utils";

type StepId = "team" | "process" | "challenges" | "distributor" | "institutional" | "analytics" | "ai-readiness" | "goals" | "results";

interface Answer {
  teamSize: number;
  currentProcess: string;
  challenges: string[];
  // Distributor Management
  distributorCount: string;
  distributorChallenges: string[];
  // Institutional Sales
  hasInstitutionalSales: string;
  institutionalChallenges: string[];
  // Analytics
  analyticsMaturity: string;
  analyticsNeeds: string[];
  // AI Readiness
  aiAdoption: string;
  aiInterest: string[];
  // Goals
  topPriority: string;
}

const initialAnswers: Answer = {
  teamSize: 50,
  currentProcess: "",
  challenges: [],
  distributorCount: "",
  distributorChallenges: [],
  hasInstitutionalSales: "",
  institutionalChallenges: [],
  analyticsMaturity: "",
  analyticsNeeds: [],
  aiAdoption: "",
  aiInterest: [],
  topPriority: "",
};

const processOptions = [
  { value: "manual", label: "Manual / Paper-based", description: "Excel sheets, paper forms, WhatsApp groups", impact: 40 },
  { value: "basic-app", label: "Basic Mobile App", description: "Simple order booking app with limited features", impact: 25 },
  { value: "legacy-sfa", label: "Legacy SFA Tool", description: "Traditional SFA with per-user pricing", impact: 15 },
  { value: "none", label: "No Formal Process", description: "Reps work independently without tracking", impact: 50 },
];

const challengeOptions = [
  { value: "visibility", label: "Limited Field Visibility", description: "Don't know what reps are doing in real-time", icon: Target },
  { value: "productivity", label: "Low Rep Productivity", description: "Reps spend too much time on admin work", icon: Clock },
  { value: "accuracy", label: "Data Accuracy Issues", description: "Orders, stock data is often incorrect", icon: AlertTriangle },
  { value: "adoption", label: "Poor Tool Adoption", description: "Team doesn't use existing tools consistently", icon: Smartphone },
  { value: "insights", label: "Lack of Insights", description: "No actionable data for decision making", icon: BarChart3 },
  { value: "collections", label: "Collection Delays", description: "Payments are often delayed or missed", icon: Calendar },
];

const distributorCountOptions = [
  { value: "none", label: "No distributors", description: "Direct sales model" },
  { value: "1-10", label: "1-10 distributors", description: "Small distribution network" },
  { value: "11-50", label: "11-50 distributors", description: "Growing network" },
  { value: "50+", label: "50+ distributors", description: "Large distribution network" },
];

const distributorChallengeOptions = [
  { value: "order-visibility", label: "Primary Order Visibility", description: "No real-time view of distributor orders", icon: FileText },
  { value: "inventory", label: "Inventory Tracking", description: "Don't know distributor stock levels", icon: Truck },
  { value: "claims", label: "Claims Management", description: "Manual and delayed claims processing", icon: Calendar },
  { value: "communication", label: "Communication Gaps", description: "Difficult to coordinate with distributors", icon: Building2 },
  { value: "performance", label: "Performance Tracking", description: "Can't measure distributor effectiveness", icon: BarChart3 },
  { value: "onboarding", label: "Slow Onboarding", description: "Takes weeks to onboard new distributors", icon: Users },
];

const institutionalOptions = [
  { value: "yes-active", label: "Yes, actively growing", description: "Institutional sales is a key focus area" },
  { value: "yes-limited", label: "Yes, but limited", description: "Some institutional customers, not a focus" },
  { value: "planning", label: "Planning to start", description: "Evaluating institutional sales opportunity" },
  { value: "no", label: "No institutional sales", description: "Focus only on retail/distribution" },
];

const institutionalChallengeOptions = [
  { value: "lead-tracking", label: "Lead Management", description: "Leads fall through the cracks", icon: Target },
  { value: "pipeline", label: "Pipeline Visibility", description: "No clear view of sales pipeline", icon: LineChart },
  { value: "quotes", label: "Quote Management", description: "Manual quotation process, slow turnaround", icon: FileText },
  { value: "collections", label: "Collections", description: "Delayed payments from institutions", icon: Calendar },
  { value: "contacts", label: "Contact Management", description: "Losing track of key decision makers", icon: Users },
  { value: "pricing", label: "Custom Pricing", description: "Difficult to manage account-specific pricing", icon: Building2 },
];

const analyticsMaturityOptions = [
  { value: "none", label: "No analytics", description: "Rely on gut feeling and experience" },
  { value: "basic", label: "Basic Excel reports", description: "Monthly reports in spreadsheets" },
  { value: "moderate", label: "Some dashboards", description: "Have dashboards but not real-time" },
  { value: "advanced", label: "Advanced analytics", description: "Real-time dashboards and reports" },
];

const analyticsNeedOptions = [
  { value: "real-time", label: "Real-time Dashboards", description: "Live view of field activities", icon: BarChart3 },
  { value: "beat-analytics", label: "Beat Performance", description: "Analyze beat productivity", icon: Target },
  { value: "retailer-insights", label: "Retailer Insights", description: "Deep dive into retailer behavior", icon: Users },
  { value: "territory", label: "Territory Analysis", description: "Compare territory performance", icon: Building2 },
  { value: "trends", label: "Trend Analysis", description: "Identify patterns and forecast", icon: LineChart },
  { value: "custom-kpi", label: "Custom KPIs", description: "Track metrics specific to your business", icon: Target },
];

const aiAdoptionOptions = [
  { value: "none", label: "Not using AI", description: "Haven't explored AI solutions yet" },
  { value: "curious", label: "Curious about AI", description: "Interested but haven't implemented" },
  { value: "experimenting", label: "Experimenting", description: "Trying out AI in some areas" },
  { value: "using", label: "Actively using AI", description: "AI is part of our operations" },
];

const aiInterestOptions = [
  { value: "recommendations", label: "Smart Product Recommendations", description: "AI-suggested products for each retailer", icon: Lightbulb },
  { value: "stock-detection", label: "Shelf Stock Detection", description: "AI analyzes photos to detect stock levels", icon: Brain },
  { value: "credit-scoring", label: "Credit Risk Assessment", description: "AI-based retailer credit scoring", icon: ShieldCheck },
  { value: "sales-coach", label: "AI Sales Coach", description: "Personalized coaching tips for reps", icon: Award },
  { value: "competition", label: "Competition Analysis", description: "AI scans competitor products from photos", icon: Target },
  { value: "forecasting", label: "Demand Forecasting", description: "Predict future demand patterns", icon: LineChart },
];

const priorityOptions = [
  { value: "productivity", label: "Increase Rep Productivity", description: "Get more done with the same team" },
  { value: "visibility", label: "Improve Field Visibility", description: "Know what's happening in real-time" },
  { value: "growth", label: "Drive Sales Growth", description: "Increase orders and revenue" },
  { value: "efficiency", label: "Reduce Operational Costs", description: "Cut manual work and errors" },
  { value: "distributor", label: "Strengthen Distribution", description: "Better distributor collaboration" },
  { value: "analytics", label: "Data-Driven Decisions", description: "Make decisions based on insights" },
];

export const ROICalculator = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>("team");
  const [answers, setAnswers] = useState<Answer>(initialAnswers);

  const steps: { id: StepId; label: string }[] = [
    { id: "team", label: "Your Team" },
    { id: "process", label: "Current Process" },
    { id: "challenges", label: "Challenges" },
    { id: "distributor", label: "Distribution" },
    { id: "institutional", label: "Institutional Sales" },
    { id: "analytics", label: "Analytics" },
    { id: "ai-readiness", label: "AI Readiness" },
    { id: "goals", label: "Goals" },
    { id: "results", label: "Your Results" },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case "team": return answers.teamSize >= 5;
      case "process": return answers.currentProcess !== "";
      case "challenges": return answers.challenges.length > 0;
      case "distributor": return answers.distributorCount !== "";
      case "institutional": return answers.hasInstitutionalSales !== "";
      case "analytics": return answers.analyticsMaturity !== "";
      case "ai-readiness": return answers.aiAdoption !== "";
      case "goals": return answers.topPriority !== "";
      default: return true;
    }
  };

  const nextStep = () => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id);
  };

  const prevStep = () => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1].id);
  };

  const toggleOption = (field: keyof Answer, value: string) => {
    setAnswers(prev => {
      const current = prev[field] as string[];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter(c => c !== value)
          : [...current, value]
      };
    });
  };

  // Generate situation summary
  const generateSituationSummary = () => {
    const processLabel = processOptions.find(p => p.value === answers.currentProcess)?.label || "Unknown";
    const distributorLabel = distributorCountOptions.find(d => d.value === answers.distributorCount)?.label || "";
    const analyticsLabel = analyticsMaturityOptions.find(a => a.value === answers.analyticsMaturity)?.label || "";
    const aiLabel = aiAdoptionOptions.find(a => a.value === answers.aiAdoption)?.label || "";
    
    return {
      processLabel,
      distributorLabel,
      analyticsLabel,
      aiLabel,
      teamSize: answers.teamSize,
      hasDistributors: answers.distributorCount !== "none",
      hasInstitutional: answers.hasInstitutionalSales === "yes-active" || answers.hasInstitutionalSales === "yes-limited",
    };
  };

  // Generate problem statements
  const generateProblemStatements = () => {
    const problems: { area: string; issue: string; impact: string }[] = [];
    
    // Field Sales challenges
    if (answers.challenges.includes("visibility")) {
      problems.push({
        area: "Field Operations",
        issue: "Limited visibility into field activities",
        impact: "Cannot make timely decisions or course-correct underperforming reps"
      });
    }
    if (answers.challenges.includes("productivity")) {
      problems.push({
        area: "Productivity",
        issue: "Reps spend excessive time on administrative tasks",
        impact: "Reduced selling time directly impacts revenue potential"
      });
    }
    if (answers.challenges.includes("adoption")) {
      problems.push({
        area: "Technology",
        issue: "Poor adoption of existing tools",
        impact: "Investment in technology not yielding expected returns"
      });
    }
    if (answers.challenges.includes("accuracy")) {
      problems.push({
        area: "Data Quality",
        issue: "Frequent data entry errors and inconsistencies",
        impact: "Wrong orders, returns, and customer dissatisfaction"
      });
    }
    
    // Distributor challenges
    if (answers.distributorChallenges.includes("order-visibility")) {
      problems.push({
        area: "Distribution",
        issue: "No real-time visibility into distributor orders",
        impact: "Cannot plan production or manage stock effectively"
      });
    }
    if (answers.distributorChallenges.includes("inventory")) {
      problems.push({
        area: "Supply Chain",
        issue: "Unable to track distributor inventory levels",
        impact: "Stock-outs at distributors leading to lost sales"
      });
    }
    if (answers.distributorChallenges.includes("claims")) {
      problems.push({
        area: "Finance",
        issue: "Manual and slow claims processing",
        impact: "Distributor dissatisfaction and relationship strain"
      });
    }
    
    // Institutional challenges
    if (answers.institutionalChallenges.includes("lead-tracking")) {
      problems.push({
        area: "Institutional Sales",
        issue: "Leads not being tracked systematically",
        impact: "Missed opportunities and revenue leakage"
      });
    }
    if (answers.institutionalChallenges.includes("pipeline")) {
      problems.push({
        area: "Sales Pipeline",
        issue: "No clear visibility into deal pipeline",
        impact: "Cannot forecast accurately or prioritize efforts"
      });
    }
    
    // Analytics gaps
    if (answers.analyticsMaturity === "none" || answers.analyticsMaturity === "basic") {
      problems.push({
        area: "Analytics",
        issue: "Decisions made without data-driven insights",
        impact: "Suboptimal resource allocation and missed opportunities"
      });
    }
    
    return problems;
  };

  // Generate recommendations with approach
  const generateRecommendations = () => {
    const recommendations: { 
      title: string; 
      description: string; 
      approach: string[];
      timeline: string;
      icon: typeof Target;
    }[] = [];
    
    // Field Sales Automation
    if (answers.currentProcess === "manual" || answers.currentProcess === "none" || answers.challenges.includes("productivity")) {
      recommendations.push({
        title: "Field Sales Automation",
        description: "Transform manual processes into automated, GPS-verified workflows",
        approach: [
          "Deploy QuickApp mobile app to all field reps with 2-day onboarding",
          "Enable GPS-verified attendance with face recognition",
          "Set up beat planning with optimized routes",
          "Configure offline-first order entry with real-time sync"
        ],
        timeline: "Week 1-2",
        icon: Smartphone
      });
    }
    
    // Gamification for adoption
    if (answers.challenges.includes("adoption")) {
      recommendations.push({
        title: "Gamification-Driven Adoption",
        description: "Use points, badges, and leaderboards to drive consistent tool usage",
        approach: [
          "Configure gamification rules aligned to your KPIs",
          "Set up real-time leaderboards visible to all teams",
          "Create badge milestones for key achievements",
          "Run weekly competitions with recognition"
        ],
        timeline: "Week 2-3",
        icon: Award
      });
    }
    
    // Distributor Portal
    if (answers.distributorCount !== "none" && answers.distributorChallenges.length > 0) {
      recommendations.push({
        title: "Distributor Portal Setup",
        description: "Give distributors their own portal for orders, inventory, and claims",
        approach: [
          "Onboard distributors to the self-service portal",
          "Enable primary order placement with approval workflows",
          "Set up real-time inventory visibility and alerts",
          "Configure digital claims submission and tracking",
          "Provide business planning tools for annual targets"
        ],
        timeline: "Week 2-4",
        icon: Building2
      });
    }
    
    // Institutional Sales CRM
    if (answers.hasInstitutionalSales === "yes-active" || answers.hasInstitutionalSales === "yes-limited") {
      recommendations.push({
        title: "Institutional Sales Module",
        description: "Full CRM capabilities for B2B/institutional sales",
        approach: [
          "Set up lead capture and qualification workflow",
          "Configure opportunity pipeline with stages",
          "Enable quotation generation with custom pricing",
          "Track all contacts and decision makers per account",
          "Automate collection reminders and follow-ups"
        ],
        timeline: "Week 3-5",
        icon: Handshake
      });
    }
    
    // Analytics & Reporting
    if (answers.analyticsMaturity === "none" || answers.analyticsMaturity === "basic" || answers.analyticsNeeds.length > 0) {
      recommendations.push({
        title: "Analytics & Insights Platform",
        description: "Real-time dashboards and reports for data-driven decisions",
        approach: [
          "Configure role-based dashboards (Rep, Manager, Leadership)",
          "Set up real-time performance tracking",
          "Enable beat and territory analytics",
          "Create custom KPI configurations for your metrics",
          "Schedule automated reports to stakeholders"
        ],
        timeline: "Week 1-3",
        icon: BarChart3
      });
    }
    
    // AI Features
    if (answers.aiAdoption !== "using" && answers.aiInterest.length > 0) {
      const aiFeatures: string[] = [];
      if (answers.aiInterest.includes("recommendations")) aiFeatures.push("Smart product recommendations based on retailer history");
      if (answers.aiInterest.includes("stock-detection")) aiFeatures.push("Shelf image analysis for stock detection");
      if (answers.aiInterest.includes("credit-scoring")) aiFeatures.push("AI-powered credit risk scoring");
      if (answers.aiInterest.includes("sales-coach")) aiFeatures.push("Personalized AI sales coaching tips");
      if (answers.aiInterest.includes("competition")) aiFeatures.push("Competition product analysis from photos");
      if (answers.aiInterest.includes("forecasting")) aiFeatures.push("Demand prediction and forecasting");
      
      recommendations.push({
        title: "AI-Powered Intelligence",
        description: "Leverage AI to augment your sales team's capabilities",
        approach: aiFeatures.length > 0 ? aiFeatures : [
          "Enable AI-powered product recommendations",
          "Set up shelf stock detection from photos",
          "Configure credit scoring for retailers"
        ],
        timeline: "Week 4-6",
        icon: Brain
      });
    }
    
    return recommendations;
  };

  // Calculate ROI Score
  const calculateROI = () => {
    let score = 0;
    
    // Process impact
    const processImpact = processOptions.find(p => p.value === answers.currentProcess)?.impact || 0;
    score += processImpact;

    // Challenges count
    score += answers.challenges.length * 5;
    
    // Distributor complexity
    if (answers.distributorCount === "50+") score += 15;
    else if (answers.distributorCount === "11-50") score += 10;
    else if (answers.distributorCount === "1-10") score += 5;
    
    score += answers.distributorChallenges.length * 3;
    
    // Institutional sales opportunity
    if (answers.hasInstitutionalSales === "yes-active") score += 10;
    else if (answers.hasInstitutionalSales === "yes-limited") score += 5;
    else if (answers.hasInstitutionalSales === "planning") score += 8;
    
    score += answers.institutionalChallenges.length * 3;
    
    // Analytics gap
    if (answers.analyticsMaturity === "none") score += 15;
    else if (answers.analyticsMaturity === "basic") score += 10;
    else if (answers.analyticsMaturity === "moderate") score += 5;
    
    score += answers.analyticsNeeds.length * 2;
    
    // AI opportunity
    if (answers.aiAdoption === "none") score += 10;
    else if (answers.aiAdoption === "curious") score += 8;
    else if (answers.aiAdoption === "experimenting") score += 5;
    
    score += answers.aiInterest.length * 2;

    // Team size factor
    const teamFactor = Math.min(answers.teamSize / 100, 1.5);
    score = score * teamFactor;

    // Normalize score to 0-100
    score = Math.min(Math.round(score), 100);

    return score;
  };

  const getScoreLevel = (score: number) => {
    if (score >= 75) return { label: "High Impact Opportunity", color: "text-green-500", bg: "bg-green-500", recommendation: "immediate" };
    if (score >= 50) return { label: "Significant Value Potential", color: "text-emerald-500", bg: "bg-emerald-500", recommendation: "pilot" };
    if (score >= 25) return { label: "Good Fit", color: "text-yellow-500", bg: "bg-yellow-500", recommendation: "explore" };
    return { label: "Moderate Opportunity", color: "text-orange-500", bg: "bg-orange-500", recommendation: "assess" };
  };

  const score = calculateROI();
  const scoreLevel = getScoreLevel(score);
  const situation = generateSituationSummary();
  const problems = generateProblemStatements();
  const recommendations = generateRecommendations();

  const renderStep = () => {
    switch (currentStep) {
      case "team":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Let&apos;s understand your team</h2>
              <p className="text-muted-foreground">How large is your field sales team?</p>
            </div>
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <span className="text-5xl font-bold text-primary">{answers.teamSize}</span>
                <span className="text-xl text-muted-foreground ml-2">field reps</span>
              </div>
              <Slider
                value={[answers.teamSize]}
                onValueChange={(v) => setAnswers(prev => ({ ...prev, teamSize: v[0] }))}
                min={5}
                max={500}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>5 reps</span>
                <span>500+ reps</span>
              </div>
            </div>
          </div>
        );

      case "process":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">How do you manage field sales today?</h2>
              <p className="text-muted-foreground">Select the option that best describes your current process</p>
            </div>
            <RadioGroup
              value={answers.currentProcess}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, currentProcess: v }))}
              className="grid gap-4 max-w-2xl mx-auto"
            >
              {processOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                    answers.currentProcess === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-1" />
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
        );

      case "challenges":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">What challenges are you facing?</h2>
              <p className="text-muted-foreground">Select all that apply to your organization</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {challengeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = answers.challenges.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleOption("challenges", option.value)}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border text-left transition-all",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "distributor":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Tell us about your distribution network</h2>
              <p className="text-muted-foreground">How many distributors do you work with?</p>
            </div>
            
            <RadioGroup
              value={answers.distributorCount}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, distributorCount: v }))}
              className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
            >
              {distributorCountOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex flex-col p-4 rounded-lg border cursor-pointer transition-all",
                    answers.distributorCount === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </Label>
              ))}
            </RadioGroup>

            {answers.distributorCount && answers.distributorCount !== "none" && (
              <div className="space-y-4 max-w-3xl mx-auto animate-fade-in">
                <p className="text-center text-muted-foreground">What distributor management challenges do you face?</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {distributorChallengeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = answers.distributorChallenges.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => toggleOption("distributorChallenges", option.value)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case "institutional":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Do you have institutional/B2B sales?</h2>
              <p className="text-muted-foreground">Hotels, restaurants, corporates, institutions</p>
            </div>
            
            <RadioGroup
              value={answers.hasInstitutionalSales}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, hasInstitutionalSales: v }))}
              className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
            >
              {institutionalOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex flex-col p-4 rounded-lg border cursor-pointer transition-all",
                    answers.hasInstitutionalSales === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </Label>
              ))}
            </RadioGroup>

            {(answers.hasInstitutionalSales === "yes-active" || answers.hasInstitutionalSales === "yes-limited") && (
              <div className="space-y-4 max-w-3xl mx-auto animate-fade-in">
                <p className="text-center text-muted-foreground">What institutional sales challenges do you face?</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {institutionalChallengeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = answers.institutionalChallenges.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => toggleOption("institutionalChallenges", option.value)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case "analytics":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">How mature is your analytics capability?</h2>
              <p className="text-muted-foreground">How do you currently track and analyze performance?</p>
            </div>
            
            <RadioGroup
              value={answers.analyticsMaturity}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, analyticsMaturity: v }))}
              className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
            >
              {analyticsMaturityOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex flex-col p-4 rounded-lg border cursor-pointer transition-all",
                    answers.analyticsMaturity === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-4 max-w-3xl mx-auto">
              <p className="text-center text-muted-foreground">What analytics capabilities would you like?</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {analyticsNeedOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = answers.analyticsNeeds.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleOption("analyticsNeeds", option.value)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "ai-readiness":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">How ready are you for AI?</h2>
              <p className="text-muted-foreground">What is your current AI adoption status?</p>
            </div>
            
            <RadioGroup
              value={answers.aiAdoption}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, aiAdoption: v }))}
              className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
            >
              {aiAdoptionOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex flex-col p-4 rounded-lg border cursor-pointer transition-all",
                    answers.aiAdoption === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-4 max-w-3xl mx-auto">
              <p className="text-center text-muted-foreground">Which AI capabilities interest you?</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {aiInterestOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = answers.aiInterest.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleOption("aiInterest", option.value)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "goals":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">What&apos;s your top priority?</h2>
              <p className="text-muted-foreground">What would make the biggest impact for your business?</p>
            </div>
            <RadioGroup
              value={answers.topPriority}
              onValueChange={(v) => setAnswers(prev => ({ ...prev, topPriority: v }))}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              {priorityOptions.map((option) => (
                <Label
                  key={option.value}
                  className={cn(
                    "flex flex-col p-5 rounded-lg border cursor-pointer transition-all",
                    answers.topPriority === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <p className="font-semibold mb-1">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </Label>
              ))}
            </RadioGroup>
          </div>
        );

      case "results":
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Personalized Assessment</h2>
              <p className="text-muted-foreground">Based on your responses, here&apos;s our analysis</p>
            </div>

            {/* ROI Score */}
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">ROI Potential Score</h3>
                <span className={cn("text-sm font-medium px-3 py-1 rounded-full", `${scoreLevel.bg}/20 ${scoreLevel.color}`)}>
                  {scoreLevel.label}
                </span>
              </div>
              <div className="flex items-end gap-4 mb-4">
                <span className="text-6xl font-bold text-primary">{score}</span>
                <span className="text-2xl text-muted-foreground mb-2">/100</span>
              </div>
              <Progress value={score} className="h-3" />
            </Card>

            {/* Current Situation Summary */}
            <Card className="p-6 border-blue-500/20 bg-blue-500/5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Your Current Situation
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team Size:</span>
                    <span className="font-medium">{situation.teamSize} field reps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Process:</span>
                    <span className="font-medium">{situation.processLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distribution:</span>
                    <span className="font-medium">{situation.distributorLabel || "No distributors"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Institutional Sales:</span>
                    <span className="font-medium">{situation.hasInstitutional ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Analytics Maturity:</span>
                    <span className="font-medium">{situation.analyticsLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Adoption:</span>
                    <span className="font-medium">{situation.aiLabel}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem Statement */}
            {problems.length > 0 && (
              <Card className="p-6 border-amber-500/20 bg-amber-500/5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Key Challenges Identified
                </h3>
                <div className="space-y-3">
                  {problems.slice(0, 5).map((problem, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{problem.area}: {problem.issue}</p>
                        <p className="text-xs text-muted-foreground">{problem.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Our Recommendations */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Our Recommendations & Approach
              </h3>
              <div className="space-y-4">
                {recommendations.map((rec, idx) => {
                  const Icon = rec.icon;
                  return (
                    <Card key={idx} className="p-5 hover:border-primary/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold">{rec.title}</h4>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{rec.timeline}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Our Approach:</p>
                            {rec.approach.map((step, stepIdx) => (
                              <div key={stepIdx} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold">Ready to Get Started?</h3>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  {scoreLevel.recommendation === "immediate" && 
                    "Your organization is perfectly positioned for QuickApp. Let's schedule a demo to show you how we can deliver immediate impact."
                  }
                  {scoreLevel.recommendation === "pilot" && 
                    "We recommend starting with a 4-week pilot program with a subset of your team to demonstrate measurable value."
                  }
                  {scoreLevel.recommendation === "explore" && 
                    "Let's have a discovery call to understand your specific needs and create a tailored implementation plan."
                  }
                  {scoreLevel.recommendation === "assess" && 
                    "You have a good foundation. Let's explore how QuickApp's advanced features can take you to the next level."
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" onClick={() => navigate("/demo")} className="gap-2">
                    Schedule a Demo <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
                    View Pricing
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <WebsiteHeader />
      
      {/* Hero */}
      <section className="pt-28 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calculator className="w-4 h-4" />
            ROI Assessment Tool
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Discover Your <span className="text-primary">ROI Potential</span>
          </h1>
          <p className="text-muted-foreground">
            Answer a few questions to understand how QuickApp can transform your field sales operations
          </p>
        </div>
      </section>

      {/* Progress */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Step {currentStepIndex + 1} of {steps.length}</span>
            <span className="font-medium">{steps[currentStepIndex].label}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </section>

      {/* Step Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="p-6 md:p-10">
            {renderStep()}
          </Card>
        </div>
      </section>

      {/* Navigation */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            {currentStep !== "results" ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setCurrentStep("team");
                  setAnswers(initialAnswers);
                }}
                variant="outline"
                className="gap-2"
              >
                <Zap className="w-4 h-4" /> Start Over
              </Button>
            )}
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};

export default ROICalculator;
