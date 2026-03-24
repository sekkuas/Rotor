import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Vehicle } from '../types';
import { supabase } from '../lib/supabase';
// @ts-ignore
import jsQR from 'jsqr';
import { 
  ArrowDown, 
  ArrowUp, 
  Search, 
  Camera, 
  X, 
  User, 
  Gauge, 
  Fuel, 
  MapPin, 
  FileText, 
  CalendarClock, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  ClipboardCheck
} from 'lucide-react';

type MovementType = 'OUT' | 'IN';

const InOut: React.FC = () => {
  const { vehicles, refreshData } = useData();
  
  // --- ESTADOS GENERALES ---
  const [movementType, setMovementType] = useState<MovementType>('OUT');
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- BUSQUEDA Y SCANNER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Refs para cámara
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- FORMULARIO ---
  const [formData, setFormData] = useState({
    odometer: '',
    fuelLevel: '8', // Por defecto Full
    driver: '',
    origin: '',
    destination: '',
    reason: 'ALQUILER', // Default
    orderNumber: '',
    notes: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- LISTAS Y OPCIONES ---
  const reasons = [
    { value: 'ALQUILER', label: 'Alquiler', requiresOrder: false },
    { value: 'TRASLADO', label: 'Traslado', requiresOrder: true },
    { value: 'NO_PRODUCTIVO', label: 'Movimiento No Productivo', requiresOrder: true },
    { value: 'TALLER', label: 'Taller / Mantenimiento', requiresOrder: false },
  ];

  const fuelOptions = [
    { value: '8', label: '8/8 - Lleno (F)', color: 'bg-green-500' },
    { value: '7', label: '7/8', color: 'bg-green-400' },
    { value: '6', label: '6/8 (3/4)', color: 'bg-green-300' },
    { value: '5', label: '5/8', color: 'bg-yellow-300' },
    { value: '4', label: '4/8 - Medio (1/2)', color: 'bg-yellow-500' },
    { value: '3', label: '3/8', color: 'bg-orange-300' },
    { value: '2', label: '2/8 (1/4)', color: 'bg-orange-500' },
    { value: '1', label: '1/8 (Reserva)', color: 'bg-red-500' },
    { value: '0', label: '0/8 - Vacío (E)', color: 'bg-red-600' },
  ];

  // Lista de ubicaciones basada en inventario actual
  const locationList = useMemo(() => {
    const defaultLocs = ['MALEK', 'TCPOPS', 'CHORRERA', 'TDA', 'DAVID', 'SANTIAGO', 'CHITRE', 'COLON', 'RIO HATO', 'AEROPUERTO PTY', 'ALBROOK'];
    const dbLocs = vehicles.map(v => v.location?.trim()).filter(l => l);
    const unique = new Set([...defaultLocs, ...dbLocs]);
    return Array.from(unique).sort();
  }, [vehicles]);

  // --- EFECTOS ---

  // Actualizar reloj
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Limpiar mensajes
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 8000); // Increased time to read errors
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Búsqueda (Debounce)
  useEffect(() => {
    const term = searchTerm.trim().toUpperCase().replace(/-/g, '');
    if (term.length < 2) {
      if (!selectedVehicle) setSelectedVehicle(null); // No limpiar si ya hay uno seleccionado manualmente
      return;
    }

    const delaySearch = setTimeout(() => {
      const found = vehicles.find(v => {
        const vPlate = (v.licensePlate || '').toUpperCase().replace(/-/g, '');
        const vUnit = (v.unitNumber || '').toUpperCase();
        return vPlate === term || vUnit === term;
      });

      if (found) {
        handleSelectVehicle(found);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchTerm, vehicles]);

  // --- LOGICA DEL FORMULARIO ---

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    
    // Configurar ubicaciones y datos iniciales según tipo de movimiento
    if (movementType === 'OUT') {
      // SALIDA: Origen es donde está el carro. Destino se elige.
      setFormData(prev => ({
        ...prev,
        odometer: vehicle.odometer.toString(),
        fuelLevel: vehicle.fuelLevel.toString(),
        origin: vehicle.location || 'Sin Asignar',
        destination: ''
      }));
    } else {
      // ENTRADA: Destino es donde está el carro (o donde se recibe). Origen se elige.
      // Normalmente al recibir, el destino es la sucursal actual del usuario, 
      // pero usaremos la del vehículo como referencia o dejaremos elegir.
      setFormData(prev => ({
        ...prev,
        odometer: vehicle.odometer.toString(),
        fuelLevel: vehicle.fuelLevel.toString(),
        origin: '', 
        destination: vehicle.location || '' // Asumimos que regresa a su base o se actualiza
      }));
    }
  };

  const handleReasonChange = (newReason: string) => {
    const reasonObj = reasons.find(r => r.value === newReason);
    setFormData(prev => ({
      ...prev,
      reason: newReason,
      // Si no requiere orden, limpiamos el campo
      orderNumber: reasonObj?.requiresOrder ? prev.orderNumber : ''
    }));
  };

  const validateForm = () => {
    if (!selectedVehicle) return "Seleccione un vehículo.";
    if (!formData.driver.trim()) return "El campo Conductor es obligatorio.";
    if (!formData.odometer) return "El Kilometraje es obligatorio.";
    
    const currentOdo = selectedVehicle.odometer || 0;
    const newOdo = parseInt(formData.odometer);
    if (isNaN(newOdo)) return "Kilometraje inválido.";
    if (newOdo < currentOdo && movementType === 'OUT') {
      // Advertencia leve, pero permitimos guardar si es corrección (o podríamos bloquear)
      // return "El kilometraje no puede ser menor al actual."; 
    }

    if (!formData.origin) return "Especifique el origen.";
    if (!formData.destination) return "Especifique el destino.";

    const reasonObj = reasons.find(r => r.value === formData.reason);
    if (reasonObj?.requiresOrder && !formData.orderNumber.trim()) {
      return `El número de orden es obligatorio para ${reasonObj.label}.`;
    }

    return null;
  };

  const handleSubmit = async () => {
    const errorMsg = validateForm();
    if (errorMsg) {
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // 1. Preparar datos para tabla 'in_out' (AQUÍ SÍ GUARDAMOS COMBUSTIBLE)
      const inOutData = {
        unidad: selectedVehicle!.unitNumber || 'S/N',
        placa: selectedVehicle!.licensePlate || 'S/P',
        origen: formData.origin,
        destino: formData.destination,
        conductor: formData.driver.toUpperCase(),
        combustible: parseInt(formData.fuelLevel), // Guardamos combustible aquí
        kilometraje: parseInt(formData.odometer),
        orden: formData.orderNumber,
        in_out: movementType, // 'IN' o 'OUT'
        motivo: formData.reason 
      };

      // 2. Insertar en tabla 'in_out'
      const { error: moveError } = await supabase.from('in_out').insert([inOutData]);
      
      if (moveError) {
        console.warn("Supabase Error:", moveError);
        // Mostrar el mensaje real de Supabase para facilitar la depuración
        throw new Error(`Error Supabase: ${moveError.message} (Código: ${moveError.code})`);
      }

      // 3. Actualizar el vehículo (Inventario)
      // - Actualizamos kilometraje, ubicación y estado
      // - NO ACTUALIZAMOS COMBUSTIBLE EN 'vehicles' para evitar el error
      const newLocation = movementType === 'OUT' ? formData.destination : formData.destination;
      
      // Determinar nuevo estado
      let newStatus = selectedVehicle!.status;
      if (movementType === 'OUT') {
         if (formData.reason === 'ALQUILER') newStatus = 'ALQUILADO';
         else if (formData.reason === 'TALLER') newStatus = 'MANTENIMIENTO';
         else newStatus = 'EN TRANSITO';
      } else {
         // Entrada: generalmente pasa a disponible a menos que entre directo a taller
         newStatus = 'DISPONIBLE'; 
      }

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          odometer: parseInt(formData.odometer),
          // SE ELIMINÓ LA ACTUALIZACIÓN DE COMBUSTIBLE EN LA TABLA VEHICLES
          location: newLocation,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('unit_number', selectedVehicle!.unitNumber); // Usamos unit_number como clave segura

      if (updateError) throw updateError;

      // 4. Exito
      setMessage({ 
        type: 'success', 
        text: `Movimiento de ${movementType === 'OUT' ? 'SALIDA' : 'ENTRADA'} registrado con éxito.` 
      });

      // Reset
      await refreshData();
      setSearchTerm('');
      setSelectedVehicle(null);
      setFormData({
        odometer: '',
        fuelLevel: '8',
        driver: '',
        origin: '',
        destination: '',
        reason: 'ALQUILER',
        orderNumber: '',
        notes: ''
      });

    } catch (error: any) {
      console.error("Error saving movement:", error);
      setMessage({ type: 'error', text: error.message || "Error desconocido al guardar." });
    } finally {
      setIsSaving(false);
    }
  };

  // --- CAMERA LOGIC (Igual que Audit.tsx) ---
  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
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
          const scannedText = code.data.toUpperCase();
          stopCamera();
          setSearchTerm(scannedText); // Esto dispara el useEffect de búsqueda
          return;
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  };
  
  useEffect(() => { return () => stopCamera(); }, []);

  // --- RENDER MAIN CONTENT ---
  const isOut = movementType === 'OUT';
  const themeColor = isOut ? 'red' : 'green'; // Color base para UI
  const themeBg = isOut ? 'bg-red-600' : 'bg-green-600';
  const themeLightBg = isOut ? 'bg-red-50' : 'bg-green-50';
  const themeBorder = isOut ? 'border-red-200' : 'border-green-200';

  return (
    <div className="max-w-4xl mx-auto pb-20 relative animate-fade-in">
      
      {/* CAMERA OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
           <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden border border-gray-700">
              <button onClick={stopCamera} className="absolute top-4 right-4 z-10 bg-white/20 p-2 rounded-full text-white"><X size={24} /></button>
              <video ref={videoRef} className="w-full h-auto" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-brand-500 opacity-50 rounded-2xl"></div>
              <p className="absolute bottom-6 left-0 right-0 text-center text-white bg-black/50 py-1">Escaneando QR...</p>
           </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Control de Movimientos</h2>
            <p className="text-sm text-gray-500">Registro de Salidas y Entradas de Flota</p>
          </div>
        </div>
        
        {/* FECHA Y HORA */}
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
          <CalendarClock className="text-brand-600" size={20} />
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium">Fecha de Registro</p>
            <p className="text-sm font-bold text-gray-900 leading-none">
              {currentDate.toLocaleDateString()} <span className="text-gray-400">|</span> {currentDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
        </div>
      </div>

      {/* SELECTOR TIPO MOVIMIENTO */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => { setMovementType('OUT'); setSelectedVehicle(null); setSearchTerm(''); }}
          className={`py-4 rounded-xl flex flex-col items-center justify-center transition-all duration-200 border-2 ${
            isOut 
              ? 'bg-red-50 border-red-500 shadow-md' 
              : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-400'
          }`}
        >
          <ArrowUp className={`w-8 h-8 mb-2 ${isOut ? 'text-red-600' : 'text-gray-300'}`} />
          <span className={`text-lg font-bold ${isOut ? 'text-red-700' : 'text-gray-500'}`}>SALIDA</span>
        </button>

        <button
          onClick={() => { setMovementType('IN'); setSelectedVehicle(null); setSearchTerm(''); }}
          className={`py-4 rounded-xl flex flex-col items-center justify-center transition-all duration-200 border-2 ${
            !isOut 
              ? 'bg-green-50 border-green-500 shadow-md' 
              : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-400'
          }`}
        >
          <ArrowDown className={`w-8 h-8 mb-2 ${!isOut ? 'text-green-600' : 'text-gray-300'}`} />
          <span className={`text-lg font-bold ${!isOut ? 'text-green-700' : 'text-gray-500'}`}>ENTRADA</span>
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-6 group z-10">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-14 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-lg font-normal text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 uppercase tracking-wider outline-none"
          placeholder="BUSCAR PLACA O UNIDAD"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
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
        <div className={`mb-6 p-4 rounded-xl flex items-center shadow-sm animate-fade-in ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="mr-2" /> : <AlertCircle className="mr-2" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* TARJETA DE VEHÍCULO SELECCIONADO */}
      {selectedVehicle && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6 animate-slide-up">
          <div className={`${themeBg} px-6 py-4 flex justify-between items-center text-white`}>
            <div>
              <h3 className="text-2xl font-bold tracking-wider">{selectedVehicle.licensePlate}</h3>
              <p className="text-white/80 text-sm font-medium">Unidad: {selectedVehicle.unitNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{selectedVehicle.make} {selectedVehicle.model}</p>
              <p className="text-white/80 text-sm">{selectedVehicle.color}</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMNA IZQUIERDA: Ubicaciones y Motivo */}
            <div className="space-y-5">
              
              {/* UBICACIONES */}
              <div className={`p-4 rounded-xl border ${themeBorder} ${themeLightBg}`}>
                <h4 className={`text-xs font-bold uppercase mb-3 flex items-center justify-center ${isOut ? 'text-red-700' : 'text-green-700'}`}>
                  <MapPin size={14} className="mr-1" />
                  Ruta de {isOut ? 'Salida' : 'Entrada'}
                </h4>
                
                <div className="flex flex-col gap-4">
                  <div className="space-y-1 w-full text-center">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Origen</label>
                    {isOut ? (
                      // Salida: Origen es readonly (donde está el carro)
                      <div className="w-full bg-white border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-sm font-medium shadow-sm text-center">
                        {formData.origin || 'Desconocido'}
                      </div>
                    ) : (
                      // Entrada: Origen es seleccionable
                      <select 
                        value={formData.origin}
                        onChange={(e) => setFormData({...formData, origin: e.target.value})}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm text-center"
                      >
                         <option value="">Seleccione...</option>
                         {locationList.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )}
                  </div>

                  {/* Sin Flecha Intermedia */}

                  <div className="space-y-1 w-full text-center">
                     <label className="text-[10px] font-bold text-gray-500 uppercase">Destino</label>
                     {isOut ? (
                       // Salida: Destino seleccionable
                       <select 
                         value={formData.destination}
                         onChange={(e) => setFormData({...formData, destination: e.target.value})}
                         className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm text-center"
                       >
                          <option value="">Seleccione...</option>
                          {locationList.map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                     ) : (
                       // Entrada: Destino es readonly (o seleccionable si queremos corregir donde llegó)
                       // Por simplicidad, permitimos seleccionar para confirmar donde se deja
                       <select 
                         value={formData.destination}
                         onChange={(e) => setFormData({...formData, destination: e.target.value})}
                         className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm text-center"
                       >
                          <option value="">Seleccione...</option>
                          {locationList.map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                     )}
                  </div>
                </div>
              </div>

              {/* MOTIVO */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                  <ClipboardCheck size={14} className="mr-1" />
                  Motivo del Movimiento
                </label>
                <select 
                  value={formData.reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                >
                  {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* NUMERO DE ORDEN (CONDICIONAL) */}
              {reasons.find(r => r.value === formData.reason)?.requiresOrder && (
                <div className="space-y-1 animate-fade-in">
                   <label className="text-xs font-bold text-brand-600 uppercase flex items-center">
                     <FileText size={14} className="mr-1" />
                     Número de Orden <span className="text-red-500 ml-1">*</span>
                   </label>
                   <input 
                     type="text"
                     value={formData.orderNumber}
                     onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                     className="w-full bg-white border-2 border-brand-100 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-brand-500 outline-none"
                     placeholder="Ej. TR-2023-885"
                   />
                </div>
              )}

            </div>

            {/* COLUMNA DERECHA: Métricas y Conductor */}
            <div className="space-y-5">
              
              {/* KILOMETRAJE */}
              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                   <Gauge size={14} className="mr-1" />
                   Kilometraje Actual <span className="text-red-500 ml-1">*</span>
                 </label>
                 <div className="relative">
                   <input 
                     type="number"
                     value={formData.odometer}
                     onChange={(e) => setFormData({...formData, odometer: e.target.value})}
                     className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-12 py-2.5 text-lg font-bold tracking-wider text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                     placeholder="000000"
                   />
                   <span className="absolute right-4 top-3 text-xs text-gray-400 font-bold">KM</span>
                 </div>
                 {selectedVehicle && (
                   <p className="text-[10px] text-gray-400 text-right">
                     Anterior: {selectedVehicle.odometer?.toLocaleString()} km
                   </p>
                 )}
              </div>

              {/* COMBUSTIBLE */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                  <Fuel size={14} className="mr-1" />
                  Nivel de Combustible <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                   <select 
                     value={formData.fuelLevel}
                     onChange={(e) => setFormData({...formData, fuelLevel: e.target.value})}
                     className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 shadow-sm"
                   >
                     {fuelOptions.map(opt => (
                       <option key={opt.value} value={opt.value}>
                         {opt.label}
                       </option>
                     ))}
                   </select>
                   {/* Barra Visual */}
                   <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                      <div 
                        className={`h-full transition-all duration-500 ${fuelOptions.find(o => o.value === formData.fuelLevel)?.color || 'bg-gray-400'}`}
                        style={{ width: `${(parseInt(formData.fuelLevel) / 8) * 100}%` }}
                      ></div>
                   </div>
                </div>
              </div>

              {/* CONDUCTOR */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                   <User size={14} className="mr-1" />
                   Conductor Asignado <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  type="text"
                  value={formData.driver}
                  onChange={(e) => setFormData({...formData, driver: e.target.value})}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none uppercase shadow-sm"
                  placeholder="NOMBRE APELLIDO"
                />
              </div>

            </div>

            {/* FILA COMPLETA: NOTAS */}
            <div className="md:col-span-2 space-y-1">
               <label className="text-xs font-bold text-gray-500 uppercase">Notas Adicionales</label>
               <textarea
                 rows={2}
                 value={formData.notes}
                 onChange={(e) => setFormData({...formData, notes: e.target.value})}
                 className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm resize-none"
                 placeholder="Observaciones sobre el estado del vehículo..."
               />
            </div>

          </div>

          {/* FOOTER ACCIONES */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
             <button 
               onClick={() => setSelectedVehicle(null)}
               className="px-5 py-2.5 bg-white border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
             >
               Cancelar
             </button>
             <button 
               onClick={handleSubmit}
               disabled={isSaving}
               className={`px-8 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center ${themeBg} hover:opacity-90 disabled:opacity-70`}
             >
               {isSaving ? (
                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               ) : (
                 <>
                   <CheckCircle2 size={20} className="mr-2" />
                   CONFIRMAR {isOut ? 'SALIDA' : 'ENTRADA'}
                 </>
               )}
             </button>
          </div>
        </div>
      )}

      {!selectedVehicle && !isScanning && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
           <Truck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
           <p className="text-gray-500 font-medium">Busque una placa o escanee un código QR para comenzar.</p>
        </div>
      )}

    </div>
  );
};

export default InOut;