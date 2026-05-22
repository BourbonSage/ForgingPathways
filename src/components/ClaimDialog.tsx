import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

interface ClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  credits: number;
}

export const ClaimDialog = ({ open, onOpenChange, taskTitle, credits }: ClaimDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">You're in!</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{taskTitle}</span> — +{credits} Forge Credits added to your balance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-44 h-44 rounded-2xl bg-card border border-border flex items-center justify-center shadow-soft">
            {/* Placeholder QR — replaced with real code in production */}
            <QrCode className="w-32 h-32 text-foreground" strokeWidth={1.4} />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-[16rem]">
            Show this code when you check in at the Lowcountry Food Bank front desk.
          </p>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
