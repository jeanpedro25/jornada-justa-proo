import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { plano, user_id, user_email, user_nome } = await req.json();

    const token = Deno.env.get("MP_ACCESS_TOKEN");
    if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");

    const PRICES: Record<string, number> = { pro: 9.90, anual: 89.90 };
    const TITLES: Record<string, string> = {
      pro: "Hora Justa PRO Mensal",
      anual: "Hora Justa PRO Anual",
    };

    if (!PRICES[plano]) throw new Error("Plano inválido: " + plano);

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
      payer: {
        email: user_email,
        name: user_nome || user_email,
      },
      external_reference: `${user_id}|${plano}|${Date.now()}`,
      statement_descriptor: "HORA JUSTA",
      // Sem auto_return e sem back_urls para evitar erro de validação do MP
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP Error:", JSON.stringify(data));
      throw new Error(data?.message || data?.cause?.[0]?.description || JSON.stringify(data));
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      }),
      {
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Erro create-payment:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
});
