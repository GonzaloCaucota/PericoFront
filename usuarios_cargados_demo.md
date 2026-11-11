# Usuarios y Datos Cargados en Producción — TaxiCompartido

- **URL Frontend (Login)**: `https://taxi-compartido-jujuy.netlify.app/login`
- **URL Backend API**: `https://taxi-compartido-api.onrender.com`

---

## 1. Administrador

| ID Usuario | Nombre y Apellido | Email | Contraseña | Rol | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `1` | Gonzalo Caucota | `gonzalo1704@gmail.com` | `Adriangonza1122` | `ADMIN` | Activo |

---

## 2. Choferes Cargados

> **Contraseña común para todos los choferes:** `TaxiJujuy2026`

| ID Chofer | Nombre y Apellido | Email | Contraseña | Teléfono | Licencia | Fecha Habilitación | Estado Operativo | Habilitación | Auto Asignado (Turno) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`1`** | Carlos Mamani | `carlos.mamani@taxijujuy.com` | `TaxiJujuy2026` | `3884101122` | `D1-388101` | `2026-01-15` | `DISPONIBLE` | `APROBADO` | Toyota Etios Sedan (`AE412JK`) |
| **`2`** | Sofía Tolaba | `sofia.tolaba@taxijujuy.com` | `TaxiJujuy2026` | `3884202233` | `D1-388202` | `2026-02-10` | `DISPONIBLE` | `APROBADO` | Fiat Cronos Drive (`AF839LM`) |
| **`3`** | Diego Quispe | `diego.quispe@taxijujuy.com` | `TaxiJujuy2026` | `3884303344` | `D1-388303` | `2026-03-05` | `DISPONIBLE` | `APROBADO` | Chevrolet Prisma Joy (`AD205RT`) |
| **`4`** | Martín Vilca | `martin.vilca@taxijujuy.com` | `TaxiJujuy2026` | `3884404455` | `D1-388404` | `2026-06-20` | `INACTIVO` | `PENDIENTE` *(para aprobar en `/admin`)* | Sin auto asignado |

---

## 3. Pasajeros Cargados

> **Contraseña común para todos los pasajeros:** `TaxiJujuy2026`

| ID Pasajero | Nombre y Apellido | Email | Contraseña | Teléfono | Estado | Reserva Inicial Cargada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`1`** | Lucía Flores | `lucia.flores@gmail.com` | `TaxiJujuy2026` | `3885112233` | `ACTIVO` | **1 asiento** en Viaje `#1` (*San Salvador de Jujuy → Perico*, `09:00`, `$3.500`) |
| **`2`** | Mateo Castro | `mateo.castro@gmail.com` | `TaxiJujuy2026` | `3885223344` | `ACTIVO` | **2 asientos** en Viaje `#3` (*San Salvador de Jujuy → El Carmen*, `12:00`, `$6.000` total) |

---

## 4. Vehículos y Turnos Asociados

| ID Auto | Patente | Marca y Modelo | Capacidad | Estado | Chofer con Turno (`06:00` a `23:30`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`1`** | `AE412JK` | Toyota Etios Sedan | 4 asientos | `DISPONIBLE` | Carlos Mamani (`idChofer: 1`) |
| **`2`** | `AF839LM` | Fiat Cronos Drive | 4 asientos | `DISPONIBLE` | Sofía Tolaba (`idChofer: 2`) |
| **`3`** | `AD205RT` | Chevrolet Prisma Joy | 4 asientos | `DISPONIBLE` | Diego Quispe (`idChofer: 3`) |

---

## 5. Viajes Abiertos Cargados

| ID Viaje | Recorrido | Salida | Tarifa por Asiento | Asientos Libres | Chofer | Vehículo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`#1`** | San Salvador de Jujuy → Perico | `09:00:00` | `$3.500` | **3 / 4** *(1 reservado por Lucía Flores)* | Carlos Mamani | Toyota Etios (`AE412JK`) |
| **`#2`** | Perico → San Salvador de Jujuy | `10:30:00` | `$3.500` | **4 / 4** | Sofía Tolaba | Fiat Cronos (`AF839LM`) |
| **`#3`** | San Salvador de Jujuy → El Carmen | `12:00:00` | `$3.000` | **2 / 4** *(2 reservados por Mateo Castro)* | Diego Quispe | Chevrolet Prisma (`AD205RT`) |
| **`#4`** | El Carmen → San Salvador de Jujuy | `15:30:00` | `$3.000` | **4 / 4** | Carlos Mamani | Toyota Etios (`AE412JK`) |
| **`#5`** | San Salvador de Jujuy → Perico | `18:30:00` | `$3.500` | **4 / 4** | Sofía Tolaba | Fiat Cronos (`AF839LM`) |
| **`#6`** | Perico → San Salvador de Jujuy | `20:30:00` | `$3.500` | **4 / 4** | Diego Quispe | Chevrolet Prisma (`AD205RT`) |
