import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { HeroSection } from "@/components/website/HeroSection";
import { FeaturesSection } from "@/components/website/FeaturesSection";
import { SolutionsSection } from "@/components/website/SolutionsSection";
import { USPSection } from "@/components/website/USPSection";
import { IndustriesSection } from "@/components/website/IndustriesSection";
import { CTASection } from "@/components/website/CTASection";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background standalone-page">
      <WebsiteHeader />
      <HeroSection />
      <SolutionsSection />
      <FeaturesSection />
      <USPSection />
      <IndustriesSection />
      <CTASection />
      <WebsiteFooter />
    </div>
  );
};
