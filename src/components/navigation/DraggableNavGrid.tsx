import { useState, useCallback } from 'react';
import { NavLink } from '@/components/NavLink';
import { NavItem } from '@/hooks/useNavCustomization';
import { GripVertical } from 'lucide-react';

interface DraggableNavGridProps {
  items: NavItem[];
  onReorder: (newItemIds: string[]) => void;
  onItemClick: () => void;
}

export const DraggableNavGrid = ({ items, onReorder, onItemClick }: DraggableNavGridProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    onReorder(newItems.map(item => item.id));
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`relative group cursor-move transition-all duration-200 ${
            draggedIndex === index ? 'opacity-50 scale-95' : ''
          } ${
            dragOverIndex === index ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : ''
          }`}
        >
          {/* Drag handle indicator */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          
          <NavLink 
            to={item.href}
            onClick={onItemClick}
            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${item.color} shadow-md`}>
              <item.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
          </NavLink>
        </div>
      ))}
    </div>
  );
};
