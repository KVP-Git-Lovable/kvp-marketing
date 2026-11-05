import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const invoiceSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  company_id: z.string().min(1, "Company is required"),
  invoice_date: z.string(),
  due_date: z.string().optional(),
  place_of_supply: z.string().optional(),
  vehicle_number: z.string().optional(),
  terms: z.string().optional(),
});

interface InvoiceItem {
  description: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  gst_rate: number;
}

export default function CreateInvoiceForm({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_date: new Date().toISOString().split('T')[0],
      place_of_supply: "29-Karnataka",
    },
  });

  useEffect(() => {
    fetchCustomers();
    fetchCompanies();
    fetchRetailers();
  }, []);

  const fetchCustomers = async () => {
    // Customers are now retailers - no separate table
    setCustomers([]);
  };

  const fetchRetailers = async () => {
    const { data } = await supabase
      .from("retailers")
      .select("*")
      .eq("status", "active")
      .order("name");
    if (data) setRetailers(data);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    if (data) setCompanies(data);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: "",
        hsn_sac: "",
        quantity: 1,
        unit: "Piece",
        price_per_unit: 0,
        gst_rate: 18,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subTotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const taxable = item.quantity * item.price_per_unit;
      const cgst = (taxable * item.gst_rate) / 100 / 2;
      const sgst = cgst;
      subTotal += taxable;
      totalTax += cgst + sgst;
    });

    return {
      subTotal: subTotal.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalAmount: (subTotal + totalTax).toFixed(2),
    };
  };

  const convertToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';
    
    const convert = (n: number): string => {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10];
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand ' + convert(n % 1000);
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh ' + convert(n % 100000);
      return convert(Math.floor(n / 10000000)) + ' Crore ' + convert(n % 10000000);
    };

    const [rupees, paise] = num.toFixed(2).split('.');
    let words = convert(parseInt(rupees)) + ' Rupees';
    if (parseInt(paise) > 0) {
      words += ' and ' + convert(parseInt(paise)) + ' Paise';
    }
    return words.trim() + ' Only';
  };

  const onSubmit = async (data: z.infer<typeof invoiceSchema>) => {
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setLoading(true);
    try {
      const totals = calculateTotals();
      const { data: { user } } = await supabase.auth.getUser();

      // Create invoice (invoice_number is auto-generated by trigger)
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: '', // Will be auto-generated by trigger
          company_id: data.company_id,
          customer_id: data.customer_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date || null,
          place_of_supply: data.place_of_supply || null,
          vehicle_number: data.vehicle_number || null,
          terms: data.terms || null,
          sub_total: parseFloat(totals.subTotal),
          total_tax: parseFloat(totals.totalTax),
          total_amount: parseFloat(totals.totalAmount),
          amount_in_words: convertToWords(parseFloat(totals.totalAmount)),
          created_by: user?.id,
          status: 'draft',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = items.map((item) => {
        const taxable = item.quantity * item.price_per_unit;
        const cgst = (taxable * item.gst_rate) / 100 / 2;
        const sgst = cgst;
        return {
          invoice_id: invoice.id,
          description: item.description,
          hsn_sac: item.hsn_sac,
          quantity: item.quantity,
          unit: item.unit,
          price_per_unit: item.price_per_unit,
          gst_rate: item.gst_rate,
          taxable_amount: taxable,
          cgst_amount: cgst,
          sgst_amount: sgst,
          total_amount: taxable + cgst + sgst,
        };
      });

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Invoice created successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create New Invoice</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer (Select from Retailers)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select retailer as customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {retailers.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            No active retailers found. Add retailers first.
                          </div>
                        ) : (
                          retailers.map((retailer) => (
                            <SelectItem key={retailer.id} value={retailer.id}>
                              {retailer.name} {retailer.phone ? `- ${retailer.phone}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="place_of_supply"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place of Supply</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="GJ01AA1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        <div className="md:col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Item name"
                          />
                        </div>
                        <div>
                          <Label>HSN/SAC</Label>
                          <Input
                            value={item.hsn_sac}
                            onChange={(e) => updateItem(index, "hsn_sac", e.target.value)}
                            placeholder="Code"
                          />
                        </div>
                        <div>
                          <Label>Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value))}
                            min="0"
                            step="0.001"
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select
                            value={item.unit}
                            onValueChange={(value) => updateItem(index, "unit", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Piece">Piece</SelectItem>
                              <SelectItem value="Kg">Kg</SelectItem>
                              <SelectItem value="Litre">Litre</SelectItem>
                              <SelectItem value="Meter">Meter</SelectItem>
                              <SelectItem value="Box">Box</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Price</Label>
                          <Input
                            type="number"
                            value={item.price_per_unit}
                            onChange={(e) => updateItem(index, "price_per_unit", parseFloat(e.target.value))}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label>GST %</Label>
                          <Input
                            type="number"
                            value={item.gst_rate}
                            onChange={(e) => updateItem(index, "gst_rate", parseFloat(e.target.value))}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {items.length > 0 && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Sub Total:</span>
                  <span>₹{totals.subTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Tax:</span>
                  <span>₹{totals.totalTax}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>₹{totals.totalAmount}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Amount in words: {convertToWords(parseFloat(totals.totalAmount))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter terms and conditions"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Invoice"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
