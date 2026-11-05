import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { 
  Headphones, 
  Settings, 
  Rocket, 
  Shield, 
  Users, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Zap,
  Award,
  FileText,
  Calendar
} from "lucide-react";

export const ProfessionalServicesSolution = () => {
  const navigate = useNavigate();

  const supportTiers = [
    {
      level: "L1",
      title: "User Support",
      subtitle: "Helpdesk, Proactive Monitoring & Enablement",
      icon: Headphones,
      color: "from-blue-500 to-cyan-500",
      features: [
        "First point of contact for all end-users",
        "Login/access, navigation, daily workflows support",
        "Mobile app usage and 'how-to' queries",
        "Troubleshooting data visibility & sync errors",
        "Proactive monitoring of app usage and data quality",
        "Scheduled and proactive user training sessions",
        "New user onboarding support",
        "Monthly usage summary reports",
        "Quarterly ROI analysis & business impact reports",
        "Dedicated Customer Success Manager (CSM)",
        "Documentation and escalation to L2"
      ],
      supportHours: "9 AM to 7 PM IST, Monday to Friday",
      pricing: "25% of annual subscription (Year 1), 20% from Year 2 onwards",
      fairUsage: "Max 50 hours/month. Additional support budget may be requested for significant increase in requests."
    },
    {
      level: "L2",
      title: "Configuration Support",
      subtitle: "Configuration & Minor Change Requests",
      icon: Settings,
      color: "from-purple-500 to-pink-500",
      features: [
        "System/process configuration support",
        "Validation errors resolution",
        "Workflow clarifications",
        "Minor change requests (field additions)",
        "Report tweaks and customizations",
        "UI adjustments",
        "Root cause analysis",
        "Solution deployment",
        "User confirmation",
        "Coordination with L3 for escalations"
      ],
      pricing: "Estimates provided per request based on scope"
    },
    {
      level: "L3",
      title: "Enhancement Support",
      subtitle: "New Features, Enhancements & Integrations",
      icon: Rocket,
      color: "from-orange-500 to-red-500",
      features: [
        "New feature requests management",
        "Enhancements and integrations",
        "Requirement analysis",
        "Solution design and implementation planning",
        "Development and deployment",
        "UAT support",
        "Post-deployment support",
        "Roadmap alignment",
        "Value delivery tracking"
      ],
      pricing: "Estimates and proposals per enhancement/project"
    }
  ];

  const includedFeatures = [
    { icon: Users, title: "Customer Success Manager", description: "Dedicated account manager with regular touch points" },
    { icon: Clock, title: "SLA-based Response", description: "Guaranteed response and resolution times" },
    { icon: BarChart3, title: "Proactive Monitoring", description: "App usage and data quality monitoring" },
    { icon: BookOpen, title: "User Training", description: "Scheduled training and new user onboarding" },
    { icon: FileText, title: "Usage Reports", description: "Monthly summary and quarterly ROI reports" },
    { icon: MessageSquare, title: "Support Portal", description: "Access to knowledge base and ticket analytics" }
  ];

  const warrantyFeatures = [
    "Resolution of defects and errors impacting core functionality",
    "Response to system outages or failures",
    "90 days coverage from go-live",
    "No additional charges for bug fixes"
  ];

  useEffect(() => {
    document.title = "Professional Services | QuickApp.ai";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <WebsiteHeader />
        
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent-gold/5 to-secondary/5" />
          <div className="container mx-auto px-4 relative">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="outline" className="mb-6 border-accent-gold/50 text-accent-gold">
                <Award className="h-3 w-3 mr-1" />
                Enterprise-Grade Support
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                Professional Services
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Empower your organization with seamless operations, high user adoption, and continuous business value 
                from your field sales and distributor management platforms.
              </p>
              <p className="text-lg text-muted-foreground mb-10">
                Our professional services deliver comprehensive, scalable, and outcome-driven support—ensuring 
                clients maximize ROI and drive digital transformation in retail execution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => navigate('/insights/professional-services-roi')}
                  className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-button"
                >
                  Why Professional Services Matter
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/insights/professional-services-checklist')}
                >
                  Onboarding Checklist
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Support Tiers Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Tiered Support Proposition
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Choose the right level of support for your organization's needs
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {supportTiers.map((tier) => (
                <Card key={tier.level} className="relative overflow-hidden border-border/50 hover:border-accent-gold/50 transition-all duration-300 hover:shadow-xl">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tier.color}`} />
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${tier.color} text-white`}>
                        <tier.icon className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className="text-lg font-bold">
                        {tier.level}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl">{tier.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{tier.subtitle}</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-accent-gold mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {tier.supportHours && (
                      <div className="pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{tier.supportHours}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-border/50">
                      <p className="text-sm font-medium text-foreground">Pricing</p>
                      <p className="text-sm text-accent-gold font-semibold">{tier.pricing}</p>
                      {tier.fairUsage && (
                        <p className="text-xs text-muted-foreground mt-1">Fair usage: {tier.fairUsage}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* What's Included Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                What's Included
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
                Comprehensive support features included with your subscription
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => navigate('/insights/professional-services-roi')}
                  className="border-accent-gold/50 hover:bg-accent-gold/10"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Why Professional Services Matter
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/insights/professional-services-checklist')}
                  className="border-accent-gold/50 hover:bg-accent-gold/10"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Onboarding Checklist
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {includedFeatures.map((feature, idx) => (
                <Card key={idx} className="border-border/50 hover:border-accent-gold/30 transition-colors">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-accent-gold/10">
                      <feature.icon className="h-5 w-5 text-accent-gold" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Warranty & Free Enhancements Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Warranty */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-xl bg-green-500/10">
                      <Shield className="h-6 w-6 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl">Standard Warranty</CardTitle>
                  </div>
                  <p className="text-muted-foreground">
                    All QuickApp.ai implementations include a warranty period covering bug fixes, 
                    system errors, and critical issues at no additional charge.
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {warrantyFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Excludes issues caused by customer-side changes, 
                      third-party integrations, or misuse.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Quarterly Enhancements */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-xl bg-accent-gold/10">
                      <Sparkles className="h-6 w-6 text-accent-gold" />
                    </div>
                    <CardTitle className="text-2xl">Quarterly Feature Enhancements</CardTitle>
                  </div>
                  <p className="text-muted-foreground">
                    All customers receive new standard features and platform enhancements released 
                    quarterly, free of charge as part of their subscription.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
                      <Calendar className="h-5 w-5 text-accent-gold" />
                      <div>
                        <p className="font-medium text-foreground">Regular Updates</p>
                        <p className="text-sm text-muted-foreground">New features every quarter</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
                      <Zap className="h-5 w-5 text-accent-gold" />
                      <div>
                        <p className="font-medium text-foreground">Platform Improvements</p>
                        <p className="text-sm text-muted-foreground">Performance and UX enhancements</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
                      <TrendingUp className="h-5 w-5 text-accent-gold" />
                      <div>
                        <p className="font-medium text-foreground">No Extra Cost</p>
                        <p className="text-sm text-muted-foreground">Included in your subscription</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Summary Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Simple, Predictable Pricing
                </h2>
                <p className="text-lg text-muted-foreground">
                  Easy for finance and procurement teams to budget
                </p>
              </div>

              <Card className="border-accent-gold/30 bg-gradient-to-br from-accent-gold/5 to-transparent">
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="text-center p-6 rounded-xl bg-background border border-border/50">
                      <Badge className="mb-4 bg-blue-500">L1 Support</Badge>
                      <p className="text-2xl font-bold text-foreground mb-1">25% (Year 1)</p>
                      <p className="text-xl font-bold text-foreground mb-2">20% (Year 2+)</p>
                      <p className="text-sm text-muted-foreground">of annual subscription</p>
                      <p className="text-xs text-muted-foreground mt-2">Fair usage: Max 50 hrs/month</p>
                    </div>
                    <div className="text-center p-6 rounded-xl bg-background border border-border/50">
                      <Badge className="mb-4 bg-purple-500">L2 Support</Badge>
                      <p className="text-2xl font-bold text-foreground mb-2">Per Request</p>
                      <p className="text-sm text-muted-foreground">Estimates shared and approved</p>
                      <p className="text-xs text-muted-foreground mt-2">Based on scope</p>
                    </div>
                    <div className="text-center p-6 rounded-xl bg-background border border-border/50">
                      <Badge className="mb-4 bg-orange-500">L3 Support</Badge>
                      <p className="text-2xl font-bold text-foreground mb-2">Per Project</p>
                      <p className="text-sm text-muted-foreground">Proposals provided per enhancement</p>
                      <p className="text-xs text-muted-foreground mt-2">Custom pricing</p>
                    </div>
                  </div>

                  <div className="mt-8 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      ✓ No charges for standard warranty or quarterly feature releases
                    </p>
                  </div>

                  <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Tax (GST) applicable as per government rules at the time of purchase.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Ready to Maximize Your ROI?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Let our professional services team help you achieve seamless operations and drive digital 
                transformation in your retail execution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => navigate('/request-demo')}
                  className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-button"
                >
                  Request Demo
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/contact')}
                >
                  Contact Us
                </Button>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="link"
                  onClick={() => navigate('/insights/professional-services-roi')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Read: Why Professional Services are Key to Software Adoption & ROI →
                </Button>
                <Button 
                  variant="link"
                  onClick={() => navigate('/insights/professional-services-checklist')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Read: Professional Services Onboarding Checklist →
                </Button>
              </div>
            </div>
          </div>
        </section>

        <WebsiteFooter />
      </div>
  );
};

export default ProfessionalServicesSolution;
