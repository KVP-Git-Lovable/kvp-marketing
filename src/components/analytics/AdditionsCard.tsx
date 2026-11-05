import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdditionsCardProps {
  formsCount: number;
  customersCount: number;
}

export const AdditionsCard = ({ formsCount, customersCount }: AdditionsCardProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Additions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Forms</div>
            <div className="text-3xl font-bold text-primary">{formsCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Customers</div>
            <div className="text-3xl font-bold text-primary">{customersCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
