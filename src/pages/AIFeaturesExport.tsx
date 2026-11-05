import { useEffect } from "react";
import { downloadAIFeaturesExcel } from "@/utils/generateAIFeaturesExcel";

export default function AIFeaturesExport() {
  useEffect(() => {
    downloadAIFeaturesExcel();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">AI Features Documentation</h1>
        <p className="text-muted-foreground">Your Excel file should download automatically.</p>
        <button
          onClick={downloadAIFeaturesExcel}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          Download Again
        </button>
      </div>
    </div>
  );
}
