import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Calendar, Clock, Bell, CheckCircle, Smartphone } from "lucide-react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";

export const VisitSchedulingFeature = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const features = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Smart Scheduling",
      description: "AI suggests optimal visit times based on retailer preferences, historical data, and your availability."
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: "Automated Reminders",
      description: "Never miss a visit with intelligent reminders and notifications for upcoming appointments."
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "Visit Tracking",
      description: "Track completed visits, outcomes, and follow-up actions to maintain accountability."
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "Mobile Access",
      description: "Access your schedule anywhere with mobile optimization and offline capabilities."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <Calendar className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Perfect Your <span className="text-primary">Visit Schedule</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Plan and track customer visits with intelligent scheduling that maximizes your productivity 
            and ensures every retailer gets timely attention.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
          >
            Start Scheduling Visits
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Intelligent Visit Planning
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
              Schedule Smarter, Sell More
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">45%</div>
                <div className="text-sm text-muted-foreground">More efficient scheduling</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">90%</div>
                <div className="text-sm text-muted-foreground">On-time visit rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">25%</div>
                <div className="text-sm text-muted-foreground">More visits per week</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-2xl font-bold text-foreground mb-6">
            Ready to Optimize Your Schedule?
          </h3>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4"
          >
            Get Started with Visit Scheduling
          </Button>
        </div>
      </section>
    </div>
  );
};