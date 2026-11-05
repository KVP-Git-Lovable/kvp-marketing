import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, X } from "lucide-react";

interface BarcodeScanInputProps {
  onScan: (code: string) => void;
  onClear: () => void;
  activeCode: string;
}

export default function BarcodeScanInput({ onScan, onClear, activeCode }: BarcodeScanInputProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onScan(code.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Scan barcode / SKU / product code..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="pl-10"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={!code.trim()}>
        Search
      </Button>
      {activeCode && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setCode(""); onClear(); }}
        >
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      )}
    </form>
  );
}
