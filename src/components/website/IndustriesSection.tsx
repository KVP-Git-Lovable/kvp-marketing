import { Card, CardContent } from "@/components/ui/card";
import { Package, Wine, Pill, Smartphone, Sparkles, Building } from "lucide-react";

const industries = [
  {
    icon: Package,
    name: "FMCG",
    description: "Fast-moving consumer goods distribution and retail coverage optimization.",
    features: ["Route optimization", "Stock visibility", "Scheme management"]
  },
  {
    icon: Wine,
    name: "Beverages",
    description: "Beverage distribution with cooler tracking and merchandising compliance.",
    features: ["Cooler tracking", "Merchandising", "Chiller compliance"]
  },
  {
    icon: Pill,
    name: "Pharma",
    description: "Pharmaceutical sales with doctor visits and prescription tracking.",
    features: ["Doctor visits", "Sample management", "Compliance tracking"]
  },
  {
    icon: Smartphone,
    name: "Consumer Durables",
    description: "Electronics and appliances with demo scheduling and installation tracking.",
    features: ["Demo scheduling", "Installation tracking", "Warranty management"]
  },
  {
    icon: Sparkles,
    name: "Personal Care",
    description: "Beauty and personal care with display tracking and promotional compliance.",
    features: ["Display tracking", "Promotion compliance", "Beauty advisor management"]
  },
  {
    icon: Building,
    name: "Building Materials",
    description: "Construction materials with contractor management and project tracking.",
    features: ["Contractor CRM", "Project tracking", "Credit management"]
  }
];

export const IndustriesSection = () => {
  return (
    <section id="industries" className="py-20 px-4 bg-background">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Building className="h-4 w-4" />
            Industry Solutions
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for Your Industry
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pre-configured workflows and features designed for specific industry needs. Get started faster with industry best practices built-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((industry, index) => (
            <Card 
              key={index} 
              className="border-border/40 bg-card shadow-card hover:shadow-hero transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <industry.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {industry.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {industry.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {industry.features.map((feature, fIndex) => (
                    <span 
                      key={fIndex}
                      className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
