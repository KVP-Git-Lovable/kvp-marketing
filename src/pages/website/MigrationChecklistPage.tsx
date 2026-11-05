import { useEffect, useState } from "react";
import { ArrowLeft, CheckSquare, Database, Plug, Users, Rocket, BarChart3, Shield, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";

const phases = [
  {
    id: "data-continuity",
    title: "Data Continuity",
    subtitle: "The AI Foundation",
    description: "Before we flip the switch, we ensure your history powers our future.",
    icon: Database,
    color: "from-blue-500 to-cyan-500",
    items: [
      { id: "data-export", label: "Historical Data Export", description: "Extract 12–24 months of secondary sales data from your current provider." },
      { id: "data-cleanse", label: "Master Data Cleanse", description: "Validate Outlet names, GPS coordinates, and Distributor IDs. (Quickapp's AI will flag inconsistencies automatically)." },
      { id: "product-mapping", label: "Product Mapping", description: "Align SKUs and categories for Predictive Analytics training." },
      { id: "hierarchy-sync", label: "Hierarchy Sync", description: "Define Reporting Lines (Rep → Manager → Regional Head) to mirror your organization." }
    ]
  },
  {
    id: "technical-bridge",
    title: "Technical Bridge",
    subtitle: "The ERP Link",
    description: "Connecting the brain (Quickapp.ai) to the nervous system (Your ERP).",
    icon: Plug,
    color: "from-purple-500 to-pink-500",
    items: [
      { id: "api-config", label: "API/SFTP Configuration", description: "Establish the data handshake with your ERP (SAP, Oracle, Tally, etc.)." },
      { id: "inventory-sync", label: "Inventory Sync", description: "Ensure real-time visibility of distributor stock levels." },
      { id: "scheme-engine", label: "Scheme & Discount Engine", description: "Port over your current trade promotions and loyalty programs." },
      { id: "tax-compliance", label: "Tax & Compliance Check", description: "Verify GST/tax calculations are localized for all operational regions." }
    ]
  },
  {
    id: "team-readiness",
    title: "Team Readiness",
    subtitle: "The Human Factor",
    description: "Moving from 'Recording Data' to 'Winning the Aisle.'",
    icon: Users,
    color: "from-green-500 to-emerald-500",
    items: [
      { id: "champion-selection", label: "Champion Selection", description: "Identify 'Lead Users' to pilot the AI features first." },
      { id: "ui-orientation", label: "The 'Modern UI' Orientation", description: "A 30-minute session to show reps how much faster Quickapp.ai is than their old app." },
      { id: "ai-workshop", label: "AI-Forward Selling Workshop", description: "Train reps to use 'Predictive Orders' as a tool to close bigger deals." },
      { id: "manager-training", label: "Manager Dashboard Training", description: "Teach leaders how to respond to AI 'Nudges' rather than just reading old reports." }
    ]
  },
  {
    id: "switchover",
    title: "The Switchover",
    subtitle: "Zero-Downtime Launch",
    description: "Executing a smooth transition with no lost orders.",
    icon: Rocket,
    color: "from-amber-500 to-orange-500",
    items: [
      { id: "parallel-run", label: "Parallel Run (Optional)", description: "Run Quickapp.ai alongside the legacy system for 3–5 days in a test territory." },
      { id: "delta-sync", label: "Final Delta Sync", description: "Perform a final data pull from the legacy app to ensure the most recent orders are captured." },
      { id: "account-provisioning", label: "Account Provisioning", description: "SMS/WhatsApp credentials sent to all field users." },
      { id: "legacy-deactivation", label: "Legacy Deactivation", description: "Officially sunset the old platform to ensure a single source of truth." }
    ]
  },
  {
    id: "optimization",
    title: "Optimization",
    subtitle: "The AI Advantage",
    description: "Turning on the 'Forward' in Forward Commerce.",
    icon: BarChart3,
    color: "from-red-500 to-rose-500",
    items: [
      { id: "baseline-comparison", label: "Baseline Comparison", description: "Compare Week 1 'Fill Rates' against legacy benchmarks." },
      { id: "route-audit", label: "Route Optimization Audit", description: "Review travel-time savings from the Dynamic Beat Mapping." },
      { id: "shelf-ai", label: "Shelf-AI Activation", description: "Begin using Computer Vision for instant stock and Share-of-Shelf (SOS) audits." }
    ]
  }
];

export default function MigrationChecklistPage() {
  const navigate = useNavigate();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const toggleItem = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    setCheckedItems(newChecked);
  };

  const totalItems = phases.reduce((sum, phase) => sum + phase.items.length, 0);
  const completedItems = checkedItems.size;
  const progressPercent = Math.round((completedItems / totalItems) * 100);

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

          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-4">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">5-Step Path</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Migration <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Checklist</span>
          </h1>

          <p className="text-lg text-white/70 mb-6">
            The "Legacy to AI-Forward" Migration Checklist — Your 5-Step Path to Modern FMCG Distribution
          </p>

          <p className="text-white/60 mb-8">
            Moving to Quickapp.ai is designed to be seamless. Use this checklist to ensure your data, your team, and your distributors are ready for the intelligence upgrade.
          </p>

          {/* Progress Bar */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">Migration Progress</span>
              <span className="text-amber-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-white/50 text-sm mt-2">{completedItems} of {totalItems} items completed</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-white text-gray-900 hover:bg-gray-100 font-medium"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Checklist
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </section>

      {/* Phases Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl space-y-8">
          {phases.map((phase, phaseIndex) => {
            const phaseCompleted = phase.items.filter(item => checkedItems.has(item.id)).length;
            const phaseTotal = phase.items.length;

            return (
              <div key={phase.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Phase Header */}
                <div className={`bg-gradient-to-r ${phase.color} p-6`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <phase.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/80 text-sm font-medium">Phase {phaseIndex + 1}</span>
                        <span className="text-white/60">•</span>
                        <span className="text-white/80 text-sm">{phase.subtitle}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">{phase.title}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold text-lg">{phaseCompleted}/{phaseTotal}</span>
                      <p className="text-white/70 text-sm">Complete</p>
                    </div>
                  </div>
                  <p className="text-white/80 mt-3 text-sm">{phase.description}</p>
                </div>

                {/* Phase Items */}
                <div className="p-6 space-y-4">
                  {phase.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                        checkedItems.has(item.id)
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <Checkbox
                        checked={checkedItems.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                      <div className="flex-1">
                        <h4 className={`font-medium ${checkedItems.has(item.id) ? "text-green-400 line-through" : "text-white"}`}>
                          {item.label}
                        </h4>
                        <p className={`text-sm mt-1 ${checkedItems.has(item.id) ? "text-white/40" : "text-white/60"}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Zero-Friction Promise */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">The Quickapp.ai "Zero-Friction" Promise</h3>
            </div>
            <p className="text-white/80 text-lg italic">
              "We don't just replace your old app; we inherit its data and amplify its value. Most migrations are completed in under 30 days with zero downtime for your distributors."
            </p>
          </div>
        </div>
      </section>

      {/* How to Use */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-6">How to use this checklist:</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                <Printer className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-white font-medium mb-2">Print it as a 1-pager</h4>
              <p className="text-white/60 text-sm">Use your brand colors and the Quickapp.ai logo.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="text-white font-medium mb-2">Use it in the first meeting</h4>
              <p className="text-white/60 text-sm">When a prospect says "it's too hard to switch," pull this out and show them the process is already solved.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
                <Download className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="text-white font-medium mb-2">Collaborative Tool</h4>
              <p className="text-white/60 text-sm">Send this as a digital file (PDF) to the IT Head to show them you speak their language.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
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
                onClick={() => navigate("/insights/migration-plan")}
              >
                View Full Migration Plan
              </Button>
            </div>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
}
