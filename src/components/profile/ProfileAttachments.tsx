import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Paperclip, Trash2, Download, Plus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { moveToRecycleBin, restoreFromRecycleBin } from '@/utils/recycleBinUtils';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  attached_by: string;
  attached_by_name?: string;
  created_at: string;
}

interface RecycleBinItem {
  id: string;
  record_data: any;
  deleted_at: string;
  original_id: string;
}

export function ProfileAttachments() {
  const { user, userProfile } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (user) {
      fetchAttachments();
      fetchRecycleBinItems();
    }
  }, [user]);

  const fetchAttachments = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('profile_attachments')
      .select(`
        *,
        profiles!profile_attachments_attached_by_fkey(full_name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttachments(
        data.map((item: any) => ({
          ...item,
          attached_by_name: item.profiles?.full_name || 'Unknown',
        }))
      );
    }
    setLoading(false);
  };

  const fetchRecycleBinItems = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recycle_bin')
      .select('*')
      .eq('original_table', 'profile_attachments')
      .eq('deleted_by', user.id)
      .order('deleted_at', { ascending: false });

    if (!error && data) {
      setRecycleBinItems(data);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-attachments')
        .upload(fileName, selectedFile);

      if (uploadError) {
        // If bucket doesn't exist, try creating it via the standard upload
        throw uploadError;
      }

      // Create attachment record
      const { error: insertError } = await supabase
        .from('profile_attachments')
        .insert({
          user_id: user.id,
          file_name: selectedFile.name,
          file_url: uploadData.path,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          description: description || null,
          attached_by: user.id,
        });

      if (insertError) throw insertError;

      toast.success('File uploaded successfully');
      setSelectedFile(null);
      setDescription('');
      setIsDialogOpen(false);
      fetchAttachments();
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!user) return;

    try {
      // Move to recycle bin
      const success = await moveToRecycleBin({
        tableName: 'profile_attachments',
        recordId: attachment.id,
        recordData: attachment,
        moduleName: 'Profile Attachments',
        recordName: attachment.file_name,
      });

      if (success) {
        // Delete from original table
        await supabase
          .from('profile_attachments')
          .delete()
          .eq('id', attachment.id);
          
        toast.success('File moved to recycle bin');
        fetchAttachments();
        fetchRecycleBinItems();
      } else {
        toast.error('Failed to delete file');
      }
    } catch (error: any) {
      toast.error('Failed to delete file: ' + error.message);
    }
  };

  const handleRestore = async (item: RecycleBinItem) => {
    try {
      const success = await restoreFromRecycleBin(
        item.id,
        'profile_attachments',
        item.record_data,
        item.original_id
      );

      if (success) {
        toast.success('File restored successfully');
        fetchAttachments();
        fetchRecycleBinItems();
      } else {
        toast.error('Failed to restore file');
      }
    } catch (error: any) {
      toast.error('Failed to restore file: ' + error.message);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('profile-attachments')
        .download(attachment.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Failed to download file: ' + error.message);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            My Attachments
          </span>
          <div className="flex gap-2">
            <Dialog open={isRecycleBinOpen} onOpenChange={setIsRecycleBinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Recycle Bin ({recycleBinItems.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Recycle Bin - Deleted Attachments</DialogTitle>
                </DialogHeader>
                {recycleBinItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No deleted attachments
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recycleBinItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.record_data?.file_name}</TableCell>
                          <TableCell>
                            {format(new Date(item.deleted_at), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(item)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attachment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload New Attachment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter a description for this file..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    className="w-full"
                  >
                    {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Upload
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No attachments yet. Click "Add Attachment" to upload files.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Attached By</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((attachment) => (
                <TableRow key={attachment.id}>
                  <TableCell className="font-medium">{attachment.file_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {attachment.description || '-'}
                  </TableCell>
                  <TableCell>{formatFileSize(attachment.file_size)}</TableCell>
                  <TableCell>{attachment.attached_by_name}</TableCell>
                  <TableCell>
                    {format(new Date(attachment.created_at), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
