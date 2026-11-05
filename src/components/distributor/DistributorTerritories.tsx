import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Map as MapIcon, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Territory {
  id: string;
  name: string;
  region: string;
  territory_type: string | null;
  pincode_ranges: string[] | null;
}

interface Props {
  distributorId: string;
}

const typeColors: Record<string, string> = {
  'state': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'region': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'district': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'city': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'area': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const ITEMS_PER_PAGE = 5;

export function DistributorTerritories({ distributorId }: Props) {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [distributorName, setDistributorName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTerritories();

    // Real-time subscription for territories table (direct changes)
    const territoriesChannel = supabase
      .channel(`distributor-territories-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "territories",
        },
        () => loadTerritories()
      )
      .subscribe();

    // Changes in beats / retailer assignments can affect derived territory mapping
    const beatsChannel = supabase
      .channel(`distributor-territories-beats-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "beats",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadTerritories()
      )
      .subscribe();

    const mappingsChannel = supabase
      .channel(`distributor-territories-mappings-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "distributor_beat_mappings",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadTerritories()
      )
      .subscribe();

    const retailersByIdChannel = supabase
      .channel(`distributor-territories-retailers-by-id-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `distributor_id=eq.${distributorId}`,
        },
        () => loadTerritories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(territoriesChannel);
      supabase.removeChannel(beatsChannel);
      supabase.removeChannel(mappingsChannel);
      supabase.removeChannel(retailersByIdChannel);
    };
  }, [distributorId]);

  useEffect(() => {
    if (!distributorName) return;

    const encodedName = encodeURIComponent(distributorName);
    const retailersByParentChannel = supabase
      .channel(`distributor-territories-retailers-by-parent-${distributorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retailers",
          filter: `parent_name=eq.${encodedName}`,
        },
        () => loadTerritories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(retailersByParentChannel);
    };
  }, [distributorId, distributorName]);

  const loadTerritories = async () => {
    try {
      setLoading(true);

      // Fetch distributor details (name needed for legacy linkage)
      let name = distributorName;
      let distributorTerritoryId: string | null = null;
      const { data: dist, error: distError } = await supabase
        .from("distributors")
        .select("name, territory_id")
        .eq("id", distributorId)
        .maybeSingle();
      if (distError) throw distError;

      name = dist?.name ?? name ?? null;
      distributorTerritoryId = (dist as any)?.territory_id ?? null;
      if (name && name !== distributorName) setDistributorName(name);

      // Collect beat codes + territory_ids from linked retailers
      const beatCodes = new Set<string>();
      const territoryIds = new Set<string>();

      const { data: r1, error: r1Error } = await supabase
        .from("retailers")
        .select("beat_id, territory_id")
        .eq("distributor_id", distributorId);
      if (r1Error) throw r1Error;
      ((r1 as any[]) || []).forEach((r: any) => {
        if (r?.beat_id) beatCodes.add(r.beat_id);
        if (r?.territory_id) territoryIds.add(r.territory_id);
      });

      if (name) {
        const { data: r2, error: r2Error } = await supabase
          .from("retailers")
          .select("beat_id, territory_id")
          .eq("parent_name", name)
          .or("parent_type.eq.Distributor,parent_type.is.null");
        if (r2Error) throw r2Error;
        ((r2 as any[]) || []).forEach((r: any) => {
          if (r?.beat_id) beatCodes.add(r.beat_id);
          if (r?.territory_id) territoryIds.add(r.territory_id);
        });
      }

      if (distributorTerritoryId) territoryIds.add(distributorTerritoryId);

      // Explicit beat mappings (references beats.id)
      const { data: mappings, error: mappingsError } = await supabase
        .from("distributor_beat_mappings")
        .select("beat_id")
        .eq("distributor_id", distributorId);
      if (mappingsError) throw mappingsError;
      const mappedBeatRowIds = ((mappings as any[]) || []).map((m: any) => m.beat_id);

      // Fetch beats (direct + derived) to include their territory_id
      const beatRowsById = new Map<string, { territory_id: string | null }>();

      const { data: b1, error: b1Error } = await supabase
        .from("beats")
        .select("id, territory_id")
        .eq("distributor_id", distributorId);
      if (b1Error) throw b1Error;
      ((b1 as any[]) || []).forEach((b: any) =>
        beatRowsById.set(b.id, { territory_id: b.territory_id ?? null })
      );

      const derivedBeatCodes = Array.from(beatCodes);
      if (derivedBeatCodes.length > 0) {
        const { data: b2, error: b2Error } = await supabase
          .from("beats")
          .select("id, territory_id")
          .in("beat_id", derivedBeatCodes);
        if (b2Error) throw b2Error;
        ((b2 as any[]) || []).forEach((b: any) =>
          beatRowsById.set(b.id, { territory_id: b.territory_id ?? null })
        );
      }

      if (mappedBeatRowIds.length > 0) {
        const { data: b3, error: b3Error } = await supabase
          .from("beats")
          .select("id, territory_id")
          .in("id", mappedBeatRowIds);
        if (b3Error) throw b3Error;
        ((b3 as any[]) || []).forEach((b: any) =>
          beatRowsById.set(b.id, { territory_id: b.territory_id ?? null })
        );
      }

      Array.from(beatRowsById.values()).forEach((b) => {
        if (b.territory_id) territoryIds.add(b.territory_id);
      });

      // Fetch territories (1) by explicit ids, (2) via assigned_distributor_ids JSON contains
      const territoriesById = new Map<string, Territory>();

      const idsArray = Array.from(territoryIds);
      if (idsArray.length > 0) {
        const { data: byIds, error: byIdsError } = await supabase
          .from("territories")
          .select("id, name, region, territory_type, pincode_ranges")
          .in("id", idsArray)
          .order("name");
        if (byIdsError) throw byIdsError;
        ((byIds as any[]) || []).forEach((t: any) => territoriesById.set(t.id, t as Territory));
      }

      const { data: assigned, error: assignedError } = await supabase
        .from("territories")
        .select("id, name, region, territory_type, pincode_ranges")
        .filter("assigned_distributor_ids", "cs", `["${distributorId}"]`)
        .order("name");
      if (assignedError) throw assignedError;
      ((assigned as any[]) || []).forEach((t: any) => territoriesById.set(t.id, t as Territory));

      setTerritories(
        Array.from(territoriesById.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error: any) {
      toast.error("Failed to load territories: " + error.message);
      setTerritories([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const types = useMemo(() => {
    const t = new Set(territories.map(t => t.territory_type).filter(Boolean));
    return Array.from(t) as string[];
  }, [territories]);

  const regions = useMemo(() => {
    const r = new Set(territories.map(t => t.region).filter(Boolean));
    return Array.from(r) as string[];
  }, [territories]);

  // Filtered territories
  const filteredTerritories = useMemo(() => {
    return territories.filter(territory => {
      const matchesSearch = territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           territory.region?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || territory.territory_type === typeFilter;
      const matchesRegion = regionFilter === "all" || territory.region === regionFilter;
      return matchesSearch && matchesType && matchesRegion;
    });
  }, [territories, searchQuery, typeFilter, regionFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, regionFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTerritories.length / ITEMS_PER_PAGE);
  const paginatedTerritories = filteredTerritories.slice(
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
                <MapIcon className="h-4 w-4" />
                Territories ({filteredTerritories.length})
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
                  placeholder="Search territories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex gap-2">
                {types.length > 0 && (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[120px] h-9">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {types.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {regions.length > 0 && (
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredTerritories.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {territories.length === 0 ? "No territories assigned" : "No territories match your filters"}
                </p>
                {territories.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign this distributor to territories in Territory Master
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedTerritories.map(territory => (
                    <div
                      key={territory.id}
                      className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/territory/${territory.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <MapIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-primary hover:underline">{territory.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">{territory.region}</Badge>
                            {territory.territory_type && (
                              <Badge className={`text-xs capitalize ${typeColors[territory.territory_type] || 'bg-gray-100'}`}>
                                {territory.territory_type}
                              </Badge>
                            )}
                            {territory.pincode_ranges && territory.pincode_ranges.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {territory.pincode_ranges.length} pincodes
                              </span>
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