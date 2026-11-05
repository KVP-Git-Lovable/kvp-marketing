import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SignInForm } from './SignInForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, User } from 'lucide-react';
import quickappLogo from "@/assets/quickapp-logo-full-yellow-black.png";

type AuthMode = 'signin' | 'forgot' | 'admin-signin' | 'user-signin';

export const AuthPage = () => {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('user-signin');

  // Clear URL parameters on mount to prevent auto-login from tokens
  useEffect(() => {
    if (window.location.search) {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const renderAuthModeContent = () => {
    switch (authMode) {
      case 'forgot':
        return (
          <>
            <ForgotPasswordForm />
            <div className="mt-4 text-center">
              <button
                onClick={() => setAuthMode('signin')}
                className="text-sm text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </>
        );
      
      case 'admin-signin':
        return (
          <>
            <div className="mb-4 text-center">
              <h3 className="text-xl font-semibold text-primary">Admin Sign In</h3>
              <p className="text-sm text-muted-foreground">Full system access</p>
            </div>
            <SignInForm role="admin" />
            <div className="mt-4 text-center space-y-2">
              <button
                onClick={() => setAuthMode('forgot')}
                className="text-sm text-primary hover:underline block w-full"
              >
                Forgot your password?
              </button>
              <button
                onClick={() => setAuthMode('user-signin')}
                className="text-sm text-muted-foreground hover:underline"
              >
                Back to user login
              </button>
            </div>
          </>
        );
      
      case 'user-signin':
        return (
          <>
            <SignInForm role="user" />
            <div className="mt-4 text-center space-y-3">
              <button
                onClick={() => setAuthMode('admin-signin')}
                className="text-sm text-primary hover:underline block w-full"
              >
                Admin Sign In
              </button>
              <button
                onClick={() => setAuthMode('forgot')}
                className="text-sm text-muted-foreground hover:underline block w-full"
              >
                Forgot your password?
              </button>
            </div>
          </>
        );
      
      default:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => setAuthMode('admin-signin')}
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <Shield className="h-6 w-6" />
                <span>Admin Sign In</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setAuthMode('user-signin')}
                className="h-16 flex flex-col items-center justify-center space-y-2"
              >
                <User className="h-6 w-6" />
                <span>User Sign In</span>
              </Button>
            </div>
          </div>
        );
    }
  };

  console.log('AuthPage rendering, authMode:', authMode);
  console.log('About to render background...');
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: '#1976d2',
        minHeight: '100vh'
      }}
    >
      {/* Geometric pattern overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 2px, transparent 2px),
            radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px, 25px 25px'
        }}
      ></div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-white/20 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <img 
              src={quickappLogo} 
              alt="QuickApp.AI" 
              className="h-16 w-16 rounded-xl shadow-lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                QuickApp<span className="text-amber-500">.ai</span>
              </h1>
              <p className="text-xs text-muted-foreground tracking-widest">AI-FORWARD COMMERCE</p>
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-primary mb-2">Welcome</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground">
              Select your role to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {renderAuthModeContent()}
        </CardContent>
      </Card>
    </div>
  );
};