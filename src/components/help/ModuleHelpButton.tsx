import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModuleHelpButtonProps {
  /** The help center category ID to link to, e.g. "my-visit", "attendance" */
  categoryId: string;
  /** Optional: specific article ID to link directly */
  articleId?: string;
  /** Visual variant for different backgrounds */
  variant?: "default" | "onDark" | "ghost";
  /** Optional className override */
  className?: string;
}

export function ModuleHelpButton({ categoryId, articleId, variant = "default", className }: ModuleHelpButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (articleId) {
      navigate(`/help-center/${articleId}`);
    } else {
      navigate(`/help-center?category=${categoryId}`);
    }
  };

  const baseClasses = "inline-flex items-center justify-center rounded-full transition-colors shrink-0";
  const sizeClasses = "w-7 h-7 sm:w-8 sm:h-8";
  
  const variantClasses = {
    default: "text-muted-foreground hover:text-primary hover:bg-primary/10",
    onDark: "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/15",
    ghost: "text-muted-foreground/60 hover:text-primary hover:bg-muted",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={`${baseClasses} ${sizeClasses} ${variantClasses[variant]} ${className || ""}`}
            aria-label="Help articles"
          >
            <HelpCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          View help articles
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
