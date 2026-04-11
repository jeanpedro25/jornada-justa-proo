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

    const { plano, user_email, user_nome } = await req.json();
    const user_id = user.id;

    const token = Deno.env.get("MP_ACCESS_TOKEN");
    if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
    const PRICES: Record<string, number> = { pro: 9.90, anual: 89.90 };
    const TITLES: Record<string, string> = {
      pro: "Hora Justa PRO Mensal",
      anual: "Hora Justa PRO Anual",
    };
    if (!plano || PRICES[plano] == null) throw new Error("Plano inválido");
    const preference = {
      items: [
        {
          id: "hora-justa-" + plano,
          title: TITLES[plano],
          quantity: 1,
          currency_id: "BRL",
          unit_price: PRICES[plano],
        },
      ],
      payer: { email: user_email ?? user.email ?? "", name: user_nome || user_email || user.email || "Usuario" },
      external_reference: `${user_id}|${plano}|${Date.now()}`,
      statement_descriptor: "HORA JUSTA",
    };
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) throw new Error(data?.message || JSON.stringify(data));
    return new Response(JSON.stringify({ id: data.id, init_point: data.init_point }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
