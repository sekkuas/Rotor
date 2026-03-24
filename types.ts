
export enum UserRole {
  ADMIN = 'Administrador',
  SUPERVISOR = 'Supervisor',
  OPERATOR = 'Operador'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export interface Vehicle {
  id?: string; // Optional because new records might not have it yet locally
  unitNumber: string;
  licensePlate: string;
  year: number;
  make: string;
  model: string;
  class: string;
  color: string;
  vin: string;
  location: string;
  odometer: number;
  product: string;
  status: string;
  fuelLevel: number;
  // Nuevos campos para ubicación detallada
  patio?: string;
  row?: string;
  spot?: string;
  notes?: string; // Observaciones
  
  // Campos de Cuadre / Auditoría
  ubi_cuadre?: string;
  obs_cuadre?: string;
}

export interface DashboardStats {
  totalFleet: number;
  available: number;
  rented: number;
  reserved: number;
  outOfService: number;
  totalLocations: number;
}
