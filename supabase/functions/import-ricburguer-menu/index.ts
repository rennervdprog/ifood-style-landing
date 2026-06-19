// One-off importer: cardápio completo da loja `ricburguer` no Supabase EXTERNO.
// Idempotente: pula seções/produtos que já existem com o mesmo nome.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${EXT_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  let d: unknown = t;
  try { d = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`REST ${path} ${r.status}: ${t}`);
  return d;
}

type Prod = { name: string; price: number; description?: string; addonGroups?: string[] };
type Section = { name: string; sort: number; products: Prod[] };

// --- Adicionais (grupos compartilhados, product_id=null) ---
const ADDON_GROUPS: Record<string, { min: number; max: number; replaces: boolean; items: { name: string; price: number }[] }> = {
  "Adicionais Burguer": {
    min: 0, max: 10, replaces: false,
    items: [
      { name: "Banana", price: 3 },
      { name: "Ovo", price: 5 },
      { name: "Presunto", price: 5 },
      { name: "Queijo", price: 5 },
      { name: "Cream Cheese", price: 5 },
      { name: "Calabresa", price: 5 },
      { name: "Bacon", price: 7.5 },
      { name: "Carne", price: 8.5 },
      { name: "Frango", price: 8.5 },
      { name: "Hambúrguer Picanha", price: 11 },
      { name: "Sachê de Maionese", price: 3 },
    ],
  },
  "Adicionais Anéis": {
    min: 0, max: 10, replaces: false,
    items: [
      { name: "Anel de Cebola", price: 4 },
      { name: "Frango Empanado", price: 11 },
    ],
  },
  "Adicionais Suco/Vitamina": {
    min: 0, max: 2, replaces: false,
    items: [
      { name: "Leite", price: 2.5 },
      { name: "Embalagem para viagem", price: 1 },
    ],
  },
  "Adicional Açaí": {
    min: 0, max: 1, replaces: false,
    items: [{ name: "Granola", price: 2 }],
  },
  "Sabor do Suco Natural": {
    min: 1, max: 1, replaces: false,
    items: [
      "Abacaxi","Acerola","Framboesa","Graviola","Uva","Laranja","Manga","Maracujá","Pêssego","Tamarindo","Abacaxi com Hortelã",
    ].map(n => ({ name: n, price: 0 })),
  },
  "Sabor do Suco Especial": {
    min: 1, max: 1, replaces: false,
    items: [
      "Açaí c/ Banana e Aveia",
      "Açaí c/ Abacaxi",
      "Açaí c/ Manga",
      "Açaí c/ Maracujá",
      "Clorofila c/ Abacaxi",
      "Clorofila c/ Laranja",
    ].map(n => ({ name: n, price: 0 })),
  },
  "Sabor da Vitamina": {
    min: 1, max: 1, replaces: false,
    items: [
      "Banana c/ Aveia",
      "Morango c/ Maracujá ao Leite",
      "Issa Mon (Abacaxi c/ Maracujá ao Leite)",
      "Maracujá ao Leite",
      "Morango c/ Banana e Aveia",
      "Framboesa ao Leite",
      "Cupuaçu c/ Banana e Leite",
      "Framboesa c/ Maracujá ao Leite",
    ].map(n => ({ name: n, price: 0 })),
  },
  "Tamanho do Açaí": {
    min: 1, max: 1, replaces: true,
    items: [
      { name: "300ml", price: 10 },
      { name: "500ml", price: 12 },
      { name: "700ml", price: 18 },
    ],
  },
  "Tamanho do Açaí Mix": {
    min: 1, max: 1, replaces: true,
    items: [
      { name: "300ml", price: 11.5 },
      { name: "500ml", price: 13.5 },
      { name: "700ml", price: 19.5 },
    ],
  },
  "Sabor do Sorvete (Açaí Mix)": {
    min: 1, max: 1, replaces: false,
    items: [
      { name: "Chocolate", price: 0 },
      { name: "Morango", price: 0 },
      { name: "Creme", price: 0 },
      { name: "Flocos", price: 0 },
    ],
  },
};

const BURGUER_ADDONS = ["Adicionais Burguer"];

