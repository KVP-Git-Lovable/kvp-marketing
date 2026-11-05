import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LucideIcon } from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  color: string;
  id: string; // unique identifier
}

export interface NavGroup {
  id: string;
  name: string;
  isExpanded: boolean;
  itemIds: string[];
}

export interface NavCustomization {
  groups: NavGroup[];
  ungroupedItemIds: string[]; // items not in any group, in display order
  isCustomized: boolean;
}

const STORAGE_KEY_PREFIX = 'nav_customization_';

const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

export const useNavCustomization = (defaultItems: NavItem[]) => {
  const { user } = useAuth();
  const [customization, setCustomization] = useState<NavCustomization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const defaultItemsRef = useRef(defaultItems);
  defaultItemsRef.current = defaultItems;

  // Stable string of IDs to avoid re-render loops from array reference changes
  const defaultItemIds = defaultItems.map(item => item.id).join(',');

  // Load user's customization from localStorage
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(getStorageKey(user.id));
      if (stored) {
        const parsed = JSON.parse(stored) as NavCustomization;
        setCustomization(parsed);
      } else {
        // Default: no customization, all items ungrouped in original order
        setCustomization({
          groups: [],
          ungroupedItemIds: defaultItemsRef.current.map(item => item.id),
          isCustomized: false,
        });
      }
    } catch (e) {
      console.error('[useNavCustomization] Error loading customization:', e);
      setCustomization({
        groups: [],
        ungroupedItemIds: defaultItemsRef.current.map(item => item.id),
        isCustomized: false,
      });
    }
    setIsLoading(false);
  }, [user?.id, defaultItemIds]);

  // Save customization to localStorage
  const saveCustomization = useCallback((newCustomization: NavCustomization) => {
    if (!user?.id) return;
    
    const toSave = { ...newCustomization, isCustomized: true };
    localStorage.setItem(getStorageKey(user.id), JSON.stringify(toSave));
    setCustomization(toSave);
  }, [user?.id]);

  // Create a new group
  const createGroup = useCallback((name: string, itemIds: string[] = []) => {
    if (!customization) return;

    const newGroup: NavGroup = {
      id: `group_${Date.now()}`,
      name,
      isExpanded: true,
      itemIds,
    };

    // Remove items from ungrouped if they're being added to the new group
    const newUngroupedIds = customization.ungroupedItemIds.filter(
      id => !itemIds.includes(id)
    );

    // Also remove from other groups
    const updatedGroups = customization.groups.map(group => ({
      ...group,
      itemIds: group.itemIds.filter(id => !itemIds.includes(id)),
    }));

    saveCustomization({
      ...customization,
      groups: [...updatedGroups, newGroup],
      ungroupedItemIds: newUngroupedIds,
    });
  }, [customization, saveCustomization]);

  // Delete a group (items go back to ungrouped)
  const deleteGroup = useCallback((groupId: string) => {
    if (!customization) return;

    const groupToDelete = customization.groups.find(g => g.id === groupId);
    if (!groupToDelete) return;

    const newGroups = customization.groups.filter(g => g.id !== groupId);
    const newUngroupedIds = [...customization.ungroupedItemIds, ...groupToDelete.itemIds];

    saveCustomization({
      ...customization,
      groups: newGroups,
      ungroupedItemIds: newUngroupedIds,
    });
  }, [customization, saveCustomization]);

  // Rename a group
  const renameGroup = useCallback((groupId: string, newName: string) => {
    if (!customization) return;

    const newGroups = customization.groups.map(group =>
      group.id === groupId ? { ...group, name: newName } : group
    );

    saveCustomization({
      ...customization,
      groups: newGroups,
    });
  }, [customization, saveCustomization]);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupId: string) => {
    if (!customization) return;

    const newGroups = customization.groups.map(group =>
      group.id === groupId ? { ...group, isExpanded: !group.isExpanded } : group
    );

    saveCustomization({
      ...customization,
      groups: newGroups,
    });
  }, [customization, saveCustomization]);

  // Move item to a group
  const moveItemToGroup = useCallback((itemId: string, targetGroupId: string | null) => {
    if (!customization) return;

    // Remove item from all groups and ungrouped
    let newGroups = customization.groups.map(group => ({
      ...group,
      itemIds: group.itemIds.filter(id => id !== itemId),
    }));
    let newUngroupedIds = customization.ungroupedItemIds.filter(id => id !== itemId);

    if (targetGroupId === null) {
      // Move to ungrouped
      newUngroupedIds.push(itemId);
    } else {
      // Move to specific group
      newGroups = newGroups.map(group =>
        group.id === targetGroupId
          ? { ...group, itemIds: [...group.itemIds, itemId] }
          : group
      );
    }

    saveCustomization({
      ...customization,
      groups: newGroups,
      ungroupedItemIds: newUngroupedIds,
    });
  }, [customization, saveCustomization]);

  // Reorder items within a group or ungrouped list
  const reorderItems = useCallback((
    targetGroupId: string | null,
    newItemIds: string[]
  ) => {
    if (!customization) return;

    if (targetGroupId === null) {
      saveCustomization({
        ...customization,
        ungroupedItemIds: newItemIds,
      });
    } else {
      const newGroups = customization.groups.map(group =>
        group.id === targetGroupId
          ? { ...group, itemIds: newItemIds }
          : group
      );
      saveCustomization({
        ...customization,
        groups: newGroups,
      });
    }
  }, [customization, saveCustomization]);

  // Reorder groups
  const reorderGroups = useCallback((newGroupOrder: NavGroup[]) => {
    if (!customization) return;
    saveCustomization({
      ...customization,
      groups: newGroupOrder,
    });
  }, [customization, saveCustomization]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    if (!user?.id) return;
    
    localStorage.removeItem(getStorageKey(user.id));
    setCustomization({
      groups: [],
      ungroupedItemIds: defaultItemsRef.current.map(item => item.id),
      isCustomized: false,
    });
  }, [user?.id]);

  // Get organized items for display
  const getOrganizedItems = useCallback(() => {
    if (!customization) {
      return {
        groups: [],
        ungroupedItems: defaultItems,
      };
    }

    const itemMap = new Map(defaultItems.map(item => [item.id, item]));

    const organizedGroups = customization.groups.map(group => ({
      ...group,
      items: group.itemIds
        .map(id => itemMap.get(id))
        .filter((item): item is NavItem => !!item),
    }));

    const ungroupedItems = customization.ungroupedItemIds
      .map(id => itemMap.get(id))
      .filter((item): item is NavItem => !!item);

    // Add any new items that aren't in customization yet
    const allKnownIds = new Set([
      ...customization.groups.flatMap(g => g.itemIds),
      ...customization.ungroupedItemIds,
    ]);
    
    const newItems = defaultItems.filter(item => !allKnownIds.has(item.id));
    ungroupedItems.push(...newItems);

    return {
      groups: organizedGroups,
      ungroupedItems,
    };
  }, [customization, defaultItems]);

  return {
    customization,
    isLoading,
    isCustomized: customization?.isCustomized ?? false,
    createGroup,
    deleteGroup,
    renameGroup,
    toggleGroupExpansion,
    moveItemToGroup,
    reorderItems,
    reorderGroups,
    resetToDefault,
    getOrganizedItems,
    saveCustomization,
  };
};
