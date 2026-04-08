import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Mercado Pago envia como form-urlencoded ou JSON
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const { type, data } = body;

    // Só processar eventos de pagamento aprovado
    if (type !== "payment") {
      return new Response("ok", { headers: corsHeaders });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return new Response("missing payment id", { status: 400, headers: corsHeaders });
    }

    // Buscar detalhes do pagamento no MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    const payment = await mpRes.json();
    console.log("Payment data:", JSON.stringify(payment));

    if (payment.status !== "approved") {
      console.log(`Payment ${paymentId} status: ${payment.status} — ignoring`);
      return new Response("not approved", { headers: corsHeaders });
    }

    // external_reference format: "user_id|plano|timestamp"
    const externalRef = payment.external_reference || "";
    const [userId, plano] = externalRef.split("|");

    if (!userId || !plano) {
      console.error("Invalid external_reference:", externalRef);
      return new Response("invalid reference", { status: 400, headers: corsHeaders });
    }

    // Calcular vencimento do plano
    const agora = new Date();
    let vencimento: Date;
    if (plano === "anual") {
      vencimento = new Date(agora.getFullYear() + 1, agora.getMonth(), agora.getDate());
    } else {
      vencimento = new Date(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
    }

    // Atualizar plano do usuário no Supabase
    const { error } = await supabase
      .from("profiles")
      .update({
        plano,
        plano_vencimento: vencimento.toISOString(),
        plano_payment_id: String(paymentId),
      } as any)
      .eq("id", userId);

    if (error) {
      console.error("Supabase update error:", error);
      return new Response("db error", { status: 500, headers: corsHeaders });
    }

    console.log(`✅ Plano ${plano} ativado para user ${userId} até ${vencimento.toISOString()}`);
    return new Response("ok", { headers: corsHeaders });

  } catch (err: any) {
    console.error("mp-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
