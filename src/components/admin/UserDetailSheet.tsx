import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, Mail, Phone, MapPin, Calendar, Briefcase, GraduationCap, 
  FileText, Building2, DollarSign, Clock, AlertCircle, ExternalLink,
  Linkedin, Twitter, Instagram, Facebook, Pencil
} from 'lucide-react';
import { format } from 'date-fns';

interface UserDetailSheetProps {
  user: {
    id: string;
    email: string;
    username: string;
    full_name?: string;
    phone_number?: string;
    recovery_email?: string;
    created_at: string;
    last_sign_in_at?: string;
    email_confirmed_at?: string;
    profile?: {
      id: string;
      username: string;
      full_name: string;
      profile_picture_url?: string;
    };
    securityProfile?: {
      id: string;
      name: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClick?: () => void;
  managers?: Record<string, { full_name: string; username: string }>;
}

interface EmployeeData {
  monthly_salary?: number;
  daily_da_allowance?: number;
  band?: number;
  hq?: string;
  date_of_joining?: string;
  date_of_exit?: string;
  alternate_email?: string;
  emergency_contact_number?: string;
  aadhar_document_url?: string;
  pan_document_url?: string;
}

interface ProfileData {
  date_of_birth?: string;
  anniversary_date?: string;
  current_address?: string;
  permanent_address?: string;
  designation?: string;
  work_location?: string;
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

interface EducationEntry {
  id: string;
  institution_name: string;
  degree: string;
  field_of_study?: string;
  from_date?: string;
  to_date?: string;
  grade?: string;
  is_current?: boolean;
}

interface WorkExperience {
  id: string;
  company_name: string;
  designation: string;
  location?: string;
  from_date?: string;
  to_date?: string;
  description?: string;
  is_current?: boolean;
}

export default function UserDetailSheet({ 
  user, 
  open, 
  onOpenChange, 
  onEditClick,
  managers 
}: UserDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);

  useEffect(() => {
    if (open && user?.id) {
      fetchUserDetails(user.id);
    }
  }, [open, user?.id]);

  const fetchUserDetails = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch employee data
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (employee) {
        setEmployeeData({
          monthly_salary: employee.monthly_salary,
          daily_da_allowance: employee.daily_da_allowance,
          band: employee.band as any,
          hq: employee.hq,
          date_of_joining: employee.date_of_joining,
          date_of_exit: employee.date_of_exit,
          alternate_email: employee.alternate_email,
          emergency_contact_number: employee.emergency_contact_number,
          aadhar_document_url: employee.aadhar_document_url,
          pan_document_url: employee.pan_document_url,
        });
      }

      // Fetch full profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        setProfileData({
          date_of_birth: profile.date_of_birth,
          anniversary_date: profile.anniversary_date,
          current_address: profile.current_address,
          permanent_address: profile.permanent_address,
          designation: (profile as any).designation,
          work_location: profile.work_location,
          linkedin_url: profile.linkedin_url,
          twitter_url: (profile as any).twitter_url,
          instagram_url: profile.instagram_url,
          facebook_url: profile.facebook_url,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
        });
      }

      // Fetch education history
      const { data: educationData } = await (supabase as any)
        .from('education_history')
        .select('*')
        .eq('user_id', userId)
        .order('from_date', { ascending: false });

      if (educationData) {
        setEducation(educationData as any);
      }

      // Fetch work experiences
      const { data: workData } = await (supabase as any)
        .from('work_experiences')
        .select('*')
        .eq('user_id', userId)
        .order('from_date', { ascending: false });

      if (workData) {
        setWorkExperience(workData as any);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!user) return null;

  const managerInfo = managers?.[user.id];
  const emergencyContact = employeeData?.emergency_contact_number || 
    (profileData?.emergency_contact_name ? `${profileData.emergency_contact_name}${profileData.emergency_contact_phone ? ` • ${profileData.emergency_contact_phone}` : ''}` : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            <Avatar className="w-14 h-14">
              <SignedAvatarImage src={user.profile?.profile_picture_url} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {user.profile?.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold truncate">
                {user.profile?.full_name || user.full_name || 'Unknown User'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                @{user.username || user.profile?.username}
              </SheetDescription>
              <span className="text-xs text-muted-foreground mt-1 block">
                {user.securityProfile?.name || 'No Role Assigned'}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="shrink-0"
              onClick={() => {
                onOpenChange(false);
                onEditClick?.();
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs">Employment</TabsTrigger>
            <TabsTrigger value="education" className="text-xs">Education</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="mt-0 space-y-4">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem icon={Mail} label="Email" value={user.email} />
                    <InfoItem icon={Phone} label="Phone" value={user.phone_number || '-'} />
                    <InfoItem icon={User} label="Manager" value={managerInfo?.full_name || managerInfo?.username || '-'} />
                    <InfoItem 
                      icon={AlertCircle} 
                      label="Status" 
                      value={user.email_confirmed_at ? 'Verified' : 'Pending'} 
                    />
                    <InfoItem icon={Calendar} label="Joined" value={formatDate(user.created_at)} />
                    <InfoItem 
                      icon={Clock} 
                      label="Last Login" 
                      value={user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'} 
                    />
                  </div>

                  {/* Emergency Contact */}
                  {emergencyContact && (
                    <Card className="border-dashed">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">Emergency Contact</p>
                        <p className="text-sm font-medium">{emergencyContact}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Address */}
                  {(profileData?.current_address || profileData?.permanent_address) && (
                    <Card className="border-dashed">
                      <CardContent className="p-3 space-y-2">
                        {profileData.current_address && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Current Address</p>
                            <p className="text-sm">{profileData.current_address}</p>
                          </div>
                        )}
                        {profileData.permanent_address && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Permanent Address</p>
                            <p className="text-sm">{profileData.permanent_address}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Social Links */}
                  {(profileData?.linkedin_url || profileData?.twitter_url || profileData?.instagram_url || profileData?.facebook_url) && (
                    <div className="flex gap-2 flex-wrap">
                      {profileData.linkedin_url && (
                        <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Linkedin className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {profileData.twitter_url && (
                        <a href={profileData.twitter_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Twitter className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {profileData.instagram_url && (
                        <a href={profileData.instagram_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Instagram className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {profileData.facebook_url && (
                        <a href={profileData.facebook_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Facebook className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="employment" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem 
                      icon={DollarSign} 
                      label="Monthly Salary" 
                      value={formatCurrency(employeeData?.monthly_salary)} 
                    />
                    <InfoItem 
                      icon={DollarSign} 
                      label="DA Allowance" 
                      value={formatCurrency(employeeData?.daily_da_allowance)} 
                    />
                    <InfoItem icon={Briefcase} label="Band" value={employeeData?.band?.toString() || '-'} />
                    <InfoItem icon={MapPin} label="HQ" value={employeeData?.hq || '-'} />
                    <InfoItem 
                      icon={Calendar} 
                      label="Date of Joining" 
                      value={formatDate(employeeData?.date_of_joining)} 
                    />
                    <InfoItem 
                      icon={Calendar} 
                      label="Date of Exit" 
                      value={formatDate(employeeData?.date_of_exit)} 
                    />
                  </div>

                  {employeeData?.alternate_email && (
                    <InfoItem 
                      icon={Mail} 
                      label="Alternate Email" 
                      value={employeeData.alternate_email} 
                      fullWidth 
                    />
                  )}

                  {profileData?.designation && (
                    <InfoItem 
                      icon={Briefcase} 
                      label="Designation" 
                      value={profileData.designation} 
                      fullWidth 
                    />
                  )}

                  {profileData?.work_location && (
                    <InfoItem 
                      icon={Building2} 
                      label="Work Location" 
                      value={profileData.work_location} 
                      fullWidth 
                    />
                  )}

                  {/* Work Experience */}
                  {workExperience.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Work Experience
                      </h4>
                      {workExperience.map((exp) => (
                        <Card key={exp.id} className="border-dashed">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium">{exp.designation}</p>
                                <p className="text-xs text-muted-foreground">{exp.company_name}</p>
                              </div>
                              {exp.is_current && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(exp.from_date)} - {exp.is_current ? 'Present' : formatDate(exp.to_date)}
                              {exp.location && ` • ${exp.location}`}
                            </p>
                            {exp.description && (
                              <p className="text-xs mt-2">{exp.description}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="education" className="mt-0 space-y-4">
                  {education.length > 0 ? (
                    <div className="space-y-2">
                      {education.map((edu) => (
                        <Card key={edu.id} className="border-dashed">
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <GraduationCap className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{edu.institution_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDate(edu.from_date)} - {edu.is_current ? 'Present' : formatDate(edu.to_date)}
                                  {edu.grade && ` • Grade: ${edu.grade}`}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No education history added</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents" className="mt-0 space-y-4">
                  <div className="space-y-2">
                    <DocumentItem 
                      label="Aadhar Document" 
                      url={employeeData?.aadhar_document_url} 
                    />
                    <DocumentItem 
                      label="PAN Document" 
                      url={employeeData?.pan_document_url} 
                    />
                  </div>

                  {!employeeData?.aadhar_document_url && !employeeData?.pan_document_url && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents uploaded</p>
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({ 
  icon: Icon, 
  label, 
  value, 
  fullWidth = false 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  value: string; 
  fullWidth?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function DocumentItem({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return (
      <Card className="border-dashed opacity-50">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{label}</span>
          </div>
          <span className="text-xs text-muted-foreground">Not uploaded</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm">{label}</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            View <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
