import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nao autorizado" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

    // Verificar sessão do usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessao invalida" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseService);

    // Buscar pagamentos do usuário no MP por external_reference
    // O external_reference tem o formato: "user_id|plano|timestamp"
    // Buscamos todos os pagamentos aprovados com esse prefixo
    const searchRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${user.id}|pro&sort=date_created&criteria=desc&range=date_created&begin_date=NOW-1MONTH&end_date=NOW`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
    );
    const searchResAnual = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${user.id}|anual&sort=date_created&criteria=desc&range=date_created&begin_date=NOW-1MONTH&end_date=NOW`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
    );

    const searchData = await searchRes.json();
    const searchDataAnual = await searchResAnual.json();

    const results = [
      ...(searchData?.results || []),
      ...(searchDataAnual?.results || []),
    ];

    // Pegar o mais recente que esteja aprovado
    const approved = results
      .filter((p: any) => p.status === "approved")
      .sort((a: any, b: any) => new Date(b.date_approved).getTime() - new Date(a.date_approved).getTime());

    if (approved.length === 0) {
      return new Response(JSON.stringify({ status: "not_found" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const payment = approved[0];
    const externalRef = payment.external_reference || "";
    const [, plano] = externalRef.split("|");

    if (!plano) {
      return new Response(JSON.stringify({ status: "invalid_reference" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Calcular vencimento
    const agora = new Date();
    let vencimento: Date;
    if (plano === "anual") {
      vencimento = new Date(agora.getFullYear() + 1, agora.getMonth(), agora.getDate());
    } else {
      vencimento = new Date(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
    }

    // Verificar se o plano já está ativo (evitar atualização duplicada)
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("plano_payment_id, is_pro")
      .eq("id", user.id)
      .maybeSingle();

    if (currentProfile?.is_pro && currentProfile?.plano_payment_id === String(payment.id)) {
      return new Response(JSON.stringify({ status: "already_active", plano }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Ativar plano
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plano,
        plano_vencimento: vencimento.toISOString(),
        plano_payment_id: String(payment.id),
        is_pro: true,
        subscription_status: "active",
      } as Record<string, unknown>)
      .eq("id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ status: "db_error", error: updateError.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ verify-payment: Plano ${plano} ativado manualmente para user ${user.id}`);
    return new Response(JSON.stringify({ status: "activated", plano, vencimento: vencimento.toISOString() }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("verify-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
