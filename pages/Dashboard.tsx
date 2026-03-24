import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { 
  Car, 
  CheckCircle, 
  AlertTriangle, 
  Key, 
  Database,
  CalendarClock,
  BarChart3,
  CheckCircle2,
  Building2,
  TrendingUp,
  X,
  Fuel,
  Gauge,
  MapPin,
  PieChart
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { stats, isLoading, vehicles, connectionError } = useData();
  
  // Estado para controlar la vista de la gráfica (DISPONIBLE, RESERVADO, TOTAL)
  const [viewMode, setViewMode] = useState<'AVAILABLE' | 'RESERVED' | 'TOTAL'>('AVAILABLE');
  
  // Estado para el modal de detalles de sucursal
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Cálculo de Utilización
  const utilizationRate = useMemo(() => {
    if (stats.totalFleet === 0) return 0;
    return ((stats.rented / stats.totalFleet) * 100).toFixed(1);
  }, [stats]);

  // Procesamiento de datos en una sola lista ordenada
  const { sortedItems } = useMemo(() => {
    // Mapa para contar Total, Disponibles y Reservados por ubicación
    const locationStats: Record<string, { total: number, available: number, reserved: number }> = {};
    
    // Términos a excluir
    const excludedTerms = [
      'leasing', 'panarent', 'corp', 'asegura', 'mina', 
      'cvopsvent', 'chiventa', 'cvops'
    ];
    
    vehicles.forEach(v => {
      const loc = v.location ? v.location.trim() : 'Sin Asignar';
      const locLower = loc.toLowerCase();
      const status = (v.status || '').toUpperCase();

      // Excluir ubicaciones especiales Y el estado 'SEPARADO-VENTA' (con o sin espacios)
      if (!excludedTerms.some(term => locLower.includes(term)) && status !== 'SEPARADO-VENTA' && status !== 'SEPARADO - VENTA') {
        if (!locationStats[loc]) {
            locationStats[loc] = { total: 0, available: 0, reserved: 0 };
        }
        
        locationStats[loc].total += 1;
        
        if (status === 'DISPONIBLE') {
            locationStats[loc].available += 1;
        } else if (status === 'RESERVADO') {
            locationStats[loc].reserved += 1;
        }
      }
    });

    // Convertir a array plano
    const allItems = Object.entries(locationStats)
      .map(([name, stat]) => {
        let count = 0;
        let percentage = 0;

        if (viewMode === 'AVAILABLE') {
            count = stat.available;
            percentage = stat.total > 0 ? (stat.available / stat.total) * 100 : 0;
        } else if (viewMode === 'RESERVED') {
            count = stat.reserved;
            percentage = stat.total > 0 ? (stat.reserved / stat.total) * 100 : 0;
        } else {
            count = stat.total;
            percentage = 100;
        }

        return { 
          name, 
          count, 
          total: stat.total,
          available: stat.available,
          reserved: stat.reserved,
          percentage
        };
      })
      .filter(item => item.count > 0) // Solo mostrar si tienen items en la vista actual
      .sort((a, b) => b.count - a.count);

    return { sortedItems: allItems };
  }, [vehicles, viewMode]);

  // Filtro para el MODAL (Vehículos de la sucursal seleccionada)
  const selectedVehiclesList = useMemo(() => {
    if (!selectedLocation) return [];

    return vehicles.filter(v => {
      const loc = v.location ? v.location.trim() : 'Sin Asignar';
      const status = (v.status || '').toUpperCase();

      // 1. Coincidir ubicación
      if (loc !== selectedLocation) return false;

      // 2. Excluir venta
      if (status === 'SEPARADO-VENTA' || status === 'SEPARADO - VENTA') return false;

      // 3. Coincidir con el modo de vista
      if (viewMode === 'AVAILABLE' && status !== 'DISPONIBLE') return false;
      if (viewMode === 'RESERVED' && status !== 'RESERVADO') return false;

      return true;
    }).sort((a, b) => (a.model || '').localeCompare(b.model || ''));
  }, [vehicles, selectedLocation, viewMode]);

  // Helper para determinar el tema de color según la cantidad
  const getItemTheme = (count: number) => {
    if (count > 50) return { bar: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' };
    if (count > 20) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' };
    if (count > 5) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' };
    return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  // Componente de Tarjeta de Estadística Superior
  const StatCard = ({ title, value, icon: Icon, colorClass, subtext, suffix = '' }: any) => (
    <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 flex flex-col justify-between transition-all hover:shadow-md group relative overflow-hidden">
      <div className={`absolute top-0 right-0 p-2 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform ${colorClass.replace('bg-', 'text-')}`}>
        <Icon size={64} />
      </div>
      <div className="flex justify-between items-start mb-3 relative z-10">
         <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
           <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
         </div>
         <span className={`text-3xl font-black tracking-tighter text-slate-800`}>
            {value}<span className="text-lg ml-1 text-slate-500">{suffix}</span>
         </span>
      </div>
      <div className="relative z-10">
        <p className="text-sm font-bold text-slate-600">{title}</p>
        {subtext && <p className="text-[10px] text-slate-400 font-medium">{subtext}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10 animate-fade-in max-w-7xl mx-auto relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Visión general operativa</p>
        </div>
        {connectionError && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100 flex items-center">
            <Database size={12} className="mr-1"/> Error de conexión
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* NUEVA FICHA UTILIZACIÓN AL INICIO */}
        <StatCard 
          title="Utilización" 
          value={utilizationRate} 
          icon={PieChart} 
          colorClass="bg-violet-600"
          subtext="Alquilados / Flota Total"
          suffix="%"
        />

        <StatCard 
          title="Total Flota" 
          value={stats.totalFleet} 
          icon={Car} 
          colorClass="bg-indigo-600"
          subtext="Unidades registradas"
        />
        <StatCard 
          title="Disponibles" 
          value={stats.available} 
          icon={CheckCircle2} 
          colorClass="bg-emerald-500"
          subtext="Listos para entrega"
        />
        <StatCard 
          title="Alquilados" 
          value={stats.rented} 
          icon={Key} 
          colorClass="bg-blue-500"
          subtext="En contrato activo"
        />
        {/* Eliminada ficha de Reservados de aquí */}
        <StatCard 
          title="Fuera de Servicio" 
          value={stats.outOfService} 
          icon={AlertTriangle} 
          colorClass="bg-rose-500"
          subtext="Taller / Mtto"
        />
      </div>

      {/* Sección Principal de Distribución */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 md:p-8 relative">
        
        {/* Header de la Gráfica */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-6 border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-slate-400" size={24} />
              Distribución por Sucursales
            </h3>
            <p className="text-sm text-slate-400 font-medium mt-1">
               {viewMode === 'AVAILABLE' && 'Visualizando unidades disponibles'}
               {viewMode === 'RESERVED' && 'Visualizando unidades reservadas'}
               {viewMode === 'TOTAL' && 'Visualizando flota total operativa'}
            </p>
          </div>

          {/* Toggle Moderno */}
          <div className="bg-slate-100 p-1.5 rounded-xl flex items-center shadow-inner overflow-x-auto">
             <button
               onClick={() => setViewMode('AVAILABLE')}
               className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                 viewMode === 'AVAILABLE' 
                   ? 'bg-white text-emerald-600 shadow-md transform scale-105' 
                   : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
               }`}
             >
               <CheckCircle size={14} />
               <span>DISPONIBLES</span>
             </button>
             
             {/* NUEVO BOTÓN RESERVADOS */}
             <button
               onClick={() => setViewMode('RESERVED')}
               className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                 viewMode === 'RESERVED' 
                   ? 'bg-white text-amber-500 shadow-md transform scale-105' 
                   : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
               }`}
             >
               <CalendarClock size={14} />
               <span>RESERVADOS</span>
             </button>

             <button
               onClick={() => setViewMode('TOTAL')}
               className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                 viewMode === 'TOTAL' 
                   ? 'bg-white text-indigo-600 shadow-md transform scale-105' 
                   : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
               }`}
             >
               <Car size={14} />
               <span>TOTALES</span>
             </button>
          </div>
        </div>

        {/* CONTENIDO DE GRIDS UNIFICADO */}
        {sortedItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <TrendingUp size={48} className="mx-auto mb-3 opacity-20" />
            <p>No se encontraron vehículos con los filtros actuales.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
             {sortedItems.map((item) => {
               const theme = getItemTheme(item.count);
               return (
                <div 
                  key={item.name} 
                  onClick={() => setSelectedLocation(item.name)}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between group cursor-pointer active:scale-95"
                  title="Ver detalles"
                >
                   
                   <div className="flex justify-between items-start mb-2">
                     <div className="flex-1 min-w-0 pr-2">
                       <h5 className="text-sm font-bold text-slate-700 truncate" title={item.name}>
                         {item.name.replace('AEROPUERTO', 'AERO').replace('PANAMA', '')}
                       </h5>
                       <p className="text-[10px] text-slate-400 flex items-center gap-1">
                         <Building2 size={10} />
                         Sucursal
                       </p>
                     </div>
                     <div className={`text-2xl font-black ${theme.text}`}>
                       {item.count}
                     </div>
                   </div>

                   {/* Barra de Progreso Contextual */}
                   <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                     <div 
                       className={`h-full rounded-full ${theme.bar} transition-all duration-500`} 
                       style={{ width: `${Math.max(item.percentage, 5)}%` }} // Minimo 5% visual
                     ></div>
                   </div>

                   {/* Stats Secundarios (Contexto) */}
                   <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium h-4">
                      <span>
                        {viewMode === 'AVAILABLE' ? 'Disp' : viewMode === 'RESERVED' ? 'Resv' : 'Total'}
                      </span>
                      <span>
                         {viewMode === 'AVAILABLE' && <span className="text-slate-500">{((item.available / item.total) * 100).toFixed(0)}% de flota</span>}
                         {viewMode === 'RESERVED' && <span className="text-slate-500">{((item.reserved / item.total) * 100).toFixed(0)}% de flota</span>}
                      </span>
                   </div>
                </div>
               );
             })}
          </div>
        )}

      </div>

      {/* MODAL DETALLES SUCURSAL */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              
              {/* Modal Header */}
              <div className="bg-[#003366] p-5 flex justify-between items-center text-white shrink-0">
                 <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                       <MapPin size={20} />
                       {selectedLocation}
                    </h3>
                    <p className="text-blue-200 text-sm">
                       {viewMode === 'AVAILABLE' && 'Listado de vehículos disponibles'}
                       {viewMode === 'RESERVED' && 'Listado de vehículos reservados'}
                       {viewMode === 'TOTAL' && 'Listado total de vehículos'} 
                       &nbsp;({selectedVehiclesList.length})
                    </p>
                 </div>
                 <button 
                   onClick={() => setSelectedLocation(null)}
                   className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                 >
                    <X size={20} />
                 </button>
              </div>

              {/* Modal Body (List) */}
              <div className="overflow-y-auto flex-1 p-4 bg-gray-50">
                 {selectedVehiclesList.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                       <Car size={40} className="mx-auto mb-2 opacity-30"/>
                       <p>No se encontraron vehículos.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 gap-3">
                       {selectedVehiclesList.map(v => (
                          <div key={v.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-brand-300 transition-colors">
                             
                             {/* Columna Info Principal */}
                             <div className="flex items-center gap-4">
                                <div className="bg-gray-100 p-3 rounded-lg text-gray-600 font-bold text-lg min-w-[80px] text-center border border-gray-200">
                                   {v.unitNumber}
                                </div>
                                <div>
                                   <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-gray-900">{v.make} {v.model}</h4>
                                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">{v.year}</span>
                                   </div>
                                   <p className="text-sm text-gray-500 font-mono mt-0.5 flex items-center gap-2">
                                      <span className="bg-yellow-50 text-yellow-800 px-1.5 rounded border border-yellow-100">{v.licensePlate}</span>
                                      <span>•</span>
                                      <span className="capitalize">{v.color}</span>
                                   </p>
                                </div>
                             </div>

                             {/* Columna Estado y Detalles */}
                             <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                   <Fuel size={14} className={v.fuelLevel < 3 ? "text-red-500" : "text-green-500"} />
                                   <span className="font-medium">{v.fuelLevel}/8</span>
                                </div>
                                
                                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                   <Gauge size={14} className="text-brand-500" />
                                   <span className="font-medium">{v.odometer?.toLocaleString()} km</span>
                                </div>

                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                   v.status === 'DISPONIBLE' ? 'bg-green-50 text-green-700 border-green-200' :
                                   v.status === 'ALQUILADO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                   v.status === 'RESERVADO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                   'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                   {v.status}
                                </div>
                             </div>

                          </div>
                       ))}
                    </div>
                 )}
              </div>
              
              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-gray-200 flex justify-end">
                 <button 
                   onClick={() => setSelectedLocation(null)}
                   className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                 >
                   Cerrar
                 </button>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;