import { useState } from "react";
import { ChevronLeft, ChevronRight, Building2, Users, ShoppingCart, Truck, Store, BarChart3, AlertTriangle, Puzzle, Database, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImplementationData } from "@/pages/website/ImplementationToolkitPage";

interface RequirementWizardProps {
  data: ImplementationData;
  onUpdate: (data: ImplementationData) => void;
}

const steps = [
  { id: 1, title: "Company Profile", icon: Building2 },
  { id: 2, title: "Sales Operations", icon: Users },
  { id: 3, title: "Order Management", icon: ShoppingCart },
  { id: 4, title: "Distributor Network", icon: Truck },
  { id: 5, title: "Retailer Management", icon: Store },
  { id: 6, title: "Reporting & Analytics", icon: BarChart3 },
  { id: 7, title: "Pain Points", icon: AlertTriangle },
  { id: 8, title: "Feature Mapping", icon: Puzzle },
  { id: 9, title: "Data Migration", icon: Database },
  { id: 10, title: "Review", icon: CheckCircle },
];

const featureModules = [
  {
    category: "Sales Execution",
    features: [
      "Beat Planning & Management",
      "Visit Management",
      "Order Entry",
      "Attendance Management",
      "GPS Tracking",
      "Route Optimization",
      "No-Order Capture",
      "Joint Sales Visits",
    ],
  },
  {
    category: "AI Intelligence",
    features: [
      "Sales Coach AI",
      "Stock Image Analysis",
      "Credit Score AI",
      "Smart Recommendations",
      "Competition Insight AI",
      "Board Scanning (OCR)",
      "Voice Notes",
      "Chat Assistant",
    ],
  },
  {
    category: "Analytics & Reporting",
    features: [
      "Real-time Dashboard",
      "Performance Reports",
      "Beat Analytics",
      "Retailer Analytics",
      "Territory Dashboard",
      "Target vs Achievement",
      "Custom KPIs",
    ],
  },
  {
    category: "Retailer Management",
    features: [
      "Retailer Profiles",
      "Loyalty Programs",
      "Scheme Management",
      "Credit Management",
      "Payment Collection",
      "Retailer Feedback",
    ],
  },
  {
    category: "Gamification",
    features: [
      "Leaderboard",
      "Badges & Achievements",
      "Points System",
      "Team Competition",
      "Streak Tracking",
    ],
  },
  {
    category: "Van Sales",
    features: [
      "Morning Inventory",
      "Stock Management",
      "Route Sales",
      "Invoice Generation",
      "Cash Collection",
    ],
  },
  {
    category: "Distributor Portal",
    features: [
      "Primary Orders",
      "Inventory Management",
      "Claims Management",
      "Goods Receipt",
      "Secondary Sales",
      "Business Planning",
    ],
  },
  {
    category: "Institutional Sales",
    features: [
      "Lead Management",
      "Opportunity Tracking",
      "Quote Generation",
      "Account Management",
      "Collections",
    ],
  },
  {
    category: "Enterprise Features",
    features: [
      "Multi-Language Support",
      "Offline-First",
      "Role-Based Access",
      "Territory Management",
      "Approval Workflows",
      "Expense Management",
    ],
  },
];

const painPointAreas = [
  "Field Visibility",
  "Order Accuracy",
  "Scheme Compliance",
  "Retailer Coverage",
  "Data Timeliness",
  "Distributor Coordination",
  "Target Tracking",
  "Team Productivity",
  "Report Generation",
  "Credit Management",
];

const dataMigrationEntities = [
  "Products/SKUs",
  "Product Categories",
  "Retailers",
  "Retailer Classifications",
  "Distributors",
  "Territories",
  "Beats",
  "Sales Representatives",
  "Pricing/Schemes",
  "Opening Balances",
];

