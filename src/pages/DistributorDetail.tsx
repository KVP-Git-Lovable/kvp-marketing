import { useState, useEffect } from "react";
import { fullNameProps } from "@/lib/displayName";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Edit, 
  Trash2, 
  Building2, 
  Phone, 
  Mail, 
  MapPin,
  Calendar,
  Users,
  Truck,
  FileText,
  Store,
  BadgeCheck,
  PackageCheck,
  ShoppingCart,
  UserCircle,
  KeyRound,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from '@/integrations/supabase/db';
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DistributorAttachments } from "@/components/distributor/DistributorAttachments";
import { DistributorNetwork } from "@/components/distributor/DistributorNetwork";
import { DistributorInvoiceSettings } from "@/components/distributor/DistributorInvoiceSettings";
import { DistributorAddresses } from "@/components/distributor/DistributorAddresses";
import { DistributorInvoiceIdentity } from "@/components/distributor/DistributorInvoiceIdentity";
import { DistributorSalesmenDialog } from "@/components/distributor/DistributorSalesmenDialog";
import { TILE_TONES } from "@/components/distributor/tileTones";
import { DistributorFYPlan } from "@/components/distributor/DistributorFYPlan";
import { DistributorPortalUsers } from "@/components/distributor/DistributorPortalUsers";
import { DistributorPriceBooks } from "@/components/distributor/DistributorPriceBooks";
import { DistributorPrimaryOrders } from "@/components/distributor/DistributorPrimaryOrders";
import { DistributorPrimaryAnalytics } from "@/components/distributor/DistributorPrimaryAnalytics";
import { DistributorEvaluationTasks } from "@/components/distributor/DistributorEvaluationTasks";
import { DistributorContactsList } from "@/components/distributor/DistributorContactsList";
import { DistributorSecondaryOrders } from "@/components/distributor/DistributorSecondaryOrders";
import DistributorCompanyProfile from "@/components/distributor/DistributorCompanyProfile";
import { PaymentCreditTab } from "@/components/distributor/PaymentCreditTab";
import { deleteDistributor, DISTRIBUTOR_DELETE_PERMISSION } from "@/utils/deleteDistributor";
import { usePermissions } from "@/hooks/usePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Distributor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  status: string;
  distribution_level: string | null;
  partnership_status: string | null;
  established_year: number | null;
  distribution_experience_years: number | null;
  sales_team_size: number | null;
  assets_vans: number | null;
  assets_trucks: number | null;
  network_retailers_count: number | null;
  region_coverage: string | null;
  onboarding_date: string | null;
  years_of_relationship: number | null;
  products_distributed: string[] | null;
  other_products: string[] | null;
  competition_products: string[] | null;
  strength: string | null;
  weakness: string | null;
  opportunities: string | null;
  threats: string | null;
  about_business: string | null;
  parent_id: string | null;
  type_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
}

/** Everything the overview strip needs, counted by the database in one call. */
interface OverviewSummary {
  primary_orders_count: number;
  primary_orders_value: number;
  primary_last_order_date: string | null;
  secondary_orders_count: number;
  secondary_orders_value: number;
  retailers_count: number;
  portal_users_count: number;
  portal_users_active: number;
  salesmen_count: number;
  salesmen_assigned: number;
  sales_team_claimed: number | null;
  vans_count: number;
  onboarding_total: number;
  onboarding_done: number;
  onboarding_blocked: number;
}

const statusColors: Record<string, string> = {
  'initial_connect': 'bg-gray-100 text-gray-800',
  'evaluation': 'bg-yellow-100 text-yellow-800',
  'strong_candidate': 'bg-blue-100 text-blue-800',
  'documentation': 'bg-purple-100 text-purple-800',
  'onboarded': 'bg-green-100 text-green-800',
  'active': 'bg-green-100 text-green-800',
  'inactive': 'bg-red-100 text-red-800',
  'drop': 'bg-red-100 text-red-800',
};

const partnershipColors: Record<string, string> = {
  'platinum': 'bg-gradient-to-r from-slate-400 to-slate-600 text-white',
  'gold': 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
  'silver': 'bg-gradient-to-r from-gray-300 to-gray-500 text-white',
  'registered': 'bg-gray-100 text-gray-800',
};

/**
 * One tone per snapshot tile. Tailwind needs the full class names in the
 * source, so these are written out rather than built from the tone name.
 */
