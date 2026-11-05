import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Zap, WifiOff, Trophy, Building2, Users, Brain, DollarSign, Sparkles } from "lucide-react";

const uspItems = [
  {
    icon: Users,
    title: "One Price, Unlimited Users",
    description: "Unlike others who charge per user, we believe everyone in your organization deserves the power of digital and AI. Pay one price, add as many users as you need.",
    highlight: "No per-user fees"
  },
  {
    icon: DollarSign,
    title: "Success-Based Pricing",
    description: "We're invested in your success. Our pricing is tied to the value we create for your business, not the number of seats. Your growth is our growth.",
    highlight: "Pay for results"
  },
  {
    icon: Brain,
    title: "AI-First Architecture",
    description: "Built from the ground up with AI at its core. Not just data collection — our platform actively guides your sales team with intelligent recommendations, coaching, and predictive insights.",
    highlight: "Guides, not just tracks"
  },
  {
    icon: Sparkles,
    title: "Intelligent Sales Guidance",
    description: "AI Sales Coach, smart product recommendations, credit scoring, and predictive analytics guide every decision. Your team gets smarter with every interaction.",
    highlight: "Beyond data collection"
  },
  {
    icon: WifiOff,
    title: "True Offline-First Architecture",
    description: "Unlike competitors who offer limited offline, QuickApp.AI works 100% offline. Take orders, capture photos, record visits — everything works without internet.",
    highlight: "100% functionality offline"
  },
  {
    icon: Building2,
    title: "Triple Platform Coverage",
    description: "Field Sales + Distributor Portal + Institutional CRM in one unified platform. Manage your entire sales ecosystem without juggling multiple tools.",
    highlight: "3 platforms in 1"
  }
];

const comparisonData = [
  { feature: "Unlimited Users", quickapp: true, others: "Per User $$" },
  { feature: "Success-Based Pricing", quickapp: true, others: false },
  { feature: "AI-First Architecture", quickapp: true, others: "Add-on" },
  { feature: "Intelligent Guidance", quickapp: true, others: false },
  { feature: "True Offline Mode", quickapp: true, others: "Limited" },
  { feature: "Native Gamification", quickapp: true, others: false },
  { feature: "Distributor Portal", quickapp: true, others: "Separate" },
  { feature: "Multi-Language (6+)", quickapp: true, others: "2-3" },
];

export const USPSection = () => {
  return (
    <section id="why-us" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent-gold/10 text-accent-gold px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Why Choose QuickApp.AI
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Not Just Another SFA — An Intelligent Sales Partner
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            We built QuickApp.AI with a revolutionary approach: <strong>one price, unlimited users</strong>, 
            powered by <strong>AI-first architecture</strong> that guides your team to success — not just collects data.
          </p>
        </div>

        {/* Pricing Philosophy Banner */}
        <div className="mb-12 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-accent-gold/10 to-accent-bronze/10 border border-accent-gold/20">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-bronze flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">Our Pricing Philosophy</h3>
              <p className="text-muted-foreground">
                We don't believe in charging per user. Everyone in your firm should have access to the power of digital and AI. 
                Our success-based model means we're partners in your growth — when you succeed, we succeed.
              </p>
            </div>
          </div>
        </div>

        {/* USP Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {uspItems.map((item, index) => (
            <Card key={index} className="border-border/40 bg-card shadow-card overflow-hidden group hover:shadow-hero transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold to-accent-bronze flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="inline-block px-2 py-1 bg-accent-gold/10 text-accent-gold text-xs font-medium rounded mb-2">
                      {item.highlight}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
            QuickApp.AI vs. Traditional SFA
          </h3>
          <div className="rounded-xl border border-border/40 overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-3 bg-primary text-primary-foreground font-semibold">
              <div className="p-4">Feature</div>
              <div className="p-4 text-center border-l border-white/20">QuickApp.AI</div>
              <div className="p-4 text-center border-l border-white/20">Others</div>
            </div>
            {comparisonData.map((row, index) => (
              <div 
                key={index} 
                className={`grid grid-cols-3 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
              >
                <div className="p-4 text-foreground font-medium">{row.feature}</div>
                <div className="p-4 text-center border-l border-border/40">
                  {row.quickapp === true ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">{row.quickapp}</span>
                  )}
                </div>
                <div className="p-4 text-center border-l border-border/40">
                  {row.others === true ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : row.others === false ? (
                    <X className="h-5 w-5 text-red-400 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground text-sm">{row.others}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