export function RequirementWizard({ data, onUpdate }: RequirementWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const updateCompanyProfile = (field: string, value: string) => {
    onUpdate({
      ...data,
      companyProfile: { ...data.companyProfile, [field]: value },
    });
  };

  const updateSalesOperations = (field: string, value: string | string[]) => {
    onUpdate({
      ...data,
      salesOperations: { ...data.salesOperations, [field]: value },
    });
  };

  const updateOrderManagement = (field: string, value: string) => {
    onUpdate({
      ...data,
      orderManagement: { ...data.orderManagement, [field]: value },
    });
  };

  const updateDistributorNetwork = (field: string, value: string) => {
    onUpdate({
      ...data,
      distributorNetwork: { ...data.distributorNetwork, [field]: value },
    });
  };

  const updateRetailerManagement = (field: string, value: string) => {
    onUpdate({
      ...data,
      retailerManagement: { ...data.retailerManagement, [field]: value },
    });
  };

  const updateReporting = (field: string, value: string | string[]) => {
    onUpdate({
      ...data,
      reporting: { ...data.reporting, [field]: value },
    });
  };

  const updatePainPoint = (area: string, field: string, value: string) => {
    const existingIndex = data.painPoints.findIndex((p) => p.area === area);
    let newPainPoints = [...data.painPoints];
    
    if (existingIndex >= 0) {
      newPainPoints[existingIndex] = { ...newPainPoints[existingIndex], [field]: value };
    } else {
      newPainPoints.push({ area, challenge: "", impact: "", priority: "medium", [field]: value });
    }
    
    onUpdate({ ...data, painPoints: newPainPoints });
  };

  const updateFeatureMapping = (feature: string, field: string, value: any) => {
    const existing = data.featureMapping[feature] || { required: false, priority: "medium", notes: "" };
    onUpdate({
      ...data,
      featureMapping: {
        ...data.featureMapping,
        [feature]: { ...existing, [field]: value },
      },
    });
  };

  const updateDataMigration = (entity: string, field: string, value: string) => {
    const existingIndex = data.dataMigration.findIndex((d) => d.entity === entity);
    let newDataMigration = [...data.dataMigration];
    
    if (existingIndex >= 0) {
      newDataMigration[existingIndex] = { ...newDataMigration[existingIndex], [field]: value };
    } else {
      newDataMigration.push({ entity, sourceSystem: "", recordCount: "", format: "", priority: "medium", [field]: value });
    }
    
    onUpdate({ ...data, dataMigration: newDataMigration });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80">Company Name *</Label>
                <Input
                  value={data.companyProfile.companyName}
                  onChange={(e) => updateCompanyProfile("companyName", e.target.value)}
                  placeholder="Enter company name"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Industry/Vertical</Label>
                <Input
                  value={data.companyProfile.industry}
                  onChange={(e) => updateCompanyProfile("industry", e.target.value)}
                  placeholder="e.g., Mobile Distribution"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Headquarters Location</Label>
                <Input
                  value={data.companyProfile.headquarters}
                  onChange={(e) => updateCompanyProfile("headquarters", e.target.value)}
                  placeholder="City, Country"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Number of States/Regions</Label>
                <Input
                  value={data.companyProfile.statesRegions}
                  onChange={(e) => updateCompanyProfile("statesRegions", e.target.value)}
                  placeholder="e.g., 15 states"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Annual Revenue (Range)</Label>
                <Select
                  value={data.companyProfile.annualRevenue}
                  onValueChange={(v) => updateCompanyProfile("annualRevenue", v)}
                >
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<10cr">Less than ₹10 Cr</SelectItem>
                    <SelectItem value="10-50cr">₹10 - 50 Cr</SelectItem>
                    <SelectItem value="50-100cr">₹50 - 100 Cr</SelectItem>
                    <SelectItem value="100-500cr">₹100 - 500 Cr</SelectItem>
                    <SelectItem value=">500cr">More than ₹500 Cr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">Number of Distributors</Label>
                <Input
                  value={data.companyProfile.distributorCount}
                  onChange={(e) => updateCompanyProfile("distributorCount", e.target.value)}
                  placeholder="e.g., 50"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Number of Sales Representatives</Label>
                <Input
                  value={data.companyProfile.salesRepCount}
                  onChange={(e) => updateCompanyProfile("salesRepCount", e.target.value)}
                  placeholder="e.g., 200"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Number of Retailers Served</Label>
                <Input
                  value={data.companyProfile.retailerCount}
                  onChange={(e) => updateCompanyProfile("retailerCount", e.target.value)}
                  placeholder="e.g., 10,000"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-white/80">Current Technology Stack</Label>
              <Textarea
                value={data.companyProfile.currentTechStack}
                onChange={(e) => updateCompanyProfile("currentTechStack", e.target.value)}
                placeholder="e.g., SAP, Excel, Custom ERP, Mobile app..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white/80">Key Decision Makers</Label>
              <Textarea
                value={data.companyProfile.decisionMakers}
                onChange={(e) => updateCompanyProfile("decisionMakers", e.target.value)}
                placeholder="Names and roles of key stakeholders..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-white/80 mb-3 block">Current Beat Planning Process</Label>
              <RadioGroup
                value={data.salesOperations.beatPlanningProcess}
                onValueChange={(v) => updateSalesOperations("beatPlanningProcess", v)}
                className="space-y-2"
              >
                {["Excel/Spreadsheet", "Paper-based", "Other SFA Tool", "No formal process"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={option} className="border-white/40" />
                    <Label htmlFor={option} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">How do FSRs track daily visits?</Label>
              <RadioGroup
                value={data.salesOperations.visitTracking}
                onValueChange={(v) => updateSalesOperations("visitTracking", v)}
                className="space-y-2"
              >
                {["Mobile App", "Paper forms", "Phone calls", "WhatsApp/SMS", "No tracking"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`visit-${option}`} className="border-white/40" />
                    <Label htmlFor={`visit-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80">Average visits per day per FSR</Label>
                <Input
                  value={data.salesOperations.averageVisitsPerDay}
                  onChange={(e) => updateSalesOperations("averageVisitsPerDay", e.target.value)}
                  placeholder="e.g., 25"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">Attendance Management</Label>
                <Select
                  value={data.salesOperations.attendanceManagement}
                  onValueChange={(v) => updateSalesOperations("attendanceManagement", v)}
                >
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biometric">Biometric</SelectItem>
                    <SelectItem value="manual">Manual Register</SelectItem>
                    <SelectItem value="app">Mobile App</SelectItem>
                    <SelectItem value="none">No formal system</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Is GPS tracking currently implemented?</Label>
              <RadioGroup
                value={data.salesOperations.gpsTracking}
                onValueChange={(v) => updateSalesOperations("gpsTracking", v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="gps-yes" className="border-white/40" />
                  <Label htmlFor="gps-yes" className="text-white/70">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="gps-no" className="border-white/40" />
                  <Label htmlFor="gps-no" className="text-white/70">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partial" id="gps-partial" className="border-white/40" />
                  <Label htmlFor="gps-partial" className="text-white/70">Partial</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Reports submitted by FSRs (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Daily Visit Report", "Order Summary", "Collection Report", "Stock Report", "Competition Report", "Expense Report"].map((report) => (
                  <div key={report} className="flex items-center space-x-2">
                    <Checkbox
                      id={report}
                      checked={data.salesOperations.reportsSubmitted.includes(report)}
                      onCheckedChange={(checked) => {
                        const current = data.salesOperations.reportsSubmitted;
                        if (checked) {
                          updateSalesOperations("reportsSubmitted", [...current, report]);
                        } else {
                          updateSalesOperations("reportsSubmitted", current.filter((r) => r !== report));
                        }
                      }}
                      className="border-white/40"
                    />
                    <Label htmlFor={report} className="text-white/70 text-sm">{report}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-white/80 mb-3 block">Current Order Capture Process</Label>
              <RadioGroup
                value={data.orderManagement.orderCaptureProcess}
                onValueChange={(v) => updateOrderManagement("orderCaptureProcess", v)}
                className="space-y-2"
              >
                {["Paper-based", "Mobile App", "Phone/WhatsApp", "Email", "ERP Direct Entry"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`order-${option}`} className="border-white/40" />
                    <Label htmlFor={`order-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80">Time to capture an order</Label>
                <Select
                  value={data.orderManagement.orderCaptureTime}
                  onValueChange={(v) => updateOrderManagement("orderCaptureTime", v)}
                >
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<2min">Less than 2 minutes</SelectItem>
                    <SelectItem value="2-5min">2-5 minutes</SelectItem>
                    <SelectItem value="5-10min">5-10 minutes</SelectItem>
                    <SelectItem value=">10min">More than 10 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">Order to Delivery Time</Label>
                <Select
                  value={data.orderManagement.orderToDeliveryTime}
                  onValueChange={(v) => updateOrderManagement("orderToDeliveryTime", v)}
                >
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same-day">Same Day</SelectItem>
                    <SelectItem value="next-day">Next Day</SelectItem>
                    <SelectItem value="2-3days">2-3 Days</SelectItem>
                    <SelectItem value=">3days">More than 3 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Different pricing tiers for retailers?</Label>
              <RadioGroup
                value={data.orderManagement.pricingTiers}
                onValueChange={(v) => updateOrderManagement("pricingTiers", v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="pricing-yes" className="border-white/40" />
                  <Label htmlFor="pricing-yes" className="text-white/70">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="pricing-no" className="border-white/40" />
                  <Label htmlFor="pricing-no" className="text-white/70">No</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80">Promotional Schemes Description</Label>
              <Textarea
                value={data.orderManagement.promotionalSchemes}
                onChange={(e) => updateOrderManagement("promotionalSchemes", e.target.value)}
                placeholder="Describe current promotional schemes (Buy X Get Y, Slab discounts, etc.)"
                className="bg-white/5 border-white/20 text-white"
              />
            </div>

            <div>
              <Label className="text-white/80">How are scheme calculations done today?</Label>
              <Textarea
                value={data.orderManagement.schemeCalculations}
                onChange={(e) => updateOrderManagement("schemeCalculations", e.target.value)}
                placeholder="Manual, Excel, System-calculated..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80">Number of Active Distributors</Label>
                <Input
                  value={data.distributorNetwork.activeDistributors}
                  onChange={(e) => updateDistributorNetwork("activeDistributors", e.target.value)}
                  placeholder="e.g., 50"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">How do distributors place primary orders?</Label>
              <RadioGroup
                value={data.distributorNetwork.primaryOrderProcess}
                onValueChange={(v) => updateDistributorNetwork("primaryOrderProcess", v)}
                className="space-y-2"
              >
                {["Phone/Call", "Email", "WhatsApp", "Portal/App", "Through Sales Rep"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`primary-${option}`} className="border-white/40" />
                    <Label htmlFor={`primary-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">How is distributor inventory tracked?</Label>
              <RadioGroup
                value={data.distributorNetwork.inventoryTracking}
                onValueChange={(v) => updateDistributorNetwork("inventoryTracking", v)}
                className="space-y-2"
              >
                {["Real-time system", "Periodic reports", "Manual stock-taking", "Not tracked"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`inv-${option}`} className="border-white/40" />
                    <Label htmlFor={`inv-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80">Claims Processing (damages, schemes)</Label>
              <Textarea
                value={data.distributorNetwork.claimsProcessing}
                onChange={(e) => updateDistributorNetwork("claimsProcessing", e.target.value)}
                placeholder="Describe current claims processing workflow..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Secondary sales visibility?</Label>
              <RadioGroup
                value={data.distributorNetwork.secondarySalesVisibility}
                onValueChange={(v) => updateDistributorNetwork("secondarySalesVisibility", v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="secondary-yes" className="border-white/40" />
                  <Label htmlFor="secondary-yes" className="text-white/70">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="secondary-no" className="border-white/40" />
                  <Label htmlFor="secondary-no" className="text-white/70">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partial" id="secondary-partial" className="border-white/40" />
                  <Label htmlFor="secondary-partial" className="text-white/70">Partial</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-white/80 mb-3 block">How is retailer master data maintained?</Label>
              <RadioGroup
                value={data.retailerManagement.masterDataMaintenance}
                onValueChange={(v) => updateRetailerManagement("masterDataMaintenance", v)}
                className="space-y-2"
              >
                {["Excel/Spreadsheet", "ERP System", "Custom Database", "Paper records", "Mobile App"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`master-${option}`} className="border-white/40" />
                    <Label htmlFor={`master-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Retailer classification system?</Label>
              <RadioGroup
                value={data.retailerManagement.classificationSystem}
                onValueChange={(v) => updateRetailerManagement("classificationSystem", v)}
                className="space-y-2"
              >
                {["A/B/C/D Classification", "Gold/Silver/Bronze", "Custom Classification", "No classification"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`class-${option}`} className="border-white/40" />
                    <Label htmlFor={`class-${option}`} className="text-white/70">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80">Credit Limit Management</Label>
              <Textarea
                value={data.retailerManagement.creditLimitManagement}
                onChange={(e) => updateRetailerManagement("creditLimitManagement", e.target.value)}
                placeholder="Describe how credit limits are set and managed..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">Existing retailer loyalty programs?</Label>
              <RadioGroup
                value={data.retailerManagement.loyaltyPrograms}
                onValueChange={(v) => updateRetailerManagement("loyaltyPrograms", v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="loyalty-yes" className="border-white/40" />
                  <Label htmlFor="loyalty-yes" className="text-white/70">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="loyalty-no" className="border-white/40" />
                  <Label htmlFor="loyalty-no" className="text-white/70">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="planned" id="loyalty-planned" className="border-white/40" />
                  <Label htmlFor="loyalty-planned" className="text-white/70">Planned</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-white/80">Retailer Feedback Capture</Label>
              <Textarea
                value={data.retailerManagement.feedbackCapture}
                onChange={(e) => updateRetailerManagement("feedbackCapture", e.target.value)}
                placeholder="How is retailer feedback currently captured and acted upon..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-white/80 mb-3 block">Reports Currently Generated (select all)</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Daily Sales Report",
                  "Weekly Summary",
                  "Monthly MIS",
                  "Beat Performance",
                  "Retailer Analysis",
                  "Territory Report",
                  "Collection Report",
                  "Stock Report",
                  "Scheme Performance",
                  "Competition Report",
                ].map((report) => (
                  <div key={report} className="flex items-center space-x-2">
                    <Checkbox
                      id={`report-${report}`}
                      checked={data.reporting.reportsGenerated.includes(report)}
                      onCheckedChange={(checked) => {
                        const current = data.reporting.reportsGenerated;
                        if (checked) {
                          updateReporting("reportsGenerated", [...current, report]);
                        } else {
                          updateReporting("reportsGenerated", current.filter((r) => r !== report));
                        }
                      }}
                      className="border-white/40"
                    />
                    <Label htmlFor={`report-${report}`} className="text-white/70 text-sm">{report}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-white/80">Report Generation Time</Label>
              <Select
                value={data.reporting.reportGenerationTime}
                onValueChange={(v) => updateReporting("reportGenerationTime", v)}
              >
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="<1hour">Less than 1 hour</SelectItem>
                  <SelectItem value="1-4hours">1-4 hours</SelectItem>
                  <SelectItem value="1day">1 day</SelectItem>
                  <SelectItem value=">1day">More than 1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white/80">Primary Report Consumers</Label>
              <Textarea
                value={data.reporting.primaryConsumers}
                onChange={(e) => updateReporting("primaryConsumers", e.target.value)}
                placeholder="e.g., Sales Managers, Regional Heads, CXO..."
                className="bg-white/5 border-white/20 text-white"
              />
            </div>

            <div>
              <Label className="text-white/80 mb-3 block">KPIs Currently Tracked (select all)</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Daily Sales Value",
                  "Beat Coverage",
                  "Productive Calls",
                  "Lines per Bill",
                  "Collection Rate",
                  "New Outlet Addition",
                  "Scheme Utilization",
                  "DSO (Days Sales Outstanding)",
                ].map((kpi) => (
                  <div key={kpi} className="flex items-center space-x-2">
                    <Checkbox
                      id={`kpi-${kpi}`}
                      checked={data.reporting.kpisTracked.includes(kpi)}
                      onCheckedChange={(checked) => {
                        const current = data.reporting.kpisTracked;
                        if (checked) {
                          updateReporting("kpisTracked", [...current, kpi]);
                        } else {
                          updateReporting("kpisTracked", current.filter((k) => k !== kpi));
                        }
                      }}
                      className="border-white/40"
                    />
                    <Label htmlFor={`kpi-${kpi}`} className="text-white/70 text-sm">{kpi}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <p className="text-white/70 text-sm mb-4">
              Identify current challenges and their business impact. This helps prioritize implementation areas.
            </p>
            {painPointAreas.map((area) => {
              const painPoint = data.painPoints.find((p) => p.area === area) || { area, challenge: "", impact: "", priority: "medium" };
              return (
                <Card key={area} className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm">{area}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-white/60 text-xs">Current Challenge</Label>
                      <Input
                        value={painPoint.challenge}
                        onChange={(e) => updatePainPoint(area, "challenge", e.target.value)}
                        placeholder="Describe the challenge..."
                        className="bg-white/5 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label className="text-white/60 text-xs">Impact</Label>
                        <Input
                          value={painPoint.impact}
                          onChange={(e) => updatePainPoint(area, "impact", e.target.value)}
                          placeholder="Business impact..."
                          className="bg-white/5 border-white/20 text-white text-sm"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-white/60 text-xs">Priority</Label>
                        <Select
                          value={painPoint.priority}
                          onValueChange={(v) => updatePainPoint(area, "priority", v)}
                        >
                          <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <p className="text-white/70 text-sm mb-4">
              Select which Quickapp features are required for this implementation and set priorities.
            </p>
            {featureModules.map((module) => (
              <Card key={module.category} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-400 text-lg">{module.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {module.features.map((feature) => {
                      const mapping = data.featureMapping[feature] || { required: false, priority: "medium", notes: "" };
                      return (
                        <div key={feature} className="flex items-center gap-4 p-2 rounded-lg hover:bg-white/5">
                          <Checkbox
                            checked={mapping.required}
                            onCheckedChange={(checked) => updateFeatureMapping(feature, "required", checked)}
                            className="border-white/40"
                          />
                          <span className="text-white flex-1 text-sm">{feature}</span>
                          {mapping.required && (
                            <>
                              <Select
                                value={mapping.priority}
                                onValueChange={(v) => updateFeatureMapping(feature, "priority", v)}
                              >
                                <SelectTrigger className="w-28 bg-white/5 border-white/20 text-white text-xs h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="critical">Critical</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                value={mapping.notes}
                                onChange={(e) => updateFeatureMapping(feature, "notes", e.target.value)}
                                placeholder="Notes..."
                                className="w-40 bg-white/5 border-white/20 text-white text-xs h-8"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <p className="text-white/70 text-sm mb-4">
              Identify data entities that need to be migrated and their current state.
            </p>
            {dataMigrationEntities.map((entity) => {
              const migration = data.dataMigration.find((d) => d.entity === entity) || { entity, sourceSystem: "", recordCount: "", format: "", priority: "medium" };
              return (
                <Card key={entity} className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="font-medium text-white min-w-[160px]">{entity}</div>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Input
                          value={migration.sourceSystem}
                          onChange={(e) => updateDataMigration(entity, "sourceSystem", e.target.value)}
                          placeholder="Source System"
                          className="bg-white/5 border-white/20 text-white text-sm"
                        />
                        <Input
                          value={migration.recordCount}
                          onChange={(e) => updateDataMigration(entity, "recordCount", e.target.value)}
                          placeholder="Record Count"
                          className="bg-white/5 border-white/20 text-white text-sm"
                        />
                        <Select
                          value={migration.format}
                          onValueChange={(v) => updateDataMigration(entity, "format", v)}
                        >
                          <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="database">Database</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={migration.priority}
                          onValueChange={(v) => updateDataMigration(entity, "priority", v)}
                        >
                          <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      case 10:
        const selectedFeatures = Object.entries(data.featureMapping).filter(([_, v]) => v.required);
        const highPriorityPains = data.painPoints.filter((p) => p.priority === "high");
        
        return (
          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-amber-400">Company Profile Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-white/60">Company:</span> <span className="text-white">{data.companyProfile.companyName || "Not specified"}</span></div>
                <div><span className="text-white/60">Industry:</span> <span className="text-white">{data.companyProfile.industry || "Not specified"}</span></div>
                <div><span className="text-white/60">Distributors:</span> <span className="text-white">{data.companyProfile.distributorCount || "Not specified"}</span></div>
                <div><span className="text-white/60">Sales Reps:</span> <span className="text-white">{data.companyProfile.salesRepCount || "Not specified"}</span></div>
                <div><span className="text-white/60">Retailers:</span> <span className="text-white">{data.companyProfile.retailerCount || "Not specified"}</span></div>
                <div><span className="text-white/60">Revenue:</span> <span className="text-white">{data.companyProfile.annualRevenue || "Not specified"}</span></div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-amber-400">High Priority Pain Points ({highPriorityPains.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {highPriorityPains.length > 0 ? (
                  <ul className="space-y-2">
                    {highPriorityPains.map((p) => (
                      <li key={p.area} className="text-white text-sm">
                        <span className="font-medium">{p.area}:</span> {p.challenge}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/60 text-sm">No high priority pain points identified</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-amber-400">Selected Features ({selectedFeatures.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedFeatures.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedFeatures.map(([feature, mapping]) => (
                      <span
                        key={feature}
                        className={`px-2 py-1 rounded-full text-xs ${
                          mapping.priority === "critical"
                            ? "bg-red-500/20 text-red-400"
                            : mapping.priority === "high"
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 text-sm">No features selected</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-amber-400">Data Migration Entities</CardTitle>
              </CardHeader>
              <CardContent>
                {data.dataMigration.filter((d) => d.sourceSystem || d.recordCount).length > 0 ? (
                  <div className="space-y-2">
                    {data.dataMigration
                      .filter((d) => d.sourceSystem || d.recordCount)
                      .map((d) => (
                        <div key={d.entity} className="text-white text-sm flex justify-between">
                          <span>{d.entity}</span>
                          <span className="text-white/60">{d.recordCount} records from {d.sourceSystem}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-white/60 text-sm">No data migration entities configured</p>
                )}
              </CardContent>
            </Card>

            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-sm">
                ✓ Requirements gathered. Proceed to the Project Plan tab to set your implementation timeline.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex overflow-x-auto pb-2 gap-2">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
              currentStep === step.id
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                : step.id < currentStep
                ? "bg-green-500/20 text-green-400"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            <step.icon className="w-4 h-4" />
            <span className="hidden md:inline">{step.title}</span>
            <span className="md:hidden">{step.id}</span>
          </button>
        ))}
      </div>

      {/* Current Step Content */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            {steps[currentStep - 1] && (
              <>
                {(() => {
                  const StepIcon = steps[currentStep - 1].icon;
                  return <StepIcon className="w-5 h-5 text-amber-400" />;
                })()}
                {steps[currentStep - 1].title}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="bg-white/5 border-white/20 text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button
          onClick={() => setCurrentStep((s) => Math.min(steps.length, s + 1))}
          disabled={currentStep === steps.length}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
