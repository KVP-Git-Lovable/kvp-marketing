/**
 * Dev-mode permission validation utility.
 * Compares all permission keys defined in hierarchicalPermissions.ts and permissionModules.ts
 * against the user's actual DB permissions. Logs warnings for mismatches.
 *
 * Usage: call validatePermissions(permissions) on app load (dev only).
 */

import { devWarn, devLog } from '@/utils/devLog';
import {
  getAllModuleNames,
  getAllFieldNames,
  getAllActionNames,
  getAllWidgetNames,
} from '@/components/security/hierarchicalPermissions';
import { getAllModulePermissionItems } from '@/components/security/permissionModules';

interface PermissionRecord {
  object_name: string;
  can_read: boolean;
}

/**
 * Validates that all UI-referenced permission keys exist in the user's DB permissions.
 * Only runs in dev mode. Logs warnings for any missing keys.
 */
export const validatePermissions = (dbPermissions: PermissionRecord[]): void => {
  if (!import.meta.env.DEV) return;

  const dbKeys = new Set(dbPermissions.map(p => p.object_name));

  // All keys referenced in hierarchical permissions (Module/Field/Action/Widget)
  const hierarchicalKeys = [
    ...getAllModuleNames(),
    ...getAllFieldNames(),
    ...getAllActionNames(),
    ...getAllWidgetNames(),
  ];

  // All keys from permissionModules (legacy flat structure)
  const moduleKeys = getAllModulePermissionItems();

  // Combine and deduplicate
  const allUIKeys = new Set([...hierarchicalKeys, ...moduleKeys]);

  const missing: string[] = [];
  allUIKeys.forEach(key => {
    if (!dbKeys.has(key)) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    devWarn(
      `⚠️ Permission Validator: ${missing.length} UI permission key(s) not found in DB for current profile.\n` +
      `→ To fix: Go to Security & Access Control → select the profile → enable the missing permissions.\n` +
      `→ System Administrator profiles get new permissions automatically via DB trigger.\n` +
      `→ Missing keys:`,
      missing.sort()
    );
  } else {
    devLog('✅ Permission Validator: All UI permission keys found in DB.');
  }
};
