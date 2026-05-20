import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** Ícone (?) discreto com popover explicando o porquê de uma cobrança. */
export default function WhyThisCharge({ title, children, className = "" }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Por que ${title}?`}
          className={`inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors ${className}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-xs leading-relaxed">
        <p className="font-semibold text-foreground mb-1">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}