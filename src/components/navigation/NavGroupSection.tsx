import { useState } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { NavItem } from '@/hooks/useNavCustomization';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavGroupSectionProps {
  name: string;
  items: NavItem[];
  isExpanded: boolean;
  onItemClick: () => void;
}

export const NavGroupSection = ({ name, items, isExpanded: defaultExpanded, onItemClick }: NavGroupSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-slate-500 to-slate-600 shadow-sm">
          <Folder className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold flex-1 text-left">{name}</span>
        <span className="text-xs text-muted-foreground mr-1">{items.length}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-3 gap-3 pt-2 pl-2">
          {items.map((item) => (
            <NavLink 
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${item.color} shadow-md`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
