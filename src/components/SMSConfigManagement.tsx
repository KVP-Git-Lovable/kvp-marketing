import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Phone, Key, Save, TestTube } from 'lucide-react';

interface SMSConfig {
  id: string;
  provider: string;
  account_sid: string | null;
  auth_token: string | null;
  from_number: string | null;
  whatsapp_number: string | null;
  is_active: boolean;
}

export const SMSConfigManagement = () => {
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as SMSConfig);
      } else {
        // Create default config if none exists
        const { data: newConfig, error: insertError } = await supabase
          .from('sms_config')
          .insert({ provider: 'twilio', is_active: true })
          .select()
          .single();

        if (insertError) throw insertError;
        setConfig(newConfig as SMSConfig);
      }
    } catch (error) {
      console.error('Error fetching SMS config:', error);
      toast.error('Failed to load SMS configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sms_config')
        .update({
          account_sid: config.account_sid,
          auth_token: config.auth_token,
          from_number: config.from_number,
          whatsapp_number: config.whatsapp_number,
          is_active: config.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('SMS configuration saved successfully');
    } catch (error) {
      console.error('Error saving SMS config:', error);
      toast.error('Failed to save SMS configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast.error('Please enter a test phone number');
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-whatsapp', {
        body: {
          invoiceId: 'test-' + Date.now(),
          customerPhone: testPhone,
          pdfUrl: 'https://example.com/test-invoice.pdf',
          invoiceNumber: 'TEST-001'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Test SMS sent successfully via ${data.channel}`);
      } else {
        toast.error(data?.error || 'Failed to send test SMS');
      }
    } catch (error: any) {
      console.error('Test SMS error:', error);
      toast.error(error.message || 'Failed to send test SMS');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Twilio SMS Configuration
          </CardTitle>
          <CardDescription>
            Configure your Twilio credentials for SMS invoice delivery. These settings are stored securely in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="active">Enable SMS Notifications</Label>
            <Switch
              id="active"
              checked={config?.is_active || false}
              onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, is_active: checked } : null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_sid" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Account SID
            </Label>
            <Input
              id="account_sid"
              type="password"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={config?.account_sid || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, account_sid: e.target.value } : null)}
            />
            <p className="text-xs text-muted-foreground">Found in your Twilio Console Dashboard</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_token" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Auth Token
            </Label>
            <Input
              id="auth_token"
              type="password"
              placeholder="Your Twilio Auth Token"
              value={config?.auth_token || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, auth_token: e.target.value } : null)}
            />
            <p className="text-xs text-muted-foreground">Found in your Twilio Console Dashboard</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from_number" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              From Phone Number
            </Label>
            <Input
              id="from_number"
              placeholder="+1234567890"
              value={config?.from_number || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, from_number: e.target.value } : null)}
            />
            <p className="text-xs text-muted-foreground">Your Twilio phone number in E.164 format (e.g., +14155551234)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_number" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp Number (Optional)
            </Label>
            <Input
              id="whatsapp_number"
              placeholder="+1234567890"
              value={config?.whatsapp_number || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, whatsapp_number: e.target.value } : null)}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test SMS Delivery
          </CardTitle>
          <CardDescription>
            Send a test SMS to verify your configuration is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test_phone">Test Phone Number</Label>
            <Input
              id="test_phone"
              placeholder="+91XXXXXXXXXX"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <Button onClick={handleTestSMS} disabled={testing} variant="outline" className="w-full">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
            Send Test SMS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSConfigManagement;
