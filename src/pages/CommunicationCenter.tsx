import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Workflow, Facebook, Link2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { cn } from '@/lib/utils';
import { useProfilePermissions } from '@/hooks/useProfilePermissions';
import WhatsAppTab from './communication/WhatsAppTab';
import JourneyBuilderTab from './communication/JourneyBuilderTab';
import MetaTab from './communication/MetaTab';
import MetaConnectionTab from './communication/MetaConnectionTab';
import CommunicationCalendar from './communication/CommunicationCalendar';
import whatsappLogo from '@/assets/whatsapp-logo.png';
import facebookLogo from '@/assets/facebook-logo.png';
import instagramLogo from '@/assets/instagram-logo.png';

const TABS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, prefix: 'comm_whatsapp_', Component: WhatsAppTab },
  { id: 'journey-builder', label: 'Journey Builder', icon: Workflow, prefix: 'comm_journey_', Component: JourneyBuilderTab },
  { id: 'meta', label: 'Meta', icon: Facebook, prefix: 'comm_meta_', Component: MetaTab },
  { id: 'meta-connection', label: 'Meta Connection', icon: Link2, prefix: 'comm_metaconn_', Component: MetaConnectionTab },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, prefix: 'comm_journey_', Component: CommunicationCalendar },
] as const;

export default function CommunicationCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions, hasModuleAccess } = useProfilePermissions();
  const noProfileAssigned = permissions.length === 0;

  const visibleTabs = TABS.filter((t) => noProfileAssigned || hasModuleAccess(t.prefix));
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTabState] = useState<string>(
    (tabParam && visibleTabs.some((t) => t.id === tabParam)) ? tabParam : (visibleTabs[0]?.id || TABS[0].id)
  );
  const setActiveTab = (id: string) => {
    setActiveTabState(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (tabParam && tabParam !== activeTab && visibleTabs.some((t) => t.id === tabParam)) {
      setActiveTabState(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  return (
    <Layout>
      <div className="min-h-screen bg-background pb-20 flex flex-col">
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Communication Center</h1>
                <p className="text-sm text-muted-foreground">WhatsApp, Journey Builder and Meta Ads/organic posting</p>
              </div>
            </div>
          </div>

          {/* Mobile tab nav — icon-only horizontal row */}
          {visibleTabs.length > 0 && (
            <div className="md:hidden flex items-center gap-1 border-t px-2 py-2">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full p-2 transition-colors',
                    activeTab === t.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <t.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleTabs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12 px-4">
            You don't have access to any Communication Center sections yet. Ask an admin to grant access from Admin Panel → Security & Access.
          </p>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Desktop vertical tab nav */}
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-accent-gold/40 bg-gradient-hero">
              <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors text-left',
                      activeTab === t.id
                        ? 'bg-yellow-400 text-yellow-950 font-medium shadow-sm'
                        : 'text-white/75 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <t.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <main className="flex-1 min-w-0 p-4">
              <div className="flex items-center justify-end mb-3 h-14">
                {activeTab === 'whatsapp' && (
                  <img src={whatsappLogo} alt="WhatsApp" className="h-14 w-auto" />
                )}
                {(activeTab === 'meta' || activeTab === 'meta-connection') && (
                  <div className="flex items-center gap-3">
                    <img src={facebookLogo} alt="Facebook" className="h-6 w-auto" />
                    <img src={instagramLogo} alt="Instagram" className="h-6 w-auto" />
                  </div>
                )}
              </div>
              {visibleTabs.map((t) => activeTab === t.id && <t.Component key={t.id} />)}
            </main>
          </div>
        )}
      </div>
    </Layout>
  );
}