const SECTIONS: Section[] = [
  {
    name: "Sanduíches",
    sort: 1,
    products: [
      { name: "1. Ric Cheeseburguer", price: 15, description: "Carne, cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "2. Duplo Ric", price: 20, description: "2 carnes, 2 cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "3. Tri Ric", price: 23, description: "3 carnes, 3 cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "4. Ric Filé de Sobrecoxa", price: 19.5, description: "Filé sobrecoxa em tiras, cream cheese, bacon, cebola frita, barbecue, cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "5. Ric Filé Mignon", price: 24, description: "Filé mignon em tiras, cream cheese, bacon, cebola frita, barbecue, cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "6. Ric Eggx Bacon", price: 18.5, description: "Carne, cheddar, ovo, bacon e alface", addonGroups: BURGUER_ADDONS },
      { name: "7. Ric Frango", price: 15, description: "Hambúrguer de frango, cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "8. Ric Bresa", price: 16, description: "Calabresa, 2 cheddar, cebola frita, molho shoyu, molho especial e alface", addonGroups: BURGUER_ADDONS },
      { name: "9. Ric Eggx Frango Bacon", price: 18.5, description: "Hambúrguer de frango, cheddar, ovo, bacon e alface", addonGroups: BURGUER_ADDONS },
      { name: "10. Ric Caribe", price: 20, description: "2 carnes, cheddar, calabresa, banana e alface", addonGroups: BURGUER_ADDONS },
      { name: "11. Ric Tudão", price: 23, description: "2 carnes, 2 ovos, cheddar, bacon, presunto e alface", addonGroups: BURGUER_ADDONS },
      { name: "12. Ric Star", price: 21, description: "Frango empanado, anéis de cebola empanados, cheddar, alface, bacon e cream cheese", addonGroups: BURGUER_ADDONS },
      { name: "13. Ric Gigante", price: 31, description: "2 carnes, 1 hambúrguer de frango, 2 cheddar, 2 ovos, 2 bacons, 2 presuntos e alface", addonGroups: BURGUER_ADDONS },
      { name: "14. Ric Cheeseburguer Picanha", price: 19, description: "Hambúrguer de picanha, cheddar e alface", addonGroups: BURGUER_ADDONS },
      { name: "15. Ric Eggx Bacon Picanha", price: 25, description: "Hambúrguer de picanha, cheddar, ovo, bacon e alface", addonGroups: BURGUER_ADDONS },
      { name: "17. Ric Tudão Picanha", price: 36, description: "2 hambúrgueres de picanha, 2 ovos, cheddar, bacon, presunto e alface", addonGroups: BURGUER_ADDONS },
      { name: "18. A Torre Maior", price: 46, description: "2 hambúrgueres de picanha, 1 hambúrguer de frango, 2 carnes, 3 cheddar, 3 bacons, 3 ovos, 3 presuntos e alface", addonGroups: BURGUER_ADDONS },
      { name: "19. Salada de Atum", price: 15, description: "Pão de forma light torrado, pasta de atum e alface" },
      { name: "25. Arranha Céu", price: 62, description: "3 hambúrgueres de picanha, 2 carnes, 2 hambúrgueres de frango, 4 cheddar, 3 bacons, 3 presuntos, 3 ovos e alface", addonGroups: BURGUER_ADDONS },
    ],
  },
  {
    name: "Acompanhamentos",
    sort: 2,
    products: [
      { name: "Fritas (200g)", price: 15, description: "Porção de batata frita 200g" },
      { name: "Anéis de Cebola Empanados (8 un)", price: 10, description: "8 unidades de anéis de cebola empanados", addonGroups: ["Adicionais Anéis"] },
    ],
  },
  {
    name: "Lanches Kids",
    sort: 3,
    products: [
      { name: "Nuggets", price: 15, description: "5 unidades de nuggets" },
      { name: "Nuggets e Fritas", price: 20, description: "5 unidades de nuggets + fritas pequena (100g)" },
    ],
  },
  {
    name: "Sucos (400ml)",
    sort: 4,
    products: [
      { name: "Suco Natural 400ml", price: 10, description: "Já vem adoçado. Sabores: Abacaxi, Acerola, Framboesa, Graviola, Uva, Laranja, Manga, Maracujá, Pêssego, Tamarindo, Abacaxi com Hortelã.", addonGroups: ["Sabor do Suco Natural", "Adicionais Suco/Vitamina"] },
      { name: "Suco Especial 400ml", price: 11, description: "Açaí c/ Banana e Aveia, Açaí c/ Abacaxi/Manga/Maracujá ou Clorofila c/ Abacaxi/Laranja.", addonGroups: ["Sabor do Suco Especial", "Adicionais Suco/Vitamina"] },
    ],
  },
  {
    name: "Vitaminas",
    sort: 5,
    products: [
      { name: "Vitamina 400ml", price: 11, description: "Sabores: Banana c/ Aveia, Morango c/ Maracujá ao Leite, Issa Mon, Maracujá ao Leite, Morango c/ Banana e Aveia, Framboesa ao Leite, Cupuaçu c/ Banana e Leite, Framboesa c/ Maracujá ao Leite.", addonGroups: ["Sabor da Vitamina", "Adicionais Suco/Vitamina"] },
      { name: "Morango ao Leite 400ml", price: 13, description: "Vitamina de morango ao leite.", addonGroups: ["Adicionais Suco/Vitamina"] },
      { name: "Vitamina Explosiva 500ml", price: 16, description: "Açaí, cupuaçu, arrebite, guaraná em pó, leite e açúcar.", addonGroups: ["Adicionais Suco/Vitamina"] },
    ],
  },
  {
    name: "Bebidas",
    sort: 6,
    products: [
      { name: "Refrigerante (lata)", price: 8, description: "Refrigerante em lata 350ml" },
      { name: "Coca-Cola 2L", price: 18 },
      { name: "Guaraná Antarctica 2L", price: 17 },
      { name: "Guaraviton / Limoneto", price: 8 },
      { name: "Água s/ gás 500ml", price: 3.5 },
      { name: "Água c/ gás 500ml", price: 4 },
    ],
  },
  {
    name: "Açaí",
    sort: 7,
    products: [
      { name: "Açaí", price: 10, description: "Todos os tamanhos acompanham granola. Escolha o tamanho.", addonGroups: ["Tamanho do Açaí", "Adicional Açaí"] },
      { name: "Açaí Mix", price: 11.5, description: "Açaí + sorvete + leite em pó. Escolha tamanho e sabor do sorvete.", addonGroups: ["Tamanho do Açaí Mix", "Sabor do Sorvete (Açaí Mix)", "Adicional Açaí"] },
    ],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const stores = await rest(`stores?slug=eq.ricburguer&select=id,name`) as Array<{ id: string; name: string }>;
    if (!stores.length) return json({ error: "Loja ricburguer não encontrada" }, 404);
    const storeId = stores[0].id;

    const log: string[] = [`Loja: ${stores[0].name} (${storeId})`];

    // 1) Cria/recupera addon_groups compartilhados (product_id IS NULL)
    const groupIdByName: Record<string, string> = {};
    for (const [gname, g] of Object.entries(ADDON_GROUPS)) {
      const existing = await rest(
        `addon_groups?store_id=eq.${storeId}&product_id=is.null&name=eq.${encodeURIComponent(gname)}&select=id`
      ) as Array<{ id: string }>;
      let gid: string;
      if (existing.length) {
        gid = existing[0].id;
        log.push(`addon_group existente: ${gname}`);
      } else {
        const created = await rest(`addon_groups`, {
          method: "POST",
          body: JSON.stringify({
            store_id: storeId, product_id: null, name: gname,
            min_select: g.min, max_select: g.max, price_replaces_base: g.replaces, sort_order: 0,
          }),
        }) as Array<{ id: string }>;
        gid = created[0].id;
        log.push(`addon_group criado: ${gname}`);
        // items
        let so = 0;
        for (const it of g.items) {
          await rest(`addon_items`, {
            method: "POST",
            body: JSON.stringify({ group_id: gid, name: it.name, price: it.price, sort_order: so++ }),
          });
        }
      }
      groupIdByName[gname] = gid;
    }

    // 2) Cria/recupera seções e produtos
    let created = 0, skipped = 0;
    for (const sec of SECTIONS) {
      const existSec = await rest(
        `menu_sections?store_id=eq.${storeId}&name=eq.${encodeURIComponent(sec.name)}&select=id`
      ) as Array<{ id: string }>;
      let secId: string;
      if (existSec.length) {
        secId = existSec[0].id;
      } else {
        const c = await rest(`menu_sections`, {
          method: "POST",
          body: JSON.stringify({ store_id: storeId, name: sec.name, sort_order: sec.sort }),
        }) as Array<{ id: string }>;
        secId = c[0].id;
      }

      for (const p of sec.products) {
        const existP = await rest(
          `products?store_id=eq.${storeId}&name=eq.${encodeURIComponent(p.name)}&select=id`
        ) as Array<{ id: string }>;
        if (existP.length) { skipped++; continue; }
        const cp = await rest(`products`, {
          method: "POST",
          body: JSON.stringify({
            store_id: storeId, section_id: secId,
            name: p.name, price: p.price, description: p.description ?? null,
            is_available: true,
          }),
        }) as Array<{ id: string }>;
        const pid = cp[0].id;
        created++;
        // vincula addon groups
        for (const gname of p.addonGroups || []) {
          const gid = groupIdByName[gname];
          if (!gid) continue;
          await rest(`product_addon_groups`, {
            method: "POST",
            body: JSON.stringify({ product_id: pid, addon_group_id: gid }),
          });
        }
      }
    }

    return json({ ok: true, store_id: storeId, produtos_criados: created, produtos_pulados: skipped, log });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});