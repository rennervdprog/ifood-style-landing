import { useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface OrderRatingProps {
  orderId: string;
  storeId: string;
  storeName: string;
  userId: string;
  onRated?: () => void;
}

const OrderRating = ({ orderId, storeId, storeName, userId, onRated }: OrderRatingProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma avaliação.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("order_ratings" as any)
        .insert({
          order_id: orderId,
          user_id: userId,
          store_id: storeId,
          rating,
          comment: comment.trim() || null,
        });
      if (error) {
        if (error.code === "23505") {
          toast.info("Você já avaliou este pedido.");
          setSubmitted(true);
          return;
        }
        throw error;
      }
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
      toast.success("Avaliação enviada! Obrigado 🎉");
      setSubmitted(true);
      onRated?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar avaliação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
        <p className="text-xs font-bold text-primary">⭐ Obrigado pela sua avaliação!</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-foreground">Avalie seu pedido em {storeName}</p>
      <div className="flex gap-1 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => setRating(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 ${
                star <= (hoveredRating || rating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 200))}
        placeholder="Comentário (opcional)"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-xl text-xs disabled:opacity-50"
      >
        {submitting ? "Enviando..." : "Enviar Avaliação"}
      </button>
    </div>
  );
};

export default OrderRating;
