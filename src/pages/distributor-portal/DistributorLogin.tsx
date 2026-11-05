import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, LogIn, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { monitoring } from '@/services/MonitoringService';

const DistributorLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  // Handle admin impersonation
  useEffect(() => {
    const impersonateUserId = searchParams.get('impersonate');
    const distributorUserId = searchParams.get('distributor_user_id');
    
    if (impersonateUserId && distributorUserId) {
      handleImpersonation(impersonateUserId, distributorUserId);
    }
  }, [searchParams]);

  const handleImpersonation = async (authUserId: string, distributorUserId: string) => {
    setImpersonating(true);
    try {
      // Verify admin is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Admin session required for impersonation');
        setImpersonating(false);
        return;
      }

      // Verify admin role via security_profiles
      const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('security_profiles!inner(is_system)')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!(adminCheck?.security_profiles as any)?.is_system) {
        toast.error('Only admins can impersonate users');
        setImpersonating(false);
        return;
      }

      // Fetch the distributor user data
      const { data: distributorUser, error } = await supabase
        .from('distributor_users')
        .select('*, distributors(name, logo_url)')
        .eq('id', distributorUserId)
        .single();

      if (error || !distributorUser) {
        toast.error('Failed to load distributor user');
        setImpersonating(false);
        return;
      }

      // Store admin session for return
      sessionStorage.setItem('admin_impersonation', JSON.stringify({
        adminUserId: session.user.id,
        returnUrl: searchParams.get('return') || '/admin',
        impersonatedUser: distributorUser.full_name,
      }));

      // Set distributor user context (without actual login)
      localStorage.setItem('distributor_user', JSON.stringify({
        ...distributorUser,
        is_impersonated: true,
        admin_user_id: session.user.id,
      }));
      localStorage.setItem('distributor_id', distributorUser.distributor_id);

      toast.success(`Viewing portal as ${distributorUser.full_name}`, {
        description: 'Admin impersonation mode active',
        icon: <ShieldCheck className="w-4 h-4" />,
      });
      
      navigate('/distributor-portal/dashboard');
    } catch (error: any) {
      console.error('Impersonation error:', error);
      toast.error('Failed to impersonate user');
    } finally {
      setImpersonating(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await monitoring.trace('distributor_login_process', async () => {
        // First authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        // Identify user for Firebase Performance tracing
        await monitoring.identifyUser(authData.user.id);

        // Check if user is a distributor user
        const { data: distributorUser, error: distributorError } = await supabase
          .from('distributor_users')
          .select('*, distributors(name, logo_url)')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        if (distributorError || !distributorUser) {
          await supabase.auth.signOut();
          throw new Error('You are not authorized to access the distributor portal');
        }

        // Update last login and status
        await supabase
          .from('distributor_users')
          .update({ 
            last_login_at: new Date().toISOString(),
            user_status: 'active',
          })
          .eq('id', distributorUser.id);

        // Store distributor context
        localStorage.setItem('distributor_user', JSON.stringify(distributorUser));
        localStorage.setItem('distributor_id', distributorUser.distributor_id);

        toast.success(`Welcome back, ${distributorUser.full_name}!`);
        navigate('/distributor-portal/dashboard');
      });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  if (impersonating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md shadow-xl border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading portal as user...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Distributor Portal</CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage your orders and inventory
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="distributor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </span>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Back to main login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributorLogin;
