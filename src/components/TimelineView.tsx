import React, { useState } from 'react';
import { Clock, MapPin, ShoppingCart, Package, Download, CalendarIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
// jspdf loaded dynamically in handler
import { downloadPDF } from '@/utils/fileDownloader';

interface Visit {
  id: string;
  retailer_name: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_address?: string;
  status: string;
  order_value?: number;
  order_quantity?: number;
  no_order_reason?: string;
  activity_time?: string;
  is_joint_sales?: boolean;
  time_spent_seconds?: number;
}

interface TimelineViewProps {
  visits: Visit[];
  dayStart?: string;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ 
  visits, 
  dayStart = '08:10 AM',
  selectedDate = new Date(),
  onDateChange 
}) => {
  // Sort visits by activity_time (when order/no-order/feedback happened), already sorted from backend
  const sortedVisits = [...visits];

  const calculateTimeDifference = (time1: string, time2?: string): string => {
    if (!time2) return '0 Min';
    
    const date1 = new Date(time1);
    const date2 = new Date(time2);
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} Min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTimeSpentFromSeconds = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return 'In Progress';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatQuantityInKG = (quantityInGrams: number): string => {
    const kg = quantityInGrams / 1000;
    if (kg < 1) {
      return `${quantityInGrams} g`;
    }
    return kg % 1 === 0 ? `${kg} KG` : `${kg.toFixed(2)} KG`;
  };

  const formatNoOrderReason = (reason?: string): string => {
    if (!reason) return 'No order placed';
    return reason.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TIMELINE REPORT', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;

    // Day Start
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`DAY START: ${dayStart}`, 20, yPosition);
    yPosition += 10;

    // Visits
    sortedVisits.forEach((visit, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      const travelTime = index > 0 
        ? calculateTimeDifference(sortedVisits[index - 1].check_out_time || sortedVisits[index - 1].check_in_time, visit.check_in_time)
        : '0 Min';
      
      const timeSpent = visit.check_out_time 
        ? calculateTimeDifference(visit.check_in_time, visit.check_out_time)
        : 'In Progress';

      // Travel time
      if (index > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Travel Time: ${travelTime}`, pageWidth - 20, yPosition, { align: 'right' });
        yPosition += 6;
      }

      // Visit header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${visit.retailer_name}`, 20, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Time - show activity time (when order/no-order was recorded)
      const displayTime = visit.activity_time ? format(new Date(visit.activity_time), 'hh:mm a') : format(new Date(visit.check_in_time), 'hh:mm a');
      doc.text(`Activity Time: ${displayTime}`, 25, yPosition);
      yPosition += 5;
      
      doc.text(`Time Spent: ${timeSpent}`, 25, yPosition);
      yPosition += 5;

      // Address
      if (visit.check_in_address) {
        const addressLines = doc.splitTextToSize(visit.check_in_address, pageWidth - 50);
        doc.text(addressLines, 25, yPosition);
        yPosition += addressLines.length * 5;
      }

      // Order or reason
      if (visit.order_value && visit.order_value > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Order Value: ₹${visit.order_value.toLocaleString('en-IN')}`, 25, yPosition);
        if (visit.order_quantity) {
          doc.text(`Qty: ${visit.order_quantity}`, 100, yPosition);
        }
        if (visit.is_joint_sales) {
          yPosition += 5;
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(147, 51, 234);
          doc.text('Joint Sales Visit', 25, yPosition);
          doc.setTextColor(0, 0, 0);
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.text(`Reason: ${formatNoOrderReason(visit.no_order_reason)}`, 25, yPosition);
        if (visit.is_joint_sales) {
          yPosition += 5;
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(147, 51, 234);
          doc.text('Joint Sales Visit', 25, yPosition);
          doc.setTextColor(0, 0, 0);
        }
      }
      
      yPosition += 10;
    });

    // Day End
    if (sortedVisits.length > 0 && sortedVisits[sortedVisits.length - 1].check_out_time) {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`DAY END: ${format(new Date(sortedVisits[sortedVisits.length - 1].check_out_time!), 'hh:mm a')}`, 20, yPosition);
    }

    const pdfBlob = doc.output('blob');
    await downloadPDF(pdfBlob, `timeline-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'productive':
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500 text-white">In Progress</Badge>;
      case 'unproductive':
        return <Badge className="bg-orange-500 text-white">Unproductive</Badge>;
      case 'store-closed':
        return <Badge className="bg-red-500 text-white">Store Closed</Badge>;
      case 'skipped':
      case 'cancelled':
        return <Badge className="bg-gray-500 text-white">Skipped</Badge>;
      case 'planned':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Planned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-full overflow-x-hidden">
      {/* Header with Date Picker and Download Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-2xl font-bold text-primary mb-2">TIMELINE</h2>
          <div className="h-1 w-24 bg-primary mx-auto sm:mx-0"></div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange?.(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Download Button */}
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Day Start */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className="w-4 h-4 rounded-full bg-green-500 border-4 border-green-200"></div>
          <div className="w-0.5 h-16 bg-gradient-to-b from-green-500 to-primary"></div>
        </div>
        <div className="flex-1 -mt-1">
          <div className="font-semibold text-lg">DAY START</div>
          <div className="text-muted-foreground">{dayStart}</div>
        </div>
      </div>

      {/* Timeline Items */}
      {sortedVisits.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No activities recorded for this date.</p>
          <p className="text-sm mt-2">Activities will appear here once you place orders or record no-order reasons.</p>
        </div>
      )}
      
      {sortedVisits.map((visit, index) => {
        const travelTime = index > 0 
          ? calculateTimeDifference(sortedVisits[index - 1].check_out_time || sortedVisits[index - 1].check_in_time, visit.check_in_time)
          : '0 Min';
        
        // Use pre-calculated time_spent_seconds if available
        const timeSpent = visit.time_spent_seconds 
          ? formatTimeSpentFromSeconds(visit.time_spent_seconds)
          : visit.check_out_time 
            ? calculateTimeDifference(visit.check_in_time, visit.check_out_time)
            : 'In Progress';
        
        return (
          <div key={visit.id} className="relative">

            {/* Visit Card */}
            <div className="flex items-start gap-2 sm:gap-4 w-full">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-primary border-4 border-primary/20"></div>
                {index < sortedVisits.length - 1 && (
                  <div className="w-0.5 h-32 bg-gradient-to-b from-primary to-primary/30"></div>
                )}
              </div>

              <Card className="flex-1 min-w-0 p-3 sm:p-4 bg-card hover:shadow-md transition-shadow">
                {/* Visit Header */}
                {/* Visit Header - Simplified badges */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-primary/10 text-xs">OUTLET</Badge>
                    {visit.order_value && visit.order_value > 0 ? (
                      <Badge className="bg-green-500 text-xs">ORDER PLACED</Badge>
                    ) : (
                      getStatusBadge(visit.status)
                    )}
                    {visit.is_joint_sales && (
                      <Badge className="bg-purple-500 text-white text-xs">🤝 JOINT</Badge>
                    )}
                  </div>
                </div>

                {/* Retailer Name */}
                <h3 className="text-base sm:text-lg font-semibold mb-2 break-words">{visit.retailer_name}</h3>

                {/* Location Icon - Opens in Google Maps */}
                {visit.check_in_address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.check_in_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary hover:text-primary/80 mb-2 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MapPin className="w-4 h-4" />
                  </a>
                )}

                {/* Visit Timing Details */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                  {visit.check_in_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-green-500" />
                      <span>In: <strong>{format(new Date(visit.check_in_time), 'hh:mm a')}</strong></span>
                    </div>
                  )}
                  {visit.check_out_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-red-500" />
                      <span>Out: <strong>{format(new Date(visit.check_out_time), 'hh:mm a')}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Duration: <strong>{timeSpent}</strong></span>
                  </div>
                </div>

                {/* Order Details or Unproductive Reason */}
                {visit.order_value && visit.order_value > 0 ? (
                  <Card className="p-3 sm:p-4 bg-muted/50 border-none">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-base sm:text-lg font-bold">
                          Rs. {visit.order_value.toLocaleString('en-IN', {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {visit.order_quantity && visit.order_quantity > 0 && (
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-base sm:text-lg font-bold">
                            Qty: {formatQuantityInKG(visit.order_quantity)}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card className="p-2 sm:p-3 bg-muted/50 border-none">
                    <div className="flex items-start gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        <strong>Reason:</strong> {formatNoOrderReason(visit.no_order_reason)}
                      </span>
                    </div>
                  </Card>
                )}
              </Card>
            </div>
          </div>
        );
      })}

      {/* Day End (if last visit has check out) */}
      {sortedVisits.length > 0 && sortedVisits[sortedVisits.length - 1].check_out_time && (
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-red-500 border-4 border-red-200"></div>
          </div>
          <div className="flex-1 -mt-1">
            <div className="font-semibold text-lg">DAY END</div>
            <div className="text-muted-foreground">
              {format(new Date(sortedVisits[sortedVisits.length - 1].check_out_time!), 'hh:mm a')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
