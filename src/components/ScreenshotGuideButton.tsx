import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { generateOrderGuideWithScreenshotsPDF } from '@/utils/orderGuideWithScreenshotsPDF';
import { toast } from '@/hooks/use-toast';

interface ScreenshotGuideButtonProps {
  variant?: 'icon' | 'button' | 'full';
  className?: string;
}

export const ScreenshotGuideButton: React.FC<ScreenshotGuideButtonProps> = ({
  variant = 'button',
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateOrderGuideWithScreenshotsPDF();
      toast({
        title: "Guide Downloaded",
        description: "Order Creation Guide with visual instructions has been saved.",
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
        title="Download Visual Order Guide"
      >
        {isGenerating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <FileText className="h-5 w-5" />
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
        Visual Guide
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
        <FileText className="h-4 w-4 mr-3" />
      )}
      Download Visual Order Guide (PDF with Screenshots)
    </Button>
  );
};
