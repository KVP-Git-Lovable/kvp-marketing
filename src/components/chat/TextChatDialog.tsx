 import { memo, useEffect, useRef, useState } from 'react';
 import { Send, Loader2, AlertCircle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useTextAssistant } from '@/hooks/useTextAssistant';
 import ReactMarkdown from 'react-markdown';
 
 interface TextChatDialogProps {
   onClose: () => void;
 }
 
 export const TextChatDialog = memo(({ onClose }: TextChatDialogProps) => {
   const [inputValue, setInputValue] = useState('');
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   
   const {
     status,
     isConnecting,
    isProcessing,
     messages,
     error,
     connect,
     sendMessage,
     disconnect,
   } = useTextAssistant();
 
   // Auto-connect when component mounts
   useEffect(() => {
     connect();
     return () => {
       disconnect();
     };
   }, []);
 
   // Scroll to bottom when messages change
   useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);
 
   // Focus input when connected
   useEffect(() => {
     if (status === 'connected') {
       inputRef.current?.focus();
     }
   }, [status]);
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!inputValue.trim() || status !== 'connected') return;
     
     sendMessage(inputValue);
     setInputValue('');
   };
 
  const isLoading = isConnecting || status === 'connecting' || status === 'disconnecting';
  const canSendMessage = status === 'connected' && !isProcessing;
 
   return (
     <div className="flex flex-col h-full">
       {/* Messages Area */}
       <ScrollArea className="flex-1 p-4">
         {/* Connection Status */}
         {isLoading && (
           <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
             <Loader2 className="h-5 w-5 animate-spin" />
             <span>Connecting to assistant...</span>
           </div>
         )}
 
         {error && (
           <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg mb-4">
             <AlertCircle className="h-5 w-5 flex-shrink-0" />
             <div>
               <p className="font-medium">Connection Error</p>
               <p className="text-sm">{error}</p>
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={connect}
                 className="mt-2"
               >
                 Retry Connection
               </Button>
             </div>
           </div>
         )}
 
         {/* Welcome Message */}
         {status === 'connected' && messages.length === 0 && (
           <div className="text-center text-muted-foreground py-8">
             <p className="text-lg font-medium mb-2">Welcome! 👋</p>
             <p className="text-sm">Type your question below to start chatting with the AI Assistant.</p>
           </div>
         )}
 
         {/* Messages */}
          <div className="space-y-4 pb-2">
           {messages.map((message, index) => (
             <div
               key={index}
               className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
             >
               <div
                 className={`max-w-[85%] rounded-lg px-4 py-2 ${
                   message.role === 'user'
                     ? 'bg-primary text-primary-foreground'
                     : 'bg-muted'
                 }`}
               >
                 {message.role === 'assistant' ? (
                   <div className="prose prose-sm dark:prose-invert max-w-none">
                     <ReactMarkdown>{message.content}</ReactMarkdown>
                   </div>
                 ) : (
                   <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                 )}
               </div>
             </div>
           ))}
            {/* Show typing indicator when processing */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
           <div ref={messagesEndRef} />
         </div>
       </ScrollArea>
 
       {/* Input Area */}
       <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
         <div className="flex gap-2">
           <Input
             ref={inputRef}
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                status !== 'connected' 
                  ? "Connecting..." 
                  : isProcessing 
                    ? "Waiting for response..." 
                    : "Type your message..."
              }
              disabled={!canSendMessage}
             className="flex-1"
           />
           <Button 
             type="submit" 
             size="icon"
              disabled={!inputValue.trim() || !canSendMessage}
           >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
           </Button>
         </div>
       </form>
     </div>
   );
 });
 
 TextChatDialog.displayName = 'TextChatDialog';