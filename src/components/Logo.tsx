import logoSrc from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  maxWidth?: number;
}

export const Logo = ({ className, showTagline = false, maxWidth = 220 }: LogoProps) => (
  <div className={cn("flex flex-col items-center", className)}>
    <img
      src={logoSrc}
      alt="ForgingPathways"
      className="w-full h-auto select-none"
      style={{ maxWidth: `${maxWidth}px` }}
      draggable={false}
    />
    {showTagline && (
      <p className="font-display italic text-sm text-muted-foreground mt-2 text-center">
        Forge your path forward.
      </p>
    )}
  </div>
);
