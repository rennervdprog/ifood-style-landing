import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

const schema = z.object({
  author_name: z.string().trim().min(2, "Nome muito curto").max(60),
  author_email: z.string().trim().email("E-mail inválido").max(255),
  content: z.string().trim().min(5, "Comentário muito curto").max(1000),
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BlogComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ author_name: "", author_email: "", content: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_comments")
        .select("id, author_name, content, created_at")
        .eq("post_id", postId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      setComments((data as Comment[]) || []);
      setLoading(false);
    })();
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from("blog_comments").insert({
      post_id: postId,
      author_name: parsed.data.author_name,
      author_email: parsed.data.author_email.toLowerCase(),
      content: parsed.data.content,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao enviar. Tente novamente.");
      return;
    }
    toast.success("Comentário enviado! Será publicado após moderação.");
    setForm({ author_name: "", author_email: "", content: "" });
  };

  return (
    <section className="border-t border-border bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h2 className="font-editorial text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          Comentários {comments.length > 0 && <span className="text-base text-muted-foreground">({comments.length})</span>}
        </h2>

        <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              maxLength={60}
              placeholder="Seu nome"
              value={form.author_name}
              onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="email"
              required
              maxLength={255}
              placeholder="Seu e-mail (não será publicado)"
              value={form.author_email}
              onChange={(e) => setForm((f) => ({ ...f, author_email: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <textarea
            required
            minLength={5}
            maxLength={1000}
            rows={4}
            placeholder="Deixe seu comentário…"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Comentários passam por moderação antes de aparecerem.</p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-5">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Carregando…</div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Seja o primeiro a comentar.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">{c.author_name}</span>
                  <span className="text-muted-foreground">· {fmt(c.created_at)}</span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {c.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}