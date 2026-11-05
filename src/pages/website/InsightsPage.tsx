import { useState, useEffect } from "react";
import { Search, Filter, ArrowRight, FileText, CheckSquare, Calculator, Sparkles, Users, ClipboardCheck, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";

const insightCards = [
  {
    id: "implementation-toolkit",
    title: "Implementation Toolkit",
    description: "Complete requirement analysis, project planning, estimation calculator, ROI tracker, and training management for customer implementations.",
    icon: Briefcase,
    category: "Tools",
    readTime: "Interactive",
    href: "/insights/implementation-toolkit",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    id: "migration-plan",
    title: "Migration Plan",
    description: "A professional 4-6 Week Migration Roadmap designed to move your clients from reactive tracking to predictive selling with zero business disruption.",
    icon: FileText,
    category: "Migration",
    readTime: "8 min read",
    href: "/insights/migration-plan",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "migration-checklist",
    title: "Migration Checklist",
    description: "Your 5-Step Path to Modern FMCG Distribution. A comprehensive checklist to ensure your data, team, and distributors are ready for the intelligence upgrade.",
    icon: CheckSquare,
    category: "Migration",
    readTime: "5 min read",
    href: "/insights/migration-checklist",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    id: "roi-calculator",
    title: "Calculate ROI",
    description: "Discover the potential return on investment when switching to Quickapp.ai. See how much you can save and earn with AI-Forward Commerce.",
    icon: Calculator,
    category: "Tools",
    readTime: "Interactive",
    href: "/roi-calculator",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    id: "professional-services-roi",
    title: "Why Professional Services are Key to Field Sales Software Adoption & ROI",
    description: "Discover how professional services bridge the gap between technology and people, ensuring higher adoption, better data quality, and measurable ROI for your field sales software investment.",
    icon: Users,
    category: "Best Practices",
    readTime: "6 min read",
    href: "/insights/professional-services-roi",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "professional-services-checklist",
    title: "Professional Services Onboarding Checklist",
    description: "A step-by-step guide to ensure a smooth, high-impact onboarding for every new customer engaging with Quickapp.ai Professional Services.",
    icon: ClipboardCheck,
    category: "Best Practices",
    readTime: "4 min read",
    href: "/insights/professional-services-checklist",
    gradient: "from-teal-500 to-cyan-500",
  },
];

const categories = ["All", "Migration", "Tools", "Case Studies", "Best Practices"];

export default function InsightsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const filteredCards = insightCards.filter((card) => {
    const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || card.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2C] via-[#1A1F2C] to-[#0F1218]">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">Knowledge Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Insights & <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Resources</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Expert guides, migration tools, and resources to help you transition to AI-Forward Commerce
          </p>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-4xl">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search insights, guides, and resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-6 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-amber-500/50 focus:ring-amber-500/20"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === category
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cards Grid */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-6xl">
          {filteredCards.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => navigate(card.href)}
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${card.gradient} flex items-center justify-center mb-4`}>
                    <card.icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Category & Read Time */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                      {card.category}
                    </span>
                    <span className="text-xs text-white/50">{card.readTime}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="text-white/60 text-sm mb-4 line-clamp-3">
                    {card.description}
                  </p>

                  {/* CTA */}
                  <div className="flex items-center text-amber-400 text-sm font-medium group-hover:gap-2 transition-all">
                    <span>Read more</span>
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/60">No insights found matching your search.</p>
            </div>
          )}
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
}
