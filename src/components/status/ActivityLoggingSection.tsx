import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Separator } from '@/components/ui/separator';
import { Users, RefreshCw, Mail, Phone, MapPin, Briefcase, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityRow {
  user_id: string;
  full_name: string;
  total_usage_seconds: number;
  most_used_module: string;
  most_used_count: number;
  least_used_module: string;
  least_used_count: number;
  data_usage_bytes: number;
}

interface UserProfileData {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone_number: string | null;
  designation: string | null;
  profile_picture_url: string | null;
  date_of_joining: string | null;
  role: string | null;
  band: string | null;
  address: string | null;
  primary_manager_name: string | null;
  secondary_manager_name: string | null;
}

function formatUsageTime(seconds: number): string {
  if (seconds < 0) return '-';
  if (seconds === 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDataUsage(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
}

const RANGE_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
];

function ProfileInfoItem({ icon, label, value, containerClassName, valueClassName }: { icon: React.ReactNode; label: string; value: string; containerClassName?: string; valueClassName?: string }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg bg-muted/30 ${containerClassName || ''}`}>
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${valueClassName || 'break-words'}`}>{value}</p>
      </div>
    </div>
  );
}

export const ActivityLoggingSection = () => {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayActiveCount, setTodayActiveCount] = useState<number | null>(null);

  const fetchTodayActiveUsers = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
      .not('check_in_time', 'is', null);
    if (!error) setTodayActiveCount(count ?? 0);
  }, []);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_activity_logging_summary', { p_days: days });
      if (error) throw error;
      setRows((data as unknown as ActivityRow[]) || []);
    } catch (e: any) {
      console.error('Activity fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchActivity();
    fetchTodayActiveUsers();
  }, [fetchActivity, fetchTodayActiveUsers]);

  const handleViewProfile = async (userId: string) => {
    setProfileOpen(true);
    setProfileLoading(true);
    setSelectedProfile(null);
    try {
      const { data, error } = await supabase.rpc('get_user_profile_card', { p_user_id: userId });
      if (error) throw error;
      setSelectedProfile(data as unknown as UserProfileData);
    } catch (e: any) {
      console.error('Profile fetch error:', e);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <>
      <Card className="bg-white/95 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold text-foreground">Activity Logging</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {RANGE_OPTIONS.map((opt) => (
                <Button
                  key={opt.days}
                  variant={days === opt.days ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDays(opt.days)}
                >
                  {opt.label}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 ml-1" onClick={fetchActivity} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Current Active Users Box */}
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-2.5">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Current active users:</span>
            <span className="text-sm font-bold text-foreground">
              {todayActiveCount !== null ? todayActiveCount : '–'}
            </span>
          </div>
          {rows.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Usage Time</TableHead>
                    <TableHead>Most Used</TableHead>
                    <TableHead>Least Used</TableHead>
                    <TableHead>Data Usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <button
                          className="font-medium text-primary hover:underline cursor-pointer text-left"
                          onClick={() => handleViewProfile(row.user_id)}
                        >
                          {row.full_name}
                        </button>
                      </TableCell>
                      <TableCell>{formatUsageTime(row.total_usage_seconds)}</TableCell>
                      <TableCell>
                        <span>{row.most_used_module}</span>
                        {row.most_used_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">({row.most_used_count})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span>{row.least_used_module}</span>
                        {row.least_used_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">({row.least_used_count})</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDataUsage(row.data_usage_bytes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedProfile ? (
            <div className="space-y-4">
              {/* Avatar and Name */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-background shadow-md">
                  <SignedAvatarImage src={selectedProfile.profile_picture_url || undefined} alt={selectedProfile.full_name || ''} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                    {selectedProfile.full_name?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedProfile.full_name || 'Unknown'}</h3>
                  {selectedProfile.designation && (
                    <p className="text-sm text-muted-foreground">{selectedProfile.designation}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Profile Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ProfileInfoItem icon={<Mail className="h-4 w-4" />} label="Email" value={selectedProfile.email || '-'} containerClassName="sm:col-span-2" valueClassName="whitespace-nowrap overflow-x-auto" />
                {selectedProfile.designation && (
                  <ProfileInfoItem icon={<Briefcase className="h-4 w-4" />} label="Designation" value={selectedProfile.designation} />
                )}
                <ProfileInfoItem icon={<Users className="h-4 w-4" />} label="Primary Manager" value={selectedProfile.primary_manager_name || '-'} />
                <ProfileInfoItem icon={<Users className="h-4 w-4" />} label="Secondary Manager" value={selectedProfile.secondary_manager_name || '-'} />
                <ProfileInfoItem icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedProfile.phone_number || '-'} />
                <ProfileInfoItem icon={<Briefcase className="h-4 w-4" />} label="Role" value={selectedProfile.role ? selectedProfile.role.charAt(0).toUpperCase() + selectedProfile.role.slice(1) : '-'} />
                {selectedProfile.date_of_joining && (
                  <ProfileInfoItem
                    icon={<Calendar className="h-4 w-4" />}
                    label="Date of Joining"
                    value={format(new Date(selectedProfile.date_of_joining), 'PP')}
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Could not load profile.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};