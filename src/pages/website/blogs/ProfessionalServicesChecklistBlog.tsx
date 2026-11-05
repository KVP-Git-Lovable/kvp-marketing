import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { 
  ArrowLeft, 
  CheckCircle2,
  Sparkles,
  Rocket,
  Users,
  Settings,
  GraduationCap,
  Headphones,
  BarChart3,
  RefreshCw,
  Target
} from "lucide-react";

export const ProfessionalServicesChecklistBlog = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const checklistSections = [
    {
      number: 1,
      title: "Kickoff & Alignment",
      icon: Rocket,
      color: "from-blue-500 to-cyan-500",
      items: [
        "Introductory call with Customer Success Manager (CSM) and key client stakeholders",
        "Define success criteria, business objectives, and key metrics",
        "Review scope of professional services engagement (L1, L2, L3)",
        "Establish communication channels and escalation paths"
      ]
    },
    {
      number: 2,
      title: "Discovery & Planning",
      icon: Target,
      color: "from-purple-500 to-pink-500",
      items: [
        "Collect client process documentation, current workflows, and user roles",
        "Review existing sales data and legacy systems (if any)",
        "Map user segments (field reps, managers, admins)",
        "Finalize rollout plan, training schedule, and key milestones"
      ]
    },
    {
      number: 3,
      title: "Platform Configuration & Readiness",
      icon: Settings,
      color: "from-green-500 to-emerald-500",
      items: [
        "Configure Quickapp.ai platform as per agreed requirements",
        "Set up user accounts, permissions, and access levels",
        "Import initial data (master data, user lists, retailers, products)",
        "Test integrations (if any) with ERP, CRM, or other systems"
      ]
    },
    {
      number: 4,
      title: "Training & Enablement",
      icon: GraduationCap,
      color: "from-amber-500 to-orange-500",
      items: [
        "Conduct tailored onboarding sessions for all user roles",
        "Provide training materials, job aids, and video guides",
        "Schedule proactive refresher and Q&A sessions",
        "Onboard new users as they join (ongoing)"
      ]
    },
    {
      number: 5,
      title: "Go-Live Support",
      icon: Headphones,
      color: "from-red-500 to-pink-500",
      items: [
        "Provide L1 helpdesk for login, access, and usage queries",
        "Monitor user activity and adoption in real time",
        "Track and resolve initial issues (L1/L2), escalate as needed"
      ]
    },
    {
      number: 6,
      title: "Proactive Monitoring & Reporting",
      icon: BarChart3,
      color: "from-indigo-500 to-purple-500",
      items: [
        "Set up dashboards for usage, adoption, and data quality",
        "Provide monthly usage summary and quarterly ROI/business impact reports",
        "Flag adoption gaps, inactive users, or data quality issues for action"
      ]
    },
    {
      number: 7,
      title: "Continuous Improvement",
      icon: RefreshCw,
      color: "from-teal-500 to-cyan-500",
      items: [
        "Regular CSM touchpoints and feedback sessions with key users",
        "Capture and prioritize enhancement requests (L2/L3)",
        "Recommend process tweaks or additional training as needed",
        "Provide updates on new features and quarterly enhancements"
      ]
    },
    {
      number: 8,
      title: "Success Review & Optimization",
      icon: Target,
      color: "from-amber-500 to-yellow-500",
      items: [
        "Review achievement of initial success criteria and KPIs",
        "Identify further opportunities for process or usage improvement",
        "Plan next phase of enhancements or scale-up"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2C] via-[#1A1F2C] to-[#0F1218]">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/insights")}
            className="text-white/70 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Insights
          </Button>

          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Checklist</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Professional Services{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Onboarding Checklist
            </span>
          </h1>

          <p className="text-lg text-white/70 leading-relaxed">
            A step-by-step guide to ensure a smooth, high-impact onboarding for every new customer 
            engaging with Quickapp.ai Professional Services.
          </p>
        </div>
      </section>

      {/* Checklist Sections */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-8">
            {checklistSections.map((section) => (
              <div 
                key={section.number}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${section.color} flex items-center justify-center flex-shrink-0`}>
                    <section.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50 mb-1">Step {section.number}</div>
                    <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                  </div>
                </div>
                
                <div className="ml-0 md:ml-[4.5rem] space-y-3">
                  {section.items.map((item, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-white/70">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Users className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Partnership, Not Just Onboarding</h2>
            <p className="text-lg text-white/80 mb-6">
              With QuickApp<span className="text-amber-400">.ai</span> Professional Services, onboarding is not a one-time event—it's an{" "}
              <span className="text-amber-400 font-semibold">ongoing partnership</span> to drive adoption, productivity, and ROI.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/solutions/professional-services")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              Explore Our Professional Services
            </Button>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};

export default ProfessionalServicesChecklistBlog;
