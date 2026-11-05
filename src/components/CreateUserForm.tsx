import React, { useState, useEffect } from 'react';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Eye, EyeOff, Key, Copy, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Manager {
  id: string;
  username: string;
  full_name: string;
}

interface FileUpload {
  file: File;
  type: 'address_proof' | 'id_proof' | 'photo';
  preview?: string;
}

interface SecurityProfile {
  id: string;
  name: string;
}

const CreateUserForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [securityProfiles, setSecurityProfiles] = useState<SecurityProfile[]>([]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: '',
    phone_number: '',
    recovery_email: '',
    hint_question: '',
    hint_answer: '',
    monthly_salary: '',
    daily_da_allowance: '',
    manager_id: '',
    secondary_manager_id: '',
    security_profile_id: '',
    hq: '',
    date_of_joining: '',
    date_of_exit: '',
    alternate_email: '',
    address: '',
    education: '',
    emergency_contact_number: '',
    band: ''
  });

  // Fetch managers and security profiles
  useEffect(() => {
    const fetchData = async () => {
      const [managersRes, profilesRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name').match(ACTIVE_PROFILE).order('full_name'),
        supabase.from('security_profiles').select('id, name').order('name')
      ]);

      if (!managersRes.error && managersRes.data) {
        setManagers(managersRes.data);
      }
      if (!profilesRes.error && profilesRes.data) {
        setSecurityProfiles(profilesRes.data);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateTemporaryPassword = () => {
    // Generate a strong random password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const specialChars = '!@#$%&*';
    let password = '';
    
    // Add 8 random chars
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Add a special char
    password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    // Add 3 more random chars
    for (let i = 0; i < 3; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    setFormData(prev => ({ ...prev, password }));
    setShowPassword(true);
    setRequirePasswordChange(true);
  };

  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formData.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard"
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (type: 'address_proof' | 'id_proof' | 'photo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Remove existing file of the same type
    setFiles(prev => prev.filter(f => f.type !== type));

    const newFile: FileUpload = { file, type };

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newFile.preview = e.target?.result as string;
        setFiles(prev => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    } else {
      setFiles(prev => [...prev, newFile]);
    }
  };

  const removeFile = (type: string) => {
    setFiles(prev => prev.filter(f => f.type !== type));
  };

  const uploadFile = async (file: File, userId: string, type: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${type}_${Date.now()}.${fileExt}`;
    
    let bucket = 'employee-docs';
    if (type === 'photo') {
      bucket = 'employee-photos';
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) {
      console.error('File upload error:', error);
      return null;
    }

    return data.path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          ...formData,
          is_temporary_password: requirePasswordChange
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create user');
      }

      if (data?.error) {
        console.error('Server error:', data.error, data.details);
        throw new Error(data.details || data.error || 'Failed to create user');
      }

      if (!data?.user?.id) {
        throw new Error('User creation succeeded but no user ID returned');
      }

      const userId = data.user.id;

      // Upload document files (profile photo will be captured on first login)
      const docFiles = files.filter(f => f.type !== 'photo');
      for (const docFile of docFiles) {
        const filePath = await uploadFile(docFile.file, userId, docFile.type);
        if (filePath) {
          await supabase
            .from('employee_documents')
            .insert({
              user_id: userId,
              doc_type: docFile.type as 'address_proof' | 'id_proof',
              file_path: filePath,
              file_name: docFile.file.name,
              content_type: docFile.file.type,
              uploaded_by: userId
            });
        }
      }

      toast({
        title: "Success",
        description: "User created successfully!"
      });

      // Reset form
      setFormData({
        email: '',
        password: '',
        username: '',
        full_name: '',
        phone_number: '',
        recovery_email: '',
        hint_question: '',
        hint_answer: '',
        monthly_salary: '',
        daily_da_allowance: '',
        manager_id: '',
        secondary_manager_id: '',
        security_profile_id: '',
        hq: '',
        date_of_joining: '',
        date_of_exit: '',
        alternate_email: '',
        address: '',
        education: '',
        emergency_contact_number: '',
        band: ''
      });
      setFiles([]);
      setRequirePasswordChange(false);
      setShowPassword(false);

    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pr-20"
                    required
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {formData.password && (
                      <button
                        type="button"
                        onClick={copyPasswordToClipboard}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="Copy password"
                      >
                        {copiedPassword ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateTemporaryPassword}
                  title="Generate temporary password"
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="requirePasswordChange"
                  checked={requirePasswordChange}
                  onCheckedChange={(checked) => setRequirePasswordChange(checked === true)}
                />
                <label
                  htmlFor="requirePasswordChange"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Require password change on first login
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_contact_number">Emergency Contact</Label>
              <Input
                id="emergency_contact_number"
                value={formData.emergency_contact_number}
                onChange={(e) => handleInputChange('emergency_contact_number', e.target.value)}
              />
            </div>
          </div>

          {/* Employment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_salary">Monthly Salary (₹)</Label>
              <Input
                id="monthly_salary"
                type="number"
                value={formData.monthly_salary}
                onChange={(e) => handleInputChange('monthly_salary', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily_da_allowance">Daily DA Allowance (₹)</Label>
              <Input
                id="daily_da_allowance"
                type="number"
                value={formData.daily_da_allowance}
                onChange={(e) => handleInputChange('daily_da_allowance', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="security_profile_id">Role *</Label>
              <Select value={formData.security_profile_id} onValueChange={(value) => handleInputChange('security_profile_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {securityProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_id">Primary Manager (Reports To)</Label>
              <Select value={formData.manager_id} onValueChange={(value) => handleInputChange('manager_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name} ({manager.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_manager_id">Secondary Manager</Label>
              <Select value={formData.secondary_manager_id} onValueChange={(value) => handleInputChange('secondary_manager_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name} ({manager.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="band">Band</Label>
              <Select value={formData.band} onValueChange={(value) => handleInputChange('band', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select band" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hq">Head Quarters (HQ)</Label>
              <Input
                id="hq"
                value={formData.hq}
                onChange={(e) => handleInputChange('hq', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_joining">Date of Joining</Label>
              <Input
                id="date_of_joining"
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => handleInputChange('date_of_joining', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_exit">Date of Exit</Label>
              <Input
                id="date_of_exit"
                type="date"
                value={formData.date_of_exit}
                onChange={(e) => handleInputChange('date_of_exit', e.target.value)}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="alternate_email">Alternate Email</Label>
              <Input
                id="alternate_email"
                type="email"
                value={formData.alternate_email}
                onChange={(e) => handleInputChange('alternate_email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery_email">Recovery Email</Label>
              <Input
                id="recovery_email"
                type="email"
                value={formData.recovery_email}
                onChange={(e) => handleInputChange('recovery_email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="education">Education Background</Label>
              <Textarea
                id="education"
                value={formData.education}
                onChange={(e) => handleInputChange('education', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Security Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hint_question">Security Hint Question</Label>
              <Input
                id="hint_question"
                value={formData.hint_question}
                onChange={(e) => handleInputChange('hint_question', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hint_answer">Security Hint Answer</Label>
              <Input
                id="hint_answer"
                value={formData.hint_answer}
                onChange={(e) => handleInputChange('hint_answer', e.target.value)}
              />
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Documents & Photo</h3>
            <p className="text-sm text-muted-foreground">
              Note: User will capture profile photo via camera on first login
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Address Proof */}
              <div className="space-y-2">
                <Label>Address Proof</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {files.find(f => f.type === 'address_proof') ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ File uploaded</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile('address_proof')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload Address Proof</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleFileUpload('address_proof')}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* ID Proof */}
              <div className="space-y-2">
                <Label>ID Proof</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {files.find(f => f.type === 'id_proof') ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ File uploaded</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile('id_proof')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload ID Proof</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleFileUpload('id_proof')}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating User...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateUserForm;