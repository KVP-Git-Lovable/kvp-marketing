import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnabledBasis } from './HierarchyUserTargetNode';

interface Beat {
  id: string;
  beat_id: string;
  beat_name: string;
}

interface BeatTarget {
  beatId: string;
  beatName: string;
  quantityTarget: number;
  revenueTarget: number;
}

interface UserBeatTargetsProps {
  userId: string;
  fyYear: number;
  totalQuantity: number;
  totalRevenue: number;
  quantityUnit: string;
  selectedTargetType: 'quantity' | 'revenue' | 'visits';
  enabledBasis: EnabledBasis;
}

export function UserBeatTargets({
  userId,
  fyYear,
  totalQuantity,
  totalRevenue,
  quantityUnit,
  selectedTargetType,
  enabledBasis,
}: UserBeatTargetsProps) {
  const [equalDivide, setEqualDivide] = useState(true);
  const [beatTargets, setBeatTargets] = useState<BeatTarget[]>([]);
  const queryClient = useQueryClient();

  // Fetch beats for the user
  const { data: beats, isLoading: beatsLoading } = useQuery({
    queryKey: ['user-beats-for-targets', userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('beats')
        .select('id, beat_id, beat_name')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .order('beat_name');

      if (error) throw error;
      return (data || []) as Beat[];
    },
    enabled: !!userId,
  });

  // Fetch user's business plan
  const { data: businessPlan } = useQuery({
    queryKey: ['user-business-plan', userId, fyYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_business_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('year', fyYear)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch existing beat targets
  const { data: existingTargets } = useQuery({
    queryKey: ['user-beat-targets', userId, fyYear, businessPlan?.id],
    queryFn: async () => {
      if (!businessPlan?.id) return [];
      const { data, error } = await supabase
        .from('user_business_plan_territory_beats')
        .select('*')
        .eq('business_plan_id', businessPlan.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!businessPlan?.id,
  });

  // Initialize beat targets when beats are loaded
  useEffect(() => {
    if (!beats?.length) return;

    const numBeats = beats.length;
    const equalQty = numBeats > 0 ? totalQuantity / numBeats : 0;
    const equalRev = numBeats > 0 ? totalRevenue / numBeats : 0;

    const newTargets = beats.map((beat) => {
      const existing = existingTargets?.find((t: any) => t.beat_id === beat.id);
      return {
        beatId: beat.id,
        beatName: beat.beat_name,
        quantityTarget: existing?.quantity_target ?? (equalDivide ? equalQty : 0),
        revenueTarget: existing?.revenue_target ?? (equalDivide ? equalRev : 0),
      };
    });

    setBeatTargets(newTargets);
  }, [beats, existingTargets, totalQuantity, totalRevenue, equalDivide]);

  // Apply equal divide
  useEffect(() => {
    if (!equalDivide || !beats?.length) return;

    const numBeats = beats.length;
    const equalQty = numBeats > 0 ? totalQuantity / numBeats : 0;
    const equalRev = numBeats > 0 ? totalRevenue / numBeats : 0;

    setBeatTargets((prev) =>
      prev.map((t) => ({
        ...t,
        quantityTarget: equalQty,
        revenueTarget: equalRev,
      }))
    );
  }, [equalDivide, totalQuantity, totalRevenue, beats?.length]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!businessPlan?.id) {
        throw new Error('No business plan found for this user and FY');
      }

      // Upsert beat targets - include territory_id as required by schema
      const upsertData = beatTargets.map((bt) => ({
        business_plan_id: businessPlan.id,
        beat_id: bt.beatId,
        beat_name: bt.beatName,
        quantity_target: bt.quantityTarget,
        revenue_target: bt.revenueTarget,
        territory_id: 'default', // Required field - will be updated when territory context is added
      }));

      // Delete existing and insert new
      await supabase
        .from('user_business_plan_territory_beats')
        .delete()
        .eq('business_plan_id', businessPlan.id);

      const { error } = await supabase
        .from('user_business_plan_territory_beats')
        .insert(upsertData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Beat targets saved');
      queryClient.invalidateQueries({ queryKey: ['user-beat-targets', userId, fyYear] });
    },
    onError: (error: any) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const handleTargetChange = (beatId: string, field: 'quantityTarget' | 'revenueTarget', value: number) => {
    setEqualDivide(false);
    setBeatTargets((prev) =>
      prev.map((t) => (t.beatId === beatId ? { ...t, [field]: value } : t))
    );
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(Math.round(num));

  // Calculate totals
  const totals = useMemo(() => {
    return beatTargets.reduce(
      (acc, t) => ({
        quantity: acc.quantity + t.quantityTarget,
        revenue: acc.revenue + t.revenueTarget,
      }),
      { quantity: 0, revenue: 0 }
    );
  }, [beatTargets]);

  if (beatsLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!beats?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No beats assigned to this user</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Equal Divide Option */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`equal-divide-beat-${userId}`}
            checked={equalDivide}
            onCheckedChange={(checked) => setEqualDivide(!!checked)}
          />
          <Label htmlFor={`equal-divide-beat-${userId}`} className="text-sm cursor-pointer">
            Equally divide across all beats
          </Label>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !businessPlan}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      {/* Beat List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {beatTargets.map((bt) => (
          <div
            key={bt.beatId}
            className="flex items-center gap-3 p-3 bg-background rounded-lg border"
          >
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-sm font-medium truncate">{bt.beatName}</span>

            {enabledBasis.quantity && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  value={bt.quantityTarget || ''}
                  onChange={(e) =>
                    handleTargetChange(bt.beatId, 'quantityTarget', parseFloat(e.target.value) || 0)
                  }
                  className="w-24 h-8 text-sm"
                  disabled={equalDivide}
                />
                <span className="text-xs text-muted-foreground">{quantityUnit}</span>
              </div>
            )}

            {enabledBasis.revenue && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min="0"
                  value={bt.revenueTarget || ''}
                  onChange={(e) =>
                    handleTargetChange(bt.beatId, 'revenueTarget', parseFloat(e.target.value) || 0)
                  }
                  className="w-28 h-8 text-sm"
                  disabled={equalDivide}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="flex items-center justify-between pt-2 border-t text-sm">
        <span className="text-muted-foreground">Total Allocated:</span>
        <div className="flex items-center gap-3">
          {enabledBasis.quantity && (
            <Badge variant={Math.abs(totals.quantity - totalQuantity) < 1 ? 'default' : 'secondary'}>
              {formatNumber(totals.quantity)} / {formatNumber(totalQuantity)} {quantityUnit}
            </Badge>
          )}
          {enabledBasis.revenue && (
            <Badge variant={Math.abs(totals.revenue - totalRevenue) < 1 ? 'default' : 'secondary'}>
              ₹{formatNumber(totals.revenue)} / ₹{formatNumber(totalRevenue)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
