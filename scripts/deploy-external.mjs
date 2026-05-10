#!/usr/bin/env node
/**
 * Deploy de uma ou mais edge functions para o Supabase EXTERNO
 * (qkjhguziuchqsbxzruea), usando a função `deploy-to-external` que vive
 * no Lovable Cloud.
 *
 * Uso:
 *   npm run deploy:external -- asaas-webhook
 *   npm run deploy:external -- asaas-webhook auto-charge-physical-fees
 *   npm run deploy:external -- --all
 *   npm run deploy:external -- --jwt sales-coach   (deploya com verify_jwt=true)
 */

import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = "https://lktzrqjvqoojlrhqnxuz.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdHpycWp2cW9vamxyaHFueHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTU5MTksImV4cCI6MjA5MDQ3MTkxOX0.CGxwer8G6zfGkZ7tY6X5roUzm7yD-EM1YKZ_3moGB44";

const args = process.argv.slice(2);
let verifyJwt = false;
let all = false;
const slugs = [];
for (const a of args) {
  if (a === "--jwt") verifyJwt = true;
  else if (a === "--all") all = true;
  else slugs.push(a);
}

const FN_DIR = path.join(process.cwd(), "supabase", "functions");

let targets = slugs;
if (all) {
  targets = (await fs.readdir(FN_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => n !== "deploy-to-external" && n !== "list-external-functions");
}

if (targets.length === 0) {
  console.error("Uso: npm run deploy:external -- <slug> [<slug2> ...] | --all");
  process.exit(1);
}

let okCount = 0;
let failCount = 0;

for (const slug of targets) {
  const file = path.join(FN_DIR, slug, "index.ts");
  let code;
  try {
    code = await fs.readFile(file, "utf8");
  } catch {
    console.log(`❌ ${slug}: arquivo não encontrado em ${file}`);
    failCount++;
    continue;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/deploy-to-external`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify({ slug, code, verify_jwt: verifyJwt }),
  });

  let parsed;
  const text = await res.text();
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  const ok = res.ok && parsed?.ok !== false && (parsed?.status ?? 200) < 400;
  if (ok) {
    okCount++;
    console.log(
      `✅ ${slug.padEnd(35)} ${parsed?.existed ? "atualizada" : "criada"}`,
    );
  } else {
    failCount++;
    console.log(`❌ ${slug.padEnd(35)} HTTP ${res.status}`);
    console.log("   →", JSON.stringify(parsed).slice(0, 400));
  }
}

console.log(`\n${okCount} ok, ${failCount} falhas (de ${targets.length})`);
process.exit(failCount === 0 ? 0 : 1);