import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (username: string, password?: string) => Promise<boolean>; // Agregado password como opcional por compatibilidad
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mantenemos MOCK por si acaso, pero la lógica principal ahora usará Supabase
const MOCK_USERS: User[] = [
  { id: '1', username: 'admin', role: UserRole.ADMIN, name: 'Admin Demo' },
  { id: '2', username: 'supervisor', role: UserRole.SUPERVISOR, name: 'Supervisor Demo' },
  { id: '3', username: 'operator', role: UserRole.OPERATOR, name: 'Operator Demo' },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión de localStorage al cargar
    const storedUser = localStorage.getItem('rotor_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const cleanUsername = username.toLowerCase().trim();

      // 1. Intentar login con SUPABASE (Tabla 'app_users')
      if (password) { // Solo si hay password intentamos validación completa
         // CAMBIO: Usar 'app_users' en lugar de 'users'
         const { data, error } = await supabase
           .from('app_users')
           .select('*')
           .eq('usuario', cleanUsername)
           .eq('password', password) // En producción usaríamos hash, aquí directo como solicitado
           .single();
         
         if (!error && data) {
           // Verificar Estado (1 = Activo, 0 = Inactivo)
           if (data.activo === 0) {
             console.warn("Usuario inactivo");
             return false;
           }

           // Mapear usuario DB a usuario App
           const loggedUser: User = {
             id: data.id.toString(),
             username: data.usuario,
             name: `${data.nombre} ${data.apellido}`,
             role: data.rol as UserRole // Asumimos que el string en DB coincide con el Enum
           };

           setUser(loggedUser);
           localStorage.setItem('rotor_user', JSON.stringify(loggedUser));
           return true;
         }
      }

      // 2. Fallback a MOCK USERS (Para Demo/Dev rápido sin DB configurada)
      // Solo permite login si el usuario es uno de los mocks y la contraseña es la "universal" o vacía
      const foundMock = MOCK_USERS.find(u => u.username === cleanUsername);
      
      // MODIFICACIÓN: Se agrega '1234' como contraseña válida para el fallback
      if (foundMock && (password === 'password123' || password === '1234' || !password)) {
        setUser(foundMock);
        localStorage.setItem('rotor_user', JSON.stringify(foundMock));
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('rotor_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};