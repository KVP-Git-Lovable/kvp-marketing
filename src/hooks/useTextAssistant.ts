 import { useConversation } from '@elevenlabs/react';
import { useState, useCallback, useRef, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 
 export interface TextMessage {
   role: 'user' | 'assistant';
   content: string;
   timestamp: Date;
 }
 
 export function useTextAssistant() {
   const [isConnecting, setIsConnecting] = useState(false);
   const [messages, setMessages] = useState<TextMessage[]>([]);
   const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastResponseTime = useRef<number>(0);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 
   const conversation = useConversation({
     textOnly: true,
     onConnect: () => {
       console.log('Connected to ElevenLabs text agent');
       setError(null);
      setIsProcessing(false);
     },
     onDisconnect: () => {
       console.log('Disconnected from ElevenLabs text agent');
      setIsProcessing(false);
     },
     onMessage: (message: any) => {
       console.log('Text message:', message);
      console.log('Message type:', message?.type, 'Source:', message?.source);
       
       // Handle agent responses - ElevenLabs sends messages in different formats
       // Format 1: { source: 'ai', role: 'agent', message: '...' }
       // Format 2: { type: 'agent_response', agent_response_event: { agent_response: '...' } }
       
       let agentResponse: string | null = null;
       
       // Check for direct message format (source: 'ai')
       if (message?.source === 'ai' && message?.role === 'agent' && message?.message) {
         agentResponse = message.message;
       }
       // Check for agent_response event format
       else if (message?.type === 'agent_response') {
         agentResponse = message?.agent_response_event?.agent_response;
       }
       // Check for transcript format
       else if (message?.type === 'agent_response_correction') {
         agentResponse = message?.agent_response_correction_event?.corrected_agent_response;
       }
      // Check for plain text response format
      else if (message?.text && typeof message.text === 'string') {
        agentResponse = message.text;
      }
      // Check for content field
      else if (message?.content && typeof message.content === 'string') {
        agentResponse = message.content;
      }
       
       if (agentResponse) {
         setMessages(prev => [...prev, {
           role: 'assistant',
          content: agentResponse!,
           timestamp: new Date()
         }]);
        setIsProcessing(false);
        lastResponseTime.current = Date.now();
        // Clear any pending timeout
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
       }
      
      // Also reset on certain completion events
      if (message?.type === 'response.done' || 
          message?.type === 'conversation.item.completed' ||
          message?.type === 'audio.done') {
        console.log('Received completion event, resetting processing state');
        setIsProcessing(false);
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
      }
     },
     onError: (error) => {
       console.error('Text conversation error:', error);
       setError('Connection error. Please try again.');
      setIsProcessing(false);
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
       toast.error('Text chat connection failed. Please try again.');
     },
   });

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);
 
   const connect = useCallback(async () => {
     setIsConnecting(true);
     setError(null);
     setMessages([]);
 
     try {
       // Get signed URL from edge function with text agent type
       const { data, error: fnError } = await supabase.functions.invoke(
         'elevenlabs-conversation-token',
         { body: { agentType: 'text' } }
       );
 
       if (fnError) {
         console.error('Token fetch error:', fnError);
         throw new Error('Failed to get connection token');
       }
 
       if (!data?.signed_url) {
         console.error('No signed URL received:', data);
         throw new Error('No connection URL received');
       }
 
       console.log('Starting text session with signed URL');
 
       // Start the conversation with WebSocket
       await conversation.startSession({
         signedUrl: data.signed_url,
       });
 
     } catch (err) {
       console.error('Failed to start text conversation:', err);
       
       if (err instanceof Error) {
         setError(err.message);
         toast.error(err.message);
       } else {
         setError('Failed to connect. Please try again.');
         toast.error('Failed to start text conversation');
       }
     } finally {
       setIsConnecting(false);
     }
   }, [conversation]);
 
   const sendMessage = useCallback((text: string) => {
     if (!text.trim()) return;
     
    setIsProcessing(true);
    
     // Add user message to the list
     setMessages(prev => [...prev, {
       role: 'user',
       content: text.trim(),
       timestamp: new Date()
     }]);
     
     // Send to the agent
     conversation.sendUserMessage(text.trim());
    
    // Clear any existing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    // Safety timeout - if no response in 15 seconds, reset processing state
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(prev => {
        if (prev) {
          console.log('Response timeout - resetting processing state');
          return false;
        }
        return prev;
      });
      processingTimeoutRef.current = null;
    }, 15000);
   }, [conversation]);
 
   const disconnect = useCallback(async () => {
     try {
       await conversation.endSession();
     } catch (err) {
       console.error('Error ending conversation:', err);
     }
   }, [conversation]);
 
   return {
     status: conversation.status,
     isConnecting,
    isProcessing,
     messages,
     error,
     connect,
     sendMessage,
     disconnect,
   };
 }