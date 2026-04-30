/**
 * Comprime uma imagem no client antes de enviar pro storage.
 * - Redimensiona para max 1024px no maior lado
 * - Converte para JPEG qualidade 0.82
 * - Mantém PNG transparente (não converte) se for o caso
 * Retorna o File comprimido ou o original se já for menor que 200KB.
 */
export async function compressImage(file: File, maxDim = 1024, quality = 0.82): Promise<File> {
  if (file.size < 200 * 1024) return file;
  if (!file.type.startsWith("image/")) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = file.type === "image/png";
      const mime = isPng ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          const ext = isPng ? "png" : "jpg";
          const newName = file.name.replace(/\.[^.]+$/, "") + "." + ext;
          resolve(new File([blob], newName, { type: mime }));
        },
        mime,
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}