import { useConversation } from '@elevenlabs/react';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useVoiceAssistant() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs voice agent');
      setError(null);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs voice agent');
    },
    onMessage: (message: any) => {
      console.log('Voice message:', message);
      
      // Handle user transcripts
      if (message?.type === 'user_transcript') {
        const userTranscript = message?.user_transcription_event?.user_transcript;
        if (userTranscript) {
          setMessages(prev => [...prev, {
            role: 'user',
            content: userTranscript,
            timestamp: new Date()
          }]);
        }
      }
      
      // Handle agent responses
      if (message?.type === 'agent_response') {
        const agentResponse = message?.agent_response_event?.agent_response;
        if (agentResponse) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: agentResponse,
            timestamp: new Date()
          }]);
        }
      }
    },
    onError: (error) => {
      console.error('Voice conversation error:', error);
      setError('Connection error. Please try again.');
      toast.error('Voice connection failed. Please try again.');
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setMessages([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');

      // Get signed URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        'elevenlabs-conversation-token'
      );

      if (fnError) {
        console.error('Token fetch error:', fnError);
        throw new Error('Failed to get voice connection token');
      }

      if (!data?.signed_url) {
        console.error('No signed URL received:', data);
        throw new Error('No connection URL received');
      }

      console.log('Starting voice session with signed URL');

      // Start the conversation with WebSocket
      await conversation.startSession({
        signedUrl: data.signed_url,
      });

    } catch (err) {
      console.error('Failed to start voice conversation:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.message.includes('Permission')) {
          setError('Microphone access is required for voice conversation');
          toast.error('Please allow microphone access to use voice chat');
        } else {
          setError(err.message);
          toast.error(err.message);
        }
      } else {
        setError('Failed to connect. Please try again.');
        toast.error('Failed to start voice conversation');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error('Error ending conversation:', err);
    }
  }, [conversation]);

  return {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    isConnecting,
    messages,
    error,
    startConversation,
    stopConversation,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
