import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Calendar, Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onSearch: (query: string, date?: Date, userId?: string) => void;
  users: { id: string; full_name: string }[];
  onUserClick: (userId: string) => void;
}

export function SearchBar({ onSearch, users, onUserClick }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState<Date>();
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userQuery, setUserQuery] = useState("");

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(userQuery.toLowerCase())
  );

  const handleSearch = () => {
    onSearch(query, date);
  };

  const handleClear = () => {
    setQuery("");
    setDate(undefined);
    onSearch("", undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts by keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-8"
          />
          {(query || date) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={date ? "secondary" : "outline"}
              size="icon"
              className={cn("flex-shrink-0", date && "bg-primary/10")}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                if (d || query) onSearch(query, d);
              }}
              initialFocus
            />
            {date && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDate(undefined);
                    onSearch(query, undefined);
                  }}
                >
                  Clear date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={showUserSearch} onOpenChange={setShowUserSearch}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="flex-shrink-0">
              <Users className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-2 border-b">
              <Input
                placeholder="Search team members..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 text-center">No users found</p>
              ) : (
                filteredUsers.slice(0, 10).map((user) => (
                  <button
                    key={user.id}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex items-center gap-2"
                    onClick={() => {
                      onUserClick(user.id);
                      setShowUserSearch(false);
                      setUserQuery("");
                    }}
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {user.full_name}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button size="sm" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {date && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Filtering by: {format(date, "MMM d, yyyy")}</span>
        </div>
      )}
    </div>
  );
}
