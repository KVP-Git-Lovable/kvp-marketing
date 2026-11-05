import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Package, MapPin, User, AlertTriangle, TrendingUp } from "lucide-react";

interface AnalyticsData {
  topRetailers: any[];
  topProducts: any[];
  topRegions: any[];
  topContributors: any[];
  attentionItems: any[];
  highImpactItems: any[];
}

interface CompetitionRetailerAnalyticsMobileProps {
  analytics: AnalyticsData;
}

export function CompetitionRetailerAnalyticsMobile({ analytics }: CompetitionRetailerAnalyticsMobileProps) {
  return (
    <div className="md:hidden space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Store className="h-3 w-3" />
              <span className="truncate">Top Retailers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{analytics.topRetailers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span className="truncate">Top Products</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{analytics.topProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="truncate">Needs Attention</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-destructive">
              {analytics.attentionItems.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span className="truncate">High Impact</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-600">
              {analytics.highImpactItems.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Retailers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Store className="h-4 w-4" />
            Top Retailers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.topRetailers.map((retailer: any, idx: number) => (
            <Card key={idx} className="border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">#{idx + 1}</Badge>
                    <span className="font-semibold text-sm break-words">{retailer.name}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="ml-1 font-medium">{retailer.totalStock.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Observations:</span>
                    <span className="ml-1 font-medium">{retailer.observations}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {retailer.highImpact > 0 && (
                    <Badge variant="destructive" className="text-xs">High: {retailer.highImpact}</Badge>
                  )}
                  {retailer.needsAttention > 0 && (
                    <Badge variant="secondary" className="text-xs">Attention: {retailer.needsAttention}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Top Products
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.topProducts.map((product: any, idx: number) => (
            <Card key={idx} className="border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">#{idx + 1}</Badge>
                    <span className="font-semibold text-sm break-words">{product.name}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Observations:</span>
                    <span className="ml-1 font-medium">{product.observations}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Stock:</span>
                    <span className="ml-1 font-medium">{product.avgStock.toFixed(1)}</span>
                  </div>
                </div>
                {product.highImpact > 0 && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-xs">High Impact: {product.highImpact}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Regional Analysis */}
      {analytics.topRegions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Regional Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topRegions.map((region: any, idx: number) => (
              <Card key={idx} className="border">
                <CardContent className="p-3">
                  <div className="font-semibold text-sm mb-2 break-words">{region.location}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Observations</span>
                      <span className="font-medium">{region.observations}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Stock</span>
                      <span className="font-medium">{region.totalStock.toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Retailers</span>
                      <span className="font-medium">{region.retailerCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Contributors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Top Contributors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.topContributors.map((user: any, idx: number) => (
            <Card key={idx} className="border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                  <span className="font-mono text-xs">{user.userId.slice(0, 12)}...</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Observations:</span>
                    <span className="ml-1 font-medium">{user.observations}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Retailers:</span>
                    <span className="ml-1 font-medium">{user.retailersCovered}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {user.highImpact > 0 && (
                    <Badge variant="destructive" className="text-xs">High: {user.highImpact}</Badge>
                  )}
                  {user.needsAttention > 0 && (
                    <Badge variant="secondary" className="text-xs">Flagged: {user.needsAttention}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Items Needing Attention */}
      {analytics.attentionItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.attentionItems.slice(0, 5).map((item: any, idx: number) => (
              <Card key={idx} className="border-destructive/50">
                <CardContent className="p-3">
                  <div className="font-semibold text-sm mb-2 break-words">{item.sku}</div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Retailer:</span>
                      <span className="ml-1">{item.retailer}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="ml-1">{item.stockQty} {item.unit}</span>
                    </div>
                    {item.insight && (
                      <div>
                        <span className="text-muted-foreground">Insight:</span>
                        <span className="ml-1 capitalize">{item.insight.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* High Impact Items */}
      {analytics.highImpactItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              High Impact Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.highImpactItems.slice(0, 5).map((item: any, idx: number) => (
              <Card key={idx} className="border-orange-200">
                <CardContent className="p-3">
                  <div className="font-semibold text-sm mb-2 break-words">{item.sku}</div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Retailer:</span>
                      <span className="ml-1">{item.retailer}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="ml-1">{item.stockQty} {item.unit}</span>
                    </div>
                    {item.insight && (
                      <div>
                        <span className="text-muted-foreground">Insight:</span>
                        <span className="ml-1 capitalize">{item.insight.replace('_', ' ')}</span>
                      </div>
                    )}
                    {item.needsAttention && (
                      <Badge variant="destructive" className="text-xs mt-1">Needs Attention</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
