import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Vehicle } from '../types';
import { 
  Search, 
  MapPin, 
  X,
  AlertCircle, 
  CheckCircle2, 
  Camera,
  FileText,
  Trash2,
  PlusCircle,
  Car,
  Save,
  Pencil,
  RotateCcw,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import jsQR from 'jsqr';

// Interfaz para los items en la lista de sesión
interface AuditItem {
  dbId?: number; // ID real de base de datos
  tempId: string;
  unit: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  status: string;
  generalLoc: string;
  specificLoc: string; // Posición física
  notes: string;
}

const Audit: React.FC = () => {
  const { vehicles, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  
  // Lista de Sesión: Inicializar desde LocalStorage para persistencia
  const [auditList, setAuditList] = useState<AuditItem[]>(() => {
    try {
      const saved = localStorage.getItem('rotor_audit_session');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  // Mensajes de estado
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados y Refs para Cámara
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Formulario de Ubicación (Para vehículos existentes)
  const [locationForm, setLocationForm] = useState({
    general: '',
    specific: '', 
    notes: ''
  });

  // Formulario Nuevo Vehículo (Extendido)
  const [newVehicleForm, setNewVehicleForm] = useState({
    plate: '',
    unitNumber: '',
    make: '',
    model: '',
    color: '',
    year: new Date().getFullYear().toString(),
    status: 'DISPONIBLE'
  });

  // Persistir la lista cada vez que cambie
  useEffect(() => {
    localStorage.setItem('rotor_audit_session', JSON.stringify(auditList));
  }, [auditList]);

  // Generar lista de ubicaciones
  const availableLocations = useMemo(() => {
    const defaultLocs = ['MALEK', 'TCPOPS', 'CHORRERA', 'TDA', 'DAVID', 'SANTIAGO', 'CHITRE', 'COLON', 'RIO HATO', 'AEROPUERTO PTY'];
    const dbLocs = vehicles.map(v => v.location?.trim()).filter(l => l);
    const unique = new Set([...defaultLocs, ...dbLocs]);
    return Array.from(unique).sort();
  }, [vehicles]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Lógica de búsqueda (Efecto Debounce)
  useEffect(() => {
    const term = searchTerm.trim().toUpperCase().replace(/-/g, '');
    
    if (term.length < 2) {
      setFoundVehicle(null);
      setShowNewForm(false);
      return;
    }

    const delaySearch = setTimeout(() => {
      performSearch(term);
    }, 400);

    return () => clearTimeout(delaySearch);
  }, [searchTerm, vehicles]);

  const performSearch = (term: string) => {
    // Buscar por PLACA o UNIDAD
    const found = vehicles.find(v => {
       const vPlate = (v.licensePlate || '').toUpperCase().replace(/-/g, '');
       const vUnit = (v.unitNumber || '').toUpperCase();
       return vPlate === term || vUnit === term;
    });

    if (found) {
      // Si ya está en la lista temporal, permitimos editar/ver
      if (!foundVehicle || foundVehicle.id !== found.id) {
        setFoundVehicle(found);
        setShowNewForm(false);
        setLocationForm({
          general: found.location || availableLocations[0], 
          specific: '', 
          notes: ''
        });
        setMessage(null);
      }
    } else {
      setFoundVehicle(null);
      // Si el término es largo, asumimos que quiere crear uno nuevo
      if (term.length > 2) {
        setShowNewForm(true);
        // Pre-llenar placa o unidad según parezca
        const isUnitLike = /^\d+$/.test(term); // Si son solo números, parece unidad
        setNewVehicleForm(prev => ({ 
          ...prev, 
          plate: isUnitLike ? '' : term,
          unitNumber: isUnitLike ? term : '',
          make: '', model: '', color: '', year: new Date().getFullYear().toString(), status: 'DISPONIBLE'
        }));
        // Reset location form for new vehicle
        setLocationForm({ general: availableLocations[0], specific: '', notes: '' });
      } else {
        setShowNewForm(false);
      }
    }
  };

  // --- ACCIONES (GUARDADO AUTOMÁTICO) ---

  const handleAddAndSave = async () => {
    if (!foundVehicle) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // 1. Preparar datos para BD
      const dbData = {
        unidad: foundVehicle.unitNumber || 'S/N',
        placa: foundVehicle.licensePlate || 'S/P',
        ubi: locationForm.specific.toUpperCase(), // Posición Física
        obs: locationForm.notes,
        created_at: new Date().toISOString()
      };

      // 2. GUARDADO AUTOMÁTICO EN 'cuadre'
      const { data, error } = await supabase
        .from('cuadre')
        .insert([dbData])
        .select();

      if (error) throw error;

      // 3. Agregar a la lista VISUAL de sesión
      const newItem: AuditItem = {
        dbId: data[0].id,
        tempId: Date.now().toString(),
        unit: foundVehicle.unitNumber || 'S/N',
        plate: foundVehicle.licensePlate || 'S/P',
        make: foundVehicle.make,
        model: foundVehicle.model,
        color: foundVehicle.color,
        status: foundVehicle.status || 'Desconocido',
        generalLoc: foundVehicle.location,
        specificLoc: locationForm.specific.toUpperCase(),
        notes: locationForm.notes
      };

      // Agregar al final
      setAuditList(prev => [...prev, newItem]); 
      
      // Limpiar formulario para el siguiente
      setSearchTerm('');
      setFoundVehicle(null);
      setLocationForm({ general: '', specific: '', notes: '' });
      setMessage({ type: 'success', text: 'Registro guardado.' });

    } catch (error: any) {
      console.error("Error saving:", error);
      setMessage({ type: 'error', text: 'Error al guardar: ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterNewAndAdd = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
       // 1. Guardar el NUEVO vehículo en la tabla maestra 'vehicles'
       const newVehicleData = {
         license_plate: newVehicleForm.plate.toUpperCase(),
         unit_number: newVehicleForm.unitNumber.toUpperCase() || 'S/N',
         make: newVehicleForm.make.toUpperCase(),
         model: newVehicleForm.model.toUpperCase(),
         color: newVehicleForm.color.toUpperCase(),
         status: newVehicleForm.status,
         year: parseInt(newVehicleForm.year) || new Date().getFullYear(),
         location: locationForm.general || availableLocations[0],
         created_at: new Date().toISOString()
       };

       const { error: vehicleError } = await supabase.from('vehicles').insert([newVehicleData]);
       if (vehicleError) throw vehicleError;

       // 2. GUARDADO AUTOMÁTICO EN 'cuadre'
       const cuadreData = {
        unidad: newVehicleData.unit_number,
        placa: newVehicleData.license_plate,
        ubi: locationForm.specific.toUpperCase(),
        obs: locationForm.notes,
        created_at: new Date().toISOString()
       };

       const { data: cuadreRes, error: cuadreError } = await supabase
        .from('cuadre')
        .insert([cuadreData])
        .select();

       if (cuadreError) throw cuadreError;

       // 3. Agregar a lista VISUAL
       const newItem: AuditItem = {
         dbId: cuadreRes[0].id,
         tempId: Date.now().toString(),
         unit: newVehicleData.unit_number,
         plate: newVehicleData.license_plate,
         make: newVehicleData.make,
         model: newVehicleData.model,
         color: newVehicleData.color,
         status: newVehicleData.status,
         generalLoc: newVehicleData.location,
         specificLoc: locationForm.specific.toUpperCase(),
         notes: locationForm.notes
       };

       setAuditList(prev => [...prev, newItem]);
       
       // Refrescar datos globales
       refreshData(); 
       
       // Limpiar
       setSearchTerm('');
       setShowNewForm(false);
       setMessage({ type: 'success', text: 'Vehículo creado y guardado.' });
       
    } catch (error: any) {
       const errorText = error?.message || (typeof error === 'string' ? error : 'Error al registrar');
       setMessage({ type: 'error', text: 'Error: ' + errorText });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: AuditItem, confirmDelete = true) => {
    if (confirmDelete && !confirm("¿Borrar este registro?")) return;

    // Eliminamos de la BD
    if (item.dbId) {
      try {
        const { error } = await supabase.from('cuadre').delete().eq('id', item.dbId);
        if (error) {
           console.error("Error deleting from DB", error);
           setMessage({ type: 'error', text: 'Error al borrar de BD.' });
           return;
        }
      } catch (err: any) {
        console.error(err);
      }
    }
    
    // Eliminamos de la lista local
    setAuditList(prev => prev.filter(i => i.tempId !== item.tempId));
    if(confirmDelete) setMessage({ type: 'success', text: 'Registro eliminado.' });
  };

  const handleEditItem = (item: AuditItem) => {
    // 1. Buscamos el vehículo original para tener todos sus datos
    const vehicle = vehicles.find(v => v.unitNumber === item.unit || v.licensePlate === item.plate);
    
    // 2. Si existe, lo ponemos en el formulario "Encontrado"
    if (vehicle) {
        setFoundVehicle(vehicle);
        // Cargamos los datos que tenía el item
        setLocationForm({
            general: vehicle.location || '',
            specific: item.specificLoc,
            notes: item.notes
        });
        
        // 3. Lo borramos de la lista (y BD) para que sea como "Traerlo al formulario"
        // Pasamos false para no pedir confirmación, ya que es una acción de editar
        handleDeleteItem(item, false); 
        
        // Scroll hacia arriba
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        setMessage({ type: 'error', text: 'No se encontraron detalles del vehículo para editar.' });
    }
  };

  // --- NUEVA FUNCIÓN: LIMPIAR LISTA (INMEDIATA) ---
  const handleClearList = () => {
    // 1. Limpiar Estado Principal
    setAuditList([]);
    // 2. Limpiar LocalStorage Explícitamente
    localStorage.setItem('rotor_audit_session', JSON.stringify([]));
    
    // 3. Limpiar Estados de Búsqueda y Formularios para evitar residuos
    setSearchTerm('');
    setFoundVehicle(null);
    setShowNewForm(false);
    setLocationForm({ general: '', specific: '', notes: '' });
    setNewVehicleForm({
        plate: '',
        unitNumber: '',
        make: '',
        model: '',
        color: '',
        year: new Date().getFullYear().toString(),
        status: 'DISPONIBLE'
    });
    
    // 4. Feedback
    setMessage({ type: 'success', text: 'Lista vaciada correctamente.' });
  };

  // --- LOGICA DE CÁMARA ---
  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); 
        videoRef.current.play();
        requestRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'No se pudo acceder a la cámara.' });
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsScanning(false);
  };

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) {
          let scannedText = code.data.toUpperCase();
          
          // --- LÓGICA DE LIMPIEZA DE QR ---
          const regex = /\b(?=[A-Z])(?=.*\d)[A-Z0-9]{6}\b/;
          const match = scannedText.match(regex);
          
          if (match) {
             scannedText = match[0];
          } else {
             const simpleRegex = /\b[A-Z][A-Z0-9]{5}\b/;
             const simpleMatch = scannedText.match(simpleRegex);
             const blockList = ['TOYOTA', 'NISSAN', 'SUZUKI', 'HYUNDA', 'MANUAL', 'AUTOM', 'SEDAN'];
             if (simpleMatch && !blockList.includes(simpleMatch[0])) {
                scannedText = simpleMatch[0];
             }
          }

          stopCamera();
          setSearchTerm(scannedText);
          performSearch(scannedText);
          return;
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  };
  
  useEffect(() => { return () => { stopCamera(); }; }, []);

  // Función auxiliar para color de status
  const getStatusBadgeColor = (status: string) => {
      const s = (status || '').toUpperCase();
      if (s === 'DISPONIBLE') return 'bg-green-500';
      if (s === 'ALQUILADO') return 'bg-blue-500';
      if (s === 'MANTENIMIENTO' || s === 'TALLER') return 'bg-red-500';
      return 'bg-gray-500';
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 px-2 md:px-4 relative">
      
      {/* OVERLAY CAMARA */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
           <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden border border-gray-700">
              <button onClick={stopCamera} className="absolute top-4 right-4 z-10 bg-white/20 p-2 rounded-full text-white"><X size={24} /></button>
              <video ref={videoRef} className="w-full h-auto" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-brand-500 opacity-50 rounded-2xl pointer-events-none"></div>
              <p className="absolute bottom-6 left-0 right-0 text-center text-white bg-black/50 py-1">Escaneando QR...</p>
           </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 mt-2 text-center">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Scanner de Cuadre</h2>
        <p className="text-xs text-gray-500">Los datos persisten hasta limpiar lista</p>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-6 group z-10">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-14 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-lg font-normal text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all uppercase tracking-wider outline-none"
          placeholder="BUSCAR PLACA O UNIDAD"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          autoFocus
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          <button 
            onClick={startCamera}
            className="p-2 text-white bg-[#003366] hover:bg-[#002244] rounded-lg transition-colors shadow-sm"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      {/* MENSAJES */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl flex items-center justify-center shadow-sm text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <AlertCircle className="mr-2 h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* FORMULARIO: VEHÍCULO ENCONTRADO */}
      {foundVehicle && (
        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 overflow-hidden mb-8 animate-fade-in">
          <div className="bg-[#0f172a] pt-6 pb-4 px-6 text-center border-b border-slate-700">
             <div className="flex justify-center items-center gap-2 mb-2">
                <span className="bg-slate-700 border border-slate-600 text-white px-3 py-1 rounded-md text-xs font-bold shadow-sm uppercase tracking-wider">
                  Unidad: {foundVehicle.unitNumber}
                </span>
             </div>
             <h1 className="text-3xl font-bold text-white tracking-tight">
               {foundVehicle.licensePlate}
             </h1>
             <p className="text-sm text-slate-400 font-medium mt-1">
               {foundVehicle.make} {foundVehicle.model} • {foundVehicle.color}
             </p>
             
             {/* UBICACIÓN Y STATUS */}
             <div className="mt-3 flex justify-center items-center gap-3 flex-wrap">
                <div className="flex items-center text-xs font-normal text-slate-300 bg-slate-800 px-2 py-1 rounded">
                    <MapPin size={14} className="text-blue-400 mr-1" />
                    {foundVehicle.location} 
                </div>
                <div className="flex items-center text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
                    <div className={`w-2 h-2 rounded-full mr-1.5 ${getStatusBadgeColor(foundVehicle.status)}`}></div>
                    {foundVehicle.status}
                </div>
             </div>
          </div>

          <div className="p-6 space-y-4">
             <div className="space-y-1.5">
               <label className="text-xs font-bold text-white uppercase tracking-wider ml-1">Posición Física</label>
               <input 
                 type="text" 
                 value={locationForm.specific}
                 onChange={(e) => setLocationForm({...locationForm, specific: e.target.value})}
                 className="block w-full bg-white border-2 border-transparent focus:border-blue-500 rounded-xl py-3 px-4 text-lg font-bold text-gray-900 placeholder-gray-400 transition-all outline-none"
                 placeholder="Ej. A-12, FILA 4"
               />
             </div>

             <div className="space-y-1.5">
                <label className="text-xs font-bold text-white uppercase tracking-wider ml-1">Observaciones</label>
                <div className="relative">
                  <div className="absolute top-3 left-4 pointer-events-none">
                    <FileText className="text-gray-400 h-4 w-4" />
                  </div>
                  <textarea
                    rows={1}
                    value={locationForm.notes}
                    onChange={(e) => setLocationForm({...locationForm, notes: e.target.value})}
                    className="block w-full bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none"
                    placeholder="Notas adicionales..."
                  />
                </div>
             </div>
             
             <button 
               onClick={handleAddAndSave}
               className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
             >
               {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"/> : (
                 <>
                   <Save size={20} />
                   <span>GUARDAR</span>
                 </>
               )}
             </button>
          </div>
        </div>
      )}

      {/* FORMULARIO: NUEVO VEHÍCULO */}
      {showNewForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 animate-fade-in">
          <div className="bg-amber-400 p-4 flex justify-between items-center text-white">
            <div className="flex items-center space-x-2">
              <PlusCircle size={20} />
              <h3 className="font-bold">Registrar Nuevo Vehículo</h3>
            </div>
            <button onClick={() => setShowNewForm(false)} className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg"><X size={16}/></button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Placa</label>
                 <input 
                   type="text" 
                   value={newVehicleForm.plate}
                   onChange={(e) => setNewVehicleForm({...newVehicleForm, plate: e.target.value.toUpperCase()})}
                   className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-bold text-gray-900 uppercase"
                   placeholder="PLACA"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Unidad</label>
                 <input 
                   type="text" 
                   value={newVehicleForm.unitNumber}
                   onChange={(e) => setNewVehicleForm({...newVehicleForm, unitNumber: e.target.value.toUpperCase()})}
                   className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-bold text-gray-900 uppercase"
                   placeholder="UNIDAD"
                 />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Marca</label>
                    <input 
                      type="text" value={newVehicleForm.make}
                      onChange={(e) => setNewVehicleForm({...newVehicleForm, make: e.target.value.toUpperCase()})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                      placeholder="TOYOTA"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Modelo</label>
                    <input 
                      type="text" value={newVehicleForm.model}
                      onChange={(e) => setNewVehicleForm({...newVehicleForm, model: e.target.value.toUpperCase()})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                      placeholder="YARIS"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Año</label>
                    <input 
                      type="number" value={newVehicleForm.year}
                      onChange={(e) => setNewVehicleForm({...newVehicleForm, year: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Color</label>
                    <input 
                      type="text" value={newVehicleForm.color}
                      onChange={(e) => setNewVehicleForm({...newVehicleForm, color: e.target.value.toUpperCase()})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                      placeholder="BLANCO"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                    <select 
                      value={newVehicleForm.status}
                      onChange={(e) => setNewVehicleForm({...newVehicleForm, status: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                    >
                        <option value="DISPONIBLE">DISP</option>
                        <option value="MANTENIMIENTO">MANT</option>
                        <option value="TALLER">TALLER</option>
                        <option value="ALQUILADO">ALQ</option>
                    </select>
                </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-700 uppercase">Posición Física</label>
                  <input 
                    type="text" 
                    value={locationForm.specific}
                    onChange={(e) => setLocationForm({...locationForm, specific: e.target.value})}
                    className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-sm font-bold text-gray-900"
                    placeholder="Ej. FILA 1"
                  />
                </div>
            </div>

            <button 
              onClick={handleRegisterNewAndAdd}
              disabled={isSaving}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-3.5 rounded-lg shadow-sm transition-colors uppercase tracking-wide flex justify-center items-center"
            >
              {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"/> : "GUARDAR"}
            </button>
          </div>
        </div>
      )}

      {/* LISTA DE CUADRE (ESTILO EXCEL / GRID COMPACTO) */}
      <div className="space-y-3">
         <div className="flex justify-between items-end px-1 border-b border-gray-200 pb-2">
            <h3 className="text-gray-700 font-bold flex items-center">
               {/* Hash eliminado por solicitud */}
               Lista de Cuadre ({auditList.length})
            </h3>
            
            <div className="flex gap-2">
              {auditList.length > 0 && (
                  <button 
                    type="button"
                    onClick={handleClearList}
                    className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center"
                    title="Limpiar lista visual sin confirmar"
                  >
                    <Trash2 size={14} className="mr-1"/>
                    LIMPIAR LISTA
                  </button>
              )}
            </div>
         </div>

         {/* GRID / TABLE CONTAINER */}
         {auditList.length === 0 ? (
             <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
                 <Car className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                 <p className="text-gray-400 text-sm">Escanee vehículos para comenzar.</p>
             </div>
         ) : (
             <div className="overflow-x-auto rounded border border-gray-400 shadow-sm">
                 <table className="min-w-full border-collapse border border-gray-400">
                    <thead className="bg-gray-100">
                       <tr>
                          <th className="border border-gray-400 px-2 py-1 text-center text-xs font-bold text-gray-700 uppercase w-8">#</th>
                          <th className="border border-gray-400 px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase">Placa</th>
                          <th className="border border-gray-400 px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase">Vehículo</th>
                          <th className="border border-gray-400 px-2 py-1 text-center text-xs font-bold text-gray-700 uppercase">Estado</th>
                          <th className="border border-gray-400 px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase">Posición</th>
                          <th className="border border-gray-400 px-2 py-1 text-center text-xs font-bold text-gray-700 uppercase w-20">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="bg-white">
                       {auditList.map((item, index) => (
                          <tr key={item.tempId} className="hover:bg-blue-50 transition-colors">
                             <td className="border border-gray-400 px-2 py-1 text-xs text-center text-gray-600 font-medium">
                                {index + 1}
                             </td>
                             <td className="border border-gray-400 px-2 py-1 text-xs text-gray-900 font-bold whitespace-nowrap">
                                {item.plate}
                             </td>
                             <td className="border border-gray-400 px-2 py-1 text-xs text-gray-700 whitespace-nowrap leading-tight">
                                {item.make} {item.model}
                                <div className="text-[10px] text-gray-500">{item.color}</div>
                             </td>
                             <td className="border border-gray-400 px-2 py-1 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getStatusBadgeColor(item.status)}`}>
                                    {item.status}
                                </span>
                             </td>
                             <td className="border border-gray-400 px-2 py-1 text-xs text-gray-800 font-semibold whitespace-nowrap bg-yellow-50/50">
                                {item.specificLoc || '-'}
                             </td>
                             <td className="border border-gray-400 px-1 py-1 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center space-x-2">
                                  <button 
                                    onClick={() => handleEditItem(item)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                    title="Editar (Mover al formulario)"
                                  >
                                     <Pencil size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteItem(item)}
                                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                                    title="Eliminar"
                                  >
                                     <Trash2 size={14} />
                                  </button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
             </div>
         )}
      </div>

    </div>
  );
};

export default Audit;