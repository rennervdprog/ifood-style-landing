import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmWord: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Confirmação dupla: usuário precisa digitar exatamente o nome/palavra antes de liberar a ação. */
export const ConfirmActionDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  destructive,
  onConfirm,
}: Props) => {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const matches = typed.trim().toLowerCase() === confirmWord.trim().toLowerCase();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTyped("");
        onOpenChange(v);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Para confirmar, digite <strong>{confirmWord}</strong> abaixo:
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || loading}
            onClick={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await onConfirm();
                setTyped("");
                onOpenChange(false);
              } finally {
                setLoading(false);
              }
            }}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {loading ? "Processando…" : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};