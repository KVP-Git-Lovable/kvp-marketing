import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, UserCircle, MapPin, GraduationCap, Target, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OnboardingData {
  profile_picture_url?: string;
  date_of_birth?: string;
  anniversary_date?: string;
  current_address?: string;
  permanent_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  interests?: string[];
  aspirations?: string;
  learning_goals?: string[];
  work_location?: string;
  territories_covered?: string[];
  education_background?: any;
  aadhar_document_url?: string;
  pan_document_url?: string;
  expertise_areas?: string[];
}

const STEPS = [
  { id: 1, title: "Personal Info", icon: UserCircle },
  { id: 2, title: "Contact & Address", icon: MapPin },
  { id: 3, title: "Education", icon: GraduationCap },
  { id: 4, title: "Goals & Interests", icon: Target },
  { id: 5, title: "Documents", icon: FileText },
];

export default function EmployeeOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({});
  const [interestInput, setInterestInput] = useState("");
  const [learningGoalInput, setLearningGoalInput] = useState("");
  const [territoryInput, setTerritoryInput] = useState("");
  const [expertiseInput, setExpertiseInput] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadExistingData();
  }, [user, navigate]);

  const loadExistingData = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: employeeData } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setFormData({
        profile_picture_url: profileData.profile_picture_url,
        date_of_birth: profileData.date_of_birth,
        anniversary_date: profileData.anniversary_date,
        current_address: profileData.current_address,
        permanent_address: profileData.permanent_address,
        emergency_contact_name: profileData.emergency_contact_name,
        emergency_contact_phone: profileData.emergency_contact_phone,
        linkedin_url: profileData.linkedin_url,
        facebook_url: profileData.facebook_url,
        instagram_url: profileData.instagram_url,
        interests: profileData.interests || [],
        aspirations: profileData.aspirations,
        learning_goals: profileData.learning_goals || [],
        work_location: profileData.work_location,
        territories_covered: profileData.territories_covered || [],
      });
    }

    if (employeeData) {
      setFormData(prev => ({
        ...prev,
        education_background: employeeData.education_background,
        aadhar_document_url: employeeData.aadhar_document_url,
        pan_document_url: employeeData.pan_document_url,
        expertise_areas: Array.isArray(employeeData.expertise_areas) ? employeeData.expertise_areas : [],
      }));
    }
  };

  const handleFileUpload = async (file: File, type: string) => {
    if (!user) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-docs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("employee-docs")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
      return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await handleFileUpload(file, field);
    if (url) {
      setFormData({ ...formData, [field]: url });
    }
  };

  const addArrayItem = (field: keyof OnboardingData, value: string) => {
    if (!value.trim()) return;
    const current = (formData[field] as string[]) || [];
    setFormData({ ...formData, [field]: [...current, value.trim()] });
  };

  const removeArrayItem = (field: keyof OnboardingData, index: number) => {
    const current = (formData[field] as string[]) || [];
    setFormData({ ...formData, [field]: current.filter((_, i) => i !== index) });
  };

  const saveProgress = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          profile_picture_url: formData.profile_picture_url,
          date_of_birth: formData.date_of_birth,
          anniversary_date: formData.anniversary_date,
          current_address: formData.current_address,
          permanent_address: formData.permanent_address,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          linkedin_url: formData.linkedin_url,
          facebook_url: formData.facebook_url,
          instagram_url: formData.instagram_url,
          interests: formData.interests,
          aspirations: formData.aspirations,
          learning_goals: formData.learning_goals,
          work_location: formData.work_location,
          territories_covered: formData.territories_covered,
          onboarding_step: currentStep,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      const { error: employeeError } = await supabase
        .from("employees")
        .update({
          education_background: formData.education_background,
          aadhar_document_url: formData.aadhar_document_url,
          pan_document_url: formData.pan_document_url,
          expertise_areas: formData.expertise_areas,
        })
        .eq("user_id", user.id);

      if (employeeError) throw employeeError;

      toast.success("Progress saved!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save progress");
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await saveProgress();
      
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true, onboarding_step: 5 })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Onboarding completed! Welcome aboard!");
      navigate("/employee-profile");
    } catch (error) {
      console.error("Complete error:", error);
      toast.error("Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-32 h-32 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {formData.profile_picture_url ? (
                  <img src={formData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="profile-pic" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  <Upload className="w-4 h-4" />
                  Upload Photo
                </div>
                <Input
                  id="profile-pic"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "profile_picture_url")}
                />
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.date_of_birth || ""}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="anniversary">Anniversary Date</Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={formData.anniversary_date || ""}
                  onChange={(e) => setFormData({ ...formData, anniversary_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/..."
                  value={formData.linkedin_url || ""}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  placeholder="https://facebook.com/..."
                  value={formData.facebook_url || ""}
                  onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="https://instagram.com/..."
                  value={formData.instagram_url || ""}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-address">Current Address</Label>
              <Textarea
                id="current-address"
                rows={3}
                value={formData.current_address || ""}
                onChange={(e) => setFormData({ ...formData, current_address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="permanent-address">Permanent Address</Label>
              <Textarea
                id="permanent-address"
                rows={3}
                value={formData.permanent_address || ""}
                onChange={(e) => setFormData({ ...formData, permanent_address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergency-name">Emergency Contact Name</Label>
                <Input
                  id="emergency-name"
                  value={formData.emergency_contact_name || ""}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="emergency-phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency-phone"
                  type="tel"
                  value={formData.emergency_contact_phone || ""}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="work-location">Work Location</Label>
              <Input
                id="work-location"
                value={formData.work_location || ""}
                onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="territory">Territories Covered</Label>
              <div className="flex gap-2">
                <Input
                  id="territory"
                  placeholder="Add territory..."
                  value={territoryInput}
                  onChange={(e) => setTerritoryInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("territories_covered", territoryInput);
                      setTerritoryInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addArrayItem("territories_covered", territoryInput);
                    setTerritoryInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.territories_covered?.map((territory, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem("territories_covered", idx)}>
                    {territory} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label>Education Background</Label>
              <p className="text-sm text-muted-foreground mb-2">Add your educational qualifications</p>
              {/* Education form would go here - simplified for now */}
            </div>
            <div>
              <Label htmlFor="expertise">Areas of Expertise</Label>
              <div className="flex gap-2">
                <Input
                  id="expertise"
                  placeholder="Add expertise area..."
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("expertise_areas", expertiseInput);
                      setExpertiseInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addArrayItem("expertise_areas", expertiseInput);
                    setExpertiseInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.expertise_areas?.map((area, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem("expertise_areas", idx)}>
                    {area} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aspirations">Career Aspirations</Label>
              <Textarea
                id="aspirations"
                rows={4}
                placeholder="Tell us about your career goals and aspirations..."
                value={formData.aspirations || ""}
                onChange={(e) => setFormData({ ...formData, aspirations: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="interests">Interests & Hobbies</Label>
              <div className="flex gap-2">
                <Input
                  id="interests"
                  placeholder="Add interest..."
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("interests", interestInput);
                      setInterestInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addArrayItem("interests", interestInput);
                    setInterestInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.interests?.map((interest, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem("interests", idx)}>
                    {interest} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="learning-goals">Learning & Training Goals</Label>
              <div className="flex gap-2">
                <Input
                  id="learning-goals"
                  placeholder="Add learning goal..."
                  value={learningGoalInput}
                  onChange={(e) => setLearningGoalInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("learning_goals", learningGoalInput);
                      setLearningGoalInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addArrayItem("learning_goals", learningGoalInput);
                    setLearningGoalInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.learning_goals?.map((goal, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem("learning_goals", idx)}>
                    {goal} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="aadhar">Aadhar Card</Label>
              <Input
                id="aadhar"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleFileUpload(file, "aadhar");
                    if (url) setFormData({ ...formData, aadhar_document_url: url });
                  }
                }}
              />
              {formData.aadhar_document_url && (
                <p className="text-sm text-green-600 mt-1">✓ Aadhar uploaded</p>
              )}
            </div>
            <div>
              <Label htmlFor="pan">PAN Card</Label>
              <Input
                id="pan"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleFileUpload(file, "pan");
                    if (url) setFormData({ ...formData, pan_document_url: url });
                  }
                }}
              />
              {formData.pan_document_url && (
                <p className="text-sm text-green-600 mt-1">✓ PAN uploaded</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Welcome to the Team! 🎉</CardTitle>
            <CardDescription>Let's complete your profile to get you started</CardDescription>
            <Progress value={progress} className="mt-4" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between mb-8">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center gap-2 ${
                      currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        currentStep >= step.id ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs text-center hidden md:block">{step.title}</span>
                  </div>
                );
              })}
            </div>

            {renderStep()}

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || loading}
              >
                Previous
              </Button>
              <Button onClick={saveProgress} variant="secondary" disabled={loading}>
                Save Progress
              </Button>
              {currentStep < STEPS.length ? (
                <Button
                  onClick={() => {
                    saveProgress();
                    setCurrentStep(Math.min(STEPS.length, currentStep + 1));
                  }}
                  disabled={loading}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={completeOnboarding} disabled={loading}>
                  Complete Onboarding
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}