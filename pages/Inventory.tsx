import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { 
  Search, 
  Filter, 
  Car, 
  MapPin, 
  Fuel, 
  List,
  Download,
  MoreVertical,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Hash,
  Tag,
  Save,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tab = 'view' | 'add' | 'maintenance';

const Inventory: React.FC = () => {
  const { vehicles, isLoading, refreshData } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // --- ESTADOS FORMULARIO AGREGAR ---
  const initialForm = {
    unitNumber: '',
    licensePlate: '',
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    color: '',
    class: 'SEDAN',
    location: 'MALEK',
    fuelLevel: '8',
    status: 'DISPONIBLE'
  };
  const [formData, setFormData] = useState(initialForm);
  const [formMessage, setFormMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Lista de ubicaciones basada en inventario actual
  const availableLocations = useMemo(() => {
    const defaultLocs = ['MALEK', 'TCPOPS', 'CHORRERA', 'TDA', 'DAVID', 'SANTIAGO', 'CHITRE', 'COLON', 'RIO HATO', 'AEROPUERTO PTY', 'ALBROOK'];
    const dbLocs = vehicles.map(v => v.location?.trim()).filter(l => l);
    const unique = new Set([...defaultLocs, ...dbLocs]);
    return Array.from(unique).sort();
  }, [vehicles]);

  // --- NUEVO: Lista dinámica de Estados basada en el inventario actual ---
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    vehicles.forEach(v => {
      if (v.status) {
        statuses.add(v.status.toUpperCase().trim());
      }
    });
    // Añadir estados por defecto por si no hay vehículos con ellos aun
    statuses.add('DISPONIBLE');
    statuses.add('ALQUILADO');
    statuses.add('MANTENIMIENTO');
    
    return Array.from(statuses).sort();
  }, [vehicles]);

  // Filtrado de datos
  const filteredVehicles = vehicles.filter(vehicle => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (vehicle.unitNumber || '').toLowerCase().includes(term) ||
      (vehicle.make || '').toLowerCase().includes(term) ||
      (vehicle.model || '').toLowerCase().includes(term) ||
      (vehicle.licensePlate || '').toLowerCase().includes(term) ||
      (vehicle.vin || '').toLowerCase().includes(term) ||
      (vehicle.location || '').toLowerCase().includes(term) ||
      (vehicle.product || '').toLowerCase().includes(term);
    
    // Comparación exacta ignorando mayúsculas
    const matchesStatus = statusFilter === 'ALL' || vehicle.status?.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Lógica de Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVehicles = filteredVehicles.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Función para obtener color según estado
  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase().trim();
    if (s === 'DISPONIBLE') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'ALQUILADO') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'RESERVADO') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (s === 'MANTENIMIENTO' || s === 'TALLER') return 'bg-red-100 text-red-800 border-red-200';
    if (s === 'VENDIDO' || s === 'BAJA') return 'bg-gray-800 text-white border-gray-600';
    if (s.includes('TRANSITO')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Renderizar barra de combustible
  const renderFuel = (level: number) => {
    // Normalizar a 0-8
    const safeLevel = isNaN(level) ? 0 : level;
    const percentage = (safeLevel / 8) * 100;
    let colorClass = 'bg-green-500';
    if (safeLevel <= 2) colorClass = 'bg-red-500';
    else if (safeLevel <= 4) colorClass = 'bg-yellow-500';

    return (
      <div className="flex items-center space-x-2" title={`${safeLevel}/8 Octavos`}>
        <Fuel size={14} className="text-gray-400" />
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${colorClass}`} 
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600">{safeLevel}/8</span>
      </div>
    );
  };

  // LOGICA PARA AGREGAR VEHICULO
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);

    try {
       // Validaciones básicas
       if(!formData.unitNumber || !formData.licensePlate || !formData.make || !formData.model) {
         throw new Error("Campos obligatorios: Unidad, Placa, Marca, Modelo");
       }

       const payload = {
          unit_number: formData.unitNumber.toUpperCase().trim(),
          license_plate: formData.licensePlate.toUpperCase().trim(),
          vin: formData.vin.toUpperCase().trim(),
          make: formData.make.toUpperCase().trim(),
          model: formData.model.toUpperCase().trim(),
          year: parseInt(formData.year) || new Date().getFullYear(),
          color: formData.color.toUpperCase().trim(),
          class: formData.class.toUpperCase().trim(),
          location: formData.location,
          fuel_level: parseInt(formData.fuelLevel),
          status: formData.status.toUpperCase(),
          odometer: 0,
          created_at: new Date().toISOString()
       };

       const { error } = await supabase.from('vehicles').insert([payload]);
       
       if(error) {
         if (error.code === '23505') throw new Error("Ya existe un vehículo con esa Unidad o Placa.");
         throw error;
       }

       setFormMessage({type: 'success', text: 'Vehículo registrado correctamente.'});
       setFormData(initialForm);
       refreshData(); // Actualizar lista global
       
    } catch (err: any) {
       setFormMessage({type: 'error', text: err.message || 'Error al guardar en base de datos.'});
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in">
      {/* Header y Títulos */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inventario de Flota</h2>
          <p className="text-gray-500 text-sm">Gestión completa de vehículos ({vehicles.length} registros totales)</p>
        </div>
        <div className="flex gap-2">
           <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-600 flex items-center shadow-sm">
             <Car className="w-4 h-4 mr-2 text-brand-600" />
             Total: <span className="text-brand-700 ml-1 font-bold">{vehicles.length}</span>
           </div>
        </div>
      </div>

      {/* Navegación de Pestañas */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('view')}
            className={`${
              activeTab === 'view'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <List className="w-4 h-4 mr-2" />
            Ver Inventario Completo
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`${
              activeTab === 'add'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Vehículo
          </button>
        </nav>
      </div>

      {/* Contenido de la Pestaña: Ver Inventario */}
      {activeTab === 'view' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
          
          {/* Barra de Herramientas / Buscador */}
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 rounded-t-xl flex-shrink-0">
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar Unidad, Placa, VIN o Modelo..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition duration-150 ease-in-out"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative flex items-center w-full md:w-auto">
                <Filter className="absolute left-3 h-4 w-4 text-gray-500 z-10" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-brand-500 focus:border-brand-500 appearance-none bg-white w-full cursor-pointer shadow-sm"
                >
                  <option value="ALL" className="font-bold">Todos los Estados</option>
                  {/* GENERACIÓN DINÁMICA DE ESTADOS */}
                  {availableStatuses.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de Datos */}
          <div className="flex-1 overflow-auto relative">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-white bg-opacity-90 z-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mb-3"></div>
                <p className="text-gray-500 animate-pulse">Cargando flota completa...</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unidad / VIN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Detalles Vehículo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Placa
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Combustible
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kilometraje
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentVehicles.length > 0 ? (
                    currentVehicles.map((vehicle, idx) => (
                      <tr key={vehicle.id || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-lg flex items-center">
                              {/* Eliminado Hash Icon */}
                              {vehicle.unitNumber}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono mt-1">
                              VIN: {vehicle.vin}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-bold">{vehicle.make} {vehicle.model}</div>
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                             <span className="mr-2">{vehicle.year}</span>
                             <span className="w-2 h-2 rounded-full inline-block mr-1 border border-gray-200" style={{backgroundColor: vehicle.color || '#ccc'}}></span>
                             {vehicle.color}
                             {vehicle.class && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] uppercase border border-gray-200">{vehicle.class}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex flex-col">
                             <div className="text-sm font-mono font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded w-fit border border-gray-200 mb-1">
                                {vehicle.licensePlate || 'S/P'}
                             </div>
                             {/* Eliminada visualización de producto/etiqueta */}
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg w-fit">
                            <MapPin size={14} className="mr-1 text-brand-500" />
                            {vehicle.location}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${getStatusColor(vehicle.status)}`}>
                            {vehicle.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renderFuel(vehicle.fuelLevel)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center font-mono">
                            <Gauge size={14} className="mr-1 text-gray-400" />
                            {vehicle.odometer.toLocaleString()} km
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-gray-400 hover:text-brand-600 transition-colors">
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <Car className="h-10 w-10 text-gray-300 mb-2" />
                          <p>No se encontraron vehículos.</p>
                          {(searchTerm || statusFilter !== 'ALL') && (
                             <button 
                               onClick={() => {setSearchTerm(''); setStatusFilter('ALL');}}
                               className="mt-2 text-brand-600 hover:underline text-sm"
                             >
                               Limpiar filtros
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Footer / Paginación */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6 flex-shrink-0">
             <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{indexOfFirstItem + 1}</span> a <span className="font-medium">{Math.min(indexOfLastItem, filteredVehicles.length)}</span> de <span className="font-medium">{filteredVehicles.length}</span> resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <span className="sr-only">Anterior</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    
                    {/* Indicador de página simple para ahorrar espacio */}
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      Página {currentPage} de {totalPages || 1}
                    </span>

                    <button
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages || totalPages === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <span className="sr-only">Siguiente</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
             </div>
             {/* Mobile View Pagination */}
             <div className="flex items-center justify-between w-full sm:hidden">
                <button
                   onClick={() => paginate(Math.max(1, currentPage - 1))}
                   disabled={currentPage === 1}
                   className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === 1 ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white hover:bg-gray-50'}`}
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                   onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                   disabled={currentPage === totalPages}
                   className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === totalPages ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white hover:bg-gray-50'}`}
                >
                  Siguiente
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Formulario de Agregar Nuevo Vehículo */}
      {activeTab === 'add' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col flex-1 max-w-4xl mx-auto w-full">
           <div className="bg-brand-600 p-6 flex items-center justify-between">
             <div className="flex items-center space-x-3">
               <div className="bg-white/20 p-2 rounded-lg text-white">
                 <Plus size={24} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white">Registro de Nuevo Vehículo</h3>
                  <p className="text-brand-100 text-sm">Ingrese los datos para dar de alta la unidad en el sistema.</p>
               </div>
             </div>
           </div>

           <div className="p-8">
              {formMessage && (
                <div className={`mb-6 p-4 rounded-xl flex items-center shadow-sm ${formMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                   {formMessage.type === 'success' ? <CheckCircle2 className="mr-2"/> : <AlertCircle className="mr-2"/>}
                   <span className="font-medium">{formMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleAddVehicle} className="space-y-6">
                 {/* FILA 1: IDENTIFICACIÓN */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">No. Unidad <span className="text-red-500">*</span></label>
                       <input 
                         type="text" 
                         value={formData.unitNumber}
                         onChange={e => setFormData({...formData, unitNumber: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 font-bold placeholder-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none uppercase"
                         placeholder="Ej. 202305"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Placa <span className="text-red-500">*</span></label>
                       <input 
                         type="text" 
                         value={formData.licensePlate}
                         onChange={e => setFormData({...formData, licensePlate: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 font-bold placeholder-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none uppercase"
                         placeholder="Ej. CK1234"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">VIN / Chasis</label>
                       <input 
                         type="text" 
                         value={formData.vin}
                         onChange={e => setFormData({...formData, vin: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 font-mono placeholder-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none uppercase"
                         placeholder="XXXXXXXXXXXXXXXXX"
                         maxLength={17}
                       />
                    </div>
                 </div>

                 <div className="border-t border-gray-100 my-4"></div>

                 {/* FILA 2: DETALLES */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Marca <span className="text-red-500">*</span></label>
                       <input 
                         type="text" 
                         value={formData.make}
                         onChange={e => setFormData({...formData, make: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                         placeholder="TOYOTA"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Modelo <span className="text-red-500">*</span></label>
                       <input 
                         type="text" 
                         value={formData.model}
                         onChange={e => setFormData({...formData, model: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                         placeholder="YARIS"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Año</label>
                       <input 
                         type="number" 
                         value={formData.year}
                         onChange={e => setFormData({...formData, year: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Color</label>
                       <input 
                         type="text" 
                         value={formData.color}
                         onChange={e => setFormData({...formData, color: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                         placeholder="BLANCO"
                       />
                    </div>
                 </div>

                 <div className="border-t border-gray-100 my-4"></div>

                 {/* FILA 3: ESTADO INICIAL */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Ubicación Inicial</label>
                       <select 
                          value={formData.location}
                          onChange={e => setFormData({...formData, location: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                       >
                          {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Estado Inicial</label>
                       <select 
                          value={formData.status}
                          onChange={e => setFormData({...formData, status: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                       >
                          <option value="DISPONIBLE">DISPONIBLE</option>
                          <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                          <option value="TALLER">TALLER</option>
                          <option value="ALQUILADO">ALQUILADO</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 uppercase">Nivel Combustible</label>
                       <select 
                          value={formData.fuelLevel}
                          onChange={e => setFormData({...formData, fuelLevel: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                       >
                          <option value="8">8/8 - LLENO</option>
                          <option value="7">7/8</option>
                          <option value="6">6/8</option>
                          <option value="5">5/8</option>
                          <option value="4">4/8 - MEDIO</option>
                          <option value="2">2/8</option>
                          <option value="0">0/8 - VACIO</option>
                       </select>
                    </div>
                 </div>

                 <div className="pt-6 flex justify-end">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 flex items-center"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save size={20} className="mr-2" />
                          GUARDAR VEHÍCULO
                        </>
                      )}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;