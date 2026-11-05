import { Card, CardContent } from "@/components/ui/card";
import { 
  MapPin, 
  Users, 
  Brain, 
  Trophy, 
  Building2, 
  WifiOff,
  TrendingUp,
  CreditCard,
  Globe
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Sales Guidance",
    description: "Not just data collection — AI-powered coaching that actively guides your team with smart recommendations, predictive insights, and next-best-actions.",
    color: "from-violet-500 to-purple-600"
  },
  {
    icon: MapPin,
    title: "Smart Beat Planning",
    description: "Optimize routes automatically, track GPS in real-time, manage territories, and plan visits with intelligent scheduling.",
    color: "from-blue-500 to-cyan-600"
  },
  {
    icon: Users,
    title: "Complete Retailer CRM",
    description: "360° retailer profiles, order history, payment tracking, credit management, and loyalty programs all in one place.",
    color: "from-emerald-500 to-teal-600"
  },
  {
    icon: Trophy,
    title: "Gamification Engine",
    description: "Boost team motivation with leaderboards, achievement badges, points system, and healthy competition between teams.",
    color: "from-amber-500 to-orange-600"
  },
  {
    icon: Building2,
    title: "Multi-Channel Platform",
    description: "Field Sales + Distributor Portal + Institutional CRM — manage your entire sales ecosystem from one platform.",
    color: "from-rose-500 to-pink-600"
  },
  {
    icon: WifiOff,
    title: "True Offline-First",
    description: "Full functionality without internet. Take orders, capture photos, record visits — everything syncs when you're back online.",
    color: "from-slate-500 to-gray-600"
  }
];

export const FeaturesSection = () => {
  return (
    <section id="platform" className="py-20 px-4 bg-background">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Brain className="h-4 w-4" />
            AI-First Platform • Unlimited Users
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Intelligent Tools That Guide, Not Just Track
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Built on AI-first architecture, our platform goes beyond data collection. 
            Every feature is designed to <strong>guide your sales team</strong> with intelligent recommendations and actionable insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-border/40 bg-card shadow-card hover:shadow-hero transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardContent className="p-6">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional capabilities */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: CreditCard, label: "AI Credit Scoring" },
            { icon: Globe, label: "6 Indian Languages" },
            { icon: TrendingUp, label: "Real-time Analytics" },
            { icon: Users, label: "Team Performance" }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/40">
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