const levelLabels: Record<string, string> = {
  'super_stockist': 'Super Stockist',
  'distributor': 'Distributor',
  'sub_distributor': 'Sub-Distributor',
  'agent': 'Agent',
};

export default function DistributorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [parentDistributor, setParentDistributor] = useState<{name: string} | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  /** Retailers actually pointing at this distributor. The card used to show
   *  network_retailers_count, a number typed into the profile form, under the
   *  label "Retailers" — so a distributor with ten retailers could read 0 and
   *  look safe to delete. null while it is still being counted. */
  const [retailerCount, setRetailerCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  /** Live onboarding progress, pushed up by the checklist card so the header
   *  tick turns green the moment the last step settles — without a reload. */
  const [onboarding, setOnboarding] = useState<{ done: number; total: number; blocked: number } | null>(null);
  const [salesmenOpen, setSalesmenOpen] = useState(false);
  const [focusRep, setFocusRep] = useState<{ id: string; name: string } | null>(null);
  // Mirrors the RLS policy, same as the Distributor Master list.
  const { can, loading: permsLoading } = usePermissions();
  const canDelete = can(DISTRIBUTOR_DELETE_PERMISSION.object, "delete");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) {
      loadDistributor();
    }
  }, [id]);

  const loadDistributor = async () => {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDistributor(data);

      // Counted by the database, not here: retailers_select scopes rows to the
      // viewer's own retailers and beats, so counting them straight from this
      // screen reports 0 for a distributor with ten of them — the same lie the
      // profile-form number told, in a new place.
      const { data: count, error: countError } = await supabase
        .rpc('distributor_retailer_count', { p_distributor_id: id });
      // A failed count stays null and shows as a dash rather than as zero,
      // which is the whole point of this field.
      if (!countError) setRetailerCount(Number(count ?? 0));

      // Orders, vans, portal users and onboarding progress, all counted by the
      // database for the same reason. A failure leaves the strip on dashes.
      const { data: sum, error: sumError } = await supabase
        .rpc('distributor_overview_summary', { p_distributor_id: id });
      if (!sumError && sum) setSummary(sum as unknown as OverviewSummary);

      // The type decides whether "follow the Company Profile" is on offer.
      if ((data as any)?.type_id) {
        const { data: t } = await supabase
          .from('distributor_types')
          .select('code')
          .eq('id', (data as any).type_id)
          .maybeSingle();
        setTypeCode((t as any)?.code ?? null);
      } else {
        setTypeCode(null);
      }

      // Load parent if exists
      if (data.parent_id) {
        const { data: parent } = await supabase
          .from('distributors')
          .select('name')
          .eq('id', data.parent_id)
          .single();
        setParentDistributor(parent);
      }
    } catch (error: any) {
      toast.error("Failed to load distributor: " + error.message);
      navigate('/distributor-master');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!distributor) return;
    
    const result = await deleteDistributor(distributor);

    if (!result.ok) {
      toast.error(result.reason, { duration: 10000 });
      return;
    }

    toast.success("Distributor moved to recycle bin");
    navigate('/distributor-master');
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  // The checklist card is the live source once it has mounted; the summary RPC
  // is what we have before that, so the tick does not flicker in on load.
  const onboardingTotal = onboarding?.total ?? summary?.onboarding_total ?? 0;
  const onboardingDone = onboarding?.done ?? summary?.onboarding_done ?? 0;
  const onboardingBlocked = onboarding?.blocked ?? summary?.onboarding_blocked ?? 0;
  const fullyOnboarded = onboardingTotal > 0 && onboardingDone === onboardingTotal;
  const onboardingPct = onboardingTotal > 0 ? Math.round((onboardingDone / onboardingTotal) * 100) : 0;

  /** Rupees, short enough to sit in a tile: 87,673 -> Rs 87.7K, 1.2 crore -> Rs 1.2Cr. */
  const money = (n: number | null | undefined) => {
    const v = Number(n ?? 0);
    if (v >= 10000000) return `Rs ${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `Rs ${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `Rs ${(v / 1000).toFixed(1)}K`;
    return `Rs ${v.toLocaleString('en-IN')}`;
  };

  const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN'));

  if (loading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  if (!distributor) {
    return (
      <Layout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Distributor not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate" {...fullNameProps(distributor.name)} />
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {distributor.distribution_level && (
                  <Badge variant="outline" className="text-xs">
                    {levelLabels[distributor.distribution_level] || distributor.distribution_level}
                  </Badge>
                )}
                <Badge className={`text-xs ${statusColors[distributor.status] || 'bg-gray-100'}`}>
                  {formatStatus(distributor.status)}
                </Badge>
                {distributor.partnership_status && (
                  <Badge className={`text-xs ${partnershipColors[distributor.partnership_status] || 'bg-gray-100'}`}>
                    {distributor.partnership_status.charAt(0).toUpperCase() + distributor.partnership_status.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Onboarding, read at a glance: a green tick once everything is
              settled, otherwise the figure with the bar that explains it. */}
          <div className="hidden sm:flex items-center gap-3 shrink-0 mr-1">
            {fullyOnboarded ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-900 dark:bg-emerald-950">
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Fully onboarded</div>
                  <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">All {onboardingTotal} steps settled</div>
                </div>
              </div>
            ) : (
              <div className="w-52 rounded-lg border bg-card px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Onboarding</span>
                  <span className={`text-base font-semibold tabular-nums leading-none ${onboardingBlocked > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {onboardingTotal ? `${onboardingPct}%` : '—'}
                  </span>
                </div>
                {/* An explicit track, not bg-muted: at 0% the bar is invisible
                    against the card and the figure reads as broken. */}
                <div className="h-1.5 rounded-full overflow-hidden mt-1.5 bg-foreground/10">
                  <div
                    className={`h-full transition-all duration-500 ${onboardingBlocked > 0 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${onboardingPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  {onboardingTotal
                    ? `${onboardingDone} of ${onboardingTotal} steps done${onboardingBlocked > 0 ? ` · ${onboardingBlocked} stuck` : ''}`
                    : 'Not started'}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-1.5 shrink-0 ml-2">
            <Button variant="outline" size="icon" onClick={() => navigate(`/edit-distributor/${distributor.id}`)} className="h-8 w-8">
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              {/* No trigger at all for someone who may not delete: the HTML
                  hidden attribute loses to the button utility classes. */}
              {canDelete && !permsLoading && (
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              )}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Distributor?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{distributor.name}"? This will move the record to the recycle bin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* The record, as a record: labelled fields across the width rather
            than six lines stacked down the left edge of a wide screen. */}
        <Card>
          <CardContent className="p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-x-6 gap-y-4">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3 w-3 text-violet-500" /> Contact
                </dt>
                <dd className="text-sm mt-0.5 truncate">{distributor.contact_person || '—'}</dd>
              </div>

              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Phone className="h-3 w-3 text-emerald-500" /> Phone
                </dt>
                <dd className="text-sm mt-0.5 truncate">
                  <a href={`tel:${distributor.phone}`} className="text-primary hover:underline">{distributor.phone}</a>
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3 w-3 text-sky-500" /> Email
                </dt>
                <dd className="text-sm mt-0.5 truncate">
                  {distributor.email
                    ? <a href={`mailto:${distributor.email}`} className="text-primary hover:underline">{distributor.email}</a>
                    : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3 w-3 text-amber-500" /> GST
                </dt>
                <dd className="text-sm mt-0.5 truncate font-mono text-[13px]">
                  {distributor.gst_number || <span className="font-sans text-muted-foreground">—</span>}
                </dd>
              </div>

              <div className="min-w-0 sm:col-span-2 2xl:col-span-3">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3 w-3 text-rose-500" /> Address
                </dt>
                <dd className="text-sm mt-0.5 leading-snug">
                  {distributor.address || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Calendar className="h-3 w-3 text-teal-500" /> Relationship
                </dt>
                <dd className="text-sm mt-0.5">
                  {distributor.established_year || distributor.years_of_relationship ? (
                    <>
                      {distributor.established_year ? `Trading since ${distributor.established_year}` : ''}
                      {distributor.established_year && distributor.years_of_relationship ? <br /> : null}
                      {distributor.years_of_relationship ? (
                        <span className="text-muted-foreground">{distributor.years_of_relationship} years with us</span>
                      ) : null}
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>

              {parentDistributor && (
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-3 w-3 text-slate-500" /> Parent
                  </dt>
                  <dd className="text-sm mt-0.5 truncate">{parentDistributor.name}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => { if (v !== 'network') setFocusRep(null); setActiveTab(v); }}
        >
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-9 sm:w-full gap-1">
              <TabsTrigger value="overview" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Overview</TabsTrigger>
              <TabsTrigger value="primary-orders" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Primary</TabsTrigger>
              <TabsTrigger value="secondary-orders" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Secondary</TabsTrigger>
              <TabsTrigger value="network" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Network</TabsTrigger>
              <TabsTrigger value="portal" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Portal</TabsTrigger>
              <TabsTrigger value="pricing" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Pricing</TabsTrigger>
              <TabsTrigger value="payment-credit" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Payment & Credit</TabsTrigger>
              <TabsTrigger value="business" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">FY Plan</TabsTrigger>
              <TabsTrigger value="company-profile" className="relative text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground">Distributor Profile</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Business snapshot. Every figure here is counted by the database
                (distributor_overview_summary), not by this screen: retailers
                and orders are both RLS-scoped, so counting them client-side
                reports 0 to anyone who is not their owner.

                One tone per measure, carried by the icon chip and the figure
                rather than by a full colour wash, so six tiles in a row stay
                calm and the numbers still lead. */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {([
                {
                  key: 'primary', label: 'Primary orders', icon: PackageCheck, tone: 'violet',
                  value: summary ? num(summary.primary_orders_count) : '—',
                  sub: summary ? `${money(summary.primary_orders_value)} bought from us` : 'Loading',
                  tab: 'primary-orders', action: null,
                },
                {
                  key: 'secondary', label: 'Secondary orders', icon: ShoppingCart, tone: 'sky',
                  value: summary ? num(summary.secondary_orders_count) : '—',
                  sub: summary ? `${money(summary.secondary_orders_value)} sold onward` : 'Loading',
                  tab: 'secondary-orders', action: null,
                },
                {
                  key: 'retailers', label: 'Retailers', icon: Store, tone: 'emerald',
                  value: retailerCount === null ? '—' : num(retailerCount),
                  sub: 'Shops they serve',
                  tab: 'network', action: null,
                },
                {
                  key: 'vans', label: 'Vans', icon: Truck, tone: 'amber',
                  value: summary ? num(summary.vans_count) : '—',
                  sub: 'On the road'
                    + ((distributor.assets_vans || distributor.assets_trucks)
                        ? ` · ${(distributor.assets_vans || 0) + (distributor.assets_trucks || 0)} claimed on profile`
                        : ''),
                  tab: null, action: null,
                },
                {
                  // OUR reps serving this distributor's shops, reached the way
                  // the data already connects: retailer -> user_id, retailer ->
                  // distributor_id. Not the distributor's portal logins, which
                  // is what this counted before and is a different thing.
                  key: 'salesmen', label: 'Salesmen', icon: Users, tone: 'rose',
                  value: summary ? num(summary.salesmen_count) : '—',
                  sub: 'Serving their retailers'
                    + (summary?.sales_team_claimed
                        ? ` · ${summary.sales_team_claimed} claimed on profile`
                        : ''),
                  tab: null, action: 'salesmen',
                },
                {
                  key: 'portal', label: 'Portal logins', icon: KeyRound, tone: 'teal',
                  value: summary ? num(summary.portal_users_active) : '—',
                  sub: summary && summary.portal_users_count > summary.portal_users_active
                    ? `${summary.portal_users_count - summary.portal_users_active} inactive`
                    : 'Can sign in',
                  tab: 'portal', action: null,
                },
              ] as const).map((t) => {
                const tone = TILE_TONES[t.tone];
                const Icon = t.icon;
                const clickable = !!t.tab || !!t.action;
                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (t.action === 'salesmen') { setSalesmenOpen(true); return; }
                      if (t.tab) setActiveTab(t.tab);
                    }}
                    className={`group text-left rounded-xl border p-4 transition-all ${tone.surface} ${
                      clickable ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t.label}
                      </span>
                      <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${tone.chip}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className={`mt-2 text-2xl font-semibold tabular-nums leading-none ${tone.figure}`}>
                      {t.value}
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground leading-snug">{t.sub}</div>
                    {clickable && (
                      <div className={`mt-2 flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity ${tone.figure}`}>
                        Open <ArrowUpRight className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Who to call. The in-house owner is ours; the contact is theirs. */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Who is responsible</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                    <UserCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Our person</p>
                    <p className="text-sm font-medium truncate">
                      {distributor.owner_name || <span className="text-muted-foreground font-normal">Not assigned</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Handles this distributor in-house</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-sky-500/15 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Their contact</p>
                    <p className="text-sm font-medium truncate">{distributor.contact_person}</p>
                    <a href={`tel:${distributor.phone}`} className="text-xs text-primary">{distributor.phone}</a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Onboarding first: until this is finished it is the only thing
                anyone opening this screen actually needs to see. */}
            <DistributorEvaluationTasks
              distributorId={distributor.id}
              onProgress={setOnboarding}
            />

            {/* About Business */}
            {distributor.about_business && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">About the business</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{distributor.about_business}</p>
                </CardContent>
              </Card>
            )}


            {/* Products */}
            {(distributor.products_distributed?.length || distributor.other_products?.length) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {distributor.products_distributed?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Our Products</p>
                      <div className="flex flex-wrap gap-1">
                        {distributor.products_distributed.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {distributor.other_products?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Other Products</p>
                      <div className="flex flex-wrap gap-1">
                        {distributor.other_products.map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {distributor.competition_products?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Competition Products</p>
                      <div className="flex flex-wrap gap-1">
                        {distributor.competition_products.map((p, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SWOT */}
            {(distributor.strength || distributor.weakness || distributor.opportunities || distributor.threats) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">SWOT Analysis</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {distributor.strength && (
                    <div className="bg-green-50 dark:bg-green-950 p-2 rounded">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300">Strengths</p>
                      <p className="text-xs mt-1">{distributor.strength}</p>
                    </div>
                  )}
                  {distributor.weakness && (
                    <div className="bg-red-50 dark:bg-red-950 p-2 rounded">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">Weaknesses</p>
                      <p className="text-xs mt-1">{distributor.weakness}</p>
                    </div>
                  )}
                  {distributor.opportunities && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Opportunities</p>
                      <p className="text-xs mt-1">{distributor.opportunities}</p>
                    </div>
                  )}
                  {distributor.threats && (
                    <div className="bg-orange-50 dark:bg-orange-950 p-2 rounded">
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Threats</p>
                      <p className="text-xs mt-1">{distributor.threats}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* About Business already shown at top */}

            {/* Contacts and documents sit side by side: both are usually empty
                early on, and two near-empty full-width cards read as a fault. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <DistributorContactsList distributorId={distributor.id} />
              <DistributorAttachments distributorId={distributor.id} />
            </div>
          </TabsContent>

          <TabsContent value="primary-orders" className="mt-4 space-y-4">
            <DistributorPrimaryAnalytics
              distributorId={distributor.id}
              distributorName={distributor.name}
            />
            <DistributorPrimaryOrders distributorId={distributor.id} />
          </TabsContent>

          <TabsContent value="secondary-orders" className="mt-4">
            <DistributorSecondaryOrders distributorId={distributor.id} />
          </TabsContent>

          <TabsContent value="network" className="mt-4">
            <DistributorNetwork distributorId={distributor.id} focusRep={focusRep} />
          </TabsContent>

          <TabsContent value="portal" className="mt-4">
            <DistributorPortalUsers 
              distributorId={distributor.id} 
              distributorName={distributor.name} 
            />
          </TabsContent>

          <TabsContent value="pricing" className="mt-4">
            <DistributorPriceBooks distributorId={distributor.id} />
          </TabsContent>

          <TabsContent value="payment-credit" className="mt-4">
            <PaymentCreditTab distributorId={distributor.id} />
          </TabsContent>

          <TabsContent value="business" className="mt-4">
            <DistributorFYPlan distributorId={distributor.id} />
          </TabsContent>

          <TabsContent value="company-profile" className="mt-4 space-y-4">
            <DistributorInvoiceIdentity
              distributorId={distributor.id}
              typeCode={typeCode}
              onChanged={loadDistributor}
            />
            <DistributorAddresses distributorId={distributor.id} />
            <DistributorInvoiceSettings distributorId={distributor.id} />
            <DistributorCompanyProfile distributorId={distributor.id} readOnly />
          </TabsContent>
        </Tabs>
      </div>

      <DistributorSalesmenDialog
        distributorId={distributor.id}
        distributorName={distributor.name}
        open={salesmenOpen}
        onOpenChange={setSalesmenOpen}
        onPick={(rep) => { setFocusRep(rep); setActiveTab('network'); }}
      />
    </Layout>
  );
}