import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { 
  ArrowLeft, 
  Users, 
  BarChart3, 
  Settings, 
  TrendingUp,
  CheckCircle,
  Target,
  Sparkles,
  Shield,
  HeadphonesIcon
} from "lucide-react";

export const ProfessionalServicesROIBlog = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const challenges = [
    {
      title: "Low User Adoption",
      description: "Sales reps may resist change, lack training, or revert to old habits—resulting in poor usage and incomplete data."
    },
    {
      title: "Data Quality Issues",
      description: "Without proper onboarding and proactive monitoring, data entry errors and gaps undermine the value of analytics and reporting."
    },
    {
      title: "Process Gaps",
      description: "Out-of-the-box software may not align perfectly with your workflows, leading to confusion and workarounds."
    },
    {
      title: "Lack of ROI Visibility",
      description: "Leadership struggles to measure the true impact of the investment if adoption and usage aren't tracked and optimized."
    }
  ];

  const userBenefits = [
    {
      title: "Onboarding & Training",
      description: "Hands-on, role-based training ensures every user knows how to use the app for their daily routines."
    },
    {
      title: "Proactive Support",
      description: "Quick help for login, usage, or sync issues reduces frustration and keeps reps productive."
    },
    {
      title: "Continuous Enablement",
      description: "Scheduled refreshers and new user onboarding mean no one gets left behind, even as teams grow."
    }
  ];

  const managerBenefits = [
    {
      title: "Usage Monitoring",
      description: "Proactive tracking highlights adoption gaps, inactive users, and data quality issues—so managers can intervene early."
    },
    {
      title: "Process Alignment",
      description: "Minor configuration tweaks and change requests ensure the software fits real-world sales processes."
    },
    {
      title: "Performance Insights",
      description: "Monthly usage summaries and quarterly ROI reports give managers actionable data to drive improvements."
    }
  ];

  const leadershipBenefits = [
    {
      title: "Business Impact",
      description: "Quarterly ROI analysis and business improvement reports directly link software usage to sales outcomes and productivity gains."
    },
    {
      title: "Change Management",
      description: "Dedicated Customer Success Managers (CSMs) engage with key stakeholders, drive adoption, and share best practices."
    },
    {
      title: "Predictable Support",
      description: "With a clear support structure and transparent pricing, leadership can budget confidently and focus on strategic priorities."
    }
  ];

  const quickappApproach = [
    {
      icon: Users,
      title: "Comprehensive Onboarding & Training",
      description: "We guide every user, manager, and admin through onboarding, hands-on sessions, and ongoing refresher training tailored to real-world scenarios."
    },
    {
      icon: BarChart3,
      title: "Proactive Monitoring & Data Quality",
      description: "Our team actively tracks usage, flags adoption gaps, and helps correct data quality issues before they impact reporting or decision-making."
    },
    {
      icon: HeadphonesIcon,
      title: "Customer Success Management",
      description: "Every client gets a dedicated Customer Success Manager (CSM) who holds regular touchpoints with key users and champions adoption across your organization."
    },
    {
      icon: TrendingUp,
      title: "Usage & ROI Reporting",
      description: "We provide monthly usage summaries and quarterly ROI/business impact reports, giving you clear visibility into adoption trends and improvement opportunities."
    },
    {
      icon: Settings,
      title: "Continuous Improvement",
      description: "Our professional services team works with you to capture feedback, make configuration tweaks, and prioritize enhancements that deliver measurable value."
    },
    {
      icon: Shield,
      title: "Transparent, Predictable Support",
      description: "With our simple, value-based pricing and clear engagement model, you always know the level of support and partnership you can expect."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2C] via-[#1A1F2C] to-[#0F1218]">
      <WebsiteHeader />

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/insights")}
            className="text-white/70 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Insights
          </Button>

          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">Best Practices</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Why Professional Services are Key to Field Sales{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Software Adoption & ROI
            </span>
          </h1>

          <p className="text-lg text-white/70 leading-relaxed">
            Rolling out new field sales software is a big investment—one that promises greater productivity, 
            better visibility, and smarter decision-making. But too often, companies struggle to realize these 
            benefits because adoption stalls, user confidence lags, or the platform isn't used to its full potential. 
            That's where professional services come in.
          </p>
        </div>
      </section>

      {/* Common Challenges */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-white mb-8">The Common Challenges</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {challenges.map((challenge, index) => (
              <div 
                key={index}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-semibold text-red-400 mb-3">{challenge.title}</h3>
                <p className="text-white/70">{challenge.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Professional Services Solve These Problems */}
      <section className="py-12 px-4 bg-white/5">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-white mb-12">How Professional Services Solve These Problems</h2>
          
          {/* For Users */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">For Users (Field Teams)</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {userBenefits.map((benefit, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-white mb-2">{benefit.title}</h4>
                  <p className="text-white/60 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* For Managers */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">For Managers</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {managerBenefits.map((benefit, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-white mb-2">{benefit.title}</h4>
                  <p className="text-white/60 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* For Leadership */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">For Leadership</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {leadershipBenefits.map((benefit, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-white mb-2">{benefit.title}</h4>
                  <p className="text-white/60 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Bottom Line */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-4">The Bottom Line</h2>
            <p className="text-lg text-white/80">
              Professional services aren't just "support"—they're a <span className="text-amber-400 font-semibold">partnership for success</span>. 
              By bridging the gap between technology and people, they help ensure your field sales software delivers 
              on its promise: higher adoption, better data, and measurable ROI.
            </p>
          </div>
        </div>
      </section>

      {/* The Quickapp.ai Approach */}
      <section className="py-12 px-4 bg-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              The QuickApp<span className="text-amber-400">.ai</span> Approach
            </h2>
            <p className="text-xl text-white/70">Partnership for Adoption & ROI</p>
          </div>

          <p className="text-lg text-white/70 mb-10 text-center">
            At Quickapp.ai, we go beyond traditional support—we become your partner in driving adoption and business outcomes:
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {quickappApproach.map((item, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-white/60 text-sm">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-lg text-white/80 mb-6">
              With Quickapp.ai Professional Services, you don't just get a software vendor—you gain a{" "}
              <span className="text-amber-400 font-semibold">partner committed to your team's success</span>, 
              adoption, and ROI every step of the way.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/solutions/professional-services")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              Explore Our Professional Services
            </Button>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};

export default ProfessionalServicesROIBlog;
