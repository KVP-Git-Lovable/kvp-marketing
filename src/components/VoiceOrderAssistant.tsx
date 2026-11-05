import React, { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { useVoiceOrder } from '@/hooks/useVoiceOrder';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { VoiceProduct, AutoFillResult } from '@/hooks/useVoiceOrder';

interface VoiceOrderAssistantProps {
  products: VoiceProduct[];
  onAutoFillProducts: (results: AutoFillResult[]) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceOrderAssistant: React.FC<VoiceOrderAssistantProps> = ({
  products,
  onAutoFillProducts,
  disabled = false,
  className,
}) => {
  const {
    isRecording,
    isProcessing,
    transcript,
    autoFillResults,
    startRecording,
    stopRecording,
    clearResults,
    error,
    isSupported,
  } = useVoiceOrder(products);

  // When auto-fill results are available, call the callback
  useEffect(() => {
    if (autoFillResults.length > 0) {
      console.log('🎤 VoiceOrderAssistant: Auto-fill results received:', autoFillResults);
      console.log('🎤 VoiceOrderAssistant: Products available:', products.length);
      onAutoFillProducts(autoFillResults);
      // Clear results after processing
      clearResults();
    }
  }, [autoFillResults, onAutoFillProducts, clearResults]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  if (!isSupported) {
    return null; // Don't render if not supported
  }

  return (
    <>
      <Button
        variant={isRecording ? "default" : "outline"}
        onClick={handleToggleRecording}
        disabled={disabled || isProcessing}
        className={cn(
          "flex-1 h-7 text-xs transition-all",
          isRecording && "bg-red-500 hover:bg-red-600 text-white animate-pulse",
          className
        )}
        size="sm"
      >
        {isProcessing ? (
          <>
            <Loader2 size={12} className="mr-0.5 animate-spin" />
            Processing...
          </>
        ) : isRecording ? (
          <>
            <MicOff size={12} className="mr-0.5" />
            Stop
          </>
        ) : (
          <>
            <Mic size={12} className="mr-0.5" />
            Voice
          </>
        )}
      </Button>

      {/* Recording overlay */}
      {(isRecording || isProcessing) && (
        <Card className="fixed bottom-20 left-4 right-4 z-50 shadow-lg border-2 border-primary">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {isRecording ? (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="text-sm font-medium text-red-600">Listening...</span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={14} className="animate-spin text-primary" />
                      <span className="text-sm font-medium">Processing order...</span>
                    </>
                  )}
                </div>
                
                {transcript && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 italic">
                    "{transcript}"
                  </p>
                )}
                
                {error && (
                  <p className="text-sm text-destructive mt-2">{error}</p>
                )}
                
                {isRecording && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Speak: "[product name] [qty] [unit]" - e.g., "Adrak 20g 5 kg"
                  </p>
                )}
              </div>
              
              {isRecording && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={stopRecording}
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
