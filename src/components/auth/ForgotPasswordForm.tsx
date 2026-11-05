import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const phoneSchema = z.object({
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type PhoneFormData = z.infer<typeof phoneSchema>;

const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
];

export const ForgotPasswordForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [countryCode, setCountryCode] = useState('+91');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const onEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    try {
      // First validate if email exists in the system
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-reset-email', {
        body: { email: data.email }
      });

      if (validationError) {
        toast.error('Failed to validate email. Please try again.');
        return;
      }

      if (!validation?.exists) {
        toast.error('This email is not registered in the organization');
        return;
      }

      // Email exists, proceed with reset
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message || 'Failed to send reset email');
      } else {
        setResetSent(true);
        toast.success('Password reset link sent to your email!');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onPhoneSubmit = async (data: PhoneFormData) => {
    setIsLoading(true);
    try {
      // Combine country code with phone number
      const fullPhoneNumber = countryCode + data.phoneNumber.replace(/\D/g, '');
      
      const { data: result, error } = await supabase.functions.invoke('send-password-reset-sms', {
        body: { phone_number: fullPhoneNumber },
      });

      if (error) {
        toast.error('Failed to send reset SMS. Please try again.');
      } else if (result?.notFound) {
        toast.error('This phone number is not linked to any account in the organization');
      } else if (result?.error) {
        toast.error(result.error);
      } else {
        setResetSent(true);
        toast.success('Password reset link sent to your phone!');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Failed to send reset SMS. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Check your {activeTab === 'email' ? 'inbox' : 'phone'}!</h3>
        <p className="text-sm text-muted-foreground">
          We've sent a password reset link to your {activeTab === 'email' ? 'email address' : 'phone number'}.
          Click the link to reset your password.
        </p>
        <p className="text-xs text-muted-foreground">
          The link will expire in 1 hour. If you don't see it, check your spam folder.
        </p>
        <Button 
          variant="outline" 
          className="w-full mt-4"
          onClick={() => setResetSent(false)}
        >
          Try a different method
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'phone')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="phone" className="mt-4">
          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
              <FormField
                control={phoneForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-[120px] flex-shrink-0">
                            <SelectValue>
                              {countryCodes.find(c => c.code === countryCode)?.flag} {countryCode}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {countryCodes.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                <span className="flex items-center gap-2">
                                  <span>{country.flag}</span>
                                  <span>{country.code}</span>
                                  <span className="text-muted-foreground text-xs">({country.country})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="tel"
                          placeholder="Enter your phone number"
                          className="flex-1"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      {/* Contact Administrator Section */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Forgot your email & phone number?
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your administrator to reset your password. They can help recover your account access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};