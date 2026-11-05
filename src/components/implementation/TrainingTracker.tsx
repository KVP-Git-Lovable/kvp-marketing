import { useState } from "react";
import { Users, MapPin, Calendar, CheckCircle, Clock, BookOpen, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ImplementationData } from "@/pages/website/ImplementationToolkitPage";

interface TrainingTrackerProps {
  data: ImplementationData;
  onUpdate: (data: ImplementationData) => void;
}

const trainingMaterials = [
  { id: "admin-guide", name: "Admin Guide", format: "PDF + Video", audience: "IT Admin" },
  { id: "user-manual", name: "User Manual", format: "PDF", audience: "All Users" },
  { id: "quick-start", name: "Quick Start Guide", format: "1-pager", audience: "Field Users" },
  { id: "video-tutorials", name: "Video Tutorials", format: "MP4/YouTube", audience: "All Users" },
  { id: "faq", name: "FAQ Document", format: "PDF", audience: "Support Team" },
  { id: "assessment", name: "Assessment Quiz", format: "Online", audience: "All Users" },
];

export function TrainingTracker({ data, onUpdate }: TrainingTrackerProps) {
  const [materialStatus, setMaterialStatus] = useState<Record<string, boolean>>({});

  const updateBatch = (index: number, field: string, value: any) => {
    const newBatches = [...data.training.batches];
    newBatches[index] = { ...newBatches[index], [field]: value };
    onUpdate({
      ...data,
      training: { ...data.training, batches: newBatches },
    });
  };

  const updateRegion = (index: number, field: string, value: any) => {
    const newRegions = [...data.training.regions];
    newRegions[index] = { ...newRegions[index], [field]: value };
    onUpdate({
      ...data,
      training: { ...data.training, regions: newRegions },
    });
  };

  const addRegion = () => {
    const newRegions = [
      ...data.training.regions,
      { name: `Region ${data.training.regions.length + 1}`, trainingDate: "", trainer: "", venue: "", userCount: 0, status: "planned" as const },
    ];
    onUpdate({
      ...data,
      training: { ...data.training, regions: newRegions },
    });
  };

  const getTotalUsersToTrain = () => data.training.regions.reduce((sum, r) => sum + r.userCount, 0);
  
  const getTotalUsersTrained = () => data.training.regions
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + r.userCount, 0);

  const getBatchProgress = () => {
    const completed = data.training.batches.filter((b) => b.status === "completed").length;
    return (completed / data.training.batches.length) * 100;
  };

  const getRegionProgress = () => {
    const completed = data.training.regions.filter((r) => r.status === "completed").length;
    return data.training.regions.length > 0 ? (completed / data.training.regions.length) * 100 : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "in-progress": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-white/5 text-white/60 border-white/10";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "in-progress": return <Clock className="w-4 h-4 text-amber-400" />;
      default: return <Calendar className="w-4 h-4 text-white/40" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total to Train</p>
                <p className="text-2xl font-bold text-white">{getTotalUsersToTrain()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Users Trained</p>
                <p className="text-2xl font-bold text-green-400">{getTotalUsersTrained()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Batch Progress</p>
                <p className="text-2xl font-bold text-purple-400">{Math.round(getBatchProgress())}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Region Progress</p>
                <p className="text-2xl font-bold text-cyan-400">{Math.round(getRegionProgress())}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Training Batches */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            Training Batches (Train-the-Trainer Model)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.training.batches.map((batch, index) => (
              <div
                key={batch.name}
                className={`p-4 rounded-lg border ${getStatusColor(batch.status)}`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    {getStatusIcon(batch.status)}
                    <div>
                      <p className="font-medium text-white">{batch.name}</p>
                      <p className="text-white/60 text-sm">{batch.audience}</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-white/60 text-xs">Duration</Label>
                      <p className="text-white text-sm">{batch.duration}</p>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs">Mode</Label>
                      <p className="text-white text-sm">{batch.mode}</p>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs">Users</Label>
                      <div className="flex gap-1 items-center">
                        <Input
                          type="number"
                          value={batch.completedUsers}
                          onChange={(e) => updateBatch(index, "completedUsers", Number(e.target.value))}
                          className="bg-white/5 border-white/20 text-white h-7 w-14 text-sm"
                        />
                        <span className="text-white/60">/</span>
                        <Input
                          type="number"
                          value={batch.totalUsers}
                          onChange={(e) => updateBatch(index, "totalUsers", Number(e.target.value))}
                          className="bg-white/5 border-white/20 text-white h-7 w-14 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs">Status</Label>
                      <Select
                        value={batch.status}
                        onValueChange={(v) => updateBatch(index, "status", v)}
                      >
                        <SelectTrigger className="bg-white/5 border-white/20 text-white h-7 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {batch.totalUsers > 0 && (
                  <div className="mt-3">
                    <Progress 
                      value={(batch.completedUsers / batch.totalUsers) * 100} 
                      className="h-1.5"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Regional Rollout */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Regional Training Rollout
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addRegion}
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              Add Region
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/60 py-3 px-2">Region</th>
                  <th className="text-left text-white/60 py-3 px-2">Training Date</th>
                  <th className="text-left text-white/60 py-3 px-2">Trainer</th>
                  <th className="text-left text-white/60 py-3 px-2">Venue</th>
                  <th className="text-center text-white/60 py-3 px-2">Users</th>
                  <th className="text-left text-white/60 py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.training.regions.map((region, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-3 px-2">
                      <Input
                        value={region.name}
                        onChange={(e) => updateRegion(index, "name", e.target.value)}
                        className="bg-white/5 border-white/20 text-white h-8"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        type="date"
                        value={region.trainingDate}
                        onChange={(e) => updateRegion(index, "trainingDate", e.target.value)}
                        className="bg-white/5 border-white/20 text-white h-8"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        value={region.trainer}
                        onChange={(e) => updateRegion(index, "trainer", e.target.value)}
                        placeholder="Trainer name"
                        className="bg-white/5 border-white/20 text-white h-8"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        value={region.venue}
                        onChange={(e) => updateRegion(index, "venue", e.target.value)}
                        placeholder="Venue"
                        className="bg-white/5 border-white/20 text-white h-8"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={region.userCount}
                        onChange={(e) => updateRegion(index, "userCount", Number(e.target.value))}
                        className="bg-white/5 border-white/20 text-white h-8 w-20 text-center"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Select
                        value={region.status}
                        onValueChange={(v) => updateRegion(index, "status", v)}
                      >
                        <SelectTrigger className={`h-8 border ${getStatusColor(region.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Training Materials Checklist */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            Training Materials Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trainingMaterials.map((material) => (
              <div
                key={material.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  materialStatus[material.id]
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
                onClick={() => setMaterialStatus({ ...materialStatus, [material.id]: !materialStatus[material.id] })}
              >
                <div className="flex items-center gap-3">
                  {materialStatus[material.id] ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                  )}
                  <div>
                    <p className="text-white font-medium">{material.name}</p>
                    <p className="text-white/60 text-xs">
                      {material.format} • {material.audience}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Progress 
              value={(Object.values(materialStatus).filter(Boolean).length / trainingMaterials.length) * 100}
              className="flex-1 h-2"
            />
            <span className="text-white/60 text-sm">
              {Object.values(materialStatus).filter(Boolean).length}/{trainingMaterials.length} ready
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Training Model Diagram */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-purple-400">Train-the-Trainer Cascade Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="px-6 py-3 bg-purple-500/20 rounded-lg border border-purple-500/30 text-center">
              <p className="text-purple-400 font-medium">Level 1: Core Team Training</p>
              <p className="text-white/60 text-xs">Quickapp Team → Customer Core Team</p>
            </div>
            <div className="h-6 w-0.5 bg-purple-500/30" />
            <div className="px-6 py-3 bg-pink-500/20 rounded-lg border border-pink-500/30 text-center">
              <p className="text-pink-400 font-medium">Level 2: Regional Trainers</p>
              <p className="text-white/60 text-xs">Core Team → Regional Super Users</p>
            </div>
            <div className="h-6 w-0.5 bg-pink-500/30" />
            <div className="px-6 py-3 bg-amber-500/20 rounded-lg border border-amber-500/30 text-center">
              <p className="text-amber-400 font-medium">Level 3: State Trainers</p>
              <p className="text-white/60 text-xs">Regional → ASMs/RSMs</p>
            </div>
            <div className="h-6 w-0.5 bg-amber-500/30" />
            <div className="px-6 py-3 bg-green-500/20 rounded-lg border border-green-500/30 text-center">
              <p className="text-green-400 font-medium">Level 4: Field Users</p>
              <p className="text-white/60 text-xs">State Trainers → All FSRs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
