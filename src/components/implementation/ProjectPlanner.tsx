import { useState, useEffect } from "react";
import { Calendar, ChevronDown, ChevronUp, Clock, Users, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ImplementationData } from "@/pages/website/ImplementationToolkitPage";
import { format, addWeeks, addDays } from "date-fns";

interface ProjectPlannerProps {
  data: ImplementationData;
  onUpdate: (data: ImplementationData) => void;
}

const defaultPhases = [
  { name: "Discovery & Analysis", duration: 2, description: "Requirement gathering, As-Is assessment, stakeholder interviews", deliverables: ["Signed-off SRS", "Gap Analysis Report"] },
  { name: "Configuration", duration: 2, description: "System setup, master data upload, user creation", deliverables: ["Configured Environment", "User Access Matrix"] },
  { name: "Integration", duration: 2, description: "ERP/API integration, data sync setup, testing", deliverables: ["Working Integrations", "API Documentation"] },
  { name: "UAT", duration: 2, description: "User acceptance testing, bug fixes, sign-off", deliverables: ["UAT Sign-off", "Issue Resolution Report"] },
  { name: "Training", duration: 2, description: "Train-the-trainer, regional rollout, user training", deliverables: ["Trained Users", "Training Materials"] },
  { name: "Pilot", duration: 2, description: "Limited rollout in 1-2 territories, feedback collection", deliverables: ["Pilot Feedback Report", "Go/No-Go Decision"] },
  { name: "Go-Live", duration: 1, description: "Full production rollout, go-live support", deliverables: ["Production System", "Go-Live Checklist Complete"] },
  { name: "Hypercare", duration: 4, description: "Intensive post-go-live support, issue resolution", deliverables: ["Stable Operations", "Transition to BAU Support"] },
];

const resources = [
  { role: "Project Manager", count: 1, responsibility: "Overall delivery, stakeholder management" },
  { role: "Solution Consultant", count: 1, responsibility: "Configuration, training, process design" },
  { role: "Technical Lead", count: 1, responsibility: "Integration, customization, technical issues" },
  { role: "Support Engineer", count: 1, responsibility: "Data migration, testing, user support" },
  { role: "Customer PM", count: 1, responsibility: "Customer-side coordination, escalations" },
  { role: "Customer IT Lead", count: 1, responsibility: "Integration support, data extraction" },
  { role: "Super Users", count: 5, responsibility: "UAT, training support, feedback" },
];

