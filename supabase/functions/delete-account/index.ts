import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 🔁 EXTERNAL DB: ItaSuper mantém perfis/pedidos no Supabase EXTERNO
    // (qkjhguziuchqsbxzruea). Exclusão de conta deve rodar contra o externo
    // para cumprir LGPD Art. 18 (direito de eliminação).
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")
      || Deno.env.get("SUPABASE_ANON_KEY")
      || serviceKey;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    // Verifica o token contra o mesmo projeto externo. getUser(token) valida
    // a assinatura JWT independente da chave usada no client.
    const userClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) throw new Error("Não autorizado");

    const ReasonSchema = z.object({
      reason: z.string().max(500).optional().default("Solicitação do usuário"),
    });
    const parsed = ReasonSchema.safeParse(await req.json().catch(() => ({})));
    const reason = parsed.success ? parsed.data.reason : "Solicitação do usuário";
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Perfil não encontrado");

    // Check for active orders
    const { data: activeOrders } = await adminClient
      .from("orders")
      .select("id")
      .eq("client_id", user.id)
      .not("status", "in", '("finalizado","cancelado","entregue")')
      .limit(1);

    if (activeOrders && activeOrders.length > 0) {
      throw new Error("Você possui pedidos ativos. Finalize-os antes de excluir a conta.");
    }

    // Check if user is store owner with active orders
    const { data: ownedStores } = await adminClient
      .from("stores")
      .select("id")
      .eq("owner_id", user.id);

    if (ownedStores && ownedStores.length > 0) {
      const storeIds = ownedStores.map(s => s.id);
      const { data: storeActiveOrders } = await adminClient
        .from("orders")
        .select("id")
        .in("store_id", storeIds)
        .not("status", "in", '("finalizado","cancelado","entregue")')
        .limit(1);

      if (storeActiveOrders && storeActiveOrders.length > 0) {
        throw new Error("Suas lojas possuem pedidos ativos. Finalize-os antes de excluir a conta.");
      }
    }

    // Get order stats for archive
    const { count: orderCount } = await adminClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id);

    const { data: orderTotals } = await adminClient
      .from("orders")
      .select("total_price")
      .eq("client_id", user.id)
      .in("status", ["finalizado", "entregue"]);

    const totalSpent = (orderTotals || []).reduce((sum, o) => sum + (o.total_price || 0), 0);

    // Get terms acceptance
    const { data: termsData } = await adminClient
      .from("terms_acceptance")
      .select("*")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(5);

    // Archive account data
    await adminClient.from("archived_accounts").insert({
      original_user_id: user.id,
      full_name: profile.full_name,
      email: profile.email || user.email,
      document: profile.document,
      phone: profile.phone,
      whatsapp_number: profile.whatsapp_number,
      role: profile.role,
      city: profile.city,
      neighborhood: profile.neighborhood,
      pix_key: profile.pix_key,
      pix_type: profile.pix_type,
      cep: profile.cep,
      street: profile.street,
      address_number: profile.number,
      terms_accepted_at: profile.terms_accepted_at,
      account_created_at: profile.created_at,
      deletion_reason: reason || "user_request",
      order_count: orderCount || 0,
      total_spent: totalSpent,
      metadata: {
        terms_acceptance_history: termsData || [],
        stores_owned: ownedStores?.map(s => s.id) || [],
      },
    });

    // Anonymize profile (keep for order references but remove PII)
    await adminClient.from("profiles").update({
      full_name: "Conta Excluída",
      email: null,
      document: null,
      phone: null,
      whatsapp_number: null,
      pix_key: null,
      pix_type: null,
      cep: null,
      street: null,
      number: null,
      complement: null,
      reference_point: null,
      avatar_url: null,
      cnh_number: null,
      cnh_front_url: null,
      cnh_back_url: null,
      selfie_url: null,
      deleted_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Delete saved addresses
    await adminClient.from("saved_addresses").delete().eq("user_id", user.id);

    // Delete FCM tokens
    await adminClient.from("fcm_tokens").delete().eq("user_id", user.id);

    // Delete OneSignal players
    await adminClient.from("onesignal_players").delete().eq("user_id", user.id);

    // Delete the auth user (this logs them out)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      // Don't throw - data is already archived
    }

    return new Response(
      JSON.stringify({ success: true, message: "Conta excluída com sucesso. Seus dados serão mantidos conforme exigências legais." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("delete-account error:", error);
    const safeMessages = [
      "Não autorizado",
      "Perfil não encontrado",
      "Você possui pedidos ativos. Finalize-os antes de excluir a conta.",
      "Suas lojas possuem pedidos ativos. Finalize-os antes de excluir a conta.",
    ];
    const msg = safeMessages.includes(error.message) ? error.message : "Erro ao excluir conta";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
