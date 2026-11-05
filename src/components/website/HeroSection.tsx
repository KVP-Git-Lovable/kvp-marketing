import { useNavigate } from "react-router-dom";
import { 
  Sparkles,
  Calculator
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const
    }
  }
};

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
      {/* Animated background mesh */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <motion.div 
        className="relative z-10 container mx-auto px-4 pt-32 md:pt-40 pb-16 flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 backdrop-blur-xl text-amber-400 px-6 py-3 rounded-full text-sm font-medium border border-amber-500/30">
            <Sparkles className="h-4 w-4" />
            AI-First Platform • Built to Guide, Not Just Collect Data
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.div variants={itemVariants} className="text-center max-w-4xl mx-auto mb-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
            <span className="text-white">One Price, Unlimited Users</span>
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 bg-clip-text text-transparent">
              Success-Based Pricing
            </span>
          </h1>
        </motion.div>

        {/* Feature list */}
        <motion.p 
          variants={itemVariants}
          className="text-center text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-6 leading-relaxed"
        >
          <span className="font-semibold text-white">Field Sales</span>
          <span className="text-white/50"> • </span>
          <span className="font-semibold text-white">Distributor Management</span>
          <span className="text-white/50"> • </span>
          <span className="font-semibold text-white">Van Sales</span>
          <span className="text-white/70"> — all powered by AI that </span>
          <span className="italic text-white/90">guides</span>
          <span className="text-white/70"> your team, not just collects data.</span>
        </motion.p>

        {/* Value proposition */}
        <motion.p 
          variants={itemVariants}
          className="text-center text-lg md:text-xl text-amber-400/90 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Stop paying per user. Give everyone in your organization the power of digital and AI.
        </motion.p>

        {/* CTAs */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold px-10 py-6 text-lg rounded-lg shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300"
          >
            Get Started
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/contact")}
            className="border-white/30 bg-white/5 hover:bg-white/10 text-white font-semibold px-10 py-6 text-lg rounded-lg backdrop-blur-sm transition-all duration-300"
          >
            Request Demo
          </Button>
        </motion.div>

        {/* ROI Calculator link */}
        <motion.div variants={itemVariants}>
          <button 
            onClick={() => navigate("/roi-calculator")}
            className="inline-flex items-center gap-2 text-amber-400/80 hover:text-amber-400 text-sm font-medium transition-colors"
          >
            <Calculator className="h-4 w-4" />
            Calculate Your ROI Potential
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
};