export function ProjectPlanner({ data, onUpdate }: ProjectPlannerProps) {
  const [phases, setPhases] = useState(defaultPhases);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [startDate, setStartDate] = useState(data.projectPlan.startDate || "");

  useEffect(() => {
    if (startDate) {
      calculateTimeline();
    }
  }, [startDate, phases]);

  const calculateTimeline = () => {
    if (!startDate) return;

    const start = new Date(startDate);
    let currentDate = start;
    const calculatedPhases = phases.map((phase) => {
      const phaseStart = new Date(currentDate);
      const phaseEnd = addWeeks(phaseStart, phase.duration);
      currentDate = phaseEnd;
      return {
        ...phase,
        startDate: format(phaseStart, "yyyy-MM-dd"),
        endDate: format(addDays(phaseEnd, -1), "yyyy-MM-dd"),
      };
    });

    onUpdate({
      ...data,
      projectPlan: {
        startDate,
        phases: calculatedPhases,
      },
    });
  };

  const updatePhaseDuration = (index: number, duration: number) => {
    const newPhases = [...phases];
    newPhases[index] = { ...newPhases[index], duration };
    setPhases(newPhases);
  };

  const getTotalWeeks = () => phases.reduce((sum, p) => sum + p.duration, 0);

  const getPhaseWidth = (duration: number) => {
    const total = getTotalWeeks();
    return (duration / total) * 100;
  };

  const getPhaseColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-amber-500",
      "bg-green-500",
      "bg-cyan-500",
      "bg-orange-500",
      "bg-emerald-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Start Date Input */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            Project Start Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div>
              <Label className="text-white/80">Select Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-white/20 text-white w-48"
              />
            </div>
            {startDate && (
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-white/60">Total Duration:</span>
                  <span className="text-white ml-2 font-medium">{getTotalWeeks()} weeks</span>
                </div>
                <div>
                  <span className="text-white/60">Estimated End:</span>
                  <span className="text-white ml-2 font-medium">
                    {format(addWeeks(new Date(startDate), getTotalWeeks()), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visual Timeline (Gantt-style) */}
      {startDate && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Project Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Timeline bar */}
              <div className="flex h-10 rounded-lg overflow-hidden">
                {phases.map((phase, index) => (
                  <div
                    key={phase.name}
                    style={{ width: `${getPhaseWidth(phase.duration)}%` }}
                    className={`${getPhaseColor(index)} flex items-center justify-center text-white text-xs font-medium px-1 truncate cursor-pointer hover:opacity-90 transition-opacity`}
                    onClick={() => setExpandedPhase(expandedPhase === index ? null : index)}
                    title={phase.name}
                  >
                    {phase.duration > 1 && phase.name.split(" ")[0]}
                  </div>
                ))}
              </div>
              
              {/* Week markers */}
              <div className="flex justify-between text-xs text-white/40 pt-1">
                <span>Week 0</span>
                <span>Week {Math.floor(getTotalWeeks() / 2)}</span>
                <span>Week {getTotalWeeks()}</span>
              </div>
            </div>

            {/* Phase Legend */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
              {phases.map((phase, index) => (
                <div
                  key={phase.name}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 p-1 rounded"
                  onClick={() => setExpandedPhase(expandedPhase === index ? null : index)}
                >
                  <div className={`w-3 h-3 rounded ${getPhaseColor(index)}`} />
                  <span className="text-white/70 truncate">{phase.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase Details */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Phase Details & Duration</h3>
        {phases.map((phase, index) => {
          const savedPhase = data.projectPlan.phases?.[index];
          return (
            <Card
              key={phase.name}
              className={`bg-white/5 border-white/10 transition-all ${
                expandedPhase === index ? "ring-1 ring-amber-500/50" : ""
              }`}
            >
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpandedPhase(expandedPhase === index ? null : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded ${getPhaseColor(index)}`} />
                    <CardTitle className="text-white text-base">
                      Phase {index + 1}: {phase.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-400 text-sm font-medium">
                      {phase.duration} week{phase.duration !== 1 ? "s" : ""}
                    </span>
                    {savedPhase && (
                      <span className="text-white/60 text-xs">
                        {format(new Date(savedPhase.startDate), "MMM dd")} - {format(new Date(savedPhase.endDate), "MMM dd")}
                      </span>
                    )}
                    {expandedPhase === index ? (
                      <ChevronUp className="w-4 h-4 text-white/60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/60" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {expandedPhase === index && (
                <CardContent className="space-y-4">
                  <p className="text-white/70 text-sm">{phase.description}</p>
                  
                  <div>
                    <Label className="text-white/80 text-sm mb-2 block">
                      Adjust Duration: {phase.duration} week{phase.duration !== 1 ? "s" : ""}
                    </Label>
                    <Slider
                      value={[phase.duration]}
                      onValueChange={([v]) => updatePhaseDuration(index, v)}
                      min={1}
                      max={8}
                      step={1}
                      className="w-full max-w-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-white/80 text-sm mb-2 block flex items-center gap-2">
                      <Flag className="w-4 h-4" />
                      Key Deliverables
                    </Label>
                    <ul className="space-y-1">
                      {phase.deliverables.map((d) => (
                        <li key={d} className="text-white/60 text-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Resource Plan */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Resource Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/60 py-2 px-3">Role</th>
                  <th className="text-center text-white/60 py-2 px-3">Count</th>
                  <th className="text-left text-white/60 py-2 px-3">Responsibility</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => (
                  <tr key={resource.role} className="border-b border-white/5">
                    <td className="text-white py-2 px-3 font-medium">{resource.role}</td>
                    <td className="text-center text-amber-400 py-2 px-3">{resource.count}</td>
                    <td className="text-white/70 py-2 px-3">{resource.responsibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Key Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/20" />
            
            <div className="space-y-6">
              {[
                { week: 2, title: "Requirements Sign-off", description: "SRS document approved by customer" },
                { week: 4, title: "System Ready", description: "Configuration complete, ready for UAT" },
                { week: 6, title: "Integration Complete", description: "All integrations tested and working" },
                { week: 8, title: "UAT Sign-off", description: "User acceptance testing completed" },
                { week: 10, title: "Training Complete", description: "All users trained across regions" },
                { week: 12, title: "Pilot Success", description: "Pilot territories operational" },
                { week: 13, title: "Go-Live", description: "Full production deployment" },
                { week: getTotalWeeks(), title: "Project Closure", description: "Hypercare complete, BAU handover" },
              ].map((milestone, index) => (
                <div key={milestone.title} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 text-xs font-bold z-10">
                    W{milestone.week}
                  </div>
                  <div className="flex-1 pb-2">
                    <h4 className="text-white font-medium">{milestone.title}</h4>
                    <p className="text-white/60 text-sm">{milestone.description}</p>
                    {startDate && (
                      <p className="text-amber-400/70 text-xs mt-1">
                        {format(addWeeks(new Date(startDate), milestone.week), "MMMM dd, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
