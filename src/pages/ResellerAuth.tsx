import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Rocket, Mail, Lock, User, Eye, EyeOff, TrendingUp, Wallet, Shield } from "lucide-react";

type Mode = "login" | "signup" | "forgot";

export default function ResellerAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = (params.get("mode") as Mode) || "signup";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se já está logado, manda direto pro painel do revendedor
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/revendedor", { replace: true });
    });
  }, [navigate]);

  const title = useMemo(
    () => (mode === "signup" ? "Criar conta de Revendedor" : mode === "login" ? "Entrar como Revendedor" : "Recuperar senha"),
    [mode]
  );

  const submit = async () => {
    if (mode === "forgot") {
      if (!email.trim()) return toast.error("Informe seu e-mail");
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Enviamos um link de recuperação para seu e-mail.");
      setMode("login");
      return;
    }

    if (!email.trim() || !password) return toast.error("Preencha e-mail e senha");
    if (mode === "signup" && !name.trim()) return toast.error("Informe seu nome");
    if (mode === "signup" && password.length < 8) return toast.error("Senha precisa ter pelo menos 8 caracteres");

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/revendedor`,
            data: { full_name: name.trim(), signup_source: "reseller" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Conta criada! Confirme seu e-mail para continuar.");
          setMode("login");
          return;
        }
        toast.success("Conta criada! Vamos completar seu cadastro de revendedor.");
        navigate("/revendedor", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate("/revendedor", { replace: true });
      }
    } catch (e: any) {
      const msg = e?.message || "Falha na autenticação";
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha inválidos" :
        msg.includes("already registered") || msg.includes("User already") ? "E-mail já cadastrado — faça login" :
        msg
      );
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = `${title} — ItaSuper Revendedores`;
  const pageDesc = "Área exclusiva para revendedores ItaSuper. 20% vitalício + R$ 150 por loja ativada.";

  return (
    <>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDesc} />
      <link rel="canonical" href={typeof window !== "undefined" ? `${window.location.origin}/revendedor/entrar` : ""} />

      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex flex-col">
        <header className="border-b bg-background/70 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/seja-revendedor" className="flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4 text-primary" /> Revendedores ItaSuper
            </Link>
            <Link to="/" className="text-xs text-muted-foreground hover:underline">Voltar ao site</Link>
          </div>
        </header>

        <main className="flex-1 grid md:grid-cols-2 gap-8 items-center max-w-5xl w-full mx-auto px-4 py-8 md:py-12">
          {/* Coluna esquerda: benefícios */}
          <section className="hidden md:block space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
              <Rocket className="h-3 w-3" /> Programa exclusivo
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
              Área do <span className="text-primary">Revendedor</span> ItaSuper
            </h1>
            <p className="text-muted-foreground">
              Esta é uma área separada do login de clientes. Aqui você acompanha suas indicações,
              comissões e saques.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><TrendingUp className="h-5 w-5 text-primary shrink-0" />
                <span><strong>20% vitalício</strong> sobre o MRR de cada loja indicada</span>
              </li>
              <li className="flex gap-3"><Wallet className="h-5 w-5 text-primary shrink-0" />
                <span><strong>R$ 150 de bônus</strong> por loja ativada (20 pedidos/30d)</span>
              </li>
              <li className="flex gap-3"><Shield className="h-5 w-5 text-primary shrink-0" />
                <span>Sem meta, sem mensalidade — saque via PIX a partir de R$ 100</span>
              </li>
            </ul>
          </section>

          {/* Coluna direita: formulário */}
          <section>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {mode === "signup"
                    ? "Crie sua conta de revendedor em menos de 1 minuto."
                    : mode === "login"
                    ? "Acesse seu painel de indicações e comissões."
                    : "Enviaremos um link para redefinir sua senha."}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <Label>Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
                    </div>
                  </div>
                )}
                <div>
                  <Label>E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoComplete="email" />
                  </div>
                </div>
                {mode !== "forgot" && (
                  <div>
                    <Label>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 pr-9"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "Sua senha"}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={submit} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signup" ? "Criar conta e continuar" : mode === "login" ? "Entrar" : "Enviar link"}
                </Button>

                <div className="text-xs text-center text-muted-foreground pt-2 space-y-1">
                  {mode === "signup" && (
                    <p>
                      Já é revendedor?{" "}
                      <button className="text-primary hover:underline" onClick={() => setMode("login")}>Entrar</button>
                    </p>
                  )}
                  {mode === "login" && (
                    <>
                      <p>
                        Ainda não tem conta?{" "}
                        <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Cadastre-se</button>
                      </p>
                      <p>
                        <button className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>Esqueci minha senha</button>
                      </p>
                    </>
                  )}
                  {mode === "forgot" && (
                    <p>
                      <button className="text-primary hover:underline" onClick={() => setMode("login")}>Voltar ao login</button>
                    </p>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
                  Área exclusiva para revendedores. Se você é <strong>cliente</strong> ou <strong>lojista</strong>,{" "}
                  <Link to="/auth" className="text-primary hover:underline">use o login principal</Link>.
                </p>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </>
  );
}