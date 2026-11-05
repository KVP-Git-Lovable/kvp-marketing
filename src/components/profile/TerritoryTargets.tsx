import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, X, Trash2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Territory {
  id: string;
  name: string;
  region: string | null;
  territory_type: string | null;
  beats: Beat[];
}

interface Beat {
  id: string;
  beat_name: string;
  territory_id: string;
}

interface TerritoryTarget {
  territoryId: string;
  territoryName: string;
  region: string | null;
  percentage: number;
  quantityTarget: number;
  revenueTarget: number;
  equalDivide: boolean;
  beats: BeatTarget[];
}

interface BeatTarget {
  beatId: string;
  beatName: string;
  percentage: number;
  quantityTarget: number;
  revenueTarget: number;
}

interface TerritoryTargetsProps {
  selectedPlanId: string | null;
  userId: string | null;
  quantityUnit: string;
}

export function TerritoryTargets({ selectedPlanId, userId, quantityUnit }: TerritoryTargetsProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoryTargets, setTerritoryTargets] = useState<TerritoryTarget[]>([]);
  const [expandedTerritories, setExpandedTerritories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [territoryEqualDivide, setTerritoryEqualDivide] = useState(true);
  const [territoryTotalQuantity, setTerritoryTotalQuantity] = useState(0);
  const [territoryTotalRevenue, setTerritoryTotalRevenue] = useState(0);

  useEffect(() => {
    if (userId) {
      loadTerritoriesWithBeats();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedPlanId && territories.length > 0) {
      loadExistingTerritoryTargets();
    }
  }, [selectedPlanId, territories]);

  const loadTerritoriesWithBeats = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Get territories where user is the owner
      const { data: territoriesData, error: terrError } = await supabase
        .from('territories')
        .select('id, name, region, territory_type')
        .eq('owner_id', userId)
        .order('name');

      if (terrError) throw terrError;

      // Get all beats for these territories
      const territoryIds = territoriesData?.map(t => t.id) || [];
      
      if (territoryIds.length === 0) {
        setTerritories([]);
        setTerritoryTargets([]);
        setLoading(false);
        return;
      }

      const { data: beatsData, error: beatsError } = await supabase
        .from('beats')
        .select('id, beat_name, territory_id')
        .in('territory_id', territoryIds)
        .eq('is_active', true)
        .order('beat_name');

      if (beatsError) throw beatsError;

      // Group beats by territory
      const territoriesWithBeats: Territory[] = (territoriesData || []).map(t => ({
        ...t,
        beats: (beatsData || []).filter(b => b.territory_id === t.id)
      }));

      setTerritories(territoriesWithBeats);
    } catch (error: any) {
      toast.error("Failed to load territories: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTerritoryTargets = async () => {
    if (!selectedPlanId) return;

    try {
      // Load territory targets
      const { data: territoryData } = await supabase
        .from('user_business_plan_territories')
        .select('*')
        .eq('business_plan_id', selectedPlanId);

      // Load beat targets
      const { data: beatData } = await supabase
        .from('user_business_plan_territory_beats')
        .select('*')
        .eq('business_plan_id', selectedPlanId);

      // Initialize territory targets from territories
      const newTerritoryTargets: TerritoryTarget[] = territories.map(terr => {
        const existingTerritory = territoryData?.find(td => td.territory_id === terr.id);
        
        return {
          territoryId: terr.id,
          territoryName: terr.name,
          region: terr.region,
          percentage: territories.length > 0 ? 100 / territories.length : 0,
          quantityTarget: existingTerritory?.quantity_target || 0,
          revenueTarget: existingTerritory?.revenue_target || 0,
          equalDivide: true,
          beats: terr.beats.map(b => {
            const existingBeat = beatData?.find(bd => bd.beat_id === b.id && bd.territory_id === terr.id);
            return {
              beatId: b.id,
              beatName: b.beat_name,
              percentage: existingBeat?.percentage || (terr.beats.length > 0 ? 100 / terr.beats.length : 0),
              quantityTarget: existingBeat?.quantity_target || 0,
              revenueTarget: existingBeat?.revenue_target || 0
            };
          })
        };
      });

      // Calculate totals first
      const totalQty = newTerritoryTargets.reduce((sum, t) => sum + t.quantityTarget, 0);
      const totalRev = newTerritoryTargets.reduce((sum, t) => sum + t.revenueTarget, 0);
      setTerritoryTotalQuantity(totalQty);
      setTerritoryTotalRevenue(totalRev);

      // Calculate territory percentages based on revenue
      if (totalRev > 0) {
        newTerritoryTargets.forEach(terr => {
          terr.percentage = (terr.revenueTarget / totalRev) * 100;
        });
      }

      // Calculate if equal divide is being used for territories
      if (totalRev > 0 && newTerritoryTargets.length > 0) {
        const expectedPct = 100 / newTerritoryTargets.length;
        const isEqual = newTerritoryTargets.every(t => Math.abs(t.percentage - expectedPct) < 0.5);
        setTerritoryEqualDivide(isEqual);
      }

      // Calculate beat percentages and equal divide
      newTerritoryTargets.forEach(terr => {
        if (terr.revenueTarget > 0 && terr.beats.length > 0) {
          const beatRevTotal = terr.beats.reduce((sum, b) => sum + b.revenueTarget, 0);
          if (beatRevTotal > 0) {
            terr.beats.forEach(b => {
              b.percentage = (b.revenueTarget / beatRevTotal) * 100;
            });
            // Check if it's roughly equal
            const expectedPct = 100 / terr.beats.length;
            terr.equalDivide = terr.beats.every(b => Math.abs(b.percentage - expectedPct) < 0.5);
          }
        }
      });

      setTerritoryTargets(newTerritoryTargets);
    } catch (error: any) {
      toast.error("Failed to load territory targets: " + error.message);
    }
  };

  const toggleTerritoryExpand = (territoryId: string) => {
    const newExpanded = new Set(expandedTerritories);
    if (newExpanded.has(territoryId)) {
      newExpanded.delete(territoryId);
    } else {
      newExpanded.add(territoryId);
    }
    setExpandedTerritories(newExpanded);
  };

  const handleTerritoryTotalTargetChange = (quantityValue: number, revenueValue: number) => {
    setTerritoryTotalQuantity(quantityValue);
    setTerritoryTotalRevenue(revenueValue);
    
    if (territoryTargets.length > 0) {
      setTerritoryTargets(prev => prev.map(terr => {
        const terrQty = territoryEqualDivide 
          ? quantityValue / prev.length 
          : (terr.percentage / 100) * quantityValue;
        const terrRev = territoryEqualDivide 
          ? revenueValue / prev.length 
          : (terr.percentage / 100) * revenueValue;
        return {
          ...terr,
          percentage: territoryEqualDivide ? 100 / prev.length : terr.percentage,
          quantityTarget: terrQty,
          revenueTarget: terrRev,
          beats: terr.beats.map(b => ({
            ...b,
            quantityTarget: terr.equalDivide && terr.beats.length > 0 ? terrQty / terr.beats.length : (b.percentage / 100) * terrQty,
            revenueTarget: terr.equalDivide && terr.beats.length > 0 ? terrRev / terr.beats.length : (b.percentage / 100) * terrRev
          }))
        };
      }));
    }
  };

  const handleTerritoryEqualDivideChange = (checked: boolean) => {
    setTerritoryEqualDivide(checked);
    if (territoryTargets.length > 0) {
      const equalPct = 100 / territoryTargets.length;
      const terrQty = territoryTotalQuantity / territoryTargets.length;
      const terrRev = territoryTotalRevenue / territoryTargets.length;
      
      setTerritoryTargets(prev => prev.map(terr => {
        const newQty = checked ? terrQty : terr.quantityTarget;
        const newRev = checked ? terrRev : terr.revenueTarget;
        return {
          ...terr,
          percentage: checked ? equalPct : terr.percentage,
          quantityTarget: newQty,
          revenueTarget: newRev,
          beats: terr.beats.map(b => ({
            ...b,
            quantityTarget: terr.equalDivide && terr.beats.length > 0 ? newQty / terr.beats.length : (b.percentage / 100) * newQty,
            revenueTarget: terr.equalDivide && terr.beats.length > 0 ? newRev / terr.beats.length : (b.percentage / 100) * newRev
          }))
        };
      }));
    }
  };

  const handleTerritoryPercentageChange = (territoryId: string, percentage: number) => {
    setTerritoryEqualDivide(false);
    
    setTerritoryTargets(prev => {
      const newTargets = prev.map(terr => {
        if (terr.territoryId !== territoryId) return terr;
        
        const newQty = (percentage / 100) * territoryTotalQuantity;
        const newRev = (percentage / 100) * territoryTotalRevenue;
        
        return {
          ...terr,
          percentage,
          quantityTarget: newQty,
          revenueTarget: newRev,
          beats: terr.beats.map(b => ({
            ...b,
            quantityTarget: terr.equalDivide && terr.beats.length > 0 ? newQty / terr.beats.length : (b.percentage / 100) * newQty,
            revenueTarget: terr.equalDivide && terr.beats.length > 0 ? newRev / terr.beats.length : (b.percentage / 100) * newRev
          }))
        };
      });
      
      return newTargets;
    });
  };

  const handleTerritoryTargetChange = (territoryId: string, quantityValue: number, revenueValue: number) => {
    setTerritoryEqualDivide(false);
    
    setTerritoryTargets(prev => {
      const newTargets = prev.map(terr => {
        if (terr.territoryId !== territoryId) return terr;
        
        const newBeats = terr.beats.map(b => ({
          ...b,
          quantityTarget: terr.equalDivide && terr.beats.length > 0 ? quantityValue / terr.beats.length : (b.percentage / 100) * quantityValue,
          revenueTarget: terr.equalDivide && terr.beats.length > 0 ? revenueValue / terr.beats.length : (b.percentage / 100) * revenueValue
        }));
        
        return { ...terr, quantityTarget: quantityValue, revenueTarget: revenueValue, beats: newBeats };
      });
      
      const newTotalQty = newTargets.reduce((sum, t) => sum + t.quantityTarget, 0);
      const newTotalRev = newTargets.reduce((sum, t) => sum + t.revenueTarget, 0);
      setTerritoryTotalQuantity(newTotalQty);
      setTerritoryTotalRevenue(newTotalRev);
      
      // Update percentages based on new totals
      if (newTotalRev > 0) {
        return newTargets.map(t => ({
          ...t,
          percentage: (t.revenueTarget / newTotalRev) * 100
        }));
      }
      
      return newTargets;
    });
  };

  const handleBeatEqualDivideChange = (territoryId: string, checked: boolean) => {
    setTerritoryTargets(prev => prev.map(terr => {
      if (terr.territoryId !== territoryId) return terr;
      
      const newBeats = terr.beats.map(b => ({
        ...b,
        percentage: checked ? 100 / terr.beats.length : b.percentage,
        quantityTarget: checked ? terr.quantityTarget / terr.beats.length : (b.percentage / 100) * terr.quantityTarget,
        revenueTarget: checked ? terr.revenueTarget / terr.beats.length : (b.percentage / 100) * terr.revenueTarget
      }));
      
      return { ...terr, equalDivide: checked, beats: newBeats };
    }));
  };

  const handleBeatPercentageChange = (territoryId: string, beatId: string, percentage: number) => {
    setTerritoryTargets(prev => prev.map(terr => {
      if (terr.territoryId !== territoryId) return terr;
      
      const newBeats = terr.beats.map(b => {
        if (b.beatId !== beatId) return b;
        return {
          ...b,
          percentage,
          quantityTarget: (percentage / 100) * terr.quantityTarget,
          revenueTarget: (percentage / 100) * terr.revenueTarget
        };
      });
      
      return { ...terr, equalDivide: false, beats: newBeats };
    }));
  };

  const removeTerritory = (territoryId: string) => {
    setTerritoryTargets(prev => {
      const newTargets = prev.filter(t => t.territoryId !== territoryId);
      const newTotalQty = newTargets.reduce((sum, t) => sum + t.quantityTarget, 0);
      const newTotalRev = newTargets.reduce((sum, t) => sum + t.revenueTarget, 0);
      setTerritoryTotalQuantity(newTotalQty);
      setTerritoryTotalRevenue(newTotalRev);
      return newTargets;
    });
  };

  const removeBeat = (territoryId: string, beatId: string) => {
    setTerritoryTargets(prev => prev.map(terr => {
      if (terr.territoryId !== territoryId) return terr;
      const newBeats = terr.beats.filter(b => b.beatId !== beatId);
      return { ...terr, beats: newBeats };
    }));
  };

  const saveTerritoryTargets = async () => {
    if (!selectedPlanId) return;
    
    try {
      // Delete existing territory targets
      await supabase
        .from('user_business_plan_territories')
        .delete()
        .eq('business_plan_id', selectedPlanId);

      // Delete existing beat targets
      await supabase
        .from('user_business_plan_territory_beats')
        .delete()
        .eq('business_plan_id', selectedPlanId);

      // Insert territory targets
      const territoriesToInsert = territoryTargets
        .filter(t => t.quantityTarget > 0 || t.revenueTarget > 0)
        .map(t => ({
          business_plan_id: selectedPlanId,
          territory_id: t.territoryId,
          territory_name: t.territoryName,
          quantity_target: Math.round(t.quantityTarget),
          revenue_target: Math.round(t.revenueTarget)
        }));

      if (territoriesToInsert.length > 0) {
        const { error } = await supabase
          .from('user_business_plan_territories')
          .insert(territoriesToInsert);
        if (error) throw error;
      }

      // Insert beat targets
      const beatsToInsert = territoryTargets.flatMap(terr => 
        terr.beats
          .filter(b => b.quantityTarget > 0 || b.revenueTarget > 0 || b.percentage > 0)
          .map(b => ({
            business_plan_id: selectedPlanId,
            territory_id: terr.territoryId,
            beat_id: b.beatId,
            beat_name: b.beatName,
            percentage: b.percentage,
            quantity_target: Math.round(b.quantityTarget),
            revenue_target: Math.round(b.revenueTarget)
          }))
      );

      if (beatsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_business_plan_territory_beats')
          .insert(beatsToInsert);
        if (error) throw error;
      }

      toast.success("Territory targets saved");
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    }
  };

  const totalTerritoryQuantity = useMemo(() => 
    territoryTargets.reduce((sum, t) => sum + t.quantityTarget, 0), 
    [territoryTargets]
  );

  const totalTerritoryRevenue = useMemo(() => 
    territoryTargets.reduce((sum, t) => sum + t.revenueTarget, 0), 
    [territoryTargets]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={saveTerritoryTargets}>
          Save Targets
        </Button>
      </div>

      {territoryTargets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No territories assigned to you</p>
            <p className="text-xs text-muted-foreground mt-1">Territories are assigned based on owner_id</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Total targets with equal divide */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Label className="text-xs font-semibold whitespace-nowrap text-primary">Total Qty ({quantityUnit})</Label>
                  <Input
                    type="number"
                    value={territoryTotalQuantity || ''}
                    onChange={(e) => handleTerritoryTotalTargetChange(parseFloat(e.target.value) || 0, territoryTotalRevenue)}
                    className="w-24 sm:w-28 h-8 text-right font-semibold bg-background border-primary/30 focus:border-primary"
                    placeholder="Quantity"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Label className="text-xs font-semibold whitespace-nowrap text-green-600 dark:text-green-400">Total Revenue (₹)</Label>
                  <Input
                    type="number"
                    value={territoryTotalRevenue || ''}
                    onChange={(e) => handleTerritoryTotalTargetChange(territoryTotalQuantity, parseFloat(e.target.value) || 0)}
                    className="w-24 sm:w-28 h-8 text-right font-semibold bg-background border-green-500/30 focus:border-green-500"
                    placeholder="Revenue"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-muted">
                <Checkbox
                  id="territory-equal-divide-all"
                  checked={territoryEqualDivide}
                  onCheckedChange={(checked) => handleTerritoryEqualDivideChange(checked as boolean)}
                />
                <Label htmlFor="territory-equal-divide-all" className="text-xs cursor-pointer">
                  Equally divide across all territories
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Territory-wise breakdown */}
          <div className="space-y-2">
            {territoryTargets.map(terr => (
              <Card key={terr.territoryId}>
                <Collapsible
                  open={expandedTerritories.has(terr.territoryId)}
                  onOpenChange={() => toggleTerritoryExpand(terr.territoryId)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-3 cursor-pointer hover:bg-muted/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {expandedTerritories.has(terr.territoryId) ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{terr.territoryName}</span>
                          {terr.region && (
                            <span className="text-xs text-muted-foreground">({terr.region})</span>
                          )}
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {terr.beats.length} beats
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-6 sm:ml-0" onClick={e => e.stopPropagation()}>
                          {!territoryEqualDivide && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={terr.percentage.toFixed(1)}
                                onChange={(e) => handleTerritoryPercentageChange(terr.territoryId, parseFloat(e.target.value) || 0)}
                                className="w-12 sm:w-14 h-8 text-right text-xs"
                                min={0}
                                max={100}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          )}
                          <Input
                            type="number"
                            value={terr.quantityTarget || ''}
                            onChange={(e) => handleTerritoryTargetChange(terr.territoryId, parseFloat(e.target.value) || 0, terr.revenueTarget)}
                            className="w-16 sm:w-20 h-8 text-right text-sm"
                            placeholder="Qty"
                          />
                          <Input
                            type="number"
                            value={terr.revenueTarget || ''}
                            onChange={(e) => handleTerritoryTargetChange(terr.territoryId, terr.quantityTarget, parseFloat(e.target.value) || 0)}
                            className="w-20 sm:w-24 h-8 text-right text-sm"
                            placeholder="₹"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive flex-shrink-0"
                            onClick={() => removeTerritory(terr.territoryId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="px-3 pb-3 pt-0">
                      {terr.beats.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">No beats linked to this territory</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded">
                            <Checkbox
                              id={`beat-equal-${terr.territoryId}`}
                              checked={terr.equalDivide}
                              onCheckedChange={(checked) => handleBeatEqualDivideChange(terr.territoryId, checked as boolean)}
                            />
                            <Label htmlFor={`beat-equal-${terr.territoryId}`} className="text-xs cursor-pointer">
                              Equally divide across beats
                            </Label>
                          </div>
                          <div className="space-y-2">
                            {terr.beats.map(b => (
                              <div key={b.beatId} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                                <span className="text-sm truncate flex-1 min-w-0">{b.beatName}</span>
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  {!terr.equalDivide && (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        value={b.percentage.toFixed(1)}
                                        onChange={(e) => handleBeatPercentageChange(terr.territoryId, b.beatId, parseFloat(e.target.value) || 0)}
                                        className="w-12 sm:w-14 h-7 text-right text-xs"
                                        min={0}
                                        max={100}
                                      />
                                      <span className="text-xs text-muted-foreground">%</span>
                                    </div>
                                  )}
                                  <span className="text-xs w-12 sm:w-16 text-right">
                                    {Math.round(b.quantityTarget).toLocaleString()}
                                  </span>
                                  <span className="text-sm font-medium w-14 sm:w-20 text-right">
                                    ₹{Math.round(b.revenueTarget).toLocaleString()}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => removeBeat(terr.territoryId, b.beatId)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Territory beat totals */}
                          <div className="flex justify-between items-center pt-2 mt-2 border-t text-xs">
                            <span className="font-medium">Territory Total</span>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="w-10 sm:w-14 text-center">{terr.beats.reduce((s, b) => s + b.percentage, 0).toFixed(1)}%</span>
                              <span className="w-12 sm:w-16 text-right">{Math.round(terr.beats.reduce((s, b) => s + b.quantityTarget, 0)).toLocaleString()}</span>
                              <span className="w-14 sm:w-20 text-right font-medium">₹{Math.round(terr.beats.reduce((s, b) => s + b.revenueTarget, 0)).toLocaleString()}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>

          {/* Territory Total Footer */}
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-sm font-medium">Total Territory Target</span>
                <div className="text-right">
                  <span className="text-sm font-bold">{Math.round(totalTerritoryQuantity).toLocaleString()} {quantityUnit}</span>
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span className="text-sm font-bold">₹{Math.round(totalTerritoryRevenue).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
