import { useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PermissionLayerTable, PermissionMap, CRUDFlags } from './PermissionLayerTable';
import { HIERARCHICAL_MODULES, getAllModuleNames, getPermissionType } from './hierarchicalPermissions';

interface HierarchicalPermissionEditorProps {
  permissions: PermissionMap;
  onChange: (name: string, field: keyof CRUDFlags, value: boolean) => void;
  disabled?: boolean;
}

export const HierarchicalPermissionEditor = ({
  permissions,
  onChange,
  disabled,
}: HierarchicalPermissionEditorProps) => {

  // When a module-level CRUD flag changes, cascade to all children
  const handleModuleChange = useCallback(
    (moduleName: string, field: keyof CRUDFlags, value: boolean) => {
      // Update the module row itself
      onChange(moduleName, field, value);

      // Find the actual module definition (strip 'module_' prefix)
      const modKey = moduleName.replace(/^module_/, '');
      const mod = HIERARCHICAL_MODULES.find(m => m.name === modKey);
      if (!mod) return;

      // Cascade to all children
      const children = [
        ...mod.fields.map(f => f.name),
        ...mod.actions.map(a => a.name),
        ...mod.widgets.map(w => w.name),
      ];
      children.forEach(childName => onChange(childName, field, value));
    },
    [onChange]
  );

  // Module tab — flat rows
  const moduleRows = useMemo(() =>
    HIERARCHICAL_MODULES.map(m => ({
      name: `module_${m.name}`,
      label: m.label,
    })),
    []
  );

  // Field tab — grouped by module
  const fieldGroups = useMemo(() =>
    HIERARCHICAL_MODULES.map(m => ({
      moduleLabel: m.label,
      moduleName: m.name,
      items: m.fields,
    })),
    []
  );

  // Action tab — grouped by module
  const actionGroups = useMemo(() =>
    HIERARCHICAL_MODULES.map(m => ({
      moduleLabel: m.label,
      moduleName: m.name,
      items: m.actions,
    })),
    []
  );

  // Widget tab — grouped by module
  const widgetGroups = useMemo(() =>
    HIERARCHICAL_MODULES.map(m => ({
      moduleLabel: m.label,
      moduleName: m.name,
      items: m.widgets,
    })),
    []
  );

  return (
    <Tabs defaultValue="module" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="module">Module Permission</TabsTrigger>
        <TabsTrigger value="field">Field Permission</TabsTrigger>
        <TabsTrigger value="action">Action Permission</TabsTrigger>
        <TabsTrigger value="widget">Widget Permission</TabsTrigger>
      </TabsList>

      <TabsContent value="module">
        <PermissionLayerTable
          rows={moduleRows}
          permissions={permissions}
          onChange={handleModuleChange}
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="field">
        <PermissionLayerTable
          groups={fieldGroups}
          permissions={permissions}
          onChange={onChange}
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="action">
        <PermissionLayerTable
          groups={actionGroups}
          permissions={permissions}
          onChange={onChange}
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="widget">
        <PermissionLayerTable
          groups={widgetGroups}
          permissions={permissions}
          onChange={onChange}
          disabled={disabled}
        />
      </TabsContent>
    </Tabs>
  );
};
