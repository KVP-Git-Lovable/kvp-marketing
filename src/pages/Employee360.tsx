import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/ui/signed-image";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { AddRecommendationModal } from "@/components/AddRecommendationModal";
import { SupportRequestForm } from "@/components/SupportRequestForm";
import { Layout } from "@/components/Layout";
import {
  Award,
  Users,
  Briefcase,
  GraduationCap,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Linkedin,
  Facebook,
  Instagram,
  Heart,
  MessageCircle,
  UserPlus,
  UserMinus,
  Star,
  MapPinned,
  Building,
  Home,
} from "lucide-react";

interface Profile {
  id: string;
  username: string;
  full_name: string;
  profile_picture_url?: string;
  date_of_birth?: string;
  anniversary_date?: string;
  current_address?: string;
  permanent_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  phone_number?: string;
  recovery_email?: string;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  interests?: string[];
  aspirations?: string;
  learning_goals?: string[];
  work_location?: string;
  territories_covered?: string[];
}

interface EmployeeData {
  monthly_salary: number;
  daily_da_allowance: number;
  date_of_joining?: string;
  hq?: string;
  education_background?: any;
  expertise_areas?: string[];
}

interface Badge {
  id: string;
  badge_name: string;
  badge_description?: string;
  badge_type: string;
  badge_icon?: string;
  issued_at: string;
}

interface Recommendation {
  id: string;
  recommendation_text: string;
  relationship?: string;
  created_at: string;
  recommender: {
    full_name: string;
    profile_picture_url?: string;
  };
  recipient?: {
    full_name: string;
    profile_picture_url?: string;
  };
}

interface Competency {
  id: string;
  competency: {
    name: string;
    category: string;
  };
  current_level: string;
  notes?: string;
}

