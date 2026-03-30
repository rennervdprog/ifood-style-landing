import { MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

interface WhatsAppButtonProps {
  number: string;
  message?: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const WhatsAppButton = ({ number, message, label, size = "sm", className = "" }: WhatsAppButtonProps) => {
  if (!number) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openWhatsApp(number, message);
      }}
      className={`inline-flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl active:scale-95 transition-transform ${
        size === "sm" ? "px-3 py-2 text-xs min-h-[44px]" : "px-4 py-2.5 text-sm min-h-[44px]"
      } ${className}`}
      title={label || "WhatsApp"}
    >
      <MessageCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label && <span>{label}</span>}
    </button>
  );
};

export default WhatsAppButton;
