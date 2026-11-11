const express = require('express');
const cors = require('cors');
const sequelize = require('./src/models/relaciones').sequelize;
require('dotenv').config({ quiet: true }); 
const http = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger_output.json');

const app = express();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  if (!process.env.FRONTEND_URL || new URL(frontendUrl).protocol !== 'https:') throw new Error('FRONTEND_URL debe ser la URL HTTPS del frontend');
}
const allowedOrigin = new URL(frontendUrl).origin;

// Express maneja las rutas HTTP y Socket.IO comparte el mismo servidor para eventos en tiempo real.
const server = http.createServer(app); // crear un servidor http envolviendo a express

// Inicializacion de SOCKET.IO con cors permitido para frontend
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const eventos = require('./src/services/realtime')(io);

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// Permite que los controladores puedan emitir eventos sin importar desde que ruta se ejecuten.
app.use((req, res, next) => {
  req.io = eventos;
  next();
});

app.set('port', process.env.PORT || 3000);

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/admins', require('./src/routes/admin.routes'));
app.use('/api/pasajeros', require('./src/routes/pasajero.routes'));
app.use('/api/choferes', require('./src/routes/chofer.routes'));
app.use('/api/autos', require('./src/routes/auto.routes'));
app.use('/api/turnos', require('./src/routes/turnoChofer.routes'));
app.use('/api/recorridos', require('./src/routes/recorrido.routes'));
app.use('/api/viajes', require('./src/routes/viaje.routes'));
app.use('/api/reservas', require('./src/routes/reserva.routes'));
app.use('/api/usuarios', require('./src/routes/usuario.routes'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Socket.IO se usa para sincronizar pantallas: reservas, pagos, asientos, estados de viaje y ubicacion.
io.on('connection', (socket) => {
  console.log(`[SOCKET] Dispositivo conectado en vivo. ID: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log('[SOCKET] Dispositivo desconectado.');
  });
});

// La estructura se administra con db:migrate, nunca con sync al arrancar.
async function start() {
  await sequelize.authenticate();
  await require('./db/check')(sequelize);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(app.get('port'), '0.0.0.0', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  console.log(`Servidor escuchando en el puerto ${app.get('port')}`);
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  io.disconnectSockets(true);
  await new Promise(resolve => io.close(resolve));
  await sequelize.close();
}

if (require.main === module) {
  start().catch(async error => {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exitCode = 1;
    await shutdown();
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      shutdown().catch(() => { process.exitCode = 1; });
    });
  }
}

module.exports = { app, server, start, shutdown };
