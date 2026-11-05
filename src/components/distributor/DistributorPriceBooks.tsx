import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BookOpen, Plus, Calendar, Check, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PriceBook {
  id: string;
  name: string;
  price_book_type: string;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  currency: string;
  entries_count?: number;
}

interface DistributorPriceBook {
  id: string;
  price_book_id: string;
  is_active: boolean;
  assigned_at: string;
  deactivated_at: string | null;
  price_book: PriceBook;
}

interface Props {
  distributorId: string;
}

export const DistributorPriceBooks = ({ distributorId }: Props) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<DistributorPriceBook[]>([]);
  const [availablePriceBooks, setAvailablePriceBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedPriceBook, setSelectedPriceBook] = useState('');

  useEffect(() => {
    fetchData();
  }, [distributorId]);

  const fetchData = async () => {
    try {
      // Fetch assigned price books
      const { data: assignedData, error: assignedError } = await supabase
        .from('distributor_price_books')
        .select(`
          *,
          price_book:price_books(*)
        `)
        .eq('distributor_id', distributorId)
        .order('assigned_at', { ascending: false });

      if (assignedError) throw assignedError;

      // Fetch all active price books
      const { data: priceBooks, error: pbError } = await supabase
        .from('price_books')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (pbError) throw pbError;

      // How many prices each book actually holds. Without this you can assign
      // an empty price book and nothing on this screen would say so.
      const bookIds = Array.from(new Set([
        ...(priceBooks || []).map(pb => pb.id),
        ...(assignedData || []).map((a: any) => a.price_book_id),
      ])).filter(Boolean);
      const counts = new Map<string, number>();
      if (bookIds.length > 0) {
        const { data: entries } = await supabase
          .from('price_book_entries')
          .select('price_book_id')
          .in('price_book_id', bookIds);
        (entries || []).forEach((e: any) =>
          counts.set(e.price_book_id, (counts.get(e.price_book_id) || 0) + 1));
      }
      const withCounts = (pb: any) => pb ? { ...pb, entries_count: counts.get(pb.id) ?? 0 } : pb;

      // Filter out already assigned (active) price books
      const assignedIds = (assignedData || [])
        .filter(a => a.is_active)
        .map(a => a.price_book_id);
      
      const available = (priceBooks || []).filter(pb => !assignedIds.includes(pb.id));

      setAssignments(((assignedData || []) as any[]).map(a => ({ ...a, price_book: withCounts(a.price_book) })));
      setAvailablePriceBooks(available.map(withCounts));
    } catch (error) {
      console.error('Error fetching price books:', error);
      toast.error('Failed to load price books');
    } finally {
      setLoading(false);
    }
  };

  /** A distributor holds two live books, not one: what it pays us (primary)
   *  and what its retailers pay (secondary). They never replace each other. */
  const kindOf = (a: any): 'primary' | 'secondary' =>
    (a?.price_book?.target_type ?? 'distributor') === 'retailer' ? 'secondary' : 'primary';

  const handleAssign = async () => {
    if (!selectedPriceBook) {
      toast.error('Please select a price book');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();

      // Replace only the book of the same kind. A primary assignment must
      // not unseat the secondary one: they answer different questions.
      const chosen = availablePriceBooks.find(pb => pb.id === selectedPriceBook);
      const chosenKind: 'primary' | 'secondary' =
        ((chosen as any)?.target_type ?? 'distributor') === 'retailer' ? 'secondary' : 'primary';
      const supersede = assignments
        .filter(a => a.is_active && kindOf(a) === chosenKind)
        .map(a => a.id);

      if (supersede.length > 0) {
        const { error: deactivateError } = await supabase
          .from('distributor_price_books')
          .update({
            is_active: false,
            deactivated_at: new Date().toISOString()
          })
          .in('id', supersede);

        if (deactivateError) throw deactivateError;
      }

      // Assign new price book
      const { error: assignError } = await supabase
        .from('distributor_price_books')
        .insert({
          distributor_id: distributorId,
          price_book_id: selectedPriceBook,
          is_active: true,
          assigned_by: user?.user?.id || null,
        });

      if (assignError) throw assignError;

      toast.success('Price book assigned successfully');
      setIsAssignOpen(false);
      setSelectedPriceBook('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign price book');
    }
  };

  const handleDeactivate = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('distributor_price_books')
        .update({ 
          is_active: false, 
          deactivated_at: new Date().toISOString() 
        })
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Price book deactivated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate');
    }
  };

  /** One assigned book. Rendered twice -- a distributor holds a primary and a
   *  secondary at the same time, and neither replaces the other. */
  const AssignedBook = ({ a, title, tone }: { a: any; title: string; tone: string }) => (
        <Card className={cn("border", tone)}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                {title}
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleDeactivate(a.id)}
              >
                <X className="h-4 w-4 mr-1" />
                Deactivate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold">{a.price_book.name}</span>
              <Badge className={getTypeColor(a.price_book.price_book_type)}>
                {a.price_book.price_book_type.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline">{a.price_book.currency}</Badge>
              <Badge variant="outline">
                {a.price_book.entries_count ?? 0} price{a.price_book.entries_count === 1 ? '' : 's'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => navigate(`/admin/price-books/${a.price_book.id}`)}
              >
                <ExternalLink className="h-3 w-3" /> Open in price book master
              </Button>
            </div>

            {/* Assigned is not the same as in force, and an empty book prices
                nothing -- both used to look identical to a working one. */}
            {(a.price_book.entries_count ?? 0) === 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs mb-2 dark:border-amber-900 dark:bg-amber-950">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-px shrink-0" />
                <span className="text-amber-900 dark:text-amber-200">
                  This price book has no prices in it, so nothing is priced from it. Add entries in the master.
                </span>
              </div>
            )}
            {windowState(a.price_book) === 'expired' && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs mb-2 dark:border-red-900 dark:bg-red-950">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-px shrink-0" />
                <span className="text-red-900 dark:text-red-200">
                  Assigned, but the valid-to date has passed. It is not in force today.
                </span>
              </div>
            )}
            {windowState(a.price_book) === 'not_started' && (
              <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs mb-2 dark:border-sky-900 dark:bg-sky-950">
                <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mt-px shrink-0" />
                <span className="text-sky-900 dark:text-sky-200">
                  Assigned, but it does not start until {format(new Date(a.price_book.effective_from!), 'dd MMM yyyy')}.
                </span>
              </div>
            )}
            <div className="text-sm text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Assigned: {format(new Date(a.assigned_at), 'dd MMM yyyy')}
              </span>
              {a.price_book.effective_from && (
                <span>Valid from: {format(new Date(a.price_book.effective_from), 'dd MMM yyyy')}</span>
              )}
              {a.price_book.effective_to && (
                <span>to: {format(new Date(a.price_book.effective_to), 'dd MMM yyyy')}</span>
              )}
            </div>
          </CardContent>
        </Card>
  );

  const activePrimary = assignments.find(a => a.is_active && kindOf(a) === 'primary');
  const activeSecondary = assignments.find(a => a.is_active && kindOf(a) === 'secondary');
  const previousAssignments = assignments.filter(a => !a.is_active);

  /** Which kind the book in the dropdown is, so the dialog can say what
   *  assigning it would actually replace. */
  const bookKind = (pb: any): 'primary' | 'secondary' =>
    (pb?.target_type ?? 'distributor') === 'retailer' ? 'secondary' : 'primary';

  const chosenBook = availablePriceBooks.find(pb => pb.id === selectedPriceBook);
  // Only a book of the SAME kind is superseded -- assigning a secondary book
  // never unseats the primary. The note used to name whichever assignment
  // existed, so picking a secondary book warned that the primary would be
  // deactivated, which is not what the save does.
  const wouldReplace = chosenBook
    ? (bookKind(chosenBook) === 'secondary' ? activeSecondary : activePrimary)
    : undefined;

  const secondaryOptions = availablePriceBooks.filter(pb => bookKind(pb) === 'secondary');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'standard': return 'bg-primary/10 text-primary';
      case 'territory': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'distributor_category': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'retailer_territory': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  /** A book can be assigned and still not be in force today. */
  const windowState = (pb?: PriceBook) => {
    if (!pb) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (pb.effective_from && pb.effective_from > today) return 'not_started';
    if (pb.effective_to && pb.effective_to < today) return 'expired';
    return 'in_force';
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Price Books
        </h3>
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Assign Price Book
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Price Book</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {wouldReplace && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                  <p className="text-yellow-800 dark:text-yellow-300">
                    This replaces the current {bookKind(chosenBook) === 'secondary' ? 'secondary' : 'primary'}{' '}
                    book ({wouldReplace.price_book.name}). The{' '}
                    {bookKind(chosenBook) === 'secondary' ? 'primary' : 'secondary'} book is not affected.
                  </p>
                </div>
              )}

              {secondaryOptions.length === 0 && (
                <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                  Only primary books are listed because no active retailer price book exists yet.
                  Create one under Price Books → Retailer Price Books, and it will appear here as
                  the secondary book for this distributor's shops.
                </div>
              )}

              <div className="space-y-2">
                <Label>Select Price Book</Label>
                <Select value={selectedPriceBook} onValueChange={setSelectedPriceBook}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a price book" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePriceBooks.length === 0 ? (
                      <SelectItem value="none" disabled>No available price books</SelectItem>
                    ) : (
                      availablePriceBooks.map(pb => (
                        <SelectItem key={pb.id} value={pb.id}>
                          {bookKind(pb) === 'secondary' ? 'Secondary' : 'Primary'} · {pb.name}
                          {` — ${pb.entries_count ?? 0} price${pb.entries_count === 1 ? '' : 's'}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAssign} className="w-full" disabled={!selectedPriceBook}>
                Assign Price Book
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Price Book */}
      {/* Primary and secondary are shown side by side: a distributor buys
          from us on one and sells to its retailers on the other. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {activePrimary ? (
          <AssignedBook
            a={activePrimary}
            title="Primary — what this distributor pays us"
            tone="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30"
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium">No primary price book</p>
              <p className="text-xs text-muted-foreground">
                Primary orders from this distributor use the default product price.
              </p>
            </CardContent>
          </Card>
        )}

        {activeSecondary ? (
          <AssignedBook
            a={activeSecondary}
            title="Secondary — what its retailers pay"
            tone="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium">No secondary price book</p>
              <p className="text-xs text-muted-foreground">
                Every retailer under this distributor is priced from the default list.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Previous Price Books */}
      {previousAssignments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Previous Price Books</h4>
          {previousAssignments.map(assignment => (
            <Card key={assignment.id} className="bg-muted/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{assignment.price_book.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {assignment.price_book.price_book_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.assigned_at), 'dd MMM yyyy')} - {assignment.deactivated_at ? format(new Date(assignment.deactivated_at), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};