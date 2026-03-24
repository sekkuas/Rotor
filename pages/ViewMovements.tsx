import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  MapPin, 
  Filter,
  FileText,
  Download,
  Search as SearchIcon,
  ArrowUp,
  ArrowDown,
  User,
  Gauge,
  Fuel
} from 'lucide-react';

interface MovementRecord {
  id: number;
  created_at: string;
  unidad: string;
  placa: string;
  origen: string;
  destino: string;
  conductor: string;
  combustible: number;
  kilometraje: number;
  orden: string;
  in_out: 'IN' | 'OUT';
  motivo: string;
  notas: string;
}

const ViewMovements: React.FC = () => {
  const { vehicles } = useData();
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros de UI (Inputs)
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // IN, OUT, ALL
  const [dateFrom, setDateFrom] = useState(''); 
  const [dateTo, setDateTo] = useState('');
  
  // Filtros Aplicados (para el botón Buscar)
  const [appliedFilters, setAppliedFilters] = useState({
    from: '',
    to: ''
  });
  
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 1. Fetch de la tabla 'in_out'
  const fetchMovements = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('in_out')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); 

      if (error) throw error;
      
      setMovements(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching movements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto inicial y Auto-Refresh
  useEffect(() => {
    fetchMovements();
    const interval = setInterval(() => {
      fetchMovements();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Aplicar filtro al hacer clic en Buscar
  const handleApplyFilter = () => {
    setAppliedFilters({
      from: dateFrom,
      to: dateTo
    });
  };

  // 2. Filtrado
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // Filtro de Ubicación (Busca en Origen O Destino)
      const matchesLoc = locationFilter === 'ALL' || 
                         m.origen === locationFilter || 
                         m.destino === locationFilter;
      
      // Filtro de Tipo
      const matchesType = typeFilter === 'ALL' || m.in_out === typeFilter;

      // Filtro de Fecha
      let matchesDate = true;
      const { from, to } = appliedFilters;

      if (from || to) {
        const rowDate = new Date(m.created_at);
        if (from) {
          const startDate = new Date(from + 'T00:00:00'); 
          if (rowDate < startDate) matchesDate = false;
        }
        if (to) {
          const endDate = new Date(to + 'T23:59:59.999');
          if (rowDate > endDate) matchesDate = false;
        }
      }

      return matchesLoc && matchesType && matchesDate;
    });
  }, [movements, locationFilter, typeFilter, appliedFilters]);

  // Lista de ubicaciones para el select (extraída de los movimientos cargados)
  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    movements.forEach(m => {
      if (m.origen) locs.add(m.origen);
      if (m.destino) locs.add(m.destino);
    });
    return Array.from(locs).sort();
  }, [movements]);

  // Formateador simple
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr };
  };

  // 3. Exportar a Excel
  const handleDownloadExcel = () => {
    if (filteredMovements.length === 0) {
      alert("No hay datos para exportar con los filtros actuales.");
      return;
    }

    let tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
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
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Placa</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Conductor</th>
              <th>Kilometraje</th>
              <th>Combustible</th>
              <th>Orden</th>
              <th>Motivo</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredMovements.forEach(item => {
      const { dateStr, timeStr } = formatDateTime(item.created_at);
      const typeLabel = item.in_out === 'OUT' ? 'SALIDA' : 'ENTRADA';
      tableContent += `
        <tr>
          <td>${dateStr}</td>
          <td>${timeStr}</td>
          <td>${typeLabel}</td>
          <td>${item.unidad || ''}</td>
          <td>${item.placa || ''}</td>
          <td>${item.origen || ''}</td>
          <td>${item.destino || ''}</td>
          <td>${item.conductor || ''}</td>
          <td>${item.kilometraje || ''}</td>
          <td>${item.combustible}</td>
          <td>${item.orden || ''}</td>
          <td>${item.motivo || ''}</td>
          <td>${item.notas || ''}</td>
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
    a.download = `Movimientos_Rotor_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4 h-full flex flex-col bg-gray-50/50 p-2 animate-fade-in">
      
      {/* HEADER */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600 shadow-sm">
               <ArrowRightLeft size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Historial de Movimientos</h2>
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

        {/* FILTROS */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col lg:flex-row items-end gap-4">
           
           <div className="flex flex-col gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-gray-500 ml-1">Fecha Desde</label>
             <input 
               type="date"
               value={dateFrom}
               onChange={(e) => setDateFrom(e.target.value)}
               className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal outline-none shadow-sm cursor-pointer"
             />
           </div>

           <div className="flex flex-col gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-gray-500 ml-1">Fecha Hasta</label>
             <input 
               type="date"
               value={dateTo}
               onChange={(e) => setDateTo(e.target.value)}
               className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal outline-none shadow-sm cursor-pointer"
             />
           </div>

           <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-gray-500 ml-1">Tipo</label>
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal outline-none shadow-sm cursor-pointer appearance-none min-w-[100px]"
              >
                <option value="ALL">Todos</option>
                <option value="OUT">Salidas</option>
                <option value="IN">Entradas</option>
              </select>
           </div>

           <div className="flex flex-col gap-1 w-full sm:w-auto flex-grow max-w-xs">
             <label className="text-xs font-medium text-gray-500 ml-1">Ubicación (Origen/Destino)</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Filter size={14} className="text-gray-400" />
               </div>
               <select
                 value={locationFilter}
                 onChange={(e) => setLocationFilter(e.target.value)}
                 className="pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm font-normal outline-none w-full shadow-sm cursor-pointer appearance-none"
               >
                 <option value="ALL">Todas las Sedes</option>
                 {availableLocations.map(loc => (
                   <option key={loc} value={loc}>{loc}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="flex items-center gap-2 w-full lg:w-auto">
             <button 
               onClick={handleApplyFilter}
               className="flex-1 sm:flex-none px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm active:scale-95 flex items-center justify-center gap-2 h-[38px]"
             >
               <SearchIcon size={16} />
               Buscar
             </button>

             <button 
               onClick={handleDownloadExcel}
               className="flex-1 sm:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-normal shadow-sm active:scale-95 flex items-center justify-center gap-2 h-[38px]"
               title="Exportar Excel"
             >
               <Download size={18} />
               <span className="hidden xl:inline">Exportar</span>
             </button>

             <button 
               onClick={fetchMovements}
               className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-brand-600 hover:border-brand-300 shadow-sm active:scale-95 flex justify-center items-center h-[38px]"
               title="Actualizar datos"
             >
               <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
             </button>
           </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded border border-gray-300 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10 text-sm text-gray-800">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-center font-normal uppercase w-16">Tipo</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-24">Fecha</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-28">Unidad</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-32">Placa</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-40">Origen</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-40">Destino</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase w-40">Conductor</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-normal uppercase w-16">Comb.</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-normal uppercase w-28">Orden</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-normal uppercase">Motivo / Notas</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredMovements.length > 0 ? (
                filteredMovements.map((item) => {
                  const { dateStr, timeStr } = formatDateTime(item.created_at);
                  const isOut = item.in_out === 'OUT';
                  return (
                    <tr key={item.id} className="hover:bg-blue-50 transition-colors text-gray-700">
                      <td className="border border-gray-300 px-2 py-1.5 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center justify-center bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200 min-w-[70px]">
                            <ArrowUp size={12} className="mr-1" /> SALIDA
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200 min-w-[70px]">
                            <ArrowDown size={12} className="mr-1" /> ENTRADA
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                         <div className="flex flex-col leading-tight">
                           <span>{dateStr}</span>
                           <span className="text-xs text-gray-400">{timeStr}</span>
                         </div>
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-bold whitespace-nowrap">
                        {item.unidad}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                        {item.placa}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap text-gray-500">
                        {item.origen}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap text-gray-900 font-medium">
                        {item.destino}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal whitespace-nowrap">
                         <div className="flex items-center text-xs text-gray-600">
                            <User size={12} className="mr-1 text-gray-400" />
                            {item.conductor}
                         </div>
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center text-sm font-normal">
                         <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${item.combustible < 3 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                           {item.combustible}
                         </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center text-sm font-mono text-blue-600 font-medium whitespace-nowrap">
                        {item.orden || '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-sm font-normal">
                         <div className="flex flex-col">
                            <span className="font-bold text-xs text-gray-800 uppercase">{item.motivo}</span>
                            {item.notas && <span className="text-xs text-gray-500 truncate max-w-xs" title={item.notas}>{item.notas}</span>}
                         </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="border border-gray-300 px-4 py-8 text-center text-gray-500 text-sm font-normal">
                    No se encontraron movimientos {appliedFilters.from || appliedFilters.to ? 'en el rango seleccionado' : ''}.
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

export default ViewMovements;