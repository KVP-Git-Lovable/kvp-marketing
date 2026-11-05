import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { MapPin, Navigation, Clock, Users, BarChart } from "lucide-react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";

export const BeatPlanningFeature = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const features = [
    {
      icon: <Navigation className="h-6 w-6" />,
      title: "Intelligent Route Optimization",
      description: "AI-powered algorithms calculate the most efficient routes to minimize travel time and maximize retailer visits."
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Time Management",
      description: "Smart scheduling ensures optimal time allocation for each retailer based on their importance and potential."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Territory Management",
      description: "Organize retailers into logical beats and territories for better coverage and relationship building."
    },
    {
      icon: <BarChart className="h-6 w-6" />,
      title: "Performance Analytics",
      description: "Track beat performance, identify gaps, and optimize your territory strategy with detailed analytics."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <MapPin className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Optimize Your Sales <span className="text-primary">Routes</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Plan efficient sales routes with AI-powered beat planning. Maximize your field time 
            and ensure every retailer gets the attention they deserve.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
          >
            Start Planning Your Beats
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Smart Beat Planning Features
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
              Why Choose Our Beat Planning?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">30%</div>
                <div className="text-sm text-muted-foreground">Reduction in travel time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">25%</div>
                <div className="text-sm text-muted-foreground">More visits per day</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">40%</div>
                <div className="text-sm text-muted-foreground">Better territory coverage</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-2xl font-bold text-foreground mb-6">
            Ready to Optimize Your Routes?
          </h3>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4"
          >
            Get Started with Beat Planning
          </Button>
        </div>
      </section>
    </div>
  );
};