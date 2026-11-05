import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, Volume2, Filter, X } from "lucide-react";
// xlsx loaded dynamically in handler
import { downloadExcel } from "@/utils/fileDownloader";

interface CompetitionDataListProps {
  data: any[];
  skus: any[];
}

export function CompetitionDataList({ data, skus }: CompetitionDataListProps) {
  const navigate = useNavigate();
  const [filterRetailer, setFilterRetailer] = useState("");
  const [filterImpact, setFilterImpact] = useState("all");
  const [filterAttention, setFilterAttention] = useState("all");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);

  const filteredData = data.filter(item => {
    if (filterRetailer && !item.retailers?.name?.toLowerCase().includes(filterRetailer.toLowerCase())) {
      return false;
    }
    if (filterImpact !== "all" && item.impact_level !== filterImpact) {
      return false;
    }
    if (filterAttention !== "all") {
      const needsAttention = item.needs_attention ? "yes" : "no";
      if (needsAttention !== filterAttention) return false;
    }
    return true;
  });

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = filteredData.map(item => ({
      "SKU Name": skus.find(s => s.id === item.sku_id)?.sku_name || 'Unknown',
      "Retailer": item.retailers?.name || 'N/A',
      "Date": item.visits?.planned_date ? new Date(item.visits.planned_date).toLocaleDateString() : new Date(item.created_at).toLocaleDateString(),
      "Stock Quantity": item.stock_quantity,
      "Unit": item.unit,
      "Selling Price": item.selling_price || 0,
      "Insight": item.insight || 'N/A',
      "Retailer Feedback": item.impact_level || 'N/A',
      "Needs Attention": item.needs_attention ? 'Yes' : 'No',
      "Photos": item.photo_urls?.length || 0,
      "Voice Notes": item.voice_note_urls?.length || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Competition Data");
    await downloadExcel(wb, `competition_data_${new Date().toISOString().split('T')[0]}.xlsx`, XLSX);
  };

  const clearFilters = () => {
    setFilterRetailer("");
    setFilterImpact("all");
    setFilterAttention("all");
  };

  const hasActiveFilters = filterRetailer || filterImpact !== "all" || filterAttention !== "all";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Retailer</label>
          <Input
            placeholder="Filter by retailer..."
            value={filterRetailer}
            onChange={(e) => setFilterRetailer(e.target.value)}
          />
        </div>
        <div className="w-[150px]">
          <label className="text-sm font-medium mb-1 block">Retailer Feedback</label>
          <Select value={filterImpact} onValueChange={setFilterImpact}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[150px]">
          <label className="text-sm font-medium mb-1 block">Attention</label>
          <Select value={filterAttention} onValueChange={setFilterAttention}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Needs Attention</SelectItem>
              <SelectItem value="no">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
        <Button onClick={exportToExcel} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Desktop Data Table */}
      <div className="border rounded-lg hidden md:block">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU Name</TableHead>
                <TableHead>Retailer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Competition Stock</TableHead>
                <TableHead>Retailer Feedback</TableHead>
                <TableHead>Media</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {skus.find(s => s.id === item.sku_id)?.sku_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto hover:underline"
                        onClick={() => navigate(`/retailer/${item.retailer_id}`)}
                      >
                        {item.retailers?.name || 'N/A'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {item.visits?.planned_date 
                        ? new Date(item.visits.planned_date).toLocaleDateString()
                        : new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">{item.stock_quantity}</span> {item.unit}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ₹{item.selling_price || 0}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 max-w-[200px]">
                        {item.impact_level && (
                          <Badge variant={
                            item.impact_level === 'positive' ? 'default' :
                            item.impact_level === 'negative' ? 'destructive' : 'secondary'
                          }>
                            {item.impact_level.charAt(0).toUpperCase() + item.impact_level.slice(1)}
                          </Badge>
                        )}
                        {item.insight && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {item.insight.replace('_', ' ')}
                          </div>
                        )}
                        {item.needs_attention && (
                          <Badge variant="destructive" className="text-xs">Action Required</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {item.photo_urls && item.photo_urls.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedImages(item.photo_urls);
                              setShowImageDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {item.photo_urls.length}
                          </Button>
                        )}
                        {item.voice_note_urls && item.voice_note_urls.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAudio(item.voice_note_urls[0]);
                              setShowAudioDialog(true);
                            }}
                          >
                            <Volume2 className="h-4 w-4 mr-1" />
                            {item.voice_note_urls.length}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredData.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No data found
            </CardContent>
          </Card>
        ) : (
          filteredData.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm break-words">
                      {skus.find(s => s.id === item.sku_id)?.sku_name || 'Unknown'}
                    </div>
                    <Button
                      variant="link"
                      className="p-0 h-auto hover:underline text-xs"
                      onClick={() => navigate(`/retailer/${item.retailer_id}`)}
                    >
                      {item.retailers?.name || 'N/A'}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {item.visits?.planned_date 
                      ? new Date(item.visits.planned_date).toLocaleDateString()
                      : new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Competition Stock Section */}
                <div className="space-y-1 bg-muted/30 p-2 rounded">
                  <div className="text-xs font-medium text-muted-foreground">Competition Stock</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="ml-1 font-medium">{item.stock_quantity} {item.unit}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price:</span>
                      <span className="ml-1 font-medium">₹{item.selling_price || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Retailer Feedback Section */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Retailer Feedback</div>
                  {item.insight && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Insight:</span>
                      <span className="ml-1 capitalize">{item.insight.replace('_', ' ')}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {item.impact_level && (
                      <Badge variant={
                        item.impact_level === 'positive' ? 'default' :
                        item.impact_level === 'negative' ? 'destructive' : 'secondary'
                      } className="text-xs">
                        {item.impact_level.charAt(0).toUpperCase() + item.impact_level.slice(1)}
                      </Badge>
                    )}
                    {item.needs_attention && (
                      <Badge variant="destructive" className="text-xs">Action Required</Badge>
                    )}
                  </div>
                </div>

                {((item.photo_urls && item.photo_urls.length > 0) || (item.voice_note_urls && item.voice_note_urls.length > 0)) && (
                  <div className="flex gap-2 pt-2 border-t">
                    {item.photo_urls && item.photo_urls.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedImages(item.photo_urls);
                          setShowImageDialog(true);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {item.photo_urls.length} Photo{item.photo_urls.length > 1 ? 's' : ''}
                      </Button>
                    )}
                    {item.voice_note_urls && item.voice_note_urls.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedAudio(item.voice_note_urls[0]);
                          setShowAudioDialog(true);
                        }}
                      >
                        <Volume2 className="h-3 w-3 mr-1" />
                        {item.voice_note_urls.length} Audio
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Competition Photos</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-auto">
            {selectedImages.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Competition photo ${idx + 1}`}
                className="w-full rounded-lg border"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audio Player Dialog */}
      <Dialog open={showAudioDialog} onOpenChange={setShowAudioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Note</DialogTitle>
          </DialogHeader>
          {selectedAudio && (
            <audio controls className="w-full">
              <source src={selectedAudio} type="audio/webm" />
              Your browser does not support the audio element.
            </audio>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
