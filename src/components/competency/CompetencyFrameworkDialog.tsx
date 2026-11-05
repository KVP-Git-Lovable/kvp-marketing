import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, Target, TrendingUp, BarChart3, Award, CheckCircle2, Brain } from "lucide-react";

export function CompetencyFrameworkDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          How it works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Understanding Your Competency Score
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6 py-2">
            {/* What is Competency */}
            <section className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                What is Competency?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Competency measures <strong>how well you do your job</strong>, not just whether you hit targets. 
                It looks at your daily work habits, consistency, and growth over time.
              </p>
            </section>

            {/* How We Calculate */}
            <section className="space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-500" />
                How We Calculate Your Score
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p><strong>Your Average:</strong> We look at your last 3 months to understand your normal performance level.</p>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p><strong>Daily Rate:</strong> We measure visits per day, sales per visit - so early month doesn't hurt your score.</p>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p><strong>Improvement:</strong> Are you getting better? Staying same? That affects your score.</p>
                </div>
              </div>
            </section>

            {/* The 7 Competencies */}
            <section className="space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                The 7 Areas We Measure
              </h3>
              <div className="grid gap-2 text-sm">
                <CompetencyItem emoji="🗺️" name="Territory Coverage" desc="How well you cover all your assigned areas" />
                <CompetencyItem emoji="⚡" name="Productivity" desc="Orders placed per visit" />
                <CompetencyItem emoji="💰" name="Revenue Generation" desc="Sales value you bring in" />
                <CompetencyItem emoji="⏰" name="Discipline" desc="Attendance and working hours" />
                <CompetencyItem emoji="🏪" name="Retailer Development" desc="Growing relationships with shops" />
                <CompetencyItem emoji="📦" name="Product Mix" desc="Selling variety of products" />
                <CompetencyItem emoji="💳" name="Collection" desc="Timely payment collection" />
              </div>
            </section>

            {/* Score Meaning */}
            <section className="space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                What Your Score Means
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ScoreBand color="bg-emerald-500" range="85-100" label="Exceptional" />
                <ScoreBand color="bg-green-500" range="70-84" label="Strong" />
                <ScoreBand color="bg-yellow-500" range="50-69" label="Developing" />
                <ScoreBand color="bg-orange-500" range="30-49" label="Needs Support" />
                <ScoreBand color="bg-red-500" range="0-29" label="Critical" />
              </div>
            </section>

            {/* Key Point */}
            <section className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium text-center">
                💡 Remember: This score shows your <strong>ability and consistency</strong>, not just one month's numbers. 
                Focus on doing your daily tasks well!
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CompetencyItem({ emoji, name, desc }: { emoji: string; name: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function ScoreBand({ color, range, label }: { color: string; range: string; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div>
        <p className="font-medium text-xs">{range}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
