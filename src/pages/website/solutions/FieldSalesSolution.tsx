import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WebsiteHeader } from "@/components/website";
import { useNavigate } from "react-router-dom";
import { 
  MapPin, 
  Calendar, 
  ShoppingCart, 
  Clock, 
  Target, 
  Users, 
  TrendingUp, 
  CheckCircle2,
  Smartphone,
  BarChart3,
  Navigation,
  Camera
} from "lucide-react";
import solutionImage from "@/assets/solution-field-sales.png";

const features = [
  {
    icon: MapPin,
    title: "Smart Beat Planning",
    description: "AI-optimized route planning that reduces travel time by 30%. Create, assign, and manage beats with territory mapping."
  },
  {
    icon: Calendar,
    title: "Visit Scheduling",
    description: "Plan daily visits with intelligent scheduling. Track visit frequency, coverage, and ensure no retailer is missed."
  },
  {
    icon: ShoppingCart,
    title: "Order Management",
    description: "Capture orders on the go with product catalog, pricing, schemes, and real-time inventory visibility."
  },
  {
    icon: Clock,
    title: "Attendance & Check-in",
    description: "GPS-enabled attendance with face verification. Track field time, journey maps, and productivity metrics."
  },
  {
    icon: Camera,
    title: "Photo & Stock Capture",
    description: "AI-powered stock counting from photos. Capture shelf images, competition data, and branding compliance."
  },
  {
    icon: Navigation,
    title: "GPS Journey Tracking",
    description: "Real-time location tracking with journey playback. Monitor distance covered and time spent at each outlet."
  }
];

const benefits = [
  "30% reduction in travel time with optimized routes",
  "50% faster order capture with smart product search",
  "100% visibility into field activities",
  "Real-time sync even in offline areas",
  "AI-powered insights for better decision making",
  "Seamless integration with ERP/DMS systems"
];

const relatedFeatures = [
  { title: "Sales Analytics", link: "/features/sales-analytics" },
  { title: "Performance Tracking", link: "/features/performance-tracking" },
  { title: "Retailer Management", link: "/features/retailer-management" },
  { title: "Beat Planning", link: "/features/beat-planning" }
];

export default function FieldSalesSolution() {
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
                Field Sales Automation
              </span>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Empower Your Field Sales Team with{" "}
                <span className="text-primary">AI-Driven Tools</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Transform your field operations with smart beat planning, real-time order capture, 
                GPS tracking, and AI-powered insights. Everything your sales team needs in one app.
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
                  alt="Field Sales Automation Dashboard" 
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
              Complete Field Sales <span className="text-primary">Toolkit</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything your field team needs to maximize productivity and drive sales growth
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
                Why Choose Our <span className="text-primary">Field Sales Solution?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join hundreds of companies who have transformed their field operations with our platform.
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
                <div className="text-3xl font-bold text-primary mb-1">30%</div>
                <div className="text-sm text-muted-foreground">Sales Increase</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Users className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">50%</div>
                <div className="text-sm text-muted-foreground">More Visits</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Target className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Visibility</div>
              </Card>
              <Card className="bg-card/50 border-primary/20 p-6 text-center">
                <Smartphone className="w-10 h-10 text-primary mx-auto mb-3" />
                <div className="text-3xl font-bold text-primary mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Offline Access</div>
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
            Ready to Transform Your Field Sales?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get a personalized demo and see how our solution can boost your team's productivity.
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
