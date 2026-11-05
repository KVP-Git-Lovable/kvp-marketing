import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";

interface AboutEditModeProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
  managers: { id: string; full_name: string }[];
  territories: { id: string; name: string }[];
  loading: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function AboutEditMode({
  formData,
  setFormData,
  managers,
  territories,
  loading,
  onSave,
  onCancel,
}: AboutEditModeProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Edit Profile</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-medium mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (Read Only)</Label>
              <Input id="email" value={formData.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery_email">Recovery Email</Label>
              <Input
                id="recovery_email"
                type="email"
                value={formData.recovery_email}
                onChange={(e) => setFormData(prev => ({ ...prev, recovery_email: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Designation & Social Links */}
        <div>
          <h3 className="text-lg font-medium mb-4">Designation & Social Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                placeholder="e.g. Sales Executive, Area Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url" className="flex items-center gap-1">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </Label>
              <Input
                id="linkedin_url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter_url" className="flex items-center gap-1">
                <Twitter className="h-4 w-4" /> Twitter
              </Label>
              <Input
                id="twitter_url"
                value={formData.twitter_url}
                onChange={(e) => setFormData(prev => ({ ...prev, twitter_url: e.target.value }))}
                placeholder="https://twitter.com/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram_url" className="flex items-center gap-1">
                <Instagram className="h-4 w-4" /> Instagram
              </Label>
              <Input
                id="instagram_url"
                value={formData.instagram_url}
                onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
                placeholder="https://instagram.com/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook_url" className="flex items-center gap-1">
                <Facebook className="h-4 w-4" /> Facebook
              </Label>
              <Input
                id="facebook_url"
                value={formData.facebook_url}
                onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                placeholder="https://facebook.com/username"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h3 className="text-lg font-medium mb-4">Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language Preference</Label>
              <LanguageSelector />
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div>
          <h3 className="text-lg font-medium mb-4">Employment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_salary">Monthly Salary (₹)</Label>
              <Input
                id="monthly_salary"
                type="number"
                value={formData.monthly_salary}
                onChange={(e) => setFormData(prev => ({ ...prev, monthly_salary: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily_da_allowance">Daily DA Allowance (₹)</Label>
              <Input
                id="daily_da_allowance"
                type="number"
                value={formData.daily_da_allowance}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_da_allowance: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager_id">Manager (Reports To)</Label>
              <Select 
                value={formData.manager_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, manager_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hq_territory_id">Headquarters (HQ)</Label>
              <Select 
                value={formData.hq_territory_id} 
                onValueChange={(value) => {
                  const territory = territories.find(t => t.id === value);
                  setFormData(prev => ({ 
                    ...prev, 
                    hq_territory_id: value,
                    hq: territory?.name || ''
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select HQ territory" />
                </SelectTrigger>
                <SelectContent>
                  {territories.map((territory) => (
                    <SelectItem key={territory.id} value={territory.id}>
                      {territory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_joining">Date of Joining</Label>
              <Input
                id="date_of_joining"
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_joining: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_exit">Date of Exit</Label>
              <Input
                id="date_of_exit"
                type="date"
                value={formData.date_of_exit}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_exit: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="band">Band</Label>
              <Select 
                value={formData.band} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, band: value }))}
              >
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
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-lg font-medium mb-4">Address</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Current Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onSave} disabled={loading} className="flex-1">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
