import { useState, memo, useCallback } from 'react';
import { MessageCircle, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextChatDialog } from './TextChatDialog';
import { InteractionModeSelector } from './InteractionModeSelector';
import { VoiceConversationDialog } from './VoiceConversationDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type InteractionMode = 'selecting' | 'text' | 'voice';

export const ChatWidget = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('selecting');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const handleOpen = useCallback(() => {
    setMode('selecting');
    setIsOpen(true);
  }, []);
  
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setMode('selecting');
  }, []);

  const handleSelectText = useCallback(() => setMode('text'), []);
  const handleSelectVoice = useCallback(() => setMode('voice'), []);
  const handleBack = useCallback(() => setMode('selecting'), []);

  if (!user) return null;

  const getTitle = () => {
    switch (mode) {
      case 'text': return 'Text Chat';
      case 'voice': return 'Voice Assistant';
      default: return 'AI Assistant';
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'text':
        return <TextChatDialog onClose={handleClose} />;
      case 'voice':
        return <VoiceConversationDialog onClose={handleClose} />;
      default:
        return (
          <InteractionModeSelector 
            onSelectText={handleSelectText} 
            onSelectVoice={handleSelectVoice} 
          />
        );
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Button
          onClick={handleOpen}
          className="fixed right-4 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black/40 z-50 animate-in fade-in-0 duration-200"
              onClick={handleClose}
            />
          )}
          
          <div
            className={cn(
              "fixed z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in-0 duration-300",
              isMobile
                ? "inset-x-3 bottom-3 top-auto"
                : "right-4 bottom-4 w-[380px]"
            )}
            style={isMobile 
              ? { 
                  maxHeight: 'calc(80vh - env(safe-area-inset-bottom, 0px))',
                  marginBottom: 'env(safe-area-inset-bottom, 0px)'
                }
              : { height: '520px', maxHeight: 'calc(100vh - 2rem)' }
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-primary text-primary-foreground rounded-t-2xl shrink-0">
              <div className="flex items-center gap-2">
                {mode !== 'selecting' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <MessageCircle className="h-4 w-4" />
                <span className="font-semibold text-sm">{getTitle()}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderContent()}
            </div>
          </div>
        </>
      )}
    </>
  );
});

ChatWidget.displayName = 'ChatWidget';
