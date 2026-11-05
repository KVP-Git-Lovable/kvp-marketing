import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Target, Trophy, TrendingUp, CheckCircle, Users, Award } from "lucide-react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";

export const PerformanceTrackingFeature = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const features = [
    {
      icon: <Trophy className="h-6 w-6" />,
      title: "Goal Management",
      description: "Set, track, and achieve sales targets with smart goal setting and progress monitoring tools."
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "KPI Dashboards",
      description: "Monitor key performance indicators in real-time with customizable dashboards and alerts."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Team Comparison",
      description: "Compare performance across team members and territories to identify best practices and improvement areas."
    },
    {
      icon: <Award className="h-6 w-6" />,
      title: "Achievement Recognition",
      description: "Celebrate milestones and achievements with automated recognition and performance badges."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <Target className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Track Your <span className="text-primary">Success</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Monitor team performance and achieve sales targets with comprehensive tracking tools 
            that provide insights into individual and team achievements.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
          >
            Start Tracking Performance
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Comprehensive Performance Management
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
              Drive Performance Excellence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">85%</div>
                <div className="text-sm text-muted-foreground">Goal achievement rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">65%</div>
                <div className="text-sm text-muted-foreground">Improved team motivation</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">40%</div>
                <div className="text-sm text-muted-foreground">Faster target achievement</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-2xl font-bold text-foreground mb-6">
            Ready to Excel in Performance?
          </h3>
          <Button 
            size="lg"
            onClick={() => navigate('/request-demo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4"
          >
            Get Started with Performance Tracking
          </Button>
        </div>
      </section>
    </div>
  );
};