/**
 * Renderiza uma bolha verde estilo WhatsApp do template preenchido.
 * Converte *negrito* do WhatsApp em <strong> e preserva quebras de linha.
 */
import { Check } from "lucide-react";

interface Props {
  text: string;
  storeName?: string;
}

const renderWhatsappText = (text: string) => {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*([^*\n]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={`b-${i++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

export default function WhatsAppBubblePreview({ text, storeName = "Sua Loja" }: Props) {
  const lines = text.split("\n");
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="rounded-2xl p-3 min-h-[180px] relative overflow-hidden"
      style={{
        backgroundColor: "#0a1014",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(37,211,102,0.06) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(37,211,102,0.05) 0%, transparent 40%)",
      }}
    >
      <div className="text-[10px] text-white/40 text-center mb-2 font-medium">{storeName}</div>
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 shadow-md"
          style={{ backgroundColor: "#005c4b", color: "#e9edef" }}
        >
          <div className="text-[12px] leading-snug whitespace-pre-wrap break-words">
            {lines.map((line, idx) => (
              <div key={idx}>{line ? renderWhatsappText(line) : "\u00A0"}</div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-0.5 mt-1 -mb-0.5">
            <span className="text-[9px]" style={{ color: "rgba(233,237,239,0.6)" }}>{now}</span>
            <Check className="h-2.5 w-2.5" style={{ color: "#53bdeb" }} strokeWidth={3} />
            <Check className="h-2.5 w-2.5 -ml-1.5" style={{ color: "#53bdeb" }} strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
  );
}