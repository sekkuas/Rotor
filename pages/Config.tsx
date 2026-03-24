import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  AlertCircle, 
  Users, 
  MapPin, 
  ShieldCheck, 
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Table,
  CloudCog,
  DownloadCloud,
  Save,
  X,
  UserCheck,
  UserX,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tab = 'db' | 'users' | 'locations' | 'roles' | 'sync';

// Interfaz de Usuario DB
interface SystemUser {
  id?: number;
  nombre: string;
  apellido: string;
  usuario: string;
  password?: string;
  rol: string;
  sucursal: string;
  activo: number; // 1 = Activo, 0 = Inactivo
  created_at?: string;
}

const Config: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('db');
  
  // --- ESTADOS DB ---
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMsg, setConnectionMsg] = useState('');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  // --- ESTADOS SYNC ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [syncStats, setSyncStats] = useState({ total: 0, success: 0, error: 0 });

  // --- ESTADOS USUARIOS ---
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Formulario Usuario
  const initialUserForm = {
    nombre: '',
    apellido: '',
    usuario: '',
    password: '',
    rol: 'Operador',
    sucursal: 'MALEK',
    activo: 1
  };
  const [userForm, setUserForm] = useState(initialUserForm);
  const [userMsg, setUserMsg] = useState('');

  // --- LOGICA DE BASE DE DATOS ---
  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMsg('');
    setDetectedColumns([]);
    
    try {
      const { count, error: countError } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const { data: sampleData, error: sampleError } = await supabase
        .from('vehicles')
        .select('*')
        .limit(1);

      if (sampleError) throw sampleError;

      setConnectionStatus('success');
      setConnectionMsg(`Conexión Exitosa. Tabla 'vehicles' encontrada con ${count ?? 0} registros.`);
      
      if (sampleData && sampleData.length > 0) {
        setDetectedColumns(Object.keys(sampleData[0]));
      }

    } catch (err: any) {
      console.error("Error de conexión:", err);
      setConnectionStatus('error');
      const errMsg = err?.message || (typeof err === 'string' ? err : 'Error desconocido.');
      setConnectionMsg(`Error al conectar: ${errMsg}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // --- LOGICA DE USUARIOS ---
  
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setUsersList(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      if (error.code === '42P01' || error.message.includes('not find the table')) {
         alert("La tabla 'app_users' no existe. Por favor ejecuta el SQL proporcionado en el editor de Supabase.");
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleOpenNewUser = () => {
    setEditingId(null);
    setUserForm(initialUserForm);
    setUserMsg('');
    setShowUserModal(true);
  };

  const handleEditUser = (user: SystemUser) => {
    setEditingId(user.id!);
    setUserForm({
      nombre: user.nombre,
      apellido: user.apellido,
      usuario: user.usuario,
      password: '', 
      rol: user.rol,
      sucursal: user.sucursal,
      activo: user.activo
    });
    setUserMsg('');
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción es irreversible.')) return;

    try {
      const { error } = await supabase.from('app_users').delete().eq('id', id);
      if (error) throw error;
      fetchUsers();
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg('');

    if (!userForm.nombre || !userForm.apellido || !userForm.usuario || !userForm.rol) {
      setUserMsg('Todos los campos marcados son obligatorios.');
      return;
    }

    if (!editingId && !userForm.password) {
      setUserMsg('La contraseña es obligatoria para usuarios nuevos.');
      return;
    }

    try {
      const payload: any = {
        nombre: userForm.nombre,
        apellido: userForm.apellido,
        usuario: userForm.usuario.toLowerCase().trim(),
        rol: userForm.rol,
        sucursal: userForm.sucursal,
        activo: userForm.activo 
      };

      if (userForm.password) {
        payload.password = userForm.password;
      }

      if (editingId) {
        const { error } = await supabase
          .from('app_users')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_users')
          .insert([payload]);
        if (error) throw error;
      }

      setShowUserModal(false);
      fetchUsers();

    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('schema cache')) {
        setUserMsg('Error de Caché Supabase: Ejecuta el script SQL para crear "app_users".');
      } else {
        setUserMsg('Error al guardar: ' + error.message);
      }
    }
  };


  // --- LOGICA DE SINCRONIZACIÓN API EXTERNA (DIRECTA) ---
  
  const addLog = (msg: string) => setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const parseFuelLevel = (val: any): number => {
    if (!val) return 8;
    const strVal = String(val);
    if (strVal.includes('/')) return parseInt(strVal.split('/')[0]) || 0;
    if (strVal.toLowerCase().includes('full')) return 8;
    const num = parseFloat(strVal);
    return isNaN(num) ? 0 : num;
  };

  const handleExternalSync = async () => {
    setIsSyncing(true);
    setSyncLog([]);
    setSyncStats({ total: 0, success: 0, error: 0 });
    
    // Configuración API BarsCloud (DIRECTA)
    const TARGET_URL = 'https://cq1e.barscloud.com:612/dolPanamaRW/queryapi/apiPowerBIFleet.mf';
    const AUTH_HEADER = 'Basic ' + btoa('dolPanamaRW:VfsbJpYp');

    addLog(`Iniciando conexión DIRECTA.`);
    addLog(`URL Objetivo: ${TARGET_URL}`);

    try {
      addLog(`Enviando petición fetch()...`);
      
      // Fetch directo
      const response = await fetch(TARGET_URL, {
        method: 'GET',
        headers: {
          'Authorization': AUTH_HEADER,
          'Accept': 'application/json'
        },
        // 'mode': 'cors' es el default en fetch, si el servidor no devuelve Access-Control-Allow-Origin, fallará.
      });

      addLog(`Estado HTTP: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No se pudo leer el cuerpo del error');
        throw new Error(`Error del Servidor (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const rawData = await response.json();
      
      if (!Array.isArray(rawData)) {
        addLog(`ERROR: La respuesta no es un arreglo. Tipo recibido: ${typeof rawData}`);
        throw new Error("Formato de JSON inválido. Se esperaba un Array.");
      }

      addLog(`ÉXITO: Datos recibidos. ${rawData.length} registros encontrados.`);
      setSyncStats(prev => ({ ...prev, total: rawData.length }));

      addLog("Procesando mapeo de columnas...");
      
      // MAPEO EXACTO SOLICITADO
      const mappedData = rawData.map((item: any) => ({
        unit_number: item.UnitNumber,    // UnitNumber -> Unit #
        license_plate: item.LicenseNumber, // LicenseNumber -> License #
        year: parseInt(item.Year) || new Date().getFullYear(),
        make: item.Make,
        model: item.Model,
        class: item.InvClass,
        color: item.UnitColor,
        vin: item.SerialNumber,
        location: item.LocationCode,
        odometer: parseInt(item.Odometer) || 0,
        product: item.Product,
        status: item.Estatus,
        fuel_level: parseFuelLevel(item.CurrentFuelLevel),
        updated_at: new Date().toISOString()
      }));

      const BATCH_SIZE = 50; // Lotes más pequeños para ver progreso
      let processed = 0;
      let errorCount = 0;
      addLog(`Guardando en Supabase en lotes de ${BATCH_SIZE}...`);

      for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
        const batch = mappedData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('vehicles')
          .upsert(batch, { onConflict: 'unit_number' });

        if (error) {
          addLog(`Error guardando lote ${i}: ${error.message}`);
          errorCount += batch.length;
          setSyncStats(prev => ({ ...prev, error: prev.error + batch.length }));
        } else {
          processed += batch.length;
          setSyncStats(prev => ({ ...prev, success: processed }));
        }
      }

      if (errorCount === 0) {
        addLog("✅ Sincronización completada 100% exitosa.");
      } else {
        addLog(`⚠️ Proceso terminado con ${errorCount} errores de guardado.`);
      }

    } catch (error: any) {
      console.error("Sync Error:", error);
      addLog(`⛔ EXCEPCIÓN: ${error.message}`);
      addLog(`------------------------------------------------`);
      
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        addLog("DIAGNÓSTICO: 'Failed to fetch' generalmente significa:");
        addLog("1. El servidor API no permite conexiones desde este dominio (CORS).");
        addLog("2. El navegador bloquea el puerto 612 por seguridad.");
        addLog("3. Error de certificado SSL (HTTPS) en el servidor API.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const mockLocations = [
    { id: 1, name: 'MALEK', address: 'Aeropuerto Enrique Malek, David', code: 'DAV' },
    { id: 2, name: 'TCPOPS', address: 'Tocumen Operations Center', code: 'PTY' },
    { id: 3, name: 'CHORRERA', address: 'La Chorrera, Plaza Italia', code: 'CHO' },
    { id: 4, name: 'TDA', address: 'Tumba Muerto, El Dorado', code: 'TDA' },
    { id: 5, name: 'DAVID', address: 'David Ciudad', code: 'DAV2' },
    { id: 6, name: 'SANTIAGO', address: 'Santiago de Veraguas', code: 'STG' },
    { id: 7, name: 'CHITRE', address: 'Chitré', code: 'CHI' },
    { id: 8, name: 'COLON', address: 'Colón 2000', code: 'COL' },
    { id: 9, name: 'RIO HATO', address: 'Aeropuerto Scarlett Martinez', code: 'RHT' },
    { id: 10, name: 'ALBROOK', address: 'Albrook Mall', code: 'ALB' },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center space-x-4 mb-2">
        <div className="bg-gray-100 p-3 rounded-full">
          <Settings size={32} className="text-gray-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
          <p className="text-gray-500">Administración del sistema</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('db')}
            className={`${
              activeTab === 'db'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Database className="w-4 h-4 mr-2" />
            Base de Datos
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`${
              activeTab === 'sync'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <CloudCog className="w-4 h-4 mr-2" />
            Sincronización API
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Users className="w-4 h-4 mr-2" />
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`${
              activeTab === 'locations'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Ubicaciones
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`${
              activeTab === 'roles'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Roles y Permisos
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        
        {/* DATABASE TAB */}
        {activeTab === 'db' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-brand-600" />
              Estado de Base de Datos
            </h3>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-blue-800 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold">Conexión a Supabase</p>
                    <button 
                      onClick={testConnection}
                      disabled={testingConnection}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center"
                    >
                      {testingConnection ? <RefreshCw className="animate-spin w-3 h-3 mr-1" /> : null}
                      Probar Conexión
                    </button>
                  </div>
                  
                  {connectionStatus === 'success' && (
                     <div className="mt-2">
                       <div className="flex items-center text-green-700 font-medium">
                         <CheckCircle size={16} className="mr-2" />
                         {connectionMsg}
                       </div>
                       
                       {detectedColumns.length > 0 && (
                         <div className="mt-3 bg-white p-3 rounded border border-blue-200">
                           <p className="text-xs font-bold text-gray-600 mb-1 flex items-center">
                             <Table size={12} className="mr-1"/>
                             Columnas detectadas en Supabase:
                           </p>
                           <div className="flex flex-wrap gap-1">
                             {detectedColumns.map(col => (
                               <span key={col} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-300 font-mono">
                                 {col}
                               </span>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                  )}
                  
                  {connectionStatus === 'error' && (
                     <div className="flex items-center text-red-700 font-medium mt-2">
                       <XCircle size={16} className="mr-2" />
                       {connectionMsg}
                     </div>
                  )}
                  
                  {connectionStatus === 'idle' && !testingConnection && (
                    <p className="text-gray-500 text-xs">Presiona probar para verificar el acceso y las columnas de la tabla 'vehicles'.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SYNC API TAB */}
        {activeTab === 'sync' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <h3 className="text-lg font-bold text-gray-800 flex items-center">
                             <CloudCog className="w-5 h-5 mr-2 text-brand-600" />
                             Sincronización Externa (Directa)
                          </h3>
                       </div>
                       <div className={`px-3 py-1 rounded-full text-xs font-bold ${isSyncing ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {isSyncing ? 'EN PROCESO' : 'LISTO'}
                       </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm">
                       <p className="font-semibold text-gray-700 mb-2">Configuración:</p>
                       <p className="text-xs text-gray-600 mb-2">
                         Se conectará directamente a: <span className="font-mono bg-white px-1 rounded border">https://cq1e.barscloud.com:612/dolPanamaRW/queryapi/apiPowerBIFleet.mf</span>
                       </p>
                       <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800 flex items-start">
                         <AlertCircle size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                         <p>
                           <b>Nota:</b> La conexión directa desde el navegador puede fallar si el servidor API no tiene habilitado CORS o si bloquea solicitudes desde "localhost" o dominios desconocidos. Revise el LOG de errores.
                         </p>
                       </div>
                    </div>

                    <div className="flex items-center gap-4">
                       <button 
                         onClick={handleExternalSync}
                         disabled={isSyncing}
                         className={`flex-1 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center transition-all active:scale-95 ${
                           isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'
                         }`}
                       >
                         {isSyncing ? (
                           <><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Conectando...</>
                         ) : (
                           <><DownloadCloud className="w-5 h-5 mr-2" /> Iniciar Conexión Directa</>
                         )}
                       </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                           <p className="text-xs text-blue-600 font-bold uppercase">Encontrados</p>
                           <p className="text-xl font-bold text-blue-900">{syncStats.total}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                           <p className="text-xs text-green-600 font-bold uppercase">Actualizados</p>
                           <p className="text-xl font-bold text-green-900">{syncStats.success}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                           <p className="text-xs text-red-600 font-bold uppercase">Errores</p>
                           <p className="text-xl font-bold text-red-900">{syncStats.error}</p>
                        </div>
                    </div>
                 </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl shadow-lg border border-gray-700 overflow-hidden flex flex-col h-96 lg:h-auto">
                 <div className="bg-[#0f172a] p-3 border-b border-gray-700 flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-400">Terminal de Sincronización</span>
                    <button onClick={() => setSyncLog([])} className="text-xs text-blue-400 hover:text-blue-300">Limpiar</button>
                 </div>
                 <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1">
                    {syncLog.length === 0 && <p className="text-gray-600 italic">Esperando inicio de proceso...</p>}
                    {syncLog.map((log, idx) => (
                       <div key={idx} className={`${log.includes('ERROR') || log.includes('EXCEPCIÓN') || log.includes('DIAGNÓSTICO') ? 'text-red-400' : 'text-green-400'} border-b border-gray-800/50 pb-1 last:border-0 break-words whitespace-pre-wrap`}>
                          {log}
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* USERS TAB (REAL SUPABASE IMPLEMENTATION) */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users className="text-brand-600" size={20} />
                Gestión de Usuarios
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={fetchUsers} 
                  className="p-2 text-gray-500 hover:text-brand-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                  title="Refrescar lista"
                >
                  <RefreshCw size={18} className={loadingUsers ? 'animate-spin' : ''}/>
                </button>
                <button 
                  onClick={handleOpenNewUser}
                  className="flex items-center space-x-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 transition-colors"
                >
                  <Plus size={18} />
                  <span>Nuevo Usuario</span>
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto min-h-[300px]">
              {loadingUsers ? (
                <div className="flex justify-center items-center h-40">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre Completo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Sucursal</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                          No hay usuarios registrados.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 font-bold border border-brand-100">
                                {user.nombre.charAt(0)}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-bold text-gray-900">{user.usuario}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {user.nombre} {user.apellido}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-bold rounded border ${
                              user.rol === 'Administrador' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              user.rol === 'Supervisor' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {user.rol}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                            <div className="flex items-center">
                              <MapPin size={12} className="mr-1 text-gray-400" />
                              {user.sucursal}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left">
                            {user.activo === 1 ? (
                              <span className="px-2 py-0.5 inline-flex text-xs font-bold border bg-green-50 text-green-700 border-green-200 rounded">
                                ACTIVO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 inline-flex text-xs font-bold border bg-red-50 text-red-700 border-red-200 rounded">
                                INACTIVO
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => handleEditUser(user)} className="text-brand-600 hover:text-brand-800 p-1.5 hover:bg-brand-50 rounded mr-2 transition-colors">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteUser(user.id!)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* MODAL DE USUARIO */}
            {showUserModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="bg-[#003366] px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="text-lg font-bold flex items-center">
                      {editingId ? <Edit2 size={18} className="mr-2"/> : <Plus size={18} className="mr-2"/>}
                      {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h3>
                    <button onClick={() => setShowUserModal(false)} className="text-white/70 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                    {userMsg && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center">
                        <AlertCircle size={16} className="mr-2" />
                        {userMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                        <input 
                          type="text" 
                          required
                          value={userForm.nombre}
                          onChange={e => setUserForm({...userForm, nombre: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Apellido</label>
                        <input 
                          type="text" 
                          required
                          value={userForm.apellido}
                          onChange={e => setUserForm({...userForm, apellido: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Usuario (Login)</label>
                      <input 
                        type="text" 
                        required
                        value={userForm.usuario}
                        onChange={e => setUserForm({...userForm, usuario: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="ej. operador1"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                         <span>Contraseña</span>
                         {editingId && <span className="text-[10px] text-gray-400 normal-case font-normal">(Dejar en blanco para no cambiar)</span>}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                          type="password" 
                          value={userForm.password}
                          onChange={e => setUserForm({...userForm, password: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                          placeholder={editingId ? "********" : "Contraseña"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-500 uppercase">Rol</label>
                         <select 
                           value={userForm.rol}
                           onChange={e => setUserForm({...userForm, rol: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                         >
                           <option value="Administrador">Administrador</option>
                           <option value="Supervisor">Supervisor</option>
                           <option value="Operador">Operador</option>
                         </select>
                      </div>
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-500 uppercase">Sucursal</label>
                         <select 
                           value={userForm.sucursal}
                           onChange={e => setUserForm({...userForm, sucursal: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                         >
                           {mockLocations.map(loc => (
                             <option key={loc.id} value={loc.name}>{loc.name}</option>
                           ))}
                         </select>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2">
                       <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Estado de Cuenta</label>
                       <div className="flex gap-4">
                          <label className={`flex-1 flex items-center justify-center border rounded-lg p-3 cursor-pointer transition-all ${userForm.activo === 1 ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                             <input 
                               type="radio" 
                               name="estado" 
                               className="hidden" 
                               checked={userForm.activo === 1} 
                               onChange={() => setUserForm({...userForm, activo: 1})}
                             />
                             <UserCheck size={18} className="mr-2" />
                             <span className="font-bold text-sm">ACTIVO</span>
                          </label>
                          <label className={`flex-1 flex items-center justify-center border rounded-lg p-3 cursor-pointer transition-all ${userForm.activo === 0 ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                             <input 
                               type="radio" 
                               name="estado" 
                               className="hidden" 
                               checked={userForm.activo === 0} 
                               onChange={() => setUserForm({...userForm, activo: 0})}
                             />
                             <UserX size={18} className="mr-2" />
                             <span className="font-bold text-sm">INACTIVO</span>
                          </label>
                       </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                      <button 
                        type="button" 
                        onClick={() => setShowUserModal(false)}
                        className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="px-6 py-2 bg-[#003366] hover:bg-[#002244] text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 flex items-center"
                      >
                        <Save size={16} className="mr-2" />
                        Guardar Usuario
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Ubicaciones / Sucursales</h3>
              <button className="flex items-center space-x-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors">
                <Plus size={16} />
                <span>Nueva Ubicación</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              {mockLocations.map(loc => (
                <div key={loc.id} className="border border-gray-200 rounded-lg p-4 hover:border-brand-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 p-2 rounded-lg">
                        <MapPin size={20} className="text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{loc.name}</h4>
                        <p className="text-sm text-gray-500">{loc.address}</p>
                      </div>
                    </div>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{loc.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROLES TAB */}
        {activeTab === 'roles' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
             <h3 className="text-lg font-semibold text-gray-800 mb-6">Definición de Roles (RBAC)</h3>
             <div className="space-y-4">
                <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                  <h4 className="font-bold text-purple-900 flex items-center">
                    <ShieldCheck size={18} className="mr-2" />
                    Administrador
                  </h4>
                  <p className="text-sm text-purple-800 mt-1">Acceso total a todos los módulos: Dashboard, Entrada/Salida, Inventario, Reportes y Configuración global.</p>
                </div>
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-bold text-blue-900 flex items-center">
                    <ShieldCheck size={18} className="mr-2" />
                    Supervisor
                  </h4>
                  <p className="text-sm text-blue-800 mt-1">Acceso a Dashboard, Reportes y visualización completa de inventario. No puede modificar configuraciones del sistema ni usuarios.</p>
                </div>
                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 flex items-center">
                    <ShieldCheck size={18} className="mr-2" />
                    Operador
                  </h4>
                  <p className="text-sm text-green-800 mt-1">Acceso limitado operativo: Registro de Entrada/Salida y actualización de estado de vehículos. No accede a reportes financieros.</p>
                </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Config;