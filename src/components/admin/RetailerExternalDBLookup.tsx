import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/SearchInput';
import { Database, MapPin, Phone, Mail, Hash, Navigation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const RetailerExternalDBLookup: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch states
  const { data: states = [], isLoading: statesLoading } = useQuery({
    queryKey: ['retailer-ext-states'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_retailer_ext_states');
      if (error) throw error;
      return (data || []).map((r: any) => r.state as string).filter((s: string) => s && s.trim() !== '');
    },
    staleTime: 60 * 60 * 1000,
  });

  // Fetch cities for selected state
  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['retailer-ext-cities', selectedState],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_retailer_ext_cities', {
        selected_state: selectedState,
      });
      if (error) throw error;
      return (data || []).map((r: any) => r.city as string).filter((c: string) => c && c.trim() !== '');
    },
    enabled: !!selectedState,
    staleTime: 30 * 60 * 1000,
  });

  // Fetch retailers for selected city
  const { data: retailers = [], isLoading: retailersLoading } = useQuery({
    queryKey: ['retailer-ext-data', selectedState, selectedCity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailer_external_db' as any)
        .select('*')
        .eq('state', selectedState)
        .eq('city', selectedCity)
        .order('company_name')
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedState && !!selectedCity,
    staleTime: 10 * 60 * 1000,
  });

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setSelectedCity('');
    setSearchQuery('');
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    setSearchQuery('');
  };

  const filteredRetailers = retailers.filter((r: any) =>
    !searchQuery ||
    (r.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Search Retailers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Select State</label>
              <Select value={selectedState} onValueChange={handleStateChange}>
                <SelectTrigger>
                  <SelectValue placeholder={statesLoading ? "Loading states..." : "Select State"} />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state: string) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Select City</label>
              <Select
                value={selectedCity}
                onValueChange={handleCityChange}
                disabled={!selectedState}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedState ? "Select a state first" :
                    citiesLoading ? "Loading cities..." : "Select City"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city: string) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectedCity && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">
                Retailers in {selectedCity}, {selectedState}
                <Badge variant="secondary" className="ml-2">{filteredRetailers.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {retailers.length > 0 && (
                  <>
                    <div className="w-64">
                      <SearchInput
                        placeholder="Filter results..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {retailersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredRetailers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No retailers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Retailer Name</TableHead>
                      <TableHead className="min-w-[250px]">Address</TableHead>
                      <TableHead>GPS Coordinate</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>PIN Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRetailers.map((r: any, i: number) => (
                      <TableRow key={r.id || i}>
                        <TableCell className="font-medium">{r.company_name}</TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1.5 text-sm">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <span>{r.address || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.latitude && r.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              <span className="text-xs">{Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</span>
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r.mobile ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{r.mobile}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r.pincode ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{r.pincode}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r.category ? (
                            <Badge variant="outline" className="text-xs">{r.category}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r.email ? (
                            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span>{r.email}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const GeocodeButton: React.FC<{ state: string; city: string }> = ({ state, city }) => {
  const queryClient = useQueryClient();
  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('geocode-retailer-ext', {
        body: { state, city, batch_size: 10 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.geocoded > 0 || data.failed > 0) {
        toast.success(`Geocoded ${data.geocoded} retailers. ${data.remaining > 0 ? `${data.remaining} remaining — click again.` : 'All done!'}`);
      } else {
        toast.info('All retailers in this city are already geocoded.');
      }
      queryClient.invalidateQueries({ queryKey: ['retailer-ext-data', state, city] });
    },
    onError: (err: any) => {
      toast.error(`Geocoding failed: ${err.message}`);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => geocodeMutation.mutate()}
      disabled={geocodeMutation.isPending}
    >
      {geocodeMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Navigation className="h-4 w-4 mr-1.5" />
      )}
      Geocode
    </Button>
  );
};