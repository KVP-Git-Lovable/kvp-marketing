import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WhatsAppTemplatesPanel from "./WhatsAppTemplatesPanel";
import WhatsAppConversationsPanel from "./WhatsAppConversationsPanel";
import WhatsAppConfigPanel from "./WhatsAppConfigPanel";

export default function WhatsAppTab() {
  return (
    <Tabs defaultValue="templates" className="space-y-4">
      <TabsList>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="config">Configuration</TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <WhatsAppTemplatesPanel />
      </TabsContent>
      <TabsContent value="conversations">
        <WhatsAppConversationsPanel />
      </TabsContent>
      <TabsContent value="config">
        <WhatsAppConfigPanel />
      </TabsContent>
    </Tabs>
  );
}
