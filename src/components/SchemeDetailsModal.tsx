import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Gift, Calendar, Tag, Percent } from "lucide-react";

interface SchemeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  schemes: any[];
}

export const SchemeDetailsModal: React.FC<SchemeDetailsModalProps> = ({
  isOpen,
  onClose,
  productName,
  schemes
}) => {
  const getSchemeTypeIcon = (schemeType: string) => {
    switch (schemeType) {
      case 'volume_discount':
      case 'discount':
        return <Percent className="w-4 h-4" />;
      case 'buy_get':
        return <Gift className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getSchemeTypeLabel = (schemeType: string) => {
    switch (schemeType) {
      case 'volume_discount':
        return 'Volume Discount';
      case 'discount':
        return 'Discount';
      case 'buy_get':
        return 'Buy & Get';
      default:
        return 'Special Offer';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getConditionText = (scheme: any) => {
    const conditionType = scheme.quantity_condition_type === 'more_than' ? 'More than' : 'Exactly';
    return `${conditionType} ${scheme.condition_quantity} units`;
  };

  const getBenefitText = (scheme: any) => {
    if (scheme.scheme_type === 'volume_discount' || scheme.scheme_type === 'discount') {
      if (scheme.discount_percentage) {
        return `${scheme.discount_percentage}% discount`;
      } else if (scheme.discount_amount) {
        return `₹${scheme.discount_amount} discount`;
      }
    } else if (scheme.scheme_type === 'buy_get') {
      return `Get ${scheme.free_quantity} free`;
    }
    return 'Special benefit';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-orange-500" />
            Active Schemes for {productName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {schemes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No active schemes available</p>
            </div>
          ) : (
            schemes.map((scheme) => (
              <div key={scheme.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{scheme.name}</h3>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getSchemeTypeIcon(scheme.scheme_type)}
                    {getSchemeTypeLabel(scheme.scheme_type)}
                  </Badge>
                </div>
                
                {scheme.description && (
                  <p className="text-sm text-muted-foreground">{scheme.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Condition</p>
                    <p className="text-foreground">{getConditionText(scheme)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Benefit</p>
                    <p className="text-green-600 font-medium">{getBenefitText(scheme)}</p>
                  </div>
                </div>
                
                {(scheme.start_date || scheme.end_date) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {scheme.start_date && `From ${formatDate(scheme.start_date)}`}
                      {scheme.start_date && scheme.end_date && ' • '}
                      {scheme.end_date && `Until ${formatDate(scheme.end_date)}`}
                    </span>
                  </div>
                )}
                
                {scheme.variant_id && (
                  <Badge variant="outline" className="text-xs">
                    Applies to specific variant only
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};