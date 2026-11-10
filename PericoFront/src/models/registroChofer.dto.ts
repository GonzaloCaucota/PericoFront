export interface RegistroChoferDTO {
  // datos del usuario
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  telefono: string;
  activo?: boolean;
  // datos del chofer
  licenciaConducir: string;
  fechaHabilitacion: string;
  estadoChofer?: 'DISPONIBLE' | 'EN_VIAJE' | 'DESCANSO' | 'SUSPENDIDO' | 'INACTIVO' | 'ELIMINADO';
  calificacion?: number;
  
}