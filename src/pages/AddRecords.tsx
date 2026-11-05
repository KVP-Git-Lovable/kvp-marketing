import { Users, ArrowLeft } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";

const AddRecords = () => {
  const navigate = useNavigate();

  const recordTypes = [
    {
      icon: Users,
      title: "Distributor Mapping",
      description: "Map distributors to retailers for product supply",
      href: "/my-retailers?action=mapping",
      color: "from-red-500 to-red-600",
      bgColor: "from-red-500/10 to-red-600/10",
      borderColor: "border-red-200"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-primary text-primary-foreground">
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
          <div className="relative p-6">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Business Operations</h1>
                <p className="text-primary-foreground/80 text-sm">Manage your business operations and partnerships</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 -mt-4 relative z-10">
          <div className="space-y-4">
            {recordTypes.map((record, index) => (
              <NavLink key={record.href} to={record.href}>
                <Card className={`shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r ${record.bgColor} ${record.borderColor}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${record.color} shadow-lg border border-white/20`}>
                        <record.icon className="h-8 w-8 text-white drop-shadow-sm" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{record.title}</h3>
                        <p className="text-sm text-muted-foreground">{record.description}</p>
                      </div>
                      <div className="text-muted-foreground">
                        <ArrowLeft className="h-5 w-5 rotate-180" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </NavLink>
            ))}
          </div>

          {/* Quick Info */}
          <Card className="mt-6 bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-purple-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="font-medium">•</span>
                  <span>All records are automatically synced across your team</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium">•</span>
                  <span>Parent Name fields will auto-populate from existing records</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium">•</span>
                  <span>Required fields are marked with an asterisk (*)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AddRecords;