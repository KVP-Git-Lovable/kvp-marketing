import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InvoiceDisplaySetting {
  id: string;
  setting_key: string;
  enabled: boolean;
  setting_category: string;
  display_label: string;
  sort_order: number;
}

export interface DisplaySettingsMap {
  [key: string]: boolean;
}

export const SETTING_CATEGORIES = {
  header: 'Header Section',
  billto: 'Bill To (Retailer)',
  details: 'Invoice Details',
  table: 'Items Table Columns',
  totals: 'Totals Section',
  payment: 'Payment Section',
  footer: 'Footer Section',
} as const;

export function useInvoiceDisplaySettings() {
  const [settings, setSettings] = useState<InvoiceDisplaySetting[]>([]);
  const [settingsMap, setSettingsMap] = useState<DisplaySettingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_display_settings')
        .select('*')
        .order('setting_category')
        .order('sort_order');

      if (error) throw error;

      const typedData = (data || []) as InvoiceDisplaySetting[];
      setSettings(typedData);
      
      const map: DisplaySettingsMap = {};
      typedData.forEach(s => {
        map[s.setting_key] = s.enabled;
      });
      setSettingsMap(map);
    } catch (error) {
      console.error('Error fetching invoice display settings:', error);
      toast.error('Failed to load display settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (settingKey: string, enabled: boolean) => {
    // Optimistic update
    setSettings(prev => 
      prev.map(s => s.setting_key === settingKey ? { ...s, enabled } : s)
    );
    setSettingsMap(prev => ({ ...prev, [settingKey]: enabled }));

    try {
      const { error } = await supabase
        .from('invoice_display_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('setting_key', settingKey);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating setting:', error);
      // Revert on error
      fetchSettings();
      toast.error('Failed to update setting');
    }
  };

  const updateMultipleSettings = async (updates: { setting_key: string; enabled: boolean }[]) => {
    setIsSaving(true);
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('invoice_display_settings')
          .update({ enabled: update.enabled, updated_at: new Date().toISOString() })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }
      
      await fetchSettings();
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const getSettingsByCategory = (category: string) => {
    return settings.filter(s => s.setting_category === category);
  };

  return {
    settings,
    settingsMap,
    isLoading,
    isSaving,
    updateSetting,
    updateMultipleSettings,
    getSettingsByCategory,
    refetch: fetchSettings,
  };
}

// Standalone function to fetch settings for invoice generation
export async function getInvoiceDisplaySettingsMap(): Promise<DisplaySettingsMap> {
  try {
    const { data, error } = await supabase
      .from('invoice_display_settings')
      .select('setting_key, enabled');

    if (error) throw error;

    const map: DisplaySettingsMap = {};
    (data || []).forEach((s: { setting_key: string; enabled: boolean }) => {
      map[s.setting_key] = s.enabled;
    });
    return map;
  } catch (error) {
    console.error('Error fetching invoice display settings:', error);
    // Return all enabled as default
    return {};
  }
}
