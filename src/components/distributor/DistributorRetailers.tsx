import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Store, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Phone, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Retailer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  beat_name: string | null;
}

interface Props {
  distributorId: string;
}

const priorityColors: Record<string, string> = {
  'high': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'low': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const statusColors: Record<string, string> = {
  'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'inactive': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  'new': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const ITEMS_PER_PAGE = 5;

export function DistributorRetailers({ distributorId }: Props) {
  const navigate = useNavigate();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorName, setDistributorName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadRetailers();

    // Real-time subscription (records with explicit distributor_id)
    const byDistributorId = supabase
      .channel(`distributor-retailers-by-id-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadRetailers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(byDistributorId);
    };
  }, [distributorId]);

  useEffect(() => {
    if (!distributorName) return;

    // Real-time subscription (legacy linkage via parent_name)
    const encodedName = encodeURIComponent(distributorName);
    const byParentName = supabase
      .channel(`distributor-retailers-by-parent-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `parent_name=eq.${encodedName}`,
        },
        () => loadRetailers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(byParentName);
    };
  }, [distributorId, distributorName]);

  const loadRetailers = async () => {
    try {
      setLoading(true);

      // Fetch distributor name (needed for legacy parent_name linkage)
      let name = distributorName;
      if (!name) {
        const { data: dist, error: distError } = await supabase
          .from("distributors")
          .select("name")
          .eq("id", distributorId)
          .maybeSingle();

        if (distError) throw distError;
        name = dist?.name ?? null;
        setDistributorName(name);
      }

      const results = new Map<string, Retailer>();

      // 1) New linkage: retailers.distributor_id
      const { data: byId, error: byIdError } = await supabase
        .from("retailers")
        .select("id, name, phone, address, category, priority, status, beat_name")
        .eq("distributor_id", distributorId)
        .order("name");

      if (byIdError) throw byIdError;
      (byId || []).forEach((r) => results.set(r.id, r));

      // 2) Legacy linkage: retailers.parent_name + parent_type
      if (name) {
        const { data: byParent, error: byParentError } = await supabase
          .from("retailers")
          .select("id, name, phone, address, category, priority, status, beat_name")
          .eq("parent_name", name)
          .or("parent_type.eq.Distributor,parent_type.is.null")
          .order("name");

        if (byParentError) throw byParentError;
        (byParent || []).forEach((r) => results.set(r.id, r));
      }

      setRetailers(
        Array.from(results.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error: any) {
      toast.error("Failed to load retailers: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const categories = useMemo(() => {
    const cats = new Set(retailers.map(r => r.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [retailers]);

  const priorities = useMemo(() => {
    const pris = new Set(retailers.map(r => r.priority).filter(Boolean));
    return Array.from(pris) as string[];
  }, [retailers]);

  const statuses = useMemo(() => {
    const stats = new Set(retailers.map(r => r.status).filter(Boolean));
    return Array.from(stats) as string[];
  }, [retailers]);

  // Filtered retailers
  const filteredRetailers = useMemo(() => {
    return retailers.filter(retailer => {
      const matchesSearch = retailer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (retailer.phone?.includes(searchQuery)) ||
                           (retailer.address?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === "all" || retailer.priority === priorityFilter;
      const matchesStatus = statusFilter === "all" || retailer.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || retailer.category === categoryFilter;
      return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
    });
  }, [retailers, searchQuery, priorityFilter, statusFilter, categoryFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, priorityFilter, statusFilter, categoryFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRetailers.length / ITEMS_PER_PAGE);
  const paginatedRetailers = filteredRetailers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Retailers Supported ({filteredRetailers.length})
              </CardTitle>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {/* Search and Filters */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {priorities.length > 0 && (
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[120px] h-9">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      {priorities.map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {statuses.length > 0 && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[120px] h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statuses.map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {categories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredRetailers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {retailers.length === 0 ? "No retailers linked to this distributor" : "No retailers match your filters"}
                </p>
                {retailers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Link retailers by setting distributor in My Retailers
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedRetailers.map(retailer => (
                    <div
                      key={retailer.id}
                      className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/retailer/${retailer.id}`)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center flex-shrink-0">
                          <Store className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{retailer.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {retailer.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {retailer.phone}
                              </span>
                            )}
                            {retailer.beat_name && (
                              <Badge variant="outline" className="text-xs">
                                {retailer.beat_name}
                              </Badge>
                            )}
                            {retailer.category && (
                              <Badge variant="outline" className="text-xs">
                                {retailer.category}
                              </Badge>
                            )}
                            {retailer.priority && (
                              <Badge className={`text-xs ${priorityColors[retailer.priority] || 'bg-gray-100'}`}>
                                {retailer.priority}
                              </Badge>
                            )}
                            {retailer.status && (
                              <Badge className={`text-xs ${statusColors[retailer.status] || 'bg-gray-100'}`}>
                                {retailer.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}