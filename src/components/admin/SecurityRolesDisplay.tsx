import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SecurityProfile {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
  colorIndex: number;
}

interface RoleUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface SecurityRolesDisplayProps {
  className?: string;
}

// Dynamic color palette for roles — cycles through colors, system profiles get a distinct style
const rolePalette = [
  'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20',
  'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20',
  'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 hover:bg-cyan-500/20',
  'bg-pink-500/10 text-pink-600 border-pink-500/20 hover:bg-pink-500/20',
];
const systemRoleColor = 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20';

const SecurityRolesDisplay: React.FC<SecurityRolesDisplayProps> = ({ className }) => {
  const [roles, setRoles] = useState<SecurityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<SecurityProfile | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      
      // Fetch security profiles
      const { data: profiles, error: profileError } = await supabase
        .from('security_profiles')
        .select('id, name, description, is_system')
        .order('name');
      
      if (profileError) throw profileError;

      // Fetch user counts per profile
      const { data: userCounts, error: countError } = await supabase
        .from('user_profiles')
        .select('profile_id');
      
      if (countError) throw countError;

      // Count users per profile
      const countMap = new Map<string, number>();
      userCounts?.forEach(up => {
        const current = countMap.get(up.profile_id) || 0;
        countMap.set(up.profile_id, current + 1);
      });

      let nonSystemIndex = 0;
      const rolesWithCounts: SecurityProfile[] = (profiles || []).map(profile => ({
        ...profile,
        user_count: countMap.get(profile.id) || 0,
        colorIndex: profile.is_system ? 0 : nonSystemIndex++,
      }));

      setRoles(rolesWithCounts);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersForRole = async (role: SecurityProfile) => {
    setSelectedRole(role);
    setLoadingUsers(true);
    try {
      // Fetch user_profiles with this role
      const { data: userProfiles, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('profile_id', role.id);

      if (error) throw error;

      if (userProfiles && userProfiles.length > 0) {
        const userIds = userProfiles.map(up => up.user_id);
        
        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, profile_picture_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const users: RoleUser[] = (profiles || []).map(p => ({
          id: p.id,
          full_name: p.full_name || 'Unknown User',
          email: p.username || '',
          avatar_url: p.profile_picture_url || undefined,
        }));

        setRoleUsers(users);
      } else {
        setRoleUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users for role:', error);
      setRoleUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getRoleColor = (role: SecurityProfile) => {
    if (role.is_system) return systemRoleColor;
    return rolePalette[role.colorIndex % rolePalette.length];
  };

  const totalUsers = roles.reduce((sum, role) => sum + role.user_count, 0);

  if (loading) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-28 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {/* Total Users Box */}
        <div className="px-3 py-2 rounded-lg border bg-muted/50 text-foreground border-border min-w-[100px]">
          <h3 className="font-medium text-xs text-muted-foreground">Total Users</h3>
          <div className="flex items-center gap-1 text-base font-bold mt-0.5">
            <Users className="h-3.5 w-3.5" />
            <span>{totalUsers}</span>
          </div>
        </div>

        {/* Role Boxes */}
        {roles.map((role) => (
          <div
            key={role.id}
            onClick={() => fetchUsersForRole(role)}
            className={`px-3 py-2 rounded-lg border transition-all cursor-pointer min-w-[100px] ${getRoleColor(role)}`}
          >
            <h3 className="font-medium text-xs line-clamp-1">{role.name}</h3>
            <div className="flex items-center gap-1 text-base font-bold mt-0.5">
              <Users className="h-3.5 w-3.5" />
              <span>{role.user_count}</span>
            </div>
          </div>
        ))}

        {roles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground w-full">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No roles found</p>
            <p className="text-sm">Create roles in Security & Access Control</p>
          </div>
        )}
      </div>

      {/* Users Dialog */}
      <Dialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedRole?.name} Users
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingUsers ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : roleUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No users assigned to this role</p>
              </div>
            ) : (
              roleUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.full_name}</p>
                    {user.email && (
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SecurityRolesDisplay;
