import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { 
  Eye, 
  Brain, 
  MessageSquare, 
  Shield, 
  Target, 
  ScanFace,
  WifiOff,
  MapPin,
  Languages,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  CheckCircle2
} from "lucide-react";

const TechnologyPage = () => {
  const navigate = useNavigate();

  const coreModules = [
    {
      icon: Eye,
      title: "Vision Intelligence (VI)",
      techBadge: "Google Gemini 2.5 Pro + CNNs",
      description: "AI-powered image recognition that transforms photos into actionable data.",
      capabilities: [
        "Shelf/Board Recognition: Extracts retailer info from shop boards",
        "Competition Photo Analysis: Identifies competitor products, pricing, positioning",
        "Wall Measurement: Auto-calculates branding dimensions from photos",
        "Stock Image Analysis: Reads stock levels from shelf photos"
      ],
      outcome: "90% reduction in manual data entry",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Brain,
      title: "AI Sales Coach & Nudge Engine",
      techBadge: "Collaborative Filtering + Gemini AI",
      description: "Real-time guidance that transforms every sales rep into a top performer.",
      capabilities: [
        "Real-time product recommendations based on retailer history",
        "Visit-level AI insights (what to pitch, what to avoid)",
        "Cross-segment analysis to identify 'Growth Gaps'",
        "Personalized scheme suggestions per retailer"
      ],
      outcome: "15% increase in order value per visit",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: MessageSquare,
      title: "Intelligent Chat Assistant (ICA)",
      techBadge: "Natural Language Processing + Gemini",
      description: "Query your sales data in plain language, get instant answers.",
      capabilities: [
        "Natural language queries: 'Show my top 10 retailers'",
        "Trend analysis: 'Which products are trending in Zone A?'",
        "Contextual responses based on user role",
        "Multi-language support for regional teams"
      ],
      outcome: "Instant answers without navigating reports",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Shield,
      title: "Predictive Credit Scoring Engine (CSE)",
      techBadge: "Weighted Algorithmic Scoring + Edge Functions",
      description: "AI-driven credit risk assessment that protects your bottom line.",
      capabilities: [
        "Real-time credit score calculation (0-100)",
        "Multi-factor analysis: Payment history, order frequency, tenure",
        "Dynamic credit limit suggestions",
        "Risk alerts for collection teams"
      ],
      outcome: "40% reduction in bad debt",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Target,
      title: "Competition Intelligence (CI)",
      techBadge: "Vision AI + Trend Analysis",
      description: "Real-time market intelligence at every outlet you visit.",
      capabilities: [
        "Photo-based competitor product detection",
        "Pricing intelligence extraction",
        "Market positioning insights",
        "AI-generated competition summaries"
      ],
      outcome: "Real-time market intelligence at every outlet",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: ScanFace,
      title: "Face Match Verification (FMV)",
      techBadge: "Biometric AI + Secure Matching",
      description: "Selfie-based attendance verification that ensures authenticity.",
      capabilities: [
        "Selfie-based attendance verification",
        "Prevents proxy attendance",
        "Works offline with sync",
        "Privacy-first design"
      ],
      outcome: "100% attendance authenticity",
      color: "from-indigo-500 to-purple-500"
    }
  ];

  const infrastructureModules = [
    {
      icon: WifiOff,
      title: "Offline-First Data Architecture (OFDA)",
      techBadge: "Capacitor Preferences + Service Workers + PWA",
      highlights: [
        "Full functionality without internet",
        "Intelligent sync queue with conflict resolution",
        "Delta sync for bandwidth efficiency",
        "Works in rural/low-connectivity areas"
      ],
      outcome: "Zero data loss, even in remote areas"
    },
    {
      icon: MapPin,
      title: "GPS Journey Intelligence (GJT)",
      techBadge: "Browser Geolocation API + Background Tracking",
      highlights: [
        "Real-time location tracking during field work",
        "Geo-tagged check-ins with photo proof",
        "Journey visualization on maps",
        "Distance and time analytics"
      ],
      outcome: "Complete visibility into field operations"
    },
    {
      icon: Languages,
      title: "Multi-Language Intelligence",
      techBadge: "i18next + 6 Regional Languages",
      highlights: [
        "English, Hindi, Telugu, Tamil, Kannada, Gujarati",
        "Real-time language switching",
        "Localized AI responses",
        "Regional date/number formats"
      ],
      outcome: "Adoption across diverse teams"
    }
  ];

  const comparisonData = [
    { feature: "Data Entry", traditional: "Manual forms, error-prone", quickapp: "AI extracts from photos automatically" },
    { feature: "Recommendations", traditional: "Generic reports, post-visit", quickapp: "Real-time, personalized nudges" },
    { feature: "Offline Work", traditional: "Limited or none", quickapp: "Full functionality, smart sync" },
    { feature: "Credit Decisions", traditional: "Gut feel, spreadsheets", quickapp: "AI-scored, data-driven" },
    { feature: "Competition Data", traditional: "Quarterly surveys", quickapp: "Real-time photo analysis" },
    { feature: "Language Support", traditional: "English only", quickapp: "6 regional languages" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsiteHeader />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-gold)/0.15),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-accent-gold/20 backdrop-blur px-4 py-2 rounded-full text-accent-gold text-sm border border-accent-gold/40 font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-First Architecture
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
              Built on <span className="text-accent-gold">AI-First</span> Architecture
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-4">
              Not just automation. <strong className="text-foreground">Intelligent guidance</strong> that transforms how your sales team works.
            </p>
            
            <p className="text-lg text-muted-foreground/80 mb-8">
              While others digitize paper processes, we've reimagined sales with AI at the core.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/auth')}
                className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-lg"
              >
                See AI in Action
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/roi-calculator')}
                className="border-border"
              >
                Calculate Your ROI
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core AI Modules */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Core AI Modules
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Six powerful AI engines working together to guide your sales team to success.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((module, index) => (
              <div 
                key={index}
                className="group bg-card border border-border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Icon & Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color} text-white`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground mb-1">{module.title}</h3>
                    <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {module.techBadge}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-muted-foreground text-sm mb-4">
                  {module.description}
                </p>

                {/* Capabilities */}
                <ul className="space-y-2 mb-4">
                  {module.capabilities.map((cap, capIndex) => (
                    <li key={capIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent-gold mt-0.5 flex-shrink-0" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>

                {/* Outcome */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent-gold" />
                    <span className="text-sm font-semibold text-accent-gold">{module.outcome}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              How It All Connects
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every module works in harmony, processing data through our AI layer to deliver intelligent guidance.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative bg-card border border-border rounded-2xl p-8 md:p-12">
              {/* Flow Diagram */}
              <div className="space-y-8">
                {/* User Actions */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-accent-gold/10 border border-accent-gold/30 rounded-full px-6 py-3">
                    <Zap className="h-5 w-5 text-accent-gold" />
                    <span className="font-semibold text-foreground">User Actions</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Photos • Voice • Text • GPS</p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-px h-8 bg-gradient-to-b from-accent-gold to-primary" />
                </div>

                {/* AI Processing */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                    <Eye className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Vision AI</span>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                    <Brain className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Nudge Engine</span>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                    <MessageSquare className="h-6 w-6 text-green-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Chat AI</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-px h-8 bg-gradient-to-b from-primary to-accent-gold" />
                </div>

                {/* AI Core */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-full px-6 py-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">AI Processing Layer</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Google Gemini 2.5 Pro + Edge Functions</p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-px h-8 bg-gradient-to-b from-accent-gold to-primary" />
                </div>

                {/* Data Layer */}
                <div className="flex justify-center gap-4">
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <WifiOff className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Offline Storage</span>
                  </div>
                  <div className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground -ml-2" />
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <Shield className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Cloud Sync</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-px h-8 bg-gradient-to-b from-primary to-accent-gold" />
                </div>

                {/* Output */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-accent-gold/20 border border-accent-gold/40 rounded-full px-6 py-3">
                    <TrendingUp className="h-5 w-5 text-accent-gold" />
                    <span className="font-semibold text-foreground">Insights & Nudges</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Real-time guidance on user dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure Modules */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Infrastructure That Scales
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for the realities of field sales: low connectivity, diverse teams, and high volume.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {infrastructureModules.map((module, index) => (
              <div 
                key={index}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <module.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{module.title}</h3>
                </div>

                <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground mb-4">
                  {module.techBadge}
                </span>

                <ul className="space-y-2 mb-4">
                  {module.highlights.map((highlight, hIndex) => (
                    <li key={hIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent-gold mt-0.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent-gold" />
                    <span className="text-sm font-semibold text-accent-gold">{module.outcome}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Why AI-First Matters
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The difference between digitizing paper and reimagining with AI.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-muted p-4">
                <div className="text-sm font-semibold text-muted-foreground">Feature</div>
                <div className="text-sm font-semibold text-muted-foreground text-center">Traditional Apps</div>
                <div className="text-sm font-semibold text-accent-gold text-center">QuickApp.AI</div>
              </div>

              {/* Rows */}
              {comparisonData.map((row, index) => (
                <div 
                  key={index}
                  className={`grid grid-cols-3 p-4 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                >
                  <div className="text-sm font-medium text-foreground">{row.feature}</div>
                  <div className="text-sm text-muted-foreground text-center">{row.traditional}</div>
                  <div className="text-sm text-foreground text-center font-medium">{row.quickapp}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Ready to Experience AI-First Sales?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join the companies transforming their field sales with intelligent guidance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/auth')}
                className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-lg"
              >
                Request a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/roi-calculator')}
                className="border-border"
              >
                Calculate Your ROI
              </Button>
            </div>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};

export default TechnologyPage;
