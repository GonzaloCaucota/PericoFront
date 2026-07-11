export interface RegistroAdminDTO {
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  telefono: string;
  activo?: boolean;
  estadoAdmin?: 'ACTIVO' | 'SUSPENDIDO' | 'INACTIVO' | 'ELIMINADO';
}