export default function Employee360() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsGiven, setRecommendationsGiven] = useState<Recommendation[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddRecommendation, setShowAddRecommendation] = useState(false);

  const profileUserId = userId || user?.id;

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadProfileData();
  }, [user, profileUserId, navigate]);

  const loadProfileData = async () => {
    if (!profileUserId) return;

    setLoading(true);
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileUserId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load employee data
      const { data: employeeData } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", profileUserId)
        .single();

      if (employeeData) {
        setEmployee(employeeData as any);
      }

      // Load badges
      const { data: badgesData } = await supabase
        .from("employee_badges")
        .select("*")
        .eq("user_id", profileUserId)
        .order("issued_at", { ascending: false });

      setBadges(badgesData || []);

      // Load recommendations received
      const { data: recsData } = await supabase
        .from("employee_recommendations")
        .select(`
          *,
          recommender:profiles!employee_recommendations_recommender_id_fkey(full_name, profile_picture_url)
        `)
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false });

      setRecommendations(recsData as any || []);

      // Load recommendations given
      const { data: recsGivenData } = await supabase
        .from("employee_recommendations")
        .select(`
          *,
          recipient:profiles!employee_recommendations_user_id_fkey(full_name, profile_picture_url)
        `)
        .eq("recommender_id", profileUserId)
        .order("created_at", { ascending: false });

      setRecommendationsGiven(recsGivenData as any || []);

      // Load competencies
      const { data: compData } = await supabase
        .from("employee_competencies")
        .select(`
          *,
          competency:competencies!employee_competencies_competency_id_fkey(name, category)
        `)
        .eq("user_id", profileUserId);

      setCompetencies(compData as any || []);

      // Load follow status
      if (user?.id && profileUserId !== user.id) {
        const { data: followData } = await supabase
          .from("employee_connections")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profileUserId)
          .single();

        setIsFollowing(!!followData);
      }

      // Load follower/following counts
      const { count: followers } = await supabase
        .from("employee_connections")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileUserId);

      const { count: following } = await supabase
        .from("employee_connections")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileUserId);

      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);
    } catch (error) {
      console.error("Load error:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!user?.id || !profileUserId || profileUserId === user.id) return;

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("employee_connections")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileUserId);

        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success("Unfollowed");
      } else {
        const { error } = await supabase
          .from("employee_connections")
          .insert({
            follower_id: user.id,
            following_id: profileUserId,
          });

        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        toast.success("Following!");
      }
    } catch (error) {
      console.error("Follow error:", error);
      toast.error("Failed to update follow status");
    }
  };

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case "achievement":
        return <Award className="w-5 h-5" />;
      case "certification":
        return <GraduationCap className="w-5 h-5" />;
      case "award":
        return <Star className="w-5 h-5" />;
      case "milestone":
        return <Heart className="w-5 h-5" />;
      default:
        return <Award className="w-5 h-5" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "expert":
        return "bg-purple-500";
      case "advanced":
        return "bg-blue-500";
      case "intermediate":
        return "bg-green-500";
      case "beginner":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Profile not found</p>
      </div>
    );
  }

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-gradient-primary text-white pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {profileUserId === user?.id ? (
              <ProfilePictureUpload
                userId={user.id}
                currentPhotoUrl={profile.profile_picture_url}
                fullName={profile.full_name}
                onPhotoUpdate={(newUrl) => setProfile({ ...profile, profile_picture_url: newUrl })}
                size="xl"
              />
            ) : (
              <Avatar className="w-32 h-32 border-4 border-white shadow-elegant">
                <SignedAvatarImage src={profile.profile_picture_url} />
                <AvatarFallback className="text-4xl">{profile.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold mb-2">{profile.full_name}</h1>
              <p className="text-xl opacity-90 mb-1">@{profile.username}</p>
              {employee?.hq && (
                <p className="flex items-center gap-2 justify-center md:justify-start opacity-80">
                  <MapPin className="w-4 h-4" />
                  {employee.hq}
                </p>
              )}
              <div className="flex items-center gap-6 mt-4 justify-center md:justify-start">
                <div>
                  <span className="font-bold text-2xl">{followerCount}</span>
                  <p className="text-sm opacity-80">Followers</p>
                </div>
                <div>
                  <span className="font-bold text-2xl">{followingCount}</span>
                  <p className="text-sm opacity-80">Following</p>
                </div>
                <div>
                  <span className="font-bold text-2xl">{badges.length}</span>
                  <p className="text-sm opacity-80">Badges</p>
                </div>
              </div>
            </div>
            {profileUserId !== user?.id && (
              <Button
                onClick={toggleFollow}
                variant={isFollowing ? "outline" : "default"}
                size="lg"
                className="gap-2"
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="w-5 h-5" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 -mt-20">
        <Tabs defaultValue="about" className="space-y-4">
          <TabsList className="bg-card shadow-lg">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="badges">Badges & Awards</TabsTrigger>
            <TabsTrigger value="competencies">Competencies</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="support">Support Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {profile.aspirations && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Career Aspirations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{profile.aspirations}</p>
                    </CardContent>
                  </Card>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Interests & Hobbies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest, idx) => (
                          <Badge key={idx} variant="secondary">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.learning_goals && profile.learning_goals.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5" />
                        Learning Goals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {profile.learning_goals.map((goal, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{goal}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {profile.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{profile.phone_number}</span>
                      </div>
                    )}
                    {profile.recovery_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{profile.recovery_email}</span>
                      </div>
                    )}
                    {profile.work_location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{profile.work_location}</span>
                      </div>
                    )}
                    {employee?.date_of_joining && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          Joined {new Date(employee.date_of_joining).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex gap-3">
                      {profile.linkedin_url && (
                        <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="w-5 h-5 text-blue-600 hover:text-blue-700" />
                        </a>
                      )}
                      {profile.facebook_url && (
                        <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer">
                          <Facebook className="w-5 h-5 text-blue-600 hover:text-blue-700" />
                        </a>
                      )}
                      {profile.instagram_url && (
                        <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer">
                          <Instagram className="w-5 h-5 text-pink-600 hover:text-pink-700" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {(profile.current_address || profile.permanent_address) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Address Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {profile.current_address && (
                        <div>
                          <div className="flex items-start gap-2 mb-1">
                            <Home className="w-4 h-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Current Address</p>
                              <p className="text-sm">{profile.current_address}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {profile.permanent_address && (
                        <div>
                          <div className="flex items-start gap-2 mb-1">
                            <MapPinned className="w-4 h-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Permanent Address</p>
                              <p className="text-sm">{profile.permanent_address}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Emergency Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {profile.emergency_contact_name && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{profile.emergency_contact_name}</span>
                        </div>
                      )}
                      {profile.emergency_contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{profile.emergency_contact_phone}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {employee?.education_background && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5" />
                        Education
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Array.isArray(employee.education_background) ? (
                          employee.education_background.map((edu: any, idx: number) => (
                            <div key={idx} className="border-b pb-3 last:border-0">
                              <p className="font-semibold">{edu.degree || edu.qualification}</p>
                              {edu.institution && (
                                <p className="text-sm text-muted-foreground">{edu.institution}</p>
                              )}
                              {edu.year && (
                                <p className="text-xs text-muted-foreground">{edu.year}</p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm">{JSON.stringify(employee.education_background)}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.territories_covered && profile.territories_covered.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Territories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {profile.territories_covered.map((territory, idx) => (
                          <Badge key={idx} variant="outline">
                            {territory}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {employee?.expertise_areas && employee.expertise_areas.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Expertise</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {employee.expertise_areas.map((area, idx) => (
                          <Badge key={idx} variant="secondary">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="badges">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Badges & Awards
                </CardTitle>
              </CardHeader>
              <CardContent>
                {badges.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No badges yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <Card key={badge.id} className="bg-gradient-subtle">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                              {getBadgeIcon(badge.badge_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold">{badge.badge_name}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {badge.badge_description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(badge.issued_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="competencies">
            <Card>
              <CardHeader>
                <CardTitle>Skills & Competencies</CardTitle>
              </CardHeader>
              <CardContent>
                {competencies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No competencies assessed yet</p>
                ) : (
                  <div className="space-y-4">
                    {competencies.map((comp) => (
                      <div key={comp.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{comp.competency.name}</h4>
                            <p className="text-sm text-muted-foreground">{comp.competency.category}</p>
                          </div>
                          <Badge className={`${getLevelColor(comp.current_level)} text-white`}>
                            {comp.current_level}
                          </Badge>
                        </div>
                        {comp.notes && <p className="text-sm text-muted-foreground">{comp.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Recommendations Received
                  </CardTitle>
                  {profileUserId !== user?.id && (
                    <Button onClick={() => setShowAddRecommendation(true)} size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Recommendation
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No recommendations received yet</p>
                ) : (
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <Card key={rec.id} className="bg-gradient-subtle">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <SignedAvatarImage src={rec.recommender.profile_picture_url} />
                              <AvatarFallback>{rec.recommender.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{rec.recommender.full_name}</span>
                                {rec.relationship && (
                                  <Badge variant="outline" className="text-xs">
                                    {rec.relationship}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {rec.recommendation_text}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(rec.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Recommendations Given
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recommendationsGiven.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No recommendations given yet</p>
                ) : (
                  <div className="space-y-4">
                    {recommendationsGiven.map((rec: any) => (
                      <Card key={rec.id} className="bg-gradient-subtle">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <SignedAvatarImage src={rec.recipient?.profile_picture_url} />
                              <AvatarFallback>{rec.recipient?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">To: {rec.recipient?.full_name}</span>
                                {rec.relationship && (
                                  <Badge variant="outline" className="text-xs">
                                    {rec.relationship}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {rec.recommendation_text}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(rec.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>Support Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <SupportRequestForm userId={profileUserId!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddRecommendationModal
        isOpen={showAddRecommendation}
        onClose={() => setShowAddRecommendation(false)}
        targetUserId={profileUserId!}
        currentUserId={user?.id!}
        onSuccess={loadProfileData}
      />
    </Layout>
  );
}