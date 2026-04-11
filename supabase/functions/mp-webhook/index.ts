import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseXSignature(xSignature: string | null): { ts: string; v1: string } | null {
  if (!xSignature) return null;
  const parts = xSignature.split(",").map(p => p.trim());
  const tsPart = parts.find(p => p.startsWith("ts="));
  const v1Part = parts.find(p => p.startsWith("v1="));
  if (!tsPart || !v1Part) return null;
  const ts = tsPart.split("=")[1];
  const v1 = v1Part.split("=")[1];
  if (!ts || !v1) return null;
  return { ts, v1 };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
    const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") || "";
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

    // Validação de origem (x-signature) — recomendado pelo Mercado Pago
    // Manifest: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
    // Como aqui o paymentId vem do body, usamos o mesmo id para compor o manifest.
    if (MP_WEBHOOK_SECRET) {
      const xRequestId = req.headers.get("x-request-id");
      const sig = parseXSignature(req.headers.get("x-signature"));
      if (!xRequestId || !sig) {
        return new Response("missing signature headers", { status: 401, headers: corsHeaders });
      }
      const manifest = `id:${paymentId};request-id:${xRequestId};ts:${sig.ts};`;
      const computed = await hmacSha256Hex(MP_WEBHOOK_SECRET, manifest);
      if (computed !== sig.v1) {
        console.error("Invalid MP signature", { paymentId, xRequestId, computed, v1: sig.v1 });
        return new Response("invalid signature", { status: 401, headers: corsHeaders });
      }
    } else {
      // Se não estiver configurado, segue sem validação (ambiente dev); em produção, configure MP_WEBHOOK_SECRET.
      console.warn("MP_WEBHOOK_SECRET not set; skipping signature validation");
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
        is_pro: true,
        subscription_status: "active",
      } as Record<string, unknown>)
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
