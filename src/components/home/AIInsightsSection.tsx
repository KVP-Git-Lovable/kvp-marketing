import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Calendar, TrendingUp, MapPin } from "lucide-react";
import { TomorrowBeatPlan } from "./TomorrowBeatPlan";
import { WeekAISummary } from "./WeekAISummary";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AIInsightsSectionProps {
  userId: string;
}

type InsightTab = 'tomorrow' | 'current' | 'next';

export const AIInsightsSection = ({ userId }: AIInsightsSectionProps) => {
  const [activeTab, setActiveTab] = useState<InsightTab>('tomorrow');
  const { t } = useTranslation('common');

  const tabs = [
    { 
      id: 'tomorrow' as InsightTab, 
      label: t('home.tomorrowsPlan'), 
      shortLabel: t('home.tomorrow'),
      icon: MapPin,
      description: t('home.beatInsights')
    },
    { 
      id: 'current' as InsightTab, 
      label: t('home.thisWeek'), 
      shortLabel: t('home.thisWeek'),
      icon: Calendar,
      description: t('home.currentWeekPerformance')
    },
    { 
      id: 'next' as InsightTab, 
      label: t('home.nextWeek'), 
      shortLabel: t('home.nextWeek'),
      icon: TrendingUp,
      description: t('home.upcomingWeekOutlook')
    },
  ];

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{t('home.aiInsights')}</h2>
          <p className="text-xs text-muted-foreground">{t('home.smartRecommendations')}</p>
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
          <Sparkles className="h-3 w-3 mr-1" />
          {t('home.poweredByAI')}
        </Badge>
      </div>

      {/* Tab Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="outline"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-auto py-3 px-3 flex flex-col items-center gap-1.5 transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]" 
                  : "hover:bg-primary/10 hover:border-primary/50"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-primary")} />
              <span className="text-xs font-medium">{tab.shortLabel}</span>
            </Button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
        <div className="relative">
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
          
          <div className="p-1 pt-2">
            {activeTab === 'tomorrow' && <TomorrowBeatPlanWrapper userId={userId} />}
            {activeTab === 'current' && <WeekAISummary userId={userId} weekType="current" />}
            {activeTab === 'next' && <WeekAISummary userId={userId} weekType="next" />}
          </div>
        </div>
      </Card>
    </div>
  );
};

// Wrapper to remove the outer card styling from TomorrowBeatPlan when embedded
const TomorrowBeatPlanWrapper = ({ userId }: { userId: string }) => {
  return (
    <div className="[&>div]:border-0 [&>div]:shadow-none">
      <TomorrowBeatPlan userId={userId} />
    </div>
  );
};