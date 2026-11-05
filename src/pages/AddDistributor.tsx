import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from '@/integrations/supabase/db';
import { toast } from "sonner";
import {
  DistributorForm,
  EMPTY_DISTRIBUTOR_FORM,
  toDistributorRow,
  type DistributorFormValues,
} from "@/components/distributor/DistributorForm";
import { useDistributorTypes } from "@/hooks/useDistributorTypes";

/**
 * Onboard a new distributor. The fields, dropdowns and visibility rules all
 * live in DistributorForm, which Edit renders too — the two screens differ
 * only in where the values go.
 */
export default function AddDistributor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);

  const { types, loading: typesLoading } = useDistributorTypes();

  // Which tab of the Distributor Master sent us here. A type code now, but an
  // older link may still carry a `distribution_level` value, so both are
  // accepted; anything unrecognised leaves the form to seed its own default.
  const urlType = searchParams.get('type') || '';
  const seeded = types.find((t) => t.code === urlType)
    ?? types.find((t) => t.legacy_mapping === urlType);

  const initialValues: DistributorFormValues = {
    ...EMPTY_DISTRIBUTOR_FORM,
    type_id: seeded?.id ?? '',
    distribution_level: seeded?.legacy_mapping ?? '',
  };

  const handleSubmit = async (values: DistributorFormValues) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('distributors')
        // `status` is set only here: an edit must never reset a distributor
        // that has since been deactivated.
        .insert({ ...toDistributorRow(values), status: "active" })
        .select()
        .single();

      if (error) throw error;

      toast.success("Distributor created successfully");
      navigate(`/distributor/${data.id}`);
    } catch (error: any) {
      toast.error("Failed to create distributor: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 pb-24">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Distributor</h1>
            <p className="text-sm text-muted-foreground">Onboard a new distribution partner</p>
          </div>
        </div>

        {/* Mounted once, with its values already seeded — the form owns its
            state from then on, so a late-arriving type cannot reseed it. */}
        {typesLoading ? (
          <p className="text-sm text-muted-foreground">Loading distributor types…</p>
        ) : (
          <DistributorForm
            initialValues={initialValues}
            saving={saving}
            submitLabel="Save Distributor"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Layout>
  );
}
