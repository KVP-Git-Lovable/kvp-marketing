import { useState, useCallback } from 'react';
import { Settings, Trash2, ChevronDown, ChevronRight, GripVertical, FolderPlus, RotateCcw, X, Check, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NavItem, NavGroup, NavCustomization } from '@/hooks/useNavCustomization';

interface NavCustomizeDialogProps {
  defaultItems: NavItem[];
  customization: NavCustomization | null;
  onCreateGroup: (name: string, itemIds?: string[]) => void;
  onDeleteGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onMoveItemToGroup: (itemId: string, targetGroupId: string | null) => void;
  onReorderItems: (targetGroupId: string | null, newItemIds: string[]) => void;
  onReorderGroups: (newGroupOrder: NavGroup[]) => void;
  onResetToDefault: () => void;
  getOrganizedItems: () => {
    groups: (NavGroup & { items: NavItem[] })[];
    ungroupedItems: NavItem[];
  };
}

export const NavCustomizeDialog = ({
  defaultItems,
  customization,
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onMoveItemToGroup,
  onReorderItems,
  onReorderGroups,
  onResetToDefault,
  getOrganizedItems,
}: NavCustomizeDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ id: string; sourceGroupId: string | null } | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const organized = getOrganizedItems();

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName.trim(), selectedItems);
    setNewGroupName('');
    setSelectedItems([]);
  };

  const handleStartEdit = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingGroupId && editingGroupName.trim()) {
      onRenameGroup(editingGroupId, editingGroupName.trim());
    }
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleDragStart = (itemId: string, sourceGroupId: string | null) => {
    setDraggedItem({ id: itemId, sourceGroupId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnGroup = (targetGroupId: string | null) => {
    if (draggedItem && draggedItem.sourceGroupId !== targetGroupId) {
      onMoveItemToGroup(draggedItem.id, targetGroupId);
    }
    setDraggedItem(null);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const moveItems = useCallback((
    groupId: string | null,
    items: NavItem[],
    fromIndex: number,
    toIndex: number
  ) => {
    const newItemIds = items.map(i => i.id);
    const [removed] = newItemIds.splice(fromIndex, 1);
    newItemIds.splice(toIndex, 0, removed);
    onReorderItems(groupId, newItemIds);
  }, [onReorderItems]);

  const renderItem = (item: NavItem, groupId: string | null, index: number, items: NavItem[]) => {
    const isSelected = selectedItems.includes(item.id);
    
    return (
      <div
        key={item.id}
        draggable
        onDragStart={() => handleDragStart(item.id, groupId)}
        className={`flex items-center gap-2 p-2 rounded-lg border bg-background cursor-move transition-colors ${
          isSelected ? 'ring-2 ring-primary border-primary' : 'hover:bg-muted/50'
        }`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <button
          onClick={() => toggleItemSelection(item.id)}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
          }`}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </button>
        <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-r ${item.color} shadow-sm flex-shrink-0`}>
          <item.icon className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-medium truncate flex-1">{item.label}</span>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => moveItems(groupId, items, index, Math.max(0, index - 1))}
            disabled={index === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            title="Move up"
          >
            <ChevronDown className="h-3 w-3 rotate-180" />
          </button>
          <button
            onClick={() => moveItems(groupId, items, index, Math.min(items.length - 1, index + 1))}
            disabled={index === items.length - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Customize menu">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Customize Navigation
          </DialogTitle>
        </DialogHeader>

        {/* Create Group Section - Fixed at top */}
        <div className="px-6 pb-4 flex-shrink-0 space-y-2 border-b">
          <label className="text-sm font-medium">Create New Group</label>
          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <Button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              size="sm"
              className="gap-1"
            >
              <FolderPlus className="h-4 w-4" />
              Create
            </Button>
          </div>
          {selectedItems.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedItems.length} item(s) selected - will be added to new group
            </p>
          )}
        </div>

        {/* Scrollable Groups and Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Custom Groups */}
            {organized.groups.map((group) => (
              <div
                key={group.id}
                className="border rounded-lg overflow-hidden bg-background"
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnGroup(group.id)}
              >
                <div className="flex items-center gap-2 p-2 bg-muted/50">
                  <ChevronRight className={`h-4 w-4 transition-transform ${group.isExpanded ? 'rotate-90' : ''}`} />
                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className="h-7 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                      />
                      <button onClick={handleSaveEdit} className="p-1 hover:bg-muted rounded">
                        <Check className="h-4 w-4 text-green-600" />
                      </button>
                      <button onClick={() => setEditingGroupId(null)} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium flex-1">{group.name}</span>
                      <span className="text-xs text-muted-foreground">{group.items.length} items</span>
                      <button
                        onClick={() => handleStartEdit(group.id, group.name)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => onDeleteGroup(group.id)}
                        className="p-1 hover:bg-muted rounded text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                {group.isExpanded && group.items.length > 0 && (
                  <div className="p-2 space-y-1">
                    {group.items.map((item, index) => renderItem(item, group.id, index, group.items))}
                  </div>
                )}
                {group.isExpanded && group.items.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Drag items here to add them to this group
                  </div>
                )}
              </div>
            ))}

            {/* Ungrouped Items */}
            <div
              className="border rounded-lg overflow-hidden bg-background"
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnGroup(null)}
            >
              <div className="flex items-center gap-2 p-2 bg-muted/50">
                <span className="text-sm font-medium flex-1">Ungrouped</span>
                <span className="text-xs text-muted-foreground">{organized.ungroupedItems.length} items</span>
              </div>
              <div className="p-2 space-y-1">
                {organized.ungroupedItems.map((item, index) => 
                  renderItem(item, null, index, organized.ungroupedItems)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-background gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onResetToDefault}
            className="gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
