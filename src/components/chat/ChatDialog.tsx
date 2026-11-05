import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Zap, Sparkles, AlertTriangle, TrendingUp, Users, Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from './ChatMessage';
import { useChatCache } from '@/hooks/useChatCache';
import { cn } from '@/lib/utils';
import { useProactiveInsights } from '@/hooks/useProactiveInsights';
import { ProactiveInsightCard } from './ProactiveInsightCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  isCached?: boolean;
  type?: 'text' | 'insight' | 'alert';
}

interface ChatDialogProps {
  onClose: () => void;
}

type LoadingState = 'idle' | 'connecting' | 'analyzing' | 'fetching' | 'generating';

const LOADING_MESSAGES: Record<LoadingState, string> = {
  idle: '',
  connecting: 'Connecting...',
  analyzing: 'Understanding your request...',
  fetching: 'Fetching your data...',
  generating: 'Crafting response...'
};

const TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;
const RETRY_DELAY_BASE = 1000;

// Manager quick actions
const MANAGER_QUICK_ACTIONS = [
  { label: '👥 Team Status', query: 'How is my team doing today?', icon: Users },
  { label: '⚠️ Alerts', query: 'Show me any exception alerts', icon: AlertTriangle },
  { label: '📊 Performance', query: 'Team performance this month', icon: TrendingUp },
  { label: '🗓️ Attendance', query: 'Who has checked in today?', icon: Calendar },
];

// Field user quick actions
const FIELD_QUICK_ACTIONS = [
  { label: '📍 My Visits', query: 'What are my visits today?', icon: Calendar },
  { label: '💰 Sales', query: 'Show me my sales summary', icon: TrendingUp },
  { label: '⭐ Top Retailers', query: 'Who are my top retailers?', icon: Users },
  { label: '📦 Stock', query: 'Check stock levels', icon: AlertTriangle },
];

