import { useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
 import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, Phone, Bike, CheckCircle, MapPin, Camera, Upload, FileText, Shield, X, ChevronRight } from "lucide-react";
 import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { PasswordStrengthIndicator, usePasswordStrength } from "@/components/PasswordStrengthIndicator";

const CITIES = [
  { value: "itatinga", label: "Itatinga", available: true },
  { value: "pardinho", label: "Pardinho", available: false },
  { value: "bofete", label: "Bofete", available: false },
  { value: "torre_de_pedra", label: "Torre de Pedra", available: false },
  { value: "botucatu", label: "Botucatu", available: false },
  { value: "avare", label: "Avaré", available: false },
];

const PLATE_REGEX = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i;

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  emailConfirm: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
   document: z.string().trim().refine(v => validateDocument(v), "CPF ou CNPJ inválido"),
  phone: z.string().trim().min(10, "Telefone inválido").max(20),
  vehicle: z.string().trim()
    .min(7, "Placa deve ter 7 caracteres (ex: ABC-1234 ou ABC1D23)")
    .max(8, "Placa inválida")
    .refine(v => PLATE_REGEX.test(v.replace(/\s/g, "")), "Placa inválida. Use formato antigo (ABC-1234) ou Mercosul (ABC1D23)"),
  cnhNumber: z.string().trim().refine(v => v.replace(/\D/g, "").length === 11, "CNH deve ter exatamente 11 dígitos"),
  city: z.string().min(1, "Selecione sua cidade"),
}).refine(data => data.email === data.emailConfirm, {
  message: "Os e-mails não coincidem",
  path: ["emailConfirm"],
});

const STEPS = [
  { label: "Conta", icon: Mail },
  { label: "Dados", icon: User },
  { label: "Documentos", icon: FileText },
];

