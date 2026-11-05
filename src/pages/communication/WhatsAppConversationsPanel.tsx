import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquare, Search, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import WhatsAppRequestsPanel from "./WhatsAppRequestsPanel";

interface Retailer {
  id: string;
  name: string;
  phone: string | null;
}

interface RetailerInsights {
  messageCount: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

interface WhatsAppMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  status: string | null;
  created_at: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  twilio_content_sid: string | null;
}

export default function WhatsAppConversationsPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [templateId, setTemplateId] = useState<string>("none");

  const { data: retailers = [] } = useQuery({
    queryKey: ["whatsapp-conv-retailers", search],
    queryFn: async () => {
      let query = supabase.from("retailers").select("id, name, phone").not("phone", "is", null).limit(50);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Retailer[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("id, name, status, twilio_content_sid")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["whatsapp-messages", selectedRetailerId],
    enabled: !!selectedRetailerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, direction, body, status, created_at")
        .eq("retailer_id", selectedRetailerId!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    refetchInterval: 15000,
  });

  const selectedRetailer = useMemo(
    () => retailers.find((r) => r.id === selectedRetailerId) || null,
    [retailers, selectedRetailerId],
  );

  const { data: insights } = useQuery({
    queryKey: ["whatsapp-retailer-insights", selectedRetailerId],
    enabled: !!selectedRetailerId,
    queryFn: async (): Promise<RetailerInsights> => {
      const { count: messageCount } = await supabase
        .from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("retailer_id", selectedRetailerId!);
      const { data: orders } = await supabase
        .from("orders").select("total_amount, created_at").eq("retailer_id", selectedRetailerId!).order("created_at", { ascending: false });
      const totalSpent = (orders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      return {
        messageCount: messageCount || 0,
        orderCount: orders?.length || 0,
        totalSpent,
        lastOrderAt: orders?.[0]?.created_at || null,
      };
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRetailerId) throw new Error("Select a retailer first");
      const { data: { session } } = await supabase.auth.getSession();
      const payload: Record<string, unknown> = { retailer_id: selectedRetailerId };
      if (templateId !== "none") {
        payload.template_id = templateId;
      } else {
        if (!messageBody.trim()) throw new Error("Enter a message");
        payload.body = messageBody.trim();
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to send");
      return json;
    },
    onSuccess: () => {
      setMessageBody("");
      setTemplateId("none");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedRetailerId] });
      toast.success("Message sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">WhatsApp Conversations</h2>
        <p className="text-xs text-muted-foreground">Send messages to retailers and review recent WhatsApp activity.</p>
      </div>

      <Tabs defaultValue="conversations">
        <TabsList>
          <TabsTrigger value="conversations">All Conversations</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-3">
          <WhatsAppRequestsPanel onViewConversation={setSelectedRetailerId} />
        </TabsContent>
        <TabsContent value="conversations" className="mt-3">

      <div className="grid grid-cols-1 md:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_16rem] gap-4">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search retailers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[22rem]">
              <div className="space-y-1">
                {retailers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No retailers found</p>
                ) : (
                  retailers.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRetailerId(r.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${
                        selectedRetailerId === r.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.phone}</div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex flex-col h-[26rem]">
            {!selectedRetailer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Select a retailer to view conversation</p>
              </div>
            ) : (
              <>
                <div className="border-b pb-2 mb-2">
                  <p className="font-medium text-sm">{selectedRetailer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRetailer.phone}</p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-2">
                    {messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.body}</p>
                            <div className="flex items-center gap-1.5 mt-1 opacity-70 text-[10px]">
                              <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                              {m.status && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{m.status}</Badge>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="pt-2 border-t mt-2 space-y-2">
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Freeform message (within 24h session)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Freeform message</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} (template)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templateId === "none" && (
                    <div className="flex gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Type a message..."
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        className="resize-none"
                      />
                      <Button
                        size="icon"
                        className="h-auto shrink-0"
                        onClick={() => sendMutation.mutate()}
                        disabled={sendMutation.isPending || !messageBody.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {templateId !== "none" && (
                    <Button
                      className="w-full"
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Template
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hidden xl:block">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" /> Customer Insights
            </div>
            {!selectedRetailer ? (
              <p className="text-xs text-muted-foreground">Select a retailer to see insights</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Total Messages</p>
                  <p className="font-medium">{insights?.messageCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Orders</p>
                  <p className="font-medium">{insights?.orderCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Total Spent</p>
                  <p className="font-medium">₹{(insights?.totalSpent ?? 0).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Last Order</p>
                  <p className="font-medium">
                    {insights?.lastOrderAt ? format(new Date(insights.lastOrderAt), "MMM d, yyyy") : "—"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
