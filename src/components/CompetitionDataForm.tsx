import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Camera, Mic, Square, Edit, Check, ChevronsUpDown, FileText, Play, X, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CompetitionRow {
  id: string;
  competitorId: string;
  skuId: string;
  stockQuantity: number;
  unit: string;
  sellingPrice: number;
  insight: string;
  impactLevel: string;
  needsAttention: boolean;
  photoUrls: string[];
  voiceNoteUrls: string[];
}

interface CompetitionDataFormProps {
  retailerId: string;
  visitId: string;
  onSave: () => void;
}

export const CompetitionDataForm = ({ retailerId, visitId, onSave }: CompetitionDataFormProps) => {
  const [rows, setRows] = useState<CompetitionRow[]>([
    { id: "1", competitorId: "", skuId: "", stockQuantity: 0, unit: "KGS", sellingPrice: 0, insight: "", impactLevel: "", needsAttention: false, photoUrls: [], voiceNoteUrls: [] }
  ]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [skus, setSkus] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savedData, setSavedData] = useState<CompetitionRow[]>([]);
  const [notes, setNotes] = useState("");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{ rowId: string; blob: Blob; url: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchCompetitors();
    loadSavedData();
  }, [retailerId, visitId]);

  const fetchCompetitors = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_master')
        .select('*')
        .order('competitor_name');

      if (error) throw error;
      setCompetitors(data || []);
    } catch (error) {
      console.error('Error fetching competitors:', error);
      toast({
        title: "Error",
        description: "Failed to load competitors",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSKUs = async (competitorId: string, rowId: string) => {
    try {
      const { data, error } = await supabase
        .from('competition_skus')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('is_active', true);

      if (error) throw error;
      setSkus(prev => ({ ...prev, [rowId]: data || [] }));
    } catch (error) {
      console.error('Error fetching SKUs:', error);
    }
  };

  const loadSavedData = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_data')
        .select('*')
        .eq('visit_id', visitId)
        .eq('retailer_id', retailerId);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedRows = data.map((item, index) => ({
          id: (index + 1).toString(),
          competitorId: item.competitor_id,
          skuId: item.sku_id || "",
          stockQuantity: item.stock_quantity || 0,
          unit: item.unit || "KGS",
          sellingPrice: item.selling_price || 0,
          insight: item.insight || "",
          impactLevel: item.impact_level || "",
          needsAttention: item.needs_attention || false,
          photoUrls: item.photo_urls || [],
          voiceNoteUrls: item.voice_note_urls || []
        }));
        setRows(loadedRows);
        setSavedData(loadedRows);
        
        // Load SKUs for each competitor
        loadedRows.forEach(row => {
          if (row.competitorId) {
            fetchSKUs(row.competitorId, row.id);
          }
        });
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const updateRow = (id: string, field: keyof CompetitionRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        // If competitor is changing, fetch new SKUs and reset SKU selection
        if (field === 'competitorId') {
          fetchSKUs(value, id);
          return { ...row, [field]: value, skuId: "" };
        }
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const addRow = () => {
    const newId = (rows.length + 1).toString();
    setRows([...rows, { 
      id: newId, 
      competitorId: "", 
      skuId: "", 
      stockQuantity: 0, 
      unit: "KGS", 
      sellingPrice: 0, 
      insight: "", 
      impactLevel: "", 
      needsAttention: false, 
      photoUrls: [], 
      voiceNoteUrls: [] 
    }]);
  };

  const deleteRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handlePhotoUpload = async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `competition-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('visits')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      updateRow(id, 'photoUrls', [...rows.find(r => r.id === id)!.photoUrls, filePath]);
      
      toast({
        title: "Success",
        description: "Photo uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive"
      });
    }
  };

  const startRecording = async (id: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPendingVoiceNote({ rowId: id, blob, url });
        stream.getTracks().forEach(track => track.stop());
        
        toast({
          title: "Recording Complete",
          description: "Play to preview, then submit or discard"
        });
      };

      mediaRecorder.start();
      setRecording(id);
      
      toast({
        title: "Recording",
        description: "Voice recording started"
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(null);
    }
  };

  const playPendingVoiceNote = () => {
    if (pendingVoiceNote) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(pendingVoiceNote.url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const discardPendingVoiceNote = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (pendingVoiceNote) {
      URL.revokeObjectURL(pendingVoiceNote.url);
    }
    setPendingVoiceNote(null);
    setIsPlaying(false);
    toast({
      title: "Discarded",
      description: "Voice recording discarded"
    });
  };

  const submitPendingVoiceNote = async () => {
    if (pendingVoiceNote) {
      await uploadVoiceNote(pendingVoiceNote.rowId, pendingVoiceNote.blob);
      URL.revokeObjectURL(pendingVoiceNote.url);
      setPendingVoiceNote(null);
      setIsPlaying(false);
    }
  };

  const uploadVoiceNote = async (id: string, blob: Blob) => {
    try {
      const fileName = `${Date.now()}.webm`;
      const filePath = `voice-notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('visits')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      updateRow(id, 'voiceNoteUrls', [...rows.find(r => r.id === id)!.voiceNoteUrls, filePath]);
      
      toast({
        title: "Success",
        description: "Voice note uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading voice note:', error);
      toast({
        title: "Error",
        description: "Failed to upload voice note",
        variant: "destructive"
      });
    }
  };

  const saveData = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete existing entries for this visit
      await supabase
        .from('competition_data')
        .delete()
        .eq('visit_id', visitId)
        .eq('retailer_id', retailerId);

      // Insert new entries
      const entries = rows
        .filter(row => row.competitorId && row.skuId)
        .map(row => ({
          competitor_id: row.competitorId,
          sku_id: row.skuId,
          stock_quantity: row.stockQuantity,
          unit: row.unit,
          selling_price: row.sellingPrice,
          insight: row.insight,
          impact_level: row.impactLevel,
          needs_attention: row.needsAttention,
          photo_urls: row.photoUrls,
          voice_note_urls: row.voiceNoteUrls,
          retailer_id: retailerId,
          visit_id: visitId,
          user_id: user.id
        }));

      if (entries.length > 0) {
        const { error } = await supabase
          .from('competition_data')
          .insert(entries);

        if (error) throw error;

        // Award gamification points for competition data
        const { awardPointsForCompetitionData } = await import('@/utils/gamificationPointsAwarder');
        await awardPointsForCompetitionData(user.id, retailerId);
      }

      toast({
        title: "Success",
        description: "Competition data saved successfully"
      });
      
      setSavedData(rows);
      setIsEditMode(false);
      onSave();
    } catch (error) {
      console.error('Error saving data:', error);
      toast({
        title: "Error",
        description: "Failed to save competition data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  // Display mode - show saved data
  if (!isEditMode && savedData.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Competition Data</h3>
          <Button onClick={() => setIsEditMode(true)} variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
        
        <div className="space-y-4">
          {savedData.map((row) => {
            const competitor = competitors.find(c => c.id === row.competitorId);
            const sku = skus[row.id]?.find(s => s.id === row.skuId);
            
            return (
              <Card key={row.id}>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Competition Name</p>
                    <p className="font-medium">{competitor?.competitor_name || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Competition SKU</p>
                      <p className="font-medium">{sku?.sku_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unit</p>
                      <p className="font-medium">{row.unit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stock Quantity</p>
                      <p className="font-medium">{row.stockQuantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Selling Price</p>
                      <p className="font-medium">₹{row.sellingPrice}</p>
                    </div>
                  </div>
                  {(row.insight || row.impactLevel || row.needsAttention) && (
                    <div className="pt-4 border-t space-y-2">
                      {row.insight && (
                        <div>
                          <p className="text-sm text-muted-foreground">Retailer Feedback</p>
                          <p className="font-medium">{row.insight}</p>
                        </div>
                      )}
                      {row.impactLevel && (
                        <div>
                          <p className="text-sm text-muted-foreground">Impact Level</p>
                          <p className="font-medium">{row.impactLevel}</p>
                        </div>
                      )}
                      {row.needsAttention && (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">Needs Attention</p>
                          <span className="text-destructive font-medium">Yes</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Edit mode - show form with tabs
  return (
    <div className="space-y-6">
      <Card>
            <CardHeader>
              <CardTitle>Competition Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={row.id} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Entry {index + 1}</span>
                      <Button
                        onClick={() => deleteRow(row.id)}
                        variant="ghost"
                        size="sm"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Competition Name Selection */}
                    <div>
                      <Label className="text-xs">Competition Name</Label>
                      <Select
                        value={row.competitorId}
                        onValueChange={(value) => updateRow(row.id, 'competitorId', value)}
                      >
                        <SelectTrigger className="mt-1 h-10">
                          <SelectValue placeholder="Select competitor" />
                        </SelectTrigger>
                        <SelectContent>
                          {competitors.map((comp) => (
                            <SelectItem key={comp.id} value={comp.id}>
                              {comp.competitor_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Competition SKU with Search */}
                    <div>
                      <Label className="text-xs">Competition SKU</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={!row.competitorId}
                            className={cn(
                              "w-full justify-between mt-1 h-10",
                              !row.skuId && "text-muted-foreground"
                            )}
                          >
                            {row.skuId
                              ? (skus[row.id] || []).find((sku) => sku.id === row.skuId)?.sku_name
                              : "Select competition SKU"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search competition SKU..." />
                            <CommandList>
                              <CommandEmpty>No competition SKU found.</CommandEmpty>
                              <CommandGroup>
                                {(skus[row.id] || []).map((sku) => (
                                  <CommandItem
                                    key={sku.id}
                                    value={sku.sku_name}
                                    onSelect={() => {
                                      updateRow(row.id, 'skuId', sku.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        row.skuId === sku.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {sku.sku_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Compact row for Unit, Stock, Price */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={row.unit}
                          onValueChange={(value) => updateRow(row.id, 'unit', value)}
                        >
                          <SelectTrigger className="h-10 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KGS">KGS</SelectItem>
                            <SelectItem value="LTRS">LTRS</SelectItem>
                            <SelectItem value="UNITS">UNITS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Stock Qty</Label>
                        <Input
                          type="number"
                          value={row.stockQuantity === 0 ? '' : row.stockQuantity}
                          onChange={(e) => updateRow(row.id, 'stockQuantity', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="h-10 mt-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Price (₹)</Label>
                        <Input
                          type="number"
                          value={row.sellingPrice === 0 ? '' : row.sellingPrice}
                          onChange={(e) => updateRow(row.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="h-10 mt-1"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Action icons row: Need attention, Photo, Voice */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`attention-${row.id}`}
                          checked={row.needsAttention}
                          onCheckedChange={(checked) => updateRow(row.id, 'needsAttention', checked)}
                        />
                        <Label htmlFor={`attention-${row.id}`} className="text-xs cursor-pointer">
                          Need Attention
                        </Label>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(row.id, e)}
                          className="hidden"
                          id={`photo-${row.id}`}
                        />
                        <Button
                          onClick={() => document.getElementById(`photo-${row.id}`)?.click()}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Camera className="h-4 w-4" />
                          {row.photoUrls.length > 0 && (
                            <span className="ml-1 text-xs">({row.photoUrls.length})</span>
                          )}
                        </Button>

                        {/* Voice Recording Button */}
                        {pendingVoiceNote?.rowId === row.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={playPendingVoiceNote}
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={isPlaying}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={submitPendingVoiceNote}
                              variant="default"
                              size="sm"
                              className="h-8 bg-green-600 hover:bg-green-700"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={discardPendingVoiceNote}
                              variant="destructive"
                              size="sm"
                              className="h-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => recording === row.id ? stopRecording() : startRecording(row.id)}
                            variant={recording === row.id ? "destructive" : "outline"}
                            size="sm"
                            className="h-8"
                            disabled={pendingVoiceNote !== null}
                          >
                            {recording === row.id ? (
                              <Square className="h-4 w-4" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                            {!recording && row.voiceNoteUrls.length > 0 && (
                              <span className="ml-1 text-xs">({row.voiceNoteUrls.length})</span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Row button below all entries */}
                <Button onClick={addRow} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </div>
            </CardContent>
          </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {savedData.length > 0 && (
          <Button onClick={() => setIsEditMode(false)} variant="outline">
            Cancel
          </Button>
        )}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Add Notes
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Notes</DialogTitle>
              <DialogDescription>
                Add any notes for all competitors
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your notes here..."
              className="min-h-[150px]"
            />
            <Button onClick={() => setNotesDialogOpen(false)}>
              Done
            </Button>
          </DialogContent>
        </Dialog>
        <Button onClick={saveData} disabled={saving}>
          {saving ? "Saving..." : "Save All Data"}
        </Button>
      </div>
    </div>
  );
}