export const ChatDialog = ({ onClose }: ChatDialogProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [userName, setUserName] = useState<string>('');
  const [isManager, setIsManager] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { getCachedResponse, cacheResponse } = useChatCache();
  const { insights, dismissInsight, isLoading: insightsLoading } = useProactiveInsights();

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const firstName = profile?.full_name?.split(' ')[0] || 'there';
        setUserName(firstName);
        
        const managerRoles = ['admin', 'manager', 'asm', 'rsm', 'zsm', 'nsm'];
        setIsManager(roles?.some(r => managerRoles.includes(r.role?.toLowerCase())) || false);
        
        // Set personalized greeting
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';
        
        const roleLabel = roles?.some(r => managerRoles.includes(r.role?.toLowerCase())) 
          ? 'Manager' 
          : 'field sales';
        
        setMessages([{
          role: 'assistant',
          content: `${greeting}, ${firstName}! 👋\n\nI'm your AI assistant, ready to help with your ${roleLabel} activities.\n\n**What can I help you with?**\n- 📊 Check performance & analytics\n- 📍 View visits & schedules\n- 💰 Track sales & collections\n- ⚠️ Get alerts on issues\n\nJust ask me anything or tap a quick action below!`
        }]);
      }
    };
    
    fetchUserInfo();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Create conversation on first message
  const ensureConversation = async () => {
    if (conversationId) return conversationId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation'
      })
      .select()
      .single();

    if (error) throw error;
    setConversationId(data.id);
    return data.id;
  };

  // Save message to database
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    try {
      const convId = await ensureConversation();
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: convId,
          role,
          content,
          metadata: {}
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithTimeout = async (
    url: string, 
    options: RequestInit, 
    timeout: number
  ): Promise<Response> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
  };

  // Get current page context for the AI
  const getPageContext = useCallback(() => {
    const path = window.location.pathname;
    const pageMap: Record<string, string> = {
      '/': 'Home Dashboard',
      '/visits': 'My Visits',
      '/retailers': 'My Retailers',
      '/beats': 'Beat Planning',
      '/analytics': 'Analytics',
      '/order-entry': 'Order Entry',
      '/attendance': 'Attendance',
      '/schemes': 'Schemes',
      '/distributors': 'Distributors',
      '/team': 'Team Management',
    };
    return pageMap[path] || path;
  }, []);

  const sendMessageWithRetry = useCallback(async (
    userInput: string,
    recentMessages: Message[],
    session: any,
    attempt: number = 0
  ): Promise<string> => {
    try {
      setLoadingState(attempt > 0 ? 'connecting' : 'analyzing');
      
      const response = await fetchWithTimeout(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: recentMessages.map(m => ({
              role: m.role,
              content: m.content
            })),
            conversationId,
            pageContext: getPageContext()
          }),
        },
        TIMEOUT_MS
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI service credits exhausted. Please contact your administrator.');
        }
        throw new Error('Failed to get response from AI');
      }

      if (!response.body) throw new Error('No response body');

      setLoadingState('fetching');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            
            if (content) {
              if (!assistantContent) {
                setLoadingState('generating');
              }
              assistantContent += content;
              // Update the last message (assistant's response)
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantContent
                };
                return newMessages;
              });
            }
          } catch (e) {
            console.error('Error parsing SSE:', e);
          }
        }
      }

      return assistantContent;

    } catch (error) {
      // Retry logic with exponential backoff
      if (attempt < MAX_RETRIES && error instanceof Error && 
          (error.message.includes('timed out') || error.message.includes('Failed to get response'))) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        setRetryCount(attempt + 1);
        await sleep(delay);
        return sendMessageWithRetry(userInput, recentMessages, session, attempt + 1);
      }
      throw error;
    }
  }, [conversationId, getPageContext]);

  const sendMessage = async (customInput?: string) => {
    const messageText = customInput || input;
    if (!messageText.trim() || isLoading) return;

    // Hide insight cards after first message
    setShowInsights(false);

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingState('connecting');
    setRetryCount(0);

    // Save user message
    await saveMessage('user', messageText);

    // Check cache first for common queries
    const cachedResponse = getCachedResponse(messageText);
    if (cachedResponse) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: cachedResponse,
        isCached: true 
      }]);
      setIsLoading(false);
      setLoadingState('idle');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Create placeholder for streaming response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      // Limit message history to last 10 messages before sending
      const recentMessages = [...messages, userMessage].slice(-10);

      const assistantContent = await sendMessageWithRetry(messageText, recentMessages, session);

      // Save assistant message and cache response
      if (assistantContent) {
        await saveMessage('assistant', assistantContent);
        cacheResponse(messageText, assistantContent);
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
      // Remove the placeholder message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setLoadingState('idle');
      setRetryCount(0);
    }
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      sendMessage(lastUserMessage.content);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    sendMessage(query);
  };

  const quickActions = isManager ? MANAGER_QUICK_ACTIONS : FIELD_QUICK_ACTIONS;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isManager ? (
                <>
                  <Users className="h-3 w-3" />
                  Manager Mode
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3" />
                  Field Sales
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-3 py-4 sm:px-4" ref={scrollRef}>
        <div className="space-y-4 max-w-full">
          {messages.map((message, index) => (
            <div key={index} className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ChatMessage message={message} />
              {message.isCached && (
                <span className="absolute -top-1 right-2 flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <Zap className="h-3 w-3" />
                  Instant
                </span>
              )}
            </div>
          ))}

          {/* Proactive Insights Section */}
          {showInsights && insights.length > 0 && messages.length <= 1 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Today's Insights</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {insights.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInsights(false)}
                  className="h-6 text-xs text-muted-foreground"
                >
                  Hide
                  <ChevronUp className="h-3 w-3 ml-1" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {insights.slice(0, 3).map((insight) => (
                  <ProactiveInsightCard
                    key={insight.id}
                    insight={insight}
                    onDismiss={dismissInsight}
                  />
                ))}
              </div>
              
              {insights.length > 3 && (
                <p className="text-xs text-center text-muted-foreground">
                  +{insights.length - 3} more insights available
                </p>
              )}
            </div>
          )}

          {/* Collapsed insights toggle */}
          {!showInsights && insights.length > 0 && messages.length <= 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInsights(true)}
              className="w-full text-xs gap-2"
            >
              <Sparkles className="h-3 w-3" />
              Show {insights.length} insights
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex items-center gap-3 pl-11 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 bg-muted/80 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {LOADING_MESSAGES[loadingState]}
                  {retryCount > 0 && ` (Retry ${retryCount}/${MAX_RETRIES})`}
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-3 sm:p-4 bg-gradient-to-t from-muted/30 to-background shrink-0 space-y-3">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.query)}
              disabled={isLoading}
              className="text-xs h-7 gap-1.5 bg-background/80 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <action.icon className="h-3 w-3" />
              {action.label.replace(/^[^\s]+\s/, '')}
            </Button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isManager ? "Ask about team, alerts, or performance..." : "Ask about visits, sales, or retailers..."}
              className="min-h-[48px] max-h-[120px] resize-none text-sm bg-background border-muted focus:border-primary/50 rounded-xl pr-12"
              disabled={isLoading}
              rows={1}
            />
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {/* Powered by hint */}
        <p className="text-center text-[10px] text-muted-foreground/60">
          Powered by AI • Responses may vary
        </p>
      </div>
    </div>
  );
};
