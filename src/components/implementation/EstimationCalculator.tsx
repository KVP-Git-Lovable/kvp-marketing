import { useState, useEffect } from "react";
import { Calculator, Users, Store, Truck, Puzzle, Database, MapPin, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImplementationData } from "@/pages/website/ImplementationToolkitPage";

interface EstimationCalculatorProps {
  data: ImplementationData;
  onUpdate: (data: ImplementationData) => void;
}

const moduleEfforts: Record<string, number> = {
  "Sales Execution": 15,
  "AI Intelligence": 10,
  "Analytics & Reporting": 8,
  "Retailer Management": 10,
  "Gamification": 5,
  "Van Sales": 12,
  "Distributor Portal": 15,
  "Institutional Sales": 12,
  "Enterprise Features": 8,
};

const integrationComplexityFactors = {
  low: 1,
  medium: 1.5,
  high: 2,
};

const dataMigrationFactors = {
  small: 5,
  medium: 10,
  large: 20,
};

export function EstimationCalculator({ data, onUpdate }: EstimationCalculatorProps) {
  const [teamSize, setTeamSize] = useState(data.estimation.teamSize || 100);
  const [distributorCount, setDistributorCount] = useState(data.estimation.distributorCount || 20);
  const [retailerCount, setRetailerCount] = useState(data.estimation.retailerCount || 5000);
  const [selectedModules, setSelectedModules] = useState<string[]>(data.estimation.modulesSelected || []);
  const [integrationComplexity, setIntegrationComplexity] = useState<'low' | 'medium' | 'high'>(data.estimation.integrationComplexity || 'medium');
  const [dataMigrationVolume, setDataMigrationVolume] = useState<'small' | 'medium' | 'large'>(data.estimation.dataMigrationVolume || 'medium');
  const [trainingLocations, setTrainingLocations] = useState(data.estimation.trainingLocations || 4);

  const calculateEstimation = () => {
    // Base effort (person-days)
    let baseEffort = 20; // Project setup and management

    // Module effort
    const moduleEffort = selectedModules.reduce((sum, module) => sum + (moduleEfforts[module] || 0), 0);

    // Scale factor based on team size
    const scaleFactor = Math.max(1, Math.log10(teamSize / 50));

    // Integration effort
    const integrationEffort = 15 * integrationComplexityFactors[integrationComplexity];

    // Data migration effort
    const migrationEffort = dataMigrationFactors[dataMigrationVolume];

    // Training effort (per location)
    const trainingEffort = trainingLocations * 3;

    // Testing effort (20% of implementation)
    const testingEffort = (moduleEffort + integrationEffort) * 0.2;

    // Total effort
    const totalEffort = Math.round(
      (baseEffort + moduleEffort + integrationEffort + migrationEffort + trainingEffort + testingEffort) * scaleFactor
    );

    // Timeline in weeks (assuming 2 resources)
    const timeline = Math.ceil(totalEffort / 10);

    // Pricing tier
    let pricing = "Starter";
    if (totalEffort > 100) pricing = "Professional";
    if (totalEffort > 200) pricing = "Enterprise";

    return { totalEffort, timeline, pricing, breakdown: {
      base: baseEffort,
      modules: Math.round(moduleEffort * scaleFactor),
      integration: Math.round(integrationEffort * scaleFactor),
      migration: Math.round(migrationEffort * scaleFactor),
      training: Math.round(trainingEffort * scaleFactor),
      testing: Math.round(testingEffort * scaleFactor),
    }};
  };

  const estimation = calculateEstimation();

  useEffect(() => {
    onUpdate({
      ...data,
      estimation: {
        teamSize,
        distributorCount,
        retailerCount,
        modulesSelected: selectedModules,
        integrationComplexity,
        dataMigrationVolume,
        trainingLocations,
        totalEffort: estimation.totalEffort,
        timeline: estimation.timeline,
        pricing: estimation.pricing,
      },
    });
  }, [teamSize, distributorCount, retailerCount, selectedModules, integrationComplexity, dataMigrationVolume, trainingLocations]);

  const toggleModule = (module: string) => {
    if (selectedModules.includes(module)) {
      setSelectedModules(selectedModules.filter((m) => m !== module));
    } else {
      setSelectedModules([...selectedModules, module]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-amber-400" />
              Team & Scale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-white/80">Number of Sales Representatives</Label>
              <Input
                type="number"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white/80">Number of Distributors</Label>
              <Input
                type="number"
                value={distributorCount}
                onChange={(e) => setDistributorCount(Number(e.target.value))}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white/80">Number of Retailers</Label>
              <Input
                type="number"
                value={retailerCount}
                onChange={(e) => setRetailerCount(Number(e.target.value))}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Puzzle className="w-5 h-5 text-amber-400" />
              Modules Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(moduleEfforts).map((module) => (
                <div key={module} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedModules.includes(module)}
                      onCheckedChange={() => toggleModule(module)}
                      className="border-white/40"
                    />
                    <Label className="text-white/70 text-sm">{module}</Label>
                  </div>
                  <span className="text-white/40 text-xs">{moduleEfforts[module]} days</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Database className="w-5 h-5 text-amber-400" />
              Integration Complexity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={integrationComplexity}
              onValueChange={(v: 'low' | 'medium' | 'high') => setIntegrationComplexity(v)}
            >
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (APIs ready, standard formats)</SelectItem>
                <SelectItem value="medium">Medium (Some custom work needed)</SelectItem>
                <SelectItem value="high">High (Complex ERP, custom APIs)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-white/40 text-xs mt-2">
              Factor: {integrationComplexityFactors[integrationComplexity]}x
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Store className="w-5 h-5 text-amber-400" />
              Data Migration Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={dataMigrationVolume}
              onValueChange={(v: 'small' | 'medium' | 'large') => setDataMigrationVolume(v)}
            >
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (&lt;10,000 records)</SelectItem>
                <SelectItem value="medium">Medium (10,000-100,000 records)</SelectItem>
                <SelectItem value="large">Large (&gt;100,000 records)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-white/40 text-xs mt-2">
              Effort: {dataMigrationFactors[dataMigrationVolume]} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-amber-400" />
              Training Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={trainingLocations}
              onChange={(e) => setTrainingLocations(Number(e.target.value))}
              min={1}
              max={20}
              className="bg-white/5 border-white/20 text-white"
            />
            <p className="text-white/40 text-xs mt-2">
              Effort: {trainingLocations * 3} days (3 days per location)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estimation Results */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-400 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Estimation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-white/60 text-sm mb-1">Total Effort</p>
              <p className="text-4xl font-bold text-white">{estimation.totalEffort}</p>
              <p className="text-white/60 text-sm">Person-Days</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-white/60 text-sm mb-1">Timeline</p>
              <p className="text-4xl font-bold text-amber-400">{estimation.timeline}</p>
              <p className="text-white/60 text-sm">Weeks</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-white/60 text-sm mb-1">Recommended Tier</p>
              <p className="text-4xl font-bold text-green-400">{estimation.pricing}</p>
              <p className="text-white/60 text-sm">Package</p>
            </div>
          </div>

          {/* Effort Breakdown */}
          <div className="space-y-3">
            <h4 className="text-white font-medium">Effort Breakdown</h4>
            {Object.entries(estimation.breakdown).map(([key, value]) => (
              <div key={key} className="flex items-center gap-4">
                <span className="text-white/70 capitalize w-24">{key}</span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                    style={{ width: `${(value / estimation.totalEffort) * 100}%` }}
                  />
                </div>
                <span className="text-white w-20 text-right">{value} days</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Recommendation */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Recommended Team Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">1</p>
              <p className="text-white/70 text-sm">Project Manager</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">
                {selectedModules.length > 5 ? 2 : 1}
              </p>
              <p className="text-white/70 text-sm">Solution Consultant</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">
                {integrationComplexity === 'high' ? 2 : 1}
              </p>
              <p className="text-white/70 text-sm">Technical Lead</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">
                {Math.ceil(trainingLocations / 2)}
              </p>
              <p className="text-white/70 text-sm">Support Engineers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Guidance */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Pricing Guidance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tier: "Starter", range: "₹3-5 Lakhs", users: "Up to 50 users", features: "Core modules" },
              { tier: "Professional", range: "₹8-15 Lakhs", users: "50-200 users", features: "All modules + Integration" },
              { tier: "Enterprise", range: "₹20-40 Lakhs", users: "200+ users", features: "Full suite + Custom" },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`p-4 rounded-lg border ${
                  estimation.pricing === plan.tier
                    ? "bg-amber-500/20 border-amber-500"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <h4 className={`font-bold mb-2 ${estimation.pricing === plan.tier ? "text-amber-400" : "text-white"}`}>
                  {plan.tier}
                  {estimation.pricing === plan.tier && " ✓"}
                </h4>
                <p className="text-white/60 text-sm">{plan.range}</p>
                <p className="text-white/40 text-xs mt-1">{plan.users}</p>
                <p className="text-white/40 text-xs">{plan.features}</p>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-4">
            * Pricing is indicative and subject to final scope discussion. Additional customization and enterprise integrations may impact final pricing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
