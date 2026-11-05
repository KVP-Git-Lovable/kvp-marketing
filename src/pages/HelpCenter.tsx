import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Book, MapPin, ShoppingCart, Users, Calendar, BarChart3, Award, Briefcase, Settings, ChevronRight, Star, ChevronsUpDown, Wifi, WifiOff, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import quickappLogo from "@/assets/quickapp-logo-full-yellow-black.png";
import { useConnectivity } from "@/hooks/useConnectivity";
import { NotificationBell } from "@/components/NotificationBell";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articleCount: number;
  articles: { id: string; title: string; tag?: string }[];
}

const helpCategories: HelpCategory[] = [
  {
    id: "my-visit",
    title: "My Visit",
    description: "Plan visits, check-in/out, place orders, and track daily activity",
    icon: <MapPin className="w-5 h-5" />,
    articleCount: 8,
    articles: [
      { id: "my-visit-overview", title: "Overview – How My Visit Works", tag: "Start Here" },
      { id: "my-visit-beat-planning", title: "Beat Planning & Day Schedule" },
      { id: "my-visit-check-in-out", title: "Check-In & Check-Out (GPS Verified)" },
      { id: "my-visit-order-entry", title: "Placing Orders During a Visit" },
      { id: "my-visit-visit-status", title: "Visit Statuses Explained" },
      { id: "my-visit-auto-plan", title: "Using Auto Plan (AI-Powered)" },
      { id: "my-visit-today-summary", title: "Today's Summary & Progress" },
      { id: "my-visit-tips", title: "Tips & Best Practices" },
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "Start/end your day, track hours, and manage leaves",
    icon: <Calendar className="w-5 h-5" />,
    articleCount: 5,
    articles: [
      { id: "attendance-overview", title: "How Attendance Works" },
      { id: "attendance-start-end", title: "Starting & Ending Your Day" },
      { id: "attendance-market-hours", title: "Market Hours Tracking" },
      { id: "attendance-leaves", title: "Applying for Leave" },
      { id: "attendance-regularization", title: "Attendance Regularization" },
    ],
  },
  {
    id: "orders",
    title: "Orders & Cart",
    description: "Product catalog, order entry, cart, and order history",
    icon: <ShoppingCart className="w-5 h-5" />,
    articleCount: 4,
    articles: [
      { id: "orders-overview", title: "Order Entry Overview" },
      { id: "orders-cart", title: "Using the Cart" },
      { id: "orders-schemes", title: "Applying Schemes & Offers" },
      { id: "orders-history", title: "Viewing Past Orders" },
    ],
  },
  {
    id: "retailers",
    title: "Retailers & Beats",
    description: "Manage retailers, beats, and territories",
    icon: <Users className="w-5 h-5" />,
    articleCount: 4,
    articles: [
      { id: "retailers-add", title: "Adding a New Retailer" },
      { id: "retailers-manage", title: "Managing Retailer Details" },
      { id: "retailers-beats", title: "Understanding Beats" },
      { id: "retailers-territories", title: "Territories Overview" },
    ],
  },
  {
    id: "performance",
    title: "Performance & Targets",
    description: "Track targets, achievements, and performance metrics",
    icon: <BarChart3 className="w-5 h-5" />,
    articleCount: 3,
    articles: [
      { id: "performance-dashboard", title: "Performance Dashboard" },
      { id: "performance-targets", title: "Setting & Tracking Targets" },
      { id: "performance-reports", title: "Viewing Reports" },
    ],
  },
  {
    id: "gamification",
    title: "Gamification & Rewards",
    description: "Leaderboard, badges, points, and achievements",
    icon: <Award className="w-5 h-5" />,
    articleCount: 3,
    articles: [
      { id: "gamification-leaderboard", title: "Leaderboard & Rankings" },
      { id: "gamification-badges", title: "Earning Badges" },
      { id: "gamification-points", title: "Points System" },
    ],
  },
  {
    id: "expenses",
    title: "Expenses",
    description: "Submit, track, and manage daily expenses",
    icon: <Briefcase className="w-5 h-5" />,
    articleCount: 3,
    articles: [
      { id: "expenses-submit", title: "Submitting Expenses" },
      { id: "expenses-tracking", title: "Tracking Expense Status" },
      { id: "expenses-beat-allowance", title: "Beat Allowances" },
    ],
  },
  {
    id: "branding",
    title: "Branding & Merchandising",
    description: "Branding requests, wall measurements, and vendor tracking",
    icon: <Star className="w-5 h-5" />,
    articleCount: 3,
    articles: [
      { id: "branding-requests", title: "Creating Branding Requests" },
      { id: "branding-wall-scanner", title: "Wall Measurement Scanner" },
      { id: "branding-vendor", title: "Vendor Management" },
    ],
  },
  {
    id: "admin",
    title: "Admin Panel",
    description: "User management, product setup, and system configuration",
    icon: <Settings className="w-5 h-5" />,
    articleCount: 4,
    articles: [
      { id: "admin-users", title: "Managing Users & Roles" },
      { id: "admin-products", title: "Product Management" },
      { id: "admin-schemes", title: "Scheme Management" },
      { id: "admin-controls", title: "Admin Controls & Settings" },
    ],
  },
];

export default function HelpCenter() {
  const connectivityStatus = useConnectivity();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const categoryParam = searchParams.get("category");
  const scrolledRef = useRef(false);

  // Auto-scroll to category when linked from module
  useEffect(() => {
    if (categoryParam && !scrolledRef.current) {
      scrolledRef.current = true;
      setTimeout(() => {
        const el = document.getElementById(`help-cat-${categoryParam}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [categoryParam]);

  const filtered = search.trim()
    ? helpCategories
        .map((cat) => ({
          ...cat,
          articles: cat.articles.filter((a) =>
            a.title.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((cat) => cat.articles.length > 0 || cat.title.toLowerCase().includes(search.toLowerCase()))
    : helpCategories;

  return (
    <div className="min-h-screen bg-background">
      {/* QuickApp Header - Same as main app */}
      <nav className="sticky top-0 z-50 bg-gradient-primary text-primary-foreground" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden bg-white p-0.5">
                <img 
                  src={quickappLogo} 
                  alt="QuickApp" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h1 className="text-base font-semibold text-white">QuickApp.ai</h1>
                  <SyncStatusIndicator />
                </div>
                <div className="flex items-center gap-0.5 text-white">
                  {connectivityStatus === 'online' ? (
                    <Wifi className="h-2.5 w-2.5 opacity-80" />
                  ) : connectivityStatus === 'offline' ? (
                    <>
                      <WifiOff className="h-2.5 w-2.5 opacity-80" />
                      <p className="text-[10px] opacity-80">No Connection</p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Search Section */}
      <div className="bg-primary/5 border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Learn how to use every feature with step-by-step guides
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search help articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Quick Jump Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between text-sm font-medium">
              <span className="text-muted-foreground">Jump to module…</span>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {helpCategories.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onClick={() => {
                  const el = document.getElementById(`help-cat-${cat.id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="text-primary">{cat.icon}</span>
                <span>{cat.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{cat.articleCount}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {filtered.map((cat) => (
          <Card key={cat.id} id={`help-cat-${cat.id}`} className={`overflow-hidden ${categoryParam === cat.id ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-0">
              {/* Category header */}
              <div className="flex items-center gap-3 p-4 pb-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground text-sm">{cat.title}</h2>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {cat.articleCount} articles
                </Badge>
              </div>
              {/* Article list */}
              <div className="border-t mx-4 mt-2">
                {cat.articles.map((article, idx) => (
                  <button
                    key={article.id}
                    onClick={() => navigate(`/help-center/${article.id}`)}
                    className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-muted/50 rounded-md px-2 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <span className="text-sm text-foreground flex-1 min-w-0 truncate">{article.title}</span>
                    {article.tag && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">
                        {article.tag}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No articles found for "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
