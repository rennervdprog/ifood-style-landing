#!/usr/bin/env node
/**
 * Publica um bundle OTA para os apps Capacitor (cliente/parceiro).
 *
 * Fluxo:
 *   1. Zipa `dist/` → `.ota/<app>-<versão>.zip`
 *   2. Calcula SHA-256
 *   3. Faz upload do ZIP para o bucket `app-releases` do Supabase externo
 *   4. Reescreve `manifest-cliente.json` ou `manifest-parceiro.json`
 *      no bucket com {version, url, checksum}
 *
 * O plugin `@capgo/capacitor-updater` consulta a edge function `ota-update`,
 * que escolhe o manifest correto pelo app_id nativo do APK.
 *
 * Variáveis de ambiente necessárias:
 *   EXTERNAL_SUPABASE_URL
 *   EXTERNAL_SUPABASE_SERVICE_KEY (ou EXTERNAL_SERVICE_ROLE_KEY)
 */
import { readFileSync, existsSync, mkdirSync, createReadStream } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.EXTERNAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.EXTERNAL_SUPABASE_SERVICE_KEY ||
  process.env.EXTERNAL_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltam EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("❌ dist/ não existe — rode `npm run build` antes.");
  process.exit(1);
}

const versionMatch = readFileSync("src/lib/appVersion.ts", "utf8").match(
  /APP_VERSION\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/,
);
if (!versionMatch) {
  console.error("❌ Não consegui ler APP_VERSION em src/lib/appVersion.ts");
  process.exit(1);
}
const version = versionMatch[1];
const rawAppMode = (process.env.OTA_APP_MODE || process.env.VITE_CAPACITOR_APP_MODE || "cliente").toLowerCase();
const appMode = rawAppMode === "parceiro" || rawAppMode === "partner" ? "parceiro" : "cliente";
const appId = appMode === "parceiro" ? "app.itasuper.parceiro" : "app.itasuper.cliente";

const outDir = resolve(".ota");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const zipPath = resolve(outDir, `${appMode}-${version}.zip`);

console.log(`📦 Zipando dist/ (${appMode}) → ${zipPath}`);
// -r recursivo, -q silencioso, -X sem metadata extra, cwd dentro de dist/
execSync(`cd dist && zip -rqX9 "${zipPath}" .`, { stdio: "inherit" });

const buf = readFileSync(zipPath);
const checksum = createHash("sha256").update(buf).digest("hex");
const sizeKB = (buf.length / 1024).toFixed(1);
console.log(`🔐 SHA-256: ${checksum}`);
console.log(`📏 Tamanho: ${sizeKB} KB`);

const bucketPath = `bundles/${appMode}/${version}.zip`;
const uploadUrl = `${SUPABASE_URL}/storage/v1/object/app-releases/${bucketPath}`;

console.log(`☁️  Upload → ${bucketPath}`);
const upRes = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/zip",
    "x-upsert": "true",
    "Cache-Control": "public, max-age=31536000, immutable",
  },
  body: buf,
});
if (!upRes.ok) {
  console.error(`❌ Upload falhou (${upRes.status}):`, await upRes.text());
  process.exit(1);
}

const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/app-releases/${bucketPath}`;
const manifest = {
  version,
  url: publicUrl,
  checksum,
  size: buf.length,
  appMode,
  appId,
  publishedAt: new Date().toISOString(),
};

const manifestPath = `manifest-${appMode}.json`;
console.log(`📝 Atualizando ${manifestPath}`);
const mfRes = await fetch(
  `${SUPABASE_URL}/storage/v1/object/app-releases/${manifestPath}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
    body: JSON.stringify(manifest, null, 2),
  },
);
if (!mfRes.ok) {
  console.error(`❌ ${manifestPath} falhou (${mfRes.status}):`, await mfRes.text());
  process.exit(1);
}

// Compatibilidade com APKs/diagnósticos antigos que ainda leem manifest.json.
// Mantemos o cliente como fallback público, mas o fluxo correto usa ota-update.
if (appMode === "cliente") {
  const legacyMfRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/app-releases/manifest.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      body: JSON.stringify(manifest, null, 2),
    },
  );
  if (!legacyMfRes.ok) {
    console.warn(`⚠️ manifest.json legado falhou (${legacyMfRes.status}):`, await legacyMfRes.text());
  }
}

console.log(`✅ OTA ${appMode} v${version} publicada`);
console.log(`   Manifest: ${SUPABASE_URL}/storage/v1/object/public/app-releases/${manifestPath}`);
console.log(`   Bundle:   ${publicUrl}`);