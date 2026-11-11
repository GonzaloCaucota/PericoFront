const fs = require('node:fs');
const path = require('node:path');
const hosting = process.env.RENDER === 'true' || process.env.NETLIFY === 'true';
if (hosting && !process.env.API_URL) throw new Error('Definir API_URL del backend antes de compilar en el hosting');
const rawUrl = process.env.API_URL || 'http://localhost:3000';
const url = new URL(rawUrl);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  throw new Error('API_URL debe ser el origen del backend, sin ruta, credenciales ni parametros');
}
if ((process.env.NODE_ENV === 'production' || hosting) && url.protocol !== 'https:') throw new Error('API_URL debe usar HTTPS en produccion');
const config = { apiUrl: url.origin, googleClientId: process.env.GOOGLE_CLIENT_ID || '' };
fs.writeFileSync(path.join(__dirname, '../public/app-config.js'), `window.__TAXI_CONFIG__ = ${JSON.stringify(config)};\n`);
console.log('Configuracion publica del frontend generada');
