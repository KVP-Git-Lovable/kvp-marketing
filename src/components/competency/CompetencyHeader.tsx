import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "react-router-dom";
import { 
  Menu, Home, BarChart3, Users, Settings, ChevronLeft, Award, 
  Target, TrendingUp, GraduationCap, CalendarDays
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CompetencyHeaderProps {
  title: string;
  subtitle?: string;
  companyName?: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  showBackButton?: boolean;
}

const navigationItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/competency-dashboard", label: "My Competency", icon: Award },
  { path: "/team-competency", label: "Team View", icon: Users },
  { path: "/competency-admin", label: "Admin", icon: Settings },
];

export function CompetencyHeader({
  title,
  subtitle,
  companyName = "SalesCoach AI",
  onBack,
  rightContent,
  showBackButton = true,
}: CompetencyHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20">
      {/* Banner */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left: Menu + Company */}
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="p-6 border-b bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                  <h2 className="text-xl font-bold">{companyName}</h2>
                  <p className="text-sm text-primary-foreground/70">Competency Management</p>
                </div>
                <nav className="p-4 space-y-1">
                  {navigationItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-muted-foreground"
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            
            <NavLink to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <Award className="h-5 w-5" />
              </div>
              <span className="font-semibold hidden sm:block">{companyName}</span>
            </NavLink>
          </div>

          {/* Right content */}
          {rightContent}
        </div>
      </div>

      {/* Title Section */}
      <div className="bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          {showBackButton && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
