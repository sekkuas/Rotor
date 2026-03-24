import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { 
  ClipboardList, 
  RefreshCw, 
  MapPin, 
  Filter,
  FileText,
  Download,
  Search as SearchIcon,
  Activity // Icon for Status
} from 'lucide-react';

interface AuditRecord {
  id: number;
  created_at: string;
  unidad: string;
  placa: string;
  ubi: string; // Ubicación específica del cuadre
  obs: string;
  // Campos computados
  currentLocation?: string; // Ubicación actual del vehículo en tiempo real
  currentStatus?: string; // Estado actual del vehículo
}

const ViewAudit: React.FC = () => {
  const { vehicles } = useData();
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros de UI (Inputs)
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(''); 
  const [dateTo, setDateTo] = useState('');
  
  // Filtros Aplicados (para el botón Buscar)
  const [appliedFilters, setAppliedFilters] = useState({
    from: '',
    to: ''
  });
  
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 1. Fetch de la tabla 'cuadre'
  const fetchAudits = async () => {
    setIsLoading(true);
    try {
      // Traemos más registros para permitir filtrado por fecha efectivo
      const { data, error } = await supabase
        .from('cuadre')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); 

      if (error) throw error;
      
      setAudits(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching audits:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto inicial y Auto-Refresh
  useEffect(() => {
    fetchAudits();
    const interval = setInterval(() => {
      fetchAudits();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // 2. Procesamiento de datos (Unir con vehículos)
  const processedAudits = useMemo(() => {
    return audits.map(audit => {
      const vehicle = vehicles.find(v => 
        (v.unitNumber === audit.unidad) || 
        (v.licensePlate === audit.placa)
      );
      return {
        ...audit,
        currentLocation: vehicle ? vehicle.location : 'No encontrado',
        currentStatus: vehicle ? vehicle.status : 'Desconocido'
      };
    });
  }, [audits, vehicles]);

  // Aplicar filtro al hacer clic en Buscar
  const handleApplyFilter = () => {
    setAppliedFilters({
      from: dateFrom,
      to: dateTo
    });
  };

  // 3. Filtrado (Ubicación + Fecha Desde/Hasta)
  const filteredAudits = useMemo(() => {
    return processedAudits.filter(a => {
      // Filtro de Ubicación
      const matchesLoc = locationFilter === 'ALL' || a.currentLocation === locationFilter;
      
      // Filtro de Fecha
      let matchesDate = true;
      const { from, to } = appliedFilters;

      if (from || to) {
        const rowDate = new Date(a.created_at);
        
        if (from) {
          // Inicio del día seleccionado (00:00:00)
          const startDate = new Date(from + 'T00:00:00'); 
          if (rowDate < startDate) matchesDate = false;
        }

        if (to) {
          // Final del día seleccionado (23:59:59.999)
          const endDate = new Date(to + 'T23:59:59.999');
          if (rowDate > endDate) matchesDate = false;
        }
      }

      return matchesLoc && matchesDate;
    });
  }, [processedAudits, locationFilter, appliedFilters]);

  // Lista de ubicaciones para el select
  const availableLocations = useMemo(() => {
    const locs = new Set(processedAudits.map(a => a.currentLocation || 'Desconocido'));
    return Array.from(locs).sort();
  }, [processedAudits]);

  // Formateador simple
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr };
  };

  // Helper para color de status
  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase().trim();
    if (s === 'DISPONIBLE') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'ALQUILADO') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'RESERVADO') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (s === 'MANTENIMIENTO' || s === 'TALLER') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // 4. Exportar a Excel (Generación de HTML Table Blob)
  const handleDownloadExcel = () => {
    if (filteredAudits.length === 0) {
      alert("No hay datos para exportar con los filtros actuales.");
      return;
    }

    // Construcción manual de la tabla HTML para Excel
    let tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Reporte Cuadre</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          th { background-color: #f3f4f6; font-weight: bold; border: 1px solid #d1d5db; }
          td { border: 1px solid #d1d5db; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Unidad</th>
              <th>Placa</th>
              <th>Ubicación Sistema</th>
              <th>Status Actual</th>
              <th>Posición Física</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredAudits.forEach(item => {
      const { dateStr, timeStr } = formatDateTime(item.created_at);
      tableContent += `
        <tr>
          <td>${dateStr}</td>
          <td>${timeStr}</td>
          <td>${item.unidad || ''}</td>
          <td>${item.placa || ''}</td>
          <td>${item.currentLocation || ''}</td>
          <td>${item.currentStatus || ''}</td>
          <td>${item.ubi || ''}</td>
          <td>${item.obs || ''}</td>
        </tr>
      `;
    });

    tableContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cuadre_Rotor_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4 h-full flex flex-col bg-gray-50/50 p-2">
      
      {/* HEADER MODERNO */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
        
        {/* Fila Superior: Título y Datos de Actualización */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600 shadow-sm">
               <ClipboardList size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Registro de Cuadre</h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <span className="flex h-2 w-2 relative">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
                 <p className="text-gray-400 text-xs font-normal">
                   Actualizado: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                 </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fila Inferior: Controles de Filtro y Botones */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col lg:flex-row items-end gap-4">
           
           {/* Fecha Desde */}
           <div className="flex flex-col gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-gray-500 ml-1">Fecha Desde</label>
             <input 
               type="date"
               value={dateFrom}
               onChange={(e) => setDateFrom(e.target.value)}
               className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-40 shadow-sm transition-colors cursor-pointer"
             />
           </div>

           {/* Fecha Hasta */}
           <div className="flex flex-col gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-gray-500 ml-1">Fecha Hasta</label>
             <input 
               type="date"
               value={dateTo}
               onChange={(e) => setDateTo(e.target.value)}
               className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-40 shadow-sm transition-colors cursor-pointer"
             />
           </div>

           {/* Filtro Ubicación */}
           <div className="flex flex-col gap-1 w-full sm:w-auto flex-grow max-w-xs">
             <label className="text-xs font-medium text-gray-500 ml-1">Ubicación</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Filter size={14} className="text-gray-400" />
               </div>
               <select
                 value={locationFilter}
                 onChange={(e) => setLocationFilter(e.target.value)}
                 className="pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full shadow-sm cursor-pointer appearance-none"
               >
                 <option value="ALL">Todas las Sedes</option>
                 {availableLocations.map(loc => (
                   <option key={loc} value={loc}>{loc}</option>
                 ))}
               </select>
             </div>
           </div>

           {/* Grupo de Botones: Buscar, Exportar, Sync */}
           <div className="flex items-center gap-2 w-full lg:w-auto">
             <button 
               onClick={handleApplyFilter}
               className="flex-1 sm:flex-none px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 h-[38px]"
             >
               <SearchIcon size={16} />
               Buscar
             </button>

             <button 
               onClick={handleDownloadExcel}
               className="flex-1 sm:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-normal shadow-sm transition-all active:scale-95 border border-transparent flex items-center justify-center gap-2 h-[38px]"
               title="Descargar Excel (.xls)"
             >
               <Download size={18} />
               <span className="hidden xl:inline">Exportar</span>
             </button>

             <button 
               onClick={fetchAudits}
               className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-brand-600 hover:border-brand-300 hover:shadow-md transition-all active:scale-95 flex justify-center items-center h-[38px]"
               title="Actualizar datos"
             >
               <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
             </button>
           </div>

        </div>
      </div>

      {/* Tabla Estilo Excel - COMPOSICIÓN Y TIPOGRAFÍA ORIGINAL */}
      <div className="bg-white rounded border border-gray-300 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10 text-sm text-gray-800">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-24">Fecha</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-24">Hora</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-28">Unidad</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-32">Placa</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-40">Ubicación</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-32">Status</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-normal uppercase w-24">Posición</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase">Observaciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAudits.length > 0 ? (
                filteredAudits.map((item) => {
                  const { dateStr, timeStr } = formatDateTime(item.created_at);
                  return (
                    <tr key={item.id} className="hover:bg-blue-50 transition-colors text-gray-700">
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        {item.unidad}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        {item.placa}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-2 text-gray-400" />
                          {item.currentLocation}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal text-left whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-xs font-bold border ${getStatusColor(item.currentStatus || '')}`}>
                          {item.currentStatus || 'N/A'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal text-center whitespace-nowrap text-gray-700">
                        {item.ubi || '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal truncate max-w-xs" title={item.obs}>
                        {item.obs ? (
                          <div className="flex items-center">
                             <FileText size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />
                             {item.obs}
                          </div>
                        ) : (
                          <span className="text-gray-300 italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="border border-gray-300 px-4 py-8 text-center text-gray-500 text-sm font-normal">
                    No se encontraron registros de cuadre {appliedFilters.from || appliedFilters.to ? 'para este rango de fechas' : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ViewAudit;