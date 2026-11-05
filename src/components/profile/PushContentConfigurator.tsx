import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Clock, Settings, TrendingUp, Calendar, DollarSign, Users, Target, AlertCircle } from "lucide-react";

interface Template {
  id: string;
  template_name: string;
  template_type: string;
  description: string;
  default_schedule_time: string;
}

interface Subscription {
  id: string;
  template_id: string;
  is_active: boolean;
  schedule_time: string;
  custom_settings: any;
}

const templateIcons: Record<string, any> = {
  day_summary: TrendingUp,
  next_day_plan: Calendar,
  weekly_update: Calendar,
  expense_report: DollarSign,
  performance: TrendingUp,
  top_retailers: Users,
  focused_products: Target,
  high_value_orders: DollarSign,
};

export function PushContentConfigurator() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchSubscriptions();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("push_content_templates")
      .select("*")
      .eq("is_active", true)
      .order("template_name");

    if (data) {
      setTemplates(data);
    }
  };

  const fetchSubscriptions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_push_content_subscriptions")
      .select("*")
      .eq("user_id", user.id);

    if (data) {
      const subsMap: Record<string, Subscription> = {};
      data.forEach((sub: any) => {
        subsMap[sub.template_id] = sub;
      });
      setSubscriptions(subsMap);
    }
  };

  const toggleSubscription = async (templateId: string, templateType: string, defaultTime: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const existingSub = subscriptions[templateId];

      if (existingSub) {
        // Toggle active status
        const { error } = await supabase
          .from("user_push_content_subscriptions")
          .update({ is_active: !existingSub.is_active })
          .eq("id", existingSub.id);

        if (error) throw error;
        toast.success(existingSub.is_active ? "Subscription paused" : "Subscription activated");
      } else {
        // Create new subscription
        const { error } = await supabase.from("user_push_content_subscriptions").insert({
          user_id: user.id,
          template_id: templateId,
          is_active: true,
          schedule_time: defaultTime || "09:00:00",
          custom_settings: getDefaultSettings(templateType),
        });

        if (error) throw error;
        toast.success("Subscribed successfully!");
      }

      fetchSubscriptions();
    } catch (error: any) {
      toast.error("Failed to update subscription: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleTime = async (subscriptionId: string, newTime: string) => {
    try {
      const { error } = await supabase
        .from("user_push_content_subscriptions")
        .update({ schedule_time: newTime })
        .eq("id", subscriptionId);

      if (error) throw error;
      toast.success("Schedule updated");
      fetchSubscriptions();
    } catch (error: any) {
      toast.error("Failed to update schedule");
    }
  };

  const updateCustomSetting = async (subscriptionId: string, settingKey: string, value: any) => {
    const sub = Object.values(subscriptions).find((s) => s.id === subscriptionId);
    if (!sub) return;

    const updatedSettings = {
      ...(sub.custom_settings || {}),
      [settingKey]: value,
    };

    try {
      const { error } = await supabase
        .from("user_push_content_subscriptions")
        .update({ custom_settings: updatedSettings })
        .eq("id", subscriptionId);

      if (error) throw error;
      toast.success("Settings updated");
      fetchSubscriptions();
    } catch (error: any) {
      toast.error("Failed to update settings");
    }
  };

  const getDefaultSettings = (templateType: string) => {
    switch (templateType) {
      case "performance":
        return { period_days: 30 };
      case "high_value_orders":
        return { min_order_value: 10000 };
      default:
        return {};
    }
  };

  const renderCustomSettings = (template: Template, subscription?: Subscription) => {
    if (!subscription || !subscription.is_active) return null;

    switch (template.template_type) {
      case "performance":
        return (
          <div className="mt-3 pt-3 border-t">
            <Label className="text-xs">Performance Period (Days)</Label>
            <Select
              value={subscription.custom_settings?.period_days?.toString() || "30"}
              onValueChange={(value) =>
                updateCustomSetting(subscription.id, "period_days", parseInt(value))
              }
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="15">Last 15 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "high_value_orders":
        return (
          <div className="mt-3 pt-3 border-t">
            <Label className="text-xs">Minimum Order Value (₹)</Label>
            <Input
              type="number"
              value={subscription.custom_settings?.min_order_value || 10000}
              onChange={(e) =>
                updateCustomSetting(subscription.id, "min_order_value", parseInt(e.target.value))
              }
              className="h-8 text-xs mt-1"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Configure Notification</CardTitle>
          </div>
          <CardDescription>
            Choose what content you want automatically posted to your collaboration wall
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {templates.map((template) => {
          const Icon = templateIcons[template.template_type] || AlertCircle;
          const subscription = subscriptions[template.id];
          const isActive = subscription?.is_active || false;

          return (
            <Card key={template.id} className={isActive ? "border-primary/50" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{template.template_name}</h3>
                        {isActive && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>

                      {subscription && isActive && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={subscription.schedule_time?.slice(0, 5) || "09:00"}
                              onChange={(e) =>
                                updateScheduleTime(subscription.id, e.target.value + ":00")
                              }
                              className="h-8 text-xs w-32"
                            />
                            <span className="text-xs text-muted-foreground">Daily</span>
                          </div>
                        </div>
                      )}

                      {renderCustomSettings(template, subscription)}
                    </div>
                  </div>

                  <Switch
                    checked={isActive}
                    onCheckedChange={() =>
                      toggleSubscription(
                        template.id,
                        template.template_type,
                        template.default_schedule_time
                      )
                    }
                    disabled={loading}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No push content templates available yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your administrator to set up content templates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}