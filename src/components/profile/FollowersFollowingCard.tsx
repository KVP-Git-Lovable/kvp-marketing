import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/ui/signed-image";
import { Users, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FollowersFollowingModal } from "./social/FollowersFollowingModal";
import { TeamMemberProfileModal } from "./social/TeamMemberProfileModal";

interface ConnectionUser {
  id: string;
  full_name: string | null;
  profile_picture_url: string | null;
}

export function FollowersFollowingCard() {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<ConnectionUser[]>([]);
  const [following, setFollowing] = useState<ConnectionUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"followers" | "following">("followers");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  const fetchConnections = async () => {
    if (!user) return;

    // Get followers
    const { data: followersData } = await supabase
      .from("employee_connections")
      .select("follower_id")
      .eq("following_id", user.id);

    // Get following
    const { data: followingData } = await supabase
      .from("employee_connections")
      .select("following_id")
      .eq("follower_id", user.id);

    // Fetch profiles for followers
    if (followersData && followersData.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, profile_picture_url")
        .in("id", followersData.map(f => f.follower_id));
      
      setFollowers(profiles || []);
    }

    // Fetch profiles for following
    if (followingData && followingData.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, profile_picture_url")
        .in("id", followingData.map(f => f.following_id));
      
      setFollowing(profiles || []);
    }
  };

  const openModal = (tab: "followers" | "following") => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setModalOpen(false);
    setProfileModalOpen(true);
  };

  const renderAvatarStack = (users: ConnectionUser[], limit = 3) => {
    const displayUsers = users.slice(0, limit);
    const remaining = users.length - limit;

    return (
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {displayUsers.map((u, idx) => (
            <Avatar key={u.id} className="h-8 w-8 border-2 border-background" style={{ zIndex: limit - idx }}>
              <SignedAvatarImage src={u.profile_picture_url || ""} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {u.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        {remaining > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            +{remaining} more
          </span>
        )}
        {users.length === 0 && (
          <span className="text-sm text-muted-foreground">None yet</span>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Followers */}
          <button
            onClick={() => openModal("followers")}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Followers</p>
                <p className="text-sm text-muted-foreground">{followers.length} people follow you</p>
              </div>
            </div>
            {renderAvatarStack(followers)}
          </button>

          {/* Following */}
          <button
            onClick={() => openModal("following")}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Following</p>
                <p className="text-sm text-muted-foreground">You follow {following.length} people</p>
              </div>
            </div>
            {renderAvatarStack(following)}
          </button>
        </CardContent>
      </Card>

      {user && (
        <>
          <FollowersFollowingModal
            userId={user.id}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            defaultTab={modalTab}
            onUserClick={handleUserClick}
          />

          <TeamMemberProfileModal
            userId={selectedUserId}
            open={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
          />
        </>
      )}
    </>
  );
}
