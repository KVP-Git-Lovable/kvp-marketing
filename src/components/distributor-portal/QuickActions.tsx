import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Package, 
  RotateCcw, 
  Headphones, 
  Lightbulb, 
  FileText,
  Truck,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  bgColor: string;
}

const quickActions: QuickAction[] = [
  { 
    label: 'New Order', 
    icon: Plus, 
    path: '/distributor-portal/create-primary-order',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20'
  },
  { 
    label: 'Goods Receipt', 
    icon: Truck, 
    path: '/distributor-portal/goods-receipt',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20'
  },
  { 
    label: 'Returns', 
    icon: RotateCcw, 
    path: '/distributor-portal/returns',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20'
  },
  { 
    label: 'Claims', 
    icon: FileText, 
    path: '/distributor-portal/claims',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20'
  },
  { 
    label: 'Support', 
    icon: Headphones, 
    path: '/distributor-portal/support',
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10 hover:bg-rose-500/20'
  },
  { 
    label: 'Share Idea', 
    icon: Lightbulb, 
    path: '/distributor-portal/ideas',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20'
  },
];

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {quickActions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
            "bg-card border shadow-sm hover:shadow-md",
            "group"
          )}
        >
          <div className={cn(
            "p-3 rounded-xl transition-colors",
            action.bgColor
          )}>
            <action.icon className={cn("w-6 h-6", action.color)} />
          </div>
          <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};
