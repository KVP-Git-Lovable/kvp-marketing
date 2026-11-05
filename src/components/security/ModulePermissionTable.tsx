import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { PERMISSION_MODULES } from './permissionModules';

const PERM_COLUMNS = [
  { key: 'all', label: 'All' },
  { key: 'can_read', label: 'View' },
  { key: 'can_create', label: 'Create' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
] as const;

const INDIVIDUAL_FIELDS = ['can_read', 'can_create', 'can_edit', 'can_delete'] as const;

export interface PermissionMap {
  [objectName: string]: {
    can_read: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

interface ModulePermissionTableProps {
  permissions: PermissionMap;
  onChange: (objectName: string, field: string, value: boolean) => void;
  disabled?: boolean;
}

// Collect all leaf permission names under a module
function getModuleLeafNames(mod: typeof PERMISSION_MODULES[0]): string[] {
  const names: string[] = [];
  mod.features.forEach(feat => {
    if (feat.subFeatures && feat.subFeatures.length > 0) {
      feat.subFeatures.forEach(sf => names.push(sf.name));
    } else {
      names.push(feat.name);
    }
  });
  return names;
}

// Collect leaf names under a feature
function getFeatureLeafNames(feat: typeof PERMISSION_MODULES[0]['features'][0]): string[] {
  if (feat.subFeatures && feat.subFeatures.length > 0) {
    return feat.subFeatures.map(sf => sf.name);
  }
  return [feat.name];
}

export const ModulePermissionTable = ({ permissions, onChange, disabled }: ModulePermissionTableProps) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const getVal = (name: string, field: string) =>
    permissions[name]?.[field as keyof PermissionMap[string]] ?? false;

  const isAllFieldChecked = (leafNames: string[], field: string) =>
    leafNames.every(n => getVal(n, field));

  const isAllCheckedAll = (leafNames: string[]) =>
    INDIVIDUAL_FIELDS.every(f => leafNames.every(n => getVal(n, f)));

  const toggleField = (leafNames: string[], field: string, checked: boolean) =>
    leafNames.forEach(n => onChange(n, field, checked));

  const toggleAll = (leafNames: string[], checked: boolean) =>
    leafNames.forEach(n => INDIVIDUAL_FIELDS.forEach(f => onChange(n, f, checked)));

  const toggleModule = (name: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleFeature = (name: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const renderCheckboxes = (leafNames: string[], isSingleLeaf = false) => (
    <>
      {/* All column */}
      <div className="flex justify-center">
        <Checkbox
          checked={isAllCheckedAll(leafNames)}
          onCheckedChange={(checked) => toggleAll(leafNames, checked as boolean)}
          disabled={disabled}
        />
      </div>
      {/* Individual columns */}
      {INDIVIDUAL_FIELDS.map(f => (
        <div key={f} className="flex justify-center">
          <Checkbox
            checked={isSingleLeaf ? getVal(leafNames[0], f) : isAllFieldChecked(leafNames, f)}
            onCheckedChange={(checked) =>
              isSingleLeaf
                ? onChange(leafNames[0], f, checked as boolean)
                : toggleField(leafNames, f, checked as boolean)
            }
            disabled={disabled}
          />
        </div>
      ))}
    </>
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(5,64px)] bg-muted/50 border-b px-4 py-3">
        <span className="text-sm font-medium text-primary">Module</span>
        {PERM_COLUMNS.map(col => (
          <span key={col.key} className="text-sm font-medium text-primary text-center">{col.label}</span>
        ))}
      </div>

      {/* Module rows */}
      <div className="divide-y">
        {PERMISSION_MODULES.map(mod => {
          const modLeaves = getModuleLeafNames(mod);
          const isExpanded = expandedModules.has(mod.name);

          return (
            <div key={mod.name}>
              {/* Module header row */}
              <div
                className="grid grid-cols-[1fr_repeat(5,64px)] items-center px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleModule(mod.name)}
              >
                <span className="text-sm font-semibold flex items-center gap-2">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  {mod.label}
                </span>
                {/* Stop click propagation on checkboxes */}
                <div onClick={e => e.stopPropagation()} className="contents">
                  {renderCheckboxes(modLeaves)}
                </div>
              </div>

              {/* Expanded features */}
              {isExpanded && mod.features.map(feat => {
                const hasSubFeatures = feat.subFeatures && feat.subFeatures.length > 0;
                const featLeaves = getFeatureLeafNames(feat);
                const isFeatExpanded = expandedFeatures.has(feat.name);

                return (
                  <div key={feat.name}>
                    {/* Feature row */}
                    <div
                      className={`grid grid-cols-[1fr_repeat(5,64px)] items-center px-4 py-2.5 ${hasSubFeatures ? 'cursor-pointer hover:bg-muted/20' : ''} transition-colors`}
                      onClick={hasSubFeatures ? () => toggleFeature(feat.name) : undefined}
                    >
                      <span className="text-sm pl-8 flex items-center gap-2">
                        {hasSubFeatures && (
                          isFeatExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {feat.label}
                      </span>
                      <div onClick={e => e.stopPropagation()} className="contents">
                        {hasSubFeatures
                          ? renderCheckboxes(featLeaves)
                          : renderCheckboxes(featLeaves, true)
                        }
                      </div>
                    </div>

                    {/* Sub-features */}
                    {hasSubFeatures && isFeatExpanded && feat.subFeatures!.map(sf => (
                      <div
                        key={sf.name}
                        className="grid grid-cols-[1fr_repeat(5,64px)] items-center px-4 py-2"
                      >
                        <span className="text-sm pl-14 text-muted-foreground">
                          └ {sf.label}
                        </span>
                        {renderCheckboxes([sf.name], true)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
