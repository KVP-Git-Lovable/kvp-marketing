import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, Edit, Trash2, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PostMenuProps {
  postId: string;
  postContent: string;
  isOwner: boolean;
  currentUserId: string;
  onPostUpdated: () => void;
}

export function PostMenu({ postId, postContent, isOwner, currentUserId, onPostUpdated }: PostMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(postContent);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete attachments first
      await supabase
        .from("social_post_attachments")
        .delete()
        .eq("post_id", postId);

      // Delete reactions
      await supabase
        .from("social_reactions")
        .delete()
        .eq("post_id", postId);

      // Delete likes
      await supabase
        .from("social_likes")
        .delete()
        .eq("post_id", postId);

      // Delete comments
      await supabase
        .from("social_comments")
        .delete()
        .eq("post_id", postId);

      // Delete the post
      const { error } = await supabase
        .from("social_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;

      toast.success("Post deleted");
      onPostUpdated();
    } catch (error: any) {
      toast.error("Failed to delete post: " + error.message);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("social_posts")
        .update({ content: editContent.trim() })
        .eq("id", postId);

      if (error) throw error;

      toast.success("Post updated");
      onPostUpdated();
      setEditDialogOpen(false);
    } catch (error: any) {
      toast.error("Failed to update post: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      // Create a repost (share) - new post referencing original
      const { error } = await supabase
        .from("social_posts")
        .insert({
          user_id: currentUserId,
          content: `📢 Shared: ${postContent}`,
          shared_from_post_id: postId,
        });

      if (error) throw error;

      toast.success("Post shared to your feed!");
      onPostUpdated();
    } catch (error: any) {
      toast.error("Failed to share post: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isOwner ? (
            <>
              <DropdownMenuItem onClick={() => {
                setEditContent(postContent);
                setEditDialogOpen(true);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Post
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Post
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={handleShare} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Share to My Feed
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post
              and all associated comments, likes, and reactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[120px]"
            placeholder="What's on your mind?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={loading || !editContent.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
