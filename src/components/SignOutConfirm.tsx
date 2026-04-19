import { useState, ReactNode } from "react";
import { Loader2, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SignOutConfirmProps {
  /** Custom trigger element. If not provided, a default icon button is rendered. */
  children?: ReactNode;
  /** Where to navigate after signing out. Defaults to "/". */
  redirectTo?: string;
  /** Optional className for the default trigger button. */
  triggerClassName?: string;
  /** Optional title attribute for the default trigger. */
  triggerTitle?: string;
}

/**
 * Wraps a sign-out trigger with a confirmation dialog and a fade-out
 * animation overlay before performing the actual sign out.
 */
const SignOutConfirm = ({
  children,
  redirectTo = "/",
  triggerClassName,
  triggerTitle = "Sair da conta",
}: SignOutConfirmProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleConfirm = async () => {
    setLeaving(true);
    // Let the fade-out animation play briefly before actually signing out
    await new Promise((r) => setTimeout(r, 600));
    try {
      await signOut();
      toast.success("Você saiu da conta.");
      navigate(redirectTo);
    } catch (e) {
      toast.error("Erro ao sair. Tente novamente.");
    } finally {
      // Keep overlay until navigation completes; component will unmount.
      setTimeout(() => setLeaving(false), 400);
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {children ?? (
            <button
              type="button"
              title={triggerTitle}
              className={
                triggerClassName ??
                "p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              }
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto sm:mx-0 w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
              <LogOut className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará fazer login novamente para acessar sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {leaving && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/95 backdrop-blur-sm animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center animate-scale-in">
            <Loader2 className="h-7 w-7 text-destructive animate-spin" />
          </div>
          <p className="text-sm font-semibold text-foreground">Saindo...</p>
          <p className="text-xs text-muted-foreground">Até logo! 👋</p>
        </div>
      )}
    </>
  );
};

export default SignOutConfirm;
