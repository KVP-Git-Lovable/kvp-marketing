import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Building2, 
  Briefcase,
  Truck,
  ArrowRight,
  CheckCircle,
  Calculator
} from "lucide-react";

const solutions = [
  {
    icon: Users,
    title: "Field Sales Automation",
    description: "Complete toolkit for field sales representatives to manage beats, visits, orders, and retailer relationships.",
    features: [
      "Intelligent beat planning & GPS tracking",
      "Offline order booking & instant sync",
      "AI-powered product recommendations",
      "Real-time attendance & performance tracking"
    ],
    color: "from-blue-500 to-cyan-600",
    cta: "Explore Field Sales",
    link: "/solutions/field-sales"
  },
  {
    icon: Building2,
    title: "Distributor Portal",
    description: "Empower your distributors with a dedicated portal for inventory, orders, claims, and business planning.",
    features: [
      "Primary order management",
      "Inventory & stock visibility",
      "Claims & scheme tracking",
      "Retailer & beat management"
    ],
    color: "from-emerald-500 to-teal-600",
    cta: "Explore Distributor Portal",
    link: "/solutions/distributor-portal"
  },
  {
    icon: Truck,
    title: "Van Sales",
    description: "Mobile sales and delivery management for direct store delivery and route sales operations.",
    features: [
      "Morning stock loading",
      "Route-based selling",
      "Cash & credit collection",
      "EOD reconciliation"
    ],
    color: "from-amber-500 to-orange-600",
    cta: "Explore Van Sales",
    link: "/solutions/van-sales"
  }
];

export const SolutionsSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solutions" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent-gold/10 text-accent-gold px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Briefcase className="h-4 w-4" />
            One Price • Unlimited Users • All Solutions
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Give Your Entire Team the Power of AI
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            With our success-based pricing, everyone in your organization gets access to all solutions — 
            Field Sales, Distributor Portal, and Van Sales. <strong>No per-user fees, no limits.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {solutions.map((solution, index) => (
            <Card 
              key={index} 
              className="border-border/40 bg-card shadow-card hover:shadow-hero transition-all duration-300 overflow-hidden group"
            >
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${solution.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <solution.icon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-1">
                      {solution.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {solution.description}
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {solution.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3 text-sm text-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  onClick={() => navigate(solution.link)}
                >
                  {solution.cta}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Button 
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8"
            onClick={() => { navigate('/features'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            View All 100+ Features
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/roi-calculator')}
          >
            <Calculator className="h-4 w-4" />
            Calculate Your ROI
          </Button>
        </div>
      </div>
    </section>
  );
};
