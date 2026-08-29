import type { Bootstrap, SupportTicket, SupportTicketDetail } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? '';

let token = sessionStorage.getItem('ci360-token');
localStorage.removeItem('ci360-token');

export const getToken = () => token;

export const setToken = (value: string | null) => {
  token = value;
  if (value) sessionStorage.setItem('ci360-token', value);
  else sessionStorage.removeItem('ci360-token');
  localStorage.removeItem('ci360-token');
};

async function parseError(response: Response) {
  const data = await response.json().catch(() => ({}));
  return data.error?.message || data.error || 'Request failed';
}

async function refreshAccessToken() {
  const response = await fetch(API_URL + '/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    setToken(null);
    throw new Error(await parseError(response));
  }
  const data = await response.json();
  setToken(data.token);
  return data;
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body != null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(API_URL + path, { ...options, credentials: 'include', headers });
  if (response.status === 401 && allowRefresh && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    await refreshAccessToken();
    return request<T>(path, options, false);
  }
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
}

async function download(path: string, fileName: string) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(API_URL + path, { credentials: 'include', headers });
  if (response.status === 401) {
    await refreshAccessToken();
    return download(path, fileName);
  }
  if (!response.ok) throw new Error(await parseError(response));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: async (id: string, password: string) => {
    const data = await request<{ token: string; user: any }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ id, password }) },
      false,
    );
    setToken(data.token);
    return data;
  },
  refreshAuth: refreshAccessToken,
  logout: async () => {
    await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
  },
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  createJob: (data: any) => request('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id: string, data: any) => request(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  saveSettings: (data: any) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  createClient: (data: any) => request('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: any) => request(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createSupportTicket: (data: any) => {
    const form = new FormData();
    form.set('subject', data.subject);
    form.set('category', data.category);
    form.set('priority', data.priority);
    form.set('description', data.description);
    if (data.attachment) form.set('attachment', data.attachment);
    return request<{ ticket: SupportTicket }>('/api/support-tickets', { method: 'POST', body: form });
  },
  getSupportTicket: (ticketNumber: string) => request<{ ticket: SupportTicketDetail }>(`/api/support-tickets/${ticketNumber}`),
  replySupportTicket: (ticketNumber: string, body: string) =>
    request<{ ticket: SupportTicketDetail }>(`/api/support-tickets/${ticketNumber}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  updateSupportTicket: (ticketNumber: string, data: any) =>
    request<{ ticket: SupportTicketDetail }>(`/api/support-tickets/${ticketNumber}`, { method: 'PATCH', body: JSON.stringify(data) }),
  downloadTicketAttachment: (ticketNumber: string, attachmentId: string, fileName: string) =>
    download(`/api/support-tickets/${ticketNumber}/attachments/${attachmentId}`, fileName),
};
