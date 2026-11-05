import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, LogOut, RefreshCw, Clock, Activity, Database } from 'lucide-react';
import { monitoring } from '@/services/MonitoringService';
import quickappLogo from "@/assets/quickapp-logo-full-yellow-black.png";
import { ActivityLoggingSection } from '@/components/status/ActivityLoggingSection';
import { LicenseDetailsSection } from '@/components/status/LicenseDetailsSection';

interface MetricCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  health: 'good' | 'average' | 'bad';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const HEALTH_DOT: Record<string, string> = {
  good: 'bg-green-500',
  average: 'bg-amber-500',
  bad: 'bg-red-500',
};

const AUTO_REFRESH_MS = 15 * 60 * 1000; // 15 minutes

const StatusDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [memoryPercent, setMemoryPercent] = useState<number | null>(null);

  const fetchMemoryUsage = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_estimated_memory_usage');
      if (!error && data !== null) {
        setMemoryPercent(typeof data === 'object' ? (data as any).estimated_memory_usage_percent : data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMetrics = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.rpc('get_database_metrics');
      if (error) throw error;

      const m = data as any;
      const uptimeSec = m.uptime_seconds;

      setIsOnline(true);
      setMetrics([
        {
          label: 'Database Size',
          value: formatBytes(m.db_size_bytes),
          icon: <Database className="h-6 w-6" />,
          description: 'Total database storage',
          health: m.db_size_bytes < 500 * 1024 * 1024 ? 'good' : m.db_size_bytes < 2 * 1024 * 1024 * 1024 ? 'average' : 'bad',
        },
        {
          label: 'Uptime',
          value: formatUptime(uptimeSec),
          icon: <Clock className="h-6 w-6" />,
          description: `Since ${new Date(m.postmaster_start_time).toLocaleDateString()}`,
          health: uptimeSec > 86400 ? 'good' : uptimeSec > 3600 ? 'average' : 'bad',
        },
      ]);
      setLastRefreshed(new Date());
      await fetchMemoryUsage();
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      setIsOnline(false);
      toast({ title: 'Error', description: error.message || 'Failed to fetch metrics', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMemoryUsage]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchMetrics, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchMetrics]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await monitoring.trace('status_dashboard_login_process', async () => {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError || !authData.user) {
          toast({ title: 'Authentication Failed', description: authError?.message || 'Invalid credentials', variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        // Identify user for Firebase Performance tracing
        await monitoring.identifyUser(authData.user.id);

        // Check if user has admin_dashboard permission via profile_object_permissions
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('profile_id')
          .eq('user_id', authData.user.id)
          .single();
        
        let hasAccess = false;
        if (!profileError && profileData?.profile_id) {
          const { data: perms } = await supabase
            .from('profile_object_permissions')
            .select('object_name')
            .eq('profile_id', profileData.profile_id)
            .like('object_name', 'admin_%')
            .eq('can_read', true)
            .limit(1);
          hasAccess = (perms && perms.length > 0) || false;
        }
        
        if (!hasAccess) {
          toast({ title: 'Access Denied', description: 'You do not have admin permissions to access this dashboard.', variant: 'destructive' });
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }
        setIsAuthenticated(true);
        toast({ title: 'Welcome', description: 'Successfully authenticated as Administrator' });
        await fetchMetrics();
      });
    } catch (error) {
      console.error('Login error:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setMetrics([]);
    setEmail('');
    setPassword('');
    setLastRefreshed(null);
  };

  // --- Login View ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#1976d2', minHeight: '100vh' }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 2px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 1px, transparent 1px)`, backgroundSize: '50px 50px, 25px 25px' }} />
        <Card className="w-full max-w-md relative z-10 shadow-2xl border-white/20 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <img src={quickappLogo} alt="QuickApp.AI" className="h-16 w-16 rounded-xl shadow-lg" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">QuickApp<span className="text-amber-500">.ai</span></h1>
                <p className="text-xs text-muted-foreground tracking-widest">STATUS DASHBOARD</p>
              </div>
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-primary">Status Metrics Dashboard</CardTitle>
              <CardDescription className="text-sm font-medium text-muted-foreground mt-1">Administrator Access Only</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email Address</Label>
                <Input id="admin-email" type="email" placeholder="admin@quickapp.ai" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input id="admin-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign In'}</Button>
              <div className="text-center mt-3">
                <a href="/auth" className="text-xs text-muted-foreground hover:text-primary underline">Back to dashboard</a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Dashboard View ---
  return (
    <div className="min-h-screen relative" style={{ background: '#1976d2' }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 2px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 1px, transparent 1px)`, backgroundSize: '50px 50px, 25px 25px' }} />
      <div className="relative z-10">
        {/* Healthy + Online banner */}
        {isOnline && metrics.length > 0 && (
          <div className="flex justify-center pt-4">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-green-500/20 text-green-100 text-base md:text-lg font-semibold border border-green-400/30">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              Healthy · Online
            </span>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={quickappLogo} alt="QuickApp.AI" className="h-10 w-10 rounded-lg shadow" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white">QuickApp<span className="text-amber-400">.ai</span> Status Dashboard</h1>
              <p className="text-sm md:text-base text-white/60">
                AWS ap-south-1 (Mumbai) | PostgreSQL
                {lastRefreshed && ` · Refreshed: ${lastRefreshed.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={isRefreshing} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="px-4 md:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {metrics.map((metric, idx) => {
              const healthColor = HEALTH_DOT[metric.health];
              const healthLabel = metric.health === 'good' ? 'Healthy' : metric.health === 'average' ? 'Warning' : 'Critical';
              return (
                <Card key={idx} className="bg-white/95 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="p-1.5 rounded-full bg-primary/10 text-primary">{metric.icon}</div>
                    <p className="text-lg md:text-xl font-bold text-foreground">{metric.value}</p>
                    <p className="text-xs font-medium text-foreground">{metric.label}</p>
                    {metric.description && <p className="text-[10px] text-muted-foreground">{metric.description}</p>}
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                      <span className="text-[10px] font-medium" style={{ color: metric.health === 'good' ? '#22c55e' : metric.health === 'average' ? '#f59e0b' : '#ef4444' }}>{healthLabel}</span>
                      <span className={`w-10 h-1 rounded-full ${healthColor}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {/* Memory card */}
            {memoryPercent !== null && (() => {
              const memHealth = memoryPercent < 60 ? 'good' : memoryPercent < 85 ? 'average' : 'bad';
              const memColor = HEALTH_DOT[memHealth];
              const memLabel = memHealth === 'good' ? 'Healthy' : memHealth === 'average' ? 'Warning' : 'Critical';
              return (
                <Card className="bg-white/95 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="p-1.5 rounded-full bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
                    <p className="text-lg md:text-xl font-bold text-foreground">{Number(memoryPercent).toFixed(1)}%</p>
                    <p className="text-xs font-medium text-foreground">Memory</p>
                    <p className="text-[10px] text-muted-foreground">Estimated memory usage</p>
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                      <span className="text-[10px] font-medium" style={{ color: memHealth === 'good' ? '#22c55e' : memHealth === 'average' ? '#f59e0b' : '#ef4444' }}>{memLabel}</span>
                      <span className={`w-10 h-1 rounded-full ${memColor}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
          <p className="text-xs text-white/40 text-center mt-6">Auto-refreshes every 15 minutes</p>

          {/* License Details Section */}
          <div className="mt-6">
            <LicenseDetailsSection />
          </div>

          {/* Activity Logging Section */}
          <div className="mt-6">
            <ActivityLoggingSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDashboard;
