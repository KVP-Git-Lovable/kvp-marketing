import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")).transform(val => val || undefined),
  gstin: z.string().optional(),
  state: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  ifsc: z.string().optional(),
  account_holder_name: z.string().optional(),
  qr_upi: z.string().optional(),
  terms_conditions: z.string().optional(),
});

export default function CompanySettings() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/bharath-beverages-logo.png");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const signedLogoUrl = useSignedUrl(logoUrl);
  const signedQrUrl = useSignedUrl(qrCodeUrl);

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "BHARATH BEVERAGES",
      address: "S 15-7-366/2 -Bharath Beedi Golden Jubilee Building, 1st floor, Bharath Bagh, Kadri Rd, Mangaluru -575003",
      contact_phone: "8951713030",
      email: "bharath.beverages@bharathgroup.co.in",
      gstin: "29ABDFB8743K1ZZ",
      state: "29-Karnataka",
      bank_name: "CANARA BANK",
      bank_account: "120032473436",
      ifsc: "CNRB0010105",
      account_holder_name: "BHARATH BEVERAGES",
      qr_upi: "",
      terms_conditions: "Thanks for doing business with us!",
    },
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setCompanies(data);
      setSelectedCompany(data[0]);
      setLogoUrl(data[0].logo_url || "/bharath-beverages-logo.png");
      setQrCodeUrl(data[0].qr_code_url || "");
      // Type-safe form reset
      form.reset({
        name: data[0].name || "",
        address: data[0].address || "",
        contact_phone: data[0].contact_phone || "",
        email: data[0].email || "",
        gstin: data[0].gstin || "",
        state: data[0].state || "",
        bank_name: data[0].bank_name || "",
        bank_account: data[0].bank_account || "",
        ifsc: data[0].ifsc || "",
        account_holder_name: data[0].account_holder_name || "",
        qr_upi: data[0].qr_upi || "",
        terms_conditions: data[0].terms_conditions || "",
      });
    } else {
      // No companies exist, keep defaults
      setCompanies([]);
      setSelectedCompany(null);
      setLogoUrl("/bharath-beverages-logo.png");
      setQrCodeUrl("");
      toast.info("No company found. Please save your company details first.");
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDF)
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    if (!isImage && !isPDF) {
      toast.error("Please upload an image or PDF file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      // Update company record if exists
      if (selectedCompany) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({ logo_url: publicUrl })
          .eq('id', selectedCompany.id);

        if (updateError) throw updateError;
      }

      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleQRCodeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    setUploadingQR(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-code-${Date.now()}.${fileExt}`;
      const filePath = `qr-codes/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      setQrCodeUrl(publicUrl);

      // Update company record if exists
      if (selectedCompany) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({ qr_code_url: publicUrl })
          .eq('id', selectedCompany.id);

        if (updateError) throw updateError;
      }

      toast.success("QR Code uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading QR code:", error);
      toast.error(error.message || "Failed to upload QR code");
    } finally {
      setUploadingQR(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof companySchema>) => {
    setLoading(true);
    try {
      // Type-safe data preparation
      const insertData: Database['public']['Tables']['companies']['Insert'] = {
        name: data.name,
        address: data.address || null,
        contact_phone: data.contact_phone || null,
        email: data.email || null,
        gstin: data.gstin || null,
        state: data.state || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
        ifsc: data.ifsc || null,
        account_holder_name: data.account_holder_name || null,
        qr_upi: data.qr_upi || null,
        terms_conditions: data.terms_conditions || null,
        logo_url: logoUrl || null,
        qr_code_url: qrCodeUrl || null,
      };
      
      if (selectedCompany) {
        const { error } = await supabase
          .from("companies")
          .update(insertData)
          .eq("id", selectedCompany.id);
        if (error) throw error;
        toast.success("Company updated successfully");
      } else {
        const { error } = await supabase.from("companies").insert(insertData);
        if (error) throw error;
        toast.success("Company created successfully");
      }
      fetchCompanies();
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Failed to save company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Company Settings</CardTitle>
          {companies.length === 0 && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 rounded-md">
              ⚠️ No company configured. Save details below to start.
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
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Pvt Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="22AAAAA0000A1Z5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="company@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Gujarat" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Company address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <Input placeholder="HDFC Bank" {...field} />
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
                        <Input placeholder="ABC Pvt Ltd" {...field} />
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
                        <Input placeholder="1234567890" {...field} />
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
                        <Input placeholder="HDFC0001234" {...field} />
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
                        <Input placeholder="company@upi" {...field} />
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
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setQrCodeUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Company Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
