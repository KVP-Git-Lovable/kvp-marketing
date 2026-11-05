import { useState } from "react";
import { Check, MapPin, Phone, Store, Plus, BarChart3, Calendar } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { RetailerAnalytics } from "@/components/RetailerAnalytics";

interface Retailer {
  id: string;
  name: string;
  type: string;
  phone: string;
  address: string;
  lastVisitDate?: string;
  isSelected: boolean;
  priority?: "high" | "medium" | "low";
  metrics: {
    avgOrders3Months: number;
    avgOrderPerVisit: number;
    visitsIn3Months: number;
  };
}

const mockRetailers: Retailer[] = [
  {
    id: "1",
    name: "Mahesh Kirana and General Stores",
    type: "Retailers",
    phone: "9955551112",
    address: "MG Road, Bangalore",
    lastVisitDate: "2024-07-18",
    isSelected: false,
    priority: "high",
    metrics: {
      avgOrders3Months: 28500,
      avgOrderPerVisit: 4250,
      visitsIn3Months: 8
    }
  },
  {
    id: "2", 
    name: "Balaji Kiranad",
    type: "Retailers",
    phone: "9516584711",
    address: "Commercial Street, Bangalore",
    lastVisitDate: "2024-07-13",
    isSelected: true,
    priority: "medium",
    metrics: {
      avgOrders3Months: 18200,
      avgOrderPerVisit: 3640,
      visitsIn3Months: 5
    }
  },
  {
    id: "3",
    name: "Sham Kirana and General Stores", 
    type: "Small and Medium Businesses",
    phone: "9926963147",
    address: "34 A, Kharghar, Navi Mumbai, Maharashtra",
    lastVisitDate: "2024-07-17",
    isSelected: true,
    priority: "high",
    metrics: {
      avgOrders3Months: 45600,
      avgOrderPerVisit: 5700,
      visitsIn3Months: 10
    }
  },
  {
    id: "4",
    name: "Shree Shankar Retail Stores",
    type: "Retailers", 
    phone: "9901050678",
    address: "HSR Layout, Bangalore",
    lastVisitDate: "2024-07-15",
    isSelected: false,
    priority: "low",
    metrics: {
      avgOrders3Months: 12300,
      avgOrderPerVisit: 2460,
      visitsIn3Months: 4
    }
  },
  {
    id: "5",
    name: "Vardhman Kirana",
    type: "Retailers",
    phone: "9926612072", 
    address: "Indiranagar, Bangalore",
    isSelected: false,
    priority: "medium",
    metrics: {
      avgOrders3Months: 21800,
      avgOrderPerVisit: 3630,
      visitsIn3Months: 6
    }
  },
  {
    id: "6",
    name: "Porwal Enterprises",
    type: "Retailers",
    phone: "8986122228",
    address: "Koramangala, Bangalore", 
    lastVisitDate: "2024-07-19",
    isSelected: true,
    priority: "high",
    metrics: {
      avgOrders3Months: 52400,
      avgOrderPerVisit: 6550,
      visitsIn3Months: 9
    }
  }
];

export const VisitPlanner = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [retailers, setRetailers] = useState<Retailer[]>(mockRetailers);
  const [selectedAnalyticsRetailer, setSelectedAnalyticsRetailer] = useState<Retailer | null>(null);

  const filteredRetailers = retailers.filter(retailer =>
    retailer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    retailer.phone.includes(searchTerm)
  );

  const selectedCount = retailers.filter(r => r.isSelected).length;

  const handleToggleSelection = (id: string) => {
    setRetailers(prev => 
      prev.map(retailer => 
        retailer.id === id 
          ? { ...retailer, isSelected: !retailer.isSelected }
          : retailer
      )
    );
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Visit Planner
            </CardTitle>
            <p className="text-muted-foreground">Select retailers to visit today</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchInput
              placeholder="Search by retailer name or phone"
              value={searchTerm}
              onChange={setSearchTerm}
            />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {selectedCount} retailer{selectedCount !== 1 ? 's' : ''} selected
              </span>
              {selectedCount > 0 && (
                <Button size="sm" className="shadow-button">
                  <Plus size={16} className="mr-1" />
                  Plan Visit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {filteredRetailers.map((retailer) => (
            <Card 
              key={retailer.id} 
              className={`shadow-card transition-all cursor-pointer hover:shadow-lg ${
                retailer.isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleToggleSelection(retailer.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={retailer.isSelected}
                    onChange={() => handleToggleSelection(retailer.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-card-foreground">
                          {retailer.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Store size={14} />
                            <span>{retailer.type}</span>
                          </div>
                          {retailer.priority && (
                            <Badge className={`text-xs ${getPriorityColor(retailer.priority)}`}>
                              {retailer.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {retailer.isSelected && (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={14} />
                        <span>{retailer.phone}</span>
                      </div>
                      
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{retailer.address}</span>
                      </div>
                      
                      {retailer.lastVisitDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar size={12} />
                          <span>Last visit: {new Date(retailer.lastVisitDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-primary">₹{(retailer.metrics.avgOrders3Months/1000).toFixed(0)}K</p>
                        <p className="text-xs text-muted-foreground">3M Avg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-primary">₹{(retailer.metrics.avgOrderPerVisit/1000).toFixed(1)}K</p>
                        <p className="text-xs text-muted-foreground">Per Visit</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-primary">{retailer.metrics.visitsIn3Months}</p>
                        <p className="text-xs text-muted-foreground">Visits</p>
                      </div>
                    </div>

                    {/* Analytics Button */}
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnalyticsRetailer(retailer);
                        }}
                        className="text-xs h-7"
                      >
                        <BarChart3 size={12} className="mr-1" />
                        Analytics
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedCount > 0 && (
          <div className="fixed bottom-20 left-4 right-4">
            <Card className="shadow-lg border-primary/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{selectedCount} retailers selected</p>
                    <p className="text-sm text-muted-foreground">Ready to create visit schedule</p>
                  </div>
                  <Button className="shadow-button">
                    Create Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Modal */}
        {selectedAnalyticsRetailer && (
          <RetailerAnalytics
            isOpen={!!selectedAnalyticsRetailer}
            retailer={selectedAnalyticsRetailer}
            onClose={() => setSelectedAnalyticsRetailer(null)}
          />
        )}
      </div>
    </Layout>
  );
};