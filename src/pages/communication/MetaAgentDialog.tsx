import { Bot } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MetaAgentChat from './MetaAgentChat';

export default function MetaAgentDialog({ open, onOpenChange, canCreate }: { open: boolean; onOpenChange: (v: boolean) => void; canCreate: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[92dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Agentic Meta Campaign</DialogTitle>
          <DialogDescription>Plan and create campaigns by chatting. Everything is created paused.</DialogDescription>
        </DialogHeader>
        <MetaAgentChat canCreate={canCreate} />
      </DialogContent>
    </Dialog>
  );
}
