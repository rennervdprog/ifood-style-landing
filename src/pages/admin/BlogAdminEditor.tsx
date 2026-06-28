import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, ExternalLink, Loader2, Upload } from "lucide-react";

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content_md: string;
  cover_url: string;
  author: string;
  category: string;
  featured: boolean;
  published: boolean;
  published_at: string;
  seo_title: string;
  seo_description: string;
  reading_minutes: number | null;
}

const empty: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content_md: "",
  cover_url: "",
  author: "ItaSuper",
  category: "novidades",
  featured: false,
  published: false,
  published_at: "",
  seo_title: "",
  seo_description: "",
  reading_minutes: null,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function estimateMinutes(md: string) {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default function BlogAdminEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_categories")
        .select("slug, name")
        .order("name");
      setCategories((data as any[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Post não encontrado");
        navigate("/admin/blog");
        return;
      }
      setForm({
        title: data.title || "",
        slug: data.slug || "",
        excerpt: data.excerpt || "",
        content_md: data.content_md || "",
        cover_url: data.cover_url || "",
        author: data.author || "ItaSuper",
        category: data.category || "novidades",
        featured: !!data.featured,
        published: !!data.published,
        published_at: data.published_at ? data.published_at.slice(0, 16) : "",
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
        reading_minutes: data.reading_minutes ?? null,
      });
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  const minutes = useMemo(() => form.reading_minutes ?? estimateMinutes(form.content_md), [form.content_md, form.reading_minutes]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async (publishNow: boolean | null = null) => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    if (!form.slug.trim()) return toast.error("Slug obrigatório");
    setSaving(true);

    const willPublish = publishNow ?? form.published;
    const payload: any = {
      title: form.title.trim(),
      slug: slugify(form.slug),
      excerpt: form.excerpt.trim() || null,
      content_md: form.content_md,
      cover_url: form.cover_url.trim() || null,
      author: form.author.trim() || "ItaSuper",
      category: form.category || null,
      featured: form.featured,
      published: willPublish,
      published_at: willPublish
        ? form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString()
        : null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      reading_minutes: estimateMinutes(form.content_md),
    };

    if (isNew) {
      const { data, error } = await (supabase as any).from("blog_posts").insert(payload).select("id").maybeSingle();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Post criado");
      navigate(`/admin/blog/${data.id}`);
    } else {
      const { error } = await (supabase as any).from("blog_posts").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Salvo");
      if (publishNow !== null) update("published", publishNow);
    }
  };

  const handleCover = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `covers/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${ext}`;
    const { error } = await supabase.storage.from("blog-media").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setUploading(false); return toast.error("Falha no upload"); }
    const { data } = supabase.storage.from("blog-media").getPublicUrl(path);
    update("cover_url", data.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada");
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <Helmet><title>{isNew ? "Novo post" : form.title} · Admin</title></Helmet>
      <main className="min-h-screen bg-muted/30">
        <header className="border-b border-border bg-background sticky top-0 z-10">
          <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
            <Link to="/admin/blog" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">{isNew ? "Novo post" : form.title || "Sem título"}</h1>
              <p className="text-xs text-muted-foreground">{minutes} min · {form.published ? "Publicado" : "Rascunho"}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              <button onClick={() => setTab("edit")} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Editar</button>
              <button onClick={() => setTab("preview")} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Preview</button>
            </div>
            {!isNew && form.published && (
              <Link to={`/blog/${form.slug}`} target="_blank" className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                <ExternalLink className="h-3 w-3" /> Ver
              </Link>
            )}
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </div>
        </header>

        <div className="container mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {tab === "edit" ? (
              <>
                <input
                  value={form.title}
                  onChange={(e) => {
                    update("title", e.target.value);
                    if (isNew && !form.slug) update("slug", slugify(e.target.value));
                  }}
                  placeholder="Título do post"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-primary/30"
                />
                <textarea
                  value={form.excerpt}
                  onChange={(e) => update("excerpt", e.target.value)}
                  rows={2}
                  placeholder="Resumo (aparece na listagem e nas redes sociais)"
                  maxLength={300}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <textarea
                  value={form.content_md}
                  onChange={(e) => update("content_md", e.target.value)}
                  rows={28}
                  placeholder={"# Comece a escrever em Markdown\n\nUse **negrito**, _itálico_, listas, links [texto](url) e imagens ![alt](url)."}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 resize-y leading-relaxed"
                />
              </>
            ) : (
              <article className="rounded-2xl border border-border bg-card p-6 prose prose-neutral dark:prose-invert max-w-none">
                <h1>{form.title || "Sem título"}</h1>
                {form.excerpt && <p className="lead text-muted-foreground">{form.excerpt}</p>}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content_md}</ReactMarkdown>
              </article>
            )}
          </div>

          <aside className="space-y-4">
            <Section title="Publicação">
              <label className="flex items-center justify-between text-sm">
                Publicado
                <input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex items-center justify-between text-sm">
                Em destaque
                <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} className="h-4 w-4" />
              </label>
              <Field label="Agendar para">
                <input type="datetime-local" value={form.published_at} onChange={(e) => update("published_at", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Categoria">
                <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputCls}>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Autor">
                <input value={form.author} onChange={(e) => update("author", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Slug (URL)">
                <input value={form.slug} onChange={(e) => update("slug", slugify(e.target.value))} className={inputCls} />
              </Field>
            </Section>

            <Section title="Capa">
              {form.cover_url && (
                <img src={form.cover_url} alt="" className="w-full aspect-video object-cover rounded-lg border border-border" />
              )}
              <label className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted cursor-pointer">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Enviando…" : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCover(e.target.files[0])}
                />
              </label>
              <input
                value={form.cover_url}
                onChange={(e) => update("cover_url", e.target.value)}
                placeholder="ou cole uma URL"
                className={inputCls}
              />
            </Section>

            <Section title="SEO">
              <Field label="Título SEO (60 chars)">
                <input maxLength={70} value={form.seo_title} onChange={(e) => update("seo_title", e.target.value)} className={inputCls} placeholder={form.title} />
              </Field>
              <Field label="Descrição SEO (160 chars)">
                <textarea maxLength={170} rows={3} value={form.seo_description} onChange={(e) => update("seo_description", e.target.value)} className={inputCls + " resize-none"} placeholder={form.excerpt} />
              </Field>
            </Section>
          </aside>
        </div>
      </main>
    </>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}