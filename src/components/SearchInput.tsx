import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export const SearchInput = ({ placeholder = "Search...", value, onChange }: SearchInputProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-8 sm:pl-10 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 focus:border-primary focus:ring-primary/30 text-xs sm:text-sm font-medium placeholder:text-muted-foreground shadow-lg backdrop-blur-sm"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-md pointer-events-none" />
    </div>
  );
};