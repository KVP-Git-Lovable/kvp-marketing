import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import quickappLogo from "@/assets/quickapp-logo-full-yellow-black.png";

const solutionLinks = [
  { label: "Field Sales Automation", href: "/solutions/field-sales", external: false },
  { label: "Distributor Portal", href: "/solutions/distributor-portal", external: false },
  
  { label: "Van Sales", href: "/solutions/van-sales", external: false },
  { label: "Store Operations", href: "https://storeops.quickapp.ai/", external: true },
  { label: "Professional Services", href: "/solutions/professional-services", external: false },
];

export const WebsiteHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLandingPage = location.pathname === '/';

  const navItems = [
    { label: "Solutions", href: "#solutions", hasDropdown: true },
    { label: "Enterprise AI", href: "/features" },
    { label: "Technology", href: "/technology" },
    { label: "Industries", href: "#industries" },
    { label: "Insights", href: "/insights" },
    { label: "Pricing", href: "/pricing" },
  ];

  // Handle hash navigation after page load
  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const element = document.querySelector(location.hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  // Close desktop dropdown when clicking outside
  // (On mobile, the outside-click handler can fire before the button click,
  // unmounting the menu and preventing navigation.)
  useEffect(() => {
    if (mobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen]);

  const handleNavClick = (href: string, hasDropdown?: boolean) => {
    if (hasDropdown) {
      setSolutionsOpen(!solutionsOpen);
      return;
    }

    setMobileMenuOpen(false);

    if (href.startsWith('#')) {
      if (isLandingPage) {
        // Scroll to section on landing page
        const element = document.querySelector(href);
        element?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Navigate to landing page with hash
        navigate('/' + href);
      }
    } else {
      // For page routes, navigate and scroll to top
      navigate(href);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const handleSolutionClick = (href: string, external?: boolean) => {
    setSolutionsOpen(false);
    setMobileMenuOpen(false);
    if (external) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      navigate(href);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <img 
            src={quickappLogo} 
            alt="QuickApp.AI" 
            className="h-12 w-12 rounded-xl shadow-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-foreground">
              QuickApp<span className="text-accent-gold">.ai</span>
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wide">AI-FORWARD COMMERCE</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <div key={item.label} className="relative" ref={item.hasDropdown ? dropdownRef : undefined}>
              <button
                onClick={() => handleNavClick(item.href, item.hasDropdown)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {item.label}
                {item.hasDropdown && <ChevronDown className={`h-4 w-4 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />}
              </button>
              
              {/* Solutions Dropdown */}
              {item.hasDropdown && solutionsOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 rounded-lg shadow-lg bg-background border border-border z-50">
                  <div className="py-2">
                    {solutionLinks.map((solution) => (
                      <button
                        key={solution.href}
                        onClick={() => handleSolutionClick(solution.href, solution.external)}
                        className="block w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {solution.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => navigate('/auth')}
            className="border-border"
          >
            Login
          </Button>
          <Button 
            onClick={() => navigate('/request-demo')}
            className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-button"
          >
            Request Demo
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 py-4 space-y-4">
          {navItems.map((item) => (
            <div key={item.label}>
              {item.hasDropdown ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setSolutionsOpen(!solutionsOpen)}
                    className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground text-left"
                  >
                    {item.label}
                    <ChevronDown className={`h-4 w-4 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {solutionsOpen && (
                    <div className="pl-4 space-y-2 border-l border-border">
                      {solutionLinks.map((solution) => (
                        <button
                          key={solution.href}
                          onClick={() => { handleSolutionClick(solution.href, solution.external); setMobileMenuOpen(false); }}
                          className="block text-sm text-muted-foreground hover:text-foreground"
                        >
                          {solution.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { handleNavClick(item.href); setMobileMenuOpen(false); }}
                  className="block text-sm font-medium text-muted-foreground hover:text-foreground text-left w-full"
                >
                  {item.label}
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-2 pt-4 border-t border-border/40">
            <Button 
              variant="outline"
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Login
            </Button>
            <Button 
              onClick={() => navigate('/request-demo')}
              className="w-full bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground"
            >
              Request Demo
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
