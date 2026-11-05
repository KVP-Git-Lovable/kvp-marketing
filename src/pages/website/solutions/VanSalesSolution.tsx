import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WebsiteHeader } from "@/components/website";
import { useNavigate } from "react-router-dom";
import { 
  Truck, 
  Package, 
  Receipt, 
  MapPin, 
  TrendingUp, 
  CheckCircle2,
  Clipboard,
  RefreshCcw,
  Calculator,
  Printer,
  BarChart3,
  Clock
} from "lucide-react";
import solutionImage from "@/assets/solution-van-sales.png";

const features = [
  {
    icon: Clipboard,
    title: "Morning Inventory Loading",
    description: "Quick stock loading with barcode scanning. Track what goes into the van with batch and expiry details."
  },
  {
    icon: MapPin,
    title: "Route Management",
    description: "Optimized routes with turn-by-turn navigation. Visit planned and ad-hoc customers on your route."
  },
  {
    icon: Receipt,
    title: "Invoice on Delivery",
    description: "Generate invoices on the spot with thermal printer support. Accept cash, UPI, or credit payments."
  },
  {
    icon: RefreshCcw,
    title: "Returns & Exchanges",
    description: "Process returns, exchanges, and replacements on the spot. Track reasons and approvals."
  },
  {
    icon: Calculator,
    title: "Day-End Settlement",
    description: "Reconcile cash, stock, and returns at end of day. Automatic variance calculation."
  },
  {
    icon: Package,
    title: "Stock Management",
    description: "Real-time stock visibility with alerts for low stock. Transfer stock between vans."
  }
];

const benefits = [
  "Eliminate paper-based order taking",
  "Real-time stock visibility across all vans",
  "Accurate day-end settlement and reconciliation",
  "GPS tracking and route optimization",
  "Works offline in areas with poor connectivity",
  "Integrated payments and invoicing"
];

const relatedFeatures = [
  { title: "Route Planning", link: "/features" },
  { title: "Stock Tracking", link: "/features" },
  { title: "Invoice Generation", link: "/features" },
  { title: "Payment Collection", link: "/features" }
];

export default function VanSalesSolution() {
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
                Van Sales / Route Sales
              </span>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Complete Van Sales <span className="text-primary">Solution</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                End-to-end mobile solution for van sales and direct store delivery. 
                From morning loading to day-end settlement, manage everything from your phone.
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
                  alt="Van Sales Dashboard" 
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
              Complete Van Sales <span className="text-primary">Workflow</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything your van sales team needs from start to end of day
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
                Why Choose Our <span className="text-primary">Van Sales Solution?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Purpose-built for route sales and direct store delivery operations.
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
                <div className="text-3xl font-bold text-primary mb-1">25%</div>
                <div className="text-sm text-muted-foreground">More Deliveries</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Clock className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">40%</div>
                <div className="text-sm text-muted-foreground">Faster Settlement</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <BarChart3 className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Stock Accuracy</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Printer className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">0</div>
                <div className="text-sm text-muted-foreground">Paperwork</div>
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
            Ready to Optimize Your Van Sales?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            See how our solution can improve route efficiency and increase sales.
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
