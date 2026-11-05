import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { PerformanceData } from '@/hooks/usePerformanceSummary';

interface TerritoryPerformanceProps {
  territories: PerformanceData[];
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

export function TerritoryPerformance({ territories, quantityUnit, isLoading }: TerritoryPerformanceProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory Performance
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

  if (territories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No territory targets set. Add territory targets in My Target to see breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Territory Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Territory</TableHead>
                <TableHead className="text-right">Revenue Target</TableHead>
                <TableHead className="text-right">Revenue Actual</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="text-right">Qty Target</TableHead>
                <TableHead className="text-right">Qty Actual</TableHead>
                <TableHead className="text-center">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {territories.map(territory => (
                <TableRow key={territory.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/territory/${territory.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-primary hover:underline">
                      {territory.name}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(territory.revenueTarget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(territory.revenueActual)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", getProgressBgColor(territory.revenueProgress))}
                          style={{ width: `${Math.min(territory.revenueProgress, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-medium w-12 text-right", getProgressColor(territory.revenueProgress))}>
                        {territory.revenueProgress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{territory.quantityTarget.toFixed(0)} {quantityUnit}</TableCell>
                  <TableCell className="text-right">{territory.quantityActual.toFixed(0)} {quantityUnit}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", getProgressBgColor(territory.quantityProgress))}
                          style={{ width: `${Math.min(territory.quantityProgress, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-medium w-12 text-right", getProgressColor(territory.quantityProgress))}>
                        {territory.quantityProgress}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
