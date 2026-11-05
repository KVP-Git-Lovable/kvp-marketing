import { useState, useEffect } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  phone_number: string | null;
}

interface Props {
  value: string | null;
  valueName: string | null;
  onChange: (id: string | null, name: string | null) => void;
}

export function OwnerSelector({ value, valueName, onChange }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone_number').match(ACTIVE_PROFILE)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const search = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(search) ||
      u.username?.toLowerCase().includes(search) ||
      u.phone_number?.includes(searchQuery)
    );
  });

  const handleSelect = (user: UserProfile) => {
    onChange(user.id, user.full_name || user.username || 'Unknown');
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  return (
    <div className="space-y-2">
      <Label>Owner (Internal Team Member)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          >
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={valueName ? "" : "text-muted-foreground"}>
                {valueName || "Select owner..."}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {value && (
                <X 
                  className="h-4 w-4 text-muted-foreground hover:text-foreground" 
                  onClick={handleClear}
                />
              )}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="h-64">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No users found</div>
            ) : (
              <div className="p-1">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                      value === user.id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => handleSelect(user)}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.full_name || user.username || 'Unknown'}
                      </p>
                      {user.phone_number && (
                        <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
