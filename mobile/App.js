import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  SafeAreaView, Alert, Image, ActivityIndicator, StatusBar, Modal, Dimensions, Linking, RefreshControl, ImageBackground
} from 'react-native';
import { 
  User, Lock, QrCode, Dumbbell, Calendar, LogOut, ChevronRight, 
  CheckCircle2, AlertCircle, Clock, ChevronLeft, XCircle, Activity,
  Wallet, Package, Plus, Minus, Search, Trash2, ArrowRightLeft,
  Menu, X, Briefcase, GraduationCap, LayoutDashboard,
  ShoppingCart, RefreshCw, Pencil, Move, Check, Mail, Ruler, Weight, CalendarDays,
  ArrowDown, CreditCard, DollarSign, Tag, MessageCircle, ArrowUp, TrendingUp, Info, Users
} from 'lucide-react-native';
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import QRCodePackage from 'react-native-qrcode-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAvoidingView, Platform, FlatList } from 'react-native'; // Asegurate de importar Platform arriba
import { useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';


// ==========================================
// 1. CONFIGURACIÓN MAESTRA & CONSTANTES
// ==========================================
const API_BASE = "https://gymfit-pro.onrender.com/api";
const SECRET_KEY = "Vikingo_Security_Strong_Key_2025";
const WHATSAPP_NUMBER = "5491112345678"; 
// ACTUALIZACIÓN DE IMÁGENES
const LOGO_URL = "https://github.com/vikingo-44/Software-Gym/blob/main/gymfitpro2.png?raw=true"; 
const WALLPAPER_URL = "https://github.com/vikingo-44/Software-Gym/blob/main/wallpaper.png?raw=true";
const { width, height } = Dimensions.get('window');

// ==========================================
// 2. UTILIDADES DE SEGURIDAD Y FORMATO
// ==========================================
async function generateVikingHash(dni) {
  try {
    const msg = dni + SECRET_KEY;
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      msg
    );
    return `${dni}:${digest}`;
  } catch (e) {
    return dni;
  }
}

const formatMoney = (amount) => {
  return "$" + (amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000).toLocaleDateString('es-AR'); 
};

const getStatusColor = (fechaVencimiento) => {
    if (!fechaVencimiento) return '#71717a'; 
    const hoy = new Date();
    const venc = new Date(fechaVencimiento);
    const diffTime = venc - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays < 0) return '#ef4444'; 
    if (diffDays <= 3) return '#eab308'; 
    return '#22c55e'; 
};

const formatHoraVikinga = (horario) => {
  if (!horario) return "--:--";
  
  // Si es un número (ej: 7.5 o 18)
  if (typeof horario === 'number' || !isNaN(horario)) {
    const totalMinutes = Math.floor(parseFloat(horario) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Si es un string (ej: "18:30:00")
  if (typeof horario === 'string') {
    return horario.split(':').slice(0, 2).join(':');
  }
  
  return "--:--";
};

const handleSaveEditAlumno = async () => {
    if (!formData.nombre_completo || !formData.dni) {
        return Alert.alert("Error", "Nombre y DNI son obligatorios");
    }
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/alumnos/${selectedStudent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: formData.nombre_completo,
                dni: formData.dni,
                email: formData.email,
                telefono: formData.telefono,
                peso: formData.peso,
                altura: formData.altura,
                // Si el campo de password no está vacío, lo mandamos para resetear
                password: formData.newPassword || null 
            })
        });

        if (res.ok) {
            Alert.alert("Vikingo Pro", "Datos del alumno actualizados.");
            await fetchUsuarios(); // Refrescamos la lista global
            setModalEditVisible(false); // Cerramos el modal
            setView('usuarios_list'); // Volvemos a la lista para ver los cambios
        } else {
            const error = await res.json();
            Alert.alert("Error", error.detail || "No se pudo actualizar");
        }
    } catch (e) {
        Alert.alert("Error", "Sin conexión con el servidor");
    } finally {
        setLoading(false);
    }
};

const handleSaveEditStaff = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/staff/${selectedStaff.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: formData.nombre_completo,
                dni: formData.dni,
                email: formData.email,
                password: formData.newPassword || null
            })
        });

        if (res.ok) {
            Alert.alert("Vikingo Pro", "Personal de Staff actualizado.");
            fetchStaff(); // Recargamos la lista
            setModalEditStaffVisible(false);
        } else {
            Alert.alert("Error", "No se pudieron guardar los cambios.");
        }
    } catch (e) {
        Alert.alert("Error", "Falla de conexión.");
    } finally {
        setLoading(false);
    }
};

const handleUpdateStock = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/stock/${formData.id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${user.access_token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                nombre_producto: formData.nombre_producto,
                stock_actual: parseInt(formData.stock_actual),
                precio_venta: parseFloat(formData.precio_venta),
                precio_costo: parseFloat(formData.precio_costo || 0),
                url_imagen: formData.url_imagen,
                categoria: formData.categoria
            })
        });

        if (res.ok) {
            Alert.alert("Éxito", "Producto actualizado correctamente.");
            setModalEditStockVisible(false); // Cerramos el modal
            fetchStock(); // Refrescamos la lista
        } else {
            Alert.alert("Error", "No se pudo actualizar el producto.");
        }
    } catch (e) {
        Alert.alert("Error", "Fallo de conexión.");
    } finally {
        setLoading(false);
    }
};

const getDayName = (dia) => {
    const nombres = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    return nombres[dia - 1] || '';
};

// ==========================================
// 3. COMPONENTE PRINCIPAL (SISTEMA INTEGRAL)
// ==========================================
export default function App() {
  // --- ESTADOS DE NAVEGACIÓN Y CARGA ---
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // --- ESTADOS DE USUARIO ---
  const [user, setUser] = useState(null);
  const [qrData, setQrData] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminQrModalOpen, setAdminQrModalOpen] = useState(false);

  // --- ESTADOS DE DATOS DEL SISTEMA (BASE DE DATOS LOCAL) ---
  const [rutina, setRutina] = useState(null);
  const [rutinaOwner, setRutinaOwner] = useState(null);
  const [clases, setClases] = useState([]);
  const [reservas, setReservas] = useState([]); // ¡FIX: IMPORTANTE PARA CUPOS!
  const [stock, setStock] = useState([]);
  const [caja, setCaja] = useState({ balance: 0, ingresos: 0, gastos: 0, movimientos: [] });
  const [usuarios, setUsuarios] = useState([]); 
  const [staffList, setStaffList] = useState([]);
  const [planes, setPlanes] = useState([]);
  
  // --- ESTADOS DE UI & SELECCIÓN ---
  const [selectedEjercicio, setSelectedEjercicio] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDayCalendar, setSelectedDayCalendar] = useState(new Date().getDay() || 1); 
  const [semanaActiva, setSemanaActiva] = useState(1);
  const [selectedBox, setSelectedBox] = useState('Principal');
  const [filtros, setFiltros] = useState({ busqueda: '', metodo: 'Todos' });
  
  // --- MODOS DE EDICIÓN ---
  const [isEditModeCalendar, setIsEditModeCalendar] = useState(false);
  const [selectedClassToMove, setSelectedClassToMove] = useState(null);
  const [isEditModeRutina, setIsEditModeRutina] = useState(false);
  const [modalEditVisible, setModalEditVisible] = useState(false);  
  
  // --- ESTADOS DE STAFF ---
  const [modalEditStaffVisible, setModalEditStaffVisible] = useState(false); // <--- ESTE ES EL QUE FALTA
  const [selectedStaff, setSelectedStaff] = useState(null); // Para saber a quién estamos editando

  // --- FORMULARIOS ---
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [productos, setProductos] = useState([]);
  const [formData, setFormData] = useState({ nombre: '', horario: '', coach: '', capacidad: '' }); 
  const [classSchedules, setClassSchedules] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState(null); 
  const [activeAccordion, setActiveAccordion] = useState(null);

  const [cajaFilter, setCajaFilter] = useState(''); // Para buscar por texto/comentario
  const [metodoFilter, setMetodoFilter] = useState('Todos'); // Para filtrar por forma de pago

  const [selectedClassDetails, setSelectedClassDetails] = useState(null); // Para ver los alumnos
  const [modalAlumnosOpen, setModalAlumnosOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('ficha');

  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0]);

  const [showDatePicker, setShowDatePicker] = useState(null); // 'desde' o 'hasta'
  const [tempDate, setTempDate] = useState(new Date());

  const [modalEditStockVisible, setModalEditStockVisible] = useState(false);

  const [feriados, setFeriados] = useState([]);
  const [clasesFeriado, setClasesFeriado] = useState([]);
  const [modalClaseFeriado, setModalClaseFeriado] = useState(false);

  const [diaActivo, setDiaActivo] = useState(1); // 1 = Lunes, 6 = Sábado

  // Agregá esto a la lista de estados
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(2);
  const [showSucursalMenu, setShowSucursalMenu] = useState(false);

  const [weekOffset, setWeekOffset] = useState(0);

  const [modalSelector, setModalSelector] = useState({ visible: false, tipo: '', opciones: [] });

  // ==========================================
  // 4. LÓGICA DE PERMISOS (RBAC)
  // ==========================================
  const getRole = () => user?.rol_nombre?.toLowerCase().trim() || '';
  const isMaster = () => ['admin', 'administrador', 'dueño', 'supervisor'].includes(getRole());
  const isProfesor = () => ['profesor', 'profe', 'entrenador'].includes(getRole());
  const isAdministrative = () => ['administracion', 'administrativo', 'staff', 'recepcion'].includes(getRole());
  const isStudent = () => {
    // Si tus funciones de rol dependen de un objeto state, usa encadenamiento opcional
    return !isMaster?.() && !isProfesor?.() && !isAdministrative?.();
  };

  const perms = {
      isAdminDashboard: () => isMaster() || isAdministrative() || isProfesor(), 
      canManageMoney: () => isMaster() || isAdministrative(),
      canEditStock: () => isMaster(), 
      canManageUsers: () => isMaster() || isAdministrative(),
      canManageStaff: () => isMaster(),
      canViewStock: () => isMaster() || isAdministrative(),
      canEditRoutines: () => isMaster() || isProfesor(),
      canEditClasses: () => isMaster(),
  };

  const handleCancelarReserva = async (reservaId) => {
    Alert.alert("Cancelar Reserva", "¿Confirmás cancelar esta clase?", [
        { text: "No", style: "cancel" },
        { 
            text: "Sí, cancelar", 
            style: "destructive", 
            onPress: async () => {
                setLoading(true); // <--- Ahora sí funciona porque está dentro del componente
                try {
                    const response = await fetch(`${API_BASE}/reservas/${reservaId}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        Alert.alert("Vikingo Pro", "Reserva liberada.");
                        await fetchReservas(); 
                    } else {
                        throw new Error("No se pudo eliminar.");
                    }
                } catch (e) {
                    Alert.alert("Error", e.message);
                } finally {
                    setLoading(false);
                }
            }
        }
    ]);
};

const handleReservarClase = async (item) => {
    // 1. Verificación de seguridad
    console.log("Usuario actual en App:", user); 
    
    if (!user || !user.id || !user.access_token) {
        Alert.alert("Error", "Sesión inválida. Por favor, volvé a iniciar sesión.");
        return;
    }

    setLoading(true);

    try {
        const fechaActualStr = getFechaReal(diaActivo); 
        
        // 2. CORRECCIÓN CRÍTICA DE FECHA Y DÍA
        // JavaScript getDay() es 0(Dom) a 6(Sab). 
        // Si tu backend espera Lunes=1 a Domingo=7, esta es la fórmula:
        const fechaObj = new Date(fechaActualStr + 'T00:00:00');
        let diaSemana = fechaObj.getDay(); 
        diaSemana = diaSemana === 0 ? 7 : diaSemana; // Ajuste para que Lunes=1...Domingo=7

        const payload = {
            usuario_id: Number(user.id),
            clase_nombre: item.nombre,
            fecha_clase: fechaActualStr,
            horario: item.slot.horario,
            sucursal_id: Number(sucursalSeleccionada),
            clase_id: Number(item.id), // Aseguramos formato numérico
            dia_semana: diaSemana 
        };
        
        console.log("Payload enviado al server:", payload);

        const response = await fetch(`${API_BASE}/reservas`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.access_token}`
            },
            body: JSON.stringify(payload)
        });

        // 3. Lectura de respuesta robusta
        const responseText = await response.text(); 
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { message: responseText };
        }

        if (response.ok) {
            Alert.alert("Éxito", "¡Reserva realizada!");
            
            // Retraso de 300ms para permitir que la DB procese la escritura antes de refrescar
            setTimeout(async () => {
                if (typeof fetchReservas === 'function') await fetchReservas();
                if (typeof fetchClases === 'function') await fetchClases(); 
            }, 300);
            
        } else {
            // Intentamos parsear el error, si no es JSON, capturamos el texto
            const errorText = await response.text();
            let errDetail = "No se pudo reservar";
            try {
                const errJson = JSON.parse(errorText);
                errDetail = errJson.detail || errDetail;
            } catch (e) {
                errDetail = errorText || errDetail;
            }
            Alert.alert("Error", errDetail);
        }
    } catch (e) {
        Alert.alert("Error de Conexión", "No se pudo comunicar con el servidor: " + e.message);
    } finally {
        setLoading(false);
    }
};

// Pon esto junto a tus otras funciones (como fetchReservas)
const getFechaReal = (num) => {
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (weekOffset * 7)));
    const f = new Date(monday); 
    f.setDate(monday.getDate() + (num - 1));
    return f.toISOString().split('T')[0];
};

const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempDate;
    setShowDatePicker(null);
    if (event.type === 'set') {
        const dateString = currentDate.toISOString().split('T')[0];
        if (showDatePicker === 'desde') setFechaDesde(dateString);
        else setFechaHasta(dateString);
    }
};

const fetchSucursales = async () => {
    try { 
        const ts = new Date().getTime();
        const res = await fetch(`${API_BASE}/sucursales?t=${ts}`); 
        if (res.ok) {
            const data = await res.json();
            setSucursales(Array.isArray(data) ? data : []);
        }
    } catch(e) {
        console.error("Error al cargar sucursales:", e);
    }
};

  // ==========================================
  // 5. EFECTOS & SYNC INICIAL
  // ==========================================
  useEffect(() => {
  const initLoad = async () => {
    // 1. Verificamos primero si hay token real en el dispositivo
    const token = await AsyncStorage.getItem('viking_token');
    
    // Si no hay token, no tiene sentido cargar nada, mandamos a login o esperamos
    if (!token) {
      console.warn("initLoad: No hay token guardado. Esperando autenticación.");
      setView('login');
      return;
    }

    // 2. Si hay usuario y hay token, procedemos
    if (user) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (perms.isAdminDashboard()) {
        fetchAllAdminData();
      } else {
        fetchStudentData();
      }
    }
  };
  
  initLoad();
}, [user]); // Este effect se dispara cuando 'user' cambia tras el login

  useEffect(() => {
    if (view === 'staff_list' && user) {
        fetchStaff();
    }
}, [view]);

  const fetchAllAdminData = async () => {
    setLoading(true);
    await Promise.all([
      fetchClases(),
      fetchUsuarios(),
      fetchStaff(),
      fetchCaja(),
      fetchStock(),
      fetchPlanes(),
      fetchReservas(),
      fetchFeriadosYClases(),
      fetchSucursales()
    ]);
    setLoading(false);
  };

  const fetchStudentData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRutina(user.id, user.nombre_completo),
      fetchClases(),
      fetchReservas(),
      fetchFeriadosYClases()
    ]);
    setLoading(false);
  };

// 1. FUNCIÓN AUXILIAR (Declarada una sola vez para toda la app)
const getFechaSeleccionada = () => {
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (weekOffset * 7)));
    const f = new Date(monday);
    f.setDate(monday.getDate() + (diaActivo - 1));
    return f.toISOString().split('T')[0];
};

