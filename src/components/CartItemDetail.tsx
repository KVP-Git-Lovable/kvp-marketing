import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Package, Gift } from "lucide-react";

interface CartItemDetailProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    category: string;
    rate: number;
    unit: string;
    quantity: number;
    total: number;
  } | null;
}

export const CartItemDetail = ({ isOpen, onClose, item }: CartItemDetailProps) => {
  if (!item) return null;

  // Mock additional details that would come from the order context
  const itemDetails = {
    originalPrice: item.rate * item.quantity,
    discount: 0, // Calculate actual discount here
    savings: 0,
    appliedOffers: [] as string[],
    sku: "SKU12345", // Would come from product data
    stock: 50 // Would come from product data
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={20} />
            Item Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Item Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{item.name}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p className="font-medium">{item.category}</p>
              </div>
              <div>
                <span className="text-muted-foreground">SKU:</span>
                <p className="font-medium font-mono">{itemDetails.sku}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Rate:</span>
                <p className="font-medium">₹{item.rate}/{item.unit}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stock:</span>
                <p className="font-medium">{itemDetails.stock} {item.unit}s</p>
              </div>
            </div>
          </div>

          {/* Quantity & Pricing */}
          <div className="border rounded-lg p-3 space-y-2">
            <h4 className="font-medium">Order Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{item.quantity} {item.unit}s</span>
              </div>
              <div className="flex justify-between">
                <span>Unit Price:</span>
                <span>₹{item.rate}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{itemDetails.originalPrice.toFixed(2)}</span>
              </div>
              {itemDetails.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-₹{itemDetails.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-1 flex justify-between font-semibold">
                <span>Total:</span>
                <span>₹{item.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Applied Offers */}
          {itemDetails.appliedOffers.length > 0 && (
            <div className="border rounded-lg p-3 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={16} className="text-green-600" />
                <h4 className="font-medium text-green-800">Applied Offers</h4>
              </div>
              <div className="space-y-1">
                {itemDetails.appliedOffers.map((offer, index) => (
                  <div key={index} className="text-sm text-green-700">
                    • {offer}
                  </div>
                ))}
                {itemDetails.savings > 0 && (
                  <div className="text-sm font-medium text-green-600 pt-1 border-t border-green-200">
                    Total Savings: ₹{itemDetails.savings.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};