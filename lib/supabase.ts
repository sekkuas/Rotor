import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
// 1. Ve a tu Dashboard de Supabase -> Project Settings -> API
// 2. Copia la "Project URL"
const SUPABASE_URL = 'https://hspdenorgvhrnluheuyq.supabase.co';

// 3. Copia la "anon public" Key. DEBE empezar con "eyJ..."
// IMPORTANTE: Reemplaza la cadena vacía de abajo con tu clave real.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcGRlbm9yZ3Zocm5sdWhldXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjkyMDcsImV4cCI6MjA4MTc0NTIwN30.d0xOhYONFnBBcoJjqAe6o4ph_3bTdmkr1Iiax8rzAhQ'; 

// Validación para desarrollador
if (SUPABASE_ANON_KEY.startsWith('PON_AQUI') || SUPABASE_ANON_KEY.length < 20) {
  console.error('🔴 ERROR CRÍTICO: No has configurado la API KEY de Supabase en lib/supabase.ts');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);