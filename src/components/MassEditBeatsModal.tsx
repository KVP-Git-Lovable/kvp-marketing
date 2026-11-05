import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { offlineStorage, STORES } from "@/lib/offlineStorage";
import { useOfflineSync } from "@/hooks/useOfflineSync";

interface Retailer {
  id: string;
  name: string;
  beat_id: string;
  beat_name?: string | null;
}

interface BeatOption {
  beat_id: string;
  beat_name: string;
}

interface MassEditBeatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailers: Retailer[];
  beats: BeatOption[] | string[];
  onSuccess: () => void;
}

export const MassEditBeatsModal = ({ isOpen, onClose, retailers, beats, onSuccess }: MassEditBeatsModalProps) => {
  const { user } = useAuth();
  const { isOnline } = useOfflineSync();
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
  const [targetBeat, setTargetBeat] = useState<string>("");
  const [isNewBeat, setIsNewBeat] = useState(false);
  const [newBeatName, setNewBeatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableBeats, setAvailableBeats] = useState<BeatOption[]>([]);

  // Load beats from DB (primary) with offline cache fallback
  useEffect(() => {
    const loadBeats = async () => {
      if (!user?.id) return;
      
      try {
        console.log('Loading beats from DB...');
        
        if (isOnline) {
          // DB-first: fetch directly from beats table (RLS enforced)
          const { data, error } = await supabase
            .from('beats')
            .select('id, beat_id, beat_name, owner_id, created_by, is_active')
            .eq('is_active', true)
            .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
            .order('beat_name');

          if (error) throw error;

          const dbBeats = (data || []).map(b => ({
            beat_id: b.beat_id,
            beat_name: b.beat_name || b.beat_id,
          }));

          // Cache for offline use
          for (const beat of data || []) {
            await offlineStorage.save(STORES.BEATS, beat);
          }

          console.log('Loaded beats from DB:', dbBeats.length);
          setAvailableBeats(dbBeats);
        } else {
          // Offline fallback: use cached beats store
          const cachedBeats = await offlineStorage.getAll(STORES.BEATS);
          const activeBeats = (cachedBeats as any[])
            .filter((b: any) => b.is_active !== false && (b.owner_id === user.id || b.created_by === user.id))
            .map((b: any) => ({
              beat_id: b.beat_id,
              beat_name: b.beat_name || b.beat_id,
            }))
            .sort((a, b) => a.beat_name.localeCompare(b.beat_name));

          console.log('Loaded beats from cache:', activeBeats.length);
          setAvailableBeats(activeBeats);
        }
      } catch (error) {
        console.error('Error loading beats:', error);
        // Fallback to cache on error
        try {
          const cachedBeats = await offlineStorage.getAll(STORES.BEATS);
          const activeBeats = (cachedBeats as any[])
            .filter((b: any) => b.is_active !== false && (b.owner_id === user.id || b.created_by === user.id))
            .map((b: any) => ({
              beat_id: b.beat_id,
              beat_name: b.beat_name || b.beat_id,
            }))
            .sort((a, b) => a.beat_name.localeCompare(b.beat_name));
          setAvailableBeats(activeBeats);
        } catch {
          setAvailableBeats([]);
        }
      }
    };
    
    if (isOpen) {
      loadBeats();
    }
  }, [isOpen, user, isOnline]);

  const handleRetailerToggle = (retailerId: string) => {
    setSelectedRetailers(prev => 
      prev.includes(retailerId) 
        ? prev.filter(id => id !== retailerId)
        : [...prev, retailerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRetailers.length === retailers.length) {
      setSelectedRetailers([]);
    } else {
      setSelectedRetailers(retailers.map(r => r.id));
    }
  };

  const handleMassEdit = async () => {
    if (selectedRetailers.length === 0) {
      toast({
        title: "No retailers selected",
        description: "Please select at least one retailer",
        variant: "destructive",
      });
      return;
    }

    const beatToAssign = isNewBeat ? newBeatName.trim() : targetBeat;
    if (!beatToAssign) {
      toast({
        title: "No beat specified",
        description: "Please select an existing beat or create a new one",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isOnline) {
        // Online: Update directly
        const { error } = await supabase
          .from('retailers')
          .update({ beat_id: beatToAssign })
          .in('id', selectedRetailers)
          .eq('user_id', user?.id);

        if (error) throw error;
      } else {
        // Offline: Update cache and queue for sync
        const cachedRetailers = await offlineStorage.getAll(STORES.RETAILERS);
        
        for (const retailerId of selectedRetailers) {
          const retailer = cachedRetailers.find((r: any) => r.id === retailerId);
          if (retailer) {
            const updated = { ...(retailer as any), beat_id: beatToAssign };
            await offlineStorage.save(STORES.RETAILERS, updated);
            
            // Queue for sync
            await offlineStorage.addToSyncQueue('UPDATE_RETAILER', {
              id: retailerId,
              updates: { beat_id: beatToAssign },
              user_id: user?.id
            });
          }
        }
      }

      toast({
        title: "Beat assignment successful",
        description: `${selectedRetailers.length} retailers moved to beat "${beatToAssign}"${!isOnline ? ' (will sync when online)' : ''}`,
      });

      onSuccess();
      onClose();
      setSelectedRetailers([]);
      setTargetBeat("");
      setNewBeatName("");
      setIsNewBeat(false);
    } catch (error: any) {
      toast({
        title: "Failed to update beats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mass Edit Beats</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Beat Selection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="new-beat"
                checked={isNewBeat}
                onCheckedChange={(checked) => setIsNewBeat(checked === true)}
              />
              <Label htmlFor="new-beat">Create new beat</Label>
            </div>

            {isNewBeat ? (
              <div>
                <Label>New Beat Name</Label>
                <Input
                  placeholder="Enter new beat name"
                  value={newBeatName}
                  onChange={(e) => setNewBeatName(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label>Select Existing Beat</Label>
                <Select value={targetBeat} onValueChange={setTargetBeat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a beat" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBeats.length === 0 && (
                      <SelectItem value="no-beats" disabled>
                        {isOnline ? 'No beats available' : 'Loading beats...'}
                      </SelectItem>
                    )}
                    {availableBeats.map(beat => (
                      <SelectItem key={beat.beat_id} value={beat.beat_id}>
                        {beat.beat_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Retailer Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Select Retailers ({selectedRetailers.length}/{retailers.length})</Label>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedRetailers.length === retailers.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {retailers.map(retailer => (
                <div key={retailer.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={retailer.id}
                    checked={selectedRetailers.includes(retailer.id)}
                    onCheckedChange={() => handleRetailerToggle(retailer.id)}
                  />
                  <Label htmlFor={retailer.id} className="flex-1 text-sm">
                    {retailer.name} <span className="text-muted-foreground">(Current: {retailer.beat_name || retailer.beat_id})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleMassEdit} 
            disabled={loading || selectedRetailers.length === 0}
          >
            {loading ? "Updating..." : `Update ${selectedRetailers.length} Retailers`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};