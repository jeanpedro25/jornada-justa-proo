import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanoCheckout = 'pro' | 'anual';

export interface CheckoutResult {
  init_point: string | null;
  sandbox_init_point?: string | null;
  error?: string;
}

/**
 * Cria preferência Checkout Pro no Mercado Pago (Edge Function) e retorna URL de redirecionamento.
 */
export async function iniciarCheckoutMercadoPago(
  supabase: SupabaseClient,
  plano: PlanoCheckout,
  user: User,
  profile: { nome?: string | null } | null,
): Promise<CheckoutResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      plano,
      user_id: user.id,
      user_email: user.email ?? '',
      user_nome: profile?.nome?.trim() || user.email || 'Usuário',
    },
    headers,
  });

  if (error) {
    return { init_point: null, error: error.message };
  }
  const payload = data as { init_point?: string; sandbox_init_point?: string; error?: string } | null;
  if (payload?.error) {
    return { init_point: null, error: payload.error };
  }
  const url = payload?.init_point || payload?.sandbox_init_point || null;
  return {
    init_point: url,
    sandbox_init_point: payload?.sandbox_init_point ?? null,
  };
}
