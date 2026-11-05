import { useNavigate } from "react-router-dom";
import { CheckCircle, Award, Shield, Mail, Phone, MapPin } from "lucide-react";
import quickappLogo from "@/assets/quickapp-logo-full-yellow-black.png";

export const WebsiteFooter = () => {
  const navigate = useNavigate();

  const footerLinks = {
    solutions: [
      { label: "Field Sales", href: "#solutions" },
      { label: "Distributor Portal", href: "#solutions" },
      
      { label: "Van Sales", href: "#solutions" },
    ],
    platform: [
      { label: "AI Intelligence", href: "#platform" },
      { label: "Analytics", href: "#platform" },
      { label: "Gamification", href: "#platform" },
      { label: "Offline Mode", href: "#platform" },
    ],
    industries: [
      { label: "FMCG", href: "#industries" },
      { label: "Beverages", href: "#industries" },
      { label: "Pharma", href: "#industries" },
      { label: "Consumer Durables", href: "#industries" },
    ],
    company: [
      { label: "About Us", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "#" },
    ]
  };

  return (
    <footer className="border-t border-border/40 bg-background">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src={quickappLogo} 
                alt="QuickApp.AI" 
                className="h-10 w-10 rounded-lg"
              />
            <div>
                <h3 className="text-lg font-bold text-foreground">QuickApp<span className="text-accent-gold">.ai</span></h3>
                <p className="text-xs text-muted-foreground">AI-Powered Field Sales Platform</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Empowering field sales teams with AI-driven insights, intelligent route planning, 
              and comprehensive performance analytics — even offline.
            </p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>hello@quickapp.ai</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+91 63616 80976</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Bangalore, India</span>
              </div>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Solutions</h4>
            <ul className="space-y-2">
              {footerLinks.solutions.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Platform</h4>
            <ul className="space-y-2">
              {footerLinks.platform.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Industries</h4>
            <ul className="space-y-2">
              {footerLinks.industries.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="border-t border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent-gold" />
              <span>Salesforce Certified Partner</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent-gold" />
              <span>ISO 27001 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-accent-gold" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2024 QuickApp.AI. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
