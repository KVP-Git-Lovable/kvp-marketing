import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Volume2, VolumeX, Mic, MicOff, Send, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useReportVoiceChat } from "@/hooks/useReportVoiceChat";
import { useIsMobile } from "@/hooks/use-mobile";

// Indian number formatting helpers
const formatINR = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatKG = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' KG';
};

interface UserOrderSummary {
  full_name: string;
  total_order_value: number;
}

interface SKUData {
  product_name: string;
  quantity_sold: number;
  revenue: number;
  unit: string;
}

interface UserProductivitySummary {
  full_name: string;
  productivity_percentage: number;
  productive_visits: number;
  total_visits: number;
}

interface ReportSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  dateRange: { from: Date; to: Date };
  allUsersSummary: {
    retailers: number;
    beats: number;
    products: number;
    totalKg: number;
  } | null;
  orderSummaryData: UserOrderSummary[];
  skuData: SKUData[];
  productivityData: UserProductivitySummary[];
}

export const ReportSummaryDialog = ({
  open,
  onClose,
  dateRange,
  allUsersSummary,
  orderSummaryData,
  skuData,
  productivityData
}: ReportSummaryDialogProps) => {
  const [textInput, setTextInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Memoize report context to prevent unnecessary re-renders
  const reportContext = useMemo(() => ({
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    allUsersSummary,
    orderSummaryData,
    skuData,
    productivityData,
  }), [
    dateRange.from.getTime(),
    dateRange.to.getTime(),
    allUsersSummary?.retailers,
    allUsersSummary?.beats,
    allUsersSummary?.products,
    allUsersSummary?.totalKg,
    orderSummaryData.length,
    skuData.length,
    productivityData.length,
  ]);

  const {
    messages,
    isRecording,
    isProcessing,
    isPlaying,
    transcript,
    startRecording,
    stopRecording,
    sendMessage,
    playSummary,
    stopAllAudio,
  } = useReportVoiceChat(reportContext);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stop all audio when dialog closes
  useEffect(() => {
    if (!open) {
      stopAllAudio();
    }
  }, [open, stopAllAudio]);

  const generateSummary = (): string => {
    const parts: string[] = [];
    
    // Date range header
    const fromStr = dateRange.from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const toStr = dateRange.to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    parts.push(`📊 Supervisor Report Summary\n${fromStr} to ${toStr}`);
    
    // Summary - All Users
    if (allUsersSummary) {
      parts.push(`\n📈 Overall Summary\nThe team covered ${allUsersSummary.retailers} retailers across ${allUsersSummary.beats} beats, handling ${allUsersSummary.products} products with a total quantity of ${formatKG(allUsersSummary.totalKg)}.`);
    }
    
    // Total Order Summary
    if (orderSummaryData.length > 0) {
      const totalOrderValue = orderSummaryData.reduce((sum, u) => sum + u.total_order_value, 0);
      const topOrderUser = orderSummaryData[0];
      let orderText = `\n🛒 Order Summary\nA total of ${orderSummaryData.length} team members generated orders worth ${formatINR(totalOrderValue)}.`;
      if (topOrderUser) {
        orderText += ` The top performer in orders was ${topOrderUser.full_name} with ${formatINR(topOrderUser.total_order_value)}.`;
      }
      parts.push(orderText);
    }
    
    // SKU Revenue Summary
    if (skuData.length > 0) {
      const totalRevenue = skuData.reduce((sum, s) => sum + s.revenue, 0);
      const totalKg = skuData.reduce((sum, s) => {
        const unit = (s.unit || '').toLowerCase();
        if (unit === 'grams' || unit === 'g' || unit === 'gram') {
          return sum + s.quantity_sold / 1000;
        }
        return sum + s.quantity_sold;
      }, 0);
      const topProduct = skuData.reduce((max, s) => s.revenue > max.revenue ? s : max, skuData[0]);
      
      let skuText = `\n📦 Product Performance\nAcross ${skuData.length} SKUs, the team achieved ${formatINR(totalRevenue)} in revenue with ${formatKG(totalKg)} sold.`;
      if (topProduct) {
        skuText += ` The best-selling product was ${topProduct.product_name}, contributing ${formatINR(topProduct.revenue)} in revenue.`;
      }
      parts.push(skuText);
    }
    
    // Productivity Summary
    if (productivityData.length > 0) {
      const totalProductive = productivityData.reduce((sum, p) => sum + p.productive_visits, 0);
      const totalVisits = productivityData.reduce((sum, p) => sum + p.total_visits, 0);
      const avgProductivity = totalVisits > 0 ? (totalProductive / totalVisits) * 100 : 0;
      const topProductiveUser = productivityData.reduce((max, p) => 
        p.productivity_percentage > max.productivity_percentage ? p : max, productivityData[0]
      );
      
      let productivityText = `\n⚡ Productivity Insights\nOut of ${totalVisits} total visits, ${totalProductive} were productive, resulting in an overall productivity rate of ${avgProductivity.toFixed(1)}%.`;
      if (topProductiveUser) {
        productivityText += ` ${topProductiveUser.full_name} led the team with ${topProductiveUser.productivity_percentage.toFixed(1)}% productivity.`;
      }
      parts.push(productivityText);
    }
    
    // Top Performers Section
    const performers: string[] = [];
    if (orderSummaryData.length > 0) {
      performers.push(`${orderSummaryData[0].full_name} for highest orders`);
    }
    if (skuData.length > 0) {
      const topSKU = skuData.reduce((max, s) => s.revenue > max.revenue ? s : max, skuData[0]);
      performers.push(`${topSKU.product_name} as the best-selling product`);
    }
    if (productivityData.length > 0) {
      const topProductiveUser = productivityData.reduce((max, p) => 
        p.productivity_percentage > max.productivity_percentage ? p : max, productivityData[0]
      );
      performers.push(`${topProductiveUser.full_name} for highest productivity`);
    }
    
    if (performers.length > 0) {
      parts.push(`\n🏆 Top Performers\n${performers.join(', ')}.`);
    }
    
    return parts.join('\n');
  };

  // Generate spoken version (without emojis for TTS)
  const generateSpokenSummary = (): string => {
    const parts: string[] = [];
    
    const fromStr = dateRange.from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const toStr = dateRange.to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    parts.push(`Supervisor Report Summary from ${fromStr} to ${toStr}.`);
    
    if (allUsersSummary) {
      parts.push(`Overall Summary: ${allUsersSummary.retailers} retailers, ${allUsersSummary.beats} beats, ${allUsersSummary.products} products, and ${formatKG(allUsersSummary.totalKg)} total quantity.`);
    }
    
    if (orderSummaryData.length > 0) {
      const totalOrderValue = orderSummaryData.reduce((sum, u) => sum + u.total_order_value, 0);
      const topOrderUser = orderSummaryData[0];
      parts.push(`Order Summary: ${orderSummaryData.length} users with total order value of ${formatINR(totalOrderValue)}. Top performer is ${topOrderUser?.full_name} with ${formatINR(topOrderUser?.total_order_value || 0)}.`);
    }
    
    if (skuData.length > 0) {
      const totalRevenue = skuData.reduce((sum, s) => sum + s.revenue, 0);
      const topProduct = skuData.reduce((max, s) => s.revenue > max.revenue ? s : max, skuData[0]);
      parts.push(`SKU Revenue Summary: ${skuData.length} SKUs with total revenue of ${formatINR(totalRevenue)}. Best selling product is ${topProduct?.product_name}.`);
    }
    
    if (productivityData.length > 0) {
      const totalProductive = productivityData.reduce((sum, p) => sum + p.productive_visits, 0);
      const totalVisits = productivityData.reduce((sum, p) => sum + p.total_visits, 0);
      const avgProductivity = totalVisits > 0 ? (totalProductive / totalVisits) * 100 : 0;
      const topProductiveUser = productivityData.reduce((max, p) => 
        p.productivity_percentage > max.productivity_percentage ? p : max, productivityData[0]
      );
      parts.push(`Productivity Summary: ${totalProductive} productive visits out of ${totalVisits} total, with overall productivity of ${avgProductivity.toFixed(1)} percent. Most productive user is ${topProductiveUser?.full_name} with ${topProductiveUser?.productivity_percentage.toFixed(1)} percent.`);
    }
    
    return parts.join(' ');
  };

  // Generate Hindi spoken version for TTS
  const generateHindiSpokenSummary = (): string => {
    const parts: string[] = [];
    
    const fromStr = dateRange.from.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const toStr = dateRange.to.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    parts.push(`सुपरवाइजर रिपोर्ट सारांश, ${fromStr} से ${toStr} तक।`);
    
    if (allUsersSummary) {
      parts.push(`कुल सारांश: ${allUsersSummary.retailers} रिटेलर्स, ${allUsersSummary.beats} बीट्स, ${allUsersSummary.products} प्रोडक्ट्स, और कुल ${formatKG(allUsersSummary.totalKg)} मात्रा।`);
    }
    
    if (orderSummaryData.length > 0) {
      const totalOrderValue = orderSummaryData.reduce((sum, u) => sum + u.total_order_value, 0);
      const topOrderUser = orderSummaryData[0];
      parts.push(`ऑर्डर सारांश: ${orderSummaryData.length} यूजर्स ने कुल ${formatINR(totalOrderValue)} का ऑर्डर किया। सबसे अच्छा प्रदर्शन ${topOrderUser?.full_name} का रहा, जिन्होंने ${formatINR(topOrderUser?.total_order_value || 0)} का ऑर्डर लिया।`);
    }
    
    if (skuData.length > 0) {
      const totalRevenue = skuData.reduce((sum, s) => sum + s.revenue, 0);
      const topProduct = skuData.reduce((max, s) => s.revenue > max.revenue ? s : max, skuData[0]);
      parts.push(`SKU रेवेन्यू सारांश: ${skuData.length} SKUs से कुल ${formatINR(totalRevenue)} की आय हुई। सबसे ज्यादा बिकने वाला प्रोडक्ट ${topProduct?.product_name} है।`);
    }
    
    if (productivityData.length > 0) {
      const totalProductive = productivityData.reduce((sum, p) => sum + p.productive_visits, 0);
      const totalVisits = productivityData.reduce((sum, p) => sum + p.total_visits, 0);
      const avgProductivity = totalVisits > 0 ? (totalProductive / totalVisits) * 100 : 0;
      const topProductiveUser = productivityData.reduce((max, p) => 
        p.productivity_percentage > max.productivity_percentage ? p : max, productivityData[0]
      );
      parts.push(`प्रोडक्टिविटी सारांश: कुल ${totalVisits} विज़िट्स में से ${totalProductive} प्रोडक्टिव रहीं, जिसमें कुल प्रोडक्टिविटी ${avgProductivity.toFixed(1)} प्रतिशत रही। सबसे ज्यादा प्रोडक्टिव ${topProductiveUser?.full_name} रहे, जिनकी प्रोडक्टिविटी ${topProductiveUser?.productivity_percentage.toFixed(1)} प्रतिशत रही।`);
    }
    
    return parts.join(' ');
  };

  const summary = generateSummary();
  
  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
  };

  const handlePlaySummary = () => {
    if (isPlaying) {
      stopAllAudio();
    } else {
      const spokenSummary = generateSpokenSummary();
      playSummary(spokenSummary, 'RC0x4iZi3WQKkwkGubnK');
    }
  };

  const handlePlayHindiSummary = () => {
    if (isPlaying) {
      stopAllAudio();
    } else {
      const hindiSummary = generateHindiSpokenSummary();
      playSummary(hindiSummary, 'eyVoIoi3vo6sJoHOKgAc');
    }
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? 'max-w-[95vw]' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Report Summary
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">
          {/* Summary Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Summary</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[200px] rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed p-4 bg-muted/50">
                {summary}
              </pre>
            </ScrollArea>
          </div>

          {/* Chat Toggle */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowChat(!showChat)}
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {showChat ? 'Hide Chat' : 'Ask questions about this report'}
          </Button>

          {/* Chat Section */}
          {showChat && (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              {/* Messages Area */}
              <div className="h-[200px] rounded-lg border bg-muted/30">
                <ScrollArea className="h-full">
                  <div className="space-y-3 p-3">
                    {messages.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Ask any question about the report data using voice or text
                      </p>
                    )}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background border'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-background border rounded-lg px-3 py-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2 italic">
                  "{transcript}"
                </div>
              )}

              {/* Input Area */}
              <div className="flex gap-2">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={handleMicClick}
                  disabled={isProcessing}
                  className={`shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your question..."
                  disabled={isProcessing || isRecording}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSendText}
                  disabled={!textInput.trim() || isProcessing}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
