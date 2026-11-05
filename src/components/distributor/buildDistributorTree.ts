import { resolveTypeCode, type DistributorType } from '@/hooks/useDistributorTypes';

/**
 * Arrange distributors into the shape they actually form.
 *
 * Kept out of the component so it can be tested without rendering, because what
 * it decides is not cosmetic: a row sorted into `orphans` is one that nothing
 * walking the network will ever reach, and that is worth being sure about.
 */

export interface TreeRow {
  id: string;
  name: string;
  parent_id: string | null;
  type_id: string | null;
  distribution_level: string | null;
  status: string;
  archived_at: string | null;
}

export interface TreeNode extends TreeRow {
  children: TreeNode[];
  typeCode: string | null;
}

export function buildTree(rows: TreeRow[], types: DistributorType[]) {
  const byId = new Map<string, TreeNode>();
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [], typeCode: resolveTypeCode(r, types) });
  }

  const roots: TreeNode[] = [];
  const orphans: TreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else if (node.parent_id) {
      // A parent that is not in this list — filtered out, or gone since.
      orphans.push(node);
    } else if (node.typeCode === 'OEM') {
      roots.push(node);
    } else {
      // No parent and not the company: not attached to the network at all.
      orphans.push(node);
    }
  }

  const byName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
  roots.sort(byName);
  orphans.sort(byName);
  for (const n of byId.values()) n.children.sort(byName);

  return { roots, orphans };
}
