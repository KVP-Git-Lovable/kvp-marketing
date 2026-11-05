import { memo, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { cn } from '@/lib/utils';

interface VoiceConversationDialogProps {
  onClose: () => void;
}

export const VoiceConversationDialog = memo(({ onClose }: VoiceConversationDialogProps) => {
  const {
    status,
    isSpeaking,
    isConnecting,
    messages,
    error,
    startConversation,
    stopConversation,
  } = useVoiceAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-start conversation when component mounts
  useEffect(() => {
    startConversation();
    
    return () => {
      if (status === 'connected') {
        stopConversation();
      }
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEndCall = async () => {
    await stopConversation();
    onClose();
  };

  const isConnected = status === 'connected';
  const isDisconnected = status === 'disconnected';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Status Header */}
      <div className="flex items-center justify-center gap-2 py-4 border-b bg-muted/30">
        {isConnecting && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Connecting...</span>
          </>
        )}
        {isConnected && !isSpeaking && (
          <>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Listening...</span>
          </>
        )}
        {isConnected && isSpeaking && (
          <>
            <Volume2 className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">AI is speaking...</span>
          </>
        )}
        {isDisconnected && !isConnecting && (
          <span className="text-sm text-muted-foreground">Disconnected</span>
        )}
      </div>

      {/* Visual Indicator */}
      <div className="flex-shrink-0 flex items-center justify-center py-8">
        <div className={cn(
          "relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300",
          isConnected && isSpeaking && "bg-primary/20",
          isConnected && !isSpeaking && "bg-green-500/20",
          !isConnected && "bg-muted"
        )}>
          {/* Animated rings when speaking */}
          {isConnected && isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/20 animate-pulse" />
            </>
          )}
          
          {/* Listening indicator rings */}
          {isConnected && !isSpeaking && (
            <div className="absolute inset-0 rounded-full border-2 border-green-500/50 animate-pulse" />
          )}
          
          {/* Center icon */}
          <div className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center z-10",
            isConnected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
          )}>
            {isConnecting ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isConnected ? (
              <Mic className="h-8 w-8" />
            ) : (
              <MicOff className="h-8 w-8" />
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive text-center">{error}</p>
          {isDisconnected && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={startConversation}
            >
              Try Again
            </Button>
          )}
        </div>
      )}

      {/* Transcript Area */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-2">
          {messages.length === 0 && isConnected && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Start speaking in English or Hindi...
            </p>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Control Buttons */}
      <div className="flex-shrink-0 p-4 border-t bg-background">
        <div className="flex items-center justify-center gap-4">
          {isDisconnected && !isConnecting ? (
            <Button
              onClick={startConversation}
              size="lg"
              className="h-14 px-8 rounded-full"
            >
              <Phone className="h-5 w-5 mr-2" />
              Start Call
            </Button>
          ) : (
            <Button
              onClick={handleEndCall}
              variant="destructive"
              size="lg"
              className="h-14 px-8 rounded-full"
              disabled={isConnecting}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              End Call
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground text-center mt-3">
          Speak naturally in English or Hindi
        </p>
      </div>
    </div>
  );
});

VoiceConversationDialog.displayName = 'VoiceConversationDialog';
