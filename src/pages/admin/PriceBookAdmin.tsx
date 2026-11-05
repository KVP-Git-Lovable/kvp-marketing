import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/db';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTableQuery, type TableColumn } from '@/lib/tableKit';
import { TableToolbar } from '@/components/table/TableToolbar';
import { SortableHead } from '@/components/table/SortableHead';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Search, BookOpen, Calendar, Copy, Edit, MoreVertical, Building2, Store, Calculator, AlertTriangle, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchAllPaginated } from '@/utils/fetchAllPaginated';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PriceBookFeatureToggle } from '@/components/pricebooks/PriceBookFeatureToggle';
import { PriceBookWarnings, type PriceBookWarning } from '@/components/pricebooks/PriceBookWarnings';
import { PriceBookSetupChecklist } from '@/components/pricebooks/PriceBookSetupChecklist';

interface PriceBook {
  id: string;
  name: string;
  description: string | null;
  price_book_type: string;
  target_type: string;
  currency: string;
  is_standard: boolean;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  territory_id: string | null;
  apply_to_all_territories: boolean;
  distributor_category: string | null;
  cloned_from: string | null;
  created_at: string;
  territory?: { name: string } | null;
  entries_count?: number;
  assigned_count?: number;
  retailer_id?: string | null;
  code?: string | null;
  region?: string | null;
}

interface Territory {
  id: string;
  name: string;
  zone?: string | null;
  region?: string | null;
}

const priceBookTypes = {
  distributor: [
    { value: 'standard', label: 'Standard Price Book' },
    { value: 'territory', label: 'Territory Price Book' },
    { value: 'distributor_category', label: 'Distributor Category Price Book' },
  ],
  retailer: [
    { value: 'standard', label: 'Standard Retailer Price Book' },
    { value: 'retailer_territory', label: 'Territory Price Book' },
  ]
};

/**
 * A distributor category, as the pricing resolver sees it.
 *
 * `resolve_prices_for_retailer` scores a book's `distributor_category` against
 * COALESCE(distributor_types.code, distributor_types.name, distributors.parent_type)
 * -- an exact string match. This list used to be four invented slugs
 * ('super_stockist', 'distributor', ...) that appear nowhere in
 * distributor_types, so every book built from it was scoped to a category no
 * distributor has and the category tier could never fire. The options now come
 * from the table the resolver actually reads.
 */
interface DistributorCategory {
  /** What gets stored on the book and compared by the resolver. */
  value: string;
  /** What the category is called on screen. */
  label: string;
}

