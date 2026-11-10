export interface Usuario {
  idUsuario: number;
  nombre: string;
  apellido: string;
  email: string;
  passwordHash?: string;
  telefono: string;
  activo: boolean;
  rol: 'PASAJERO' | 'CHOFER' | 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

export type CrearUsuarioDTO = Omit<Usuario, 'idUsuario' | 'createdAt' | 'updatedAt'>;