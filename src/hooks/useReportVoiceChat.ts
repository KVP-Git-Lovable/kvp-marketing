import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ReportContext {
  dateRange: { from: string; to: string };
  allUsersSummary: {
    retailers: number;
    beats: number;
    products: number;
    totalKg: number;
  } | null;
  orderSummaryData: Array<{
    full_name: string;
    total_order_value: number;
  }>;
  skuData: Array<{
    product_name: string;
    quantity_sold: number;
    revenue: number;
    unit: string;
  }>;
  productivityData: Array<{
    full_name: string;
    productivity_percentage: number;
    productive_visits: number;
    total_visits: number;
  }>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const useReportVoiceChat = (reportContext: ReportContext) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Keep a ref to the latest reportContext to avoid stale closures
  const reportContextRef = useRef<ReportContext>(reportContext);
  
  // Update the ref whenever reportContext changes
  useEffect(() => {
    reportContextRef.current = reportContext;
  }, [reportContext]);

  // Ref for sendMessage to avoid stale closure in speech recognition
  const sendMessageRef = useRef<(text: string, playResponse?: boolean) => void>(() => {});

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsRecording(true);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow microphone access.');
        } else if (event.error !== 'aborted') {
          toast.error('Voice recognition error. Please try again.');
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTranscript(transcript);

        // If final result, send the message using the ref
        if (event.results[event.results.length - 1].isFinal) {
          const finalTranscript = transcript.trim();
          if (finalTranscript) {
            sendMessageRef.current(finalTranscript, true);
          }
          setTranscript('');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAllAudio();
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition is not supported in your browser.');
      return;
    }

    try {
      setTranscript('');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  const playAudio = useCallback(async (text: string, voiceId?: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Requesting TTS for text:', text.substring(0, 50) + '...', voiceId ? `with voice: ${voiceId}` : '');
        
        // Use streaming endpoint for faster response from ElevenLabs
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/elevenlabs-tts-stream`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ text, voiceId }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `TTS request failed: ${response.status}`);
        }

        // Collect the streamed response as a blob and play
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        currentAudioRef.current = audio;
        setIsPlaying(true);

        audio.onended = () => {
          setIsPlaying(false);
          currentAudioRef.current = null;
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          currentAudioRef.current = null;
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Audio playback failed'));
        };

        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
        reject(error);
      }
    });
  }, []);

  const stopAllAudio = useCallback(() => {
    console.log('stopAllAudio called, currentAudio:', !!currentAudioRef.current);
    if (currentAudioRef.current) {
      // Remove error handler before clearing src to prevent false error toasts
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    // Also clear any queued audio
    audioQueueRef.current.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    audioQueueRef.current = [];
    setIsPlaying(false);
  }, []);

  const sendMessage = useCallback(async (text: string, playResponse: boolean = false) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const currentContext = reportContextRef.current;
      
      console.log('Sending question to assistant:', text);
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/report-voice-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            question: text,
            reportContext: {
              dateRange: currentContext.dateRange,
              allUsersSummary: currentContext.allUsersSummary,
              orderSummaryData: currentContext.orderSummaryData,
              skuData: currentContext.skuData,
              productivityData: currentContext.productivityData,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Assistant request failed: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.answer || "I'm sorry, I couldn't process that question.";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);

      // Only play audio if the message was sent via voice (mic button)
      if (playResponse) {
        try {
          await playAudio(answer);
        } catch (audioError) {
          console.error('Failed to play audio response:', audioError);
          toast.error('Could not play audio response');
        }
      }
    } catch (error) {
      console.error('Failed to get assistant response:', error);
      setIsProcessing(false);
      toast.error('Failed to get response. Please try again.');
    }
  }, [playAudio]);

  // Keep the sendMessageRef updated with the latest sendMessage function
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const playSummary = useCallback(async (summaryText: string, voiceId?: string) => {
    try {
      await playAudio(summaryText, voiceId);
    } catch (error) {
      console.error('Failed to play summary:', error);
      toast.error('Failed to play summary audio');
    }
  }, [playAudio]);

  return {
    messages,
    isRecording,
    isProcessing,
    isPlaying,
    transcript,
    startRecording,
    stopRecording,
    sendMessage,
    playSummary,
    stopAllAudio,
  };
};
