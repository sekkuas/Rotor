import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  CalendarRange, 
  RefreshCw,
  Car,
  ClipboardList,
  ArrowRightLeft,
  AlertTriangle,
  MapPin,
  Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';

type ReportType = 'INVENTORY' | 'AUDIT' | 'IN_OUT' | 'NON_PRODUCTIVE';

const Reports: React.FC = () => {
  const { vehicles } = useData(); // Contexto global para inventario actual
  const [activeTab, setActiveTab] = useState<ReportType>('INVENTORY');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // --- DATOS LOCALES PARA REPORTES HISTÓRICOS ---
  const [auditData, setAuditData] = useState<any[]>([]);
  const [movementsData, setMovementsData] = useState<any[]>([]);

  // --- FILTROS ---
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // --- CARGA DE DATOS ---
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'AUDIT') {
        const { data, error } = await supabase
          .from('cuadre')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (error) throw error;
        setAuditData(data || []);
      } 
      else if (activeTab === 'IN_OUT' || activeTab === 'NON_PRODUCTIVE') {
        const { data, error } = await supabase
          .from('in_out')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (error) throw error;
        setMovementsData(data || []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error cargando reporte:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Reset filters on tab change
    setSearchText('');
    // Keep date/location filters as they might be useful across tabs
  }, [activeTab]);

  // --- LISTA DINÁMICA DE ESTADOS (Nuevo) ---
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    vehicles.forEach(v => {
      if (v.status) {
        statuses.add(v.status.toUpperCase().trim());
      }
    });
    // Añadir estados por defecto para asegurar que aparezcan aunque no haya autos
    statuses.add('DISPONIBLE');
    statuses.add('ALQUILADO');
    statuses.add('MANTENIMIENTO');
    
    return Array.from(statuses).sort();
  }, [vehicles]);

  // --- LOGICA DE FILTRADO ---
  const getFilteredData = useMemo(() => {
    let data: any[] = [];
    
    // 1. Seleccionar Fuente de Datos
    if (activeTab === 'INVENTORY') {
      data = vehicles;
    } else if (activeTab === 'AUDIT') {
      data = auditData;
    } else if (activeTab === 'IN_OUT') {
      data = movementsData;
    } else if (activeTab === 'NON_PRODUCTIVE') {
      // Filtrar movimientos que NO sean ALQUILER (ej. TALLER, TRASLADO, etc)
      data = movementsData.filter(m => m.motivo !== 'ALQUILER');
    }

    // 2. Aplicar Filtros
    return data.filter(item => {
      // A. Filtro de Texto Global (Busca en múltiples columnas)
      const term = searchText.toUpperCase();
      const textMatch = 
        (item.unitNumber || item.unidad || '').includes(term) ||
        (item.licensePlate || item.placa || '').includes(term) ||
        (item.make || '').toUpperCase().includes(term) ||
        (item.model || '').toUpperCase().includes(term) ||
        (item.driver || item.conductor || '').toUpperCase().includes(term) ||
        (item.notes || item.obs || item.notas || '').toUpperCase().includes(term);

      if (!textMatch) return false;

      // B. Filtro de Ubicación
      if (locationFilter !== 'ALL') {
        const loc = (item.location || item.ubi || item.origen || '').toUpperCase();
        // Nota: En movimientos, filtramos por Origen O Destino
        const locDest = (item.destino || '').toUpperCase();
        
        if (activeTab === 'IN_OUT' || activeTab === 'NON_PRODUCTIVE') {
           if (loc !== locationFilter && locDest !== locationFilter) return false;
        } else {
           if (!loc.includes(locationFilter)) return false;
        }
      }

      // C. Filtro de Estado (Solo Inventario)
      if (activeTab === 'INVENTORY' && statusFilter !== 'ALL') {
         if (item.status !== statusFilter) return false;
      }

      // D. Filtro de Fecha (Para todo MENOS Inventario actual)
      if (activeTab !== 'INVENTORY') {
        const dateStr = item.created_at;
        if (dateFrom) {
          if (new Date(dateStr) < new Date(dateFrom + 'T00:00:00')) return false;
        }
        if (dateTo) {
          if (new Date(dateStr) > new Date(dateTo + 'T23:59:59')) return false;
        }
      }

      return true;
    });
  }, [activeTab, vehicles, auditData, movementsData, searchText, locationFilter, statusFilter, dateFrom, dateTo]);

  // --- EXPORTAR A EXCEL ---
  const handleExport = () => {
    const data = getFilteredData;
    if (data.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    let headers: string[] = [];
    let title = "";

    // Definir cabeceras según reporte
    if (activeTab === 'INVENTORY') {
      title = "Reporte de Inventario";
      headers = ['Unidad', 'Placa', 'VIN', 'Marca', 'Modelo', 'Año', 'Color', 'Clase', 'Ubicación', 'Estado', 'Combustible', 'Kilometraje'];
    } else if (activeTab === 'AUDIT') {
      title = "Reporte de Cuadre";
      headers = ['Fecha', 'Hora', 'Unidad', 'Placa', 'Posición Física', 'Observaciones'];
    } else {
      title = activeTab === 'IN_OUT' ? "Reporte Entradas/Salidas" : "Reporte Movimientos No Productivos";
      headers = ['Fecha', 'Hora', 'Tipo', 'Unidad', 'Placa', 'Origen', 'Destino', 'Conductor', 'Kilometraje', 'Combustible', 'Orden', 'Motivo', 'Notas'];
    }

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
      <h3>${title}</h3>
      <table border="1">
        <thead>
          <tr style="background-color: #f0f0f0;">
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(item => {
      tableHTML += "<tr>";
      
      if (activeTab === 'INVENTORY') {
        tableHTML += `
          <td>${item.unitNumber || ''}</td>
          <td>${item.licensePlate || ''}</td>
          <td>${item.vin || ''}</td>
          <td>${item.make || ''}</td>
          <td>${item.model || ''}</td>
          <td>${item.year || ''}</td>
          <td>${item.color || ''}</td>
          <td>${item.class || ''}</td>
          <td>${item.location || ''}</td>
          <td>${item.status || ''}</td>
          <td>${item.fuelLevel}/8</td>
          <td>${item.odometer}</td>
        `;
      } else if (activeTab === 'AUDIT') {
        const d = new Date(item.created_at);
        tableHTML += `
          <td>${d.toLocaleDateString()}</td>
          <td>${d.toLocaleTimeString()}</td>
          <td>${item.unidad || ''}</td>
          <td>${item.placa || ''}</td>
          <td>${item.ubi || ''}</td>
          <td>${item.obs || ''}</td>
        `;
      } else {
        const d = new Date(item.created_at);
        const tipo = item.in_out === 'OUT' ? 'SALIDA' : 'ENTRADA';
        tableHTML += `
          <td>${d.toLocaleDateString()}</td>
          <td>${d.toLocaleTimeString()}</td>
          <td>${tipo}</td>
          <td>${item.unidad || ''}</td>
          <td>${item.placa || ''}</td>
          <td>${item.origen || ''}</td>
          <td>${item.destino || ''}</td>
          <td>${item.conductor || ''}</td>
          <td>${item.kilometraje || ''}</td>
          <td>${item.combustible}/8</td>
          <td>${item.orden || ''}</td>
          <td>${item.motivo || ''}</td>
          <td>${item.notas || ''}</td>
        `;
      }
      tableHTML += "</tr>";
    });

    tableHTML += "</tbody></table></body></html>";

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- OBTENER LISTA DE UBICACIONES PARA FILTRO ---
  const locationsList = useMemo(() => {
    const locs = new Set<string>();
    // Mezclamos locaciones de vehículos y de movimientos
    vehicles.forEach(v => v.location && locs.add(v.location));
    movementsData.forEach(m => {
       if (m.origen) locs.add(m.origen);
       if (m.destino) locs.add(m.destino);
    });
    return Array.from(locs).sort();
  }, [vehicles, movementsData]);

  // --- RENDERIZADO DE TABLAS ---

  const renderTable = () => {
    const data = getFilteredData;

    if (data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
           <Filter size={48} className="mb-2 opacity-20" />
           <p>No se encontraron datos con los filtros seleccionados.</p>
        </div>
      );
    }

    // 1. TABLA INVENTARIO
    if (activeTab === 'INVENTORY') {
      return (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
             <tr>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unidad</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Placa</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vehículo</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ubicación</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Km</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Comb.</th>
             </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {data.map((item, i) => (
               <tr key={item.id || i} className="hover:bg-gray-50">
                 <td className="px-4 py-2 font-bold text-gray-900">{item.unitNumber}</td>
                 <td className="px-4 py-2 font-mono text-gray-700">{item.licensePlate}</td>
                 <td className="px-4 py-2 text-sm text-gray-600">{item.make} {item.model} <span className="text-xs text-gray-400">({item.color})</span></td>
                 <td className="px-4 py-2 text-sm font-medium text-gray-700">{item.location}</td>
                 <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      item.status === 'DISPONIBLE' ? 'bg-green-100 text-green-700' :
                      item.status === 'ALQUILADO' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.status}
                    </span>
                 </td>
                 <td className="px-4 py-2 text-sm font-mono text-gray-600">{item.odometer}</td>
                 <td className="px-4 py-2 text-sm text-gray-600">{item.fuelLevel}/8</td>
               </tr>
             ))}
          </tbody>
        </table>
      );
    }

    // 2. TABLA CUADRE
    if (activeTab === 'AUDIT') {
      return (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
             <tr>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unidad</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Placa</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Posición Física</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Observaciones</th>
             </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {data.map((item, i) => (
               <tr key={item.id || i} className="hover:bg-gray-50">
                 <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                 </td>
                 <td className="px-4 py-2 font-bold text-gray-900">{item.unidad}</td>
                 <td className="px-4 py-2 font-mono text-gray-700">{item.placa}</td>
                 <td className="px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50/50">{item.ubi}</td>
                 <td className="px-4 py-2 text-sm text-gray-600 italic">{item.obs || '-'}</td>
               </tr>
             ))}
          </tbody>
        </table>
      );
    }

    // 3. TABLA ENTRADAS/SALIDAS y NO PRODUCTIVOS
    return (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
             <tr>
               <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase w-10">Tipo</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unidad</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Placa</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ruta</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Conductor</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Motivo</th>
               <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Km</th>
             </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {data.map((item, i) => {
               const isOut = item.in_out === 'OUT';
               return (
               <tr key={item.id || i} className="hover:bg-gray-50">
                 <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isOut ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {isOut ? 'SALIDA' : 'ENTRADA'}
                    </span>
                 </td>
                 <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                 </td>
                 <td className="px-4 py-2 font-bold text-gray-900">{item.unidad}</td>
                 <td className="px-4 py-2 font-mono text-gray-700">{item.placa}</td>
                 <td className="px-4 py-2 text-xs text-gray-600">
                    <div className="flex flex-col">
                       <span className="text-gray-400">{item.origen}</span>
                       <span className="font-bold">➔ {item.destino}</span>
                    </div>
                 </td>
                 <td className="px-4 py-2 text-sm text-gray-700 capitalize">{item.conductor?.toLowerCase()}</td>
                 <td className="px-4 py-2 text-sm text-gray-800 font-medium">
                    {item.motivo}
                    {item.orden && <span className="block text-xs text-blue-600 font-mono">#{item.orden}</span>}
                 </td>
                 <td className="px-4 py-2 text-sm font-mono text-gray-600">{item.kilometraje}</td>
               </tr>
             )})}
          </tbody>
        </table>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in bg-gray-50/50 p-2 md:p-0">
      
      {/* HEADER & TABS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">
         <div className="p-5 border-b border-gray-100 bg-[#003366] text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="bg-white/10 p-2 rounded-lg">
                  <FileText size={24} className="text-white" />
               </div>
               <div>
                  <h2 className="text-xl font-bold">Centro de Reportes</h2>
                  <p className="text-blue-200 text-xs">Generación y exportación de datos históricos</p>
               </div>
            </div>
            <div className="text-right hidden sm:block">
               <p className="text-xs text-blue-200">Registros: {getFilteredData.length}</p>
               <p className="text-[10px] text-blue-300">Actualizado: {lastUpdated.toLocaleTimeString()}</p>
            </div>
         </div>

         {/* NAVEGACIÓN DE PESTAÑAS */}
         <div className="flex overflow-x-auto bg-gray-50 border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('INVENTORY')}
              className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'INVENTORY' ? 'border-[#003366] text-[#003366] bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               <Car size={16} /> Inventario
            </button>
            <button 
              onClick={() => setActiveTab('AUDIT')}
              className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'AUDIT' ? 'border-[#003366] text-[#003366] bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               <ClipboardList size={16} /> Cuadre
            </button>
            <button 
              onClick={() => setActiveTab('IN_OUT')}
              className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'IN_OUT' ? 'border-[#003366] text-[#003366] bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               <ArrowRightLeft size={16} /> Entradas / Salidas
            </button>
            <button 
              onClick={() => setActiveTab('NON_PRODUCTIVE')}
              className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'NON_PRODUCTIVE' ? 'border-[#003366] text-[#003366] bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               <AlertTriangle size={16} /> No Productivos
            </button>
         </div>

         {/* BARRA DE FILTROS */}
         <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            
            {/* BUSCADOR GLOBAL */}
            <div className="lg:col-span-2 space-y-1">
               <label className="text-xs font-bold text-gray-500 ml-1">Búsqueda Global (Todas las columnas)</label>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Buscar placa, unidad, conductor..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                  />
               </div>
            </div>

            {/* FILTROS DE FECHA (Solo si no es Inventario) */}
            {activeTab !== 'INVENTORY' && (
               <>
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-500 ml-1">Desde</label>
                     <input 
                       type="date" 
                       value={dateFrom}
                       onChange={(e) => setDateFrom(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-500 ml-1">Hasta</label>
                     <input 
                       type="date" 
                       value={dateTo}
                       onChange={(e) => setDateTo(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                     />
                  </div>
               </>
            )}

            {/* FILTROS DE INVENTARIO (Solo si es Inventario) */}
            {activeTab === 'INVENTORY' && (
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 ml-1">Estado</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                  >
                     <option value="ALL">TODOS</option>
                     {availableStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                     ))}
                  </select>
               </div>
            )}

            {/* FILTRO UBICACION (Común) */}
            <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 ml-1">Ubicación</label>
               <select 
                 value={locationFilter}
                 onChange={(e) => setLocationFilter(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
               >
                  <option value="ALL">TODAS</option>
                  {locationsList.map(l => <option key={l} value={l}>{l}</option>)}
               </select>
            </div>

            {/* BOTONES ACCION */}
            <div className="flex gap-2 lg:col-span-1 justify-end w-full">
               <button 
                 onClick={loadData}
                 className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500"
                 title="Recargar datos"
               >
                 <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
               </button>
               <button 
                 onClick={handleExport}
                 className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
               >
                 <Download size={18} />
                 <span>Excel</span>
               </button>
            </div>
         </div>
      </div>

      {/* AREA DE TABLA */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
         <div className="flex-1 overflow-auto relative">
            {isLoading && (
               <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-brand-800 font-medium">Generando Reporte...</p>
               </div>
            )}
            {renderTable()}
         </div>
         <div className="bg-gray-50 border-t border-gray-200 p-2 text-xs text-gray-500 text-right">
            Mostrando {getFilteredData.length} registros
         </div>
      </div>

    </div>
  );
};

export default Reports;