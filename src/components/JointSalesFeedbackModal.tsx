import { useState, useEffect } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, Star, TrendingUp, Store, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JointSalesFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  retailerName: string;
  beatPlanId?: string | null;
  visitId?: string;
  managerId?: string | null;
  onFeedbackSubmitted?: () => void;
  editId?: string | null;
  editData?: any;
}

// Scoring configuration - New model: each positive response = 5 points, low = 1 point
// 11 feedback fields total, max score = 55, final displayed as average out of 10
const DROPDOWN_SCORES: Record<string, number> = {
  // Placement (5=best, 1=worst)
  "Excellent - Prime shelf space": 5,
  "Good - Visible location": 4,
  "Average - Needs improvement": 2,
  "Poor - Not visible": 1,
  // Willingness to grow range
  "Highly willing - Ready to expand": 5,
  "Willing - Open to new products": 4,
  "Hesitant - Needs convincing": 2,
  "Not willing - Satisfied with current": 1,
  // Schemes
  "Highly effective - Driving sales": 5,
  "Moderately effective": 4,
  "Not very effective": 2,
  "Needs better schemes": 1,
  // Pricing
  "Very competitive": 5,
  "Competitive": 4,
  "Slightly higher than competitors": 2,
  "Too expensive": 1,
  // Promotion vs Competition
  "Actively promotes us over competition": 5,
  "Promotes equally with competition": 4,
  "Prefers competition slightly": 2,
  "Heavily promotes competition": 1,
  // Product USP
  "Clearly understands and promotes USP": 5,
  "Aware of key USPs": 4,
  "Limited awareness": 2,
  "No awareness of USP": 1,
};

// New scoring model: Star ratings directly count (1-5), dropdowns use mapped values
// Total max = 55 (5 star fields × 5 + 6 dropdown fields × 5), displayed as score out of 10
export const calculateJointVisitScore = (feedback: any): number => {
  const starFields = [
    'product_packaging_feedback',
    'product_sku_range_feedback', 
    'product_quality_feedback',
    'service_feedback',
    'consumer_feedback'
  ];
  
  const dropdownFields = [
    'placement_feedback',
    'willingness_to_grow_range',
    'schemes_feedback',
    'pricing_feedback',
    'promotion_vs_competition',
    'product_usp_feedback'
  ];
  
  let totalPoints = 0;
  const MAX_SCORE = 55; // 11 fields × 5 points each
  
  // Star ratings (1-5 points directly)
  starFields.forEach(field => {
    const value = parseInt(feedback[field]) || 0;
    if (value > 0) {
      totalPoints += value; // Direct star value (1-5)
    }
  });
  
  // Dropdown scores (1-5 based on response quality)
  dropdownFields.forEach(field => {
    const value = feedback[field];
    if (value && DROPDOWN_SCORES[value]) {
      totalPoints += DROPDOWN_SCORES[value];
    }
  });
  
  if (totalPoints === 0) return 0;
  // Convert to score out of 10: (totalPoints / 55) * 10
  return Math.round((totalPoints / MAX_SCORE) * 100) / 10;
};

