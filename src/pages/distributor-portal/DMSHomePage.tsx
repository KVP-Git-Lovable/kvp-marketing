import { useOutletContext } from 'react-router-dom';
import { AdBanner } from '@/components/distributor-portal/AdBanner';
import { QuickActions } from '@/components/distributor-portal/QuickActions';
import { SalesSnapshot } from '@/components/distributor-portal/SalesSnapshot';
import { InventoryWidget } from '@/components/distributor-portal/InventoryWidget';
import { SchemesWidget } from '@/components/distributor-portal/SchemesWidget';
import { AIInsightsWidget } from '@/components/distributor-portal/AIInsightsWidget';
import { TrendsWidget } from '@/components/distributor-portal/TrendsWidget';

interface DistributorUser {
  id: string;
  full_name: string;
  role: string;
  distributor_id: string;
  distributors?: { name: string };
}

interface OutletContext {
  user: DistributorUser;
  distributorId: string;
}

const DMSHomePage = () => {
  const { user, distributorId } = useOutletContext<OutletContext>();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your business today.
          </p>
        </div>
      </div>

      {/* Ad Banner */}
      <AdBanner />

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <QuickActions />
      </div>

      {/* Sales Snapshot */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Sales This Month
        </h2>
        <SalesSnapshot distributorId={distributorId} />
      </div>

      {/* Grid Layout for Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* AI Insights */}
          <AIInsightsWidget distributorId={distributorId} />
          
          {/* Schemes */}
          <SchemesWidget />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Inventory */}
          <InventoryWidget distributorId={distributorId} />
          
          {/* Trends */}
          <TrendsWidget distributorId={distributorId} />
        </div>
      </div>
    </div>
  );
};

export default DMSHomePage;
