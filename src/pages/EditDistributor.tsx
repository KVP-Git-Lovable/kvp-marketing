import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from '@/lib/supabaseLoose';
import { toast } from "sonner";
import {
  DistributorForm,
  EMPTY_DISTRIBUTOR_FORM,
  toDistributorRow,
  type DistributorFormValues,
} from "@/components/distributor/DistributorForm";

/**
 * Edit a distributor. Identical to Add — same fields, same dropdowns, same
 * visibility rules — with the stored row pre-filled. It used to be a separate
 * copy of the markup that had drifted onto the retired four-tier level list.
 */
export default function EditDistributor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<DistributorFormValues | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('distributors')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (cancelled) return;

        const row = data as any;
        setInitialValues({
          ...EMPTY_DISTRIBUTOR_FORM,
          name: row.name || "",
          contact_person: row.contact_person || "",
          phone: row.phone || "",
          email: row.email || "",
          address: row.address || "",
          billing_address: row.billing_address || "",
          billing_city: row.billing_city || "",
          billing_state: row.billing_state || "",
          billing_pincode: row.billing_pincode || "",
          delivery_same_as_billing: row.delivery_same_as_billing !== false,
          delivery_address: row.delivery_address || "",
          delivery_city: row.delivery_city || "",
          delivery_state: row.delivery_state || "",
          delivery_pincode: row.delivery_pincode || "",
          delivery_contact_person: row.delivery_contact_person || "",
          delivery_contact_phone: row.delivery_contact_phone || "",
          gst_number: row.gst_number || "",
          established_year: row.established_year?.toString() || "",
          distribution_experience_years: row.distribution_experience_years?.toString() || "",
          sales_team_size: row.sales_team_size?.toString() || "",
          assets_vans: row.assets_vans?.toString() || "",
          assets_trucks: row.assets_trucks?.toString() || "",
          network_retailers_count: row.network_retailers_count?.toString() || "",
          region_coverage: row.region_coverage || "",
          type_id: row.type_id || "",
          // Kept verbatim, including a retired value — the form says so rather
          // than blanking the control and inviting a guess.
          distribution_level: row.distribution_level || "",
          parent_id: row.parent_id || "",
          distributor_status: row.distributor_status || "initial_connect",
          partnership_status: row.partnership_status || "registered",
          onboarding_date: row.onboarding_date || "",
          years_of_relationship: row.years_of_relationship?.toString() || "",
          products_distributed: row.products_distributed?.join(', ') || "",
          other_products: row.other_products?.join(', ') || "",
          competition_products: row.competition_products?.join(', ') || "",
          strength: row.strength || "",
          weakness: row.weakness || "",
          opportunities: row.opportunities || "",
          threats: row.threats || "",
          about_business: row.about_business || "",
          drop_reason: row.drop_reason || "",
          owner_id: row.owner_id || "",
          owner_name: row.owner_name || "",
        });
      } catch (error: any) {
        if (cancelled) return;
        toast.error("Failed to load distributor: " + error.message);
        navigate('/distributor-master');
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, navigate]);

  const handleSubmit = async (values: DistributorFormValues) => {
    setSaving(true);
    try {
      // No `status` here: it is owned by activation, not by this form.
      const { error } = await supabase
        .from('distributors')
        .update(toDistributorRow(values))
        .eq('id', id);

      if (error) throw error;

      toast.success("Distributor updated successfully");
      navigate(`/distributor/${id}`);
    } catch (error: any) {
      toast.error("Failed to update distributor: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading || !initialValues) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 pb-24">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Edit Distributor</h1>
            <p className="text-sm text-muted-foreground">Update distributor information</p>
          </div>
        </div>

        <DistributorForm
          initialValues={initialValues}
          excludeParentId={id}
          saving={saving}
          submitLabel="Update Distributor"
          onSubmit={handleSubmit}
        />
      </div>
    </Layout>
  );
}
