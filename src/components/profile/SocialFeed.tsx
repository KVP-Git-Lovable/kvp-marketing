import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/ui/signed-image";
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Bot, RefreshCw, Sparkles, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { RealtimeChannel } from "@supabase/supabase-js";

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  is_automated: boolean;
  template_id: string | null;
  template_name: string | null;
  post_metadata: any;
}

interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
}

export function SocialFeed() {
  const { user, userProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchFollowingList();
  }, []);

  useEffect(() => {
    if (!user || followingIds.length === 0) return;

    // Set up realtime subscription for new automated posts from following
    console.log('Setting up realtime subscription for automated posts...');
    
    channelRef.current = supabase
      .channel('automated-posts-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_posts',
          filter: 'is_automated=eq.true'
        },
        async (payload) => {
          console.log('New automated post detected:', payload);
          const newPost = payload.new as any;

          // Check if post is from someone we follow
          if (followingIds.includes(newPost.user_id) && newPost.user_id !== user.id) {
            // Fetch full post details including user profile
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, profile_picture_url')
              .eq('id', newPost.user_id)
              .single();

            let templateName = 'update';
            if (newPost.template_id) {
              const { data: templateData } = await supabase
                .from('push_content_templates')
                .select('*')
                .eq('id', newPost.template_id)
                .single();
              
              templateName = (templateData as any)?.name || (templateData as any)?.template_name || 'update';
            }

            if (profileData) {
              const userName = profileData.full_name || 'Someone';
              
              // Show notification
              toast(
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{userName} posted an update</p>
                    <p className="text-xs text-muted-foreground">Auto-generated: {templateName}</p>
                  </div>
                </div>,
                {
                  duration: 5000,
                  action: {
                    label: 'View',
                    onClick: () => {
                      fetchPosts(); // Refresh feed
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }
                }
              );

              // Auto-refresh the feed
              fetchPosts();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, followingIds]);

  const fetchFollowingList = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('employee_connections')
      .select('following_id')
      .eq('follower_id', user.id);

    if (!error && data) {
      setFollowingIds(data.map(conn => conn.following_id));
      console.log('Following list loaded:', data.length, 'users');
    }
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("social_posts")
      .select(`
        *,
        profiles!social_posts_user_id_fkey(full_name, profile_picture_url),
        social_likes(count),
        social_comments(count),
        push_content_templates(name)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formattedPosts: Post[] = await Promise.all(
        data.map(async (post: any) => {
          const { data: likeData } = await supabase
            .from("social_likes")
            .select("id")
            .eq("post_id", post.id)
            .eq("user_id", user?.id || "")
            .single();

          return {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            image_url: post.image_url,
            created_at: post.created_at,
            user_name: post.profiles?.full_name || "Unknown User",
            user_avatar: post.profiles?.profile_picture_url || null,
            likes_count: post.social_likes?.[0]?.count || 0,
            comments_count: post.social_comments?.[0]?.count || 0,
            has_liked: !!likeData,
            is_automated: post.is_automated || false,
            template_id: post.template_id || null,
            template_name: post.push_content_templates?.name || null,
            post_metadata: post.post_metadata || {},
          };
        })
      );
      setPosts(formattedPosts);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !selectedImage) return;

    setLoading(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from("social-posts")
          .upload(fileName, selectedImage);

        if (error) throw error;
        imageUrl = data.path;
      }

      const { error } = await supabase.from("social_posts").insert({
        user_id: user?.id,
        content: newPost,
        image_url: imageUrl,
      });

      if (error) throw error;

      toast.success("Post created successfully!");
      setNewPost("");
      setSelectedImage(null);
      setImagePreview(null);
      fetchPosts();
    } catch (error: any) {
      toast.error("Failed to create post: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.has_liked) {
        await supabase
          .from("social_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user?.id);
      } else {
        await supabase.from("social_likes").insert({
          post_id: postId,
          user_id: user?.id,
        });
      }
      fetchPosts();
    } catch (error) {
      toast.error("Failed to update like");
    }
  };

  const fetchComments = async (postId: string) => {
    const { data, error } = await supabase
      .from("social_comments")
      .select(`
        *,
        profiles!social_comments_user_id_fkey(full_name, profile_picture_url)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const formattedComments: Comment[] = data.map((comment: any) => ({
        id: comment.id,
        user_id: comment.user_id,
        post_id: comment.post_id,
        content: comment.content,
        created_at: comment.created_at,
        user_name: comment.profiles?.full_name || "Unknown User",
        user_avatar: comment.profiles?.profile_picture_url || null,
      }));
      setComments((prev) => ({ ...prev, [postId]: formattedComments }));
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(postId);
      fetchComments(postId);
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = newComment[postId]?.trim();
    if (!content) return;

    try {
      const { error } = await supabase.from("social_comments").insert({
        post_id: postId,
        user_id: user?.id,
        content,
      });

      if (error) throw error;

      setNewComment((prev) => ({ ...prev, [postId]: "" }));
      fetchComments(postId);
      fetchPosts(); // Refresh to update comment count
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };

  const handleRegeneratePost = async (postId: string) => {
    try {
      setLoading(true);
      
      // Call edge function to regenerate content
      const { data, error } = await supabase.functions.invoke('generate-scheduled-content', {
        body: { regenerate_post_id: postId }
      });

      if (error) throw error;

      toast.success("Post regenerated successfully!");
      fetchPosts();
    } catch (error: any) {
      console.error('Error regenerating post:', error);
      toast.error("Failed to regenerate post: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <SignedAvatarImage src={userProfile?.profile_picture_url || ""} />
              <AvatarFallback>
                {userProfile?.full_name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-[200px] rounded-lg"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <label htmlFor="post-image">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("post-image")?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Photo
                    </Button>
                    <input
                      id="post-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                </div>
                <Button
                  onClick={handleCreatePost}
                  disabled={loading || (!newPost.trim() && !selectedImage)}
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card 
            key={post.id}
            className={post.is_automated ? "border-primary/30 bg-primary/5" : ""}
          >
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.user_avatar || ""} />
                  <AvatarFallback>{post.user_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{post.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      {post.is_automated && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary">
                          <Sparkles className="h-3 w-3" />
                          <span className="text-xs font-medium">Auto-generated</span>
                          {post.template_name && (
                            <span className="text-xs opacity-75">• {post.template_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {post.is_automated && post.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegeneratePost(post.id)}
                        disabled={loading}
                        className="text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-sm mb-3 whitespace-pre-wrap">{post.content}</p>
                  
                  {post.image_url && (
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/social-posts/${post.image_url}`}
                      alt="Post"
                      className="rounded-lg max-h-[400px] w-full object-cover mb-3"
                    />
                  )}

                  <div className="flex items-center gap-4 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className={post.has_liked ? "text-red-500" : ""}
                    >
                      <Heart
                        className={`h-4 w-4 mr-2 ${
                          post.has_liked ? "fill-current" : ""
                        }`}
                      />
                      {post.likes_count}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.id)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {post.comments_count}
                    </Button>
                  </div>

                  {/* Comments Section */}
                  {expandedComments === post.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.user_avatar || ""} />
                            <AvatarFallback>{comment.user_name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg p-3">
                              <p className="font-semibold text-sm">
                                {comment.user_name}
                              </p>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-3">
                              {format(new Date(comment.created_at), "MMM d 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 mt-3">
                        <Avatar className="h-8 w-8">
                          <SignedAvatarImage src={userProfile?.profile_picture_url || ""} />
                          <AvatarFallback>
                            {userProfile?.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex gap-2">
                          <Textarea
                            placeholder="Write a comment..."
                            value={newComment[post.id] || ""}
                            onChange={(e) =>
                              setNewComment((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            className="min-h-[60px] resize-none"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAddComment(post.id)}
                            disabled={!newComment[post.id]?.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
