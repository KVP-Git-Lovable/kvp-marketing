import { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  color: string;
}

interface QuickNavGridProps {
  items: NavItem[];
}

export const QuickNavGrid = ({ items }: QuickNavGridProps) => {
  const { t } = useTranslation('common');
  
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t('home.quickActions')}</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <NavLink 
            key={item.href} 
            to={item.href}
            className="group block"
          >
            <div className="p-3 text-center transition-all duration-300 hover:scale-105">
              <div className={`inline-flex items-center justify-center w-12 h-12 mb-2 rounded-xl bg-gradient-to-r ${item.color} shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 border border-white/20`}>
                <item.icon className="h-5 w-5 text-white drop-shadow-sm" />
              </div>
              <h3 className="font-medium text-[10px] text-foreground/80 group-hover:text-primary transition-colors leading-tight">
                {item.label}
              </h3>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
};
