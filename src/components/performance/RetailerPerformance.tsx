import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Store, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { PerformanceData } from '@/hooks/usePerformanceSummary';

interface RetailerPerformanceProps {
  retailers: PerformanceData[];
  quantityUnit: string;
  isLoading?: boolean;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
};

const getProgressColor = (progress: number): string => {
  if (progress >= 80) return 'text-green-600';
  if (progress >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getProgressBgColor = (progress: number): string => {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

export function RetailerPerformance({ retailers, quantityUnit, isLoading }: RetailerPerformanceProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'revenue' | 'gap'>('progress');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Retailer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (retailers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Retailer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No retailer targets set. Add retailer targets in My Target to see breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter retailers
  const filteredRetailers = retailers.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort retailers
  const sortedRetailers = [...filteredRetailers].sort((a, b) => {
    if (sortBy === 'progress') return b.revenueProgress - a.revenueProgress;
    if (sortBy === 'revenue') return b.revenueActual - a.revenueActual;
    if (sortBy === 'gap') return b.revenueGap - a.revenueGap;
    return 0;
  });

  // Count status
  const onTrack = retailers.filter(r => r.revenueProgress >= 80).length;
  const atRisk = retailers.filter(r => r.revenueProgress >= 50 && r.revenueProgress < 80).length;
  const belowTarget = retailers.filter(r => r.revenueProgress < 50).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Retailer Performance
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{onTrack} on track</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">{atRisk} at risk</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{belowTarget} below</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search retailers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'progress' | 'revenue' | 'gap')}
            className="px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value="progress">Sort by Progress</option>
            <option value="revenue">Sort by Revenue</option>
            <option value="gap">Sort by Gap</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-96">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Retailer</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="text-right">Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRetailers.map(retailer => (
                <TableRow 
                  key={retailer.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/retailer/${retailer.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        retailer.revenueProgress >= 80 ? "bg-green-500" :
                        retailer.revenueProgress >= 50 ? "bg-yellow-500" :
                        "bg-red-500"
                      )} />
                      <span className="font-medium text-primary hover:underline flex items-center gap-1">
                        {retailer.name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(retailer.revenueTarget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(retailer.revenueActual)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-16">
                        <div 
                          className={cn("h-full rounded-full", getProgressBgColor(retailer.revenueProgress))}
                          style={{ width: `${Math.min(retailer.revenueProgress, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-medium w-12 text-right", getProgressColor(retailer.revenueProgress))}>
                        {retailer.revenueProgress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {retailer.revenueGap > 0 ? (
                      <span className="text-red-600">{formatCurrency(retailer.revenueGap)}</span>
                    ) : (
                      <span className="text-green-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filteredRetailers.length === 0 && searchQuery && (
          <div className="p-8 text-center text-muted-foreground">
            No retailers found matching "{searchQuery}"
          </div>
        )}
      </CardContent>
    </Card>
  );
}
