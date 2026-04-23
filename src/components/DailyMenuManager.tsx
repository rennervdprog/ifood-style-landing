 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { Utensils, Save, CheckCircle2, Circle, Loader2, Info } from "lucide-react";
 
 interface DailyMenuManagerProps {
   storeId: string;
   products: any[];
   onUpdate: () => void;
 }
 
 const DailyMenuManager = ({ storeId, products, onUpdate }: DailyMenuManagerProps) => {
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const [description, setDescription] = useState("");
   const [isSaving, setIsSaving] = useState(false);
   const [showManager, setShowManager] = useState(false);
 
   // Initialize selected IDs based on metadata
   useEffect(() => {
     const initialSelected = products
       .filter(p => 
         p.metadata?.is_daily_menu === true || 
         p.metadata?.is_marmita === true ||
         p.name.toLowerCase().includes("marmita")
       )
       .map(p => p.id);
     setSelectedIds(initialSelected);
     
     // Use description from the first selected product as default
     if (initialSelected.length > 0) {
       const firstSelected = products.find(p => p.id === initialSelected[0]);
       if (firstSelected?.description) {
         setDescription(firstSelected.description);
       }
     }
   }, [products]);
 
   const toggleProduct = (id: string) => {
     setSelectedIds(prev => 
       prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
     );
   };
 
   const handleUpdateDailyMenu = async () => {
     if (selectedIds.length === 0) {
       toast.error("Selecione ao menos um produto para atualizar");
       return;
     }
 
     if (!description.trim()) {
       toast.error("Informe a descrição do cardápio do dia");
       return;
     }
 
     setIsSaving(true);
     try {
       const updates = selectedIds.map(id => {
         const product = products.find(p => p.id === id);
         return supabase
           .from("products")
           .update({
             description: description.trim(),
             metadata: { ...(product?.metadata || {}), is_daily_menu: true }
           } as any)
           .eq("id", id);
       });
 
       const results = await Promise.all(updates);
       const hasError = results.some(r => r.error);
 
       if (hasError) {
         toast.error("Erro ao atualizar alguns produtos");
       } else {
         toast.success("Cardápio do dia atualizado com sucesso!");
         onUpdate();
       }
     } catch (error) {
       toast.error("Erro ao processar atualização");
     } finally {
       setIsSaving(false);
     }
   };
 
   if (!showManager) {
     return (
       <button
         onClick={() => setShowManager(true)}
         className="w-full flex items-center justify-between bg-primary/10 border border-primary/30 rounded-2xl p-4 hover:bg-primary/20 transition-all group"
       >
         <div className="flex items-center gap-3">
           <div className="bg-primary p-2 rounded-xl text-primary-foreground shadow-sm group-hover:scale-110 transition-transform">
             <Utensils className="h-5 w-5" />
           </div>
           <div className="text-left">
             <h3 className="text-sm font-bold text-primary">Gestor de Cardápio do Dia</h3>
             <p className="text-xs text-primary/70">Atualize rapidamente Marmitas e Pratos do Dia</p>
           </div>
         </div>
         <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold">
           Abrir
         </div>
       </button>
     );
   }
 
   return (
     <div className="bg-accent/30 border border-primary/20 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
       <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Utensils className="h-5 w-5" />
           <h3 className="font-bold text-sm text-primary-foreground">Atualizar Cardápio do Dia</h3>
         </div>
         <button 
           onClick={() => setShowManager(false)}
           className="text-white/80 hover:text-white text-xs font-bold"
         >
           Fechar
         </button>
       </div>
 
       <div className="p-4 space-y-4">
         <div className="space-y-2">
           <label className="text-xs font-bold text-primary flex items-center gap-1">
             <Info className="h-3 w-3" />
             O que será servido hoje?
           </label>
           <textarea
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             placeholder="Ex: Arroz, feijão, bife acebolado, batata frita e salada"
             className="w-full bg-card border border-primary/20 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none min-h-[80px] text-foreground"
           />
         </div>
 
         <div className="space-y-2">
           <label className="text-xs font-bold text-primary">
             Selecione os produtos para atualizar:
           </label>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
             {products.length === 0 ? (
               <p className="text-xs text-muted-foreground italic">Nenhum produto cadastrado</p>
             ) : (
               products.map(product => (
                 <button
                   key={product.id}
                   onClick={() => toggleProduct(product.id)}
                   className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                     selectedIds.includes(product.id)
                       ? "bg-primary/10 border-primary text-primary-foreground"
                       : "bg-card border-border text-muted-foreground hover:border-primary/50"
                   }`}
                 >
                   <div className="flex flex-col">
                     <span className={`text-xs font-bold truncate max-w-[120px] ${selectedIds.includes(product.id) ? "text-primary" : "text-foreground"}`}>{product.name}</span>
                     <span className="text-[10px] opacity-70">R$ {product.price.toFixed(2)}</span>
                   </div>
                   {selectedIds.includes(product.id) ? (
                     <CheckCircle2 className="h-4 w-4 text-primary" />
                   ) : (
                     <Circle className="h-4 w-4 text-muted-foreground/30" />
                   )}
                 </button>
               ))
             )}
           </div>
         </div>
 
         <div className="pt-2 border-t border-primary/10">
           <button
             disabled={isSaving || selectedIds.length === 0}
             onClick={handleUpdateDailyMenu}
             className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
           >
             {isSaving ? (
               <Loader2 className="h-4 w-4 animate-spin" />
             ) : (
               <Save className="h-4 w-4" />
             )}
             Atualizar {selectedIds.length} Produto{selectedIds.length !== 1 ? "s" : ""}
           </button>
           <p className="text-[10px] text-center text-muted-foreground mt-2 font-medium">
             Isso substituirá a descrição dos produtos selecionados.
           </p>
         </div>
       </div>
     </div>
   );
 };
 
 export default DailyMenuManager;