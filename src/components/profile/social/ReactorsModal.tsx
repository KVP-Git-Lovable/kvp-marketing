import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Reactor {
  user_id: string;
  emoji: string;
  user_name: string;
  user_avatar: string | null;
}

interface ReactorsModalProps {
  postId: string;
  open: boolean;
  onClose: () => void;
  type: "likes" | "reactions";
}

export function ReactorsModal({ postId, open, onClose, type }: ReactorsModalProps) {
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (open && postId) {
      fetchReactors();
    }
  }, [open, postId, type]);

  const fetchReactors = async () => {
    setLoading(true);
    try {
      let data: any[] = [];

      if (type === "likes") {
        const { data: likesData, error } = await supabase
          .from("social_likes")
          .select("user_id")
          .eq("post_id", postId);

        if (error) throw error;
        data = (likesData || []).map((l) => ({ ...l, emoji: "❤️" }));
      } else {
        const { data: reactionsData, error } = await supabase
          .from("social_reactions")
          .select("user_id, emoji")
          .eq("post_id", postId);

        if (error) throw error;
        data = reactionsData || [];
      }

      // Fetch user profiles
      const userIds = [...new Set(data.map((d) => d.user_id))];
      if (userIds.length === 0) {
        setReactors([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, profile_picture_url")
        .in("id", userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, { full_name: p.full_name, profile_picture_url: p.profile_picture_url }])
      );

      const formattedReactors: Reactor[] = data.map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          emoji: r.emoji,
          user_name: profile?.full_name || "Unknown User",
          user_avatar: profile?.profile_picture_url || null,
        };
      });

      setReactors(formattedReactors);
    } catch (error) {
      console.error("Error fetching reactors:", error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueEmojis = [...new Set(reactors.map((r) => r.emoji))];
  const filteredReactors = activeTab === "all" 
    ? reactors 
    : reactors.filter((r) => r.emoji === activeTab);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "likes" ? "Likes" : "Reactions"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : reactors.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No reactions yet</p>
        ) : (
          <div>
            {type === "reactions" && uniqueEmojis.length > 1 && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">All ({reactors.length})</TabsTrigger>
                  {uniqueEmojis.map((emoji) => (
                    <TabsTrigger key={emoji} value={emoji} className="flex-1">
                      {emoji} ({reactors.filter((r) => r.emoji === emoji).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {filteredReactors.map((reactor, index) => (
                <div key={`${reactor.user_id}-${reactor.emoji}-${index}`} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={reactor.user_avatar || ""} />
                    <AvatarFallback>{reactor.user_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{reactor.user_name}</p>
                  </div>
                  <span className="text-lg">{reactor.emoji}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
