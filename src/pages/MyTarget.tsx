import { Layout } from '@/components/Layout';
import { UserFYPlanTarget } from '@/components/profile/UserFYPlanTarget';
import { Target } from 'lucide-react';
import { ModuleHelpButton } from "@/components/help/ModuleHelpButton";

const MyTarget = () => {
  return (
    <Layout>
      <div className="p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Target className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Target</h1>
              <p className="text-muted-foreground">Track your performance targets and achievements</p>
            </div>
            <ModuleHelpButton categoryId="performance" articleId="performance-targets" />
          </div>

          {/* Target Content */}
          <UserFYPlanTarget />
        </div>
      </div>
    </Layout>
  );
};

export default MyTarget;
