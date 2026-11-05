import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateParameterDefinition } from '@/hooks/useTargetParameters';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const DATA_SOURCES = [
  { label: 'Products', table: 'products', idCol: 'id', nameCol: 'name' },
  { label: 'Retailers', table: 'retailers', idCol: 'id', nameCol: 'retailer_name' },
  { label: 'Beats', table: 'beats', idCol: 'id', nameCol: 'beat_name' },
  { label: 'Distributors', table: 'distributors', idCol: 'id', nameCol: 'name' },
  { label: 'Territories', table: 'territories', idCol: 'id', nameCol: 'name' },
];

const ICONS = ['📊', '🏷️', '📂', '🔖', '🎯', '📋', '🗂️', '🔗', '🌐', '⚙️', '📈', '🏢'];

interface CreateParameterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateParameterDialog: React.FC<CreateParameterDialogProps> = ({ open, onOpenChange }) => {
  const [name, setName] = useState('');
  const [parameterKey, setParameterKey] = useState('');
  const [icon, setIcon] = useState('📊');
  const [dataSourceIdx, setDataSourceIdx] = useState<string>('');
  const createMutation = useCreateParameterDefinition();

  // Auto-generate key from name
  useEffect(() => {
    setParameterKey(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '')
    );
  }, [name]);

  const resetForm = () => {
    setName('');
    setParameterKey('');
    setIcon('📊');
    setDataSourceIdx('');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !parameterKey.trim() || dataSourceIdx === '') {
      toast.error('Please fill all required fields');
      return;
    }

    const source = DATA_SOURCES[parseInt(dataSourceIdx)];
    if (!source) return;

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        parameter_key: parameterKey.trim(),
        icon,
        data_source_table: source.table,
        data_source_id_column: source.idCol,
        data_source_name_column: source.nameCol,
      });
      toast.success(`Parameter "${name}" created`);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('A parameter with this key already exists');
      } else {
        toast.error('Failed to create parameter');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create Custom Parameter
          </DialogTitle>
          <DialogDescription>
            Define a new breakdown parameter linked to an existing data source.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">Parameter Name</Label>
            <Input
              placeholder="e.g. Channel-wise, Zone-wise"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Key (auto-generated) */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Key (auto-generated)</Label>
            <Input
              value={parameterKey}
              onChange={(e) => setParameterKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-lg transition-all ${
                    icon === emoji
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Data Source */}
          <div className="space-y-1.5">
            <Label className="text-sm">Data Source</Label>
            <Select value={dataSourceIdx} onValueChange={setDataSourceIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Select data source..." />
              </SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((src, idx) => (
                  <SelectItem key={src.table} value={String(idx)}>
                    {src.label} ({src.table})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Values will be pulled from this table during target allocation.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Parameter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
