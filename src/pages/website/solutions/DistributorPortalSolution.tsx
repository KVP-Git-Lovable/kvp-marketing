import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WebsiteHeader } from "@/components/website";
import { useNavigate } from "react-router-dom";
import { 
  Package, 
  FileText, 
  Truck, 
  DollarSign, 
  BarChart3, 
  Users, 
  TrendingUp, 
  CheckCircle2,
  ClipboardList,
  Warehouse,
  Receipt,
  Shield
} from "lucide-react";
import solutionImage from "@/assets/solution-distributor-portal.png";

const features = [
  {
    icon: ClipboardList,
    title: "Primary Order Management",
    description: "Easy order placement with product catalog, scheme visibility, and order history. Real-time order status tracking."
  },
  {
    icon: Warehouse,
    title: "Inventory Management",
    description: "Track stock levels, manage goods receipts, and get low stock alerts. Complete inventory visibility at all times."
  },
  {
    icon: Receipt,
    title: "Claims Management",
    description: "Submit and track damage claims, scheme claims, and expense reimbursements with supporting documents."
  },
  {
    icon: Package,
    title: "Goods Receipt Notes",
    description: "Record incoming shipments with batch tracking, expiry management, and discrepancy reporting."
  },
  {
    icon: FileText,
    title: "Business Planning",
    description: "Create annual business plans with retailer-wise targets, product-wise goals, and territory expansion plans."
  },
  {
    icon: DollarSign,
    title: "Financial Dashboard",
    description: "Track outstanding payments, credit limits, and payment history. Complete financial transparency."
  }
];

const benefits = [
  "Self-service portal reducing support calls by 60%",
  "Real-time visibility into order and inventory status",
  "Faster claim processing with digital workflows",
  "Better business planning with data-driven insights",
  "Improved distributor engagement and satisfaction",
  "Seamless integration with your existing ERP"
];

const relatedFeatures = [
  { title: "Primary Orders", link: "/features" },
  { title: "Inventory Tracking", link: "/features" },
  { title: "Claims Processing", link: "/features" },
  { title: "Business Planning", link: "/features" }
];

export default function DistributorPortalSolution() {
  const navigate = useNavigate();

  // Scroll to top on mount
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WebsiteHeader />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium mb-6">
                Distributor Portal
              </span>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Empower Distributors with{" "}
                <span className="text-primary">Self-Service Portal</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Give your distribution partners complete control over orders, inventory, 
                claims, and business planning. Reduce support overhead while improving satisfaction.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => navigate('/request-demo')}
                >
                  Request Demo
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/features')}
                >
                  View All Features
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20 shadow-xl">
                <img 
                  src={solutionImage} 
                  alt="Distributor Portal Dashboard" 
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Complete Distributor <span className="text-primary">Management</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything distributors need to manage their business efficiently
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Why Choose Our <span className="text-primary">Distributor Portal?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Transform your distributor relationships with a modern self-service experience.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <TrendingUp className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">60%</div>
                <div className="text-sm text-muted-foreground">Less Support Calls</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Users className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">40%</div>
                <div className="text-sm text-muted-foreground">Faster Claims</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Truck className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Order Visibility</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Portal Access</div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Related Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Related Features</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {relatedFeatures.map((feature, index) => (
              <Button 
                key={index}
                variant="outline" 
                className="border-primary/30 hover:bg-primary/10"
                onClick={() => navigate(feature.link)}
              >
                {feature.title}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/20 to-primary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Empower Your Distributors?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            See how our distributor portal can transform your channel relationships.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/request-demo')}
            >
              Schedule Free Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/request-demo')}
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
