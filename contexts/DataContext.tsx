import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Vehicle, DashboardStats } from '../types';
import { supabase } from '../lib/supabase';

interface DataContextType {
  vehicles: Vehicle[];
  isLoading: boolean;
  stats: DashboardStats;
  connectionError: string | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<DashboardStats>({
    totalFleet: 0,
    available: 0,
    rented: 0,
    reserved: 0,
    outOfService: 0,
    totalLocations: 0
  });

  const calculateStats = (data: Vehicle[]) => {
    const normalize = (s: string) => s?.toUpperCase().trim() || '';

    const available = data.filter(v => normalize(v.status) === 'DISPONIBLE').length;
    const rented = data.filter(v => normalize(v.status) === 'ALQUILADO').length;
    const reserved = data.filter(v => normalize(v.status) === 'RESERVADO').length;
    
    // Lista explícita de estados para "Fuera de Servicio"
    const outOfServiceStatuses = [
      'CDO', 
      'CHAPISTERIA', 
      'NUEVO EN PREPARACION', 
      'O/S REPARACION', 
      'ESPERA DE PIEZA', 
      'OTROS TALLERES', 
      'PERDIDA', 
      'ROBADO', 
      'PERDIDA TOTAL', 
      'CASO LEGAL', 
      'ESPERA DE PIEZA CHAPISTERIA', 
      'ESPERA DE PIEZA MECANICA', 
      'ORDEN DE REPARACION'
    ];

    const outOfService = data.filter(v => outOfServiceStatuses.includes(normalize(v.status))).length;
    
    const locations = new Set(data.map(v => v.location)).size;

    // Calculamos el total de flota excluyendo los que están en 'SEPARADO-VENTA' o 'SEPARADO - VENTA'
    const activeFleetCount = data.filter(v => {
      const s = normalize(v.status);
      return s !== 'SEPARADO-VENTA' && s !== 'SEPARADO - VENTA';
    }).length;

    setStats({
      totalFleet: activeFleetCount,
      available,
      rented,
      reserved,
      outOfService,
      totalLocations: locations
    });
  };

