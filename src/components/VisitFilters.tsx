import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface FilterOptions {
  category?: string;
  lastVisitDays?: string;
  visitFrequency?: string;
  avgSalesRange?: string;
  location?: string;
  priority?: string;
  focusedProduct?: string;
}

interface VisitFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories?: string[];
  availableLocations?: string[];
}

export const VisitFilters = ({ 
  filters, 
  onFiltersChange,
  availableCategories = [],
  availableLocations = []
}: VisitFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== "all").length;

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters };
    if (value === "all" || !value) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:from-primary/15 hover:to-primary/10 h-8 w-8"
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <DrawerTitle className="text-base font-semibold">Filter Retailers</DrawerTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                Clear All
              </Button>
            )}
          </DrawerHeader>
          <ScrollArea className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            <div className="px-4 py-3 space-y-4 pb-8">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={filters.category || "all"} onValueChange={(value) => handleFilterChange("category", value)}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent className="bg-background z-[60]">
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Last Visited</Label>
                <Select value={filters.lastVisitDays || "all"} onValueChange={(value) => handleFilterChange("lastVisitDays", value)}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="Any time" /></SelectTrigger>
                  <SelectContent className="bg-background z-[60]">
                    <SelectItem value="all">Any time</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="60">Last 60 days</SelectItem>
                    <SelectItem value="90">Last 90+ days</SelectItem>
                    <SelectItem value="never">Never visited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Avg Order Value</Label>
                <Select value={filters.avgSalesRange || "all"} onValueChange={(value) => handleFilterChange("avgSalesRange", value)}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="All ranges" /></SelectTrigger>
                  <SelectContent className="bg-background z-[60]">
                    <SelectItem value="all">All ranges</SelectItem>
                    <SelectItem value="high">High (₹20,000+)</SelectItem>
                    <SelectItem value="medium">Medium (₹10,000 - ₹20,000)</SelectItem>
                    <SelectItem value="low">Low (₹5,000 - ₹10,000)</SelectItem>
                    <SelectItem value="very-low">Very Low (&lt;₹5,000)</SelectItem>
                    <SelectItem value="zero">No orders yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Focused Products</Label>
                <Select value={filters.focusedProduct || "all"} onValueChange={(value) => handleFilterChange("focusedProduct", value)}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="All products" /></SelectTrigger>
                  <SelectContent className="bg-background z-[60]">
                    <SelectItem value="all">All products</SelectItem>
                    <SelectItem value="focused">Focused Products Only</SelectItem>
                    <SelectItem value="non-focused">Non-Focused Products Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priority</Label>
                <Select value={filters.priority || "all"} onValueChange={(value) => handleFilterChange("priority", value)}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="All priorities" /></SelectTrigger>
                  <SelectContent className="bg-background z-[60]">
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {availableLocations.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Location</Label>
                  <Select value={filters.location || "all"} onValueChange={(value) => handleFilterChange("location", value)}>
                    <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="All locations" /></SelectTrigger>
                    <SelectContent className="bg-background z-[60]">
                      <SelectItem value="all">All locations</SelectItem>
                      {availableLocations.map((loc) => (<SelectItem key={loc} value={loc}>{loc}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {filters.category && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Category: {filters.category}
              <button onClick={() => handleFilterChange("category", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.lastVisitDays && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              {filters.lastVisitDays === "never" ? "Never visited" : `Last ${filters.lastVisitDays} days`}
              <button onClick={() => handleFilterChange("lastVisitDays", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.avgSalesRange && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Sales: {filters.avgSalesRange}
              <button onClick={() => handleFilterChange("avgSalesRange", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.priority && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Priority: {filters.priority}
              <button onClick={() => handleFilterChange("priority", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.location && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Location: {filters.location}
              <button onClick={() => handleFilterChange("location", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.focusedProduct && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              {filters.focusedProduct === "focused" ? "Focused Products" : "Non-Focused Products"}
              <button onClick={() => handleFilterChange("focusedProduct", "")} className="ml-1 hover:text-primary-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
