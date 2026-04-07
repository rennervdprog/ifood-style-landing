import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, Phone, Bike, CheckCircle, MapPin, Camera, Upload, FileText, Shield, X } from "lucide-react";

const CITIES = [
  { value: "itatinga", label: "Itatinga", available: true },
  { value: "pardinho", label: "Pardinho", available: false },
  { value: "bofete", label: "Bofete", available: false },
  { value: "torre_de_pedra", label: "Torre de Pedra", available: false },
  { value: "botucatu", label: "Botucatu", available: false },
  { value: "avare", label: "Avaré", available: false },
];

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  emailConfirm: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  phone: z.string().trim().min(10, "Telefone inválido").max(20),
  vehicle: z.string().trim().min(2, "Informe a placa da moto").max(20),
  cnhNumber: z.string().trim().min(9, "CNH deve ter pelo menos 9 dígitos").max(15, "CNH inválida"),
  city: z.string().min(1, "Selecione sua cidade"),
}).refine(data => data.email === data.emailConfirm, {
  message: "Os e-mails não coincidem",
  path: ["emailConfirm"],
});

const CadastroEntregador = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [cnhNumber, setCnhNumber] = useState("");
  const [city, setCity] = useState("itatinga");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Document uploads
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
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas");
      return;
    }
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
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
    if (error) {
      console.error(`Upload ${docType} error:`, error);
      return null;
    }
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, emailConfirm, password, fullName, phone, vehicle, cnhNumber, city });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!cnhFront || !cnhBack) {
      toast.error("Envie a foto da frente e verso da CNH");
      return;
    }
    if (!selfieFile) {
      toast.error("Tire uma selfie usando a câmera");
      return;
    }

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
            document: phone.trim(),
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

      // Upload documents to private bucket
      const [cnhFrontPath, cnhBackPath, selfiePath] = await Promise.all([
        uploadDocument(cnhFront, userId, "cnh_front"),
        uploadDocument(cnhBack, userId, "cnh_back"),
        uploadDocument(selfieFile, userId, "selfie"),
      ]);

      // Update profile with document info
      await supabase.from("profiles").update({
        cnh_number: cnhNumber.trim(),
        cnh_front_url: cnhFrontPath,
        cnh_back_url: cnhBackPath,
        selfie_url: selfiePath,
      }).eq("user_id", userId);

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
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-black text-foreground">Cadastro Enviado! 🎉</h2>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi enviado e está em análise. Seus documentos serão verificados pelo administrador.
          </p>
          <p className="text-xs text-muted-foreground">
            Verifique seu e-mail para confirmar sua conta.
          </p>
          <div className="bg-muted/50 rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Seus documentos estão armazenados de forma segura e criptografada.</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl mt-4"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-foreground">Cadastro Entregador</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-4xl mb-3 block">🏍️</span>
            <h2 className="text-xl font-black text-foreground">Quero Entregar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre-se como entregador no ItaSuper
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email fields */}
            <FieldInput icon={Mail} type="email" placeholder="Seu e-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
            <FieldInput icon={Mail} type="email" placeholder="Confirme seu e-mail" value={emailConfirm} onChange={setEmailConfirm} error={errors.emailConfirm} autoComplete="email" />
            <p className="text-[10px] text-muted-foreground -mt-2 px-1">
              ⚠️ Garanta que o e-mail esteja correto. Ele será usado para notificações sobre seus ganhos.
            </p>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha (min. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>

            {/* Personal info */}
            <FieldInput icon={User} placeholder="Nome completo" value={fullName} onChange={setFullName} error={errors.fullName} />
            <FieldInput icon={Phone} placeholder="Telefone com DDD" value={phone} onChange={setPhone} error={errors.phone} inputMode="tel" />
            <FieldInput icon={Bike} placeholder="Placa da Moto (ex: ABC-1234)" value={vehicle} onChange={setVehicle} error={errors.vehicle} />
            
            {/* CNH Number */}
            <FieldInput icon={FileText} placeholder="Número da CNH" value={cnhNumber} onChange={setCnhNumber} error={errors.cnhNumber} inputMode="numeric" />

            {/* City */}
            <div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
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

            {/* Document section header */}
            <div className="pt-2 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Documentos obrigatórios</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Seus documentos são armazenados com segurança e acessíveis apenas ao admin da plataforma.
              </p>
            </div>

            {/* CNH Front */}
            <DocumentUpload
              label="📄 Frente da CNH"
              preview={cnhFrontPreview}
              onSelect={(f) => handleFileSelect(f, setCnhFront, setCnhFrontPreview)}
              onClear={() => { setCnhFront(null); setCnhFrontPreview(null); }}
            />

            {/* CNH Back */}
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
                  <img src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover rounded-xl border border-border" />
                  <button
                    type="button"
                    onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : showCamera ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg"
                    >
                      <Camera className="h-4 w-4" /> Capturar
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-muted text-foreground px-4 py-2 rounded-full text-sm font-bold shadow-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <Camera className="h-8 w-8 text-primary" />
                  <span className="text-xs font-bold text-primary">Abrir câmera para selfie</span>
                  <span className="text-[10px] text-muted-foreground">A foto deve ser tirada na hora</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Cadastrando...
                </span>
              ) : "Cadastrar como Entregador"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
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

const FieldInput = ({ icon: Icon, placeholder, value, onChange, error, type = "text", autoComplete, inputMode }: {
  icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; inputMode?: string;
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
        className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoComplete={autoComplete}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
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
          <img src={preview} alt={label} className="w-full h-40 object-cover rounded-xl border border-border" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Toque para enviar foto</span>
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
