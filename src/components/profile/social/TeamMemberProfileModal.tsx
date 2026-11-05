import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/ui/signed-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, Briefcase, GraduationCap, Trophy, UserPlus, UserCheck, 
  Calendar, Mail, Phone, Linkedin, Users, Building, Target, Heart,
  Sparkles, Twitter, Instagram, Facebook
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface TeamMemberProfileModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

interface MemberProfile {
  id: string;
  full_name: string | null;
  profile_picture_url: string | null;
  phone_number: string | null;
  work_location: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  interests: string[] | null;
  aspirations: string | null;
  date_of_birth: string | null;
  territories_covered: string[] | null;
  designation: string | null;
}

interface EmployeeData {
  hq: string | null;
  education: string | null;
  date_of_joining: string | null;
  band: number | null;
  manager_id: string | null;
  alternate_email: string | null;
}

interface ManagerInfo {
  full_name: string | null;
}

interface AspirationData {
  career_goal: string | null;
  motivation_driver: string | null;
  preferred_work_style: string | null;
  dream_role: string | null;
  five_year_vision: string | null;
}

interface EducationItem {
  id: string;
  institution_name: string;
  degree: string | null;
  field_of_study: string | null;
  from_date: string | null;
  to_date: string | null;
}

interface WorkExperienceItem {
  id: string;
  company_name: string;
  designation: string | null;
  from_date: string | null;
  to_date: string | null;
  description: string | null;
}