const CadastroEntregador = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [cnhNumber, setCnhNumber] = useState("");
  const [city, setCity] = useState("itatinga");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cnhFrontPreview, setCnhFrontPreview] = useState<string | null>(null);
  const [cnhBackPreview, setCnhBackPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = (file: File | null, setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 5MB)"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são aceitas"); return; }
    setter(file);
    const reader = new FileReader();
    reader.onload = (e) => previewSetter(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setShowCamera(true);
    } catch {
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
      setSelfieFile(file);
      setSelfiePreview(canvas.toDataURL("image/jpeg", 0.85));
      stopCamera();
    }, "image/jpeg", 0.85);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const uploadDocument = async (file: File, userId: string, docType: string): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${docType}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) { console.error(`Upload ${docType} error:`, error); return null; }
    return path;
  };

  const validateStep = (stepIndex: number): boolean => {
    setErrors({});
    if (stepIndex === 0) {
      const partial = schema.safeParse({ email, emailConfirm, password, fullName: "temp", document: "00000000000", phone: "0000000000", vehicle: "ABC-1234", cnhNumber: "00000000000", city: "itatinga" });
      if (!partial.success) {
        const fieldErrors: Record<string, string> = {};
        partial.error.errors.forEach((err) => {
          const field = err.path[0] as string;
          if (["email", "emailConfirm", "password"].includes(field)) fieldErrors[field] = err.message;
        });
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
      }
      if (!email.trim() || !password.trim()) {
        if (!email.trim()) setErrors(prev => ({ ...prev, email: "E-mail obrigatório" }));
        if (!password.trim()) setErrors(prev => ({ ...prev, password: "Senha obrigatória" }));
        return false;
      }
    }
    if (stepIndex === 1) {
      const fieldErrors: Record<string, string> = {};
      if (fullName.trim().length < 3) fieldErrors.fullName = "Nome deve ter pelo menos 3 caracteres";
       if (!validateDocument(document)) fieldErrors.document = "CPF ou CNPJ inválido";
      if (phone.trim().length < 10) fieldErrors.phone = "Telefone inválido";
      if (!PLATE_REGEX.test(vehicle.replace(/\s/g, ""))) fieldErrors.vehicle = "Placa inválida";
      if (cnhNumber.replace(/\D/g, "").length !== 11) fieldErrors.cnhNumber = "CNH deve ter 11 dígitos";
      if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(prev => Math.min(prev + 1, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, emailConfirm, password, fullName, document, phone, vehicle, cnhNumber, city });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return;
    }

    if (!cnhFront || !cnhBack) { toast.error("Envie a foto da frente e verso da CNH"); return; }
    if (!selfieFile) { toast.error("Tire uma selfie usando a câmera"); return; }
    if (!acceptedTerms) { toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade."); return; }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName.trim(),
            role: "motoboy",
             document: sanitizeDocument(document),
            vehicle: vehicle.trim(),
            whatsapp: phone.trim(),
            phone: phone.trim(),
            city: city,
          },
        },
      });
      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) throw new Error("Erro ao criar conta");

      const [cnhFrontPath, cnhBackPath, selfiePath] = await Promise.all([
        uploadDocument(cnhFront, userId, "cnh_front"),
        uploadDocument(cnhBack, userId, "cnh_back"),
        uploadDocument(selfieFile, userId, "selfie"),
      ]);

      await supabase.from("profiles").update({
        cnh_number: cnhNumber.trim(),
        cnh_front_url: cnhFrontPath,
        cnh_back_url: cnhBackPath,
        selfie_url: selfiePath,
        terms_accepted_at: new Date().toISOString(),
      }).eq("user_id", userId);

      await supabase.from("terms_acceptance").insert({
        user_id: userId,
        terms_version: "1.0",
        privacy_version: "1.0",
        user_agent: navigator.userAgent,
      });

      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <div>
             <h2 className="text-xl font-black text-foreground">Cadastro Enviado! 🎉</h2>
             <p className="text-sm text-muted-foreground mt-2">
               Sua conta ainda está em análise aguarde. Seus documentos serão verificados pelo administrador.
             </p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground text-left">
              Verifique seu e-mail <span className="font-bold text-foreground">{email}</span> para confirmar sua conta.
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground text-left">
              Seus documentos estão armazenados de forma segura e criptografada.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)} className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-foreground text-sm">Cadastro Entregador</h1>
        </div>
      </header>

      {/* Stepper */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => { if (isDone) setStep(i); }}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  isDone ? "bg-green-500/10 hover:bg-green-500/20" : isActive ? "bg-primary/10" : "bg-muted/50"
                }`}>
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <s.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isDone ? "text-green-500" : isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ═══ Step 0: Account ═══ */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Crie sua conta</h2>
                  <p className="text-xs text-muted-foreground mt-1">Dados de acesso à plataforma</p>
                </div>

                <FieldInput icon={Mail} type="email" placeholder="Seu e-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
                <FieldInput icon={Mail} type="email" placeholder="Confirme seu e-mail" value={emailConfirm} onChange={setEmailConfirm} error={errors.emailConfirm} autoComplete="email" />
                <p className="text-[10px] text-muted-foreground -mt-2 px-1 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                  Garanta que o e-mail esteja correto. Será usado para notificações.
                </p>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha (min. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-12 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
                <PasswordStrengthIndicator password={password} />

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ═══ Step 1: Personal Info ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Seus dados</h2>
                  <p className="text-xs text-muted-foreground mt-1">Informações pessoais e veículo</p>
                </div>

                <FieldInput icon={User} placeholder="Nome completo" value={fullName} onChange={setFullName} error={errors.fullName} />
                 <FieldInput 
                   icon={FileText} 
                   placeholder="CPF ou CNPJ" 
                   value={document} 
                   onChange={(v) => setDocument(formatDocument(v))} 
                   error={errors.document} 
                   inputMode="numeric" 
                   maxLength={18} 
                 />
                <FieldInput icon={Phone} placeholder="Telefone com DDD" value={phone} onChange={setPhone} error={errors.phone} inputMode="tel" />
                <FieldInput icon={Bike} placeholder="Placa (ABC-1234 ou ABC1D23)" value={vehicle} onChange={(v) => {
                  let raw = v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
                  if (raw.length === 4 && /^[A-Z]{3}\d$/.test(raw)) raw = raw.slice(0, 3) + "-" + raw.slice(3);
                  if (raw.includes("-")) raw = raw.slice(0, 8);
                  else raw = raw.slice(0, 7);
                  setVehicle(raw);
                }} error={errors.vehicle} maxLength={8} />
                <FieldInput icon={FileText} placeholder="CNH (0000.0000.0000)" value={cnhNumber} onChange={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 4) formatted = digits.slice(0, 4) + "." + digits.slice(4);
                  if (digits.length > 8) formatted = digits.slice(0, 4) + "." + digits.slice(4, 8) + "." + digits.slice(8);
                  setCnhNumber(formatted);
                }} error={errors.cnhNumber} inputMode="numeric" maxLength={13} />

                {/* City */}
                <div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      {CITIES.map((c) => (
                        <option key={c.value} value={c.value} disabled={!c.available}>
                          {c.label}{!c.available ? " — Em breve" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 bg-muted text-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Step 2: Documents ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Documentos</h2>
                  <p className="text-xs text-muted-foreground mt-1">Envie seus documentos para verificação</p>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Seus documentos são armazenados com segurança e acessíveis apenas ao admin da plataforma.
                  </p>
                </div>

                <DocumentUpload
                  label="📄 Frente da CNH"
                  preview={cnhFrontPreview}
                  onSelect={(f) => handleFileSelect(f, setCnhFront, setCnhFrontPreview)}
                  onClear={() => { setCnhFront(null); setCnhFrontPreview(null); }}
                />

                <DocumentUpload
                  label="📄 Verso da CNH"
                  preview={cnhBackPreview}
                  onSelect={(f) => handleFileSelect(f, setCnhBack, setCnhBackPreview)}
                  onClear={() => { setCnhBack(null); setCnhBackPreview(null); }}
                />

                {/* Selfie */}
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">📸 Selfie (câmera ao vivo)</p>
                  {selfiePreview ? (
                    <div className="relative">
                      <img loading="lazy" decoding="async" src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover rounded-2xl border border-border" />
                      <button
                        type="button"
                        onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : showCamera ? (
                    <div className="relative rounded-2xl overflow-hidden border border-border">
                      <video
                        ref={(el) => {
                          (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                          if (el && streamRef.current && !el.srcObject) {
                            el.srcObject = streamRef.current;
                            el.play().catch(() => {});
                          }
                        }}
                        autoPlay playsInline muted
                        className="w-full h-48 object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                        <button type="button" onClick={capturePhoto}
                          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg">
                          <Camera className="h-4 w-4" /> Capturar
                        </button>
                        <button type="button" onClick={stopCamera}
                          className="bg-muted text-foreground px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full h-36 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-2.5 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-primary">Abrir câmera para selfie</span>
                      <span className="text-[10px] text-muted-foreground">A foto deve ser tirada na hora</span>
                    </button>
                  )}
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer select-none bg-muted/50 rounded-2xl p-3.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-border accent-primary mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Li e aceito os{" "}
                    <Link to="/termos-de-uso" target="_blank" className="text-primary font-bold underline">Termos de Uso</Link>{" "}
                    e a{" "}
                    <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-bold underline">Política de Privacidade</Link>{" "}
                    do ItaSuper.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-muted text-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Cadastrando...
                      </span>
                    ) : "Cadastrar"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5 mb-8">
            Já tem conta?{" "}
            <button onClick={() => navigate("/auth")} className="text-primary font-bold">
              Faça login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const FieldInput = ({ icon: Icon, placeholder, value, onChange, error, type = "text", autoComplete, inputMode, maxLength }: {
  icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; inputMode?: string; maxLength?: number;
}) => (
  <div>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        inputMode={inputMode as any}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1 px-1">{error}</p>}
  </div>
);

const DocumentUpload = ({ label, preview, onSelect, onClear }: {
  label: string; preview: string | null;
  onSelect: (f: File) => void; onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-xs font-bold text-foreground mb-2">{label}</p>
      {preview ? (
        <div className="relative">
          <img loading="lazy" decoding="async" src={preview} alt={label} className="w-full h-44 object-cover rounded-2xl border border-border" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground font-medium">Toque para enviar foto</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
};

export default CadastroEntregador;
