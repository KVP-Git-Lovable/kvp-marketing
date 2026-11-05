import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Facebook, Instagram, ImageIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type PostType = "text" | "image" | "video";
type Destination = "facebook" | "instagram" | "both";

interface MetaPage { id: string; page_id: string; page_name: string | null; instagram_business_id: string | null; instagram_username: string | null }
interface MetaOrganicPost {
  id: string; message: string; status: string; media_url: string | null; scheduled_for: string | null; created_at: string;
  post_type: PostType; destination: Destination;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  publishing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-destructive/10 text-destructive",
};

export default function MetaOrganicPostsPanel() {
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>("text");
  const [destination, setDestination] = useState<Destination>("facebook");
  const [pageId, setPageId] = useState<string>("");
  const [instagramId, setInstagramId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMedia = async (file: File) => {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("meta-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("meta-media").getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      toast.success("Media uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: status } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => invoke("status") as Promise<{ connection_id: string | null }>,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["meta-pages", status?.connection_id],
    enabled: !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_pages").select("id, page_id, page_name, instagram_business_id, instagram_username").eq("connection_id", status!.connection_id).order("page_name");
      if (error) throw error;
      return data as MetaPage[];
    },
  });
  const selectedPage = pages.find((p) => p.id === pageId);
  const igAccounts = pages.filter((p) => p.instagram_business_id);
  const selectedIgAccount = igAccounts.find((p) => p.instagram_business_id === instagramId);

  const { data: posts = [] } = useQuery({
    queryKey: ["meta-organic-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_organic_posts").select("id, message, status, media_url, scheduled_for, created_at, post_type, destination").order("created_at", { ascending: false });
      if (error) throw error;
      return data as MetaOrganicPost[];
    },
  });

  const needsMedia = postType !== "text";
  const needsInstagram = destination !== "facebook";
  const canSchedule = destination === "facebook";
  const formValid = !!pageId && !!message.trim() && (!needsMedia || !!mediaUrl) && (!needsInstagram || !!instagramId);

  const saveMutation = useMutation({
    mutationFn: (publishNow: boolean) => invoke("create-organic-post", {
      page_id: pageId, message, media_url: mediaUrl || undefined,
      scheduled_for: canSchedule && scheduledFor ? scheduledFor : undefined,
      post_type: postType, destination, instagram_id: needsInstagram ? instagramId : undefined,
    }).then((post) => (publishNow ? invoke("publish-organic-post", { post_id: post.id }) : post)),
    onSuccess: (_, publishNow) => {
      queryClient.invalidateQueries({ queryKey: ["meta-organic-posts"] });
      setMessage(""); setMediaUrl(""); setScheduledFor("");
      toast.success(publishNow ? "Post published" : scheduledFor && canSchedule ? "Post scheduled" : "Draft saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: (post_id: string) => invoke("publish-organic-post", { post_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-organic-posts"] });
      toast.success("Post published");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Meta Organic Posts</h2>
        <p className="text-xs text-muted-foreground">Compose, schedule and publish posts to your Facebook Page and Instagram account.</p>
      </div>

      {pages.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pages synced yet — connect a Meta account and sync pages in the Meta Connection tab.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs mb-1.5 block">Post Type</Label>
                <Tabs value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                  <TabsList>
                    <TabsTrigger value="text">Text Post</TabsTrigger>
                    <TabsTrigger value="image">Image Post</TabsTrigger>
                    <TabsTrigger value="video">Video Post</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's new?" />
              </div>
              {needsMedia && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {postType === "video" ? "Video URL" : "Image URL"}</Label>
                  <div className="flex gap-2">
                    <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
                    <input
                      ref={fileInputRef} type="file" accept={postType === "video" ? "video/*" : "image/*"} className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])}
                    />
                    <Button
                      type="button" variant="outline" className="shrink-0"
                      onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Paste a URL or upload {postType === "video" ? "a video" : "an image"} from your computer.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Destination</Label>
                  <Select value={destination} onValueChange={(v) => { setDestination(v as Destination); if (v === "facebook") setInstagramId(""); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {canSchedule && (
                  <div>
                    <Label className="text-xs">Schedule (optional)</Label>
                    <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
                  </div>
                )}
              </div>
              {!canSchedule && (
                <p className="text-[11px] text-muted-foreground -mt-1">Instagram doesn't support scheduled publishing — it will publish immediately.</p>
              )}
              <div>
                <Label className="text-xs">Facebook Page</Label>
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select a page" /></SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.page_name || p.page_id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Used to publish — also required for Instagram-only posts.</p>
              </div>
              {needsInstagram && (
                <div>
                  <Label className="text-xs">Instagram Account</Label>
                  <Select value={instagramId} onValueChange={setInstagramId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={igAccounts.length === 0 ? "No Instagram accounts synced" : "Select an account"} /></SelectTrigger>
                    <SelectContent>
                      {igAccounts.map((p) => (
                        <SelectItem key={p.instagram_business_id!} value={p.instagram_business_id!}>@{p.instagram_username || p.instagram_business_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate(false)}
                  disabled={!formValid || saveMutation.isPending}
                >
                  {canSchedule && scheduledFor ? "Schedule" : "Save Draft"}
                </Button>
                <Button
                  onClick={() => saveMutation.mutate(true)}
                  disabled={!formValid || saveMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" /> Publish
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Label className="text-xs mb-2 block">Preview</Label>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2 max-w-sm">
                <div className="flex items-center gap-2 text-xs font-medium">
                  {destination === "instagram" ? (
                    <Instagram className="h-3.5 w-3.5" />
                  ) : (
                    <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                  )}
                  {destination === "instagram"
                    ? (selectedIgAccount ? `@${selectedIgAccount.instagram_username || selectedIgAccount.instagram_business_id}` : "Select an Instagram account")
                    : (selectedPage?.page_name || "Select a page")}
                </div>
                {mediaUrl && postType === "image" ? (
                  <img src={mediaUrl} alt="" className="rounded max-h-48 w-full object-cover" />
                ) : mediaUrl && postType === "video" ? (
                  <video src={mediaUrl} controls className="rounded max-h-48 w-full" />
                ) : mediaUrl ? (
                  <div className="flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" /><span className="truncate">{mediaUrl}</span>
                  </div>
                ) : null}
                <p className="text-sm whitespace-pre-wrap">{message || <span className="text-muted-foreground">Your message will appear here</span>}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">Post History</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No posts yet</TableCell></TableRow>
              ) : (
                posts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-xs truncate">{p.message}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.post_type || "text"}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm capitalize">{p.destination || "facebook"}</TableCell>
                    <TableCell><Badge className={statusColors[p.status] || statusColors.draft}>{p.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.scheduled_for ? format(new Date(p.scheduled_for), "MMM d, HH:mm") : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(p.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      {(p.status === "draft" || p.status === "failed") && (
                        <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(p.id)} disabled={publishMutation.isPending}>
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Publish
                        </Button>
                      )}
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
