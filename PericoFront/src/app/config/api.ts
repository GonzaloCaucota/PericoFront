declare global {
  interface Window {
    __TAXI_CONFIG__?: { apiUrl?: string; googleClientId?: string };
  }
}

// Configuracion publica generada durante el build; nunca contiene secretos.
export const API_ORIGIN = new URL(window.__TAXI_CONFIG__?.apiUrl || 'http://localhost:3000').origin;
export const API_URL = `${API_ORIGIN}/api`;
export const GOOGLE_CLIENT_ID = window.__TAXI_CONFIG__?.googleClientId || '';
