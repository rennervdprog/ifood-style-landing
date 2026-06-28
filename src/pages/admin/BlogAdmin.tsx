import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Eye, EyeOff, MessageSquare, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PostRow {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  category: string | null;
  view_count: number | null;
  updated_at: string;
}

interface PendingComment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  post_id: string;
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [pending, setPending] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "comments">("posts");

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      (supabase as any)
        .from("blog_posts")
        .select("id, slug, title, published, published_at, category, view_count, updated_at")
        .order("updated_at", { ascending: false }),
      (supabase as any)
        .from("blog_comments")
        .select("id, author_name, content, created_at, post_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setPosts((p as PostRow[]) || []);
    setPending((c as PendingComment[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePublished = async (post: PostRow) => {
    const next = !post.published;
    const { error } = await (supabase as any)
      .from("blog_posts")
      .update({
        published: next,
        published_at: next && !post.published_at ? new Date().toISOString() : post.published_at,
      })
      .eq("id", post.id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(next ? "Publicado" : "Despublicado");
    load();
  };

  const deletePost = async (post: PostRow) => {
    if (!confirm(`Excluir "${post.title}"? Não dá pra desfazer.`)) return;
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", post.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Excluído");
    load();
  };

  const moderate = async (id: string, status: "approved" | "rejected") => {
    const { error } = await (supabase as any)
      .from("blog_comments")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error("Erro");
    toast.success(status === "approved" ? "Aprovado" : "Removido");
    load();
  };

  return (
    <>
      <Helmet><title>Blog · Admin</title></Helmet>
      <main className="min-h-screen bg-muted/30">
        <header className="border-b border-border bg-background sticky top-0 z-10">
          <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/super-admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-lg md:text-xl font-bold">Blog</h1>
            </div>
            <Link
              to="/admin/blog/novo"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Novo post
            </Link>
          </div>
          <div className="container mx-auto max-w-6xl px-4 flex gap-1">
            <button
              onClick={() => setTab("posts")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              Posts ({posts.length})
            </button>
            <button
              onClick={() => setTab("comments")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === "comments" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              Comentários pendentes
              {pending.length > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {pending.length}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="container mx-auto max-w-6xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tab === "posts" ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Título</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Categoria</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Views</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/admin/blog/${p.id}`} className="font-semibold hover:text-primary">
                          {p.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">/{p.slug}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.category || "—"}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums">{p.view_count ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePublished(p)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${p.published ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          title={p.published ? "Despublicar" : "Publicar"}
                        >
                          {p.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {p.published ? "Publicado" : "Rascunho"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link to={`/admin/blog/${p.id}`} className="rounded-md p-1.5 hover:bg-muted" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button onClick={() => deletePost(p)} className="rounded-md p-1.5 hover:bg-destructive/10 text-destructive" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {posts.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum post ainda. Criar o primeiro?</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum comentário pendente.
                </div>
              )}
              {pending.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">{c.author_name}</span>
                    · {new Date(c.created_at).toLocaleString("pt-BR")}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mb-3">{c.content}</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => moderate(c.id, "rejected")}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => moderate(c.id, "approved")}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Aprovar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}