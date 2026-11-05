import { useState, useEffect } from "react";
import { Check, Sparkles, Target, Brain, BarChart3, Users, Trophy, Truck, Building2, Shield, Settings, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";

const featureCategories = [
  {
    id: "sales",
    title: "Sales Execution",
    shortTitle: "Sales",
    icon: Target,
    color: "from-amber-500 to-orange-500",
    tagline: "Execute flawlessly in the field",
    features: [
      { name: "Beat Planning & Management", description: "Create, assign, and optimize sales beats with territory mapping" },
      { name: "Visit Management", description: "Plan, execute, and track retailer visits with check-in/check-out" },
      { name: "Order Entry", description: "Quick order capture with product catalog, pricing, and schemes" },
      { name: "Attendance Management", description: "Face-verified check-in/check-out with GPS location" },
      { name: "GPS Tracking", description: "Real-time location tracking and journey mapping" },
      { name: "Route Optimization", description: "AI-suggested optimal visit routes to save time" },
      { name: "No-Order Capture", description: "Record reasons for unproductive visits" },
      { name: "Visit Calendar", description: "Weekly and monthly visit planning view" },
      { name: "Joint Sales Visits", description: "Manager accompaniment tracking and feedback" },
    ]
  },
  {
    id: "ai",
    title: "AI Intelligence",
    shortTitle: "AI",
    icon: Brain,
    color: "from-purple-500 to-pink-500",
    tagline: "Smart insights that drive results",
    features: [
      { name: "Sales Coach AI", description: "AI-powered sales recommendations and coaching tips" },
      { name: "Stock Image Analysis", description: "AI scans shelf images to detect stock levels" },
      { name: "Credit Score AI", description: "Automatic retailer credit scoring based on payment history" },
      { name: "Smart Recommendations", description: "AI-suggested products based on retailer history" },
      { name: "Competition Insight AI", description: "Analyze competitor products from photos" },
      { name: "Board Scanning", description: "OCR to capture retailer information from signboards" },
      { name: "Voice Notes", description: "Voice-to-text for quick note capture" },
      { name: "Chat Assistant", description: "AI chatbot for instant answers and support" },
      { name: "Predictive Analytics", description: "Forecast sales trends and demand patterns" },
    ]
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    shortTitle: "Analytics",
    icon: BarChart3,
    color: "from-blue-500 to-cyan-500",
    tagline: "Data-driven decisions",
    features: [
      { name: "Real-time Dashboard", description: "Live sales, visits, and performance metrics" },
      { name: "Performance Reports", description: "Detailed reports on team and individual performance" },
      { name: "Beat Analytics", description: "Analysis of beat productivity and coverage" },
      { name: "Retailer Analytics", description: "Deep dive into retailer performance and trends" },
      { name: "Territory Dashboard", description: "Territory-wise sales and coverage analysis" },
      { name: "Target vs Achievement", description: "Track progress against sales targets" },
      { name: "Trend Analysis", description: "Historical trends and growth patterns" },
      { name: "Export Reports", description: "Download reports in Excel/PDF formats" },
      { name: "Custom KPIs", description: "Configure and track custom performance metrics" },
    ]
  },
  {
    id: "retailer",
    title: "Retailer Management",
    shortTitle: "Retailers",
    icon: Users,
    color: "from-green-500 to-emerald-500",
    tagline: "Build lasting relationships",
    features: [
      { name: "Retailer Profiles", description: "Complete retailer information with photos and location" },
      { name: "Loyalty Programs", description: "Points-based rewards and redemption system" },
      { name: "Scheme Management", description: "Create and apply promotional schemes" },
      { name: "Credit Management", description: "Credit limits, outstanding tracking, and alerts" },
      { name: "Payment Collection", description: "Record payments with proof upload" },
      { name: "Retailer Feedback", description: "Capture and track retailer feedback" },
      { name: "Baseline Photos", description: "Store reference photos for each retailer" },
      { name: "Order History", description: "Complete order history and trends per retailer" },
      { name: "Bulk Import", description: "Import retailers from Excel files" },
    ]
  },
  {
    id: "gamification",
    title: "Gamification",
    shortTitle: "Gamification",
    icon: Trophy,
    color: "from-yellow-500 to-amber-500",
    tagline: "Motivate and engage teams",
    features: [
      { name: "Leaderboard", description: "Real-time rankings with daily, weekly, monthly views" },
      { name: "Badges & Achievements", description: "Earn badges for hitting milestones" },
      { name: "Points System", description: "Earn points for productive activities" },
      { name: "Team Competition", description: "Territory and team-based competitions" },
      { name: "Streak Tracking", description: "Track consecutive productive days" },
      { name: "Performance Calendar", description: "Visual calendar showing daily performance" },
      { name: "Rewards Management", description: "Configure and distribute rewards" },
      { name: "Goal Setting", description: "Personal and team goal tracking" },
      { name: "Recognition Alerts", description: "Real-time notifications for achievements" },
    ]
  },
  {
    id: "van",
    title: "Van Sales",
    shortTitle: "Van Sales",
    icon: Truck,
    color: "from-orange-500 to-red-500",
    tagline: "Mobile commerce made easy",
    features: [
      { name: "Morning Inventory", description: "Load van stock at start of day" },
      { name: "Stock Management", description: "Track van inventory in real-time" },
      { name: "Route Sales", description: "Execute sales directly from van" },
      { name: "Closing Stock", description: "End-of-day stock reconciliation" },
      { name: "Return Stock", description: "Process and track returned items" },
      { name: "Invoice Generation", description: "Generate invoices on-the-spot" },
      { name: "Cash Collection", description: "Track cash and payment collection" },
      { name: "Stock Transfer", description: "Transfer stock between vans" },
      { name: "Route Analysis", description: "Analyze van route performance" },
    ]
  },
  {
    id: "distributor",
    title: "Distributor Portal",
    shortTitle: "Distributors",
    icon: Building2,
    color: "from-indigo-500 to-purple-500",
    tagline: "Empower your distribution network",
    features: [
      { name: "Primary Orders", description: "Place and track orders to company" },
      { name: "Inventory Management", description: "Track distributor stock levels" },
      { name: "Claims Management", description: "Submit and track claims" },
      { name: "Goods Receipt", description: "Receive and verify shipments" },
      { name: "Secondary Sales", description: "Track sales to retailers" },
      { name: "Business Planning", description: "Annual business plan and targets" },
      { name: "Contact Management", description: "Manage distributor team contacts" },
      { name: "Support Requests", description: "Raise and track support tickets" },
      { name: "Idea Submission", description: "Submit product and market ideas" },
    ]
  },
  {
    id: "enterprise",
    title: "Enterprise Features",
    shortTitle: "Enterprise",
    icon: Shield,
    color: "from-slate-500 to-gray-600",
    tagline: "Built for scale",
    features: [
      { name: "Multi-Language Support", description: "Hindi, Tamil, Telugu, Kannada, Gujarati, English" },
      { name: "Offline-First", description: "Full functionality without internet" },
      { name: "Role-Based Access", description: "Granular permissions and security" },
      { name: "User Management", description: "Create and manage user accounts" },
      { name: "Territory Management", description: "Hierarchical territory structure" },
      { name: "Holiday Management", description: "Configure holidays and leave" },
      { name: "Approval Workflows", description: "Multi-level approval processes" },
      { name: "Audit Trail", description: "Track all system activities" },
      { name: "Data Export", description: "Export data for external analysis" },
    ]
  },
  {
    id: "integration",
    title: "Integration & Support",
    shortTitle: "Integrations",
    icon: Settings,
    color: "from-rose-500 to-pink-500",
    tagline: "Connect everything",
    features: [
      { name: "WhatsApp Integration", description: "Send invoices and notifications via WhatsApp" },
      { name: "SMS Notifications", description: "Configurable SMS alerts" },
      { name: "Push Notifications", description: "Real-time app notifications" },
      { name: "PWA Support", description: "Install as native app on any device" },
      { name: "API Access", description: "REST APIs for integration" },
      { name: "Supabase Backend", description: "Secure and scalable cloud backend" },
      { name: "Real-time Sync", description: "Instant data synchronization" },
      { name: "Branding Requests", description: "Request and track branding materials" },
      { name: "Vendor Management", description: "Manage external vendors" },
    ]
  }
];

const FeatureListPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(featureCategories[0].id);
  
  const currentCategory = featureCategories.find(c => c.id === activeCategory) || featureCategories[0];
  const currentIndex = featureCategories.findIndex(c => c.id === activeCategory);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2C] via-[#1A1F2C] to-[#0F1218]">
      {/* Website Header */}
      <WebsiteHeader />

      {/* Hero Section - Compact */}
      <section className="pt-8 pb-6 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">AI-First • Unlimited Users • 100+ Features</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Intelligent Tools That Guide Your Team
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto mb-2">
            Built on AI-first architecture — our platform doesn't just collect data, it <strong className="text-white/90">guides your sales team</strong> to success.
          </p>
          <p className="text-white/60 max-w-xl mx-auto flex items-center justify-center gap-2">
            <span>Select a category below</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </p>
        </div>
      </section>

      {/* Category Tabs - Prominent and Clear */}
      <section className="px-4 pb-4 sticky top-[60px] z-40 bg-gradient-to-b from-[#1A1F2C] to-[#1A1F2C]/95 backdrop-blur-sm">
        <div className="container mx-auto">
          {/* Scrollable tabs */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2 min-w-max">
              {featureCategories.map((category, idx) => {
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 whitespace-nowrap font-medium",
                      isActive 
                        ? `bg-gradient-to-r ${category.color} text-white shadow-lg scale-105` 
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                    )}
                  >
                    <category.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{category.shortTitle}</span>
                    <span className="sm:hidden">{category.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="flex gap-1 mt-3 justify-center">
            {featureCategories.map((category, idx) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  activeCategory === category.id 
                    ? "w-8 bg-gradient-to-r from-amber-500 to-orange-500" 
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Content - Clear visual connection */}
      <section className="px-4 pb-20">
        <div className="container mx-auto">
          {/* Category Header Card */}
          <div 
            key={activeCategory}
            className="animate-fade-in"
          >
            <div className={cn(
              "rounded-2xl p-6 md:p-8 mb-6 bg-gradient-to-br border",
              `${currentCategory.color.replace('from-', 'from-').replace(' to-', '/20 to-')}/10 border-white/10`
            )}>
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br",
                  currentCategory.color
                )}>
                  <currentCategory.icon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{currentCategory.title}</h2>
                  <p className="text-white/60 text-lg">{currentCategory.tagline}</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-bold text-white">{currentCategory.features.length}</span>
                  <p className="text-white/40 text-sm">features</p>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentCategory.features.map((feature, index) => (
                <div 
                  key={feature.name}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] group animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110 bg-gradient-to-br",
                      currentCategory.color
                    )}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1 group-hover:text-amber-300 transition-colors">{feature.name}</h3>
                      <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation between categories */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
              <button
                onClick={() => {
                  const prevIdx = currentIndex === 0 ? featureCategories.length - 1 : currentIndex - 1;
                  setActiveCategory(featureCategories[prevIdx].id);
                }}
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span className="text-sm">Previous: {featureCategories[currentIndex === 0 ? featureCategories.length - 1 : currentIndex - 1].shortTitle}</span>
              </button>
              
              <Button 
                className={cn("bg-gradient-to-r text-white", currentCategory.color)}
                onClick={() => navigate("/request-demo")}
              >
                Try {currentCategory.shortTitle}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              
              <button
                onClick={() => {
                  const nextIdx = currentIndex === featureCategories.length - 1 ? 0 : currentIndex + 1;
                  setActiveCategory(featureCategories[nextIdx].id);
                }}
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <span className="text-sm">Next: {featureCategories[currentIndex === featureCategories.length - 1 ? 0 : currentIndex + 1].shortTitle}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-t border-white/10">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Ready to Experience All Features?
          </h2>
          <p className="text-lg text-white/60 mb-6 max-w-xl mx-auto">
            Start your free trial and explore every feature with your team.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8"
              onClick={() => navigate("/request-demo")}
            >
              Request Demo
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 px-8"
              onClick={() => navigate("/roi-calculator")}
            >
              Calculate ROI
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="container mx-auto text-center text-white/40 text-sm">
          © 2024 QuickApp.AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default FeatureListPage;
