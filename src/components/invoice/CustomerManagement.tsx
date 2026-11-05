import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2 } from "lucide-react";

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  state: z.string().optional(),
  gstin: z.string().optional(),
});

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    // Fetch from retailers table instead of non-existent customers table
    const { data } = await supabase
      .from("retailers")
      .select("id, name, address, phone, gst_number, status")
      .eq("status", "active")
      .order("name");
    
    if (data) {
      // Map retailers to customer format
      const mappedCustomers = data.map(retailer => ({
        id: retailer.id,
        name: retailer.name,
        address: retailer.address || "",
        contact_person: "",
        contact_phone: retailer.phone || "",
        state: "",
        gstin: retailer.gst_number || "",
      }));
      setCustomers(mappedCustomers);
    }
  };

  const onSubmit = async (data: z.infer<typeof customerSchema>) => {
    setLoading(true);
    try {
      // Update retailer data instead
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updateData = {
        name: data.name,
        address: data.address || null,
        phone: data.contact_phone || null,
        gst_number: data.gstin || null,
      };
      
      if (selectedCustomer) {
        const { error } = await supabase
          .from("retailers")
          .update(updateData)
          .eq("id", selectedCustomer.id);
        if (error) throw error;
        toast.success("Customer updated successfully");
      } else {
        // Create new retailer as customer
        const { error } = await supabase.from("retailers").insert({
          ...updateData,
          user_id: user.id,
          beat_id: "INVOICE",
          beat_name: "Invoice Customers",
          category: "General Store",
          status: "active",
        });
        if (error) throw error;
        toast.success("Customer created successfully");
      }
      setOpen(false);
      form.reset();
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error(error.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      // Set retailer status to inactive instead of deleting
      const { error } = await supabase
        .from("retailers")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Customer deactivated successfully");
      fetchCustomers();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast.error("Failed to delete customer");
    }
  };

  const openEditDialog = (customer: any) => {
    setSelectedCustomer(customer);
    // Type-safe form reset
    form.reset({
      name: customer.name || "",
      address: customer.address || "",
      contact_person: customer.contact_person || "",
      contact_phone: customer.contact_phone || "",
      state: customer.state || "",
      gstin: customer.gstin || "",
    });
    setOpen(true);
  };

  const openCreateDialog = () => {
    setSelectedCustomer(null);
    form.reset({
      name: "",
      address: "",
      contact_person: "",
      contact_phone: "",
      state: "",
      gstin: "",
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Customers (from Retailers)</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedCustomer ? "Edit Customer" : "Add New Customer"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Store" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
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
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Customer address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save Customer"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>State</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No customers found. Customers are automatically created from Retailers.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.contact_person || "-"}</TableCell>
                  <TableCell>{customer.contact_phone || "-"}</TableCell>
                  <TableCell>{customer.state || "-"}</TableCell>
                  <TableCell>{customer.gstin || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteCustomer(customer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
