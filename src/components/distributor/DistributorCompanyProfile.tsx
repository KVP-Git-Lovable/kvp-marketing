import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";

const distributorProfileSchema = z.object({
  state: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  ifsc: z.string().optional(),
  account_holder_name: z.string().optional(),
  qr_upi: z.string().optional(),
  terms_conditions: z.string().optional(),
});

interface DistributorCompanyProfileProps {
  distributorId: string;
  readOnly?: boolean;
}

export default function DistributorCompanyProfile({ distributorId, readOnly = false }: DistributorCompanyProfileProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [distributorName, setDistributorName] = useState<string>("");
  const [gstNumber, setGstNumber] = useState<string>("");
  const signedLogoUrl = useSignedUrl(logoUrl);
  const signedQrUrl = useSignedUrl(qrCodeUrl);

  const form = useForm<z.infer<typeof distributorProfileSchema>>({
    resolver: zodResolver(distributorProfileSchema),
    defaultValues: {
      state: "",
      bank_name: "",
      bank_account: "",
      ifsc: "",
      account_holder_name: "",
      qr_upi: "",
      terms_conditions: "Thanks for doing business with us!",
    },
  });

  useEffect(() => {
    if (distributorId) {
      fetchDistributor();
    }
  }, [distributorId]);

  const fetchDistributor = async () => {
    try {
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .eq("id", distributorId)
        .single();

      if (error) throw error;

      if (data) {
        const d = data as any;
        setDistributorName(d.name || "");
        setGstNumber(d.gst_number || "");
        setLogoUrl(d.logo_url || "");
        setQrCodeUrl(d.qr_code_url || "");
        form.reset({
          state: d.state || "",
          bank_name: d.bank_name || "",
          bank_account: d.bank_account || "",
          ifsc: d.ifsc || "",
          account_holder_name: d.account_holder_name || "",
          qr_upi: d.qr_upi || "",
          terms_conditions: d.terms_conditions || "Thanks for doing business with us!",
        });
      }
    } catch (error: any) {
      console.error("Error fetching distributor:", error);
      toast.error("Failed to load distributor profile");
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    if (!isImage && !isPDF) {
      toast.error("Please upload an image or PDF file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      // The distributor id has to be a folder, not part of the filename:
      // the storage policy that lets a portal user write their own branding
      // matches on the folder, so a flat path is refused.
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `distributor-logos/${distributorId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('distributors')
        .update({ logo_url: publicUrl })
        .eq('id', distributorId);

      if (updateError) throw updateError;

      // The portal sidebar renders the distributor from a cached snapshot;
      // tell it to re-read so the change shows without a sign-in.
      window.dispatchEvent(new CustomEvent('distributor-profile-updated'));
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleQRCodeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    setUploadingQR(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-${Date.now()}.${fileExt}`;
      const filePath = `distributor-qr-codes/${distributorId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      setQrCodeUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('distributors')
        .update({ qr_code_url: publicUrl })
        .eq('id', distributorId);

      if (updateError) throw updateError;

      window.dispatchEvent(new CustomEvent('distributor-profile-updated'));
      toast.success("QR Code uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading QR code:", error);
      toast.error(error.message || "Failed to upload QR code");
    } finally {
      setUploadingQR(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof distributorProfileSchema>) => {
    if (readOnly) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("distributors")
        .update({
          state: data.state || null,
          bank_name: data.bank_name || null,
          bank_account: data.bank_account || null,
          ifsc: data.ifsc || null,
          account_holder_name: data.account_holder_name || null,
          qr_upi: data.qr_upi || null,
          terms_conditions: data.terms_conditions || null,
          logo_url: logoUrl || null,
          qr_code_url: qrCodeUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", distributorId);

      if (error) throw error;
      window.dispatchEvent(new CustomEvent('distributor-profile-updated'));
      toast.success("Company profile updated successfully");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Invoice Settings</CardTitle>
          {readOnly && (
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md">
              View Only
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Logo Upload Section */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="text-sm font-semibold mb-3">Company Logo</h3>
              <div className="flex items-center gap-4">
                {signedLogoUrl && (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-white">
                    {signedLogoUrl.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        <span>PDF Logo</span>
                      </div>
                    ) : (
                      <img src={signedLogoUrl} alt="Company Logo" className="w-full h-full object-contain p-2" />
                    )}
                  </div>
                )}
                {!readOnly && (
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload company logo (max 2MB, PNG/JPG/PDF)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Company Details - Read Only */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input value={distributorName} disabled className="mt-1.5 bg-muted" />
              </div>
              <div>
                <label className="text-sm font-medium">GSTIN</label>
                <Input value={gstNumber || ""} disabled className="mt-1.5 bg-muted" />
              </div>
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Karnataka" {...field} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="HDFC Bank" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="account_holder_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Pvt Ltd" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bank_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ifsc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl>
                        <Input placeholder="HDFC0001234" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qr_upi"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>UPI ID</FormLabel>
                      <FormControl>
                        <Input placeholder="company@upi" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* QR Code Upload Section */}
              <div className="border rounded-lg p-4 bg-muted/50 mt-4">
                <h3 className="text-sm font-semibold mb-3">UPI QR Code</h3>
                <div className="flex items-center gap-4">
                  {signedQrUrl && (
                    <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-white">
                      <img src={signedQrUrl} alt="UPI QR Code" className="w-full h-full object-contain p-2" />
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => setQrCodeUrl("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {!readOnly && (
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleQRCodeUpload}
                        disabled={uploadingQR}
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload UPI QR code (max 2MB, PNG/JPG)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="terms_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter default terms and conditions"
                      className="min-h-[100px]"
                      {...field}
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!readOnly && (
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Invoice Settings"}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
