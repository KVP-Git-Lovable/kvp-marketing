import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Users, Database, TrendingUp, Heart, Shield } from "lucide-react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";

export const RetailerManagementFeature = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const features = [
    {
      icon: <Database className="h-6 w-6" />,
      title: "Comprehensive Profiles",
      description: "Maintain detailed retailer profiles with contact info, purchase history, preferences, and relationship notes."
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Performance Tracking",
      description: "Monitor retailer performance, order patterns, and growth trends to identify opportunities."
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: "Relationship Management",
      description: "Track interaction history, follow-ups, and build stronger business relationships over time."
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Data Security",
      description: "Keep retailer information secure with enterprise-grade encryption and access controls."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <Users className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Master Your <span className="text-primary">Retailer Relationships</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Build and maintain strong retailer relationships with comprehensive profile management, 
            performance tracking, and intelligent insights that help you serve each customer better.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
          >
            Start Managing Retailers
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Complete Retailer Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/40 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      {feature.icon}
                    </div>
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-foreground mb-8">
              Transform Your Retailer Relationships
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">50%</div>
                <div className="text-sm text-muted-foreground">Better customer retention</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">35%</div>
                <div className="text-sm text-muted-foreground">Increase in repeat orders</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">60%</div>
                <div className="text-sm text-muted-foreground">Faster issue resolution</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-2xl font-bold text-foreground mb-6">
            Ready to Build Stronger Relationships?
          </h3>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4"
          >
            Get Started with Retailer Management
          </Button>
        </div>
      </section>
    </div>
  );
};