// 2. CARGA DE DATOS
const fetchFeriadosYClases = async () => {
    try {
        const token = await AsyncStorage.getItem('viking_token');
        const sID = Number(sucursalSeleccionada);
        if (!sID) return;

        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
        };

        const fechaTarget = getFechaSeleccionada();

        // Ejecución en paralelo
        const [resF, resC] = await Promise.all([
            fetch(`${API_BASE}/feriados?sucursal_id=${sID}`, { method: 'GET', headers }),
            fetch(`${API_BASE}/clases-feriado?fecha=${fechaTarget}&sucursal_id=${sID}`, { method: 'GET', headers })
        ]);

        // Verificamos si la respuesta es OK antes de intentar convertir a JSON
        if (!resF.ok || !resC.ok) {
            const textF = await resF.text();
            const textC = await resC.text();
            console.error("Error en servidor. Respuesta cruda:", { textF, textC });
            throw new Error("El servidor devolvió un error de estado " + resF.status);
        }

        const dataFeriados = await resF.json();
        const dataClases = await resC.json();

        setFeriados(Array.isArray(dataFeriados) ? dataFeriados : []);
        setClasesFeriado(Array.isArray(dataClases) ? dataClases : []);
        
    } catch (error) {
        console.error("Error al cargar feriados y clases:", error);
        // Opcional: Alertar al usuario si es un error crítico
        // Alert.alert("Error de conexión", "No se pudieron cargar los feriados.");
    }
};

// 3. MARCAR DÍA COMO FERIADO
const handleCrearFeriado = async (motivo) => {
    try {
        const res = await fetch(`${API_BASE}/feriados`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${await AsyncStorage.getItem('viking_token')}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                fecha: getFechaSeleccionada(), 
                motivo: motivo || "Feriado", 
                sucursal_id: Number(sucursalSeleccionada) 
            })
        });

        if (res.ok) {
            await fetchFeriadosYClases();
            Alert.alert("Éxito", "Día marcado como feriado.");
        } else {
            const err = await res.json();
            Alert.alert("Error", err.detail || "No se pudo guardar.");
        }
    } catch (e) {
        Alert.alert("Error", "Fallo de conexión.");
    }
};

// 4. ELIMINAR FERIADO
const handleEliminarFeriado = async () => {
    Alert.alert("Confirmar", "¿Limpiar este día y eliminar feriado?", [
        { text: "Cancelar" },
        { text: "Sí, Limpiar", style: "destructive", onPress: async () => {
            try {
                const res = await fetch(`${API_BASE}/feriados?fecha=${getFechaSeleccionada()}&sucursal_id=${Number(sucursalSeleccionada)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${await AsyncStorage.getItem('viking_token')}` }
                });

                if (res.ok) {
                    await fetchFeriadosYClases();
                    Alert.alert("Éxito", "Día normalizado.");
                } else {
                    Alert.alert("Error", "No se pudo limpiar el día.");
                }
            } catch (e) {
                Alert.alert("Error", "Fallo de conexión.");
            }
        }}
    ]);
};

// 5. ABRIR MODAL
const openModalFeriado = () => {
    const claseDefault = clases.length > 0 ? clases[0] : { nombre: '', capacidad_max: 20 };
    setFormData({ 
        nombre: claseDefault.nombre, 
        horario: 7.0, 
        coach: staffList[0]?.nombre_completo || '', 
        capacidad: claseDefault.capacidad_max.toString() 
    });
    setModalClaseFeriado(true);
};

// 6. CREAR CLASE ESPECIAL
const handleCrearClaseFeriado = async () => {
    if (!formData.nombre || !formData.horario || !formData.coach) {
        return Alert.alert("Error", "Faltan completar campos");
    }

    try {
        const res = await fetch(`${API_BASE}/clases-feriado`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${await AsyncStorage.getItem('viking_token')}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                fecha: getFechaSeleccionada(),
                nombre: formData.nombre,
                horario: parseFloat(formData.horario),
                coach: formData.coach,
                capacidad_max: parseInt(formData.capacidad),
                sucursal_id: Number(sucursalSeleccionada),
                color: "#FF0000"
            })
        });

        if (res.ok) {
            await fetchFeriadosYClases();
            setModalClaseFeriado(false);
            Alert.alert("Vikingo Pro", "Clase especial cargada.");
        } else {
            Alert.alert("Error", "No se pudo cargar la clase.");
        }
    } catch (e) {
        Alert.alert("Error", "Sin conexión.");
    }
};

const syncAlumnoData = async (alId) => {
    try {
        // Usamos los endpoints exactos que me pasaste
        const [pagosRes, facturasRes] = await Promise.all([
            fetch(`${API_BASE}/alumnos/${alId}/historial-pagos`),
            fetch(`${API_BASE}/comprobantes/usuario/${alId}`)
        ]);

        const pagos = await pagosRes.json();
        const facturas = await facturasRes.json();

        // Actualizamos el alumno en el estado global
        setSelectedStudent(prev => ({
            ...prev,
            historial_pagos: Array.isArray(pagos) ? pagos : [],
            facturas: Array.isArray(facturas) ? facturas : []
        }));
    } catch (e) {
        console.error("Error sincronizando:", e);
    }
};

  // ==========================================
  // 6. ACCIONES (API FETCHERS)
  // ==========================================
  
  const handleLogin = async () => {
    if (!dni || !password) return Alert.alert("Incompleto", "Ingresa DNI y Contraseña");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // --- AQUÍ ESTÁ LO QUE TE FALTA ---
        // Guardamos el token que viene en la respuesta (asumiendo que viene como data.access_token)
        if (data.access_token) {
            await AsyncStorage.setItem('viking_token', data.access_token);
        }
        // ----------------------------------
        
        setUser(data);
        const hash = await generateVikingHash(data.dni);
        setQrData(hash);
        
        const rol = data.rol_nombre?.toLowerCase().trim();
        const rolesAdmin = ['admin', 'administrador', 'dueño', 'supervisor', 'administracion', 'administrativo', 'profesor', 'staff'];
        
        if (rolesAdmin.includes(rol)) setView('admin_dashboard'); 
        else setView('dashboard_alumno');
      } else {
        Alert.alert("Error", data.detail || "Credenciales incorrectas");
      }
    } catch (error) { 
      Alert.alert("Error de Conexión", "El servidor Vikingo no responde."); 
    } finally { 
      setLoading(false); 
    }
  };

const handleLogout = () => {
    // Definimos la lógica de limpieza en una constante para no repetirla
    const executeLogout = () => {
        setUser(null);
        setRutina(null);
        setRutinaOwner(null); // Limpiamos también el dueño de la rutina
        setQrData('');        // Limpiamos el QR por seguridad
        setDni('');
        setPassword('');
        setMenuOpen(false);   // Cerramos el menú si estaba abierto
        setView('login');     // Volvemos al Login
    };

    // Verificamos si estamos en la Web (Render) o en la App Nativa
    if (Platform.OS === 'web') {
        // En navegadores, Alert.alert NO funciona. Usamos el confirm nativo.
        const confirmWeb = window.confirm("¿Seguro que quieres cerrar sesión, Guerrero?");
        if (confirmWeb) {
            executeLogout();
        }
    } else {
        // En dispositivos móviles (iOS/Android), usamos la alerta estética de RN
        Alert.alert(
            "Cerrar Sesión", 
            "¿Seguro que quieres salir?", 
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Salir", 
                    style: "destructive", 
                    onPress: executeLogout 
                }
            ]
        );
    }
};

// Esta función SÓLO busca las reservas
const fetchReservas = async () => {
    try {
        const ts = new Date().getTime(); 
        const res = await fetch(`${API_BASE}/reservas?sucursal_id=${sucursalSeleccionada}&t=${ts}`);
        
        if (res.ok) {
            const data = await res.json();
            setReservas(data); // Actualiza tus reservas
            
            // Si necesitas refrescar los cupos, podrías llamar a una función
            // que actualice las clases, pero NO llames a fetchReservas aquí adentro.
            if (typeof fetchClases === 'function') {
                await fetchClases();
            }
        }
    } catch (e) { 
        console.error("Error al cargar reservas:", e); 
    }
};

// Esta es la función maestra que refresca todo el calendario
const refrescarPantalla = async () => {
    await fetchReservas();  // Trae los datos de quién reservó
    await fetchClases();     // Trae la lista de clases con los cupos actualizados
};

const fetchClases = async () => {
    const token = await AsyncStorage.getItem('viking_token');
    
    if (!token) {
        console.warn("Token no encontrado, usuario no autenticado");
        return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const ts = new Date().getTime();
        
        const response = await fetch(`${API_BASE}/clases?t=${ts}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                // FORZAMOS LA LIMPIEZA DE CACHE
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            setClases(Array.isArray(data) ? data : []);
        } else {
            console.error(`Error ${response.status}:`, "No se pudo obtener el calendario");
            if (response.status === 401) {
                Alert.alert("Sesión expirada", "Inicia sesión nuevamente.");
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error("La solicitud al calendario superó el tiempo de espera.");
        } else {
            console.error("Fallo crítico de red:", error);
        }
    } finally {
        setLoading(false);
        clearTimeout(timeoutId);
    }
};

  const fetchRutina = async (userId, userName) => {
    try {
      const ts = new Date().getTime();
      const res = await fetch(`${API_BASE}/rutinas/usuario/${userId}?t=${ts}`);
      if (res.ok) { 
        const data = await res.json(); 
        if(!data.dias) data.dias = []; 
        setRutina(data); 
        setRutinaOwner(userName); 
      } else { 
        setRutina(null); 
        setRutinaOwner(userName); 
      }
    } catch (e) { setRutina(null); }
  };

  const fetchUsuarios = async () => {
    try { 
        const ts = new Date().getTime();
        const res = await fetch(`${API_BASE}/alumnos?t=${ts}`); 
        if(res.ok) setUsuarios(await res.json()); 
    } catch(e){}
  };

const fetchStaff = async () => {
    // 1. Verificación corregida: usamos access_token
    if (!user || !user.access_token) {
        console.log("DEBUG: Token no encontrado. Revisar el objeto user:", user);
        return;
    }

    try {
        const ts = new Date().getTime();
        // 2. Usamos el campo correcto aquí también
        const headers = { 
            'Authorization': `Bearer ${user.access_token}`, 
            'Content-Type': 'application/json' 
        };

        const [resProfes, resAdmins] = await Promise.all([
            fetch(`${API_BASE}/profesores?t=${ts}`, { headers }), 
            fetch(`${API_BASE}/administrativos?t=${ts}`, { headers })
        ]);

        if (resProfes.ok && resAdmins.ok) {
            const p = await resProfes.json(); 
            const a = await resAdmins.json();
            setStaffList([...p, ...a]);
            console.log("¡Staff cargado! Cantidad:", p.length + a.length);
        } else {
            console.log("Error en servidor:", resProfes.status, resAdmins.status);
        }
    } catch(e) {
        console.error("Fallo al traer el staff:", e);
    }
};

const fetchCaja = async () => {
    if (!user || !user.access_token) return;

    setLoading(true);
    try {
        const ts = new Date().getTime();
        const sID = Number(sucursalSeleccionada); // Obtenemos la sucursal activa
        
        const headers = { 
            'Authorization': `Bearer ${user.access_token}`,
            'Content-Type': 'application/json' 
        };

        // Agregamos sucursal_id a los endpoints
        const urlMovs = `${API_BASE}/caja/movimientos?sucursal_id=${sID}&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}&t=${ts}`;
        const urlResumen = `${API_BASE}/caja/resumen?sucursal_id=${sID}&t=${ts}`;

        const [resResumen, resMovs] = await Promise.all([
            fetch(urlResumen, { headers }), 
            fetch(urlMovs, { headers })
        ]);

        if (resResumen.ok && resMovs.ok) {
            const r = await resResumen.json(); 
            const m = await resMovs.json();
            
            setCaja({ 
                ingresos: r.ingresos, 
                gastos: r.gastos, 
                balance: r.balance, 
                movimientos: Array.isArray(m) ? m : [] 
            });
        } else {
            Alert.alert("Error", "No se pudieron obtener los datos financieros.");
        }
    } catch(e) {
        console.error("Fallo al traer caja:", e);
    } finally {
        setLoading(false);
    }
};

const fetchStock = async () => {
    if (!user || !user.access_token) return;

    setLoading(true);
    try {
        const sID = Number(sucursalSeleccionada);
        const ts = new Date().getTime();
        const headers = { 
            'Authorization': `Bearer ${user.access_token}`,
            'Content-Type': 'application/json' 
        };

        // Pasamos el sucursal_id como query param
        const response = await fetch(`${API_BASE}/stock?sucursal_id=${sID}&t=${ts}`, { headers });

        if (response.ok) {
            const data = await response.json();
            setStock(Array.isArray(data) ? data : []);
        } else {
            console.error("Error al obtener stock:", response.status);
        }
    } catch (e) {
        Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
        setLoading(false);
    }
};

  const fetchPlanes = async () => {
      try { 
        const res = await fetch(`${API_BASE}/planes`); 
        if(res.ok) setPlanes(await res.json()); 
      } catch(e){}
  };

  // ==========================================
  // 7. GESTIÓN DE NEGOCIO (POST/PUT/DELETE)
  // ==========================================
  
 const handleCreateUser = async (isStaff = false) => {
    const endpoint = isStaff ? '/staff' : '/alumnos';
    
    // Preparamos el body con los datos del formData
    const body = { 
        nombre_completo: formData.nombre_completo,
        dni: formData.dni,
        email: formData.email || '',
        password: formData.password,
        especialidad: formData.especialidad || ''
    };

    if (!isStaff) { 
        body.fecha_vencimiento = new Date().toISOString().split('T')[0]; 
        body.plan_id = null; 
    } else { 
        // Aquí enviamos el rol seleccionado o Staff por defecto
        body.perfil_nombre = formData.rol || 'Staff'; 
    }

    // Validación antes de enviar
    if (!body.nombre_completo || !body.dni || (isStaff && !body.password)) {
        return Alert.alert("Faltan Datos", "Nombre, Usuario y Contraseña son obligatorios");
    }

    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(body) 
        });

        if (res.ok) {
            Alert.alert("Vikingo Pro", "Usuario creado con éxito"); 
            setFormData({}); // Limpiamos el formulario
            if (isStaff) { 
                fetchStaff(); 
                setView('staff_list'); 
            } else { 
                fetchUsuarios(); 
                setView('usuarios_list'); 
            }
        } else { 
            const err = await res.json(); 
            Alert.alert("Error", err.detail || "Hubo un problema al crear el usuario"); 
        }
    } catch (e) { 
        Alert.alert("Error", "Error de conexión con el servidor"); 
    } finally { 
        setLoading(false); 
    }
};

const handleCreateMovimiento = async (tipo) => {
    if (!formData.monto || !formData.descripcion) return Alert.alert("Error", "Complete monto y descripción");
    
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/caja/movimiento`, {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.access_token}` // Agregado Token
            },
            body: JSON.stringify({ 
                tipo: tipo, 
                monto: parseFloat(formData.monto), 
                descripcion: formData.descripcion, 
                metodo_pago: formData.metodo_pago || 'Efectivo',
                comentario: formData.comentario || '',
                categoria: formData.categoria || '',
                sucursal_id: Number(sucursalSeleccionada) // Agregado Sucursal
            })
        });

        if (res.ok) { 
            Alert.alert("Vikingo Pro", "Movimiento registrado correctamente"); 
            setFormData({}); 
            await fetchCaja(); 
            setView('caja'); 
        } else {
            const err = await res.json();
            Alert.alert("Error", err.detail || "No se pudo registrar");
        }
    } catch (e) { 
        Alert.alert("Error", "Error de conexión"); 
    } finally { 
        setLoading(false); 
    }
};

const handleComprarMercaderia = async () => {
    if (!formData.producto_id || !formData.cantidad || !formData.costo_total) 
        return Alert.alert("Error", "Complete todos los campos");

    setLoading(true);
    const token = user.access_token;
    const sID = Number(sucursalSeleccionada);

    try {
        const prod = stock.find(p => p.id === parseInt(formData.producto_id));
        if (!prod) return;
        const newStock = prod.stock_actual + parseInt(formData.cantidad);
        
        // 1. Actualizar Stock
        await fetch(`${API_BASE}/stock/${prod.id}`, { 
            method: 'PUT', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }, 
            body: JSON.stringify({ ...prod, stock_actual: newStock, sucursal_id: sID }) 
        });
        
        // 2. Registrar Egreso en Caja
        await fetch(`${API_BASE}/caja/movimiento`, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }, 
            body: JSON.stringify({ 
                tipo: 'Egreso', 
                monto: parseFloat(formData.costo_total), 
                descripcion: `Compra Stock: ${prod.nombre_producto}`, 
                metodo_pago: 'Efectivo',
                sucursal_id: sID // <--- Clave: indicar a qué sucursal afecta
            }) 
        });
        
        Alert.alert("Éxito", "Stock actualizado y gasto registrado"); 
        setFormData({}); 
        fetchStock(); 
        fetchCaja();
        setView('stock');
    } catch(e) { 
        Alert.alert("Error", "Hubo un problema al procesar la compra"); 
    } finally { 
        setLoading(false); 
    }
};

const handleUpdateProfile = async () => {
    if (!formData.newEmail && !formData.newPassword) return Alert.alert("Error", "Completa al menos un campo");
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/alumnos/${user.id}/update-profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.newEmail || user.email,
                password: formData.newPassword || null
            })
        });
        if (res.ok) {
            Alert.alert("Éxito", "Perfil actualizado correctamente. Por seguridad, el sistema se cerrará.");
            handleLogout(); // Forzamos relogin para refrescar el token/datos
        } else {
            Alert.alert("Error", "No se pudo actualizar el perfil.");
        }
    } catch (e) {
        Alert.alert("Error", "Sin conexión con el servidor");
    } finally {
        setLoading(false);
    }
};

const handleRenovarPlan = async () => {
    // 1. Validaciones
    if (!formData.plan_id || !selectedStudent || !formData.membresia || !formData.metodo) {
        return Alert.alert("Guerrero Incompleto", "Por favor seleccione Duración, Método de Pago y un Plan.");
    }

    setLoading(true);

    try {
        // Recuperar token para autenticación
        const token = await AsyncStorage.getItem('viking_token');
        if (!token) throw new Error("Sesión no válida. Por favor, inicia sesión nuevamente.");

        // Buscamos el plan localmente
        const planSeleccionado = planes.find(p => p.id === parseInt(formData.plan_id));
        if (!planSeleccionado) throw new Error("Plan no encontrado en el sistema local.");

        // 2. Preparamos el payload
        const payload = {
            tipo: "Plan",
            monto: parseFloat(formData.precio_base),
            descripcion: `Renovación ${formData.membresia}: ${selectedStudent.nombre_completo}`,
            metodo_pago: formData.metodo,
            alumno_id: parseInt(selectedStudent.id),
            producto_id: parseInt(formData.plan_id),
            cantidad: 1,
            cuotas: 1,
            descripcion2: formData.comentario || ""
        };

        console.log("Enviando cobro al servidor:", payload);

        // 3. Llamada al servidor con autenticación
        const response = await fetch(`${API_BASE}/cobros/procesar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- ESTO SOLUCIONA EL ERROR 401
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            // 4. ÉXITO
            Alert.alert(
                "Vikingo Pro", 
                `¡Cobro realizado con éxito!\n\nGuerrero: ${selectedStudent.nombre_completo}\nEl vencimiento se actualizó automáticamente.`
            ); 
            
            setFormData({}); 
            
            // Refrescamos los datos
            await fetchUsuarios(); 
            await fetchCaja();
            
            setView('detalle_alumno'); 

        } else {
            // Manejo de error específico del servidor
            throw new Error(result.detail || "Error en el procesador de cobros.");
        }

    } catch (e) {
        Alert.alert("Error de Operación", e.message || "No se pudo procesar. Revisa la conexión.");
        console.error("Detalle del error:", e);
    } finally {
        setLoading(false);
    }
};


