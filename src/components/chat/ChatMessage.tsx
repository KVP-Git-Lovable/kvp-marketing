import { User, Bot, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useMemo } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionButton[];
}

interface ActionButton {
  label: string;
  type: 'navigate' | 'action' | 'link';
  value: string;
  icon?: string;
}

interface ChatMessageProps {
  message: Message;
  onAction?: (action: ActionButton) => void;
}

// Parse action buttons from message content
function parseActions(content: string): { cleanContent: string; actions: ActionButton[] } {
  const actions: ActionButton[] = [];
  let cleanContent = content;

  // Parse navigation hints like [Navigate to Retailers](/retailers)
  const navRegex = /\[Navigate to ([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = navRegex.exec(content)) !== null) {
    actions.push({
      label: match[1],
      type: 'navigate',
      value: match[2],
      icon: '→'
    });
  }
  cleanContent = cleanContent.replace(navRegex, '');

  // Parse action hints like {{action:View Details:/retailers/123}}
  const actionRegex = /\{\{action:([^:]+):([^}]+)\}\}/g;
  while ((match = actionRegex.exec(content)) !== null) {
    actions.push({
      label: match[1],
      type: 'navigate',
      value: match[2]
    });
  }
  cleanContent = cleanContent.replace(actionRegex, '');

  return { cleanContent: cleanContent.trim(), actions };
}

export const ChatMessage = ({ message, onAction }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const navigate = useNavigate();

  const { cleanContent, actions } = useMemo(() => {
    if (isUser) return { cleanContent: message.content, actions: [] };
    return parseActions(message.content);
  }, [message.content, isUser]);

  const allActions = [...actions, ...(message.actions || [])];

  const handleActionClick = (action: ActionButton) => {
    if (action.type === 'navigate') {
      navigate(action.value);
    } else if (action.type === 'link') {
      window.open(action.value, '_blank');
    } else if (onAction) {
      onAction(action);
    }
  };

  // Custom markdown components for better rendering
  const markdownComponents = {
    p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="text-sm">{children}</li>,
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    code: ({ children, className }: any) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs my-2">
            <code>{children}</code>
          </pre>
        );
      }
      return <code className="bg-background/50 px-1 rounded text-xs">{children}</code>;
    },
    pre: ({ children }: any) => <>{children}</>,
    h1: ({ children }: any) => <h3 className="font-bold text-base mb-2">{children}</h3>,
    h2: ({ children }: any) => <h4 className="font-semibold text-sm mb-1">{children}</h4>,
    h3: ({ children }: any) => <h5 className="font-medium text-sm mb-1">{children}</h5>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
        {children}
        <ExternalLink className="h-3 w-3" />
      </a>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-xs border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th className="border-b border-border px-2 py-1 text-left font-medium">{children}</th>,
    td: ({ children }: any) => <td className="border-b border-border/50 px-2 py-1">{children}</td>,
  };

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-sm'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={cn('flex flex-col gap-2 max-w-[85%]')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          {isUser ? (
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content || '...'}
            </div>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              {cleanContent ? (
                <ReactMarkdown components={markdownComponents}>
                  {cleanContent}
                </ReactMarkdown>
              ) : (
                <span className="animate-pulse">...</span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {allActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {allActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 bg-background hover:bg-primary/10"
                onClick={() => handleActionClick(action)}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
                <ChevronRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
