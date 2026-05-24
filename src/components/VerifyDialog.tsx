import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, UserCheck, Check, Loader2 } from "lucide-react";

interface VerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  credits: number;
  onVerified: () => Promise<void> | void;
}

type Method = "qr" | "photo" | "staff";

export const VerifyDialog = ({ open, onOpenChange, taskTitle, credits, onVerified }: VerifyDialogProps) => {
  const [method, setMethod] = useState<Method | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setMethod(null);
    setSubmitting(false);
    setDone(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onVerified();
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Verified!</DialogTitle>
              <DialogDescription>
                +{credits} Forge Credits added for{" "}
                <span className="font-medium text-foreground">{taskTitle}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-6">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" strokeWidth={2.5} />
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : method === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Verify completion</DialogTitle>
              <DialogDescription>
                Choose how you'd like to confirm <span className="font-medium text-foreground">{taskTitle}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setMethod("qr")}>
                <QrCode className="w-5 h-5 mr-3" />
                <span className="flex flex-col items-start">
                  <span className="font-medium">Scan QR Code</span>
                  <span className="text-xs text-muted-foreground">Partner site check-in</span>
                </span>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setMethod("photo")}>
                <Camera className="w-5 h-5 mr-3" />
                <span className="flex flex-col items-start">
                  <span className="font-medium">Upload Photo</span>
                  <span className="text-xs text-muted-foreground">Show your completed work</span>
                </span>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setMethod("staff")}>
                <UserCheck className="w-5 h-5 mr-3" />
                <span className="flex flex-col items-start">
                  <span className="font-medium">Staff / Partner Check-in</span>
                  <span className="text-xs text-muted-foreground">Have a partner confirm</span>
                </span>
              </Button>
            </div>
          </>
        ) : method === "qr" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Scan QR Code</DialogTitle>
              <DialogDescription>
                Have a partner scan this code to verify completion.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-44 h-44 rounded-2xl bg-card border border-border flex items-center justify-center shadow-soft">
                <QrCode className="w-32 h-32 text-foreground" strokeWidth={1.4} />
              </div>
              <p className="text-xs text-muted-foreground">Demo placeholder QR</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setMethod(null)} disabled={submitting}>Back</Button>
              <Button className="flex-1" onClick={confirm} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm scan"}
              </Button>
            </DialogFooter>
          </>
        ) : method === "photo" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Upload Photo</DialogTitle>
              <DialogDescription>
                Attach a photo of your completed work.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="flex flex-col items-center justify-center gap-2 w-full h-36 rounded-2xl border-2 border-dashed border-border bg-secondary/40 cursor-pointer hover:bg-secondary/60 transition-colors">
                <Camera className="w-7 h-7 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to choose a photo</span>
                <input type="file" accept="image/*" className="sr-only" />
              </label>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setMethod(null)} disabled={submitting}>Back</Button>
              <Button className="flex-1" onClick={confirm} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Staff Check-in</DialogTitle>
              <DialogDescription>
                A staff member or partner can confirm your completion here.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-2xl bg-secondary/60 p-4 text-sm text-secondary-foreground">
                Demo mode — tap below to simulate a partner check-in.
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setMethod(null)} disabled={submitting}>Back</Button>
              <Button className="flex-1" onClick={confirm} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm check-in"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
