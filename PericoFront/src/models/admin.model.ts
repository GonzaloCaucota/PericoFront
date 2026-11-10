import type { Usuario } from './usuario.model';

export interface Admin {
  idAdmin: number;
  idUsuario: number;
  estadoAdmin: 'ACTIVO' | 'SUSPENDIDO' | 'INACTIVO' | 'ELIMINADO';
  createdAt?: string;
  updatedAt?: string;
  usuario?: Usuario;
}

export type CrearAdminDTO = Omit<Admin, 'idAdmin' | 'createdAt' | 'updatedAt' | 'usuario'>;