import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { journeyActionsFetch } from "@/lib/journeyActionsFetch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface DeletedJourney {
  id: string;
  name: string;
  status: string;
  deleted_at: string;
}

const RETENTION_DAYS = 30;

function expiryLabel(deletedAt: string): string {
  const daysLeft = RETENTION_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
  if (daysLeft <= 0) return "Expired, pending cleanup";
  return `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

export function DeletedJourneysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [permanentTargetId, setPermanentTargetId] = useState<string | null>(null);

  const invoke = async (payload: Record<string, unknown>) => {
    const response = await journeyActionsFetch({ method: "POST", body: payload });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const { data: deletedJourneys = [], isLoading } = useQuery({
    queryKey: ["journeys-deleted"],
    queryFn: () => invoke({ action: "list-deleted" }) as Promise<DeletedJourney[]>,
    enabled: open,
  });

  const restoreMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "restore", journey_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys-deleted"] });
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Journey restored");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "permanent-delete", journey_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys-deleted"] });
      toast.success("Journey permanently deleted");
      setPermanentTargetId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Deleted Journeys</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Deleted journeys are kept here for {RETENTION_DAYS} days before being permanently removed.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : deletedJourneys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Workflow className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No deleted journeys</p>
                  </TableCell>
                </TableRow>
              ) : (
                deletedJourneys.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.name}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{j.status}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(j.deleted_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{expiryLabel(j.deleted_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" title="Restore"
                          onClick={() => restoreMutation.mutate(j.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive" title="Delete Permanently"
                          onClick={() => setPermanentTargetId(j.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!permanentTargetId} onOpenChange={(open) => !open && setPermanentTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this journey permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone — the journey, its enrollments, and its message history will be gone for good.
              Requires admin access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentTargetId && permanentDeleteMutation.mutate(permanentTargetId)}
            >
              {permanentDeleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
