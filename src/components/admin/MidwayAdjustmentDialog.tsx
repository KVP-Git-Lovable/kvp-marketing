import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  UserPlus, 
  UserMinus, 
  GitBranch, 
  GitMerge, 
  AlertCircle,
  Calculator,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export type AdjustmentType = 'join' | 'leave' | 'territory_split' | 'territory_merge';

interface UserInfo {
  userId: string;
  fullName: string;
  profilePictureUrl?: string | null;
  currentQuantityTarget: number;
  currentRevenueTarget: number;
}

interface MidwayAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hierarchyTargetId: string;
  fyYear: number;
  adjustmentType: AdjustmentType;
  affectedUser?: UserInfo;
  teamMembers: UserInfo[];
  onComplete: () => void;
}

type RedistributionMethod = 'redistribute_equal' | 'redistribute_proportional' | 'reduce_total' | 'carry_forward';

export const MidwayAdjustmentDialog: React.FC<MidwayAdjustmentDialogProps> = ({
  open,
  onOpenChange,
  hierarchyTargetId,
  fyYear,
  adjustmentType,
  affectedUser,
  teamMembers,
  onComplete,
}) => {
  const { user } = useAuth();
  const [redistributionMethod, setRedistributionMethod] = useState<RedistributionMethod>('redistribute_equal');
  const [newUserName, setNewUserName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate remaining months in FY
  const getRemainingMonths = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    // FY runs April (3) to March (2)
    if (currentMonth >= 3) {
      return 12 - (currentMonth - 3);
    }
    return 3 - currentMonth;
  };

  const remainingMonths = getRemainingMonths();
  const proRataFactor = remainingMonths / 12;

  const getTitle = () => {
    switch (adjustmentType) {
      case 'join': return 'New Team Member Joining';
      case 'leave': return 'Team Member Leaving';
      case 'territory_split': return 'Territory Split';
      case 'territory_merge': return 'Territory Merge';
    }
  };

  const getIcon = () => {
    switch (adjustmentType) {
      case 'join': return <UserPlus className="h-5 w-5" />;
      case 'leave': return <UserMinus className="h-5 w-5" />;
      case 'territory_split': return <GitBranch className="h-5 w-5" />;
      case 'territory_merge': return <GitMerge className="h-5 w-5" />;
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      if (adjustmentType === 'leave' && affectedUser) {
        // Mark the user's allocation as ended
        await (supabase as any)
          .from('hierarchy_target_allocations')
          .update({ period_end: new Date().toISOString().split('T')[0] } as any)
          .eq('hierarchy_target_id', hierarchyTargetId)
          .eq('user_id', affectedUser.userId);

        // Handle redistribution based on method
        if (redistributionMethod === 'redistribute_equal' || redistributionMethod === 'redistribute_proportional') {
          const otherMembers = teamMembers.filter(m => m.userId !== affectedUser.userId);
          const targetToRedistribute = {
            quantity: affectedUser.currentQuantityTarget * proRataFactor,
            revenue: affectedUser.currentRevenueTarget * proRataFactor,
          };

          if (redistributionMethod === 'redistribute_equal') {
            const perMemberQty = targetToRedistribute.quantity / otherMembers.length;
            const perMemberRev = targetToRedistribute.revenue / otherMembers.length;

            for (const member of otherMembers) {
              await supabase
                .from('hierarchy_target_allocations')
                .update({
                  target_value: member.currentQuantityTarget + perMemberQty,
                  allocated_value: member.currentRevenueTarget + perMemberRev,
                } as any)
                .eq('hierarchy_target_id', hierarchyTargetId)
                .eq('user_id', member.userId)
                .is('effective_to', null);
            }
          } else {
            // Proportional redistribution based on current targets
            const totalCurrentRev = otherMembers.reduce((sum, m) => sum + m.currentRevenueTarget, 0);
            
            for (const member of otherMembers) {
              const proportion = totalCurrentRev > 0 ? member.currentRevenueTarget / totalCurrentRev : 1 / otherMembers.length;
              await supabase
                .from('hierarchy_target_allocations')
                .update({
                  target_value: member.currentQuantityTarget + (targetToRedistribute.quantity * proportion),
                  allocated_value: member.currentRevenueTarget + (targetToRedistribute.revenue * proportion),
                } as any)
                .eq('hierarchy_target_id', hierarchyTargetId)
                .eq('user_id', member.userId)
                .is('effective_to', null);
            }
          }
        }

        // Log history
        await supabase.from('hierarchy_target_history').insert({
          hierarchy_target_id: hierarchyTargetId,
          user_id: affectedUser.userId,
          change_type: 'left',
          previous_target: {
            quantity_target: affectedUser.currentQuantityTarget,
            revenue_target: affectedUser.currentRevenueTarget,
          },
          new_target: null,
          reason: reason || `Team member left. Method: ${redistributionMethod}`,
          changed_by: user?.id,
          affected_users: teamMembers.map(m => m.userId),
        });

        toast.success('Team member removed and targets redistributed');
      } else if (adjustmentType === 'join' && newUserId) {
        // Calculate pro-rated target for new joiner
        const avgTeamQty = teamMembers.reduce((sum, m) => sum + m.currentQuantityTarget, 0) / Math.max(teamMembers.length, 1);
        const avgTeamRev = teamMembers.reduce((sum, m) => sum + m.currentRevenueTarget, 0) / Math.max(teamMembers.length, 1);
        
        const proRatedQty = avgTeamQty * proRataFactor;
        const proRatedRev = avgTeamRev * proRataFactor;

        // Create allocation for new joiner
        await supabase.from('hierarchy_target_allocations').insert({
          hierarchy_target_id: hierarchyTargetId,
          user_id: newUserId,
          level: 1, // Will need to be calculated based on actual position
          allocation_percentage: 0,
          quantity_target: proRatedQty,
          revenue_target: proRatedRev,
          effective_from: joiningDate,
          allocation_method: 'manual',
        });

        // Log history
        await supabase.from('hierarchy_target_history').insert({
          hierarchy_target_id: hierarchyTargetId,
          user_id: newUserId,
          change_type: 'joined',
          previous_target: null,
          new_target: {
            quantity_target: proRatedQty,
            revenue_target: proRatedRev,
            joining_date: joiningDate,
          },
          reason: reason || `New team member joined on ${joiningDate}. Pro-rated target assigned.`,
          changed_by: user?.id,
        });

        toast.success('New team member added with pro-rated target');
      }

      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to process adjustment: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            Adjust hierarchy targets for mid-year changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Affected User Info (for leave/split) */}
          {affectedUser && (adjustmentType === 'leave' || adjustmentType === 'territory_split') && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar>
                <AvatarImage src={affectedUser.profilePictureUrl || undefined} />
                <AvatarFallback>
                  {affectedUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{affectedUser.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  Current: {affectedUser.currentQuantityTarget.toFixed(0)} qty / ₹{affectedUser.currentRevenueTarget.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* New Joiner Fields */}
          {adjustmentType === 'join' && (
            <>
              <div className="space-y-2">
                <Label>Select New Team Member</Label>
                <Input
                  placeholder="Enter user ID or search..."
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>
              <Alert>
                <Calculator className="h-4 w-4" />
                <AlertDescription>
                  Pro-rated target will be calculated for {remainingMonths} remaining months ({(proRataFactor * 100).toFixed(0)}% of annual target)
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Redistribution Method (for leave) */}
          {adjustmentType === 'leave' && (
            <div className="space-y-3">
              <Label>How to handle remaining target?</Label>
              <RadioGroup value={redistributionMethod} onValueChange={(v) => setRedistributionMethod(v as RedistributionMethod)}>
                <div className="flex items-start space-x-2 p-2 rounded hover:bg-muted">
                  <RadioGroupItem value="redistribute_equal" id="redistribute_equal" className="mt-1" />
                  <div>
                    <Label htmlFor="redistribute_equal" className="font-normal cursor-pointer">
                      Redistribute Equally
                    </Label>
                    <p className="text-xs text-muted-foreground">Split remaining target equally among team</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 p-2 rounded hover:bg-muted">
                  <RadioGroupItem value="redistribute_proportional" id="redistribute_proportional" className="mt-1" />
                  <div>
                    <Label htmlFor="redistribute_proportional" className="font-normal cursor-pointer">
                      Redistribute Proportionally
                    </Label>
                    <p className="text-xs text-muted-foreground">Distribute based on current target allocation</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 p-2 rounded hover:bg-muted">
                  <RadioGroupItem value="reduce_total" id="reduce_total" className="mt-1" />
                  <div>
                    <Label htmlFor="reduce_total" className="font-normal cursor-pointer">
                      Reduce Total Target
                    </Label>
                    <p className="text-xs text-muted-foreground">Remove the target without redistribution</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 p-2 rounded hover:bg-muted">
                  <RadioGroupItem value="carry_forward" id="carry_forward" className="mt-1" />
                  <div>
                    <Label htmlFor="carry_forward" className="font-normal cursor-pointer">
                      Carry Forward (Replacement)
                    </Label>
                    <p className="text-xs text-muted-foreground">Keep target for replacement hire</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Add notes about this adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Apply Adjustment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