const PriceBookAdmin = () => {
  const navigate = useNavigate();
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [distributorCategories, setDistributorCategories] = useState<DistributorCategory[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string }[]>([]);
  const [salespeople, setSalespeople] = useState<{ id: string; full_name: string | null }[]>([]);
  const [beats, setBeats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  /** Which side of the business to show. Primary = what distributors pay us
   *  (target_type 'distributor'); Secondary = what shops pay (target_type
   *  'retailer'). Both are loaded at once so the totals can compare them. */
  const [typeFilter, setTypeFilter] = useState<'all' | 'distributor' | 'retailer'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  /** The kind a NEW book will be, which the create form also shows. */
  const [activeTab, setActiveTab] = useState<'distributor' | 'retailer'>('distributor');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  /** Which page of the create wizard is showing (1-4). */
  const [wizardStep, setWizardStep] = useState(1);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [selectedPriceBook, setSelectedPriceBook] = useState<PriceBook | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_book_type: 'standard',
    target_type: 'distributor' as 'distributor' | 'retailer',
    currency: 'INR',
    is_standard: false,
    is_active: true,
    effective_from: '',
    effective_to: '',
    territory_id: '',
    apply_to_all_territories: true,
    distributor_category: '',
    retailer_id: '',
    user_id: '',
    beat_id: '',
    zone: '',
    region: '',
    code: '',
    restricts_catalogue: false,
  });

  useEffect(() => {
    fetchData();
  }, [activeFilter]);

  const fetchData = async () => {
    try {
      let query = supabase
        .from('price_books')
        .select(`
          *,
          territory:territories(name)
        `)
        .order('created_at', { ascending: false });

      if (activeFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (activeFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      const [priceBookRes, territoriesRes, currenciesRes, retailersRes, profilesRes, beatsRes, typesRes] = await Promise.all([
        query,
        supabase.from('territories').select('id, name, zone, region').order('name'),
        supabase.from('currencies').select('code, name').eq('is_active', true).order('code'),
        supabase.from('retailers').select('id, name').order('name').limit(1000),
        supabase.from('profiles').select('id, full_name').match(ACTIVE_PROFILE).order('full_name'),
        supabase.from('beats').select('id, name').order('name').limit(1000),
        supabase.from('distributor_types').select('code, name').order('name'),
      ]);

      if (priceBookRes.error) throw priceBookRes.error;
      if (territoriesRes.error) throw territoriesRes.error;

      // Get entry counts
      const priceBookIds = (priceBookRes.data || []).map(pb => pb.id);
      let countMap: Record<string, number> = {};
      
      if (priceBookIds.length > 0) {
        const { data: entryCounts } = await supabase
          .from('price_book_entries')
          .select('price_book_id')
          .in('price_book_id', priceBookIds);

        countMap = (entryCounts || []).reduce((acc, entry) => {
          acc[entry.price_book_id] = (acc[entry.price_book_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // How many distributors are actually on each book. A book nobody is
      // assigned to prices nothing, and the list gave no hint of that.
      let assignedMap: Record<string, number> = {};
      if (priceBookIds.length > 0) {
        const { data: links } = await supabase
          .from('distributor_price_books')
          .select('price_book_id')
          .in('price_book_id', priceBookIds)
          .eq('is_active', true);
        assignedMap = (links || []).reduce((acc: Record<string, number>, l: any) => {
          acc[l.price_book_id] = (acc[l.price_book_id] || 0) + 1;
          return acc;
        }, {});
      }

      const booksWithCounts = (priceBookRes.data || []).map(pb => ({
        ...pb,
        target_type: pb.target_type || 'distributor',
        apply_to_all_territories: pb.apply_to_all_territories ?? false,
        entries_count: countMap[pb.id] || 0,
        assigned_count: assignedMap[pb.id] || 0,
      }));

      setPriceBooks(booksWithCounts);
      setTerritories((territoriesRes.data as any[]) || []);
      setCurrencies(((currenciesRes.data as any[]) || []).length ? (currenciesRes.data as any[]) : [{ code: 'INR', name: 'Indian Rupee' }]);
      setRetailers((retailersRes.data as any[]) || []);
      setSalespeople((profilesRes.data as any[]) || []);
      setBeats((beatsRes.data as any[]) || []);
      // Mirror the resolver's COALESCE(code, name) so the value stored on a
      // book is the one it will later be compared against.
      setDistributorCategories(((typesRes.data as any[]) || [])
        .map((t) => ({ value: t.code || t.name, label: t.name || t.code }))
        .filter((t) => t.value));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load price books');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Price book name is required');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData: any = {
        name: formData.name,
        description: formData.description || null,
        price_book_type: formData.price_book_type,
        target_type: formData.target_type,
        currency: formData.currency,
        is_standard: formData.is_standard,
        is_active: formData.is_active,
        effective_from: formData.effective_from || null,
        effective_to: formData.effective_to || null,
        territory_id: formData.apply_to_all_territories ? null : (formData.territory_id || null),
        apply_to_all_territories: formData.apply_to_all_territories,
        distributor_category: formData.distributor_category || null,
        retailer_id: formData.retailer_id || null,
        user_id: formData.user_id || null,
        beat_id: formData.beat_id || null,
        zone: formData.zone || null,
        region: formData.region || null,
        code: formData.code.trim() || null,
        restricts_catalogue: formData.restricts_catalogue,
        created_by: user?.user?.id || null,
      };

      const { data: newPriceBook, error } = await supabase
        .from('price_books')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Auto-add all products to the price book
      const products = await fetchAllPaginated<any>((from, to) =>
        supabase
          .from('products')
          .select('id, rate, product_variants(id, price)')
          .eq('is_active', true)
          .range(from, to)
      );

      if (products && products.length > 0) {
        const entries: any[] = [];
        
        products.forEach((product: any) => {
          // Add base product
          entries.push({
            price_book_id: newPriceBook.id,
            product_id: product.id,
            variant_id: null,
            list_price: product.rate || 0,
            discount_percent: 0,
            final_price: product.rate || 0,
            min_quantity: 1,
          });

          // Add variants
          if (product.product_variants && product.product_variants.length > 0) {
            product.product_variants.forEach((variant: any) => {
              entries.push({
                price_book_id: newPriceBook.id,
                product_id: product.id,
                variant_id: variant.id,
                list_price: variant.price || product.rate || 0,
                discount_percent: 0,
                final_price: variant.price || product.rate || 0,
                min_quantity: 1,
              });
            });
          }
        });

        if (entries.length > 0) {
          await supabase.from('price_book_entries').insert(entries);
        }
      }

      toast.success('Price book created with all products');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating price book:', error);
      toast.error(error.message || 'Failed to create price book');
    }
  };

  const handleClone = async () => {
    if (!selectedPriceBook || !formData.name.trim()) {
      toast.error('Price book name is required');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: newPriceBook, error: createError } = await supabase
        .from('price_books')
        .insert({
          name: formData.name,
          description: formData.description || selectedPriceBook.description,
          price_book_type: formData.price_book_type,
          target_type: formData.target_type,
          currency: formData.currency || selectedPriceBook.currency,
          is_standard: false,
          is_active: formData.is_active,
          effective_from: formData.effective_from || null,
          effective_to: formData.effective_to || null,
          territory_id: formData.apply_to_all_territories ? null : (formData.territory_id || null),
          apply_to_all_territories: formData.apply_to_all_territories,
          distributor_category: formData.distributor_category || null,
          retailer_id: formData.retailer_id || null,
          user_id: formData.user_id || null,
          beat_id: formData.beat_id || null,
          zone: formData.zone || null,
          region: formData.region || null,
          cloned_from: selectedPriceBook.id,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Clone entries
      const { data: entries, error: entriesError } = await supabase
        .from('price_book_entries')
        .select('*')
        .eq('price_book_id', selectedPriceBook.id);

      if (entriesError) throw entriesError;

      if (entries && entries.length > 0) {
        const newEntries = entries.map(entry => ({
          price_book_id: newPriceBook.id,
          product_id: entry.product_id,
          variant_id: entry.variant_id,
          list_price: entry.list_price,
          discount_percent: entry.discount_percent,
          final_price: entry.final_price,
          min_quantity: entry.min_quantity,
          is_active: entry.is_active,
        }));

        const { error: insertError } = await supabase
          .from('price_book_entries')
          .insert(newEntries);

        if (insertError) throw insertError;
      }

      toast.success(`Price book cloned with ${entries?.length || 0} entries`);
      setIsCloneOpen(false);
      setSelectedPriceBook(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error cloning price book:', error);
      toast.error(error.message || 'Failed to clone price book');
    }
  };

  const toggleActive = async (priceBook: PriceBook) => {
    try {
      const { error } = await supabase
        .from('price_books')
        .update({ is_active: !priceBook.is_active })
        .eq('id', priceBook.id);

      if (error) throw error;
      toast.success(`Price book ${priceBook.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update price book');
    }
  };

  const openCloneDialog = (priceBook: PriceBook) => {
    setSelectedPriceBook(priceBook);
    setFormData({
      name: `${priceBook.name} - Copy`,
      description: priceBook.description || '',
      price_book_type: 'territory',
      target_type: priceBook.target_type as 'distributor' | 'retailer',
      currency: priceBook.currency,
      is_standard: false,
      is_active: true,
      effective_from: '',
      effective_to: '',
      territory_id: '',
      apply_to_all_territories: false,
      distributor_category: '',
      retailer_id: '',
      user_id: '',
      beat_id: '',
      zone: '',
      region: '',
      // A clone gets its own code, and does not inherit the original's
      // catalogue restriction until that is chosen deliberately.
      code: '',
      restricts_catalogue: false,
    });
    setIsCloneOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    // Start on the kind the list is filtered to, so the common case needs no
    // change; 'all' means no hint either way, so fall back to primary.
    setFormData(prev => ({
      ...prev,
      target_type: typeFilter === 'retailer' ? 'retailer' : 'distributor',
    }));
    setWizardStep(1);
    setIsCreateOpen(true);
  };

  const resetForm = () => {
    setWizardStep(1);
    setFormData({
      name: '',
      description: '',
      price_book_type: 'standard',
      target_type: activeTab,
      currency: 'INR',
      is_standard: false,
      is_active: true,
      effective_from: '',
      effective_to: '',
      territory_id: '',
      apply_to_all_territories: true,
      distributor_category: '',
      retailer_id: '',
      user_id: '',
      beat_id: '',
      zone: '',
      region: '',
      code: '',
      restricts_catalogue: false,
    });
  };

  const getTypeLabel = (type: string, targetType: string) => {
    const types = targetType === 'retailer' ? priceBookTypes.retailer : priceBookTypes.distributor;
    return types.find(t => t.value === type)?.label || type;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'standard': return 'bg-primary/10 text-primary';
      case 'territory': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'distributor_category': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'retailer_territory': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  /** Counts for the tiles, over every book loaded -- not the filtered view,
   *  or narrowing the table would quietly restate the totals. */
  const stats = useMemo(() => {
    const isPrimary = (b: PriceBook) => (b.target_type || 'distributor') !== 'retailer';
    const primary = priceBooks.filter(isPrimary);
    const secondary = priceBooks.filter((b) => !isPrimary(b));
    return {
      total: priceBooks.length,
      active: priceBooks.filter((b) => b.is_active).length,
      primary: primary.length,
      primaryActive: primary.filter((b) => b.is_active).length,
      secondary: secondary.length,
      secondaryActive: secondary.filter((b) => b.is_active).length,
      assignedPrimary: primary.reduce((n, b) => n + (b.assigned_count ?? 0), 0),
      assignedSecondary: secondary.reduce((n, b) => n + (b.assigned_count ?? 0), 0),
    };
  }, [priceBooks]);

  /** Regions actually used by a book, so the filter offers nothing empty. */
  const regionOptions = useMemo(
    () => Array.from(new Set(priceBooks.map((b) => b.region).filter(Boolean) as string[])).sort(),
    [priceBooks],
  );

  const filteredPriceBooks = priceBooks.filter(book => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q
      || book.name?.toLowerCase().includes(q)
      || book.code?.toLowerCase().includes(q)
      || book.description?.toLowerCase().includes(q);
    const kind = (book.target_type || 'distributor') === 'retailer' ? 'retailer' : 'distributor';
    const matchesType = typeFilter === 'all' || typeFilter === kind;
    const matchesRegion = regionFilter === 'all' || book.region === regionFilter;
    return matchesSearch && matchesType && matchesRegion;
  });

  /**
   * The list's columns, declared once.
   *
   * The table head, the sort, the column filters, the Excel sheet and the PDF
   * all read this, so a heading or a formatted value cannot say one thing on
   * screen and another in the download. `scopeText` and the rest mirror
   * exactly what the cells render.
   */
  const scopeText = (b: any) =>
    b.region
    || (b.apply_to_all_territories ? 'All territories'
      : b.territory?.name
      || (b.distributor_category ? b.distributor_category.replace(/_/g, ' ') : '—'));

  const effectiveText = (b: any) =>
    (b.effective_from ? format(new Date(b.effective_from), 'd MMM yyyy') : '—')
    + (b.effective_to ? ` – ${format(new Date(b.effective_to), 'd MMM yyyy')}` : '');

  const bookColumns: TableColumn<any>[] = useMemo(() => [
    { key: 'name', header: 'Price book', type: 'text',
      value: (b) => b.name ?? '', format: (b) => b.name ?? '' },
    { key: 'code', header: 'Code', type: 'text', exportOnly: true,
      value: (b) => b.code ?? '',
      format: (b) => b.code || getTypeLabel(b.price_book_type, b.target_type) || '' },
    { key: 'type', header: 'Type', type: 'enum',
      value: (b) => ((b.target_type || 'distributor') === 'retailer' ? 'Secondary' : 'Primary') },
    { key: 'fallback', header: 'Fallback', type: 'boolean', exportOnly: true,
      value: (b) => !!b.is_standard },
    { key: 'scope', header: 'Scope', type: 'enum', value: scopeText },
    { key: 'currency', header: 'Currency', type: 'enum', align: 'center',
      value: (b) => b.currency ?? '' },
    // Sorted and filtered on the start date; the cell shows the whole span.
    { key: 'effective', header: 'Effective', type: 'date',
      value: (b) => b.effective_from ?? null, format: effectiveText },
    { key: 'products', header: 'Products', type: 'number', align: 'right',
      value: (b) => Number(b.entries_count ?? 0) },
    { key: 'assigned', header: 'Assigned', type: 'number', align: 'right',
      value: (b) => Number(b.assigned_count ?? 0) },
    { key: 'status', header: 'Status', type: 'enum', align: 'center',
      value: (b) => (b.is_active ? 'Active' : 'Inactive') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [priceBookTypes]);

  /* Layered on top of the filters above: those narrow which books are in
     play, this sorts them and filters within a column. */
  const tq = useTableQuery(filteredPriceBooks, bookColumns);
  const visibleColumns = bookColumns.filter((c) => !c.exportOnly);

  const currentTypeOptions = formData.target_type === 'retailer' 
    ? priceBookTypes.retailer 
    : priceBookTypes.distributor;

  /** A category the resolver will never match is no scope at all.
   *
   *  Books created before the category dropdown was wired to distributor_types
   *  carry invented slugs, so they score as a plain fallback however narrow
   *  they look on screen. Only judged once the real categories have loaded. */
  const deadCategory = (b: PriceBook) =>
    !!b.distributor_category && distributorCategories.length > 0 &&
    !distributorCategories.some(c => c.value === b.distributor_category);

  /** Where a book sits in the ladder: two books with the same scope are
   *  ranked the same, so neither can be said to win on merit. */
  const scopeKey = (b: PriceBook) => [
    b.target_type || 'distributor',
    b.territory_id || '',
    b.retailer_id || '',
    deadCategory(b) ? '' : (b.distributor_category || ''),
  ].join('|');

  /** Other active fallback books aimed at exactly the same customers.
   *
   *  A narrower book is not a rival -- a category book outranks the plain
   *  fallback by design. The problem is two books at the SAME scope and the
   *  same rank, where which one applies falls to whichever date sorts first.
   */
  const collidesWith = (book: PriceBook) =>
    !book.is_active || !book.is_standard
      ? []
      : priceBooks.filter(b =>
          b.id !== book.id && b.is_active && b.is_standard &&
          scopeKey(b) === scopeKey(book));

  /** The warnings the loaded list can answer without another round trip. */
  const cardWarnings = (book: PriceBook): PriceBookWarning[] => {
    const out: PriceBookWarning[] = [];

    // Two untargeted fallback books of the same kind both match every
    // customer, and only one can win.
    const rivals = collidesWith(book);
    if (rivals.length > 0) {
      out.push({
        tone: 'danger',
        text: `Competes with ${rivals.map(b => b.name).join(', ')} \u2014 both are active ` +
          `fallback books for the same customers, so which one applies is decided by date, ` +
          `not by intent.`,
      });
    }

    // A category nobody is in makes the book look targeted while behaving as
    // a plain fallback -- the likeliest reason two books end up tied.
    if (deadCategory(book)) {
      out.push({
        tone: 'warn',
        text: `No distributor is in the "${book.distributor_category}" category, so this book ` +
          `falls back to pricing everyone. Re-pick its category to aim it.`,
      });
    }

    // A book with no prices cannot price anything, however it is targeted.
    if ((book.entries_count ?? 0) === 0) {
      out.push({ tone: 'warn', text: 'No prices in this book yet, so it changes nothing.' });
    }
    return out;
  };

  const renderPriceBookCard = (book: PriceBook) => (
    <Card key={book.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base truncate">{book.name}</span>
              {/* One label for what the book IS. "Standard" and "Distributor
                  Category Price Book" were shown together and contradicted
                  each other; is_standard is a fallback flag, not a type. */}
              <Badge className={getTypeColor(book.price_book_type)}>
                {getTypeLabel(book.price_book_type, book.target_type)}
              </Badge>
              {book.is_standard && (
                <Badge variant="outline" className="text-[10px]"
                  title="Used when no more specific book matches">
                  Fallback
                </Badge>
              )}
              {!book.is_active && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>

            {book.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{book.description}</p>
            )}

            {/* The facts that decide whether this book does anything, said in
                one line: what it prices, who is on it, when it applies. */}
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap tabular-nums">
              <span className={cn("font-medium",
                (book.entries_count ?? 0) === 0 && "text-amber-600")}>
                {book.entries_count || 0} product{book.entries_count === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span className={cn((book.assigned_count ?? 0) === 0 && "text-muted-foreground/70")}>
                {book.assigned_count || 0} distributor{book.assigned_count === 1 ? '' : 's'} assigned
              </span>
              <span>·</span>
              <span>{book.currency}</span>
              {book.apply_to_all_territories ? (
                <><span>·</span><span>All territories</span></>
              ) : book.territory ? (
                <><span>·</span><span>{book.territory.name}</span></>
              ) : null}
              {book.distributor_category && (
                <><span>·</span><span>{book.distributor_category.replace(/_/g, ' ')}</span></>
              )}
              {book.effective_from && (
                <><span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(book.effective_from), 'd MMM yyyy')}
                  {book.effective_to && ` – ${format(new Date(book.effective_to), 'd MMM yyyy')}`}
                </span></>
              )}
            </div>

            {/* Everything wrong with this book reads in one place, loudest
                first -- what the list already knows, plus what only a query
                can tell. Two separate warning strips on one card read as two
                unrelated problems. */}
            <PriceBookWarnings book={book} extra={cardWarnings(book)} className="pt-1" />
          </div>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/price-books/${book.id}`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit & Manage Prices
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openCloneDialog(book)}>
                <Copy className="h-4 w-4 mr-2" />
                Clone Price Book
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleActive(book)}>
                {book.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );

  /** The four pages of the create wizard, in the order the decisions depend
   *  on each other: what it is, who it covers, how it behaves, then a read of
   *  the lot before anything is written. */
  const WIZARD_STEPS = [
    { n: 1, title: 'Basic details', blurb: 'Name, side and dates' },
    { n: 2, title: 'Pricing scope', blurb: 'Who it applies to' },
    { n: 3, title: 'Settings', blurb: 'Fallback and catalogue' },
    { n: 4, title: 'Review', blurb: 'Check, then create' },
  ];

  /** Step 1 is the only one that can be incomplete: everything after it has a
   *  working default, so Next is blocked here and nowhere else. */
  const step1Ready = formData.name.trim().length > 0;

  const isSecondaryForm = formData.target_type === 'retailer';

  const renderWizardNav = () => (
    <div className="flex items-center justify-between gap-3 border-t pt-4">
      <Button
        variant="outline"
        disabled={wizardStep === 1}
        onClick={() => setWizardStep((n) => Math.max(1, n - 1))}
      >
        Back
      </Button>
      {wizardStep < 4 ? (
        <Button
          disabled={wizardStep === 1 && !step1Ready}
          onClick={() => setWizardStep((n) => Math.min(4, n + 1))}
        >
          Next: {WIZARD_STEPS[wizardStep].title}
        </Button>
      ) : (
        <Button onClick={handleCreate}>Create price book</Button>
      )}
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-4 py-2">
      {/* The rail is clickable backwards only: a step ahead may depend on a
          decision not yet made on this one. */}
      {/* Wraps: four steps with their blurbs do not fit one line in a
          dialog, and the fourth was being cut off at the right edge. */}
      <div className="flex flex-wrap items-center gap-y-1 gap-x-1">
        {WIZARD_STEPS.map((st, i) => (
          <div key={st.n} className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              disabled={st.n > wizardStep}
              onClick={() => setWizardStep(st.n)}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                st.n <= wizardStep ? 'hover:bg-muted' : 'cursor-default opacity-50',
              )}
            >
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                st.n === wizardStep ? 'bg-primary text-primary-foreground'
                  : st.n < wizardStep ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground',
              )}>
                {st.n < wizardStep ? '✓' : st.n}
              </span>
              <span className="hidden sm:block min-w-0">
                <span className="block text-xs font-medium leading-tight truncate">{st.title}</span>
                <span className="block text-[10px] text-muted-foreground leading-tight truncate">{st.blurb}</span>
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && <span className="h-px w-3 bg-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- 1. basics */}
      {wizardStep === 1 && (
        <div className="space-y-4">
          {/* Which side of the business this prices. It cannot be changed
              afterwards, so it is asked first and in words, not as a code. */}
          <div className="space-y-2">
            <Label>What does this book price? *</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                { v: 'distributor', t: 'Primary', d: 'What distributors pay us' },
                { v: 'retailer', t: 'Secondary', d: 'What shops pay distributors' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    target_type: opt.v,
                    // The type lists differ per side, so a carried-over value
                    // would not be in the new list.
                    price_book_type: 'standard',
                    distributor_category: '',
                  })}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    formData.target_type === opt.v
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <span className="block text-sm font-medium">{opt.t}</span>
                  <span className="block text-xs text-muted-foreground">{opt.d}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Price book name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isSecondaryForm ? 'e.g. North Secondary 2026' : 'e.g. North Primary 2026'}
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="PB-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Price book type</Label>
            <Select
              value={formData.price_book_type}
              onValueChange={(val) => setFormData({ ...formData, price_book_type: val })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currentTypeOptions.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(val) => setFormData({ ...formData, currency: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onValueChange={(v) => setFormData({ ...formData, is_active: v === 'active' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 min-w-0">
              <Label>Effective from</Label>
              <Input type="date" value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })} />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Effective to</Label>
              <Input type="date" value={formData.effective_to}
                onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">
                Leave blank for no end date. A book past its end date stops applying, silently.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional — what this book is for"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------- 2. scope */}
      {wizardStep === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The most specific match wins: Retailer &gt; Salesperson &gt; Beat &gt; Territory &gt; Zone &gt;
            Region &gt; Category &gt; Standard. Leave a field blank to keep the book broader — an
            empty scope means it covers everyone in its currency.
          </p>

          <div className="space-y-3 p-3 border rounded-lg">
            <Label className="text-sm font-medium">Territory</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-territories"
                checked={formData.apply_to_all_territories}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  apply_to_all_territories: !!checked,
                  territory_id: checked ? '' : formData.territory_id,
                })}
              />
              <label htmlFor="all-territories" className="text-sm cursor-pointer">
                Apply to all territories
              </label>
            </div>
            {!formData.apply_to_all_territories && (
              <Select
                value={formData.territory_id}
                onValueChange={(val) => setFormData({ ...formData, territory_id: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select specific territory" /></SelectTrigger>
                <SelectContent>
                  {territories.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          {formData.target_type === 'distributor' && formData.price_book_type === 'distributor_category' && (
            <div className="space-y-2">
              <Label>Distributor category</Label>
              <Select
                value={formData.distributor_category}
                onValueChange={(val) => setFormData({ ...formData, distributor_category: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {distributorCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Matched against the distributor's type code. A category nobody is in prices everyone.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Retailer</Label>
              <SearchableSelect
                value={formData.retailer_id}
                onValueChange={(v) => setFormData({ ...formData, retailer_id: v })}
                options={retailers.map((r) => r.id)}
                labels={Object.fromEntries(retailers.map((r) => [r.id, r.name]))}
                placeholder="Any retailer"
                searchPlaceholder="Search retailers..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Salesperson</Label>
              <SearchableSelect
                value={formData.user_id}
                onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                options={salespeople.map((u) => u.id)}
                labels={Object.fromEntries(salespeople.map((u) => [u.id, u.full_name || u.id]))}
                placeholder="Any salesperson"
                searchPlaceholder="Search users..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Beat</Label>
              <SearchableSelect
                value={formData.beat_id}
                onValueChange={(v) => setFormData({ ...formData, beat_id: v })}
                options={beats.map((b) => b.id)}
                labels={Object.fromEntries(beats.map((b) => [b.id, b.name]))}
                placeholder="Any beat"
                searchPlaceholder="Search beats..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zone</Label>
              <SearchableSelect
                value={formData.zone}
                onValueChange={(v) => setFormData({ ...formData, zone: v })}
                options={Array.from(new Set(territories.map((t) => t.zone).filter(Boolean))) as string[]}
                placeholder="Any zone"
                searchPlaceholder="Search zones..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Region</Label>
              <SearchableSelect
                value={formData.region}
                onValueChange={(v) => setFormData({ ...formData, region: v })}
                options={Array.from(new Set(territories.map((t) => t.region).filter(Boolean))) as string[]}
                placeholder="Any region"
                searchPlaceholder="Search regions..."
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- 3. settings */}
      {wizardStep === 3 && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
            <Checkbox
              className="mt-0.5"
              checked={formData.is_standard}
              onCheckedChange={(v) => setFormData({ ...formData, is_standard: v === true })}
            />
            <span>
              <span className="block text-sm font-medium">Use as the fallback book</span>
              <span className="block text-xs text-muted-foreground">
                Applies when no more specific book matches. Two active fallbacks at the same scope
                rank equally, so which one wins is decided by date rather than intent — keep one.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
            <Checkbox
              className="mt-0.5"
              checked={formData.restricts_catalogue}
              onCheckedChange={(v) => setFormData({ ...formData, restricts_catalogue: v === true })}
            />
            <span>
              <span className="block text-sm font-medium">
                Only let these customers order the products in this book
              </span>
              <span className="block text-xs text-muted-foreground">
                Off, the book sets prices but shows the whole catalogue. On, anything it does not
                price cannot be ordered at all.
              </span>
            </span>
          </label>

          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Every active product is added to this book at its default rate when it is created, so
              it starts as a copy of the current prices rather than an empty book. Edit from there.
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- 4. review */}
      {wizardStep === 4 && (
        <div className="space-y-3">
          <div className="rounded-lg border divide-y text-sm">
            {([
              ['Name', formData.name || '—'],
              ['Code', formData.code || '—'],
              ['Prices', isSecondaryForm
                ? 'Secondary — what shops pay distributors'
                : 'Primary — what distributors pay us'],
              ['Type', getTypeLabel(formData.price_book_type, formData.target_type)],
              ['Currency', formData.currency],
              ['Effective', `${formData.effective_from || 'no start'} → ${formData.effective_to || 'open'}`],
              ['Scope', [
                formData.apply_to_all_territories
                  ? 'All territories'
                  : territories.find((t) => t.id === formData.territory_id)?.name,
                formData.distributor_category && `category ${formData.distributor_category}`,
                formData.retailer_id && 'one retailer',
                formData.user_id && 'one salesperson',
                formData.beat_id && 'one beat',
                formData.zone && `zone ${formData.zone}`,
                formData.region && `region ${formData.region}`,
              ].filter(Boolean).join(' · ') || 'Everyone in this currency'],
              ['Fallback', formData.is_standard ? 'Yes — used when nothing more specific matches' : 'No'],
              ['Catalogue', formData.restricts_catalogue
                ? 'Limited to this book’s products' : 'Whole catalogue stays orderable'],
              ['Status', formData.is_active ? 'Active' : 'Inactive'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground shrink-0">{k}</span>
                <span className="text-right font-medium min-w-0">{v}</span>
              </div>
            ))}
          </div>

          {formData.is_standard && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              Saving this as a fallback will change live prices for anyone not already covered by a
              more specific book.
            </p>
          )}
        </div>
      )}

      {renderWizardNav()}
    </div>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-[1600px] pb-24">
        {/* Header. On a phone the two buttons were pushed off the right edge
            by the title, so the row wraps there and keeps them reachable. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">Price Book Management</h1>
              <p className="text-muted-foreground text-sm">{filteredPriceBooks.length} price books</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate('/admin/price-simulator')}>
            <Calculator className="h-4 w-4 mr-2" />
            Price Simulator
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Price Book
              </Button>
            </DialogTrigger>
            {/* max-w-lg could not hold a two-column row of date pickers, so
                the right-hand field was cut off at the dialog edge. */}
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Create {activeTab === 'retailer' ? 'Retailer' : 'Distributor'} Price Book
                </DialogTitle>
              </DialogHeader>
              {renderCreateForm()}
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <PriceBookFeatureToggle />



        {/* Clone Dialog */}
        <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Clone Price Book</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Cloning from: <strong>{selectedPriceBook?.name}</strong> ({selectedPriceBook?.entries_count || 0} entries)
              </p>

              <div className="space-y-2">
                <Label>New Price Book Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter new name"
                />
              </div>

              <div className="space-y-2">
                <Label>Price Book Type</Label>
                <Select
                  value={formData.price_book_type}
                  onValueChange={(val) => setFormData({ ...formData, price_book_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentTypeOptions.filter(t => t.value !== 'standard').map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Territory Assignment for Clone */}
              <div className="space-y-3 p-3 border rounded-lg">
                <Label className="text-sm font-medium">Territory Assignment</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clone-all-territories"
                    checked={formData.apply_to_all_territories}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      apply_to_all_territories: !!checked,
                      territory_id: checked ? '' : formData.territory_id
                    })}
                  />
                  <label htmlFor="clone-all-territories" className="text-sm cursor-pointer">
                    Apply to all territories
                  </label>
                </div>
                
                {!formData.apply_to_all_territories && (
                  <Select
                    value={formData.territory_id}
                    onValueChange={(val) => setFormData({ ...formData, territory_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select specific territory" />
                    </SelectTrigger>
                    <SelectContent>
                      {territories.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {formData.target_type === 'distributor' && formData.price_book_type === 'distributor_category' && (
                <div className="space-y-2">
                  <Label>Distributor Category</Label>
                  <Select
                    value={formData.distributor_category}
                    onValueChange={(val) => setFormData({ ...formData, distributor_category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {distributorCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective To</Label>
                  <Input
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleClone} className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                Clone Price Book
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <PriceBookSetupChecklist />

        {/* Primary and secondary side by side. Tabs hid one from the other,
            so the obvious question -- do we have a secondary book at all? --
            took a click to answer. The counts answer it on sight. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          {[
            {
              label: 'Total price books', icon: BookOpen,
              value: stats.total,
              sub: `${stats.active} active · ${stats.total - stats.active} inactive`,
              tone: 'text-foreground',
            },
            {
              label: 'Primary — distributors pay us', icon: Building2,
              value: stats.primary,
              sub: `${stats.primaryActive} active · ${stats.primary - stats.primaryActive} inactive`,
              tone: 'text-foreground',
            },
            {
              label: 'Secondary — shops pay', icon: Store,
              value: stats.secondary,
              sub: stats.secondaryActive === 0
                ? 'none active — shops use the default list'
                : `${stats.secondaryActive} active · ${stats.secondary - stats.secondaryActive} inactive`,
              tone: stats.secondaryActive === 0 ? 'text-amber-600 dark:text-amber-500' : 'text-foreground',
            },
            {
              label: 'Distributors assigned', icon: Users,
              value: stats.assignedPrimary + stats.assignedSecondary,
              sub: `${stats.assignedPrimary} primary · ${stats.assignedSecondary} secondary`,
              tone: 'text-foreground',
            },
          ].map((tile) => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground leading-tight">{tile.label}</p>
                  <tile.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <p className={cn('text-2xl font-semibold tabular-nums mt-1', tile.tone)}>{tile.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tile.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters. Search and status sat on two rows while the row itself
            was half empty -- they fit side by side from sm up. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search price books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-[170px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="distributor">Primary only</SelectItem>
              <SelectItem value="retailer">Secondary only</SelectItem>
            </SelectContent>
          </Select>

          {regionOptions.length > 0 && (
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-full sm:w-[150px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regionOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Column filters and the two exports. The page already has its own
              search box above, so the toolbar's is turned off. */}
          <TableToolbar
            className="shrink-0"
            showSearch={false}
            columns={bookColumns}
            rows={tq.view}
            search={tq.search}
            onSearch={tq.setSearch}
            filters={tq.filters}
            onFilter={tq.setFilter}
            onClearFilters={tq.clearFilters}
            activeFilterCount={tq.activeFilterCount}
            total={priceBooks.length}
            shown={tq.view.length}
            exportName="price-books"
            exportTitle="Price books"
          />

          <div className="flex gap-2 shrink-0">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('all')}
            >
              All
            </Button>
            <Button
              variant={activeFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('active')}
            >
              Active
            </Button>
            <Button
              variant={activeFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('inactive')}
            >
              Inactive
            </Button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredPriceBooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {typeFilter === 'retailer' ? 'No secondary price books found'
                  : typeFilter === 'distributor' ? 'No primary price books found'
                  : 'No price books found'}
              </p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Price Book
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Everything wrong across the whole list, once, above the table --
                rather than repeated on every row it touches. */}
            {(() => {
              const notes: { tone: 'warn' | 'danger'; text: string }[] = [];
              const colliding = filteredPriceBooks.filter((b) => collidesWith(b).length > 0);
              if (colliding.length > 0) {
                notes.push({
                  tone: 'danger',
                  text: `Conflicting fallback price books: ${colliding.map((b) => b.name).join(', ')} are set as fallback for the same customers. Which one applies is decided by date, not by intent — keep one.`,
                });
              }
              const deadCat = filteredPriceBooks.filter((b) => deadCategory(b));
              if (deadCat.length > 0) {
                notes.push({
                  tone: 'warn',
                  text: `${deadCat.map((b) => b.name).join(', ')} ${deadCat.length === 1 ? 'is' : 'are'} aimed at a distributor category nobody is in, so ${deadCat.length === 1 ? 'it prices' : 'they price'} everyone. Re-pick the category to aim it.`,
                });
              }
              const empty = filteredPriceBooks.filter((b) => (b.entries_count ?? 0) === 0);
              if (empty.length > 0) {
                notes.push({
                  tone: 'warn',
                  text: `${empty.length} book${empty.length === 1 ? '' : 's'} hold no prices and change nothing: ${empty.map((b) => b.name).join(', ')}.`,
                });
              }
              if (notes.length === 0) return null;
              return (
                <div className="mb-4 space-y-2">
                  {notes.map((n) => (
                    <div key={n.text} className={cn(
                      'flex items-start gap-2 rounded-lg border p-3 text-xs',
                      n.tone === 'danger'
                        ? 'border-destructive/40 bg-destructive/5 text-destructive'
                        : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{n.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    {/* Built from the column list, so the headings and the
                        cells below cannot fall out of step. */}
                    <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {visibleColumns.map((c) => (
                        <th key={c.key} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                          <SortableHead
                            label={c.header}
                            sortKey={c.key}
                            sort={tq.sort}
                            onToggle={tq.toggleSort}
                            align={c.align ?? 'left'}
                          />
                        </th>
                      ))}
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tq.view.map((book) => {
                      const isSecondary = (book.target_type || 'distributor') === 'retailer';
                      const rivals = collidesWith(book);
                      return (
                        <tr key={book.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/price-books/${book.id}`)}
                              className="text-left font-medium hover:underline"
                            >
                              {book.name}
                            </button>
                            <div className="text-[11px] text-muted-foreground">
                              {book.code || getTypeLabel(book.price_book_type, book.target_type)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {/* The segregation, stated per row rather than
                                hidden behind a tab. */}
                            <Badge className={isSecondary
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}>
                              {isSecondary ? 'Secondary' : 'Primary'}
                            </Badge>
                            {book.is_standard && (
                              <Badge variant="outline" className="ml-1 text-[10px]"
                                title="Used when no more specific book matches">Fallback</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                            {book.region
                              || (book.apply_to_all_territories ? 'All territories'
                                : book.territory?.name
                                || (book.distributor_category ? book.distributor_category.replace(/_/g, ' ') : '—'))}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{book.currency}</td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums">
                            {book.effective_from
                              ? format(new Date(book.effective_from), 'd MMM yyyy')
                              : '—'}
                            {book.effective_to && ` – ${format(new Date(book.effective_to), 'd MMM yyyy')}`}
                          </td>
                          <td className={cn('px-3 py-2.5 text-right tabular-nums',
                            (book.entries_count ?? 0) === 0 && 'text-amber-600 dark:text-amber-500 font-medium')}>
                            {book.entries_count || 0}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {book.assigned_count || 0}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant={book.is_active ? 'default' : 'outline'}
                              className={cn('text-[10px]', book.is_active
                                && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300')}>
                              {book.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {rivals.length > 0 && (
                              <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-destructive"
                                aria-label={`Competes with ${rivals.map((b) => b.name).join(', ')}`} />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/admin/price-books/${book.id}`)}>
                                  <Edit className="h-4 w-4 mr-2" />Edit &amp; manage prices
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openCloneDialog(book)}>
                                  <Copy className="h-4 w-4 mr-2" />Clone price book
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleActive(book)}>
                                  {book.is_active ? 'Deactivate' : 'Activate'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tq.view.length === 0 && (
                  <div className="px-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No price book matches the filters on these columns.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3"
                      onClick={tq.clearFilters}>
                      Clear column filters
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Showing {tq.view.length} of {priceBooks.length} price book{priceBooks.length === 1 ? '' : 's'}
              {tq.activeFilterCount > 0 && ' · column filters applied'}
              {tq.sort && ` · sorted by ${bookColumns.find((c) => c.key === tq.sort!.key)?.header ?? tq.sort.key}`}.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
};

export default PriceBookAdmin;