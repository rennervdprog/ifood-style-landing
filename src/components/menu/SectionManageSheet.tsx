import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ArrowUp, ArrowDown, Edit2, Trash2, Save, X, Plus, ArrowLeft } from "lucide-react";

interface Section {
  id: string;
  name: string;
  sort_order: number;
}

interface SectionManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Section[];
  productCounts: Map<string | null, number>;
  onCreate: (name: string) => Promise<void> | void;
  onRename: (id: string, name: string) => Promise<void> | void;
  onMove: (id: string, delta: -1 | 1) => Promise<void> | void;
  onDelete: (id: string, name: string, productCount: number) => void;
}

export const SectionManageSheet = ({
  open,
  onOpenChange,
  sections,
  productCounts,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: SectionManageSheetProps) => {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
  };

  const startEdit = (s: Section) => {
    setEditingId(s.id);
    setEditValue(s.name);
  };

  const saveEdit = async (id: string) => {
    await onRename(id, editValue);
    setEditingId(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-20 bg-background border-b border-border px-3 py-3 flex-row items-center gap-2 space-y-0">
          <SheetClose className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-muted text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </SheetClose>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight truncate">Gerenciar seções</SheetTitle>
            <SheetDescription className="text-xs truncate">
              Reordene, renomeie ou exclua.
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nova seção (ex: Bebidas)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 bg-card text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Criar
            </button>
          </div>

          <div className="space-y-2">
            {sections.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma seção criada ainda.
              </p>
            )}
            {sections.map((s, i) => {
              const count = productCounts.get(s.id) || 0;
              const editing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 bg-card border border-border rounded-xl p-2.5"
                >
                  <div className="flex flex-col">
                    <button
                      onClick={() => onMove(s.id, -1)}
                      disabled={i === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onMove(s.id, 1)}
                      disabled={i === sections.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      aria-label="Descer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(s.id)}
                        className="w-full bg-background px-2 py-1.5 rounded border border-primary text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {count} produto{count === 1 ? "" : "s"}
                        </p>
                      </div>
                    )}
                  </div>
                  {editing ? (
                    <>
                      <button
                        onClick={() => saveEdit(s.id)}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground"
                        aria-label="Salvar"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        aria-label="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        aria-label="Renomear"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(s.id, s.name, count)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SectionManageSheet;