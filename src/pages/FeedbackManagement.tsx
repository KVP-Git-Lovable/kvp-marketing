import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trophy, Image, Users, Calendar, Filter, RefreshCw, Eye, Settings, BarChart3, Inbox, Activity } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RetailerFeedbackDetailModal } from "@/components/admin/RetailerFeedbackDetailModal";
import { CompetitionDetailModal } from "@/components/admin/CompetitionDetailModal";
import { BrandingRequestDetailModal } from "@/components/admin/BrandingRequestDetailModal";
import { JointSalesDetailModal } from "@/components/admin/JointSalesDetailModal";
import FeedbackQuestionConfig from "@/components/admin/FeedbackQuestionConfig";
import FeedbackPolicyConfig from "@/components/admin/FeedbackPolicyConfig";

type DetailModalType = 'retailer' | 'branding' | 'competition' | 'jointsales' | null;

/** `product_feedback` is a database value, not something to show a person. */
const humanLabel = (v?: string | null) =>
  v ? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

export default function FeedbackManagement() {
  const navigate = useNavigate();
  const { hasAdminAccess } = useAdminAccess();
  const [topTab, setTopTab] = useState("overview");
  
  const [retailerFeedback, setRetailerFeedback] = useState<any[]>([]);
  const [competitionData, setCompetitionData] = useState<any[]>([]);
  const [brandingRequests, setBrandingRequests] = useState<any[]>([]);
  const [jointSalesFeedback, setJointSalesFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter state
  const [dateRange, setDateRange] = useState<string>("30days");
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  // Detail modal state
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [detailModalType, setDetailModalType] = useState<DetailModalType>(null);

  const handleOpenDetail = (type: DetailModalType, data: any) => {
    setDetailModalType(type);
    setSelectedDetail(data);
  };

  const handleCloseDetail = () => {
    setDetailModalType(null);
    setSelectedDetail(null);
  };

  useEffect(() => {
    if (!hasAdminAccess) {
      navigate('/');
      return;
    }
    fetchAllFeedback();
  }, [hasAdminAccess, navigate]);

  useEffect(() => {
    if (hasAdminAccess) {
      fetchAllFeedback();
    }
  }, [startDate, endDate, hasAdminAccess]);

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    const now = new Date();
    switch (value) {
      case "30days":
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case "90days":
        setStartDate(subDays(now, 90));
        setEndDate(now);
        break;
      case "all":
        setStartDate(undefined);
        setEndDate(undefined);
        break;
      case "custom":
        // Keep current dates for custom selection
        break;
    }
  };

  const fetchAllFeedback = async () => {
    try {
      setLoading(true);

      const dateFilter = startDate && endDate 
        ? { 
            gte: startOfDay(startDate).toISOString(),
            lte: endOfDay(endDate).toISOString()
          }
        : null;

      // Fetch all data in parallel
      const [feedbackResult, competitionResult, brandingResult, jointSalesResult] = await Promise.all([
        fetchRetailerFeedback(dateFilter),
        fetchCompetitionData(dateFilter),
        fetchBrandingRequests(dateFilter),
        fetchJointSalesFeedback(dateFilter)
      ]);

      setRetailerFeedback(feedbackResult);
      setCompetitionData(competitionResult);
      setBrandingRequests(brandingResult);
      setJointSalesFeedback(jointSalesResult);

    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast({
        title: "Error",
        description: "Failed to load feedback data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRetailerFeedback = async (dateFilter: { gte: string; lte: string } | null): Promise<any[]> => {
    let query = supabase
      .from('retailer_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.gte).lte('created_at', dateFilter.lte);
    }

    const { data: feedbackData, error } = await query;
    if (error) throw error;
    if (!feedbackData || feedbackData.length === 0) return [];

    const retailerIds = [...new Set(feedbackData.map(f => f.retailer_id).filter(Boolean))];
    const userIds = [...new Set(feedbackData.map(f => f.user_id).filter(Boolean))];

    const [retailersResult, profilesResult] = await Promise.all([
      retailerIds.length > 0 ? supabase.from('retailers').select('id, name, address').in('id', retailerIds) : Promise.resolve({ data: [] }),
      userIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] })
    ]);

    const retailerMap = new Map((retailersResult.data || []).map((r: any) => [r.id, r]));
    const profileMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p.full_name]));

    return feedbackData.map(f => ({
      ...f,
      retailer_name: (retailerMap.get(f.retailer_id) as any)?.name || 'Unknown',
      retailer_address: (retailerMap.get(f.retailer_id) as any)?.address || null,
      submitted_by: profileMap.get(f.user_id) || 'Unknown'
    }));
  };

  const fetchCompetitionData = async (dateFilter: { gte: string; lte: string } | null): Promise<any[]> => {
    let query = supabase
      .from('competition_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.gte).lte('created_at', dateFilter.lte);
    }

    const { data: compData, error } = await query;
    if (error) throw error;

    if (!compData || compData.length === 0) return [];

    // Get unique IDs
    const retailerIds = [...new Set(compData.map(c => c.retailer_id).filter(Boolean))];
    const userIds = [...new Set(compData.map(c => c.user_id).filter(Boolean))];
    const competitorIds = [...new Set(compData.map(c => c.competitor_id).filter(Boolean))];
    const skuIds = [...new Set(compData.map(c => c.sku_id).filter(Boolean))] as string[];

    // Fetch related data in parallel
    const [retailersResult, profilesResult, competitorsResult, skusResult] = await Promise.all([
      retailerIds.length > 0 
        ? supabase.from('retailers').select('id, name').in('id', retailerIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      userIds.length > 0 
        ? supabase.from('profiles').select('id, full_name').in('id', userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      competitorIds.length > 0 
        ? supabase.from('competition_master').select('id, competitor_name').in('id', competitorIds)
        : Promise.resolve({ data: [] as { id: string; competitor_name: string }[] }),
      skuIds.length > 0 
        ? supabase.from('competition_skus').select('id, sku_name').in('id', skuIds)
        : Promise.resolve({ data: [] as { id: string; sku_name: string }[] })
    ]);

    const retailerMap = new Map<string, string>(
      (retailersResult.data || []).map(r => [r.id, r.name])
    );
    const profileMap = new Map<string, string>(
      (profilesResult.data || []).map(p => [p.id, p.full_name])
    );
    const competitorMap = new Map<string, string>(
      (competitorsResult.data || []).map(c => [c.id, c.competitor_name])
    );
    const skuMap = new Map<string, string>(
      (skusResult.data || []).map(s => [s.id, s.sku_name])
    );

    return compData.map(c => ({
      ...c,
      competitor_name: competitorMap.get(c.competitor_id) || 'Unknown',
      sku_name: c.sku_id ? (skuMap.get(c.sku_id) || 'N/A') : 'N/A',
      retailer_name: retailerMap.get(c.retailer_id) || 'Unknown',
      submitted_by: profileMap.get(c.user_id) || 'Unknown'
    }));
  };

  const fetchBrandingRequests = async (dateFilter: { gte: string; lte: string } | null): Promise<any[]> => {
    let query = supabase
      .from('branding_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.gte).lte('created_at', dateFilter.lte);
    }

    const { data: brandingData, error } = await query;
    if (error) throw error;
    if (!brandingData || brandingData.length === 0) return [];

    const retailerIds = [...new Set(brandingData.map(b => b.retailer_id).filter(Boolean))];
    const userIds = [...new Set(brandingData.map(b => b.user_id).filter(Boolean))];

    const [retailersResult, profilesResult] = await Promise.all([
      retailerIds.length > 0 ? supabase.from('retailers').select('id, name, address').in('id', retailerIds) : Promise.resolve({ data: [] }),
      userIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] })
    ]);

    const retailerMap = new Map((retailersResult.data || []).map((r: any) => [r.id, r]));
    const profileMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p.full_name]));

    return brandingData.map(b => ({
      ...b,
      retailer_name: (retailerMap.get(b.retailer_id) as any)?.name || 'Unknown',
      retailer_address: (retailerMap.get(b.retailer_id) as any)?.address || null,
      submitted_by: profileMap.get(b.user_id) || 'Unknown'
    }));
  };

  const fetchJointSalesFeedback = async (dateFilter: { gte: string; lte: string } | null): Promise<any[]> => {
    let query = supabase
      .from('joint_sales_feedback')
      .select('*')
      .order('feedback_date', { ascending: false });

    if (dateFilter) {
      query = query.gte('feedback_date', dateFilter.gte.split('T')[0]).lte('feedback_date', dateFilter.lte.split('T')[0]);
    }

    const { data: jsData, error } = await query;
    if (error) throw error;

    if (!jsData || jsData.length === 0) return [];

    // Get unique IDs
    const retailerIds = [...new Set(jsData.map(j => j.retailer_id).filter(Boolean))];
    const fseIds = [...new Set(jsData.map(j => j.fse_user_id).filter(Boolean))];
    const managerIds = [...new Set(jsData.map(j => j.manager_id).filter(Boolean))];
    const allUserIds = [...new Set([...fseIds, ...managerIds])];

    // Fetch related data in parallel
    const [retailersResult, profilesResult] = await Promise.all([
      retailerIds.length > 0 
        ? supabase.from('retailers').select('id, name').in('id', retailerIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      allUserIds.length > 0 
        ? supabase.from('profiles').select('id, full_name').in('id', allUserIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] })
    ]);

    const retailerMap = new Map<string, string>(
      (retailersResult.data || []).map(r => [r.id, r.name])
    );
    const profileMap = new Map<string, string>(
      (profilesResult.data || []).map(p => [p.id, p.full_name])
    );

    return jsData.map(j => ({
      ...j,
      retailer_name: retailerMap.get(j.retailer_id) || 'Unknown',
      fse_name: profileMap.get(j.fse_user_id) || 'Unknown',
      manager_name: profileMap.get(j.manager_id) || 'Unknown',
    }));
  };

  const getImpactBadge = (level: string | null) => {
    if (!level) return "bg-muted text-muted-foreground";
    const colors: Record<string, string> = {
      high: "bg-destructive text-destructive-foreground",
      medium: "bg-warning text-warning-foreground",
      low: "bg-muted text-muted-foreground"
    };
    return colors[level.toLowerCase()] || colors.low;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "border-primary/20 bg-primary/10 text-primary",
      approved: "border-success/20 bg-success/10 text-success",
      rejected: "border-destructive/20 bg-destructive/10 text-destructive",
      in_progress: "border-warning/30 bg-warning/15 text-warning-foreground",
      completed: "border-success/20 bg-success/10 text-success"
    };
    return colors[status] || "border-border bg-muted text-muted-foreground";
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 4) return "text-success";
    if (score >= 3) return "text-warning-foreground";
    return "text-destructive";
  };

  const totalRecords = retailerFeedback.length + competitionData.length + brandingRequests.length + jointSalesFeedback.length;

  const feedbackCategories = [
    { value: "retailer", label: "Retailer", count: retailerFeedback.length, icon: MessageSquare },
    { value: "competition", label: "Competition", count: competitionData.length, icon: Trophy },
    { value: "branding", label: "Branding", count: brandingRequests.length, icon: Image },
    { value: "jointsales", label: "Joint Sales", count: jointSalesFeedback.length, icon: Users },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Feedback Management</h1>
              <p className="mt-1 text-sm text-muted-foreground">Review field feedback and control how teams collect it.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchAllFeedback}
            disabled={loading}
            className="self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Top-level Tabs: Overview | Configuration */}
        <Tabs value={topTab} onValueChange={setTopTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1 sm:w-fit sm:min-w-[430px]">
            <TabsTrigger value="overview" className="flex min-h-10 items-center gap-2 px-4">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="configuration" className="flex min-h-10 items-center gap-2 px-4">
              <Settings className="h-4 w-4" />
              Feedback Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
        {/* Date Filter */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total records</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{totalRecords}</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div>
            </div>
          </div>
          {feedbackCategories.map(({ value, label, count, icon: Icon }) => (
            <div key={value} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
                </div>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Icon className="h-4 w-4" /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 pr-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date range</span>
            </div>
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>

            {dateRange === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
        </div>
        {/* Tabs */}
        <Tabs defaultValue="retailer" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 md:grid-cols-4">
            {feedbackCategories.map(({ value, label, count, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex min-h-10 items-center gap-2 px-2">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-background px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground shadow-sm">{count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Retailer Feedback Tab */}
          <TabsContent value="retailer">
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-4">
                <div><h2 className="text-base font-semibold">Retailer Feedback</h2><p className="mt-0.5 text-xs text-muted-foreground">Feedback captured during retailer visits</p></div>
                <span className="text-xs font-medium text-muted-foreground">{retailerFeedback.length} records</span>
              </div>
              {loading ? (
                <p className="text-center py-12 text-sm text-muted-foreground">Loading feedback…</p>
              ) : retailerFeedback.length === 0 ? (
                <div className="grid place-items-center px-6 py-14 text-center"><Inbox className="mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">No feedback records found</p><p className="mt-1 text-xs text-muted-foreground">Try selecting a wider date range.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Retailer</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retailerFeedback.map((feedback) => (
                        <TableRow 
                          key={feedback.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenDetail('retailer', feedback)}
                        >
                          <TableCell className="font-medium">
                            {feedback.retailer_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{feedback.submitted_by}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-[11.5px] text-muted-foreground rounded border px-1.5 py-[2px]">
                              {humanLabel(feedback.feedback_type)}
                            </span>
                          </TableCell>
                          {/* retailer feedback stores its value in `score` (out of 10);
                              `rating` is only set by older rows, so it is the fallback */}
                          <TableCell className="text-right tabular-nums">
                            {feedback.score != null ? (
                              <span className={getScoreColor(Number(feedback.score))}>
                                {Number(feedback.score)}<span className="text-muted-foreground">/10</span>
                              </span>
                            ) : feedback.rating ? (
                              <span className={getScoreColor(feedback.rating)}>
                                {feedback.rating}<span className="text-muted-foreground">/5</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {feedback.summary_notes || feedback.comments || (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(feedback.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Competition Data Tab */}
          <TabsContent value="competition">
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-4"><div><h2 className="text-base font-semibold">Competition Data</h2><p className="mt-0.5 text-xs text-muted-foreground">Market observations reported by field teams</p></div><span className="text-xs font-medium text-muted-foreground">{competitionData.length} records</span></div>
              {loading ? (
                <p className="text-center py-12 text-sm text-muted-foreground">Loading competition data…</p>
              ) : competitionData.length === 0 ? (
                <div className="grid place-items-center px-6 py-14 text-center"><Inbox className="mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">No competition data found</p><p className="mt-1 text-xs text-muted-foreground">Try selecting a wider date range.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Retailer</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Competitor</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Impact</TableHead>
                        <TableHead>Insight</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitionData.map((data) => (
                        <TableRow 
                          key={data.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenDetail('competition', data)}
                        >
                          <TableCell className="font-medium">
                            {data.retailer_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{data.submitted_by}</Badge>
                          </TableCell>
                          <TableCell>{data.competitor_name}</TableCell>
                          <TableCell>{data.sku_name}</TableCell>
                          <TableCell>
                            {data.selling_price ? `₹${data.selling_price}` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {data.stock_quantity ?? 'N/A'}
                          </TableCell>
                          <TableCell>
                            {data.impact_level && (
                              <Badge className={getImpactBadge(data.impact_level)}>
                                {data.impact_level}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {data.insight || 'N/A'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(data.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Branding Requests Tab */}
          <TabsContent value="branding">
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-4"><div><h2 className="text-base font-semibold">Branding Requests</h2><p className="mt-0.5 text-xs text-muted-foreground">Retail visibility and asset requests</p></div><span className="text-xs font-medium text-muted-foreground">{brandingRequests.length} records</span></div>
              {loading ? (
                <p className="text-center py-12 text-sm text-muted-foreground">Loading branding requests…</p>
              ) : brandingRequests.length === 0 ? (
                <div className="grid place-items-center px-6 py-14 text-center"><Inbox className="mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">No branding requests found</p><p className="mt-1 text-xs text-muted-foreground">Try selecting a wider date range.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Retailer</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Assets</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandingRequests.map((request) => (
                        <TableRow 
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenDetail('branding', request)}
                        >
                          <TableCell className="font-medium">
                            {request.retailer_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{request.submitted_by}</Badge>
                          </TableCell>
                          <TableCell>{request.title || 'Untitled'}</TableCell>
                          <TableCell>{request.requested_assets || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(request.status)}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.description || 'No description'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(request.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Joint Sales Feedback Tab */}
          <TabsContent value="jointsales">
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-4"><div><h2 className="text-base font-semibold">Joint Sales Feedback</h2><p className="mt-0.5 text-xs text-muted-foreground">Manager and field-team visit observations</p></div><span className="text-xs font-medium text-muted-foreground">{jointSalesFeedback.length} records</span></div>
              {loading ? (
                <p className="text-center py-12 text-sm text-muted-foreground">Loading joint sales feedback…</p>
              ) : jointSalesFeedback.length === 0 ? (
                <div className="grid place-items-center px-6 py-14 text-center"><Inbox className="mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">No joint sales feedback found</p><p className="mt-1 text-xs text-muted-foreground">Try selecting a wider date range.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Retailer</TableHead>
                        <TableHead>FSE Name</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Branding</TableHead>
                        <TableHead>Competition</TableHead>
                        <TableHead>Schemes</TableHead>
                        <TableHead>Growth</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jointSalesFeedback.map((feedback) => (
                        <TableRow 
                          key={feedback.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenDetail('jointsales', feedback)}
                        >
                          <TableCell className="font-medium">
                            {feedback.retailer_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{feedback.fse_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{feedback.manager_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className={getScoreColor(feedback.product_feedback_rating)}>
                              {feedback.product_feedback_rating ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getScoreColor(feedback.branding_rating)}>
                              {feedback.branding_rating ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getScoreColor(feedback.competition_rating)}>
                              {feedback.competition_rating ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getScoreColor(feedback.schemes_rating)}>
                              {feedback.schemes_rating ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getScoreColor(feedback.future_growth_rating)}>
                              {feedback.future_growth_rating ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(feedback.feedback_date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration">
            <div className="space-y-10 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex items-start gap-3 border-b pb-5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Settings className="h-4 w-4" /></div>
                <div><h2 className="text-base font-semibold">Feedback Configuration</h2><p className="mt-1 text-sm text-muted-foreground">Manage the questions teams see and the rules that decide when feedback is required.</p></div>
              </div>
              <FeedbackQuestionConfig />
              <FeedbackPolicyConfig />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modals */}
      <RetailerFeedbackDetailModal
        open={detailModalType === 'retailer'}
        onClose={handleCloseDetail}
        data={detailModalType === 'retailer' ? selectedDetail : null}
      />
      <CompetitionDetailModal
        open={detailModalType === 'competition'}
        onClose={handleCloseDetail}
        data={detailModalType === 'competition' ? selectedDetail : null}
      />
      <BrandingRequestDetailModal
        open={detailModalType === 'branding'}
        onClose={handleCloseDetail}
        data={detailModalType === 'branding' ? selectedDetail : null}
        onUpdate={fetchAllFeedback}
      />
      <JointSalesDetailModal
        open={detailModalType === 'jointsales'}
        onClose={handleCloseDetail}
        data={detailModalType === 'jointsales' ? selectedDetail : null}
      />
      </div>
    </Layout>
  );
}
