import { Bot } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetaAgentChat from './MetaAgentChat';
import MetaAgentManage from './MetaAgentManage';

export default function MetaAgentDialog({ open, onOpenChange, canCreate, canEdit }: { open: boolean; onOpenChange: (v: boolean) => void; canCreate: boolean; canEdit: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[92dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Agentic Meta Campaign</DialogTitle>
          <DialogDescription>Create campaigns by chatting, then review suggested changes. Everything is created paused and applied only on your approval.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create">
          <TabsList><TabsTrigger value="create">Create</TabsTrigger><TabsTrigger value="manage">Manage</TabsTrigger></TabsList>
          {/* forceMount keeps the conversation while the Manage tab is open */}
          <TabsContent value="create" forceMount className="data-[state=inactive]:hidden"><MetaAgentChat canCreate={canCreate} /></TabsContent>
          <TabsContent value="manage"><MetaAgentManage canEdit={canEdit} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
