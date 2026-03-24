import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Settings, 
  LogOut, 
  UserCircle,
  ArrowUp,
  ArrowDown,
  QrCode,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  PenTool
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  // Estado para controlar qué menús están expandidos
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'inventory': true,
    'inout_section': true // Default open for easier access
  });

  const handleNav = (page: string) => {
    onNavigate(page);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', roles: [UserRole.ADMIN, UserRole.SUPERVISOR] },
    { 
      id: 'inout_section', 
      label: 'Entrada y Salida', 
      roles: [UserRole.ADMIN, UserRole.OPERATOR],
      hasSubmenu: true,
      subItems: [
        { id: 'inout', label: 'Registrar', icon: PenTool },
        { id: 'inout_view', label: 'Ver Movimientos', icon: ArrowRightLeft }
      ]
    },
    { 
      id: 'inventory', 
      label: 'Inventario', 
      roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR],
      hasSubmenu: true,
      subItems: [
        { id: 'inventory', label: 'Ver Inventario', icon: Package },
        { id: 'inventory_audit', label: 'Cuadre (Scanner)', icon: QrCode },
        { id: 'inventory_view_audit', label: 'Ver Cuadre', icon: ClipboardList }
      ]
    },
    { id: 'reports', label: 'Reportes', roles: [UserRole.ADMIN, UserRole.SUPERVISOR] },
    { id: 'config', label: 'Configuración', roles: [UserRole.ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => user && item.roles.includes(user.role));

  // Función auxiliar para renderizar el icono con los colores correctos según estado
  const renderIcon = (itemId: string, isActive: boolean) => {
    // Clases base para transiciones
    const transition = "transition-colors duration-200";
    // Si está activo o en hover (controlado por el grupo padre), el icono es blanco
    const activeColor = "text-white";
    
    // Colores específicos cuando está INACTIVO
    // Nota: Usamos 'group-hover:text-white' para que cambien a blanco al pasar el mouse
    switch (itemId) {
      case 'dashboard':
        return (
          <LayoutDashboard 
            size={20} 
            className={`${transition} ${isActive ? activeColor : 'text-red-600 group-hover:text-white'}`} 
          />
        );
      case 'inout_section':
        return (
          <div className="flex items-center -space-x-1">
             {/* Flecha Verde (Entrada - Abajo) */}
             <ArrowDown 
               size={16} 
               className={`${transition} ${isActive ? activeColor : 'text-green-600 group-hover:text-white'}`} 
             />
             {/* Flecha Roja (Salida - Arriba) */}
             <ArrowUp 
               size={16} 
               className={`${transition} ${isActive ? activeColor : 'text-red-600 group-hover:text-white'}`} 
             />
          </div>
        );
      case 'inventory':
        return (
          <Package 
            size={20} 
            className={`${transition} ${isActive ? activeColor : 'text-amber-500 group-hover:text-white'}`} 
          />
        );
      case 'reports':
        return (
          <FileText 
            size={20} 
            className={`${transition} ${isActive ? activeColor : 'text-blue-600 group-hover:text-white'}`} 
          />
        );
      case 'config':
        return (
          <Settings 
            size={20} 
            className={`${transition} ${isActive ? activeColor : 'text-gray-500 group-hover:text-white'}`} 
          />
        );
      default:
        return <div className="w-5 h-5" />;
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto md:shadow-none border-r border-gray-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header - Navy Blue */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 bg-[#003366]">
            <h1 className="text-xl font-bold text-white tracking-wider">ROTOR 3.0</h1>
          </div>

          {/* User Profile */}
          <div className="p-4 border-b border-gray-100 flex items-center space-x-3 bg-gray-50">
            <div className="bg-[#003366] bg-opacity-10 p-2 rounded-full text-[#003366]">
              <UserCircle size={24} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {filteredItems.map((item) => {
                const isActive = currentPage === item.id || (item.hasSubmenu && item.subItems?.some(sub => sub.id === currentPage));
                
                // Si tiene submenú, renderizamos diferente
                if (item.hasSubmenu) {
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className={`group w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? 'bg-[#003366] text-white shadow-md' 
                            : 'text-gray-600 hover:bg-[#003366] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {renderIcon(item.id, isActive)}
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {expandedMenus[item.id] ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>

                      {/* Submenu */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenus[item.id] ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                        <ul className="pl-4 space-y-1">
                          {item.subItems?.map((sub) => {
                             const isSubActive = currentPage === sub.id;
                             const SubIcon = sub.icon;
                             return (
                               <li key={sub.id}>
                                 <button
                                   onClick={() => handleNav(sub.id)}
                                   className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                                     isSubActive 
                                       ? 'bg-blue-50 text-[#003366] font-semibold' 
                                       : 'text-gray-500 hover:text-[#003366] hover:bg-gray-50'
                                   }`}
                                 >
                                    <SubIcon size={16} />
                                    <span>{sub.label}</span>
                                 </button>
                               </li>
                             );
                          })}
                        </ul>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNav(item.id)}
                      className={`group w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive 
                          ? 'bg-[#003366] text-white shadow-md' 
                          : 'text-gray-600 hover:bg-[#003366] hover:text-white'
                      }`}
                    >
                      {renderIcon(item.id, isActive)}
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors group"
            >
              <LogOut size={18} className="group-hover:text-white" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;