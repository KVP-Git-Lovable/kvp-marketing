import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Save, Loader2 } from "lucide-react";

export const WhatsAppConfig = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setPhoneNumber(data.business_phone_number);
        setBusinessName(data.business_name || "");
        setConfigId(data.id);
      }
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
    }
  };

  const handleSave = async () => {
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    // Validate phone number format (should be country code + number without special characters)
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.length < 10) {
      toast.error("Please enter a valid phone number with country code");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (configId) {
        // Update existing config
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            business_phone_number: cleanNumber,
            business_name: businessName,
          })
          .eq("id", configId);

        if (error) throw error;
      } else {
        // Create new config
        const { data, error } = await supabase
          .from("whatsapp_config")
          .insert({
            business_phone_number: cleanNumber,
            business_name: businessName,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success("WhatsApp configuration saved successfully");
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast.error("Failed to save WhatsApp configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle>WhatsApp Integration</CardTitle>
        </div>
        <CardDescription>
          Configure your business WhatsApp number to send invoices directly to customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name (Optional)</Label>
          <Input
            id="businessName"
            placeholder="My Business"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumber">WhatsApp Business Number</Label>
          <Input
            id="phoneNumber"
            placeholder="919876543210 (with country code, no +)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter your WhatsApp number with country code (e.g., 919876543210 for India)
          </p>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
