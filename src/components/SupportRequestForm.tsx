import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface SupportRequest {
  id: string;
  support_category: string;
  subject: string;
  description?: string;
  status: string;
  created_date: string;
  target_date?: string;
  resolution_notes?: string;
}

interface SupportRequestFormProps {
  userId: string;
}

const SUPPORT_CATEGORIES = [
  "Training",
  "HR Support",
  "Finance",
  "Marketing",
  "Technology",
  "Operations",
  "Other",
];

const STATUS_OPTIONS = [
  "pending",
  "in_progress",
  "resolved",
  "cancelled",
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "resolved":
      return "bg-green-500";
    case "in_progress":
      return "bg-blue-500";
    case "pending":
      return "bg-yellow-500";
    case "cancelled":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
};

export const SupportRequestForm = ({ userId }: SupportRequestFormProps) => {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    support_category: "",
    subject: "",
    description: "",
    target_date: "",
  });

  useEffect(() => {
    loadRequests();
  }, [userId]);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_date", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast.error("Failed to load support requests");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.support_category || !formData.subject) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("support_requests").insert({
        user_id: userId,
        support_category: formData.support_category,
        subject: formData.subject,
        description: formData.description || null,
        target_date: formData.target_date || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Support request submitted!");
      setFormData({
        support_category: "",
        subject: "",
        description: "",
        target_date: "",
      });
      setShowForm(false);
      loadRequests();
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error("Failed to submit support request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Support Request
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Support Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.support_category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, support_category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder="Brief description of your request"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed description of your support request"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_date">Target Resolution Date</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date}
                  onChange={(e) =>
                    setFormData({ ...formData, target_date: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">My Support Requests</h3>
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No support requests yet
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{request.subject}</h4>
                      <Badge className={`${getStatusColor(request.status)} text-white`}>
                        {request.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="mb-2">
                      {request.support_category}
                    </Badge>
                  </div>
                </div>
                {request.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {request.description}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Created: {new Date(request.created_date).toLocaleDateString()}
                  </span>
                  {request.target_date && (
                    <span>
                      Target: {new Date(request.target_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {request.resolution_notes && (
                  <div className="mt-3 p-2 bg-muted rounded">
                    <p className="text-sm font-semibold mb-1">Resolution:</p>
                    <p className="text-sm">{request.resolution_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
