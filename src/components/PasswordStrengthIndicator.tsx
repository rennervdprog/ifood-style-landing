import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "Mínimo 8 caracteres", test: (pw) => pw.length >= 8 },
  { label: "Uma letra maiúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Uma letra minúscula", test: (pw) => /[a-z]/.test(pw) },
  { label: "Um número", test: (pw) => /[0-9]/.test(pw) },
  { label: "Um caractere especial (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const usePasswordStrength = (password: string) => {
  const ruleResults = useMemo(() => PASSWORD_RULES.map(r => r.test(password)), [password]);
  const passedCount = ruleResults.filter(Boolean).length;
  const isStrong = passedCount === PASSWORD_RULES.length;
  return { ruleResults, passedCount, isStrong };
};

export const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const { ruleResults, passedCount } = usePasswordStrength(password);
  const strengthPercent = (passedCount / PASSWORD_RULES.length) * 100;
  const strengthColor =
    strengthPercent <= 20 ? "bg-red-500" :
    strengthPercent <= 60 ? "bg-yellow-500" :
    strengthPercent < 100 ? "bg-blue-500" : "bg-green-500";

  if (!password) return null;

  return (
    <div className="space-y-2 mt-1">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${strengthColor} rounded-full transition-all duration-300`} style={{ width: `${strengthPercent}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-0.5">
        {PASSWORD_RULES.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {ruleResults[i] ? (
              <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
            <span className={`text-[10px] ${ruleResults[i] ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
