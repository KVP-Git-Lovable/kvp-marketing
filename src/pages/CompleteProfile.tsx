import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, CheckCircle } from 'lucide-react';

interface InvitationData {
  expires_at: string;
}

const CompleteProfile = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [validatingToken, setValidatingToken] = useState(true);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    monthly_salary: '',
    daily_da_allowance: '',
    hq: '',
    date_of_joining: '',
    date_of_exit: '',
    alternate_email: '',
    address: '',
    education: '',
    emergency_contact_number: '',
    hint_question: '',
    hint_answer: ''
  });

  const invitationToken = searchParams.get('token');

  useEffect(() => {
    if (invitationToken) {
      validateInvitation();
    } else {
      setValidatingToken(false);
    }
  }, [invitationToken]);

  const validateInvitation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-invitation', {
        body: { invitation_token: invitationToken }
      });

      if (error || !data || !data.valid) {
        const reason = (data && data.reason) || 'invalid';
        const message = reason === 'expired'
          ? 'This invitation has expired. Please contact HR for a new invitation.'
          : 'This invitation link is invalid or has been used.';
        toast({ title: 'Invalid Invitation', description: message, variant: 'destructive' });
        navigate('/auth');
        return;
      }

      setInvitation({ expires_at: data.expires_at });
    } catch (error) {
      console.error('Error validating invitation:', error);
      toast({ title: 'Error', description: 'Failed to validate invitation.', variant: 'destructive' });
      navigate('/auth');
    } finally {
      setValidatingToken(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('complete-user-profile', {
        body: {
          invitation_token: invitationToken,
          ...formData
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile completed successfully! Your account is now pending approval.",
      });

      // Redirect to auth page for login
      navigate('/auth?message=profile-completed');

    } catch (error: any) {
      console.error('Error completing profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle standalone-page">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle standalone-page">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Invalid or expired invitation.</p>
            <Button onClick={() => navigate('/auth')} className="mt-4">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 standalone-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-muted-foreground mt-2">
            Welcome! Please complete your profile setup.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-medium">Account Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-4">
                <h3 className="font-medium">Security</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hint_question">Security Question</Label>
                    <Input
                      id="hint_question"
                      value={formData.hint_question}
                      onChange={(e) => handleInputChange('hint_question', e.target.value)}
                      placeholder="What is your favorite color?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hint_answer">Security Answer</Label>
                    <Input
                      id="hint_answer"
                      value={formData.hint_answer}
                      onChange={(e) => handleInputChange('hint_answer', e.target.value)}
                      placeholder="Blue"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div className="space-y-4">
                <h3 className="font-medium">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_salary">Monthly Salary (₹)</Label>
                    <Input
                      id="monthly_salary"
                      type="number"
                      value={formData.monthly_salary}
                      onChange={(e) => handleInputChange('monthly_salary', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily_da_allowance">Daily DA Allowance (₹)</Label>
                    <Input
                      id="daily_da_allowance"
                      type="number"
                      value={formData.daily_da_allowance}
                      onChange={(e) => handleInputChange('daily_da_allowance', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hq">Head Quarters (HQ)</Label>
                    <Input
                      id="hq"
                      value={formData.hq}
                      onChange={(e) => handleInputChange('hq', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_joining">Date of Joining</Label>
                    <Input
                      id="date_of_joining"
                      type="date"
                      value={formData.date_of_joining}
                      onChange={(e) => handleInputChange('date_of_joining', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="font-medium">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="alternate_email">Alternate Email</Label>
                    <Input
                      id="alternate_email"
                      type="email"
                      value={formData.alternate_email}
                      onChange={(e) => handleInputChange('alternate_email', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_number">Emergency Contact</Label>
                    <Input
                      id="emergency_contact_number"
                      value={formData.emergency_contact_number}
                      onChange={(e) => handleInputChange('emergency_contact_number', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education">Education Background</Label>
                    <Textarea
                      id="education"
                      value={formData.education}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Next Steps</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      After completing this form, your profile will go through a 3-level approval process:
                    </p>
                    <ol className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>1. Manager Review</li>
                      <li>2. First Approver Review</li>
                      <li>3. Final Approver Review</li>
                    </ol>
                    <p className="text-sm text-muted-foreground mt-2">
                      You'll receive notifications at each step and can log in once fully approved.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Complete Profile Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;