export const JointSalesFeedbackModal = ({
  isOpen,
  onClose,
  retailerId,
  retailerName,
  beatPlanId,
  visitId,
  managerId,
  onFeedbackSubmitted,
  editId,
  editData
}: JointSalesFeedbackModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState(managerId || "");
  const [selectedManagerName, setSelectedManagerName] = useState("");
  const [availableManagers, setAvailableManagers] = useState<Array<{ id: string; name: string }>>([]);
  const [feedback, setFeedback] = useState({
    product_packaging_feedback: "",
    product_sku_range_feedback: "",
    placement_feedback: "",
    willingness_to_grow_range: "",
    product_quality_feedback: "",
    service_feedback: "",
    schemes_feedback: "",
    pricing_feedback: "",
    consumer_feedback: "",
    promotion_vs_competition: "",
    product_usp_feedback: "",
    joint_sales_impact: "",
    order_increase_amount: "",
    monthly_potential_6months: ""
  });

  // Calculate live score
  const currentScore = calculateJointVisitScore(feedback);

  // Load available managers and selected manager name
  useEffect(() => {
    const loadManagers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username').match(ACTIVE_PROFILE)
          .neq('id', user.id)
          .order('full_name');

        if (!error && data) {
          setAvailableManagers(data.map(p => ({ 
            id: p.id, 
            name: p.full_name || p.username || 'Unknown User'
          })));
        }
      } catch (error) {
        console.error('Error loading managers:', error);
      }
    };

    const loadManagerName = async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', id)
          .single();

        if (!error && data) {
          setSelectedManagerName(data.full_name || data.username || 'Unknown User');
        }
      } catch (error) {
        console.error('Error loading manager name:', error);
      }
    };

    if (isOpen) {
      if (!managerId) {
        loadManagers();
      }
      // Load manager name if we have a managerId or selectedManagerId
      if (managerId) {
        loadManagerName(managerId);
      }
    }
  }, [isOpen, managerId]);

  // Load existing feedback from editData or from database
  useEffect(() => {
    const loadExistingFeedback = async () => {
      // If editData is provided, use it directly
      if (editData) {
        setSelectedManagerId(editData.manager_id || '');
        setFeedback({
          product_packaging_feedback: editData.product_packaging_feedback?.toString() || "",
          product_sku_range_feedback: editData.product_sku_range_feedback?.toString() || "",
          placement_feedback: editData.placement_feedback || "",
          willingness_to_grow_range: editData.willingness_to_grow_range || "",
          product_quality_feedback: editData.product_quality_feedback?.toString() || "",
          service_feedback: editData.service_feedback?.toString() || "",
          schemes_feedback: editData.schemes_feedback || "",
          pricing_feedback: editData.pricing_feedback || "",
          consumer_feedback: editData.consumer_feedback?.toString() || "",
          promotion_vs_competition: editData.promotion_vs_competition || "",
          product_usp_feedback: editData.product_usp_feedback || "",
          joint_sales_impact: editData.joint_sales_impact || "",
          order_increase_amount: editData.order_increase_amount?.toString() || "",
          monthly_potential_6months: editData.monthly_potential_6months?.toString() || ""
        });
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        let query = supabase
          .from('joint_sales_feedback')
          .select('*')
          .eq('retailer_id', retailerId)
          .eq('feedback_date', today);

        if (beatPlanId) {
          query = query.eq('beat_plan_id', beatPlanId);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          setSelectedManagerId(data.manager_id);
          
          // Load manager name for display
          const { data: managerProfile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', data.manager_id)
            .single();
          
          if (managerProfile) {
            setSelectedManagerName(managerProfile.full_name || managerProfile.username || 'Unknown User');
          }
          
          setFeedback({
            product_packaging_feedback: data.product_packaging_feedback || "",
            product_sku_range_feedback: data.product_sku_range_feedback || "",
            placement_feedback: data.placement_feedback || "",
            willingness_to_grow_range: data.willingness_to_grow_range || data.new_products_introduced || "",
            product_quality_feedback: data.product_quality_feedback || "",
            service_feedback: data.service_feedback || "",
            schemes_feedback: data.schemes_feedback || "",
            pricing_feedback: data.pricing_feedback || "",
            consumer_feedback: data.consumer_feedback || "",
            promotion_vs_competition: data.promotion_vs_competition || "",
            product_usp_feedback: data.product_usp_feedback || "",
            joint_sales_impact: data.joint_sales_impact || "",
            order_increase_amount: data.order_increase_amount?.toString() || "",
            monthly_potential_6months: data.monthly_potential_6months?.toString() || ""
          });
        }
      } catch (error) {
        console.error('Error loading feedback:', error);
      }
    };

    if (isOpen && retailerId) {
      loadExistingFeedback();
    }
  }, [isOpen, beatPlanId, retailerId]);

  useEffect(() => {
    if (managerId) {
      setSelectedManagerId(managerId);
    }
  }, [managerId]);

  const handleSubmit = async () => {
    if (!selectedManagerId) {
      toast({
        title: "Manager Required",
        description: "Please select the joint visit partner",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate visit_id exists in visits table before using it
      let validVisitId: string | null = null;
      if (visitId && visitId.length === 36) {
        // Check if this visit_id actually exists in the visits table
        const { data: visitExists } = await supabase
          .from('visits')
          .select('id')
          .eq('id', visitId)
          .maybeSingle();
        
        if (visitExists) {
          validVisitId = visitId;
        }
      }
      
      const feedbackData: any = {
        manager_id: selectedManagerId,
        fse_user_id: user.id,
        retailer_id: retailerId,
        visit_id: validVisitId,
        feedback_date: new Date().toISOString().split('T')[0],
        product_packaging_feedback: feedback.product_packaging_feedback || null,
        product_sku_range_feedback: feedback.product_sku_range_feedback || null,
        placement_feedback: feedback.placement_feedback || null,
        willingness_to_grow_range: feedback.willingness_to_grow_range || null,
        product_quality_feedback: feedback.product_quality_feedback || null,
        service_feedback: feedback.service_feedback || null,
        schemes_feedback: feedback.schemes_feedback || null,
        pricing_feedback: feedback.pricing_feedback || null,
        consumer_feedback: feedback.consumer_feedback || null,
        promotion_vs_competition: feedback.promotion_vs_competition || null,
        product_usp_feedback: feedback.product_usp_feedback || null,
        joint_sales_impact: feedback.joint_sales_impact || null,
        order_increase_amount: parseFloat(feedback.order_increase_amount) || 0,
        monthly_potential_6months: parseFloat(feedback.monthly_potential_6months) || 0,
        updated_at: new Date().toISOString()
      };

      if (beatPlanId) {
        feedbackData.beat_plan_id = beatPlanId;
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from('joint_sales_feedback')
        .select('id')
        .eq('retailer_id', retailerId)
        .eq('feedback_date', feedbackData.feedback_date)
        .eq('fse_user_id', user.id)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing
        const result = await supabase
          .from('joint_sales_feedback')
          .update(feedbackData)
          .eq('id', existing.id);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('joint_sales_feedback')
          .insert(feedbackData);
        error = result.error;
      }

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast({
        title: "Joint Visit Recorded",
        description: `Feedback saved with score: ${currentScore}/10`,
      });

      onFeedbackSubmitted?.();
      window.dispatchEvent(new CustomEvent('jointSalesFeedbackSubmitted', {
        detail: { retailerId }
      }));

      onClose();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = (value: string, onChange: (value: string) => void) => {
    const rating = parseInt(value) || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star.toString())}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              size={28}
              className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}
            />
          </button>
        ))}
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-100";
    if (score >= 6) return "text-yellow-600 bg-yellow-100";
    if (score >= 4) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-purple-600" />
              Joint Sales Feedback
            </DialogTitle>
            {currentScore > 0 && (
              <Badge className={`text-lg px-3 py-1 ${getScoreColor(currentScore)}`}>
                Score: {currentScore}/10
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{retailerName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Joint Visit Partner Selection or Display */}
          <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
            <Label className="text-purple-800 dark:text-purple-200 font-medium">Joint Visit Partner *</Label>
            {managerId ? (
              <div className="mt-2 p-2 bg-background rounded border flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600" />
                <span className="font-medium">{selectedManagerName || 'Loading...'}</span>
              </div>
            ) : (
              <Select value={selectedManagerId} onValueChange={(value) => {
                setSelectedManagerId(value);
                const manager = availableManagers.find(m => m.id === value);
                setSelectedManagerName(manager?.name || '');
              }}>
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Select who joined the visit" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Section 1: Performance Ratings (Star Ratings) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
              <Star className="h-4 w-4" />
              Performance Ratings
            </div>
            <div className="grid gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Product Packaging</Label>
                  <p className="text-xs text-muted-foreground">Packaging quality & appeal</p>
                </div>
                {renderStarRating(feedback.product_packaging_feedback, (value) => 
                  setFeedback({ ...feedback, product_packaging_feedback: value })
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Product SKU Range</Label>
                  <p className="text-xs text-muted-foreground">Variety of products stocked</p>
                </div>
                {renderStarRating(feedback.product_sku_range_feedback, (value) => 
                  setFeedback({ ...feedback, product_sku_range_feedback: value })
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Product Quality</Label>
                  <p className="text-xs text-muted-foreground">Customer satisfaction with quality</p>
                </div>
                {renderStarRating(feedback.product_quality_feedback, (value) => 
                  setFeedback({ ...feedback, product_quality_feedback: value })
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Service Quality</Label>
                  <p className="text-xs text-muted-foreground">Overall service & support</p>
                </div>
                {renderStarRating(feedback.service_feedback, (value) => 
                  setFeedback({ ...feedback, service_feedback: value })
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Consumer Satisfaction</Label>
                  <p className="text-xs text-muted-foreground">End consumer feedback</p>
                </div>
                {renderStarRating(feedback.consumer_feedback, (value) => 
                  setFeedback({ ...feedback, consumer_feedback: value })
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Store Assessment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Store className="h-4 w-4" />
              Store Assessment
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label className="font-medium">Product Placement</Label>
                <Select
                  value={feedback.placement_feedback}
                  onValueChange={(value) => setFeedback({ ...feedback, placement_feedback: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Excellent - Prime shelf space">Excellent - Prime shelf</SelectItem>
                    <SelectItem value="Good - Visible location">Good - Visible</SelectItem>
                    <SelectItem value="Average - Needs improvement">Average</SelectItem>
                    <SelectItem value="Poor - Not visible">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Promotes Us vs Competition</Label>
                <Select
                  value={feedback.promotion_vs_competition}
                  onValueChange={(value) => setFeedback({ ...feedback, promotion_vs_competition: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Actively promotes us over competition">Actively promotes us</SelectItem>
                    <SelectItem value="Promotes equally with competition">Promotes equally</SelectItem>
                    <SelectItem value="Prefers competition slightly">Prefers competition</SelectItem>
                    <SelectItem value="Heavily promotes competition">Heavily promotes competition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Product USP Awareness</Label>
                <Select
                  value={feedback.product_usp_feedback}
                  onValueChange={(value) => setFeedback({ ...feedback, product_usp_feedback: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Clearly understands and promotes USP">Understands & promotes USP</SelectItem>
                    <SelectItem value="Aware of key USPs">Aware of key USPs</SelectItem>
                    <SelectItem value="Limited awareness">Limited awareness</SelectItem>
                    <SelectItem value="No awareness of USP">No awareness</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Schemes Effectiveness</Label>
                <Select
                  value={feedback.schemes_feedback}
                  onValueChange={(value) => setFeedback({ ...feedback, schemes_feedback: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Highly effective - Driving sales">Highly effective</SelectItem>
                    <SelectItem value="Moderately effective">Moderate</SelectItem>
                    <SelectItem value="Not very effective">Low</SelectItem>
                    <SelectItem value="Needs better schemes">Needs improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Pricing Competitiveness</Label>
                <Select
                  value={feedback.pricing_feedback}
                  onValueChange={(value) => setFeedback({ ...feedback, pricing_feedback: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Very competitive">Very competitive</SelectItem>
                    <SelectItem value="Competitive">Competitive</SelectItem>
                    <SelectItem value="Slightly higher than competitors">Slightly higher</SelectItem>
                    <SelectItem value="Too expensive">Too expensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Willingness to Grow Range</Label>
                <Select
                  value={feedback.willingness_to_grow_range}
                  onValueChange={(value) => setFeedback({ ...feedback, willingness_to_grow_range: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Highly willing - Ready to expand">Highly willing</SelectItem>
                    <SelectItem value="Willing - Open to new products">Willing</SelectItem>
                    <SelectItem value="Hesitant - Needs convincing">Hesitant</SelectItem>
                    <SelectItem value="Not willing - Satisfied with current">Not willing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Sales Outcome */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
              <TrendingUp className="h-4 w-4" />
              Sales Outcome
            </div>
            <div className="p-4 bg-muted/30 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Order Increase (₹)</Label>
                  <Input
                    type="number"
                    value={feedback.order_increase_amount}
                    onChange={(e) => setFeedback({ ...feedback, order_increase_amount: e.target.value })}
                    placeholder="Additional order value"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">Due to this joint visit</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="font-medium">6-Month Growth Potential (₹)</Label>
                  <Input
                    type="number"
                    value={feedback.monthly_potential_6months}
                    onChange={(e) => setFeedback({ ...feedback, monthly_potential_6months: e.target.value })}
                    placeholder="Expected monthly value"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">Avg monthly purchase in 6 months</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300">
              <MessageSquare className="h-4 w-4" />
              Summary Notes
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <Textarea
                value={feedback.joint_sales_impact}
                onChange={(e) => setFeedback({ ...feedback, joint_sales_impact: e.target.value })}
                placeholder="Summarize key discussion points, action items, and overall impact of this joint visit..."
                rows={3}
                className="bg-background"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {currentScore > 0 && (
              <span className={`font-medium ${currentScore >= 7 ? 'text-green-600' : currentScore >= 5 ? 'text-yellow-600' : 'text-orange-600'}`}>
                {currentScore >= 8 ? "Excellent visit!" : currentScore >= 6 ? "Good progress" : currentScore >= 4 ? "Room for improvement" : "Needs attention"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
