import React, { useState, useEffect } from 'react';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import WizardStepper from './WizardStepper';
import StepBasics from './StepBasics';
import StepEmployment from './StepEmployment';
import StepAdditional from './StepAdditional';
import StepDocuments from './StepDocuments';
import { saveUserDistributors } from '@/components/admin/UserDistributorsPicker';
import { 
  CreateUserFormData, 
  FileUpload, 
  Manager, 
  SecurityProfile, 
  WizardStep, 
  WIZARD_STEPS,
  initialFormData 
} from './types';

interface CreateUserWizardProps {
  onSuccess?: () => void;
}

const CreateUserWizard: React.FC<CreateUserWizardProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [securityProfiles, setSecurityProfiles] = useState<SecurityProfile[]>([]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [formData, setFormData] = useState<CreateUserFormData>(initialFormData);

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

  const handleUpdateField = (field: keyof CreateUserFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (type: 'address_proof' | 'id_proof') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFiles(prev => prev.filter(f => f.type !== type));

    const newFile: FileUpload = { file, type };

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
    
    const bucket = type === 'photo' ? 'employee-photos' : 'employee-docs';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) {
      console.error('File upload error:', error);
      return null;
    }

    return data.path;
  };

  const validateStep = (step: WizardStep): boolean => {
    switch (step) {
      case 'basics':
        if (!formData.email || !formData.password || !formData.username || !formData.full_name || !formData.phone_number) {
          toast({
            title: "Validation Error",
            description: "Please fill in all required fields (Email, Password, Username, Full Name, Phone Number)",
            variant: "destructive"
          });
          return false;
        }
        return true;
      case 'employment':
        if (!formData.manager_id) {
          toast({
            title: "Validation Error",
            description: "Primary Manager is required",
            variant: "destructive"
          });
          return false;
        }
        return true;
      case 'additional':
        return true;
      case 'documents':
        return true;
      default:
        return true;
    }
  };

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return;
    
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          username: formData.username,
          full_name: formData.full_name,
          phone_number: formData.phone_number || undefined,
          recovery_email: formData.recovery_email || undefined,
          hint_question: formData.hint_question || undefined,
          hint_answer: formData.hint_answer || undefined,
          monthly_salary: formData.monthly_salary || undefined,
          daily_da_allowance: formData.daily_da_allowance || undefined,
          manager_id: formData.manager_id || undefined,
          secondary_manager_id: formData.secondary_manager_id || undefined,
          security_profile_id: formData.security_profile_id || undefined,
          hq: formData.hq || undefined,
          date_of_joining: formData.date_of_joining || undefined,
          date_of_exit: formData.date_of_exit || undefined,
          alternate_email: formData.alternate_email || undefined,
          address: formData.address || undefined,
          education: formData.education || undefined,
          emergency_contact_number: formData.emergency_contact_number || undefined,
          band: formData.band || undefined,
          is_temporary_password: formData.requirePasswordChange
        }
      });

      // Handle edge function errors with better error extraction
      if (error) {
        // Try to extract the actual error message from the response
        let errorMessage = 'Failed to create user';
        let errorDetails = '';
        
        // FunctionsError may have context with the response body
        if (error.context) {
          try {
            const responseBody = await error.context.json?.() || error.context;
            if (responseBody?.error) {
              errorMessage = responseBody.error;
              errorDetails = responseBody.details || '';
            }
          } catch {
            // If we can't parse the context, use the error message
            errorMessage = error.message || errorMessage;
          }
        } else {
          errorMessage = error.message || errorMessage;
        }
        
        throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
      }

      if (data?.error) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : data.error);
      }

      if (!data?.user?.id) {
        throw new Error('User creation succeeded but no user ID returned');
      }

      const userId = data.user.id;

      // Distributor assignments can only be written once the user row exists.
      // A failure here must not read as "user not created" -- they were.
      if (formData.distributor_ids.length > 0) {
        try {
          await saveUserDistributors(userId, {
            ids: formData.distributor_ids,
            primaryId: formData.primary_distributor_id,
          });
        } catch (e: any) {
          toast({
            title: "User created, distributors not saved",
            description: e.message || "Assign them from the user's profile.",
            variant: "destructive",
          });
        }
      }

      // Upload document files
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

      // Notify parent to refresh user list
      onSuccess?.();

      // Reset form
      setFormData(initialFormData);
      setFiles([]);
      setCurrentStep('basics');
      setCompletedSteps([]);

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

  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basics':
        return <StepBasics formData={formData} onUpdate={handleUpdateField} />;
      case 'employment':
        return (
          <StepEmployment 
            formData={formData} 
            onUpdate={handleUpdateField} 
            managers={managers}
            securityProfiles={securityProfiles}
          />
        );
      case 'additional':
        return <StepAdditional formData={formData} onUpdate={handleUpdateField} />;
      case 'documents':
        return (
          <StepDocuments 
            files={files} 
            onFileUpload={handleFileUpload} 
            onRemoveFile={removeFile} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Add a user
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex min-h-[500px]">
          {/* Left Sidebar - Steps */}
          <div className="p-6 bg-muted/30">
            <WizardStepper currentStep={currentStep} completedSteps={completedSteps} />
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex-1">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousStep}
                disabled={isFirstStep || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              {isLastStep ? (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create User
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={goToNextStep} disabled={loading}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreateUserWizard;
