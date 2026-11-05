import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Route, ChevronRight, ChevronDown, ChevronUp, Search, Filter, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Beat {
  id: string;
  beat_id: string;
  beat_name: string;
  category: string | null;
  is_active: boolean | null;
  average_km: number | null;
  travel_allowance: number | null;
}

interface Props {
  distributorId: string;
}

const ITEMS_PER_PAGE = 5;

export function DistributorBeats({ distributorId }: Props) {
  const navigate = useNavigate();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorName, setDistributorName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadBeats();

    // Real-time subscriptions
    const beatsChannel = supabase
      .channel(`distributor-beats-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "beats",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadBeats()
      )
      .subscribe();

    const mappingsChannel = supabase
      .channel(`distributor-beat-mappings-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "distributor_beat_mappings",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadBeats()
      )
      .subscribe();

    const retailersByIdChannel = supabase
      .channel(`distributor-beats-retailers-by-id-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadBeats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(beatsChannel);
      supabase.removeChannel(mappingsChannel);
      supabase.removeChannel(retailersByIdChannel);
    };
  }, [distributorId]);

  useEffect(() => {
    if (!distributorName) return;

    // Retailers linked via legacy parent_name
    const encodedName = encodeURIComponent(distributorName);
    const retailersByParentChannel = supabase
      .channel(`distributor-beats-retailers-by-parent-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `parent_name=eq.${encodedName}`,
        },
        () => loadBeats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(retailersByParentChannel);
    };
  }, [distributorId, distributorName]);

  const loadBeats = async () => {
    try {
      setLoading(true);

      // Fetch distributor name (needed for legacy linkage)
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

      // Beat IDs derived from linked retailers
      const retailerBeatIds = new Set<string>();

      const { data: r1, error: r1Error } = await supabase
        .from("retailers")
        .select("beat_id")
        .eq("distributor_id", distributorId);
      if (r1Error) throw r1Error;
      (r1 || []).forEach((r) => retailerBeatIds.add(r.beat_id));

      if (name) {
        const { data: r2, error: r2Error } = await supabase
          .from("retailers")
          .select("beat_id")
          .eq("parent_name", name)
          .or("parent_type.eq.Distributor,parent_type.is.null");
        if (r2Error) throw r2Error;
        (r2 || []).forEach((r) => retailerBeatIds.add(r.beat_id));
      }

      // Beat IDs mapped explicitly via distributor_beat_mappings (references beats.id)
      const { data: mappings, error: mappingsError } = await supabase
        .from("distributor_beat_mappings")
        .select("beat_id")
        .eq("distributor_id", distributorId);
      if (mappingsError) throw mappingsError;
      const mappedBeatRowIds = (mappings || []).map((m) => m.beat_id);

      const beatsById = new Map<string, Beat>();

      // 1) Direct linkage on beats.distributor_id
      const { data: direct, error: directError } = await supabase
        .from("beats")
        .select("id, beat_id, beat_name, category, is_active, average_km, travel_allowance")
        .eq("distributor_id", distributorId)
        .order("beat_name");
      if (directError) throw directError;
      (direct || []).forEach((b) => beatsById.set(b.id, b));

      // 2) Derived linkage via retailers.beat_id -> beats.beat_id
      const derivedBeatCodes = Array.from(retailerBeatIds).filter(Boolean);
      if (derivedBeatCodes.length > 0) {
        const { data: derived, error: derivedError } = await supabase
          .from("beats")
          .select("id, beat_id, beat_name, category, is_active, average_km, travel_allowance")
          .in("beat_id", derivedBeatCodes)
          .order("beat_name");
        if (derivedError) throw derivedError;
        (derived || []).forEach((b) => beatsById.set(b.id, b));
      }

      // 3) Explicit mappings to beats.id
      if (mappedBeatRowIds.length > 0) {
        const { data: mapped, error: mappedError } = await supabase
          .from("beats")
          .select("id, beat_id, beat_name, category, is_active, average_km, travel_allowance")
          .in("id", mappedBeatRowIds)
          .order("beat_name");
        if (mappedError) throw mappedError;
        (mapped || []).forEach((b) => beatsById.set(b.id, b));
      }

      setBeats(Array.from(beatsById.values()).sort((a, b) => a.beat_name.localeCompare(b.beat_name)));
    } catch (error: any) {
      toast.error("Failed to load beats: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(beats.map(b => b.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [beats]);

  // Filtered beats
  const filteredBeats = useMemo(() => {
    return beats.filter(beat => {
      const matchesSearch = beat.beat_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           beat.beat_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && beat.is_active !== false) ||
                           (statusFilter === "inactive" && beat.is_active === false);
      const matchesCategory = categoryFilter === "all" || beat.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [beats, searchQuery, statusFilter, categoryFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredBeats.length / ITEMS_PER_PAGE);
  const paginatedBeats = filteredBeats.slice(
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
                <Route className="h-4 w-4" />
                Beats Supported ({filteredBeats.length})
              </CardTitle>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search beats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-9">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
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
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredBeats.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {beats.length === 0 ? "No beats linked to this distributor" : "No beats match your filters"}
                </p>
                {beats.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Link beats by setting distributor in the Beat Master
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedBeats.map(beat => (
                    <div
                      key={beat.id}
                      className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/beat/${beat.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Route className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{beat.beat_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{beat.beat_id}</span>
                            {beat.category && (
                              <Badge variant="outline" className="text-xs">
                                {beat.category}
                              </Badge>
                            )}
                            {beat.is_active === false && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                            {beat.average_km && (
                              <span className="text-xs text-muted-foreground">{beat.average_km} km</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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