  const fetchVehicles = async () => {
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Intentamos traer la primera página
      const { data: firstPageData, error: firstError } = await supabase
        .from('vehicles')
        .select('*')
        .range(0, pageSize - 1);

      if (firstError) throw firstError;

      // DETECCION DE RLS (SEGURIDAD)
      if (!firstPageData || firstPageData.length === 0) {
        // Double check count to differentiate between empty table and RLS blocking
        const { count, error: countError } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact', head: true });
          
        if (!countError && count && count > 0) {
           throw new Error("BLOQUEO DE SEGURIDAD (RLS): Datos existentes pero ocultos. Desactiva RLS en Supabase.");
        }
      }

      if (firstPageData && firstPageData.length > 0) {
        allData = [...firstPageData];
        
        if (firstPageData.length === pageSize) {
          page = 1;
          while (hasMore) {
            const from = page * pageSize;
            const to = (page + 1) * pageSize - 1;
            const { data, error } = await supabase.from('vehicles').select('*').range(from, to);
            if (error) throw error;
            if (data && data.length > 0) {
              allData = [...allData, ...data];
              if (data.length < pageSize) hasMore = false;
              else page++;
            } else {
              hasMore = false;
            }
          }
        }
      }

      // Helper para buscar propiedades ignorando mayúsculas/minúsculas y espacios comunes
      const getVal = (item: any, keys: string[]) => {
        for (const key of keys) {
          if (item[key] !== undefined && item[key] !== null) return item[key];
          
          // Intento lowercase
          const lowerKey = key.toLowerCase();
          if (item[lowerKey] !== undefined && item[lowerKey] !== null) return item[lowerKey];
          
          // Intento snake_case normalizado
          const snake = lowerKey.replace(/\s+/g, '_').replace('#', 'number');
          if (item[snake] !== undefined && item[snake] !== null) return item[snake];

          // Intento CSV raw header exacto (con espacios)
          if (item[key] !== undefined) return item[key];
        }
        return undefined;
      };

      // Helper seguro para convertir a string evitando [object Object]
      const safeString = (val: any, defaultVal = ''): string => {
        if (val === null || val === undefined) return defaultVal;
        if (typeof val === 'object') return defaultVal; // Si es objeto/array, devolvemos default para evitar el error visual
        return String(val).trim();
      };

      const mappedVehicles: Vehicle[] = allData.map((v: any) => {
        // Logic for handling "Year Make" combined column if separate columns fail
        let yearVal = Number(getVal(v, ['Year', 'year', 'Year Model']));
        let makeVal = safeString(getVal(v, ['Make', 'make', 'Marca']));
        
        // Fix for parsing Year if it returned NaN or 0 and Make is empty, but we have "Year Make"
        const yearMakeVal = safeString(getVal(v, ['Year Make', 'year_make']));
        if ((!yearVal || !makeVal) && yearMakeVal && yearMakeVal.length > 3) {
           const parts = yearMakeVal.split(' ');
           const possibleYear = parseInt(parts[0]);
           if (!isNaN(possibleYear) && possibleYear > 1900 && possibleYear < 2100) {
              yearVal = possibleYear;
              makeVal = parts.slice(1).join(' ');
           }
        }
        if (!yearVal) yearVal = new Date().getFullYear();

        // Logic for parsing Fuel Level (handles "8/8", "5/8", "Full", etc)
        let fuelRaw = getVal(v, ['Current Fuel Level', 'fuel_level', 'fuelLevel', 'Combustible']);
        let fuelVal = 0;
        
        if (typeof fuelRaw === 'number') {
            fuelVal = fuelRaw;
        } else if (typeof fuelRaw === 'string') {
            if (fuelRaw.includes('/')) {
                const parts = fuelRaw.split('/');
                fuelVal = Number(parts[0]);
            } else {
                const parsed = parseFloat(fuelRaw);
                fuelVal = isNaN(parsed) ? 0 : parsed;
            }
        }

        return {
          id: v.id || Math.random().toString(36).substr(2, 9),
          unitNumber: safeString(getVal(v, ['Unit #', 'unit_number', 'unitNumber', 'Unit']), 'S/N'),
          licensePlate: safeString(getVal(v, ['License #', 'license_plate', 'licensePlate', 'Placa'])),
          year: yearVal,
          make: makeVal,
          model: safeString(getVal(v, ['Model', 'model', 'Modelo'])),
          class: safeString(getVal(v, ['Class', 'class', 'Clase'])),
          color: safeString(getVal(v, ['Color', 'color'])),
          vin: safeString(getVal(v, ['VIN', 'vin', 'chasis'])),
          location: safeString(getVal(v, ['Location', 'location', 'Ubicacion']), 'Sin Asignar'),
          odometer: Number(getVal(v, ['Odometer', 'odometer', 'Kilometraje']) || 0),
          product: safeString(getVal(v, ['Product', 'product', 'Producto'])),
          status: safeString(getVal(v, ['Status', 'status', 'Estado']), 'DISPONIBLE'),
          fuelLevel: fuelVal,
          
          // Mapeo seguro de campos adicionales
          spot: safeString(getVal(v, ['spot', 'Spot'])),
          patio: safeString(getVal(v, ['patio', 'Patio'])),
          row: safeString(getVal(v, ['row', 'Row'])),
          notes: safeString(getVal(v, ['notes', 'observaciones', 'Notes'])),
          ubi_cuadre: safeString(getVal(v, ['ubi_cuadre'])),
          obs_cuadre: safeString(getVal(v, ['obs_cuadre']))
        };
      });
      
      mappedVehicles.sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || ''));
      
      setVehicles(mappedVehicles);
      calculateStats(mappedVehicles);

    } catch (error: any) {
      console.error("Error fetching vehicles:", error);
      let msg = error?.message || 'Error desconocido';
      if (typeof error === 'string') msg = error;
      if (error?.code === '42P01') msg = "La tabla 'vehicles' no existe en Supabase.";
      if (error?.code === 'PGRST301') msg = "Error de permisos o RLS activo.";
      setConnectionError(msg);
      setVehicles([]); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return (
    <DataContext.Provider value={{ 
      vehicles, 
      isLoading, 
      stats, 
      connectionError, 
      refreshData: fetchVehicles 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};