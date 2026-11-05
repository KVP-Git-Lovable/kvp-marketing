import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Target, Heart, Users, Rocket, Gift, Save, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Aspirations questions (5 questions)
const ASPIRATION_QUESTIONS = [
  {
    key: "career_goal",
    question: "What's your ultimate career goal?",
    icon: Target,
    options: [
      "Become a Sales Leader",
      "Start my own business",
      "Become a Regional Manager",
      "Move to Corporate/HQ role",
      "Become a subject matter expert",
    ],
  },
  {
    key: "dream_role",
    question: "Your dream role in 5 years?",
    icon: Rocket,
    options: [
      "Area Sales Manager",
      "Zonal Head",
      "National Sales Head",
      "Business Development Director",
      "Entrepreneur",
    ],
  },
  {
    key: "preferred_work_style",
    question: "How do you prefer to work?",
    icon: Users,
    options: [
      "Independent - I thrive solo",
      "Team player - Love collaboration",
      "Mix of both",
      "Lead a team",
      "Support & mentor others",
    ],
  },
  {
    key: "motivation_driver",
    question: "What motivates you the most?",
    icon: Heart,
    options: [
      "Money & incentives",
      "Recognition & awards",
      "Learning & growth",
      "Helping others succeed",
      "Competing & winning",
    ],
  },
  {
    key: "five_year_vision",
    question: "Where do you see yourself in 5 years?",
    icon: Sparkles,
    options: [
      "Leading a team of 10+",
      "Running my own territory",
      "In a corporate strategy role",
      "Training & developing others",
      "Building my own venture",
    ],
  },
];

// Likes/Dislikes questions (3 questions)
const PREFERENCE_QUESTIONS = [
  {
    key: "favorite_activity",
    question: "What's your favorite part of sales?",
    icon: Heart,
    options: [
      "Meeting new people",
      "Closing deals",
      "Building relationships",
      "Hitting targets",
      "Learning about products",
    ],
  },
  {
    key: "preferred_reward",
    question: "How do you like to be rewarded?",
    icon: Gift,
    options: [
      "Cash bonuses",
      "Travel incentives",
      "Public recognition",
      "Promotion opportunities",
      "Learning & certifications",
    ],
  },
  {
    key: "team_preference",
    question: "Your ideal team environment?",
    icon: Users,
    options: [
      "Competitive - Push each other",
      "Supportive - Help each other",
      "Fun & energetic",
      "Focused & professional",
      "Flexible & independent",
    ],
  },
];

interface AspirationsData {
  career_goal: string;
  dream_role: string;
  preferred_work_style: string;
  motivation_driver: string;
  five_year_vision: string;
  favorite_activity: string;
  preferred_reward: string;
  team_preference: string;
}

export function AspirationsSection() {
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [data, setData] = useState<AspirationsData>({
    career_goal: "",
    dream_role: "",
    preferred_work_style: "",
    motivation_driver: "",
    five_year_vision: "",
    favorite_activity: "",
    preferred_reward: "",
    team_preference: "",
  });
  const [originalData, setOriginalData] = useState<AspirationsData>(data);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: result } = await supabase
      .from("aspirations_and_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (result) {
      const fetchedData = {
        career_goal: result.career_goal || "",
        dream_role: result.dream_role || "",
        preferred_work_style: result.preferred_work_style || "",
        motivation_driver: result.motivation_driver || "",
        five_year_vision: result.five_year_vision || "",
        favorite_activity: result.favorite_activity || "",
        preferred_reward: result.preferred_reward || "",
        team_preference: result.team_preference || "",
      };
      setData(fetchedData);
      setOriginalData(fetchedData);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("aspirations_and_preferences")
      .upsert({
        user_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Aspirations saved!");
      setOriginalData(data);
      setIsEditMode(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setData(originalData);
    setIsEditMode(false);
  };

  const handleChange = (key: keyof AspirationsData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const completedCount = Object.values(data).filter(Boolean).length;
  const totalQuestions = ASPIRATION_QUESTIONS.length + PREFERENCE_QUESTIONS.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // View Mode
  if (!isEditMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Aspirations & Preferences
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={completedCount === totalQuestions ? "default" : "secondary"}>
                {completedCount}/{totalQuestions} answered
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {completedCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No aspirations added yet. Click "Edit" to share your career goals.
            </p>
          ) : (
            <>
              {/* Aspirations */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Your Career Aspirations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ASPIRATION_QUESTIONS.map((q) => {
                    const value = data[q.key as keyof AspirationsData];
                    if (!value) return null;
                    return (
                      <div key={q.key} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                          <q.icon className="h-4 w-4 text-primary" />
                          <span className="text-xs text-muted-foreground">{q.question}</span>
                        </div>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Likes & Preferences
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PREFERENCE_QUESTIONS.map((q) => {
                    const value = data[q.key as keyof AspirationsData];
                    if (!value) return null;
                    return (
                      <div key={q.key} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                          <q.icon className="h-4 w-4 text-primary" />
                          <span className="text-xs text-muted-foreground">{q.question}</span>
                        </div>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit Mode
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Edit Aspirations & Preferences
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalQuestions} answered
            </span>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Aspirations */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Your Career Aspirations
          </h4>
          <div className="space-y-4">
            {ASPIRATION_QUESTIONS.map((q) => (
              <div key={q.key} className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <q.icon className="h-4 w-4 text-primary" />
                  {q.question}
                </Label>
                <Select
                  value={data[q.key as keyof AspirationsData]}
                  onValueChange={(value) => handleChange(q.key as keyof AspirationsData, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Likes & Preferences
          </h4>
          <div className="space-y-4">
            {PREFERENCE_QUESTIONS.map((q) => (
              <div key={q.key} className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <q.icon className="h-4 w-4 text-primary" />
                  {q.question}
                </Label>
                <Select
                  value={data[q.key as keyof AspirationsData]}
                  onValueChange={(value) => handleChange(q.key as keyof AspirationsData, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
