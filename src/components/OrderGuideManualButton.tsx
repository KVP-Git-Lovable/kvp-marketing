import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, Download, Loader2 } from 'lucide-react';
import { generateOrderGuideManualPDF } from '@/utils/orderGuideManualGenerator';
import { toast } from '@/hooks/use-toast';

interface OrderGuideManualButtonProps {
  variant?: 'icon' | 'button' | 'full';
  className?: string;
}

export const OrderGuideManualButton: React.FC<OrderGuideManualButtonProps> = ({
  variant = 'icon',
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateOrderGuideManualPDF();
      toast({
        title: "Guide Downloaded",
        description: "Order Entry Guide PDF has been saved to your device.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Download Failed",
        description: "Could not generate the guide. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={isGenerating}
        className={className}
        title="Download Order Entry Guide"
      >
        {isGenerating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <HelpCircle className="h-5 w-5" />
        )}
      </Button>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={isGenerating}
        className={className}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Order Guide
      </Button>
    );
  }

  // Full variant
  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isGenerating}
      className={`w-full justify-start ${className}`}
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 mr-3 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-3" />
      )}
      Download Order Entry Guide (PDF)
    </Button>
  );
};
