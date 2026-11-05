import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Store, Package, MapPin, User, AlertTriangle, TrendingUp } from "lucide-react";
import { CompetitionRetailerAnalyticsMobile } from "./CompetitionRetailerAnalyticsMobile";

interface CompetitionRetailerAnalyticsProps {
  competitionData: any[];
  skus: any[];
}

export function CompetitionRetailerAnalytics({ competitionData, skus }: CompetitionRetailerAnalyticsProps) {
  const analytics = useMemo(() => {
    // Top Retailers by Competition Product Stock
    const retailerStocks = competitionData.reduce((acc, item) => {
      const retailerName = item.retailers?.name || 'Unknown';
      if (!acc[retailerName]) {
        acc[retailerName] = {
          name: retailerName,
          totalStock: 0,
          observations: 0,
          highImpact: 0,
          needsAttention: 0
        };
      }
      acc[retailerName].totalStock += item.stock_quantity || 0;
      acc[retailerName].observations += 1;
      if (item.impact_level === 'high') acc[retailerName].highImpact += 1;
      if (item.needs_attention) acc[retailerName].needsAttention += 1;
      return acc;
    }, {} as Record<string, any>);

    const topRetailers = Object.values(retailerStocks)
      .sort((a: any, b: any) => b.totalStock - a.totalStock)
      .slice(0, 10);

    // Top Selling Products (by frequency of stock data)
    const productFrequency = competitionData.reduce((acc, item) => {
      const skuName = skus.find(s => s.id === item.sku_id)?.sku_name || 'Unknown';
      if (!acc[skuName]) {
        acc[skuName] = {
          name: skuName,
          observations: 0,
          totalStock: 0,
          avgStock: 0,
          highImpact: 0
        };
      }
      acc[skuName].observations += 1;
      acc[skuName].totalStock += item.stock_quantity || 0;
      if (item.impact_level === 'high') acc[skuName].highImpact += 1;
      return acc;
    }, {} as Record<string, any>);

    const topProducts = Object.values(productFrequency)
      .map((p: any) => ({
        ...p,
        avgStock: p.totalStock / p.observations
      }))
      .sort((a: any, b: any) => b.observations - a.observations)
      .slice(0, 10);

    // Regional Analysis (if location data available)
    const regionalData = competitionData.reduce((acc, item) => {
      const location = item.retailers?.location_tag || item.retailers?.address?.split(',')[0] || 'Unknown';
      if (!acc[location]) {
        acc[location] = {
          location,
          observations: 0,
          totalStock: 0,
          retailers: new Set()
        };
      }
      acc[location].observations += 1;
      acc[location].totalStock += item.stock_quantity || 0;
      acc[location].retailers.add(item.retailers?.name);
      return acc;
    }, {} as Record<string, any>);

    const topRegions = Object.values(regionalData)
      .map((r: any) => ({
        ...r,
        retailerCount: r.retailers.size
      }))
      .sort((a: any, b: any) => b.totalStock - a.totalStock)
      .slice(0, 5);

    // Sales Person Contribution
    const userContributions = competitionData.reduce((acc, item) => {
      const userId = item.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          observations: 0,
          highImpact: 0,
          needsAttention: 0,
          uniqueRetailers: new Set()
        };
      }
      acc[userId].observations += 1;
      if (item.impact_level === 'high') acc[userId].highImpact += 1;
      if (item.needs_attention) acc[userId].needsAttention += 1;
      acc[userId].uniqueRetailers.add(item.retailer_id);
      return acc;
    }, {} as Record<string, any>);

    const topContributors = Object.values(userContributions)
      .map((u: any) => ({
        ...u,
        retailersCovered: u.uniqueRetailers.size
      }))
      .sort((a: any, b: any) => b.observations - a.observations)
      .slice(0, 10);

    // Needs Attention Items
    const attentionItems = competitionData
      .filter(d => d.needs_attention)
      .map(d => ({
        id: d.id,
        sku: skus.find(s => s.id === d.sku_id)?.sku_name || 'Unknown',
        retailer: d.retailers?.name || 'Unknown',
        stockQty: d.stock_quantity,
        unit: d.unit,
        impactLevel: d.impact_level,
        insight: d.insight,
        date: d.visits?.planned_date || d.created_at
      }));

    // High Impact Items
    const highImpactItems = competitionData
      .filter(d => d.impact_level === 'high')
      .map(d => ({
        id: d.id,
        sku: skus.find(s => s.id === d.sku_id)?.sku_name || 'Unknown',
        retailer: d.retailers?.name || 'Unknown',
        stockQty: d.stock_quantity,
        unit: d.unit,
        needsAttention: d.needs_attention,
        insight: d.insight,
        date: d.visits?.planned_date || d.created_at
      }));

    return {
      topRetailers,
      topProducts,
      topRegions,
      topContributors,
      attentionItems,
      highImpactItems
    };
  }, [competitionData, skus]);

  return (
    <>
      {/* Mobile View */}
      <CompetitionRetailerAnalyticsMobile analytics={analytics} />
      
      {/* Desktop View */}
      <div className="hidden md:block space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Store className="h-4 w-4" />
              Top Retailers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.topRetailers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.topProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {analytics.attentionItems.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              High Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics.highImpactItems.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Retailers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Top Retailers Selling Competition Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Retailer Name</TableHead>
                <TableHead>Total Stock</TableHead>
                <TableHead>Observations</TableHead>
                <TableHead>High Impact</TableHead>
                <TableHead>Needs Attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topRetailers.map((retailer: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{retailer.name}</TableCell>
                  <TableCell>{retailer.totalStock.toFixed(0)}</TableCell>
                  <TableCell>{retailer.observations}</TableCell>
                  <TableCell>
                    {retailer.highImpact > 0 && (
                      <Badge variant="destructive">{retailer.highImpact}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {retailer.needsAttention > 0 && (
                      <Badge variant="secondary">{retailer.needsAttention}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Selling Competition Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Observations</TableHead>
                <TableHead>Avg Stock</TableHead>
                <TableHead>High Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topProducts.map((product: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.observations}</TableCell>
                  <TableCell>{product.avgStock.toFixed(1)}</TableCell>
                  <TableCell>
                    {product.highImpact > 0 && (
                      <Badge variant="destructive">{product.highImpact}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Regional Analysis */}
      {analytics.topRegions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Regional Competition Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Observations</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Retailers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topRegions.map((region: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{region.location}</TableCell>
                    <TableCell>{region.observations}</TableCell>
                    <TableCell>{region.totalStock.toFixed(0)}</TableCell>
                    <TableCell>{region.retailerCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Contributors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Top Intelligence Contributors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Observations</TableHead>
                <TableHead>Retailers Covered</TableHead>
                <TableHead>High Impact</TableHead>
                <TableHead>Flagged Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topContributors.map((user: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-sm">{user.userId.slice(0, 8)}...</TableCell>
                  <TableCell>{user.observations}</TableCell>
                  <TableCell>{user.retailersCovered}</TableCell>
                  <TableCell>
                    {user.highImpact > 0 && (
                      <Badge variant="destructive">{user.highImpact}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.needsAttention > 0 && (
                      <Badge variant="secondary">{user.needsAttention}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Needs Attention Section */}
      {analytics.attentionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Items Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {analytics.attentionItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.sku}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.retailer} • {item.stockQty} {item.unit}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="destructive">Attention</Badge>
                    {item.impactLevel && (
                      <Badge variant={item.impactLevel === 'high' ? 'destructive' : 'secondary'}>
                        {item.impactLevel}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* High Impact Section */}
      {analytics.highImpactItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              High Impact Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {analytics.highImpactItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.sku}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.retailer} • {item.stockQty} {item.unit}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="destructive">High Impact</Badge>
                    {item.needsAttention && (
                      <Badge variant="secondary">Attention</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}
