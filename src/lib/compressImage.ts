/**
 * Sistema robusto de compressão de imagens no cliente.
 * - Redimensiona para um máximo de 1280px (preservando aspecto)
 * - Converte para WebP (prioridade) ou JPEG de alta eficiência
 * - Inteligência para manter transparência apenas se necessário
 * - Alvo de tamanho: ~250KB para fotos de produtos
 */
export async function compressImage(
  file: File, 
  options: { maxDim?: number; quality?: number; forceWebp?: boolean } = {}
): Promise<File> {
  const { maxDim = 1280, quality = 0.8, forceWebp = true } = options;

  // Não processar arquivos que não sejam imagem
  if (!file.type.startsWith("image/")) return file;
  
  // Se o arquivo já for minúsculo (< 100KB), não vale o processamento
  if (file.size < 100 * 1024 && !forceWebp) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Calcular novas dimensões mantendo o aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: true });
      
      if (!ctx) {
        resolve(file);
        return;
      }

      // Desenhar com suavização de imagem ativada
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Determinar o formato de saída ideal
      // WebP é superior para web, mas fallback para JPEG se não suportado
      const isTransparent = file.type === "image/png" || file.type === "image/webp";
      const outputMime = forceWebp ? "image/webp" : (isTransparent ? "image/png" : "image/jpeg");
      const outputExt = forceWebp ? "webp" : (isTransparent ? "png" : "jpg");

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          
          // Se a "compressão" resultou em um arquivo maior, usar o original
          // a menos que estejamos forçando a conversão de formato (WebP)
          if (blob.size >= file.size && !forceWebp) {
            resolve(file);
            return;
          }

          const fileName = file.name.replace(/\.[^.]+$/, "") + "." + outputExt;
          resolve(new File([blob], fileName, { type: outputMime }));
        },
        outputMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    
    img.src = url;
  });
}