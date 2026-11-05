import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/SearchInput';
import { Database, Navigation, Phone, MapPin } from 'lucide-react';

export const RetailerUnsortedLookup: React.FC = () => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: states = [], isLoading: statesLoading } = useQuery({
    queryKey: ['retailer-unsorted-states'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_retailer_unsorted_states');
      if (error) throw error;
      return (data || []).map((r: any) => r.state as string).filter(Boolean);
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: districts = [], isLoading: districtsLoading } = useQuery({
    queryKey: ['retailer-unsorted-districts', selectedState],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_retailer_unsorted_districts', {
        selected_state: selectedState,
      });
      if (error) throw error;
      return (data || []).map((r: any) => r.district as string).filter(Boolean);
    },
    enabled: !!selectedState,
    staleTime: 30 * 60 * 1000,
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['retailer-unsorted-cities', selectedState, selectedDistrict],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_retailer_unsorted_cities', {
        selected_state: selectedState,
        selected_district: selectedDistrict,
      });
      if (error) throw error;
      return (data || []).map((r: any) => r.city as string).filter(Boolean);
    },
    enabled: !!selectedState && !!selectedDistrict,
    staleTime: 30 * 60 * 1000,
  });

  const {
    data: retailers = [],
    isLoading: retailersLoading,
    error: retailersError,
  } = useQuery({
    queryKey: ['retailer-unsorted-data', selectedState, selectedDistrict, selectedCity],
    queryFn: async () => {
      const normalizedState = selectedState.trim();
      const normalizedDistrict = selectedDistrict.trim();
      const normalizedCity = selectedCity.trim();

      const { data, error } = await supabase
        .from('retailer_external_unsorted' as any)
        .select('*')
        .eq('State', normalizedState)
        .eq('District', normalizedDistrict)
        .eq('City', normalizedCity)
        .limit(500);

      if (error) throw error;

      return (data || []).sort((a: any, b: any) =>
        (a["Retailer's Name"] || '').localeCompare(b["Retailer's Name"] || '')
      );
    },
    enabled: !!selectedState && !!selectedDistrict && !!selectedCity,
    staleTime: 10 * 60 * 1000,
  });

  const handleStateChange = (value: string) => {
    setSelectedState(value.trim());
    setSelectedDistrict('');
    setSelectedCity('');
    setSearchQuery('');
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value.trim());
    setSelectedCity('');
    setSearchQuery('');
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value.trim());
    setSearchQuery('');
  };

  const filteredRetailers = retailers.filter((r: any) =>
    !searchQuery ||
    (r["Retailer's Name"] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r["Village Visited"] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Search Uncategorized Retailers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Select District</label>
              <Select value={selectedDistrict} onValueChange={handleDistrictChange} disabled={!selectedState}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedState ? "Select a state first" :
                    districtsLoading ? "Loading districts..." : "Select District"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district: string) => (
                    <SelectItem key={district} value={district}>{district}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Select City</label>
              <Select value={selectedCity} onValueChange={handleCityChange} disabled={!selectedDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedDistrict ? "Select a district first" :
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

      {selectedCity && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">
                Uncategorized Retailers in {selectedCity}, {selectedDistrict}, {selectedState}
                <Badge variant="secondary" className="ml-2">{filteredRetailers.length}</Badge>
              </CardTitle>
              {retailers.length > 0 && (
                <div className="w-64">
                  <SearchInput
                    placeholder="Filter results..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {retailersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : retailersError ? (
              <p className="text-center text-destructive py-8">
                Failed to load retailers: {(retailersError as Error).message}
              </p>
            ) : filteredRetailers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No retailers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Retailer's Name</TableHead>
                      <TableHead>Retailer's Number</TableHead>
                      <TableHead>Village Visited</TableHead>
                      <TableHead>GPS Coordinate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRetailers.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r["Retailer's Name"] || '—'}</TableCell>
                        <TableCell>
                          {r["Retailer's Number"] ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{r["Retailer's Number"]}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r["Village Visited"] ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{r["Village Visited"]}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {r["Lat"] && r["Long"] ? (
                            <a
                              href={`https://www.google.com/maps?q=${r["Lat"]},${r["Long"]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              {r["Lat"]}, {r["Long"]}
                            </a>
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
