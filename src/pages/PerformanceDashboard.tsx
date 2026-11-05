import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calendar, Target, ArrowLeft } from 'lucide-react';
import { ModuleHelpButton } from "@/components/help/ModuleHelpButton";
import { useAuth } from '@/hooks/useAuth';
import { usePerformanceSummary, type PerformancePeriod } from '@/hooks/usePerformanceSummary';
import { OverallPerformanceHeader } from '@/components/performance/OverallPerformanceHeader';
import { TerritoryPerformance } from '@/components/performance/TerritoryPerformance';
import { BeatPerformance } from '@/components/performance/BeatPerformance';
import { RetailerPerformance } from '@/components/performance/RetailerPerformance';
import { AIRecommendations } from '@/components/performance/AIRecommendations';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const periodOptions: { value: PerformancePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This FY' },
];

const PerformanceDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('this_month');
  
  const { overall, territories, beats, retailers, isLoading } = usePerformanceSummary(
    user?.id,
    selectedPeriod
  );

  return (
    <Layout>
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Performance Dashboard</h1>
                  <p className="text-muted-foreground text-sm">Track your target vs. actual performance</p>
                </div>
                <ModuleHelpButton categoryId="performance" />
              </div>
            </div>
            
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as PerformancePeriod)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Period Pills (Mobile) */}
          <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden">
            {periodOptions.map(option => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(option.value)}
                className="whitespace-nowrap"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Overall Performance */}
          <OverallPerformanceHeader performance={overall} isLoading={isLoading} period={selectedPeriod} />

          {/* Quick Stats */}
          {!isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{territories.length}</div>
                  <div className="text-sm text-muted-foreground">Territories</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{beats.length}</div>
                  <div className="text-sm text-muted-foreground">Active Beats</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {retailers.filter(r => r.revenueProgress >= 80).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Retailers On Track</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {retailers.filter(r => r.revenueProgress < 50).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Need Attention</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Territory Performance */}
          <TerritoryPerformance 
            territories={territories} 
            quantityUnit={overall.quantityUnit}
            isLoading={isLoading} 
          />

          {/* Beat & Retailer Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BeatPerformance 
              beats={beats} 
              quantityUnit={overall.quantityUnit}
              isLoading={isLoading} 
            />
            <RetailerPerformance 
              retailers={retailers} 
              quantityUnit={overall.quantityUnit}
              isLoading={isLoading} 
            />
          </div>

          {/* AI Recommendations - after territory and retailer performance */}
          <AIRecommendations
            overall={overall}
            territories={territories}
            beats={beats}
            retailers={retailers}
            isLoading={isLoading}
          />

          {/* Link to My Target */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Want to update your targets? Go to My Target to configure revenue and quantity goals.
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/my-target')}>
                My Target
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default PerformanceDashboard;
