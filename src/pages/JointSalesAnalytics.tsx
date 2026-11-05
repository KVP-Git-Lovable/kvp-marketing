import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { UserCheck, TrendingUp, Store, IndianRupee, CalendarIcon, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// jspdf, jspdf-autotable loaded dynamically in handler
import { downloadPDF } from "@/utils/fileDownloader";

export default function JointSalesAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [analytics, setAnalytics] = useState({
    totalVisits: 0,
    totalRetailers: 0,
    totalOrderIncrease: 0,
    avgFeedbackScore: 0
  });
  const [feedbackList, setFeedbackList] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadMembers();
      loadAnalytics();
    }
  }, [user, selectedMember, dateRange]);

  const loadMembers = async () => {
    try {
      // Get all unique user IDs from joint sales feedback (both managers and FSEs)
      const { data: feedbackData } = await supabase
        .from('joint_sales_feedback')
        .select('manager_id, fse_user_id');

      const uniqueUserIds = new Set<string>();
      feedbackData?.forEach(f => {
        if (f.manager_id) uniqueUserIds.add(f.manager_id);
        if (f.fse_user_id) uniqueUserIds.add(f.fse_user_id);
      });

      if (uniqueUserIds.size === 0) {
        setMembers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', Array.from(uniqueUserIds));

      const membersList = (profiles || []).map(p => ({
        id: p.id,
        name: p.full_name || p.username || 'Unknown'
      }));

      setMembers(membersList);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Query feedback - include both manager and FSE perspectives
      let query = supabase
        .from('joint_sales_feedback')
        .select(`
          *,
          retailers(name, address),
          manager:profiles!joint_sales_feedback_manager_id_fkey(full_name, username),
          fse:profiles!joint_sales_feedback_fse_user_id_fkey(full_name, username)
        `)
        .gte('feedback_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('feedback_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedMember && selectedMember !== 'all') {
        // Filter by either manager_id or fse_user_id
        query = query.or(`manager_id.eq.${selectedMember},fse_user_id.eq.${selectedMember}`);
      }

      const { data: feedback, error } = await query;

      if (error) throw error;

      const totalRetailers = new Set(feedback?.map(f => f.retailer_id) || []).size;
      const totalOrderIncrease = feedback?.reduce((sum, f) => sum + (f.order_increase_amount || 0), 0) || 0;

      setAnalytics({
        totalVisits: feedback?.length || 0,
        totalRetailers,
        totalOrderIncrease,
        avgFeedbackScore: feedback?.length || 0
      });

      setFeedbackList(feedback || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Joint Sales Analytics Report', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Period: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, 14, 30);
    
    doc.setFontSize(12);
    doc.text(`Total Visits: ${analytics.totalVisits}`, 14, 45);
    doc.text(`Total Retailers: ${analytics.totalRetailers}`, 14, 52);
    doc.text(`Total Order Increase: ₹${analytics.totalOrderIncrease.toLocaleString('en-IN')}`, 14, 59);

    const tableData = feedbackList.map(f => [
      f.retailers?.name || 'Unknown',
      format(new Date(f.created_at), 'dd MMM yyyy'),
      `₹${(f.order_increase_amount || 0).toLocaleString('en-IN')}`,
      f.joint_sales_impact || 'N/A'
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Retailer', 'Date', 'Order Increase', 'Impact']],
      body: tableData
    });

    const pdfBlob = doc.output('blob');
    await downloadPDF(pdfBlob, `joint-sales-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCheck className="h-8 w-8" />
            Joint Sales Analytics
          </h1>
          <Button onClick={downloadReport}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.from, 'dd MMM')} - {format(dateRange.to, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => date && setDateRange({ from: date, to: date })}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalVisits}</div>
              <Badge variant="secondary" className="mt-2">
                <UserCheck className="h-3 w-3 mr-1" />
                Joint Sales
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Retailers Covered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalRetailers}</div>
              <Badge variant="secondary" className="mt-2">
                <Store className="h-3 w-3 mr-1" />
                Unique
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Order Increase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{analytics.totalOrderIncrease.toLocaleString('en-IN')}
              </div>
              <Badge variant="secondary" className="mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                Revenue Impact
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg per Visit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{analytics.totalVisits > 0 
                  ? (analytics.totalOrderIncrease / analytics.totalVisits).toLocaleString('en-IN', { maximumFractionDigits: 0 })
                  : 0}
              </div>
              <Badge variant="secondary" className="mt-2">
                <IndianRupee className="h-3 w-3 mr-1" />
                Average
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Feedback Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Retailer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Joint Sales Member</TableHead>
                  <TableHead>Order Increase</TableHead>
                  <TableHead>Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackList.map((feedback) => (
                  <TableRow key={feedback.id}>
                    <TableCell className="font-medium">
                      {feedback.retailers?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(feedback.feedback_date || feedback.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {(feedback.manager as any)?.full_name || (feedback.manager as any)?.username || 'N/A'}
                    </TableCell>
                    <TableCell>
                      ₹{(feedback.order_increase_amount || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {feedback.joint_sales_impact || 'No impact notes'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}