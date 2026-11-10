// swagger.js
// Genera swagger_output.json leyendo las anotaciones #swagger.* de los controladores.
// Se ejecuta UNA VEZ (node swagger.js) cada vez que agregues/cambies endpoints.
const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'API PericoBack',
    description: 'Documentación de la API REST para la gestión de viajes, choferes, pasajeros, autos y reservas.',
  },
  host: 'localhost:3000',
  basePath: '/',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],

  // Define el candado de "Authorize" en Swagger UI para mandar el JWT.
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: "Ingresar como: Bearer {token}",
    },
  },

  tags: [
    { name: 'Usuarios', description: 'Login y listado general de usuarios.' },
    { name: 'Admins', description: 'Gestión de administradores y dashboard.' },
    { name: 'Pasajeros', description: 'Gestión de pasajeros.' },
    { name: 'Choferes', description: 'Gestión de choferes.' },
    { name: 'Autos', description: 'Gestión de la flota de autos.' },
    { name: 'Turnos', description: 'Asignación de turnos chofer-auto.' },
    { name: 'Viajes', description: 'Gestión de viajes.' },
    { name: 'Reservas', description: 'Gestión de reservas y pagos en efectivo.' },
  ],

  // Modelos de datos reutilizables (equivalente a "definitions" del PDF).
  definitions: {
    Usuario: {
      idUsuario: 11,
      nombre: 'Lucas',
      apellido: 'Cari',
      email: 'administrador@test.com',
      telefono: '3881234569',
      activo: true,
      rol: 'ADMIN',
    },
    LoginRequest: {
      email: 'administrador@test.com',
      password: '123456',
    },
    Pasajero: {
      idPasajero: 1,
      idUsuario: 1,
      calificacion: 4.5,
      cantidadReservas: 3,
      estadoPasajero: 'ACTIVO',
      latitud: -24.1858,
      longitud: -65.2995,
    },
    Chofer: {
      idChofer: 1,
      idUsuario: 2,
      licenciaConducir: 'ABC123456',
      estadoChofer: 'DISPONIBLE',
      fechaHabilitacion: '2024-01-15',
      calificacion: 4.8,
    },
    Admin: {
      idAdmin: 1,
      idUsuario: 3,
      estadoAdmin: 'ACTIVO',
    },
    Auto: {
      idAuto: 1,
      patente: 'AB123CD',
      marca: 'Toyota',
      modelo: 'Etios',
      capacidadAsientos: 4,
      estado: 'DISPONIBLE',
    },
    TurnoChofer: {
      idTurnoChofer: 1,
      idChofer: 1,
      idAuto: 1,
      fecha: '2026-07-10',
      horaInicio: '08:00:00',
      horaFin: '14:00:00',
    },
    Viaje: {
      idViaje: 1,
      origen: 'San Salvador de Jujuy',
      destino: 'Perico',
      fechaSalida: '2026-07-10',
      horaSalida: '09:30:00',
      tarifaPorAsiento: 1500.0,
      asientosDisponibles: 4,
      estadoViaje: 'ABIERTO',
      idChofer: 1,
      idAuto: 1,
    },
    Reserva: {
      idReserva: 1,
      idPasajero: 1,
      idViaje: 1,
      cantidadAsientos: 2,
      importeTotal: 3000.0,
      estadoReserva: 'PENDIENTE',
      estadoPago: 'PENDIENTE',
    },
  },
};

const outputFile = './swagger_output.json';
// Todas las rutas: swagger-autogen recorre estos archivos siguiendo los require()
// hacia los controladores para encontrar las anotaciones #swagger.
const endpointsFiles = ['./index.js'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log(`Documentación generada en ${outputFile}`);
});
