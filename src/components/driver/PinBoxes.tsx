import { useRef } from "react";

export interface PinBoxesProps {
  value: string;
  onChange: (v: string) => void;
  accent?: "success" | "warning";
  length?: number;
  disabled?: boolean;
}

/**
 * PIN input com N caixas individuais (default 4) e auto-avanço, backspace,
 * navegação por setas e paste. Aceita apenas dígitos.
 */
export const PinBoxes = ({
  value,
  onChange,
  accent = "success",
  length = 4,
  disabled = false,
}: PinBoxesProps) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  const setDigit = (i: number, d: string) => {
    const clean = d.replace(/\D/g, "").slice(0, 1);
    const next = (
      digits.slice(0, i).join("") + clean + digits.slice(i + 1).join("")
    ).slice(0, length);
    onChange(next);
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  const borderClass =
    accent === "success"
      ? "border-success/40 focus:border-success focus:shadow-success/25"
      : "border-warning/40 focus:border-warning focus:shadow-warning/25";
  const filledClass =
    accent === "success"
      ? "border-success bg-success/5"
      : "border-warning bg-warning/5";

  return (
    <div className="flex items-center justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Dígito ${i + 1}`}
          value={d}
          readOnly={disabled}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={`flex-1 aspect-square max-w-[68px] text-center text-3xl font-black bg-card border-2 rounded-2xl text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:shadow-lg transition-all ${
            d ? filledClass : borderClass
          }`}
        />
      ))}
    </div>
  );
};

export default PinBoxes;