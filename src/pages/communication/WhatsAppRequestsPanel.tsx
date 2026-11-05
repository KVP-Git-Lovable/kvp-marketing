import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface UnhandledQuery {
  id: string;
  phone: string;
  retailer_id: string | null;
  retailer_name: string | null;
  message: string;
  category: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cleared: "bg-muted text-muted-foreground",
};

export default function WhatsAppRequestsPanel({ onViewConversation }: { onViewConversation?: (retailerId: string) => void }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["whatsapp-unhandled-queries", statusFilter],
    queryFn: async () => {
      let query = supabase.from("unhandled_queries").select("*").order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as UnhandledQuery[];
    },
    refetchInterval: 20000,
  });

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return r.message?.toLowerCase().includes(q) || r.retailer_name?.toLowerCase().includes(q) || r.phone?.includes(q);
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("unhandled_queries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-unhandled-queries"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Requests the bot couldn't handle</h3>
          <p className="text-xs text-muted-foreground">Queries the WhatsApp assistant fell back on — follow up manually.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9 w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="cleared">Cleared</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Retailer</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nothing here</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{r.retailer_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    </TableCell>
                    <TableCell className="max-w-xs"><p className="text-sm truncate">{r.message}</p></TableCell>
                    <TableCell><Badge className={statusColors[r.status] || statusColors.open}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.retailer_id && onViewConversation && (
                          <Button variant="ghost" size="icon" title="View conversation" onClick={() => onViewConversation(r.retailer_id!)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {r.status !== "resolved" && (
                          <Button variant="ghost" size="icon" title="Mark resolved" onClick={() => updateMutation.mutate({ id: r.id, status: "resolved" })}>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {r.status !== "cleared" && (
                          <Button variant="ghost" size="icon" title="Clear" onClick={() => updateMutation.mutate({ id: r.id, status: "cleared" })}>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
