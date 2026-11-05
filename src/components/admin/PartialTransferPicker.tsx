import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, AlertTriangle, Users, MapPin, Map, Truck, Building2, UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';

export type BucketKey =
  | 'retailers' | 'beats' | 'territories'
  | 'distributors' | 'vans' | 'direct_reports';

export interface PartialSelection {
  retailers: string[];
  beats: string[];
  territories: string[];
  distributors: string[];
  vans: string[];
  direct_reports: string[];
  include_pending_payments?: boolean;
}

interface Item { id: string; label: string }

interface Props {
  fromUserId: string;
  selection: PartialSelection;
  onSelectionChange: (s: PartialSelection) => void;
}

const ICONS: Record<BucketKey, React.ComponentType<any>> = {
  retailers: MapPin,
  beats: Map,
  territories: Building2,
  distributors: Users,
  vans: Truck,
  direct_reports: UserCog,
};

const LABELS: Record<BucketKey, string> = {
  retailers: 'Retailers',
  beats: 'Beats',
  territories: 'Territories',
  distributors: 'Distributors',
  vans: 'Vans',
  direct_reports: 'Direct Reports',
};

export const PartialTransferPicker: React.FC<Props> = ({ fromUserId, selection, onSelectionChange }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<BucketKey, Item[]>>({
    retailers: [], beats: [], territories: [], distributors: [], vans: [], direct_reports: [],
  });
  const [search, setSearch] = useState<Record<BucketKey, string>>({
    retailers: '', beats: '', territories: '', distributors: '', vans: '', direct_reports: '',
  });

  useEffect(() => {
    if (!fromUserId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [r, b, t, d, v, dr] = await Promise.all([
          supabase.from('retailers').select('id, name').eq('owner_id', fromUserId).limit(1000),
          supabase.from('beats').select('beat_id, beat_name').eq('owner_id', fromUserId).limit(1000),
          supabase.from('territories').select('id, name').eq('assigned_user_id', fromUserId).limit(1000),
          supabase.from('distributors').select('id, name').eq('owner_id', fromUserId).limit(1000),
          supabase.from('vans').select('id, registration_number').eq('assigned_user_id', fromUserId).limit(1000),
          supabase.from('employees').select('user_id').eq('manager_id', fromUserId).limit(1000),
        ]);
        const reportUserIds = (dr.data || []).map((x: any) => x.user_id).filter(Boolean);
        let profileMap: Record<string, string> = {};
        if (reportUserIds.length) {
          const { data: profs } = await supabase
            .from('profiles').select('id, full_name, username').in('id', reportUserIds);
          (profs || []).forEach((p: any) => {
            profileMap[p.id] = p.full_name || p.username || p.id;
          });
        }
        if (!alive) return;
        setData({
          retailers:    (r.data    || []).map((x: any) => ({ id: x.id, label: x.name || x.id })),
          beats:        (b.data    || []).map((x: any) => ({ id: x.beat_id, label: x.beat_name || x.beat_id })),
          territories:  (t.data    || []).map((x: any) => ({ id: x.id, label: x.name || x.id })),
          distributors: (d.data    || []).map((x: any) => ({ id: x.id, label: x.name || x.id })),
          vans:         (v.data    || []).map((x: any) => ({ id: x.id, label: x.registration_number || x.id })),
          direct_reports: (dr.data || []).map((x: any) => ({ id: x.user_id, label: profileMap[x.user_id] || x.user_id })),
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fromUserId]);

  const toggleId = (bucket: BucketKey, id: string) => {
    const cur = new Set(selection[bucket]);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    onSelectionChange({ ...selection, [bucket]: Array.from(cur) });
  };

  const toggleAll = (bucket: BucketKey, items: Item[], select: boolean) => {
    onSelectionChange({ ...selection, [bucket]: select ? items.map(i => i.id) : [] });
  };

  const totalSelected = Object.values(selection).reduce((s, arr) => s + arr.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading owned records…</span>
      </div>
    );
  }

  const buckets: BucketKey[] = ['retailers','beats','territories','distributors','vans','direct_reports'];

  return (
    <div className="space-y-3">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Only ownership/assignment fields are transferred. Historical data (orders, invoices, attendance, GPS, gamification) stays with the source user.
        </AlertDescription>
      </Alert>

      <div className="text-xs text-muted-foreground">
        {totalSelected} record(s) selected for transfer (max 500).
      </div>

      <Accordion type="multiple" className="w-full">
        {buckets.map((bk) => {
          const Icon = ICONS[bk];
          const items = data[bk];
          const filtered = items.filter(i =>
            !search[bk] || i.label.toLowerCase().includes(search[bk].toLowerCase()),
          );
          const selected = selection[bk];
          const allSelected = items.length > 0 && selected.length === items.length;

          return (
            <AccordionItem key={bk} value={bk}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{LABELS[bk]}</span>
                  <Badge variant="secondary" className="ml-2">{items.length}</Badge>
                  {selected.length > 0 && (
                    <Badge variant="default" className="ml-1">{selected.length} selected</Badge>
                  )}
                  {bk === 'direct_reports' && items.length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px]">requires confirmation</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No owned records.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          value={search[bk]}
                          onChange={(e) => setSearch({ ...search, [bk]: e.target.value })}
                          placeholder={`Search ${LABELS[bk].toLowerCase()}…`}
                          className="h-7 pl-7 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAll(bk, items, !allSelected)}
                        className="text-xs underline text-primary"
                      >
                        {allSelected ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {filtered.map(item => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={selected.includes(item.id)}
                            onCheckedChange={() => toggleId(bk, item.id)}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                        </label>
                      ))}
                      {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No matches.</p>
                      )}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};