import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Package } from "lucide-react";
import { StockCycleTable } from "./StockCycleTable";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  visitId: string;
  retailerId: string;
  retailerName: string;
  onViewDetails: (visitId: string) => void;
}

export const AnalyticsModal = ({ 
  isOpen, 
  onClose, 
  onBack, 
  visitId, 
  retailerId, 
  retailerName,
  onViewDetails 
}: AnalyticsModalProps) => {
  const [activeTab, setActiveTab] = useState("visit-details");

  const handleVisitDetailsClick = () => {
    onViewDetails(visitId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95%] max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            <DialogTitle className="text-lg font-semibold">Analytics - {retailerName}</DialogTitle>
          </div>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stock-cycle" className="flex items-center gap-2">
              <Package size={16} />
              Stock Cycle Tracking
            </TabsTrigger>
            <TabsTrigger value="visit-details" className="flex items-center gap-2">
              <BarChart3 size={16} />
              Visit Details
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="stock-cycle" className="mt-4">
            <StockCycleTable
              retailerId={retailerId}
              retailerName={retailerName}
              currentVisitId={visitId}
            />
          </TabsContent>
          
          <TabsContent value="visit-details" className="mt-4">
            <div className="text-center py-8">
              <BarChart3 size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Visit Analytics</h3>
              <p className="text-muted-foreground mb-4">
                View detailed analytics and insights for this visit
              </p>
              <Button onClick={handleVisitDetailsClick}>
                View Visit Details
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};