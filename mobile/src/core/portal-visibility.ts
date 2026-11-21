import { api } from './api';

// Ürünlerin müşteri portalında görünürlüğü (tekli ve toplu). Ürüne atanmış müşteri kısıtlamaları korunur.
export function setPortalVisibility(ids: string[], visible: boolean) {
  return api<{ updated: number; visible: boolean }>('/api/products/portal-visibility', { method: 'POST', body: { ids, visible } });
}
