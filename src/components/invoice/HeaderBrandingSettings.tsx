import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Building2 } from "lucide-react";
import { HEADER_BRANDING_UPDATED_EVENT } from "@/hooks/useCompanyData";
import { useSignedUrl } from "@/hooks/useSignedUrl";

export default function HeaderBrandingSettings() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const signedLogoUrl = useSignedUrl(logoUrl);

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, header_name, header_logo_url")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching company:", error);
      }

      if (data) {
        setCompanyId(data.id);
        setCompanyName(data.header_name || "");
        setLogoUrl(data.header_logo_url);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `header-logo-${Date.now()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      // Update company record if exists
      if (companyId) {
        await supabase
          .from("companies")
          .update({ header_logo_url: publicUrl })
          .eq("id", companyId);
        
        // Notify other components of the change
        window.dispatchEvent(new CustomEvent(HEADER_BRANDING_UPDATED_EVENT));
      }

      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    try {
      if (companyId) {
        const { error } = await supabase
          .from("companies")
          .update({ header_name: companyName, header_logo_url: logoUrl })
          .eq("id", companyId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert({ name: companyName, header_name: companyName, header_logo_url: logoUrl })
          .select("id")
          .single();

        if (error) throw error;
        setCompanyId(data.id);
      }

      // Dispatch event to notify all useCompanyData hooks to refetch
      window.dispatchEvent(new CustomEvent(HEADER_BRANDING_UPDATED_EVENT));
      
      toast.success("Header branding updated successfully");
    } catch (error: any) {
      console.error("Error saving:", error);
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Header Branding
        </CardTitle>
        <CardDescription>
          Configure the company name and logo displayed in the app header. Changes will reflect across the entire application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload Section */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 border-2 border-dashed rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
              {signedLogoUrl ? (
                <img
                  src={signedLogoUrl}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square image, max 2MB (PNG, JPG)
              </p>
            </div>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            This name will appear in the header across all pages
          </p>
        </div>

        {/* Preview */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <Label className="text-xs text-muted-foreground mb-3 block">Preview</Label>
          <div className="flex items-center gap-3 bg-primary text-primary-foreground p-3 rounded-lg w-fit">
            <div className="w-9 h-9 rounded-lg bg-white p-0.5 overflow-hidden">
              {signedLogoUrl ? (
                <img src={signedLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className="font-semibold">{companyName || "Company Name"}</span>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
