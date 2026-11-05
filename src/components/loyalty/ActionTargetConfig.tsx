import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TargetConfig {
  min_value?: number;
  max_value?: number;
  orders_per_month?: number;
  streak_length?: number;
  days_before_due?: number;
  target_units?: number;
  target_amount?: number;
  min_quantity?: number;
}

interface ActionTargetConfigProps {
  actionType: string;
  value: TargetConfig;
  onChange: (config: TargetConfig) => void;
  prefix?: string;
}

const ACTION_TARGET_FIELDS: Record<string, { fields: Array<{ key: keyof TargetConfig; label: string; placeholder: string }> }> = {
  order_value_tiers: {
    fields: [
      { key: "min_value", label: "Minimum Order Value (₹)", placeholder: "e.g., 5000" },
      { key: "max_value", label: "Maximum Order Value (₹)", placeholder: "e.g., 10000" },
    ],
  },
  order_frequency: {
    fields: [
      { key: "orders_per_month", label: "Orders Per Month", placeholder: "e.g., 4" },
    ],
  },
  consecutive_orders: {
    fields: [
      { key: "streak_length", label: "Streak Length (consecutive orders)", placeholder: "e.g., 5" },
    ],
  },
  timely_payment: {
    fields: [
      { key: "days_before_due", label: "Days Before Due Date", placeholder: "e.g., 0 (on or before due date)" },
    ],
  },
  monthly_volume: {
    fields: [
      { key: "target_units", label: "Target Units", placeholder: "e.g., 100" },
      { key: "target_amount", label: "Target Amount (₹)", placeholder: "e.g., 50000" },
    ],
  },
  bulk_order: {
    fields: [
      { key: "min_quantity", label: "Minimum Quantity", placeholder: "e.g., 50" },
      { key: "min_value", label: "Minimum Order Value (₹)", placeholder: "e.g., 10000" },
    ],
  },
  first_order: {
    fields: [], // No target config needed
  },
  new_product_trial: {
    fields: [], // No target config needed - just needs to be a new product
  },
};

export function ActionTargetConfig({ actionType, value, onChange, prefix = "" }: ActionTargetConfigProps) {
  const config = ACTION_TARGET_FIELDS[actionType];
  
  if (!config || config.fields.length === 0) {
    return null;
  }

  const handleChange = (key: keyof TargetConfig, newValue: string) => {
    const numValue = newValue === "" ? undefined : Number(newValue);
    onChange({
      ...value,
      [key]: numValue,
    });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
      <Label className="text-sm font-medium">Target Configuration</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {config.fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`${prefix}${field.key}`} className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            <Input
              id={`${prefix}${field.key}`}
              type="number"
              placeholder={field.placeholder}
              value={value[field.key] ?? ""}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="mt-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function getTargetConfigDescription(actionType: string, config: TargetConfig): string | null {
  if (!config || Object.keys(config).length === 0) return null;
  
  switch (actionType) {
    case "order_value_tiers":
      if (config.min_value && config.max_value) {
        return `Order value: ₹${config.min_value.toLocaleString()} - ₹${config.max_value.toLocaleString()}`;
      }
      if (config.min_value) return `Minimum order: ₹${config.min_value.toLocaleString()}`;
      return null;
    case "order_frequency":
      return config.orders_per_month ? `${config.orders_per_month} orders/month` : null;
    case "consecutive_orders":
      return config.streak_length ? `${config.streak_length} consecutive orders` : null;
    case "timely_payment":
      return config.days_before_due !== undefined ? `Pay within ${config.days_before_due} days before due` : null;
    case "monthly_volume":
      const parts = [];
      if (config.target_units) parts.push(`${config.target_units} units`);
      if (config.target_amount) parts.push(`₹${config.target_amount.toLocaleString()}`);
      return parts.length > 0 ? `Target: ${parts.join(" or ")}` : null;
    case "bulk_order":
      const bulkParts = [];
      if (config.min_quantity) bulkParts.push(`${config.min_quantity}+ units`);
      if (config.min_value) bulkParts.push(`₹${config.min_value.toLocaleString()}+`);
      return bulkParts.length > 0 ? bulkParts.join(" and ") : null;
    default:
      return null;
  }
}