// Modificación clave: Cuando cambia el nombre de la actividad, actualiza la capacidad
const handleActividadChange = (nombreActividad) => {
    const claseDB = clases.find(c => c.nombre === nombreActividad);
    setFormData(prev => ({
        ...prev,
        nombre: nombreActividad,
        capacidad: claseDB ? claseDB.capacidad_max.toString() : '20'
    }));
};


  const addSchedule = () => {
    if (!formData.tempDia || !formData.tempHorario || !formData.tempCoach) {
      return Alert.alert("Atención", "Seleccioná día, horario y coach");
    }
    setClassSchedules([
      ...classSchedules,
      {
        id: Date.now(),
        dia: formData.tempDia,
        horario: formData.tempHorario,
        coach: formData.tempCoach 
      }
    ]);
    setFormData({ ...formData, tempDia: '', tempHorario: '', tempCoach: '' });
  };

  const removeSchedule = (id) => {
    setClassSchedules(classSchedules.filter(s => s.id !== id));
  };

  const handleMoveExercise = (diaIndex, exerciseIndex, direction) => {
      if (!rutina) return;
      const newRutina = { ...rutina };
      const ejercicios = newRutina.dias[diaIndex].ejercicios;
      const newIndex = exerciseIndex + direction;
      if (newIndex < 0 || newIndex >= ejercicios.length) return;
      
      const temp = ejercicios[exerciseIndex];
      ejercicios[exerciseIndex] = ejercicios[newIndex];
      ejercicios[newIndex] = temp;
      
      setRutina(newRutina);
  };

  const getSemanasDisponibles = () => {
    if (!rutina || !rutina.dias) return [1];
    const semanas = new Set();
    rutina.dias.forEach(d => {
      d.ejercicios?.forEach(ex => {
        if (ex.semana_id) semanas.add(ex.semana_id);
      });
    });
    const result = Array.from(semanas);
    return result.length > 0 ? result.sort((a, b) => a - b) : [1];
  };

  // ==========================================
  // 8. RENDERIZADO DE VISTAS (UI)
  // ==========================================

    if (view === 'login') {
    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}> 
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        
        <ImageBackground 
            source={{ uri: WALLPAPER_URL }} 
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
        >
            <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
            >
            <SafeAreaView style={{ flex: 1 }}>
                {/* AGREGUÉ backgroundColor: 'transparent' para forzar que no haya color */}
                <View style={[styles.loginContainer, { backgroundColor: 'transparent' }]}>
                
                <View style={{ alignItems: 'center', marginBottom: 50 }}>
                    <Image 
                    source={{ uri: LOGO_URL }} 
                    style={{ width: 380, height: 230, resizeMode: 'contain', marginBottom: 10 }} 
                    />
                </View>

                <View style={styles.inputContainer}>
                    <User size={20} color="#71717a" style={styles.inputIcon} />
                    <TextInput 
                    style={styles.input} 
                    placeholder="USUARIO O DNI" 
                    placeholderTextColor="#71717a" 
                    value={dni} 
                    onChangeText={setDni} 
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Lock size={20} color="#71717a" style={styles.inputIcon} />
                    <TextInput 
                    style={styles.input} 
                    placeholder="CONTRASEÑA" 
                    placeholderTextColor="#71717a" 
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    />
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>INGRESAR AL SISTEMA</Text>}
                </TouchableOpacity>
                </View>
            </SafeAreaView>
            </KeyboardAvoidingView>
        </ImageBackground>
        </View>
    );
    }

  const Header = () => (
    <View style={styles.header}>
        <TouchableOpacity onPress={() => setView(perms.isAdminDashboard() ? 'admin_dashboard' : 'dashboard_alumno')} style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
            <Image source={{ uri: LOGO_URL }} style={{ width: 40, height: 40, resizeMode: 'contain', borderRadius: 20, backgroundColor: 'white' }} />
            <View>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                    <Text style={styles.headerTitle}>{user?.nombre_completo?.split(' ')[0]}</Text>
                    {user?.certificado_entregado && <CheckCircle2 size={16} color="#3b82f6" />}
                </View>
                <Text style={styles.headerSubtitle}>{user?.rol_nombre || 'ALUMNO'}</Text>
            </View>
        </TouchableOpacity>
        <View style={{flexDirection: 'row', gap: 10}}>
             {perms.isAdminDashboard() && (
                <TouchableOpacity style={styles.iconButton} onPress={() => setMenuOpen(true)}>
                    <Menu size={20} color="white" />
                </TouchableOpacity>
             )}
             <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
                <LogOut size={20} color="#a1a1aa" />
             </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{paddingBottom: 120}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => perms.isAdminDashboard() ? fetchAllAdminData() : fetchStudentData()} tintColor="#dc2626" />}
      >
        
        {/* DASHBOARD ALUMNO */}
        {view === 'dashboard_alumno' && (
            <View style={{ gap: 20 }}>
                <View style={[styles.card, { borderColor: getStatusColor(user?.fecha_vencimiento), backgroundColor: '#18181b', borderWidth: 1.5 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={styles.cardLabel}>MI ESTADO</Text>
                            <Text style={[styles.statusText, { color: getStatusColor(user?.fecha_vencimiento) }]}>
                                {new Date(user?.fecha_vencimiento) < new Date() ? 'VENCIDO' : 'ACCESO ACTIVO'}
                            </Text>
                            <Text style={styles.dateText}>Vence: {formatDate(user?.fecha_vencimiento)}</Text>
                        </View>
                        <View style={[styles.iconBox, { backgroundColor: getStatusColor(user?.fecha_vencimiento) + '20' }]}>
                            {new Date(user?.fecha_vencimiento) < new Date() ? <XCircle size={28} color="#ef4444" /> : <CheckCircle2 size={28} color="#22c55e" />}
                        </View>
                    </View>
                </View>

                <View style={[styles.grid, { justifyContent: 'space-between' }]}>
                    <View style={[styles.gridItemSmall, { width: '31%', height: 90, marginBottom: 0 }]}>
                        <Weight size={18} color="#71717a" />
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginTop: 5 }}>{user?.peso || '-'}kg</Text>
                        <Text style={styles.gridTextSmall}>PESO</Text>
                    </View>
                    <View style={[styles.gridItemSmall, { width: '31%', height: 90, marginBottom: 0 }]}>
                        <Ruler size={18} color="#71717a" />
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginTop: 5 }}>{user?.altura || '-'}m</Text>
                        <Text style={styles.gridTextSmall}>ALTURA</Text>
                    </View>
                    <View style={[styles.gridItemSmall, { width: '31%', height: 90, marginBottom: 0 }]}>
                        <TrendingUp size={18} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 14, marginTop: 5 }}>{user?.imc || '-'}</Text>
                        <Text style={styles.gridTextSmall}>IMC</Text>
                    </View>
                </View>

                <View style={{ gap: 10, marginBottom: 20 }}>
                    <Text style={styles.sectionLabel}>MI ACCESO</Text>
                    <TouchableOpacity 
                        style={styles.mainButtonFull} 
                        onPress={() => {
                            // 1. Generamos el hash SHA256 del DNI + la Key (Igual que en tu backend)
                            const hash = CryptoJS.SHA256(user.dni + "Vikingo_Security_Strong_Key_2025").toString();
                            
                            // 2. El valor del QR es DNI:HASH
                            const qrValue = `${user.dni}:${hash}`;
                            
                            setQrData(qrValue);
                            setView('ver_qr');
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <QrCode size={20} color="white" />
                            <Text style={styles.mainButtonText}>GENERAR QR DE ENTRADA</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* SECCIÓN RESERVAS Y PLAN */}
                <View style={{ gap: 20 }}>
                    
                    {/* PRÓXIMA RESERVA */}
                    <View style={styles.infoCard}>
                        <Text style={styles.cardTitle}>PRÓXIMA CLASE</Text>
                        {(() => {
                            const hoy = new Date().toISOString().split('T')[0];
                            const proxima = reservas
                                .filter(r => r.usuario_id === user.id && r.fecha_clase >= hoy)
                                .sort((a, b) => {
                                    // Primero comparamos fecha
                                    if (a.fecha_clase !== b.fecha_clase) return new Date(a.fecha_clase) - new Date(b.fecha_clase);
                                    // Si es el mismo día, comparamos el valor numérico del horario
                                    return parseFloat(a.horario) - parseFloat(b.horario);
                                })[0];

                            if (proxima) {
                                return (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoValue}>{proxima.clase_nombre}</Text>
                                        <Text style={styles.infoLabel}>{formatHoraVikinga(proxima.horario)} hs</Text>
                                    </View>
                                );
                            }
                            return <Text style={styles.subtitle}>No tenés reservas pendientes</Text>;
                        })()}
                    </View>

                    {/* ÚLTIMAS 5 RESERVAS (FILAS) */}
                    <View>
                        <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>HISTORIAL Y PRÓXIMAS</Text>
                        {reservas
                            .filter(r => r.usuario_id === user.id)
                            // Ordenamos: las más futuras arriba, las más viejas abajo
                            .sort((a, b) => new Date(b.fecha_clase) - new Date(a.fecha_clase) || parseFloat(b.horario) - parseFloat(a.horario))
                            .slice(0, 5)
                            .map((res, idx) => {
                                const ahora = new Date();
                                const hoyStr = ahora.toISOString().split('T')[0];
                                const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
                                
                                // Lógica para saber si esta fila es la "Siguiente"
                                const esProxima = res.fecha_clase > hoyStr || (res.fecha_clase === hoyStr && parseFloat(res.horario) > horaActual);

                                return (
                                    <View 
                                        key={idx} 
                                        style={[
                                            styles.listItem, 
                                            esProxima && { borderLeftWidth: 3, borderLeftColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)' }
                                        ]}
                                    >
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Text style={styles.itemTitle}>{res.clase_nombre}</Text>
                                                {esProxima && <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: 'bold' }}>• SIGUIENTE</Text>}
                                            </View>
                                            <Text style={styles.itemSubtitle}>
                                                {res.fecha_clase.split('-').reverse().join('/')}
                                            </Text>
                                        </View>
                                        <Text style={{ color: esProxima ? '#22c55e' : '#dc2626', fontWeight: 'bold' }}>
                                            {formatHoraVikinga(res.horario)} hs
                                        </Text>
                                    </View>
                                );
                            })}
                    </View>

                    {/* DETALLE DE TEXTO DEL PLAN */}
                    <View style={styles.obsContainer}>
                        <Text style={[styles.cardTitle, { marginBottom: 5 }]}>DETALLES DE MI PLAN</Text>
                        <Text style={{ color: 'white', fontSize: 13, lineHeight: 18 }}>
                            Tu plan <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{user.plan?.nombre || 'Personalizado'}</Text> incluye acceso a todas las clases de: 
                            {"\n"}• Musculación libre y seguimiento profesional.
                            {"\n"}• Clases de {user.plan?.clases_mensuales || '∞'} veces por mes.
                            {"\n"}• Acceso a vestuarios y lockers.
                        </Text>
                    </View>
                </View>
            </View>
        )}

        {/* MODULO: GESTIÓN DE RESERVAS */}
        {view === 'mis_reservas' && (
            <View style={{ gap: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => setView('dashboard_alumno')}>
                        <ChevronLeft size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.sectionTitle}>MIS RESERVAS</Text>
                    <View style={{ width: 24 }} /> 
                </View>

                <ScrollView style={{ maxHeight: '90%' }}>
                    {reservas
                        .filter(r => r.usuario_id === user.id)
                        .sort((a, b) => new Date(b.fecha_clase) - new Date(a.fecha_clase))
                        .map((res, idx) => {
                            const hoy = new Date().toISOString().split('T')[0];
                            const esCancelable = res.fecha_clase >= hoy;

                            return (
                                <View key={idx} style={[styles.listItem, { marginBottom: 12, paddingVertical: 15 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{res.clase_nombre}</Text>
                                        <Text style={styles.itemSubtitle}>
                                            {res.fecha_clase.split('-').reverse().join('/')} - {formatHoraVikinga(res.horario)}hs
                                        </Text>
                                    </View>

                                    {esCancelable ? (
                                        <TouchableOpacity 
                                            onPress={() => handleCancelarReserva(res.id)}
                                            style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', padding: 8, borderRadius: 8 }}
                                        >
                                            <Trash2 size={20} color="#dc2626" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={{ color: '#52525b', fontSize: 10, fontWeight: 'bold' }}>FINALIZADA</Text>
                                    )}
                                </View>
                            );
                        })}
                </ScrollView>
            </View>
        )}

        {/* VISTA PARA MOSTRAR EL QR (FUERA DEL DASHBOARD) */}
        {view === 'ver_qr' && (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <TouchableOpacity 
                    onPress={() => setView('dashboard_alumno')} 
                    style={{ position: 'absolute', top: 50, left: 20, flexDirection: 'row', alignItems: 'center' }}
                >
                    <ChevronLeft size={24} color="white" />
                    <Text style={{ color: 'white', marginLeft: 10, fontWeight: '900' }}>VOLVER</Text>
                </TouchableOpacity>

                <View style={{ backgroundColor: 'white', padding: 30, borderRadius: 40, alignItems: 'center' }}>
                    <Text style={{ color: 'black', fontWeight: '900', marginBottom: 20, fontSize: 12, letterSpacing: 2 }}>QR PASS</Text>
                    
                    <QRCodePackage
                        value={qrData} // Esto ya tiene el formato "DNI:HASH" que definimos en el botón
                        size={260}
                        color="black"
                        backgroundColor="white"
                    />
                    
                    <Text style={{ color: 'rgba(0,0,0,0.4)', marginTop: 20, fontSize: 11, fontWeight: '900' }}>
                        {user?.nombre_completo?.toUpperCase()}
                    </Text>
                </View>

                <Text style={{ color: '#71717a', marginTop: 40, textAlign: 'center', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 30 }}>
                    Presentá este código en el lector para habilitar tu ingreso.
                </Text>
            </View>
        )}

        {/* MODULO: CALENDARIO - CLASES - RESERVAS (INTEGRACIÓN TOTAL) */}
        {view === 'clases' && (
            <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
                
                {/* HEADER VIKINGO - ESTILO AJUSTADO */}
                <View style={{ backgroundColor: '#09090b', borderBottomWidth: 1, borderColor: '#27272a', padding: 20, paddingTop: 40, zIndex: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 22, fontWeight: '900', fontStyle: 'italic', color: '#ef4444', letterSpacing: -0.5 }}>CALENDARIO</Text>
                        
                        {/* SUCURSAL SELECTOR */}
                        <TouchableOpacity 
                            onPress={() => setShowSucursalMenu(!showSucursalMenu)} 
                            style={{ backgroundColor: '#18181b', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#27272a' }}>
                            <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: 'bold' }}>
                                {sucursales.find(s => Number(s.id) === Number(sucursalSeleccionada))?.sucursal.toUpperCase() || "SELECCIONAR..."}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* MENÚ DESPLEGABLE SUCURSALES */}
                    {showSucursalMenu && (
                        <View style={{ backgroundColor: '#18181b', borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#27272a', position: 'absolute', top: 100, right: 20, width: 220, zIndex: 100, overflow: 'hidden' }}>
                            {sucursales.map((s) => (
                                <TouchableOpacity key={s.id} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' }} onPress={() => { setSucursalSeleccionada(s.id); setShowSucursalMenu(false); }}>
                                    <Text style={{ color: Number(sucursalSeleccionada) === Number(s.id) ? '#ef4444' : 'white', fontWeight: 'bold' }}>{s.sucursal.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* SELECTOR BOXES */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                        {[...new Set(clases.filter(c => Number(c.sucursal_id) === Number(sucursalSeleccionada)).map(c => (c.box_nombre || 'Principal').trim()))].map((box) => (
                            <TouchableOpacity key={box} onPress={() => setSelectedBox(box)}
                                style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: (selectedBox || 'Principal').trim() === box ? '#ef4444' : '#18181b' }}>
                                <Text style={{ color: (selectedBox || 'Principal').trim() === box ? 'white' : '#a1a1aa', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{box}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* NAVEGADOR FECHAS */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 }}>
                        <TouchableOpacity onPress={() => setWeekOffset(prev => prev - 1)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>◀ ANT</Text></TouchableOpacity>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#d4d4d8' }}>
                            {(() => {
                                const today = new Date();
                                const mon = new Date(today.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (weekOffset * 7)));
                                const sun = new Date(mon); sun.setDate(mon.getDate() + 5);
                                return `DEL ${mon.getDate()} AL ${sun.getDate()} JUN`;
                            })()}
                        </Text>
                        <TouchableOpacity onPress={() => setWeekOffset(prev => prev + 1)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>SIG ▶</Text></TouchableOpacity>
                    </View>

                    {/* TABS DÍAS */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                        {[1, 2, 3, 4, 5, 6].map((num) => {
                            const today = new Date();
                            const monday = new Date(today.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (weekOffset * 7)));
                            const fechaDia = new Date(monday); fechaDia.setDate(monday.getDate() + (num - 1));
                            return (
                                <TouchableOpacity key={num} onPress={() => setDiaActivo(num)} style={{ alignItems: 'center', width: 50, paddingBottom: 8, borderBottomWidth: diaActivo === num ? 2 : 0, borderBottomColor: '#ef4444' }}>
                                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: diaActivo === num ? 'white' : '#52525b' }}>{getDayName(num).toUpperCase().substring(0,3)}</Text>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: diaActivo === num ? 'white' : '#52525b', marginTop: 2 }}>{fechaDia.getDate()}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* LISTA CLASES */}
                <ScrollView style={{ padding: 15 }}>
                    {(() => {
                        const getFechaReal = (num) => {
                            const today = new Date();
                            const monday = new Date(today.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (weekOffset * 7)));
                            const f = new Date(monday); f.setDate(monday.getDate() + (num - 1));
                            return f.toISOString().split('T')[0];
                        };
                        const sID_App = Number(sucursalSeleccionada || 0);
                        const fechaActualStr = getFechaReal(diaActivo);
                        const esFeriado = feriados?.some(f => f.fecha === fechaActualStr && Number(f.sucursal_id) === sID_App); 

                        // --- FUNCIÓN RENDER FILA UNIFICADA ---
                        const renderFilaClase = (item, esEspecial, index) => {

                            // LOG DE DIAGNÓSTICO (Solo déjalo mientras testeas)
                            console.log("DEBUG CLASE:", item.nombre, "Cupos:", item.cupos_reservados, "Max:", item.capacidad_max);

                            const colorClase = item.color || '#ef4444';
                            const horario = esEspecial ? item.horario : item.slot.horario;
                            const coach = esEspecial ? item.coach : item.slot.coach;
                            
                            // Clave única basada en ID, horario y cupos. 
                            // Al incluir cupos_reservados, React redibuja la fila automáticamente cuando el servidor devuelve un nuevo cupo.
                            const uniqueKey = `clase-${item.id}-${horario}-${item.sucursal_id}-${item.cupos_reservados}-${new Date().getTime()}`;

                            return (
                                <TouchableOpacity 
                                    key={uniqueKey}
                                    onPress={() => {
                                        if (user.role === 'admin') {
                                            setSelectedClassDetails(item); 
                                            setModalAlumnosOpen(true);
                                        } else {
                                            const cupos = item.cupos_reservados || 0;
                                            const max = item.capacidad_max || 40;
                                            if (cupos >= max) {
                                                Alert.alert("Aviso", "Esta clase ya no tiene cupos disponibles.");
                                                return;
                                            }
                                            Alert.alert("Confirmar", "¿Reservar este turno?", [
                                                { text: "No" },
                                                { text: "Sí", onPress: () => handleReservarClase(item) }
                                            ]);
                                        }
                                    }}
                                    style={{ 
                                        backgroundColor: '#18181b', padding: 20, borderRadius: 16, marginBottom: 12, 
                                        borderWidth: 1, borderColor: '#27272a', borderLeftWidth: 8, borderLeftColor: colorClase 
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>{item.nombre.toUpperCase()}</Text>
                                            <Text style={{ fontSize: 11, color: '#a1a1aa', fontWeight: '500', marginTop: 4 }}>Coach: {coach || 'STAFF'}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colorClase }}>{formatHoraVikinga(horario)}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'white', backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 }}>
                                                {item.cupos_reservados || 0} / {item.capacidad_max || 40}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        };

                        if (esFeriado) {
                            return (
                                <View style={{ marginTop: 10 }}>
                                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                        <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 14 }}>DÍA FERIADO - CLASES ESPECIALES</Text>
                                    </View>
                                    
                                    {clasesFeriado?.filter(c => c.fecha === fechaActualStr).map((item, idx) => renderFilaClase(item, true, idx))}
                                    
                                    {/* Solo mostrar si es admin */}
                                    {user.role === 'admin' && (
                                    <TouchableOpacity onPress={openModalFeriado} style={{ marginTop: 15, backgroundColor: '#18181b', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#27272a' }}>
                                        <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>+ AGREGAR CLASE ESPECIAL</Text>
                                    </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }

                        const listado = clases.flatMap(c => {
                            const matchSucursal = Number(c.sucursal_id || 0) === sID_App;
                            const matchBox = (c.box_nombre || 'Principal').trim().toLowerCase() === (selectedBox || 'Principal').trim().toLowerCase();
                            const hDisp = (Array.isArray(c.horarios_detalle) ? c.horarios_detalle : []).filter(h => Number(h.dia) === Number(diaActivo));
                            
                            if (!matchSucursal || !matchBox || hDisp.length === 0) return [];
                            
                            // AQUÍ ESTÁ EL CAMBIO: Aseguramos que cupos_reservados y capacidad_max 
                            // se pasen al nuevo objeto, buscando si vienen en el slot o en el objeto principal
                            return hDisp.map(h => ({ 
                                ...c, 
                                slot: h,
                                cupos_reservados: h.cupos_reservados !== undefined ? h.cupos_reservados : (c.cupos_reservados || 0),
                                capacidad_max: h.capacidad_max !== undefined ? h.capacidad_max : (c.capacidad_max || 40)
                            }));
                        }).sort((a, b) => parseFloat(a.slot.horario) - parseFloat(b.slot.horario));

                        return (
                            <>
                                {/* SOLO MOSTRAR SI ES ADMIN */}
                                {user.role === 'admin' && (
                                <TouchableOpacity style={{ marginBottom: 20, backgroundColor: '#18181b', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#27272a' }}
                                    onPress={() => Alert.prompt("Marcar Feriado", "Motivo:", (m) => handleCrearFeriado(m))}>
                                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 10 }}>LIMPIAR DÍA (MARCAR FERIADO)</Text>
                                </TouchableOpacity>
                                )}

                                {listado.length > 0 ? listado.map((item, idx) => renderFilaClase(item, false, idx)) : (
                                    <View style={{ paddingVertical: 40, alignItems: 'center' }}><Text style={{ color: '#52525b' }}>No hay turnos disponibles.</Text></View>
                                )}
                            </>
                        );
                    })()}
                </ScrollView>

                    <Modal visible={modalClaseFeriado} transparent={true} animationType="slide" onRequestClose={() => setModalClaseFeriado(false)}>
                        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.95)', padding: 20 }}>
                            <View style={{ backgroundColor: '#18181b', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#27272a' }}>
                                
                                <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: '900', marginBottom: 20, textAlign: 'center', textTransform: 'uppercase' }}>
                                    Nueva Clase Especial
                                </Text>

                                {/* ACTIVIDAD */}
                                <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>ACTIVIDAD</Text>
                                <TouchableOpacity style={styles.selector} onPress={() => {
                                    const ops = [...new Set(clases.map(c => c.nombre))];
                                    Alert.alert("Seleccionar", "Elegí una actividad:", ops.map(n => ({ text: n, onPress: () => {
                                        const info = clases.find(c => c.nombre === n);
                                        setFormData({...formData, nombre: n, capacidad: info ? info.capacidad_max.toString() : '20'});
                                    }})));
                                }}>
                                    <Text style={{ color: 'white' }}>{formData.nombre || "Seleccionar actividad..."}</Text>
                                </TouchableOpacity>

                                {/* PROFESOR */}
                                <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 'bold', marginBottom: 4, marginTop: 15 }}>PROFESOR</Text>
                                <TouchableOpacity style={styles.selector} onPress={() => {
                                    Alert.alert("Seleccionar", "Elegí un profesor:", staffList.map(s => ({ text: s.nombre_completo, onPress: () => setFormData({...formData, coach: s.nombre_completo})})));
                                }}>
                                    <Text style={{ color: 'white' }}>{formData.coach || "Seleccionar profesor..."}</Text>
                                </TouchableOpacity>

                                {/* HORARIO Y CUPO */}
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>HORARIO</Text>
                                        <TouchableOpacity style={styles.selector} onPress={() => {
                                            const horas = [...Array(30).keys()].map(i => 7 + (i * 0.5));
                                            Alert.alert("Horario", "Elegir:", horas.map(h => ({ text: formatHoraVikinga(h), onPress: () => setFormData({...formData, horario: h})})));
                                        }}>
                                            <Text style={{ color: 'white' }}>{formData.horario ? formatHoraVikinga(formData.horario) : "00:00"}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>CUPO</Text>
                                        <TextInput 
                                            style={[styles.selector, { color: 'white', textAlign: 'center', height: 50, padding: 0 }]}
                                            value={formData.capacidad}
                                            keyboardType="numeric"
                                            placeholder="20"
                                            placeholderTextColor="#52525b"
                                            onChangeText={t => setFormData({...formData, capacidad: t})}
                                        />
                                    </View>
                                </View>

                                {/* BOTONES */}
                                <TouchableOpacity 
                                    onPress={handleCrearClaseFeriado} 
                                    style={{ backgroundColor: '#ef4444', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 25 }}
                                >
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>CONFIRMAR</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => setModalClaseFeriado(false)} 
                                    style={{ marginTop: 15, alignItems: 'center' }}
                                >
                                    <Text style={{ color: '#52525b', fontWeight: 'bold' }}>CANCELAR</Text>
                                </TouchableOpacity>

                            </View>
                        </View>
                    </Modal>
            </View>
        )}

        {/* MODULO: FORMULARIO NUEVA CLASE */}
        {view === 'form_clase' && (
            <View style={{ gap: 15 }}>
                <TouchableOpacity onPress={() => setView('clases')} style={{flexDirection:'row', alignItems:'center', marginBottom:15}}>
                    <ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>VOLVER AL CALENDARIO</Text>
                </TouchableOpacity>

                <Text style={styles.titleBig}>NUEVA CLASE</Text>
                
                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Nombre de la Clase (ej: Crossfit)" 
                    placeholderTextColor="gray" 
                    onChangeText={t => setFormData({...formData, nombre: t})}
                />
                
                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Cupo Máximo" 
                    placeholderTextColor="gray" 
                    keyboardType="numeric" 
                    onChangeText={t => setFormData({...formData, cupo: t})}
                />

                <TouchableOpacity 
                    style={[styles.mainButtonFull, {backgroundColor: '#22c55e', marginTop: 10}]} 
                    onPress={handleCreateClasses}
                >
                    <Text style={styles.mainButtonText}>GUARDAR CLASE</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* MODAL PARA VER ALUMNOS ANOTADOS - VERSIÓN SOLO LECTURA */}
        <Modal visible={modalAlumnosOpen} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '70%', backgroundColor: '#09090b' }]}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>ALUMNOS RESERVADOS</Text>
                            <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>
                                {selectedClassDetails?.nombre?.toUpperCase()} - {
                                    selectedClassDetails?.horario_especifico % 1 === 0 
                                    ? `${selectedClassDetails?.horario_especifico}:00` 
                                    : `${Math.floor(selectedClassDetails?.horario_especifico)}:30`
                                } HS
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setModalAlumnosOpen(false)}>
                            <X size={24} color="#a1a1aa" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                        {(() => {
                            // Mantenemos el filtrado exacto para que no veas gente de otros turnos
                            const inscriptos = (reservas || []).filter(r => 
                                String(r.clase_id) === String(selectedClassDetails?.id) && 
                                Number(r.dia_semana) === Number(selectedDayCalendar) &&
                                parseFloat(r.horario).toFixed(1) === parseFloat(selectedClassDetails?.horario_especifico).toFixed(1)
                            );

                            if (inscriptos.length === 0) {
                                return (
                                    <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.5 }}>
                                        <Users size={40} color="#3f3f46" />
                                        <Text style={{ color: '#71717a', marginTop: 10, fontWeight: 'bold' }}>SIN RESERVAS EN ESTE TURNO</Text>
                                    </View>
                                );
                            }

                            return inscriptos.map((res, i) => {
                                // Cruce de nombres que ya confirmamos que funciona
                                const usuarioInfo = (usuarios || []).find(u => 
                                    String(u.id || u.usuario_id) === String(res.alumno_id || res.usuario_id)
                                );
                                
                                const nombreAlumno = usuarioInfo?.nombre_completo || 
                                                    usuarioInfo?.nombre || 
                                                    res.nombre_completo || 
                                                    res.alumno_nombre || 
                                                    "Usuario Vikingo";

                                return (
                                    <View key={i} style={[styles.listItem, { 
                                        backgroundColor: '#18181b', 
                                        borderLeftColor: '#22c55e', 
                                        borderLeftWidth: 4, 
                                        marginBottom: 8,
                                        paddingVertical: 12
                                    }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' }}>
                                                <User size={16} color="#71717a" />
                                            </View>
                                            <View>
                                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                                                    {nombreAlumno.toUpperCase()}
                                                </Text>
                                                <Text style={{ color: '#71717a', fontSize: 10 }}>
                                                    DNI: {res.alumno_dni || usuarioInfo?.dni || '---'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            });
                        })()}
                    </ScrollView>
                    
                    <TouchableOpacity 
                        style={[styles.mainButtonFull, { backgroundColor: '#27272a', marginTop: 10 }]} 
                        onPress={() => setModalAlumnosOpen(false)}
                    >
                        <Text style={styles.mainButtonText}>CERRAR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* MODULO: GESTIÓN DE STOCK */}
        {view === 'stock' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
                {/* CABECERA */}
                <TouchableOpacity onPress={() => setView('admin_dashboard')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <ChevronLeft size={16} color="gray" />
                    <Text style={{ color: 'gray', marginLeft: 5, fontWeight: 'bold' }}>VOLVER</Text>
                </TouchableOpacity>

                {/* ACCIONES (Botones compactos y sólidos) */}
                <View style={{ flexDirection: 'row', gap: 10, marginVertical: 20 }}>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#312e81', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }} 
                        onPress={() => { setFormData({}); setView('form_nuevo_producto'); }}
                    >
                        <Plus size={18} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>NUEVO ITEM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#27272a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' }} 
                        onPress={fetchStock}
                    >
                        <RefreshCw size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* BÚSQUEDA */}
                <View style={[styles.searchBar, { marginBottom: 20 }]}>
                    <Search size={18} color="gray" />
                    <TextInput 
                        style={{ flex: 1, color: 'white', marginLeft: 10, fontWeight: 'bold' }} 
                        placeholder="Buscar producto..." 
                        placeholderTextColor="#52525b"
                        value={stockFilter}
                        onChangeText={setStockFilter}
                    />
                </View>

                {/* GRID DE PRODUCTOS */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {stock
                        .filter(p => p.nombre_producto.toLowerCase().includes(stockFilter.toLowerCase()))
                        .map((p, i) => {
                            // Lógica de imagen dinámica (igual a tu web)
                            const n = (p.nombre_producto || "").trim().split(' ');
                            const clave = n[n.length - 1].toLowerCase();
                            const imgUrl = p.url_imagen || `https://github.com/vikingo-44/Software-Gym/blob/main/imagenes/${clave}.png?raw=true`;

                            return (
                                <View key={i} style={{ width: '47%', backgroundColor: '#09090b', borderRadius: 20, padding: 12, borderColor: p.stock_actual <= 3 ? '#ef4444' : '#27272a', borderWidth: 1 }}>
                                    <Image source={{ uri: imgUrl }} style={{ width: '100%', height: 100, borderRadius: 12, marginBottom: 10 }} />
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 12, marginBottom: 5 }} numberOfLines={1}>{p.nombre_producto.toUpperCase()}</Text>
                                    <Text style={{ color: '#71717a', fontSize: 10, marginBottom: 10 }}>${formatMoney(p.precio_venta)}</Text>
                                    
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: p.stock_actual <= 3 ? '#ef4444' : '#22c55e', fontWeight: '900', fontSize: 16 }}>
                                            {p.stock_actual} <Text style={{ fontSize: 9 }}>u</Text>
                                        </Text>
                                        <TouchableOpacity 
                                            style={{ backgroundColor: '#27272a', padding: 8, borderRadius: 8 }}
                                            onPress={() => {
                                                setFormData(p); // Carga todo el producto seleccionado al estado de edición
                                                setModalEditStockVisible(true); // Abrimos el modal
                                            }}
                                        >
                                            <Pencil size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                </View>
            </ScrollView>
        )}

        {/* MODULO: FORMULARIO NUEVO PRODUCTO */}
        {view === 'form_nuevo_producto' && (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 15 }}>
                <TouchableOpacity onPress={() => setView('stock')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ChevronLeft size={16} color="gray" /><Text style={{ color: 'gray', marginLeft: 5 }}>CANCELAR</Text>
                </TouchableOpacity>

                <Text style={styles.titleBig}>NUEVA MERCADERÍA</Text>
                
                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Nombre del Producto" 
                    placeholderTextColor="gray" 
                    onChangeText={t => setFormData({...formData, nombre_producto: t})}
                />
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput 
                        style={[styles.inputDark, { flex: 1 }]} 
                        placeholder="Venta $" 
                        placeholderTextColor="gray" 
                        keyboardType="numeric" 
                        onChangeText={t => setFormData({...formData, precio_venta: t})}
                    />
                    <TextInput 
                        style={[styles.inputDark, { flex: 1 }]} 
                        placeholder="Stock Inicial" 
                        placeholderTextColor="gray" 
                        keyboardType="numeric" 
                        onChangeText={t => setFormData({...formData, stock_actual: t})}
                    />
                </View>

                {/* CAMPO: TOTAL PAGADO (El que va a caja como egreso) */}
                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Total Pagado (Costo Total) $" 
                    placeholderTextColor="gray" 
                    keyboardType="numeric" 
                    onChangeText={t => setFormData({...formData, total_pagado: t})}
                />

                {/* Selector de Categoría Estilo Web */}
                <View style={{ marginVertical: 10 }}>
                    <Text style={{ color: 'gray', fontSize: 12, marginBottom: 8 }}>CATEGORÍA</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {['Bebidas', 'Snacks', 'Suplementos', 'Alimentos', 'General'].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setFormData({...formData, categoria: cat})}
                                style={{
                                    backgroundColor: formData.categoria === cat ? '#ef4444' : '#27272a',
                                    paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.mainButtonFull, { backgroundColor: '#22c55e', marginTop: 10 }]} 
                    onPress={async () => {
                        if(!formData.nombre_producto || !formData.stock_actual || !formData.total_pagado) 
                            return Alert.alert("Error", "Faltan datos (Nombre, Stock y Total Pagado)");
                        
                        setLoading(true);
                        try {
                            const token = await AsyncStorage.getItem('viking_token');
                            const sID = Number(sucursalSeleccionada);
                            const totalGasto = parseFloat(formData.total_pagado);

                            // 1. Crear Producto
                            const resProd = await fetch(`${API_BASE}/stock`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({
                                    nombre_producto: formData.nombre_producto,
                                    precio_costo: totalGasto / parseInt(formData.stock_actual), // Calculamos unitario para el stock
                                    precio_venta: parseFloat(formData.precio_venta) || 0,
                                    stock_actual: parseInt(formData.stock_actual),
                                    categoria: formData.categoria || "General",
                                    sucursal_id: sID
                                })
                            });

                            if(resProd.ok) {
                                // 2. Registrar el Gasto Real en Caja
                                await fetch(`${API_BASE}/caja/movimiento`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({
                                        tipo: 'Egreso',
                                        monto: totalGasto, // Monto exacto que pagaste
                                        descripcion: `Compra Stock: ${formData.nombre_producto}`,
                                        metodo_pago: 'Efectivo',
                                        sucursal_id: sID,
                                        categoria: formData.categoria || 'General'
                                    })
                                });

                                Alert.alert("Vikingo Pro", "Producto cargado y gasto registrado.");
                                setFormData({}); 
                                fetchStock(); 
                                fetchCaja(); 
                                setView('stock');
                            } else {
                                Alert.alert("Error", "No se pudo cargar el producto.");
                            }
                        } catch(e) { 
                            Alert.alert("Error", "Error de conexión."); 
                        } finally { 
                            setLoading(false); 
                        }
                    }}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.mainButtonText}>GUARDAR PRODUCTO</Text>}
                </TouchableOpacity>
            </ScrollView>
        )}

        {/* GESTIÓN DE CAJA (MODO ADMIN) - FILTROS INTEGRADOS */}
        {view === 'caja' && (() => {
            // 1. Lógica de filtrado en tiempo real
            const movimientosFiltrados = caja.movimientos.filter(m => {
                const textoUpper = (m.descripcion + " " + (m.comentario || "")).toUpperCase();
                const buscaTexto = textoUpper.includes((cajaFilter || "").toUpperCase());
                
                // CORRECCIÓN: Los nombres de métodos deben ser EXACTAMENTE iguales a los que vienen de tu API
                const buscaMetodo = metodoFilter === 'Todos' || m.metodo_pago === metodoFilter;
                
                return buscaTexto && buscaMetodo;
            });

            return (
                <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
                    {/* VOLVER */}
                    <TouchableOpacity onPress={() => setView('admin_dashboard')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                        <ChevronLeft size={16} color="gray" />
                        <Text style={{ color: 'gray', marginLeft: 5, fontWeight: 'bold' }}>VOLVER</Text>
                    </TouchableOpacity>

                    {/* BALANCE */}
                    <View style={styles.balanceCard}>
                        <Text style={styles.cardLabel}>RENTABILIDAD TOTAL</Text>
                        <Text style={{ color: caja.balance >= 0 ? 'white' : '#ef4444', fontSize: 42, fontWeight: '900' }}>
                            {formatMoney(caja.balance)}
                        </Text>
                        <View style={{ flexDirection: 'row', width: '100%', marginTop: 20, justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ color: '#22c55e', fontSize: 9 }}>INGRESOS</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{formatMoney(caja.ingresos)}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: '#ef4444', fontSize: 9 }}>GASTOS</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{formatMoney(caja.gastos)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* FILTROS DE FECHA CON CALENDARIO */}
                    <View style={{ marginTop: 20 }}>
                        <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>RANGO DE FECHAS</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity 
                                style={[styles.inputDark, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} 
                                onPress={() => setShowDatePicker('desde')}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{fechaDesde || "DESDE"}</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.inputDark, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} 
                                onPress={() => setShowDatePicker('hasta')}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{fechaHasta || "HASTA"}</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={fetchCaja} style={{ backgroundColor: '#dc2626', padding: 12, borderRadius: 12, justifyContent: 'center' }}>
                                <RefreshCw size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* COMPONENTE CALENDARIO (IMPORTÁ DateTimePicker DE @react-native-community/datetimepicker) */}
                    {showDatePicker && (
                        <DateTimePicker
                            value={tempDate}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                        />
                    )}

                    {/* ACCIONES (Botones más chicos y colores sólidos) */}
                    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 20 }}>
                        <TouchableOpacity 
                            style={{ backgroundColor: '#16a34a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }} 
                            onPress={() => { setFormData({}); setView('form_ingreso'); }}
                        >
                            <Plus size={18} color="white" />
                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>INGRESO</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={{ backgroundColor: '#dc2626', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }} 
                            onPress={() => { setFormData({}); setView('form_egreso'); }}
                        >
                            <Minus size={18} color="white" />
                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>GASTO</Text>
                        </TouchableOpacity>
                    </View>

                    {/* BARRA DE BÚSQUEDA Y FILTROS */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>BÚSQUEDA Y FILTROS</Text>
                        <View style={styles.searchBar}>
                            <Search size={18} color="gray" />
                            <TextInput 
                                style={{ flex: 1, color: 'white', marginLeft: 10, fontWeight: 'bold' }} 
                                placeholder="Buscar por descripción..." 
                                placeholderTextColor="#52525b"
                                value={cajaFilter}
                                onChangeText={setCajaFilter}
                            />
                            {cajaFilter !== '' && (
                                <TouchableOpacity onPress={() => setCajaFilter('')}>
                                    <X size={18} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                            {['Todos', 'Efectivo', 'Transferencia', 'MercadoPago', 'T. Debito', 'T. Credito'].map((metodo) => (
                                <TouchableOpacity 
                                    key={metodo} 
                                    onPress={() => setMetodoFilter(metodo)}
                                    style={[
                                        styles.dayTab, 
                                        { paddingVertical: 8, paddingHorizontal: 15, height: 38 },
                                        metodoFilter === metodo && styles.dayTabActive
                                    ]}
                                >
                                    <Text style={{ color: metodoFilter === metodo ? 'white' : '#71717a', fontSize: 10, fontWeight: '900' }}>
                                        {metodo.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* MOVIMIENTOS */}
                    <Text style={styles.sectionLabel}>MOVIMIENTOS ({movimientosFiltrados.length})</Text>
                    {movimientosFiltrados.length > 0 ? (
                        movimientosFiltrados.map((m, i) => (
                            <View key={i} style={styles.listItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{m.descripcion}</Text>
                                    <Text style={styles.itemSubtitle}>
                                        {formatDate(m.fecha)} | <Text style={{ color: '#ef4444' }}>{m.metodo_pago ? m.metodo_pago.toUpperCase() : 'N/A'}</Text>
                                    </Text>
                                    {m.comentario ? (
                                        <Text style={{ color: '#52525b', fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
                                            Obs: {m.comentario}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text style={{ 
                                    color: m.tipo === 'Ingreso' ? '#22c55e' : '#ef4444', 
                                    fontWeight: '900',
                                    fontSize: 16
                                }}>
                                    {m.tipo === 'Ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <View style={{ alignItems: 'center', marginTop: 30, opacity: 0.3 }}>
                            <Search size={40} color="gray" />
                            <Text style={{ color: 'gray', marginTop: 10, fontWeight: 'bold' }}>Sin resultados.</Text>
                        </View>
                    )}
                </ScrollView>
            );
        })()}

        {/* GESTIÓN DE RUTINAS CON DETALLE EXPANDIDO (ACORDEÓN + COLUMNAS) */}
        {view === 'rutinas' && (
            <View>
                {perms.isAdminDashboard() && (
                    <TouchableOpacity onPress={() => setView('detalle_alumno')} style={{flexDirection:'row', alignItems:'center', marginBottom:15}}>
                        <ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>VOLVER</Text>
                    </TouchableOpacity>
                )}
                
                <View style={{alignItems: 'center', marginBottom: 20}}>
                    <Text style={styles.sectionLabel}>PLAN DE ENTRENAMIENTO</Text>
                    <Text style={styles.titleBig}>{rutina?.nombre_grupo || "SIN RUTINA"}</Text>
                    <Text style={styles.subtitle}>{rutina?.objetivo || "Consulte a su profesor"}</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    {getSemanasDisponibles().map(w => (
                        <TouchableOpacity key={w} onPress={() => setSemanaActiva(w)} style={[styles.dayTab, semanaActiva === w && styles.dayTabActive]}>
                            <Text style={[styles.dayTabText, semanaActiva === w && styles.dayTabTextActive]}>SEMANA {w}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {rutina?.dias?.map((dia, dIdx) => {
                    const ejs = dia.ejercicios.filter(e => !e.semana_id || e.semana_id === semanaActiva);
                    if (ejs.length === 0) return null;
                    
                    const isOpen = activeAccordion === dIdx;

                    return (
                        <View key={dIdx} style={[styles.dayCard, { marginBottom: 10 }]}>
                            <TouchableOpacity 
                                style={[styles.dayHeader, isOpen && { borderBottomWidth: 1, borderBottomColor: '#27272a' }]} 
                                onPress={() => setActiveAccordion(isOpen ? null : dIdx)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {isOpen ? <ArrowUp size={18} color="#ef4444" /> : <ArrowDown size={18} color="#71717a" />}
                                    <Text style={[styles.dayTitle, isOpen && { color: 'white' }]}>{dia.nombre_dia}</Text>
                                </View>
                                <Text style={styles.dayCount}>{ejs.length} EJS</Text>
                            </TouchableOpacity>

                            {isOpen && (
                                <View style={{ backgroundColor: '#09090b', padding: 10 }}>
                                    {ejs.map((ej, eIdx) => (
                                        <View key={eIdx} style={{ 
                                            backgroundColor: '#18181b', 
                                            borderRadius: 12, 
                                            padding: 15, 
                                            marginBottom: 10, 
                                            borderWidth: 1, 
                                            borderColor: '#27272a' 
                                        }}>
                                            {/* RENGLÓN 1: NOMBRE DEL EJERCICIO */}
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 15, marginBottom: 10, letterSpacing: 0.5 }}>
                                                {ej.ejercicio_obj?.nombre.toUpperCase()}
                                            </Text>

                                            {/* RENGLÓN 2: DATOS EN COLUMNAS (Series | Reps | Peso | Descanso) */}
                                            <View style={{ 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                backgroundColor: '#111113', 
                                                paddingVertical: 10, 
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#27272a'
                                            }}>
                                                <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#27272a' }}>
                                                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>SERIES</Text>
                                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{ej.series_detalle.length}</Text>
                                                </View>
                                                
                                                <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#27272a' }}>
                                                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>REPS</Text>
                                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{ej.series_detalle[0]?.repeticiones || '10'}</Text>
                                                </View>

                                                <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#27272a' }}>
                                                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>PESO</Text>
                                                    <Text style={{ color: '#22c55e', fontWeight: '900', fontSize: 14 }}>{ej.series_detalle[0]?.peso || '0'}kg</Text>
                                                </View>

                                                <View style={{ flex: 1, alignItems: 'center' }}>
                                                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>DESC.</Text>
                                                    <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 14 }}>90"</Text>
                                                </View>
                                            </View>

                                            {/* RENGLÓN 3: COMENTARIO TÉCNICO (Si existe) */}
                                            {ej.comentarios ? (
                                                <View style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    marginTop: 12, 
                                                    padding: 10,
                                                    backgroundColor: 'rgba(220, 38, 38, 0.05)',
                                                    borderRadius: 8,
                                                    borderLeftWidth: 3,
                                                    borderLeftColor: '#dc2626'
                                                }}>
                                                    <Info size={14} color="#dc2626" />
                                                    <Text style={{ color: '#d4d4d8', fontSize: 12, fontStyle: 'italic', marginLeft: 8, flex: 1 }}>
                                                        {ej.comentarios}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        )}

        {/* DASHBOARD ADMIN (CENTRO DE COMANDO) */}
        {view === 'admin_dashboard' && (
            <View>
                <Text style={styles.sectionTitle}>CENTRO DE COMANDO</Text>
                <View style={styles.grid}>
                    <TouchableOpacity style={styles.gridItem} onPress={() => { fetchUsuarios(); setView('usuarios_list'); }}>
                        <View style={styles.gridIconCircle}>
                            <GraduationCap size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.gridText}>Alumnos</Text>
                    </TouchableOpacity>

                    {/* BOTÓN STAFF: Solo Master */}
                    {perms.canManageStaff() && (
                        <TouchableOpacity style={styles.gridItem} onPress={() => { fetchStaff(); setView('staff_list'); }}>
                            <View style={styles.gridIconCircle}><Briefcase size={28} color="#3b82f6" /></View>
                            <Text style={styles.gridText}>Staff</Text>
                        </TouchableOpacity>
                    )}

                    {/* BOTÓN CAJA: Master y Administrativo */}
                    {perms.canManageMoney() && (
                        <TouchableOpacity style={styles.gridItem} onPress={() => { fetchCaja(); setView('caja'); }}>
                            <View style={styles.gridIconCircle}><Wallet size={28} color="#22c55e" /></View>
                            <Text style={styles.gridText}>Caja</Text>
                        </TouchableOpacity>
                    )}

                    {/* BOTÓN STOCK: Master y Administrativo */}
                    {perms.canViewStock() && (
                        <TouchableOpacity style={styles.gridItem} onPress={() => { fetchStock(); setView('stock'); }}>
                            <View style={styles.gridIconCircle}><Package size={28} color="#eab308" /></View>
                            <Text style={styles.gridText}>Stock</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[styles.gridItem, {width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 20}]} onPress={() => { fetchClases(); setView('clases'); }}>
                        <Calendar size={28} color="#a855f7" />
                        <Text style={styles.gridText}>Gestión de Clases</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}

        {/* MODULO: LISTA DE ALUMNOS */}
        {view === 'usuarios_list' && (
            <View>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
                    <TouchableOpacity onPress={() => setView('admin_dashboard')} style={{flexDirection:'row', alignItems:'center'}}><ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>VOLVER</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setFormData({}); setView('user_form'); }} style={styles.addButton}><Plus size={20} color="white"/></TouchableOpacity>
                </View>
                <View style={styles.searchBar}><Search size={20} color="gray" /><TextInput style={{flex:1, color:'white', marginLeft: 10}} placeholder="Buscar alumno..." placeholderTextColor="gray" onChangeText={setUserFilter}/></View>
                {usuarios.filter(u => u.nombre_completo.toLowerCase().includes(userFilter.toLowerCase())).map(u => (
                    <TouchableOpacity key={u.id} style={styles.listItem} onPress={() => { setSelectedStudent(u); fetchRutina(u.id, u.nombre_completo); setView('detalle_alumno'); syncAlumnoData(u.id); }}>
                        <View><Text style={styles.itemTitle}>{u.nombre_completo}</Text><Text style={styles.itemSubtitle}>{u.plan?.nombre || 'Sin Plan'}</Text></View>
                        <View style={{width:10, height:10, borderRadius:5, backgroundColor: new Date(u.fecha_vencimiento) < new Date() ? 'red' : 'green'}} />
                    </TouchableOpacity>
                ))}
            </View>
        )}

        {view === 'user_form' && (
            <View style={{ flex: 1, padding: 20 }}>
                <TouchableOpacity onPress={() => setView('usuarios_list')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <ChevronLeft size={16} color="gray" /><Text style={{ color: 'gray', marginLeft: 5 }}>CANCELAR</Text>
                </TouchableOpacity>

                <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>NUEVO GUERRERO</Text>

                <View style={{ gap: 15 }}>
                    <TextInput 
                        style={styles.input} placeholder="Nombre Completo" placeholderTextColor="#52525b"
                        onChangeText={t => setFormData(p => ({...p, nombre_completo: t}))}
                        value={formData.nombre_completo}
                    />
                    <TextInput 
                        style={styles.input} placeholder="DNI" placeholderTextColor="#52525b" keyboardType="numeric"
                        onChangeText={t => setFormData(p => ({...p, dni: t}))}
                        value={formData.dni}
                    />
                    <TextInput 
                        style={styles.input} placeholder="Email" placeholderTextColor="#52525b"
                        onChangeText={t => setFormData(p => ({...p, email: t}))}
                        value={formData.email}
                    />
                    <TextInput 
                        style={styles.input} placeholder="Contraseña Inicial" placeholderTextColor="#52525b" secureTextEntry
                        onChangeText={t => setFormData(p => ({...p, password: t}))}
                        value={formData.password}
                    />
                </View>

                <TouchableOpacity 
                    onPress={() => handleCreateUser(false)} // false porque es Alumno
                    style={{ backgroundColor: '#ef4444', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>REGISTRAR ALUMNO</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* MODULO: DETALLE ALUMNO (ADMIN) - FICHA COMPLETA */}
        {view === 'detalle_alumno' && selectedStudent && (() => {
            const cuposUsados = reservas.filter(r => r.usuario_id === selectedStudent.id).length;
            const cuposTotales = selectedStudent.plan?.clases_mensuales || 0;
            
            // Cálculo de IMC
            const peso = parseFloat(selectedStudent.peso) || 0;
            const altura = parseFloat(selectedStudent.altura) || 0;
            const imc = (peso > 0 && altura > 0) ? (peso / (altura * altura)).toFixed(1) : "---";
            
            return (
                <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <TouchableOpacity onPress={() => setView('usuarios_list')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ChevronLeft size={16} color="gray" /><Text style={{ color: 'gray', marginLeft: 5 }}>VOLVER</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => {
                                setFormData({
                                    nombre_completo: selectedStudent.nombre_completo,
                                    email: selectedStudent.email,
                                    dni: selectedStudent.dni,
                                    telefono: selectedStudent.telefono || '',
                                    peso: selectedStudent.peso || '',
                                    altura: selectedStudent.altura || '',
                                    newPassword: ''
                                });
                                setModalEditVisible(true);
                            }}
                            style={{ backgroundColor: '#27272a', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                            <Pencil size={14} color="white" />
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>EDITAR</Text>
                        </TouchableOpacity>
                    </View>

                    {/* HEADER: ESTADO DE CUOTA */}
                    <View style={[styles.card, { borderColor: getStatusColor(selectedStudent.fecha_vencimiento), backgroundColor: '#18181b', marginBottom: 12, borderLeftWidth: 8 }]}>
                        <Text style={styles.cardLabel}>ALUMNO SELECCIONADO</Text>
                        <Text style={styles.titleBig}>{selectedStudent.nombre_completo.toUpperCase()}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 5 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getStatusColor(selectedStudent.fecha_vencimiento) }} />
                            <Text style={[styles.statusText, { color: getStatusColor(selectedStudent.fecha_vencimiento), fontSize: 16, fontWeight: '900' }]}>
                                {new Date(selectedStudent.fecha_vencimiento) < new Date() ? 'DEUDA / VENCIDO' : 'CUOTA AL DÍA'}
                            </Text>
                        </View>
                    </View>

                    {/* SELECTOR DE PESTAÑAS */}
                    <View style={{ flexDirection: 'row', marginBottom: 15, backgroundColor: '#18181b', borderRadius: 12, padding: 4 }}>
                        {[ {id: 'ficha', label: 'FICHA'}, {id: 'pagos', label: 'PAGOS'}, {id: 'comprobantes', label: 'FACTURACIÓN'} ].map((tab) => (
                            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 }, activeTab === tab.id && { backgroundColor: '#dc2626' }]}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {activeTab === 'ficha' && (
                        <View style={{ gap: 15 }}>
                            {/* DATOS FÍSICOS AGREGADOS */}
                            <View style={styles.infoCard}>
                                <Text style={styles.cardTitle}>DATOS ANTROPOMÉTRICOS</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View style={{alignItems: 'center'}}><Text style={styles.cardLabel}>PESO</Text><Text style={{color:'white', fontWeight:'bold'}}>{selectedStudent.peso || '--'}kg</Text></View>
                                    <View style={{alignItems: 'center'}}><Text style={styles.cardLabel}>ALTURA</Text><Text style={{color:'white', fontWeight:'bold'}}>{selectedStudent.altura || '--'}m</Text></View>
                                    <View style={{alignItems: 'center'}}><Text style={styles.cardLabel}>IMC</Text><Text style={{color:'white', fontWeight:'bold'}}>{imc}</Text></View>
                                </View>
                            </View>

                            {/* BLOQUE 1: DATOS DE CONTACTO */}
                            <View style={styles.infoCard}>
                                <Text style={styles.cardTitle}>INFORMACIÓN DE CONTACTO</Text>
                                <View style={styles.infoRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Mail size={16} color="#71717a" /><Text style={styles.infoLabel}>EMAIL:</Text></View>
                                    <Text style={styles.infoValue}>{selectedStudent.email || 'No registrado'}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MessageCircle size={16} color="#71717a" /><Text style={styles.infoLabel}>WHATSAPP:</Text></View>
                                    <Text style={styles.infoValue}>{selectedStudent.telefono || 'Sin teléfono'}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><User size={16} color="#71717a" /><Text style={styles.infoLabel}>DNI:</Text></View>
                                    <Text style={styles.infoValue}>{selectedStudent.dni}</Text>
                                </View>
                            </View>

                            {/* BLOQUE 2: CONSUMO Y PLAN */}
                            <View style={styles.infoCard}>
                                <Text style={styles.cardTitle}>PLAN Y ASISTENCIAS</Text>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>PLAN CONTRATADO:</Text>
                                    <Text style={[styles.infoValue, { color: '#ef4444', fontWeight: '900' }]}>{selectedStudent.plan?.nombre || 'PERSONALIZADO'}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>VENCE EL:</Text>
                                    <Text style={styles.infoValue}>{formatDate(selectedStudent.fecha_vencimiento)}</Text>
                                </View>
                                <View style={[styles.divider, { marginVertical: 15 }]} />
                                <View style={styles.progressContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ color: '#71717a', fontSize: 11, fontWeight: 'bold' }}>CUPOS UTILIZADOS ESTE MES</Text>
                                        <Text style={{ color: 'white', fontWeight: '900' }}>{cuposUsados} / {cuposTotales > 0 ? cuposTotales : '∞'}</Text>
                                    </View>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: cuposTotales > 0 ? `${Math.min((cuposUsados / cuposTotales) * 100, 100)}%` : '100%', backgroundColor: (cuposUsados >= cuposTotales && cuposTotales > 0) ? '#ef4444' : '#22c55e' }]} />
                                    </View>
                                </View>
                            </View>

                            {/* BLOQUE 3: PRÓXIMA RESERVA */}
                            <View style={styles.infoCard}>
                                <Text style={styles.cardTitle}>PRÓXIMA CLASE RESERVADA</Text>
                                {(() => {
                                    const ahora = new Date();
                                    const hoyStr = ahora.toISOString().split('T')[0];
                                    const proxima = reservas.filter(r => r.usuario_id === selectedStudent.id && r.fecha_clase >= hoyStr).sort((a, b) => new Date(a.fecha_clase) - new Date(b.fecha_clase))[0];
                                    if (proxima) {
                                        return (
                                            <View style={{ backgroundColor: '#09090b', padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' }}>
                                                <Text style={{ color: 'white', fontWeight: '900' }}>{proxima.clase_nombre.toUpperCase()}</Text>
                                                <Text style={{ color: '#71717a', fontSize: 12 }}>{proxima.fecha_clase.split('-').reverse().join('/')} a las {formatHoraVikinga(proxima.horario)} hs</Text>
                                            </View>
                                        );
                                    }
                                    return <Text style={{ color: '#3f3f46', fontStyle: 'italic', fontSize: 12 }}>El alumno no tiene reservas pendientes.</Text>;
                                })()}
                            </View>

                            {/* BOTONES DE ACCIÓN */}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 50 }}>
                                <TouchableOpacity style={styles.actionButton} onPress={() => setView('rutinas')}>
                                    <Dumbbell size={20} color="#ef4444" />
                                    <Text style={{color: 'white', fontSize: 10}}>VER RUTINA</Text>
                                </TouchableOpacity>
                                {perms.canManageMoney() && (
                                    <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#14532d'}]} onPress={() => setView('form_renovar')}>
                                        <CreditCard size={20} color="#4ade80" />
                                        <Text style={{color: '#4ade80', fontSize: 10}}>COBRAR CUOTA</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {/* PESTAÑA PAGOS (CORREGIDO PARA TU BACKEND) */}
                    {activeTab === 'pagos' && (
                        <View style={styles.infoCard}>
                            <Text style={styles.cardTitle}>HISTORIAL DE PAGOS</Text>
                            {selectedStudent.historial_pagos?.length > 0 ? selectedStudent.historial_pagos.map((p, i) => (
                                <View key={i} style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: '#27272a', paddingVertical: 10 }]}>
                                    {/* AHORA USAMOS 'p.fecha' Y 'p.descripcion' COMO TU BACKEND */}
                                    <Text style={styles.infoValue}>{p.fecha}</Text>
                                    <Text style={{color: 'white', fontSize: 10}}>{p.descripcion}</Text>
                                    <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>${parseFloat(p.monto).toLocaleString()}</Text>
                                </View>
                            )) : <Text style={{ color: '#71717a', textAlign: 'center', padding: 20 }}>No hay pagos registrados.</Text>}
                        </View>
                    )}

                    {/* PESTAÑA FACTURACIÓN (CORREGIDO PARA TU BACKEND) */}
                    {activeTab === 'comprobantes' && (
                        <View style={styles.infoCard}>
                            <Text style={styles.cardTitle}>COMPROBANTES Y FACTURAS</Text>
                            {selectedStudent.facturas?.length > 0 ? selectedStudent.facturas.map((f, i) => (
                                <TouchableOpacity key={i} style={[styles.infoRow, { paddingVertical: 10 }]} onPress={() => {
                                    // USAMOS EL ENDPOINT CORRECTO QUE PASASTE: /api/comprobantes/{id}/view
                                    const url = `https://gymfit-pro.onrender.com/api/comprobantes/${f.id}/view`;
                                    Linking.openURL(url);
                                }}>
                                    <Text style={styles.infoValue}>Factura {f.nro_factura}</Text>
                                    <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>VER PDF</Text>
                                </TouchableOpacity>
                            )) : <Text style={{ color: '#71717a', textAlign: 'center', padding: 20 }}>No hay comprobantes cargados.</Text>}
                        </View>
                    )}
                </View>
            );
        })()}

        {/* MODULO: FORMULARIO RENOVAR / COBRAR PLAN (SINCRO WEB) */}
        {view === 'form_renovar' && (
            <ScrollView style={{ padding: 10 }}>
                <TouchableOpacity onPress={() => setView('detalle_alumno')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <ChevronLeft size={16} color="gray" /><Text style={{ color: 'gray', marginLeft: 5 }}>VOLVER AL ALUMNO</Text>
                </TouchableOpacity>
                
                <Text style={styles.cardLabel}>RENOVACIÓN DE GUERRERO:</Text>
                <Text style={[styles.titleBig, { fontSize: 24, textAlign: 'left', marginBottom: 20 }]}>
                    {selectedStudent?.nombre_completo}
                </Text>

                {/* PASO 1: DURACIÓN (tipo_plan_id) */}
                <Text style={styles.cardTitle}>DURACIÓN</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {[{id:1,l:'Mensual'},{id:2,l:'Trimestral'},{id:3,l:'Semestral'},{id:4,l:'Anual'}].map((dur) => (
                        <TouchableOpacity 
                            key={dur.id} 
                            style={[styles.dayTab, formData.tipo_id_buscado === dur.id && styles.dayTabActive, { flex: 1, minWidth: '45%' }]}
                            onPress={() => setFormData({ ...formData, membresia: dur.l, tipo_id_buscado: dur.id, plan_id: null, precio_base: 0 })}
                        >
                            <Text style={[styles.dayTabText, formData.tipo_id_buscado === dur.id && styles.dayTabTextActive, {textAlign: 'center'}]}>{dur.l.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* PASO 2: MÉTODO DE PAGO (Define qué columna de precio usar) */}
                {formData.tipo_id_buscado && (
                    <>
                        <Text style={styles.cardTitle}>MÉTODO DE PAGO</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                            {[
                                { id: 'efectivo', label: 'EFECTIVO' },
                                { id: 'transferencia', label: 'TRANSF. / MP' },
                                { id: 'debito_credito', label: 'T. DEBITO / CRED.' }
                            ].map((met) => (
                                <TouchableOpacity 
                                    key={met.id} 
                                    style={[styles.dayTab, formData.metodo === met.id && { backgroundColor: '#dc2626', borderColor: '#b91c1c' }, { flex: 1 }]}
                                    onPress={() => {
                                        // Al cambiar método, recalculamos el precio del plan si ya hay uno seleccionado
                                        const planAct = planes.find(p => p.id === formData.plan_id);
                                        setFormData({ 
                                            ...formData, 
                                            metodo: met.id, 
                                            precio_base: planAct ? planAct[met.id] : 0 
                                        });
                                    }}
                                >
                                    <Text style={[styles.dayTabText, formData.metodo === met.id && { color: 'white' }, {textAlign: 'center', fontSize: 10}]}>{met.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* PASO 3: PLAN (Muestra el precio de la columna seleccionada) */}
                {formData.metodo && (
                    <>
                        <Text style={styles.cardTitle}>SELECCIONAR PLAN ({formData.metodo.toUpperCase()})</Text>
                        <View style={{ marginBottom: 20 }}>
                            {planes
                                .filter(p => Number(p.tipo_plan_id) === Number(formData.tipo_id_buscado))
                                .map((p) => {
                                    // AQUÍ ESTÁ EL TRUCO: Extraemos el valor de la columna exacta
                                    const precioReal = p[formData.metodo] || 0;

                                    return (
                                        <TouchableOpacity 
                                            key={p.id} 
                                            style={[styles.planItem, formData.plan_id === p.id && { borderColor: '#dc2626', borderWidth: 2 }]} 
                                            onPress={() => setFormData({ ...formData, plan_id: p.id, precio_base: precioReal })}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{p.nombre}</Text>
                                                <Text style={{ color: 'gray', fontSize: 10 }}>Frecuencia: {formData.membresia}</Text>
                                            </View>
                                            <Text style={{ color: '#22c55e', fontWeight: '900', fontSize: 18 }}>
                                                ${precioReal}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                        </View>
                    </>
                )}

                {/* CONFIRMACIÓN */}
                {formData.plan_id && (
                    <>
                        <Text style={styles.cardTitle}>NRO TICKET / NOTA</Text>
                        <TextInput 
                            style={styles.inputDark} 
                            placeholder="Nro de comprobante..." 
                            placeholderTextColor="gray"
                            onChangeText={(t) => setFormData({...formData, comentario: t})}
                        />

                        <View style={[styles.infoCard, { backgroundColor: '#000', borderColor: '#22c55e', borderStyle: 'dashed' }]}>
                            <Text style={styles.cardLabel}>TOTAL A PAGAR</Text>
                            <Text style={{ color: 'white', fontSize: 36, fontWeight: '900' }}>${formData.precio_base}</Text>
                        </View>

                        <TouchableOpacity 
                            style={[styles.mainButtonFull, { backgroundColor: '#22c55e', marginTop: 20, marginBottom: 60 }]} 
                            onPress={handleRenovarPlan}
                        >
                            <Text style={styles.mainButtonText}>CONFIRMAR COBRO</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        )}

        {/* MODULO: LISTA DE STAFF */}
        {view === 'staff_list' && (
            <View>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15, alignItems: 'center'}}>
                    <TouchableOpacity onPress={() => setView('admin_dashboard')} style={{flexDirection:'row', alignItems:'center'}}>
                        <ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>VOLVER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => { setFormData({}); setView('staff_form'); }} 
                        style={[styles.addButton, {backgroundColor: '#22c55e'}]}
                    >
                        <Plus size={20} color="white"/>
                    </TouchableOpacity>
                </View>

                {staffList.map((s, i) => (
                    <View key={i} style={styles.listItem}>
                        <View style={{flex: 1}}>
                            <Text style={styles.itemTitle}>{s.nombre_completo.toUpperCase()}</Text>
                            <Text style={styles.itemSubtitle}>{s.rol_nombre || 'Staff'} | DNI: {s.dni}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => {
                                setSelectedStaff(s);
                                setFormData({
                                    nombre_completo: s.nombre_completo,
                                    dni: s.dni,
                                    rol_id: s.rol_id,
                                    email: s.email || '',
                                    newPassword: ''
                                });
                                setModalEditStaffVisible(true);
                            }}
                            style={{ padding: 10, backgroundColor: '#27272a', borderRadius: 8 }}
                        >
                            <Pencil size={16} color="white" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        )}

        {/* MODULO: FORMULARIO INGRESO CAJA */}
        {view === 'form_ingreso' && (
            <View style={{gap: 15}}>
                <TouchableOpacity onPress={() => setView('caja')} style={{flexDirection:'row', alignItems:'center'}}><ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>CANCELAR</Text></TouchableOpacity>
                <Text style={styles.titleBig}>INGRESO</Text>
                <TextInput style={styles.inputDark} placeholder="Monto ($)" placeholderTextColor="gray" keyboardType="numeric" onChangeText={t => setFormData({...formData, monto: t})}/>
                <TextInput style={styles.inputDark} placeholder="Descripción" placeholderTextColor="gray" onChangeText={t => setFormData({...formData, descripcion: t})}/>
                <TextInput style={styles.inputDark} placeholder="Categoría" placeholderTextColor="gray" onChangeText={t => setFormData({...formData, categoria: t})}/>
                <TouchableOpacity style={[styles.mainButtonFull, {backgroundColor: '#22c55e'}]} onPress={() => handleCreateMovimiento('Ingreso')}><Text style={styles.mainButtonText}>GUARDAR INGRESO</Text></TouchableOpacity>
            </View>
        )}

        {/* MODULO: FORMULARIO EGRESO CAJA */}
        {view === 'form_egreso' && (
            <View style={{gap: 15}}>
                <TouchableOpacity onPress={() => setView('caja')} style={{flexDirection:'row', alignItems:'center'}}><ChevronLeft size={16} color="gray"/><Text style={{color:'gray', marginLeft: 5}}>CANCELAR</Text></TouchableOpacity>
                <Text style={styles.titleBig}>GASTO</Text>
                <TextInput style={styles.inputDark} placeholder="Monto ($)" placeholderTextColor="gray" keyboardType="numeric" onChangeText={t => setFormData({...formData, monto: t})}/>
                <TextInput style={styles.inputDark} placeholder="Descripción" placeholderTextColor="gray" onChangeText={t => setFormData({...formData, descripcion: t})}/>
                <TextInput style={styles.inputDark} placeholder="Comentario" placeholderTextColor="gray" onChangeText={t => setFormData({...formData, comentario: t})}/>
                <TouchableOpacity style={[styles.mainButtonFull, {backgroundColor: '#ef4444'}]} onPress={() => handleCreateMovimiento('Egreso')}><Text style={styles.mainButtonText}>GUARDAR GASTO</Text></TouchableOpacity>
            </View>
        )}

        {/* MODULO: FORMULARIO ALTA STAFF */}
        {view === 'staff_form' && (
            <View style={{ gap: 12 }}>
                <TouchableOpacity onPress={() => setView('staff_list')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ChevronLeft size={16} color="gray" /><Text style={{ color: 'gray', marginLeft: 5 }}>CANCELAR</Text>
                </TouchableOpacity>

                <Text style={styles.titleBig}>NUEVO STAFF</Text>
                
                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Nombre Completo" 
                    placeholderTextColor="gray" 
                    value={formData.nombre_completo || ''}
                    onChangeText={t => setFormData({ ...formData, nombre_completo: t })}
                />

                <TextInput 
                    style={styles.inputDark} 
                    placeholder="DNI / Usuario (Letras y números)" 
                    placeholderTextColor="gray" 
                    autoCapitalize="none"
                    value={formData.dni || ''}
                    onChangeText={t => setFormData({ ...formData, dni: t })} 
                />

                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Especialidad (ej: Boxeo, Yoga)" 
                    placeholderTextColor="gray" 
                    value={formData.especialidad || ''}
                    onChangeText={t => setFormData({ ...formData, especialidad: t })}
                />

                <TextInput 
                    style={styles.inputDark} 
                    placeholder="Contraseña" 
                    placeholderTextColor="gray" 
                    secureTextEntry
                    value={formData.password || ''}
                    onChangeText={t => setFormData({ ...formData, password: t })}
                />

                <Text style={[styles.sectionLabel, { marginTop: 10 }]}>SELECCIONAR ROL</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {['Profesor', 'Administrativo'].map(r => (
                        <TouchableOpacity 
                            key={r} 
                            onPress={() => setFormData({ ...formData, rol: r })} 
                            style={[
                                styles.planItem, 
                                { 
                                    flex: 1, 
                                    height: 50, 
                                    paddingHorizontal: 2, // Bajamos el padding lateral para ganar espacio
                                    justifyContent: 'center', 
                                    alignItems: 'center' 
                                }, 
                                formData.rol === r && { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                            ]}
                        >
                            <Text 
                                numberOfLines={1} // Forzamos a que sea una sola línea
                                adjustsFontSizeToFit // Si no entra, baja el tamaño de la letra automáticamente (Solo iOS, pero ayuda)
                                style={{ 
                                    color: formData.rol === r ? 'white' : '#71717a',
                                    fontWeight: '900',
                                    fontSize: 11, // Bajamos a 11 para que "ADMINISTRATIVO" entre cómodo
                                    textAlign: 'center'
                                }}
                            >
                                {r.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity 
                    style={[styles.mainButtonFull, { backgroundColor: '#22c55e', marginTop: 20 }]} 
                    onPress={() => handleCreateUser(true)} 
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.mainButtonText}>GUARDAR STAFF</Text>}
                </TouchableOpacity>
            </View>
        )}

        {/* MODULO: MI PERFIL (ALUMNO) */}
        {view === 'mi_perfil' && (
            /* Agregamos paddingHorizontal para recuperar los márgenes y marginTop negativo para subir todo */
            <View style={{ gap: 20 }}> 
                <Text style={styles.sectionTitle}>MI PLAN Y DATOS</Text>
                
                {/* CARD DE PLAN ACTUAL */}
                <View style={[styles.balanceCard, { paddingVertical: 20 }]}>
                    <Text style={styles.cardLabel}>PLAN CONTRATADO</Text>
                    <Text style={[styles.titleBig, { fontSize: 30 }]}>{user?.plan?.nombre || "PLAN ESTÁNDAR"}</Text>
                    <Text style={[styles.statusText, { color: getStatusColor(user?.fecha_vencimiento), fontSize: 16 }]}>
                        VENCE EL: {formatDate(user?.fecha_vencimiento)}
                    </Text>
                </View>

                {/* INFO DE CUPOS (RESERVAS) */}
                <View style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>Mis Reservas Activas</Text>
                        <Text style={styles.itemSubtitle}>Cupos utilizados este período</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#dc2626', fontWeight: '900', fontSize: 20 }}>
                            {reservas.filter(r => r.usuario_id === user.id).length} 
                            <Text style={{ color: '#71717a', fontSize: 14 }}> / {user.plan?.clases_mensuales || '∞'}</Text>
                        </Text>
                        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: 'bold' }}>CLASES</Text>
                    </View>
                </View>

                {/* DATOS PERSONALES */}
                <View style={[styles.card, { backgroundColor: '#18181b', borderColor: '#27272a', padding: 20 }]}>
                    <Text style={[styles.sectionLabel, { marginBottom: 15 }]}>EDITAR MIS DATOS</Text>
                    
                    <View style={styles.inputContainer}>
                        <Mail size={18} color="#71717a" style={{ marginLeft: 15 }} />
                        <TextInput 
                            style={styles.input} 
                            placeholder={user?.email || "Nuevo Email"} 
                            placeholderTextColor="#52525b"
                            onChangeText={(t) => setFormData({...formData, newEmail: t})}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Lock size={18} color="#71717a" style={{ marginLeft: 15 }} />
                        <TextInput 
                            style={styles.input} 
                            placeholder="Nueva Contraseña" 
                            placeholderTextColor="#52525b"
                            secureTextEntry
                            onChangeText={(t) => setFormData({...formData, newPassword: t})}
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.mainButtonFull, { marginTop: 10 }]} 
                        onPress={handleUpdateProfile}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.mainButtonText}>GUARDAR CAMBIOS</Text>}
                    </TouchableOpacity>
                </View>

                {/* INFO ADICIONAL */}
                <View style={{ alignItems: 'center', opacity: 0.5, marginTop: 10 }}>
                    <Text style={{ color: 'white', fontSize: 10 }}>DNI: {user?.dni}</Text>
                    <Text style={{ color: 'white', fontSize: 10 }}>ID DE SOCIO: #00{user?.id}</Text>
                </View>
            </View>
        )}

      </ScrollView>

        {/* NAVBAR FLOTANTE ESTUDIANTE */}
        {isStudent() && (
            <View style={styles.navbar}>
                <TouchableOpacity style={styles.navItem} onPress={() => setView('dashboard_alumno')}>
                  <QrCode size={24} color={view === 'dashboard_alumno' ? '#ef4444' : '#52525b'} />
                  <Text style={[styles.navText, view === 'dashboard_alumno' && { color: '#ef4444' }]}>Acceso</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => { fetchClases(); setView('clases'); }}>
                  <Calendar size={24} color={view === 'clases' ? '#ef4444' : '#52525b'} />
                  <Text style={[styles.navText, view === 'clases' && { color: '#ef4444' }]}>Clases</Text>
                </TouchableOpacity>
                <View style={{position: 'relative', top: -25}}>
                  <TouchableOpacity style={[styles.mainButton, (view === 'rutinas' || view === 'ejercicio_detalle') && { backgroundColor: '#ef4444' }]} onPress={() => { fetchRutina(user.id, user.nombre_completo); setView('rutinas'); }}>
                      <Dumbbell size={28} color={(view === 'rutinas' || view === 'ejercicio_detalle') ? 'black' : '#a1a1aa'} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.navItem} onPress={() => setView('mi_perfil')}>
                  <User size={24} color={view === 'mi_perfil' ? '#ef4444' : '#52525b'} />
                  <Text style={[styles.navText, view === 'mi_perfil' && { color: '#ef4444' }]}>Mi Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => setView('mis_reservas')}>
                <CalendarDays 
                    size={24} 
                    color={view === 'mis_reservas' ? '#ef4444' : '#52525b'} 
                />
                <Text style={[styles.navText, view === 'mis_reservas' && { color: '#ef4444' }]}>
                    Reservas
                </Text>
                </TouchableOpacity>
            </View>
        )}

      {/* WHATSAPP FLOAT */}
      <TouchableOpacity style={styles.whatsappFloat} onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`)}>
         <MessageCircle size={32} color="white" fill="white" />
      </TouchableOpacity>

      {/* MODALES DE SOPORTE */}
      <Modal visible={menuOpen} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}><Text style={styles.modalTitle}>ACCESOS RÁPIDOS</Text><TouchableOpacity onPress={() => setMenuOpen(false)}><X size={24} color="gray" /></TouchableOpacity></View>
                  <View style={styles.grid}>
                    <TouchableOpacity style={styles.gridItemSmall} onPress={() => setView('usuarios_list')}>
                        <GraduationCap size={24} color="#ef4444" />
                        <Text style={styles.gridTextSmall}>Alumnos</Text>
                    </TouchableOpacity>

                    {perms.canManageStaff() && (
                        <TouchableOpacity style={styles.gridItemSmall} onPress={() => setView('staff_list')}>
                            <Briefcase size={24} color="#3b82f6" />
                            <Text style={styles.gridTextSmall}>Staff</Text>
                        </TouchableOpacity>
                    )}

                    {perms.canManageMoney() && (
                        <TouchableOpacity style={styles.gridItemSmall} onPress={() => setView('caja')}>
                            <Wallet size={24} color="#22c55e" />
                            <Text style={styles.gridTextSmall}>Caja</Text>
                        </TouchableOpacity>
                    )}
                </View>
              </View>
          </View>
      </Modal>

    {/* MODAL: EDITAR PRODUCTO */}
    <Modal
        animationType="slide"
        transparent={true}
        visible={modalEditStockVisible}
        onRequestClose={() => setModalEditStockVisible(false)}
    >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#18181b', borderRadius: 30, padding: 25, borderTopWidth: 2, borderColor: '#3f3f46' }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 20, textAlign: 'center' }}>EDITAR PRODUCTO</Text>

                {/* CAMPOS DEL FORMULARIO */}
                <TextInput 
                    style={[styles.inputDark, { marginBottom: 15 }]} 
                    placeholder="Nombre del producto" 
                    placeholderTextColor="#52525b" 
                    value={formData.nombre_producto}
                    onChangeText={(val) => setFormData({...formData, nombre_producto: val})}
                />
                <TextInput 
                    style={[styles.inputDark, { marginBottom: 15 }]} 
                    placeholder="Stock actual" 
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    value={String(formData.stock_actual || '')}
                    onChangeText={(val) => setFormData({...formData, stock_actual: val})}
                />
                <TextInput 
                    style={[styles.inputDark, { marginBottom: 15 }]} 
                    placeholder="Precio Venta" 
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    value={String(formData.precio_venta || '')}
                    onChangeText={(val) => setFormData({...formData, precio_venta: val})}
                />
                <TextInput 
                    style={[styles.inputDark, { marginBottom: 15 }]} 
                    placeholder="Categoría" 
                    placeholderTextColor="#52525b"
                    value={formData.categoria}
                    onChangeText={(val) => setFormData({...formData, categoria: val})}
                />

                {/* BOTONES ACCIÓN (Sólidos y compactos) */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, flex: 1, alignItems: 'center' }}
                        onPress={handleUpdateStock}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>GUARDAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#27272a', paddingVertical: 12, borderRadius: 12, flex: 1, alignItems: 'center' }}
                        onPress={() => setModalEditStockVisible(false)}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>CANCELAR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>

    <Modal visible={modalEditVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '90%', padding: 0 }]}>
                {/* HEADER CON MÁS AIRE */}
                <View style={{ padding: 25, borderBottomWidth: 1, borderBottomColor: '#27272a' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.modalTitle}>EDITAR PERFIL</Text>
                        <TouchableOpacity onPress={() => setModalEditVisible(false)} style={{ backgroundColor: '#27272a', padding: 8, borderRadius: 12 }}>
                            <X size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 5 }}>{selectedStudent?.nombre_completo}</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 25 }} showsVerticalScrollIndicator={false}>
                    {/* GRUPO PERSONALES */}
                    <Text style={styles.sectionLabel}>DATOS PERSONALES</Text>
                    <TextInput style={styles.inputDark} placeholder="Nombre Completo" placeholderTextColor="#404040" value={formData.nombre_completo} onChangeText={(t) => setFormData({...formData, nombre_completo: t})} />
                    <TextInput style={styles.inputDark} placeholder="DNI" placeholderTextColor="#404040" keyboardType="numeric" value={formData.dni?.toString()} onChangeText={(t) => setFormData({...formData, dni: t})} />
                    <TextInput style={styles.inputDark} placeholder="Email" placeholderTextColor="#404040" value={formData.email} onChangeText={(t) => setFormData({...formData, email: t})} />
                    <TextInput style={styles.inputDark} placeholder="Teléfono" placeholderTextColor="#404040" keyboardType="phone-pad" value={formData.telefono} onChangeText={(t) => setFormData({...formData, telefono: t})} />

                    {/* GRUPO ANTROPOMÉTRICO */}
                    <Text style={styles.sectionLabel}>ANTROPOMETRÍA</Text>
                    <View style={{ flexDirection: 'row', gap: 15 }}>
                        <View style={{ flex: 1 }}>
                            <TextInput style={styles.inputDark} placeholder="Peso (kg)" placeholderTextColor="#404040" keyboardType="numeric" value={formData.peso?.toString()} onChangeText={(t) => setFormData({...formData, peso: t})} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <TextInput style={styles.inputDark} placeholder="Altura (m)" placeholderTextColor="#404040" keyboardType="numeric" value={formData.altura?.toString()} onChangeText={(t) => setFormData({...formData, altura: t})} />
                        </View>
                    </View>

                    {/* GRUPO SEGURIDAD */}
                    <Text style={styles.sectionLabel}>SEGURIDAD</Text>
                    <TextInput 
                        style={[styles.inputDark, { borderColor: '#7f1d1d' }]} 
                        placeholder="Nueva Contraseña (opcional)" 
                        placeholderTextColor="#525252"
                        secureTextEntry
                        onChangeText={(t) => setFormData({...formData, newPassword: t})}
                    />
                    
                    <TouchableOpacity 
                        style={{ backgroundColor: '#dc2626', padding: 18, borderRadius: 16, marginTop: 30, alignItems: 'center' }} 
                        onPress={handleSaveEditAlumno}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>GUARDAR CAMBIOS</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    </Modal>

        {/* MODAL DE EDICIÓN DE STAFF */}
        <Modal visible={modalEditStaffVisible} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '75%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>EDITAR STAFF</Text>
                        <TouchableOpacity onPress={() => setModalEditStaffVisible(false)}>
                            <X size={24} color="gray" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.sectionLabel}>DATOS DEL PROFESOR / ADMIN</Text>
                        <TextInput 
                            style={styles.inputDark} 
                            placeholder="Nombre y Apellido" 
                            placeholderTextColor="gray"
                            value={formData.nombre_completo}
                            onChangeText={(t) => setFormData({...formData, nombre_completo: t})}
                        />
                        <TextInput 
                            style={styles.inputDark} 
                            placeholder="DNI (Usuario)" 
                            placeholderTextColor="gray"
                            keyboardType="numeric"
                            value={formData.dni?.toString()}
                            onChangeText={(t) => setFormData({...formData, dni: t})}
                        />
                        <TextInput 
                            style={styles.inputDark} 
                            placeholder="Email de contacto" 
                            placeholderTextColor="gray"
                            value={formData.email}
                            onChangeText={(t) => setFormData({...formData, email: t})}
                        />

                        <View style={styles.divider} />
                        
                        <Text style={styles.sectionLabel}>SEGURIDAD</Text>
                        <TextInput 
                            style={[styles.inputDark, { borderColor: '#ef4444' }]} 
                            placeholder="Nueva clave (opcional)" 
                            placeholderTextColor="#7f1d1d"
                            secureTextEntry
                            onChangeText={(t) => setFormData({...formData, newPassword: t})}
                        />

                        <TouchableOpacity 
                            style={[styles.mainButtonFull, { backgroundColor: '#22c55e', marginTop: 20 }]} 
                            onPress={handleSaveEditStaff}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.mainButtonText}>ACTUALIZAR STAFF</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>

    </SafeAreaView>
  );
}

// ==========================================
// 9. ESTILOS REFINADOS (ZINC + RED)
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  loginBackground: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' },
  gridText: { color: '#ffffff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 5 },
  gridIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(9, 9, 11, 0.7)', width: '100%', maxWidth: Platform.OS === 'web' ? 500 : '100%', alignSelf: 'center' },
  titleBig: { fontSize: 42, fontWeight: '900', color: 'white', fontStyle: 'italic', textAlign: 'center' },
  line: { height: 2, width: 30, backgroundColor: '#dc2626' },
  proText: { color: '#dc2626', fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#27272a' },
  inputIcon: { marginLeft: 16 },
  input: { flex: 1, color: 'white', padding: 16, fontWeight: 'bold' },
  inputDark: { backgroundColor: '#18181b', padding: 16, borderRadius: 16, color: 'white', fontWeight: 'bold', borderWidth: 1, borderColor: '#27272a', marginBottom: 10 },
  loginButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: 'white', fontWeight: '900', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#27272a', backgroundColor: 'rgba(9, 9, 11, 0.95)' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  headerSubtitle: { color: '#dc2626', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  iconButton: { padding: 10, backgroundColor: '#27272a', borderRadius: 12 },
  content: { padding: 20 },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
  cardLabel: { color: '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  statusText: { fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  dateText: { color: '#a1a1aa', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  iconBox: { padding: 12, borderRadius: 16 },
  qrContainer: { backgroundColor: 'white', borderRadius: 40, padding: 30, alignItems: 'center', overflow: 'hidden' },
  qrHeader: { position: 'absolute', top: 0, width: '200%', height: 8, backgroundColor: '#dc2626' },
  qrText: { color: 'rgba(0,0,0,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 5, marginTop: 16 },
  navbar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 85, backgroundColor: 'rgba(9, 9, 11, 0.98)', borderTopWidth: 1, borderTopColor: '#27272a', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 25 : 15, maxWidth: Platform.OS === 'web' ? 500 : '100%', alignSelf: 'center', zIndex: 1000 },
  navItem: { alignItems: 'center', width: 60 },
  navText: { color: '#52525b', fontSize: 9, fontWeight: '900', marginTop: 4 },
  mainButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#09090b' },
  sectionTitle: { color: '#71717a', fontSize: 12, fontWeight: '900', letterSpacing: 3, marginBottom: 8, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: (width - 52) / 2, backgroundColor: '#18181b', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 140 },
  listItem: { backgroundColor: '#18181b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  itemSubtitle: { color: '#71717a', fontSize: 10, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', backgroundColor: '#18181b', padding: 12, borderRadius: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#27272a' },
  actionButton: { flex: 1, backgroundColor: '#18181b', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#27272a', gap: 8 },
  sectionLabel: { color: '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  subtitle: { color: '#71717a', fontSize: 10, marginTop: 4 },
  dayCard: { backgroundColor: '#18181b', borderRadius: 24, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden', marginBottom: 15 },
  dayHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  dayTitle: { color: '#dc2626', fontWeight: '900', fontStyle: 'italic' },
  dayCount: { color: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
  exerciseRow: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  exerciseName: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  exerciseSeries: { color: '#71717a', fontSize: 9, fontWeight: '900', marginTop: 4 },
  exerciseTitleBig: { color: 'white', fontSize: 32, fontWeight: '900', fontStyle: 'italic', marginBottom: 20 },
  obsContainer: { backgroundColor: '#18181b', borderLeftWidth: 4, borderLeftColor: '#dc2626', padding: 20, borderRadius: 12, marginBottom: 20 },
  serieRowFull: { backgroundColor: '#18181b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#27272a', marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serieBadgeSmall: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  dayTab: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginRight: 8, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a' },
  dayTabActive: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
  dayTabText: { color: '#71717a', fontWeight: '900', fontSize: 12 },
  dayTabTextActive: { color: 'white' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', padding: 20, justifyContent: 'center' },
  modalContent: { backgroundColor: '#09090b', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#71717a', fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  gridItemSmall: { width: '47%', backgroundColor: '#18181b', padding: 16, borderRadius: 16, alignItems: 'center', gap: 8, marginBottom: 10 },
  gridTextSmall: { color: 'white', fontWeight: 'bold', fontSize: 10 },
  addButton: { padding: 10, borderRadius: 10, backgroundColor: '#dc2626' },
  mainButtonFull: { backgroundColor: '#dc2626', padding: 16, borderRadius: 16, alignItems: 'center' },
  mainButtonText: { color: 'white', fontWeight: '900', fontSize: 16 },
  balanceCard: { backgroundColor: '#18181b', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', alignItems: 'center' },
  planItem: { padding: 20, borderRadius: 16, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  whatsappFloat: { position: 'absolute', bottom: 100, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#25d366', alignItems: 'center', justifyContent: 'center', elevation: 8, zIndex: 100 },
  infoCard: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  cardTitle: { color: '#dc2626', fontWeight: '900', fontSize: 11, marginBottom: 12, letterSpacing: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: '#71717a', fontSize: 12, fontWeight: '600' },
  infoValue: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#27272a', marginVertical: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', backgroundColor: '#09090b', padding: 12, borderRadius: 12, width: '31%', borderWidth: 1, borderColor: '#27272a' },
  statLabel: { color: '#71717a', fontSize: 9, marginBottom: 4, fontWeight: '900' },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '900' },
  progressBarBg: { height: 6, backgroundColor: '#27272a', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#dc2626' },
  progressContainer: { marginTop: 5 },
  progressBarBg: { height: 8, backgroundColor: '#27272a', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  // Agregá esto a tu StyleSheet
modalTitle: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: '900', 
    letterSpacing: 0.5,
    textTransform: 'uppercase' 
},
sectionLabel: { 
    color: '#dc2626', // El rojo de tu marca
    fontSize: 12, 
    fontWeight: '900', 
    marginTop: 25, 
    marginBottom: 10,
    letterSpacing: 1.2
},
inputDark: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 15,
    color: 'white',
    fontSize: 14,
    marginBottom: 12
},
selector: {
        backgroundColor: '#09090b',
        height: 50,
        borderRadius: 12,
        marginBottom: 15,
        justifyContent: 'center',
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#27272a'
}
});