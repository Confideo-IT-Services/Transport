import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export function QuickAction({ title, description, icon: Icon, onClick }: QuickActionProps) {
  return (
    <Button
      variant="outline"
      className="h-auto p-4 flex flex-col items-start gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="text-left">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Button>
  );
}
