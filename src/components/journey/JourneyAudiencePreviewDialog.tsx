import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listViewId: string;
  listViewName?: string;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  first_name: string | null;
  last_name: string | null;
  business_details: string | null;
}

const PREVIEW_LIMIT = 100;

export function JourneyAudiencePreviewDialog({ open, onOpenChange, listViewId, listViewName }: Props) {
  const previewQuery = useQuery({
    queryKey: ["journey-audience-full-preview", listViewId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-list-view-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ list_view_id: listViewId, mode: "preview", limit: PREVIEW_LIMIT }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load audience preview");
      return json as { rows: ContactRow[]; count: number };
    },
    enabled: open && !!listViewId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Audience{listViewName ? ` — ${listViewName}` : ""}</DialogTitle>
        </DialogHeader>
        {previewQuery.isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Business Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previewQuery.data?.rows || []).length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No matching contacts.</TableCell></TableRow>
                ) : (
                  previewQuery.data!.rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{c.phone || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{c.email || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{c.address || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.city || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.pincode || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.state || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.country || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{c.website || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.first_name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.last_name || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{c.business_details || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {previewQuery.data && (
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(previewQuery.data.rows.length, PREVIEW_LIMIT)} of {previewQuery.data.count.toLocaleString()} matching contacts
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