export function TeamMemberProfileModal({ userId, open, onClose }: TeamMemberProfileModalProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [managerInfo, setManagerInfo] = useState<ManagerInfo | null>(null);
  const [aspirations, setAspirations] = useState<AspirationData | null>(null);
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkExperienceItem[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchMemberData();
    }
  }, [open, userId]);

  const fetchMemberData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [
        profileResult,
        employeeResult,
        pointsResult,
        followingResult,
        followersResult,
        followingCountResult,
        postsResult,
        aspirationsResult,
        educationResult,
        workResult
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, profile_picture_url, phone_number, work_location, linkedin_url, twitter_url, instagram_url, facebook_url, interests, aspirations, date_of_birth, territories_covered, designation")
          .eq("id", userId)
          .single(),
        supabase
          .from("employees")
          .select("hq, education, date_of_joining, band, manager_id, alternate_email")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("gamification_points")
          .select("points")
          .eq("user_id", userId),
        user ? supabase
          .from("employee_connections")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle() : Promise.resolve({ data: null }),
        supabase
          .from("employee_connections")
          .select("id", { count: "exact" })
          .eq("following_id", userId),
        supabase
          .from("employee_connections")
          .select("id", { count: "exact" })
          .eq("follower_id", userId),
        supabase
          .from("social_posts")
          .select("id", { count: "exact" })
          .eq("user_id", userId),
        supabase
          .from("aspirations_and_preferences")
          .select("career_goal, motivation_driver, preferred_work_style, dream_role, five_year_vision")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("education_history")
          .select("id, institution_name, degree, field_of_study, from_date, to_date")
          .eq("user_id", userId)
          .order("from_date", { ascending: false })
          .limit(3),
        supabase
          .from("work_experiences")
          .select("id, company_name, designation, from_date, to_date, description")
          .eq("user_id", userId)
          .order("from_date", { ascending: false })
          .limit(3)
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as MemberProfile);
      }
      
      if (employeeResult.data) {
        setEmployeeData(employeeResult.data as EmployeeData);
        
        // Fetch manager info if manager_id exists
        if (employeeResult.data.manager_id) {
          const { data: manager } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", employeeResult.data.manager_id)
            .single();
          setManagerInfo(manager);
        }
      }

      if (pointsResult.data) {
        const total = pointsResult.data.reduce((sum, record) => sum + (record.points || 0), 0);
        setTotalPoints(total);
      }

      setIsFollowing(!!followingResult.data);
      setFollowersCount(followersResult.count || 0);
      setFollowingCount(followingCountResult.count || 0);
      setPostsCount(postsResult.count || 0);
      
      if (aspirationsResult.data) {
        setAspirations(aspirationsResult.data as AspirationData);
      }
      
      if (educationResult.data) {
        setEducationHistory(educationResult.data);
      }
      
      if (workResult.data) {
        setWorkHistory(workResult.data);
      }
    } catch (error) {
      console.error("Error fetching member data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !userId) return;

    try {
      if (isFollowing) {
        await supabase
          .from("employee_connections")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success(`Unfollowed ${profile?.full_name}`);
      } else {
        await supabase.from("employee_connections").insert({
          follower_id: user.id,
          following_id: userId,
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success(`Now following ${profile?.full_name}`);
      }
    } catch (error) {
      toast.error("Failed to update follow status");
    }
  };

  const isOwnProfile = user?.id === userId;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Team Member Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* Header Section - LinkedIn Style */}
            <div className="flex flex-col items-center text-center space-y-3">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <SignedAvatarImage src={profile.profile_picture_url || ""} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {profile.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h2 className="text-xl font-bold">{profile.full_name || "Team Member"}</h2>
                {profile.designation && (
                  <p className="text-sm text-primary font-medium">{profile.designation}</p>
                )}
                {employeeData?.hq && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {employeeData.hq}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-center">
                <div>
                  <p className="font-bold">{postsCount}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
                <div>
                  <p className="font-bold">{followersCount}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div>
                  <p className="font-bold">{followingCount}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
              </div>

              {/* Follow Button */}
              {!isOwnProfile && (
                <Button 
                  onClick={handleFollow}
                  variant={isFollowing ? "outline" : "default"}
                  className="w-full"
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              )}
            </div>

            <Separator />

            {/* Contact Details */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Contact Details</p>
              <div className="space-y-2 text-sm">
                {employeeData?.alternate_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${employeeData.alternate_email}`} className="hover:underline text-primary">
                      {employeeData.alternate_email}
                    </a>
                  </div>
                )}
                {profile.phone_number && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${profile.phone_number}`} className="hover:underline text-primary">
                      {profile.phone_number}
                    </a>
                  </div>
                )}
                {/* Social Links */}
                {(profile.linkedin_url || profile.twitter_url || profile.instagram_url || profile.facebook_url) && (
                  <div className="flex gap-2 mt-2">
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" 
                         className="p-2 rounded-lg bg-muted hover:bg-primary/10">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                    {profile.twitter_url && (
                      <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer"
                         className="p-2 rounded-lg bg-muted hover:bg-primary/10">
                        <Twitter className="h-4 w-4" />
                      </a>
                    )}
                    {profile.instagram_url && (
                      <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                         className="p-2 rounded-lg bg-muted hover:bg-primary/10">
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {profile.facebook_url && (
                      <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer"
                         className="p-2 rounded-lg bg-muted hover:bg-primary/10">
                        <Facebook className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Points Badge */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-2xl font-bold text-amber-600">{totalPoints.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Employment Info</p>
              
              {employeeData?.band && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>Band {employeeData.band}</span>
                </div>
              )}

              {employeeData?.date_of_joining && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {format(new Date(employeeData.date_of_joining), "MMM yyyy")}</span>
                </div>
              )}

              {managerInfo?.full_name && (
                <div className="flex items-center gap-3 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Reports to: {managerInfo.full_name}</span>
                </div>
              )}
            </div>

            {/* Education */}
            {educationHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Education
                  </p>
                  <div className="space-y-2">
                    {educationHistory.map((edu) => (
                      <div key={edu.id} className="text-sm">
                        <p className="font-medium">{edu.institution_name}</p>
                        <p className="text-muted-foreground">
                          {edu.degree}{edu.field_of_study && ` in ${edu.field_of_study}`}
                          {edu.to_date && ` (${format(new Date(edu.to_date), "yyyy")})`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Work Experience */}
            {workHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Work Experience
                  </p>
                  <div className="space-y-2">
                    {workHistory.map((work) => (
                      <div key={work.id} className="text-sm">
                        <p className="font-medium">{work.company_name}</p>
                        <p className="text-muted-foreground">
                          {work.designation}
                          {work.from_date && work.to_date && (
                            <span className="ml-1">
                              ({format(new Date(work.from_date), "MMM yyyy")} - {work.to_date ? format(new Date(work.to_date), "MMM yyyy") : "Present"})
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Aspirations Highlights */}
            {aspirations && (aspirations.career_goal || aspirations.motivation_driver || aspirations.dream_role || aspirations.five_year_vision) && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Aspirations
                  </p>
                  <div className="space-y-2">
                    {aspirations.dream_role && (
                      <div className="flex items-start gap-2">
                        <Briefcase className="h-3 w-3 text-primary mt-1" />
                        <span className="text-sm">Dream Role: {aspirations.dream_role}</span>
                      </div>
                    )}
                    {aspirations.career_goal && (
                      <div className="flex items-start gap-2">
                        <Target className="h-3 w-3 text-primary mt-1" />
                        <span className="text-sm">{aspirations.career_goal}</span>
                      </div>
                    )}
                    {aspirations.five_year_vision && (
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-3 w-3 text-primary mt-1" />
                        <span className="text-sm">5-Year Vision: {aspirations.five_year_vision}</span>
                      </div>
                    )}
                    {aspirations.motivation_driver && (
                      <div className="flex items-start gap-2">
                        <Heart className="h-3 w-3 text-primary mt-1" />
                        <span className="text-sm">Motivated by: {aspirations.motivation_driver}</span>
                      </div>
                    )}
                    {aspirations.preferred_work_style && (
                      <div className="flex items-start gap-2">
                        <Users className="h-3 w-3 text-primary mt-1" />
                        <span className="text-sm">{aspirations.preferred_work_style}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Territories */}
            {profile.territories_covered && profile.territories_covered.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Territories Covered</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.territories_covered.map((territory, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {territory}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Profile not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
