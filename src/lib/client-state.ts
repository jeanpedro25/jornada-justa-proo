import { queryClient } from '@/lib/query-client';

const TRANSIENT_LOCAL_STORAGE_KEYS = ['hj_entrada_ts', 'hj_registro_id'];

export async function clearTransientClientState() {
  TRANSIENT_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  queryClient.clear();
}

export async function clearAllClientState() {
  queryClient.clear();

  try {
    sessionStorage.clear();
    localStorage.clear();

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.error('Erro ao limpar estado local do app', error);
  }
}