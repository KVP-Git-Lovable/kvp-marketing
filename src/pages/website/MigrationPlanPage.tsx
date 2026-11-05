import { useEffect } from "react";
import { ArrowLeft, Calendar, Database, Plug, Users, Rocket, CheckCircle, Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";

const weeks = [
  {
    week: "Week 1",
    title: "The Intelligence Audit",
    subtitle: "Foundations",
    icon: Database,
    goal: "Audit legacy data and define the AI 'Success Metrics.'",
    color: "from-blue-500 to-cyan-500",
    tasks: [
      {
        title: "Data Extraction",
        description: "Export master data from the legacy system (Outlets, Distributors, SKU lists, and 12-18 months of transaction history)."
      },
      {
        title: "Data Cleansing",
        description: "Use Quickapp's Clean-Slate Tool to remove duplicate outlets and standardize 'Beat' naming conventions."
      },
      {
        title: "KPI Mapping",
        description: "Define what 'Forward Commerce' looks like for the client (e.g., Target a 10% reduction in stock-outs)."
      },
      {
        title: "Stakeholder Alignment",
        description: "Identify 'Champion Users' (top sales reps) for the pilot phase."
      }
    ]
  },
  {
    week: "Week 2",
    title: "Ecosystem Integration",
    subtitle: "The Digital Bridge",
    icon: Plug,
    goal: "Connect Quickapp.ai to the client's existing backend (ERP/Tally/SAP).",
    color: "from-purple-500 to-pink-500",
    tasks: [
      {
        title: "ERP Sync",
        description: "Establish real-time API or SFTP hooks for primary sales and stock levels."
      },
      {
        title: "AI Model Priming",
        description: "Ingest historical data into the Predictive Demand Engine. This allows the AI to 'learn' the client's seasonal cycles before the reps even log in."
      },
      {
        title: "UI Customization",
        description: "Configure the mobile interface to match the client's specific field workflows (e.g., custom survey forms or visual merchandising modules)."
      }
    ]
  },
  {
    week: "Week 3",
    title: "The AI-Forward Pilot",
    subtitle: "Calibration",
    icon: Users,
    goal: "Test the 'Predictive Ordering' in a controlled environment.",
    color: "from-green-500 to-emerald-500",
    tasks: [
      {
        title: "Pilot Launch",
        description: "Deploy to one region or a small team of 10-15 reps."
      },
      {
        title: "Parallel Run",
        description: "Reps use Quickapp.ai in the field while the legacy app remains as a backup (shadow mode)."
      },
      {
        title: "Model Validation",
        description: "Compare AI-suggested orders vs. actual orders placed. Adjust the 'Nudge Engine' sensitivity based on field feedback."
      },
      {
        title: "Route Optimization",
        description: "First test of the Dynamic Beat Mapping to ensure travel time is actually decreasing."
      }
    ]
  },
  {
    week: "Week 4",
    title: "Training & The Switchover",
    subtitle: "Go-Live",
    icon: Rocket,
    goal: "Phase out the legacy system and empower the entire field force.",
    color: "from-amber-500 to-orange-500",
    tasks: [
      {
        title: "The 'Big Bang' or 'Phased' Cutover",
        description: "Move the remaining regions to Quickapp.ai."
      },
      {
        title: "Training Workshops",
        description: "Focus not just on 'how to use the app,' but on 'how to sell with AI.' (e.g., 'How to use the Predictive Order screen to close a larger deal')."
      },
      {
        title: "Legacy Decommission",
        description: "Disable data entry on the old system to ensure Quickapp.ai becomes the single source of truth."
      }
    ]
  },
  {
    week: "Weeks 5-6",
    title: "Stabilization & Scaling",
    subtitle: "Optimization",
    icon: CheckCircle,
    goal: "Move from 'Learning' to 'Winning.'",
    color: "from-red-500 to-rose-500",
    tasks: [
      {
        title: "Hyper-Care Support",
        description: "24/7 technical 'War Room' to handle any field sync issues."
      },
      {
        title: "Impact Reporting",
        description: "First 'Forward Commerce' report delivered to HQ—showing improvements in Fill Rate and Retailer Satisfaction."
      },
      {
        title: "Feature Expansion",
        description: "Enable advanced modules like Computer Vision for Shelf Analytics or Automated Scheme Payouts."
      }
    ]
  }
];

const secretSauce = [
  {
    icon: Zap,
    title: "The 'History Ingester'",
    description: "We don't start from zero. We take your Bizom data and use it to 'train' our AI so that on Day 1, your reps already have intelligent suggestions."
  },
  {
    icon: Shield,
    title: "Zero-Downtime Guarantee",
    description: "Your distributors won't even notice the switch. The backend remains stable while the field force gets a massive intelligence upgrade."
  }
];

export default function MigrationPlanPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2C] via-[#1A1F2C] to-[#0F1218]">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white mb-6"
            onClick={() => navigate("/insights")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Insights
          </Button>

          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-4">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">4-6 Week Implementation</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Migration <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Plan</span>
          </h1>

          <p className="text-lg text-white/70 mb-6">
            Migrating from a legacy system like Bizom or FieldAssist to an AI-Forward platform like Quickapp.ai isn't just a technical swap—it's an <span className="text-amber-400 font-semibold">operational upgrade</span>.
          </p>

          <p className="text-white/60">
            To ensure zero business disruption while "priming" your AI models, here is a professional 4-6 Week Migration Roadmap designed to move your clients from reactive tracking to predictive selling.
          </p>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Quickapp.ai Implementation Roadmap
          </h2>

          <div className="space-y-8">
            {weeks.map((week, index) => (
              <div key={index} className="relative">
                {/* Timeline connector */}
                {index < weeks.length - 1 && (
                  <div className="absolute left-7 top-20 w-0.5 h-full bg-gradient-to-b from-white/20 to-transparent" />
                )}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${week.color} flex items-center justify-center flex-shrink-0`}>
                      <week.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold bg-gradient-to-r ${week.color} bg-clip-text text-transparent`}>
                          {week.week}
                        </span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/60 text-sm">{week.subtitle}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">{week.title}</h3>
                    </div>
                  </div>

                  {/* Goal */}
                  <div className="bg-white/5 rounded-lg p-3 mb-4">
                    <p className="text-sm text-white/80">
                      <span className="text-amber-400 font-semibold">Goal:</span> {week.goal}
                    </p>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-3">
                    {week.tasks.map((task, taskIndex) => (
                      <div key={taskIndex} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{task.title}</h4>
                          <p className="text-white/60 text-sm">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secret Sauce Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            💡 Migration "Secret Sauce"
          </h2>
          <p className="text-white/70 mb-6">
            To make this roadmap more attractive to your customers, emphasize these two points:
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {secretSauce.map((item, index) => (
              <div key={index} className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-white/70 text-sm">"{item.description}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">Ready to Start Your Migration?</h3>
            <p className="text-white/70 mb-6">Get a personalized migration plan for your organization</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                onClick={() => navigate("/auth")}
              >
                Request Demo
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => navigate("/insights/migration-checklist")}
              >
                View Migration Checklist
              </Button>
            </div>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
}
