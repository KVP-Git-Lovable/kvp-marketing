import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FolderPlus, Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { emptyReport } from "@/lib/reportBuilder/engine";
import type { SavedReport } from "@/lib/reportBuilder/types";
import { ReportList } from "./ReportList";
import { ReportBuilder } from "./ReportBuilder";
import { ReportViewer } from "./ReportViewer";

interface Folder {
  id: string;
  name: string;
  description?: string | null;
}

const normalise = (row: any): SavedReport => ({
  ...row,
  columns: row.columns || [],
  group_rows: row.group_rows || [],
  group_columns: row.group_columns || [],
  filters: row.filters || [],
  display_options: row.display_options || {},
});

interface PanelProps {
  /** Analytics page date range (From / To) applied to every report shown here. */
  dateRange?: { from: Date; to: Date };
}

export const ReportConfiguratorPanel = ({ dateRange }: PanelProps = {}) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [mode, setMode] = useState<"list" | "edit" | "view">("list");
  const [active, setActive] = useState<SavedReport | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState<SavedReport | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [reportsRes, foldersRes] = await Promise.all([
      supabase.from("rb_saved_reports" as any).select("*").order("updated_at", { ascending: false }),
      supabase.from("rb_report_folders" as any).select("id,name,description").order("name"),
    ]);
    if (reportsRes.error) toast({ title: "Could not load reports", description: reportsRes.error.message, variant: "destructive" });
    setReports(((reportsRes.data as any[]) || []).map(normalise));
    setFolders(((foldersRes.data as any[]) || []) as Folder[]);
    setLoading(false);
  }, []);

  const fetchPins = useCallback(async () => {
    if (!user?.id) return setPinnedIds(new Set());
    const { data } = await supabase
      .from("rb_report_pins" as any)
      .select("report_id")
      .eq("user_id", user.id);
    setPinnedIds(new Set(((data as any[]) || []).map((d) => String(d.report_id))));
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("rb_can_manage_reports" as any);
      if (!cancelled) setCanEdit(data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visible = useMemo(() => {
    if (activeFolder === "all") return reports;
    if (activeFolder === "unfiled") return reports.filter((r) => !r.folder_id);
    return reports.filter((r) => r.folder_id === activeFolder);
  }, [reports, activeFolder]);

  const saveReport = async (draft: SavedReport) => {
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description || null,
      folder_id: draft.folder_id || null,
      primary_object: draft.primary_object,
      related_object: draft.related_object || null,
      columns: draft.columns,
      group_rows: draft.group_rows,
      group_columns: draft.group_columns,
      filters: draft.filters,
      chart_type: draft.chart_type,
      display_options: draft.display_options || {},
    };
    const res = draft.id
      ? await supabase.from("rb_saved_reports" as any).update(payload).eq("id", draft.id)
      : await supabase.from("rb_saved_reports" as any).insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (res.error) {
      toast({ title: "Could not save report", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: draft.id ? "Report updated" : "Report created" });
    setMode("list");
    setActive(null);
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    const { error } = await supabase.from("rb_saved_reports" as any).delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast({ title: "Could not delete report", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Report deleted" });
    fetchAll();
  };

  const togglePin = async (report: SavedReport) => {
    if (!user?.id || !report.id) return;
    if (pinnedIds.has(report.id)) {
      await supabase
        .from("rb_report_pins" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("report_id", report.id);
    } else {
      await supabase.from("rb_report_pins" as any).insert({ user_id: user.id, report_id: report.id });
    }
    fetchPins();
  };

  const createFolder = async () => {
    if (!newFolder.name.trim()) return;
    const { error } = await supabase.from("rb_report_folders" as any).insert({
      name: newFolder.name.trim(),
      description: newFolder.description || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Could not create folder", description: error.message, variant: "destructive" });
      return;
    }
    setNewFolder({ name: "", description: "" });
    setFolderOpen(false);
    fetchAll();
  };

  if (mode === "view" && active) {
    return (
      <ReportViewer
        report={active}
        dateRange={dateRange}
        canEdit={canEdit}
        pinned={active.id ? pinnedIds.has(active.id) : false}
        onTogglePin={active.id ? () => togglePin(active) : undefined}
        onBack={() => {
          setMode("list");
          setActive(null);
        }}
        onEdit={() => setMode("edit")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <ReportBuilder
        initial={active ?? emptyReport()}
        folders={folders}
        saving={saving}
        onCancel={() => {
          setMode("list");
          setActive(null);
        }}
        onSave={saveReport}
      />
    );
  }

  const counts = {
    all: reports.length,
    unfiled: reports.filter((r) => !r.folder_id).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Report Configurator</h2>
          <p className="text-sm text-muted-foreground">Build, save and manage custom reports</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFolderOpen(true)}>
              <FolderPlus className="mr-1 h-4 w-4" /> New Folder
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setActive(emptyReport());
                setMode("edit");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> New Report
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: `All (${counts.all})` },
          ...folders.map((f) => ({
            key: f.id,
            label: `${f.name} (${reports.filter((r) => r.folder_id === f.id).length})`,
          })),
          { key: "unfiled", label: `Unfiled (${counts.unfiled})` },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setActiveFolder(chip.key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              activeFolder === chip.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-xl border">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ReportList
          reports={visible}
          folders={folders}
          pinnedIds={pinnedIds}
          canEdit={canEdit}
          onView={(r) => {
            setActive(r);
            setMode("view");
          }}
          onEdit={(r) => {
            setActive(r);
            setMode("edit");
          }}
          onDelete={(r) => setDeleteTarget(r)}
          onTogglePin={togglePin}
        />
      )}

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newFolder.name}
                onChange={(e) => setNewFolder((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sales Reports"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={newFolder.description}
                onChange={(e) => setNewFolder((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolder.name.trim()}>
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The report definition is removed. No sales, visit or retailer data is affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
