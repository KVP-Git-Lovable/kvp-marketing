import { Card } from "@/components/ui/card";
import { Award, Star, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeRecognitionBannerProps {
  employeeName: string;
  overallScore?: number;
  performanceBand?: 'exceptional' | 'strong' | 'developing' | 'needs_improvement';
  streak?: number;
  className?: string;
}

const greetings = [
  "Keep pushing forward",
  "Your efforts are making a difference",
  "Great work this month",
  "Stay focused and keep growing",
  "You're on the right track",
];

const bandMessages = {
  exceptional: {
    message: "Outstanding performance! You're a role model for the team.",
    icon: Trophy,
    gradient: "from-amber-500 via-yellow-500 to-orange-500",
    bgGradient: "from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30",
  },
  strong: {
    message: "Excellent work! Keep maintaining this momentum.",
    icon: Star,
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
  },
  developing: {
    message: "You're making progress! Focus on your improvement areas.",
    icon: TrendingUp,
    gradient: "from-purple-500 via-violet-500 to-indigo-500",
    bgGradient: "from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30",
  },
  needs_improvement: {
    message: "Every expert was once a beginner. Keep learning!",
    icon: Sparkles,
    gradient: "from-rose-500 via-pink-500 to-red-500",
    bgGradient: "from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30",
  },
};

export function EmployeeRecognitionBanner({
  employeeName,
  overallScore,
  performanceBand = 'developing',
  streak,
  className,
}: EmployeeRecognitionBannerProps) {
  const firstName = employeeName?.split(' ')[0] || 'Champion';
  const config = bandMessages[performanceBand];
  const IconComponent = config.icon;
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-lg",
      className
    )}>
      <div className={cn("p-5 bg-gradient-to-br", config.bgGradient)}>
        <div className="flex items-start gap-4">
          {/* Icon with gradient */}
          <div className={cn(
            "flex-shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
            config.gradient
          )}>
            <IconComponent className="h-7 w-7 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold truncate">
                Hello, {firstName}! 👋
              </h2>
              {streak && streak > 3 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  🔥 {streak} day streak
                </span>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {config.message}
            </p>

            {overallScore !== undefined && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5">
                  <Award className={cn("h-4 w-4 bg-gradient-to-r bg-clip-text", config.gradient)} style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text' }} />
                  <span className="text-sm font-medium">Current Score:</span>
                  <span className={cn(
                    "text-lg font-bold bg-gradient-to-r bg-clip-text",
                    config.gradient
                  )} style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text' }}>
                    {Math.round(overallScore)}%
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground/70 mt-2 italic">
              "{randomGreeting}, {firstName}!"
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
