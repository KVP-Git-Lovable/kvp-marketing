import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NavLink } from '@/components/NavLink';
import { NavItem } from '@/hooks/useNavCustomization';

interface NavSearchProps {
  items: NavItem[];
  onItemClick: () => void;
}

export const NavSearch = ({ items, onItemClick }: NavSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.href.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  useEffect(() => {
    if (isSearching && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearching]);

  const handleClear = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  if (!isSearching) {
    return (
      <button
        onClick={() => setIsSearching(true)}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        title="Search modules"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules..."
          className="pl-9 pr-9"
        />
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {searchQuery.trim() && (
        <div className="max-h-60 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No modules found for "{searchQuery}"
            </div>
          ) : (
            <div className="p-2">
              {filteredItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  onClick={() => {
                    handleClear();
                    onItemClick();
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${item.color} shadow-sm`}>
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
