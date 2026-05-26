        // ==========================================
		// 1. CONFIGURACIÓN MAESTRA (PEGAR AL INICIO DE TU SCRIPT)
		// ==========================================

		// Detectamos automáticamente si estás en tu PC o en la Nube
		const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

		// Definimos la URL Maestra (Para compatibilidad con código antiguo y nuevo)
		const API_URL = IS_LOCALHOST ? "http://localhost:8000/api" : "/api";
		const API_BASE = API_URL; 

		// Seguridad y Estado Global
		const SECRET_KEY = "Vikingo_Security_Strong_Key_2025"; 
		
		console.log("⚔️ Vikingo System Online ⚔️");
		console.log("Modo:", IS_LOCALHOST ? "LOCAL (Desarrollo)" : "PRODUCCIÓN (Nube)");
		console.log("Conectando a:", API_URL);

		// ==========================================
		// 2. CORRECCIÓN DE SEGURIDAD (LOGIN)
		// ==========================================
		// Si tu login está en un formulario, esto evita que la página se refresque si hay error
		document.addEventListener('DOMContentLoaded', () => {
			// ⚔️ 1. LÓGICA DE NAVEGACIÓN Y SIDEBAR
			const navItems = document.querySelectorAll('.nav-item');
			
			navItems.forEach(item => {
				item.addEventListener('click', () => {
					if (window.innerWidth <= 1024) {
						const sidebar = document.getElementById('sidebar');
						const overlay = document.getElementById('mobile-overlay');
						
						if (sidebar && sidebar.classList.contains('mobile-open')) {
							sidebar.classList.remove('mobile-open');
							if (overlay) overlay.classList.remove('active');
						}
					}
				});
			});

			// ⚔️ 2. BLOQUEO DE ZOOM
			document.addEventListener('touchstart', (e) => {
				if (e.touches.length > 1) e.preventDefault();
			}, { passive: false });

			let lastTouchEnd = 0;
			document.addEventListener('touchend', (e) => {
				const now = (new Date()).getTime();
				if (now - lastTouchEnd <= 300) e.preventDefault();
				lastTouchEnd = now;
			}, false);

			// Nota: Ya no llamamos a inicializarEventosVikingos aquí. 
			// Los eventos ahora se disparan desde initApp() y handleLogin().
		});

        let state = { 
			alumnos: [], 
			planes: [], 
			stock: [], 
			clases: [], 
			user: null, 
			profesores: [], 
			administrativos: [], 
			tiposPlanes: [],
			reservas: [], 
			cart: [], 
			currentPaymentMethod: '',
			cobrarTab: 'mercaderia',
			gruposMusculares: [], 
			ejerciciosLibreria: [],
			accesos: [],
			// --- AGREGADOS PARA FERIADOS ---
			feriados: [],
			clasesFeriado: []
		};
		window.state = state;

        function showVikingToast(msg, error = false) {
            const toast = document.getElementById('viking-toast');
            toast.innerText = msg;
            toast.style.background = error ? '#660000' : '#FF0000';
            toast.style.color = error ? '#FF0000' : 'black';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

		function applyPermissions() {
			if (!state.user) return;
			const rol = (state.user.rol_nombre || "").toLowerCase();
			
			// 1. CONTENEDORES (Secciones de título/grupos)
			const contenedoresSeccion = {
				staff: document.getElementById('nav-section-staff'),
				operativa: document.getElementById('nav-section-operativa'),
				virtual: document.getElementById('nav-section-virtual'),
				facturacion: document.getElementById('nav-section-facturacion')
			};

			// 2. ITEMS INDIVIDUALES (Botones y Desplegables)
			const itemsMenu = {
				alumnos: document.getElementById('nav-alumnos'),
				planes: document.getElementById('nav-planes'),
				clases: document.getElementById('nav-clases'),
				facturacion: document.getElementById('nav-cobrar'),
				btnFacturacion: document.getElementById('nav-facturacion'), // El botón con el icono de billetera
				caja: document.getElementById('nav-caja'),
				stock: document.getElementById('nav-stock'),
				rentabilidad: document.getElementById('nav-rentabilidad'),
				acceso: document.getElementById('nav-acceso-virtual'),
				sucursales: document.getElementById('nav-sucursales'),
				rutinas: document.getElementById('nav-rutinas')
			};

			// --- RESET: MOSTRAR TODO POR DEFECTO ---
			Object.values(contenedoresSeccion).forEach(el => {
				if (el) el.style.setProperty('display', 'block', 'important');
			});

			Object.values(itemsMenu).forEach(el => {
				if (el) el.style.setProperty('display', 'flex', 'important');
			});

			// --- LÓGICA DE RESTRICCIONES POR ROL ---

			// A. ALUMNOS
			if (rol === "alumno") {
				Object.values(contenedoresSeccion).forEach(el => { 
					if(el) el.style.setProperty('display', 'none', 'important'); 
				});
				
				const itemsOcultar = ['planes', 'facturacion', 'caja', 'stock', 'rentabilidad', 'sucursales', 'alumnos', 'clases', 'rutinas'];
				itemsOcultar.forEach(key => {
					if(itemsMenu[key]) itemsMenu[key].style.setProperty('display', 'none', 'important');
				});
			}

			// B. PROFESORES (Blindaje Total)
			else if (rol === "profesor") {
				// 1. Ocultamos las secciones de título completas para limpiar el Sidebar
				if (contenedoresSeccion.staff) contenedoresSeccion.staff.style.setProperty('display', 'none', 'important');
				if (contenedoresSeccion.facturacion) contenedoresSeccion.facturacion.style.setProperty('display', 'none', 'important');
				if (contenedoresSeccion.virtual) contenedoresSeccion.virtual.style.setProperty('display', 'none', 'important');
				
				// Ocultamos 'Operativa' para que no quede el texto suelto de la imagen
				if (contenedoresSeccion.operativa) contenedoresSeccion.operativa.style.setProperty('display', 'none', 'important');

				// 2. Ocultamos botones individuales (incluyendo el icono de billetera 'btnFacturacion')
				const prohibidos = [
					'alumnos', 
					'clases', 
					'facturacion', 
					'btnFacturacion',
					'caja', 
					'stock', 
					'rentabilidad', 
					'planes', 
					'sucursales',
					'acceso'
				];
				
				prohibidos.forEach(key => {
					if (itemsMenu[key]) itemsMenu[key].style.setProperty('display', 'none', 'important');
				});

				// 3. Forzamos que 'Rutinas' sea lo único visible
				// Si estaba dentro de 'Operativa', al ponerle FLEX e IMPORTANT, aparecerá solo.
				if (itemsMenu.rutinas) {
					itemsMenu.rutinas.style.setProperty('display', 'flex', 'important');
				}
			}

			// C. ADMINISTRATIVO
			else if (rol === "administracion" || rol === "administrativo") {
				if (contenedoresSeccion.staff) contenedoresSeccion.staff.style.setProperty('display', 'none', 'important');
				
				const staffDashboardPanel = document.getElementById('dash-staff-access');
				if (staffDashboardPanel) {
					const card = staffDashboardPanel.closest('.glass-card');
					if (card) card.style.setProperty('display', 'none', 'important');
				}
			}

			// D. ADMINISTRADOR / SUPERVISOR 
			// (Sin restricciones, el RESET inicial les permite ver todo)

			if (window.lucide) lucide.createIcons();
		}

		/**
		* REQUERIMIENTO: Mostrar fecha exacta en el Dashboard del Alumno.
		* Se actualiza la función renderStudentDashboard para formatear 'fecha_clase'.
		*/

		async function renderStudentDashboard() {
			const u = state.user; 
			if (!u) return;

			// Seteamos "hoy" a las 00:00 para comparaciones de fecha precisas
			const ahora = new Date();
			const hoySinHora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

			// 1. CARGA DE DATOS BÁSICOS
			const elName = document.getElementById('al-dash-name');
			const elPlan = document.getElementById('al-dash-plan');
			const elMembresia = document.getElementById('al-dash-membresia');
			const elVenc = document.getElementById('al-dash-vencimiento');

			if (elName) elName.innerText = u.nombre_completo || "Usuario Vikingo";
			if (document.getElementById('al-dash-dni')) document.getElementById('al-dash-dni').innerText = u.dni || "-";
			
			// --- ⚔️ LÓGICA TIPO DE PLAN (EXTRACCIÓN SEGÚN MODELS) ---
			// Según tu relación en Python: al.plan.tipo.nombre
			const nombrePlan = u.plan?.nombre || u.plan_nombre || 'SIN PLAN';
    		let tipoTexto = "-";
			
			if (u.plan?.tipo?.nombre) {
				tipoTexto = u.plan.tipo.nombre;
			} else if (u.tipo_plan_nombre) {
				tipoTexto = u.tipo_plan_nombre;
			} else if (u.plan_id && state.planes) {
				const pInfo = state.planes.find(p => p.id == u.plan_id);
				if (pInfo && pInfo.tipo) tipoTexto = pInfo.tipo.nombre;
				else if (pInfo && pInfo.tipo_nombre) tipoTexto = pInfo.tipo_nombre;
			}

			// AHORA SÍ: Inyectamos los datos en el HTML
			if (elPlan) elPlan.innerText = nombrePlan.toUpperCase();
			if (elMembresia) elMembresia.innerText = tipoTexto.toUpperCase();

			// Fechas y Contacto
			if (elVenc) elVenc.innerText = u.fecha_vencimiento ? new Date(u.fecha_vencimiento).toLocaleDateString('es-AR') : '-';
			if (document.getElementById('al-dash-renovacion')) {
				// Formateamos la fecha de renovación si existe
				const fRenov = u.fecha_ultima_renovacion;
				document.getElementById('al-dash-renovacion').innerText = fRenov ? new Date(fRenov).toLocaleDateString('es-AR') : '-';
			}
			if (document.getElementById('al-dash-email')) document.getElementById('al-dash-email').innerText = u.email || '-';
			
			// Iniciales
			const initials = u.nombre_completo ? u.nombre_completo.split(' ').filter(n=>n).map(n=>n[0]).join('').toUpperCase() : "??";
			const elInit = document.getElementById('al-dash-initials');
			if (elInit) elInit.innerText = initials;
			
			// Métricas Físicas
			if (document.getElementById('al-dash-peso')) document.getElementById('al-dash-peso').innerText = u.peso || '0';
			if (document.getElementById('al-dash-altura')) document.getElementById('al-dash-altura').innerText = u.altura || '0';
			if (document.getElementById('al-dash-imc')) document.getElementById('al-dash-imc').innerText = u.imc || '0';

			// Lógica de certificado médico
			if (u.fecha_certificado && elPlan) {
				const fCert = new Date(u.fecha_certificado);
				const diff = (ahora - fCert) / (1000 * 60 * 60 * 24);
				if (diff > 365) {
					elPlan.innerHTML += ` <span class="text-[8px] bg-red-600 text-black font-black px-2 py-0.5 rounded ml-2 italic">CERTIF. VENCIDO</span>`;
				}
			}

			// 2. GESTIÓN DE CRÉDITOS Y RESERVAS
			const limite = u.plan?.clases_mensuales || 0;
			const esFull = limite >= 999; 

			// Sincronizamos todas las reservas del sistema
			const allReservas = await apiFetch('/reservas');
			if (!allReservas.error && Array.isArray(allReservas)) {
				state.reservas = allReservas; 
			}
			
			// Filtramos solo las reservas de este alumno
			const misReservasTotales = (state.reservas || []).filter(r => (r.alumno_dni === u.dni || r.usuario_id === u.id));

			// ⚔️ SEPARACIÓN AUTOMÁTICA: Próximas vs Historial
			// Cualquier clase con fecha menor a hoy se va al historial
			const proximas = misReservasTotales.filter(r => new Date(r.fecha_clase + 'T00:00:00') >= hoySinHora)
											.sort((a, b) => new Date(a.fecha_clase) - new Date(b.fecha_clase));

			const historial = misReservasTotales.filter(r => new Date(r.fecha_clase + 'T00:00:00') < hoySinHora)
												.sort((a, b) => new Date(b.fecha_clase) - new Date(a.fecha_clase));

			// Renderizado de Próximas Clases (El scroll se maneja por CSS en el contenedor)
			const upcomingContainer = document.getElementById('al-dash-upcoming');
			if (upcomingContainer) {
				upcomingContainer.innerHTML = proximas.length ? proximas.map(r => renderReservaCard(r, true)).join('') : 
					'<p class="text-zinc-500 italic text-[11px] text-center py-6 uppercase tracking-widest">No tienes reservas activas</p>';
			}

			// Renderizado de Historial (Con estilo suavizado)
			const historyContainer = document.getElementById('al-dash-history');
			if (historyContainer) {
				historyContainer.innerHTML = historial.length ? historial.map(r => renderReservaCard(r, false)).join('') : 
					'<p class="text-zinc-500 italic text-[11px] text-center py-6 uppercase tracking-widest">Sin actividad pasada</p>';
			}

			// Créditos consumidos en el mes calendario actual
			const usadasMes = misReservasTotales.filter(r => {
				const f = new Date(r.fecha_clase + 'T00:00:00');
				return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
			}).length;

			const elUsadas = document.getElementById('al-dash-usadas');
			if(elUsadas) elUsadas.innerText = usadasMes;
			
			const elCreditos = document.getElementById('al-dash-creditos');
			if(elCreditos) {
				const restantes = esFull ? "∞" : Math.max(0, limite - usadasMes);
				elCreditos.innerHTML = esFull ? 
					`<span class="text-2xl font-black italic">∞</span>` : 
					`<span class="${restantes <= 2 ? 'text-red-500' : 'text-white'} font-black italic">${restantes}</span>`;
			}

			// 3. RESUMEN DE RUTINA
			try {
				let resRutina = await apiFetch(`/rutinas/usuario/${u.id}`);
				let rutina = (Array.isArray(resRutina) && resRutina.length > 0) ? resRutina[0] : (resRutina?.id ? resRutina : null);

				const summaryContainer = document.getElementById('al-dash-rutina-summary'); 
				const contentContainer = document.getElementById('al-dash-rutina-content');

				if (summaryContainer && contentContainer && rutina && rutina.nombre_grupo) {
					summaryContainer.classList.remove('hidden');
					summaryContainer.classList.add('flex');
					contentContainer.innerHTML = `
						<p class="text-[12px] font-black italic text-white mb-0.5 uppercase tracking-tighter">${rutina.nombre_grupo}</p>
						<p class="text-[9px] text-red-600 font-black uppercase tracking-widest">${rutina.descripcion || 'PLAN PERSONALIZADO'}</p>
					`;
					const btnVer = summaryContainer.querySelector('button');
					if (btnVer) btnVer.onclick = () => window.openFichaTecnica(u.id);
				} else if (summaryContainer) {
					summaryContainer.classList.add('hidden');
				}
			} catch (err) {
				console.error("Error en carga de rutina:", err);
			}

			if (window.lucide) lucide.createIcons();
		}

		/**
		 * Función auxiliar para renderizar las tarjetas de reserva
		 */
		function renderReservaCard(r, isUpcoming) {
			const [y, m, d] = r.fecha_clase.split('-');
			const dateObj = new Date(y, m - 1, d);
			const fechaDisplay = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });

			return `
				<div class="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 mb-3 group hover:border-red-600/30 transition-all ${!isUpcoming ? 'opacity-50 grayscale' : ''}">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-lg ${isUpcoming ? 'bg-red-600/10 text-red-500' : 'bg-white/5 text-white/30'} flex items-center justify-center">
							<i data-lucide="${isUpcoming ? 'clock' : 'check-circle'}" class="w-4 h-4"></i>
						</div>
						<div>
							<p class="text-[11px] font-black uppercase italic text-white leading-none mb-1">${r.clase_nombre}</p>
							<p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${fechaDisplay} @ ${r.horario || ''} HS</p>
						</div>
					</div>
					${isUpcoming ? `
					<button onclick="cancelBooking(${r.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-white/10 hover:text-red-600 hover:bg-red-600/10 transition-all">
						<i data-lucide="trash-2" class="w-4 h-4"></i>
					</button>` : ''}
				</div>`;
		}

		/**
		 * Agrega dinámicamente un nuevo bloque de día, hora y profesor en la grilla del modal de clases.
		 * Sincronizado con el estado de profesores y la estética de ND TRAINING.
		 */
		function addNewScheduleSlot(data = { dia: 1, horario: 7, coach: "" }) {
			const container = document.getElementById('cl-schedule-slots');
			if (!container) return;

			// Si está el mensaje de marcador de posición vacío ("No hay horarios configurados"), lo limpiamos
			if (container.querySelector('p.italic')) {
				container.innerHTML = "";
			}

			const row = document.createElement('div');
			row.className = "schedule-slot-row flex flex-col gap-2 bg-white/5 p-3 rounded-xl border border-white/5 mb-3 group hover:border-red-600/30 transition-all";
			
			const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
			
			// Generar opciones de Días (1 al 6)
			let diasOptions = "";
			for(let d = 1; d <= 6; d++) {
				diasOptions += `<option value="${d}" ${data.dia == d ? 'selected' : ''}>${diasMap[d]}</option>`;
			}

			// Generar opciones de Horarios de 30 minutos (7:00 a 21:30)
			let horasOptions = "";
			for(let i = 7; i <= 21.5; i += 0.5) {
				const label = i % 1 === 0 ? `${i}:00` : `${Math.floor(i)}:30`;
				horasOptions += `<option value="${i}" ${data.horario == i ? 'selected' : ''}>${label} HS</option>`;
			}

			// Generar opciones de Profesores desde el estado global local
			let coachOptions = `<option value="">Asignar Profesor...</option>`;
			if (state.profesores && state.profesores.length > 0) {
				coachOptions += state.profesores.map(p => 
					`<option value="${p.nombre_completo}" ${data.coach === p.nombre_completo ? 'selected' : ''}>${p.nombre_completo}</option>`
				).join('');
			} else {
				coachOptions += `<option value="Staff">Staff General</option>`;
			}

			// Inyectamos la estructura final del bloque con el grid de inputs y el delete button
			row.innerHTML = `
				<div class="flex items-center justify-between">
					<span class="text-[9px] font-black text-red-600 uppercase italic tracking-widest">Turno</span>
					<button type="button" onclick="this.closest('.schedule-slot-row').remove()" class="text-gray-500 hover:text-red-500 transition-all">
						<i data-lucide="x" class="w-4 h-4"></i>
					</button>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<select class="viking-input py-1 h-9 text-[10px] slot-dia bg-black/40 border-white/10 text-white">${diasOptions}</select>
					<select class="viking-input py-1 h-9 text-[10px] slot-hora bg-black/40 border-white/10 text-white">${horasOptions}</select>
				</div>
				<div class="w-full">
					<select class="viking-input py-1 h-9 text-[10px] w-full slot-coach bg-black/40 border-white/10 text-gray-300">
						${coachOptions}
					</select>
				</div>
			`;

			container.appendChild(row);
			
			// Volvemos a inicializar Lucide para que pinte el icono "x" en el botón de borrar
			if (window.lucide) {
				lucide.createIcons();
			}
		}

			// 2. Reemplaza tu función de guardado de clase
			async function saveClaseVikinga(e) {
				if(e) e.preventDefault();
				const id = document.getElementById('cl-id').value;
				const slotRows = document.querySelectorAll('.schedule-slot-row');
				
				const horarios_detalle = [];
				slotRows.forEach(row => {
					horarios_detalle.push({
						dia: parseInt(row.querySelector('.slot-dia').value),
						horario: parseFloat(row.querySelector('.slot-hora').value)
					});
				});

				const payload = {
					nombre: document.getElementById('cl-nombre').value,
					coach: document.getElementById('cl-coach-select').value,
					color: document.getElementById('cl-color').value,
					capacidad_max: parseInt(document.getElementById('cl-cupo').value),
					horarios_detalle: horarios_detalle
				};

				const method = id ? 'PUT' : 'POST';
				const res = await apiFetch(id ? `/clases/${id}` : '/clases', method, payload);
				if(!res.error) {
					closeModal('modal-clase');
					loadClases();
					showVikingToast("Operación exitosa");
				}
			}

        /**
         * ============================================================
         * SISTEMA DE GESTIÓN DE CALENDARIO - VIKINGO / PEAKFIT
         * Soporte para: Navegación de Semanas, Múltiples Boxes y Reservas
         * ============================================================
         */

        // 1. EXTENSIÓN DEL ESTADO PARA CALENDARIO
        if (!state.calendar) {
            state.calendar = {
                weekOffset: 0,           // 0 es semana actual, -1 anterior, 1 siguiente
                currentBox: 'Principal'  // 'Principal', 'Calistenia', 'Musculacion'
            };
        }

        async function fetchReservas() {
                    const data = await apiFetch('/reservas');
                    if (!data.error) {
                        // Guardamos las reservas en el estado global para que el calendario las vea
                        state.reservas = Array.isArray(data) ? data : [];
                        return state.reservas;
                    } else {
                        console.error("Error cargando reservas:", data.error);
                        return [];
                    }
                }

                async function bookClass(claseId) {
                    if (state.user.rol_nombre !== "Alumno") return;
                    const clase = state.clases.find(c => c.id === claseId);
                    if (!clase) return;

                    const cupoMax = clase.capacidad_max || 40; 
                    const cupoActual = state.reservas.filter(r => r.clase_id === claseId).length;

                    if (cupoActual >= cupoMax) {
                        showVikingToast("¡Clase Llena! No hay más cupos.", true);
                        return;
                    }

                    const yaReservado = state.reservas.find(r => r.clase_id === claseId && r.alumno_dni === state.user.dni);
                    if (yaReservado) {
                        showVikingToast("Ya estás anotado en esta clase.", true);
                        return;
                    }

                    const data = { usuario_id: parseInt(state.user.id), clase_id: parseInt(clase.id) };
                    const res = await apiFetch('/reservas', 'POST', data);
                    if (!res.error) {
                        showVikingToast("¡Reserva confirmada!");
                        await fetchReservas();
                        renderCalendar();
                        renderStudentDashboard();
                    } else {
                        showVikingToast("Error al reservar: " + res.error, true);
                    }
                }

                async function cancelBooking(id) {
                    const res = await apiFetch(`/reservas/${id}`, 'DELETE');
                    if (!res.error) {
                        showVikingToast("Reserva Cancelada.");
                        await fetchReservas();
                        renderCalendar();
                        renderStudentDashboard();
                    }
                }

                function openInscriptos(claseId, dia, horario) {
					// ⚔️ 1. Filtrado de reservas
					const inscriptos = state.reservas.filter(r => 
						String(r.clase_id) === String(claseId) &&
						Number(r.dia_semana) === Number(dia) &&
						Number(r.horario) === Number(horario)
					);

					const listaDiv = document.getElementById('inscriptos-lista');
					const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
					const labelHora = horario % 1 === 0 ? `${horario}:00` : `${Math.floor(horario)}:30`;

					// ⚔️ 2. Renderizado con Cruce de Datos
					listaDiv.innerHTML = inscriptos.length ? inscriptos.map(r => {
						// Buscamos el alumno en el estado global para obtener el nombre real
						const alumnoInfo = state.alumnos.find(a => String(a.dni) === String(r.alumno_dni));
						const nombreMostrar = alumnoInfo ? alumnoInfo.nombre_completo : (r.alumno_nombre || "Alumno Desconocido");

						return `
						<div class="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all duration-300">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center border border-red-600/30">
									<span class="text-red-500 font-black text-xs">${nombreMostrar.substring(0, 1).toUpperCase()}</span>
								</div>
								<div>
									<p class="text-[13px] font-black uppercase italic text-white tracking-tighter">${nombreMostrar}</p>
									<p class="text-[10px] text-white/40 font-bold tracking-widest">DNI: ${r.alumno_dni}</p>
								</div>
							</div>
							<button onclick="deleteBookingAdmin(${r.id}, ${claseId}, ${dia}, ${horario})" 
									class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-lg"
									title="Dar de baja">
								<i data-lucide="user-minus" class="w-4 h-4"></i>
							</button>
						</div>`;
					}).join('') : `
						<div class="flex flex-col items-center justify-center py-12 opacity-20">
							<i data-lucide="users" class="w-12 h-12 mb-4"></i>
							<p class="text-sm font-bold uppercase italic">Sin alumnos para el ${diasMap[dia]} ${labelHora}hs</p>
						</div>`;
					
					if(window.lucide) lucide.createIcons();
					openModal('modal-inscriptos');
				}

                async function deleteBookingAdmin(reservaId, claseId, dia, horario) {
                    if(!confirm("¿Quitar alumno de la clase?")) return;
                    const res = await apiFetch(`/reservas/${reservaId}`, 'DELETE');
                    if(!res.error) {
                        await fetchReservas();
                        // CORRECCIÓN: Volvemos a cargar la lista filtrada con los parámetros correctos
                        openInscriptos(claseId, dia, horario);
                        renderCalendar();
                        showVikingToast("Alumno removido del cupo.");
                    }
                }

        /**
         * NAVEGACIÓN Y BOXES (NUEVAS FUNCIONES)
         */
        window.changeCalendarWeek = function(offset) {
            state.calendar.weekOffset += offset;
            renderCalendar();
        };

        window.resetCalendarWeek = function() {
            state.calendar.weekOffset = 0;
            renderCalendar();
        };

        window.changeCalendarBox = function(boxName) {
            state.calendar.currentBox = boxName;
            // Actualizamos visual de los botones
            document.querySelectorAll('.box-filter-btn').forEach(btn => {
                btn.classList.remove('bg-red-600', 'text-black');
                btn.classList.add('text-white/30');
            });
            const activeBtn = document.getElementById(`box-${boxName}`);
            if(activeBtn) {
                activeBtn.classList.remove('text-white/30');
                activeBtn.classList.add('bg-red-600', 'text-black');
            }
            renderCalendar();
        };

                /**
                 * RENDERIZADO DEL CALENDARIO VIKINGO (VERSIÓN FINAL COMPACTA 40PX)
                 * Ajuste: Se eliminó el gap del grid para evitar el sangrado de badges al scrollear.
                 */
            async function renderCalendar() {
				const cal = document.getElementById('calendar-grid');
				if (!cal) return;

				// --- 🛡️ BLINDAJE DE SUCURSAL (REFORZADO) ---
				if (!state.user) {
					const savedUser = localStorage.getItem('viking_user');
					if (savedUser) {
						state.user = JSON.parse(savedUser);
					}
				}

				// ⚔️ PRIORIDAD DE FILTRO: Primero el selector, luego el estado global, luego el usuario
				const selectorSede = document.getElementById('cal-sucursal-filter');
				const currentSucursalId = selectorSede ? selectorSede.value : (state.viewing_sucursal_id || state.user?.sucursal_id);
				
				if (!currentSucursalId) {
					console.warn("⚠️ Abortando renderCalendar: No hay sucursal_id disponible todavía.");
					return;
				}

				// Limpieza total antes de renderizar para evitar superposiciones
				cal.innerHTML = "";
				cal.className = "calendar-container min-w-[900px] h-[750px] overflow-y-auto custom-scrollbar grid grid-cols-[80px_repeat(6,1fr)] bg-white/[0.02]";
				cal.style.gridAutoRows = "40px";

				// 1. CARGA DE DATOS (Filtrados por la sede en visualización)
				try {
					// Forzamos actualización de clases para traer las de la sede actual (si el backend lo permite)
					state.clases = await apiFetch('/clases');
					
					// Aseguramos que los feriados y clases especiales respondan a la sede actual
					const sucursalQuery = parseInt(currentSucursalId);
					state.feriados = await apiFetch(`/feriados?sucursal_id=${sucursalQuery}`) || [];
					state.clasesFeriado = await apiFetch(`/clases-feriado?sucursal_id=${sucursalQuery}`) || [];
				} catch (error) {
					console.error("Error cargando datos del calendario:", error);
				}

				const isAdminGlobal = (state.user?.rol_nombre === "Administrador" || state.user?.rol_nombre === "Supervisor");
				const esAlumno = (state.user?.rol_nombre === "Alumno");
				const miSucursalId = currentSucursalId;

				// Lógica de fechas
				const hoy = new Date();
				const diaSemanaActual = hoy.getDay();
				const diffParaLunes = diaSemanaActual === 0 ? 6 : diaSemanaActual - 1;
				const fechaLunesBase = new Date(hoy);
				fechaLunesBase.setDate(hoy.getDate() - diffParaLunes);
				const fechaLunes = new Date(fechaLunesBase);
				fechaLunes.setDate(fechaLunesBase.getDate() + (state.calendar.weekOffset * 7));

				const labelSemana = document.getElementById('label-semana-vikinga');
				if (labelSemana) {
					const fFin = new Date(fechaLunes);
					fFin.setDate(fechaLunes.getDate() + 5);
					labelSemana.innerText = `${fechaLunes.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${fFin.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`.toUpperCase();
				}

				// --- 2. CABECERAS ---
				const corner = document.createElement('div');
				corner.className = "sticky top-0 z-[60] bg-black flex items-center justify-center font-black italic text-[10px] text-white/30 p-2 border-b border-white/10 rounded-tl-2xl";
				corner.innerText = "HORA";
				cal.appendChild(corner);

				const diasNombres = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
				diasNombres.forEach((nombreDia, index) => {
					const fecha = new Date(fechaLunes);
					fecha.setDate(fechaLunes.getDate() + index);
					const numeroDia = fecha.getDate();
					const mesNombre = fecha.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
					const esHoy = fecha.getDate() === hoy.getDate() && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();

					const header = document.createElement('div');
					header.className = `sticky top-0 z-50 flex flex-row items-center justify-center border-b border-white/10 px-2 ${esHoy ? 'bg-red-600' : 'bg-black text-gray-400'} ${index === 5 ? 'rounded-tr-2xl' : 'border-r'}`;
					header.innerHTML = `<span class="text-[10px] font-black uppercase italic ${esHoy ? 'text-black' : 'text-white'} tracking-tighter whitespace-nowrap">${mesNombre} ${numeroDia} ${nombreDia}</span>`;
					cal.appendChild(header);
				});

				// --- 3. GRILLA ---
				for (let h = 7; h <= 21.5; h += 0.5) {
					const label = h % 1 === 0 ? `${h}:00` : `${Math.floor(h)}:30`;
					const hourLabel = document.createElement('div');
					hourLabel.className = "cal-cell flex items-center justify-center font-black text-[10px] text-white/40 bg-white/5 border-r border-white/20";
					hourLabel.style.height = "40px";
					hourLabel.innerText = label;
					cal.appendChild(hourLabel);

					for (let d = 1; d <= 6; d++) {
						const isSat = d === 6;
						const isClosed = isSat && (h < 10 || h > 13);
						const cellId = `cell-${d}-${h.toString().replace('.', '_')}`;
						const cell = document.createElement('div');
						cell.id = cellId;
						cell.style.height = "40px";
						cell.className = `cal-cell relative border-b border-r border-white/5 hover:bg-white/5 transition-colors ${isClosed ? 'bg-black/40 pointer-events-none' : ''}`;

						// ⚔️ SOLO ADMIN PUEDE MOVER (DROP)
						if (isAdminGlobal && !isClosed) {
							cell.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; cell.classList.add('bg-red-600/10'); };
							cell.ondragleave = () => cell.classList.remove('bg-red-600/10');
							cell.ondrop = async (e) => {
								e.preventDefault();
								cell.classList.remove('bg-red-600/10');
								const claseId = e.dataTransfer.getData("claseId");
								const oldDia = e.dataTransfer.getData("oldDia");
								const oldHorario = e.dataTransfer.getData("oldHorario");
								
								if (!claseId) return;
								const parts = cell.id.split('-');
								const newDia = parseInt(parts[1]);
								const newHorario = parseFloat(parts[2].replace('_', '.'));
								
								if (oldDia == newDia && oldHorario == newHorario) return;

								const res = await apiFetch(`/clases/${claseId}/move`, 'PUT', {
									old_dia: parseInt(oldDia),
									old_horario: parseFloat(oldHorario),
									new_dia: newDia,
									new_horario: newHorario,
									sucursal_id: miSucursalId
								});
								if (!res.error) {
									showVikingToast("¡Turno Reubicado!");
									state.clases = await apiFetch('/clases');
									renderCalendar();
								} else {
									showVikingToast("Error: " + res.error, true);
								}
							};
						}
						cal.appendChild(cell);
					}
				}

				// --- 4. RENDERIZADO DE CONTENIDO (Clases y Feriados) ---
				for (let d = 1; d <= 6; d++) {
					const index = d - 1;
					const fechaSlot = new Date(fechaLunes);
					fechaSlot.setDate(fechaLunes.getDate() + index);
					const fechaSlotStr = fechaSlot.toISOString().split('T')[0];
					
					const infoFeriado = state.feriados?.find(f => 
						f.fecha === fechaSlotStr && 
						f.sucursal_id == miSucursalId
					);

					if (infoFeriado) {
						const listaSegura = Array.isArray(state.clasesFeriado) ? state.clasesFeriado : [];
						const clasesEspecialesHoy = listaSegura.filter(cf => cf.fecha === fechaSlotStr && cf.sucursal_id == miSucursalId);
						clasesEspecialesHoy.forEach(c => {
							pintarBadgeClase(c, d, c.horario, fechaSlotStr, true);
						});
						for (let h = 7; h <= 21.5; h += 0.5) {
							const cell = document.getElementById(`cell-${d}-${h.toString().replace('.', '_')}`);
							if (cell && cell.innerHTML === "") {
								cell.classList.add('bg-black/60');
								cell.style.pointerEvents = 'none';
							}
						}
					} else {
						if (state.clases && Array.isArray(state.clases)) {
							state.clases.forEach(c => {
								// FILTRO DE SUCURSAL PARA RENDER
								if (c.sucursal_id != miSucursalId) return;

								if (state.calendar.currentBox !== 'Principal') {
									if (c.box_nombre !== state.calendar.currentBox) return;
								} else if (c.box_nombre && c.box_nombre !== 'Principal') return;

								const horarios = Array.isArray(c.horarios_detalle) ? c.horarios_detalle : [];
								horarios.forEach(slot => {
									if (slot.dia === d) {
										pintarBadgeClase(c, d, slot.horario, fechaSlotStr, false, slot);
									}
								});
							});
						}
					}
				}

				// --- ⚔️ FUNCIÓN INTERNA PARA BADGES (PROTEGIDA) ---
				function pintarBadgeClase(c, d, horario, fechaSlotStr, esEspecial, slotInfo = null) {
					const hKey = horario.toString().replace('.', '_');
					const cell = document.getElementById(`cell-${d}-${hKey}`);
					if (!cell) return;

					const colorBase = c.color || '#FF0000';
					const getTextColorClass = (hexColor) => {
						if (!hexColor) return { text: 'text-white', bg: 'bg-white/20' };
						const r = parseInt(hexColor.substr(1, 2), 16), g = parseInt(hexColor.substr(3, 2), 16), b = parseInt(hexColor.substr(5, 2), 16);
						const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
						return (yiq >= 128) ? { text: 'text-black', bg: 'bg-black/10' } : { text: 'text-white', bg: 'bg-white/20' };
					};
					const colores = getTextColorClass(colorBase);

					const reservasArray = Array.isArray(state.reservas) ? state.reservas : [];
					const cupoMax = c.capacidad_max || 40;
					const cupoActual = reservasArray.filter(r => 
						String(r.clase_id) === String(c.id) && 
						Number(r.horario) === Number(horario) && 
						String(r.fecha_clase) === String(fechaSlotStr)
					).length;
					const estaLleno = cupoActual >= cupoMax;

					const badge = document.createElement('div');
					badge.className = `absolute top-0.5 left-0.5 right-0.5 rounded-xl flex flex-col items-center justify-center text-center overflow-hidden z-20 p-1 shadow-xl transition-all cursor-pointer`;
					badge.style.height = "79px";
					badge.style.backgroundColor = colorBase;

					// ⚔️ SOLO ADMIN PUEDE INICIAR DRAG
					if (isAdminGlobal && !esEspecial) {
						badge.draggable = true;
						badge.ondragstart = (e) => {
							e.dataTransfer.setData("claseId", c.id);
							e.dataTransfer.setData("claseSucursal", c.sucursal_id);
							e.dataTransfer.setData("oldDia", d);
							e.dataTransfer.setData("oldHorario", horario);
							badge.classList.add('scale-95', 'rotate-2');
						};
						badge.ondragend = () => badge.classList.remove('scale-95', 'rotate-2');
					}

					badge.innerHTML = `
						<div class="flex flex-col items-center justify-center w-full h-full space-y-0.5">
							<span class="text-[9px] font-black uppercase italic leading-[1.1] ${colores.text}">${c.nombre}</span>
							<span class="text-[7px] font-bold uppercase opacity-80 ${colores.text}">${esEspecial ? 'ESPECIAL' : (slotInfo?.coach || 'STAFF')}</span>
							<div class="mt-1 px-2 py-0.5 rounded-full text-[8px] font-black ${colores.bg} ${estaLleno ? 'text-red-500 bg-white' : colores.text}">${cupoActual}/${cupoMax}</div>
						</div>`;

					badge.onclick = (e) => {
						e.stopPropagation();
						if (esAlumno) {
							if (estaLleno) showVikingToast("Cupo lleno", true);
							else if (typeof confirmarReservaVikinga === 'function') confirmarReservaVikinga(c, d, horario, fechaSlotStr);
						} else if (isAdminGlobal || state.user?.rol_nombre?.toLowerCase() === "staff" || state.user?.rol_nombre?.toLowerCase() === "administrativo") {
							if (typeof openInscriptos === 'function') openInscriptos(c.id, d, horario, fechaSlotStr);
						}
					};
					cell.appendChild(badge);
				}

				if (window.lucide) lucide.createIcons();
			}

			// 1. Función para llenar el selector (Llamala en tu initApp)
			function setupCalendarFilters() {
				const selector = document.getElementById('cal-sucursal-filter');
				if (!selector) return;

				// 1. Llenamos el selector con las sucursales del state (si no se llenó antes)
				if (state.sucursales && state.sucursales.length > 0) {
					selector.innerHTML = state.sucursales.map(s => 
						`<option value="${s.id}" ${s.id == state.user.sucursal_id ? 'selected' : ''}>${s.sucursal.toUpperCase()}</option>`
					).join('');
				}

				// 2. LÓGICA DE VISIBILIDAD: ¿Quién puede desplegar el selector?
				const rol = (state.user?.rol_nombre || "").toLowerCase();
				
				// Agregamos 'staff' y 'administrativo' para que no les aparezca grisado
				const puedeVerOtrasSedes = ["administrador", "supervisor", "staff", "administracion", "alumno"].includes(rol);

				if (puedeVerOtrasSedes) {
					selector.disabled = false;
					selector.classList.remove('opacity-50', 'cursor-not-allowed');
					selector.style.pointerEvents = 'auto'; // Aseguramos que responda al click
				} else {
					// Profesores quedan fijos en su sede
					selector.disabled = true;
					selector.classList.add('opacity-50', 'cursor-not-allowed');
				}
			}

			// 2. Función que reacciona al cambio de sucursal en el selector
			async function cambiarSedeCalendario(sucursalId) {
				if (!sucursalId) return;
				if (typeof showVikingToast === 'function') showVikingToast("Cambiando vista de sede...");
				
				// Guardamos qué sede estamos mirando para que renderCalendar sepa qué dibujar
				state.viewing_sucursal_id = parseInt(sucursalId); 
				
				// Recargamos clases (el GET que corregimos en Python nos mandará todas las sedes si somos Staff/Alumno)
				state.clases = await apiFetch('/clases');
				
				// Refrescamos el calendario
				renderCalendar();
			}
                
                /**
                 * FUNCIÓN DE RESERVA CORREGIDA
                 * Evita el error de "Vanhala" manejando fallos internos sin crashear.
                 */
                async function confirmarReservaVikinga(clase, dia, horario, fechaExacta) {
					const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
					const horaLabel = horario % 1 === 0 ? `${horario}:00` : `${Math.floor(horario)}:30`;
					
					showVikingToast(`Procesando reserva...`);

					// El payload ahora incluye la fecha_clase para que el reseteo semanal funcione
					const payload = {
						usuario_id: state.user.id,
						clase_id: clase.id,
						dia_semana: dia,
						horario: horario,
						fecha_clase: fechaExacta 
					};

					try {
						const res = await apiFetch('/reservas', 'POST', payload);
						
						if (!res.error) {
							showVikingToast(`¡Reserva confirmada! ${diasMap[dia]} ${horaLabel}hs`);
							
							// Mantenemos tu bloque de actualización protegido (Try/Catch interno)
							try {
								// 1. Refrescar reservas
								if (typeof fetchReservas === 'function') {
									await fetchReservas(); 
								} else if (typeof loadReservas === 'function') {
									await loadReservas();
								} else {
									const manualData = await apiFetch('/reservas');
									if (!manualData.error) state.reservas = manualData;
								}

								// 2. Redibujar componentes visuales
								renderCalendar(); 
								if (typeof renderStudentDashboard === 'function') {
									renderStudentDashboard();
								}
							} catch (innerError) {
								console.warn("Reserva exitosa pero fallo el refresco visual:", innerError);
							}

						} else {
							// Mantenemos tu manejo de errores del servidor (incluyendo el parseo de JSON)
							let errorMsg = res.error || "No se pudo procesar";
							if (typeof res.error === 'string' && res.error.startsWith('{')) {
								try { errorMsg = JSON.parse(res.error).detail || errorMsg; } catch(e){}
							}
							showVikingToast(errorMsg, true);
						}
					} catch (err) {
						// Mantenemos tu log de error crítico
						console.error("Error crítico en Reserva:", err);
						showVikingToast("Error de sincronización", true);
					}
				}

        /**
 * =========================================================
 * SISTEMA DE FACTURACIÓN Y COBROS - GYMFIT PRO (VIKINGO)
 * Sincronización Completa de Precios (Efectivo/Transf/Tarjeta)
 * =========================================================
 */

function setCobrarTab(tab) {
    state.cobrarTab = tab;
    document.querySelectorAll('.cobrar-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    renderCobrar();
    window.updatePaymentButtons();
}

// Función auxiliar para filtrar planes en tiempo real
function actualizarPlanesPorDuracion(alumnoId) {
    const tipoId = parseInt(document.getElementById(`tipo-select-${alumnoId}`).value);
    const planSelect = document.getElementById(`plan-select-${alumnoId}`);
    
    // Filtramos los planes que coinciden con el tipo_plan_id (1:Mensual, 2:Trimestral, etc)
    const filtrados = state.planes.filter(p => p.tipo_plan_id === tipoId);
    
    planSelect.innerHTML = filtrados.map(p => `
        <option value="${p.id}">${p.nombre}</option>
    `).join('') || '<option value="">Elegí duración...</option>';
}

function renderCobrar() {
    const displayArea = document.getElementById('cobrar-display-area');
    if (!displayArea) return;

    // Seteamos pestaña por defecto si no existe
    if (!state.cobrarTab) state.cobrarTab = 'mercaderia';
    if (window.updatePaymentButtons) window.updatePaymentButtons();

    // 1. CAPTURA DE FILTROS
    const searchVal = document.getElementById('cobrar-search').value.toLowerCase();
    const sucursalFilter = document.getElementById('cobrar-sucursal-filter')?.value || "";
    
    if (state.cobrarTab === 'mercaderia') {
        // --- ⚔️ SECCIÓN MERCADERÍA (Filtrado por Nombre + Sucursal) ---
        const filtered = state.stock.filter(s => {
            const coincideNombre = (s.nombre_producto || "").toLowerCase().includes(searchVal);
            const coincideSucursal = sucursalFilter === "" || s.sucursal_id == sucursalFilter;
            return coincideNombre && coincideSucursal;
        });

        displayArea.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar" id="cobrar-catalogo"></div>`;
        const catalog = document.getElementById('cobrar-catalogo');
        
        catalog.innerHTML = filtered.map(s => {
            const stockActual = parseInt(s.stock_actual) || 0;
            
            let stockColorClass = "text-white/40"; 
            if (stockActual <= 0) stockColorClass = "text-red-500 font-black";
            else if (stockActual < 5) stockColorClass = "text-yellow-500 font-bold";

            const precioFormateado = new Intl.NumberFormat('es-AR').format(s.precio_venta || 0);

            return `
            <div class="glass-card p-4 rounded-3xl relative group cursor-pointer hover:border-red-600/50 flex flex-col h-full" onclick="addToCart(${s.id}, 'stock')">
                <div class="w-full h-24 bg-white/5 rounded-2xl mb-3 flex items-center justify-center overflow-hidden">
                    ${s.url_imagen ? 
                        `<img src="${s.url_imagen}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i data-lucide=\'package\' class=\'w-6 h-6 opacity-20\'></i>'">` : 
                        `<i data-lucide="package" class="w-6 h-6 opacity-20 text-white"></i>`
                    }
                </div>
                <h4 class="text-[10px] font-black uppercase italic mb-1 truncate text-white/90">${s.nombre_producto}</h4>
                
                <div class="flex justify-between items-end mt-auto pt-2 border-t border-white/5">
                    <div>
                        <p class="text-[14px] font-black text-white italic tracking-tighter">$${precioFormateado}</p>
                        <p class="text-[8px] uppercase tracking-tighter ${stockColorClass}">
                            Stock: ${stockActual}
                        </p>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-black transition-all">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </div>
                </div>
            </div>`;
        }).join('');

    } else {
        // --- ⚔️ SECCIÓN PLANES (Filtrado por Nombre/DNI + Sucursal) ---
        const hoy = new Date().toISOString().split('T')[0];
        
        const filteredAl = state.alumnos.filter(a => {
            const coincideBusqueda = (a.nombre_completo || "").toLowerCase().includes(searchVal) || (a.dni || "").includes(searchVal);
            const coincideSucursal = sucursalFilter === "" || a.sucursal_id == sucursalFilter;
            return coincideBusqueda && coincideSucursal;
        });

        displayArea.innerHTML = `
            <div class="glass-card p-8 rounded-[2.5rem] h-[800px] flex flex-col border border-white/5">
                <h4 class="text-[11px] font-black uppercase italic text-red-600 mb-6 tracking-widest border-b border-white/5 pb-4">
                    Guerreros para Renovación
                </h4>
                <div class="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                    ${filteredAl.length > 0 ? filteredAl.map(a => {
                        const isActive = a.fecha_vencimiento && a.fecha_vencimiento >= hoy;
                        const statusColor = isActive ? 'text-green-500' : 'text-red-500';
                        const statusBg = isActive ? 'bg-green-500/10' : 'bg-red-500/10';
                        const statusText = isActive ? 'Activo' : 'Vencido';

                        return `
                        <div class="flex flex-col gap-3 p-5 bg-white/2 rounded-[2rem] border border-white/5 hover:border-red-600/30 transition-all text-left">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl viking-bg-red flex items-center justify-center font-black text-black text-xs italic">
                                        ${(a.nombre_completo ? a.nombre_completo[0] : 'G').toUpperCase()}
                                    </div>
                                    <div>
                                        <p class="text-[13px] font-black italic uppercase text-white">${a.nombre_completo}</p>
                                        <p class="text-[9px] text-white/50 font-bold uppercase tracking-widest">DNI: ${a.dni}</p>
                                    </div>
                                </div>
                                <span class="text-[8px] px-3 py-1 rounded-full ${statusBg} ${statusColor} font-black uppercase italic border border-white/5">
                                    ${statusText}
                                </span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mt-2 pt-3 border-t border-white/5">
                                <div>
                                    <p class="text-[8px] text-white/40 font-black uppercase italic px-2 mb-1">Duración</p>
                                    <select id="tipo-select-${a.id}" onchange="actualizarPlanesPorDuracion(${a.id})" class="viking-input !py-2 !text-[10px] h-10 bg-black/60 border-white/10">
                                        <option value="">Elegir...</option>
                                        <option value="1">Mensual</option>
                                        <option value="2">Trimestral</option>
                                        <option value="3">Semestral</option>
                                        <option value="4">Anual</option>
                                    </select>
                                </div>
                                <div>
                                    <p class="text-[8px] text-white/40 font-black uppercase italic px-2 mb-1">Plan</p>
                                    <select id="plan-select-${a.id}" class="viking-input !py-2 !text-[10px] h-10 bg-black/60 border-white/10">
                                        <option value="">Esperando duración...</option>
                                    </select>
                                </div>
                                <div>
                                    <p class="text-[8px] text-white/40 font-black uppercase italic px-2 mb-1">Nro Ticket</p>
                                    <input type="text" id="plan-comment-${a.id}" placeholder="Nota..." 
                                        class="viking-input !py-2 !text-[10px] h-10 bg-black/60 border-white/10">
                                </div>
                            </div>
                            <button onclick="preparePlanCharge(${a.id})" class="mt-2 w-full h-10 rounded-xl text-[10px] font-black italic bg-green-600/20 text-green-500 border border-green-500/20 hover:bg-green-600 hover:text-black transition-all flex items-center justify-center gap-2">
                                <i data-lucide="shopping-cart" class="w-3 h-3"></i> CONFIRMAR PARA CARRITO
                            </button>
                        </div>`;
                    }).join('') : `<p class="text-white/20 text-center py-10 uppercase italic text-[10px]">No se encontraron guerreros en esta sede</p>`}
                </div>
            </div>`;
    }

    // Refrescamos iconos y UI del carrito
    if (window.lucide) lucide.createIcons();
    if (typeof updateCartUI === 'function') updateCartUI();
}
document.getElementById('cobrar-search').oninput = renderCobrar;

function renderSucursalSelector() {
    const selector = document.getElementById('cobrar-sucursal-filter');
    if (!selector) return;

    const sucursales = state.sucursales || [];

    if (sucursales.length === 0) {
        selector.innerHTML = `<option value="">CARGANDO SEDES...</option>`;
        return;
    }

    selector.innerHTML = `
        <option value="">TODAS LAS SEDES</option>
        ${sucursales.map(s => `
            <option value="${s.id}">${(s.sucursal || "S/N").toUpperCase()}</option>
        `).join('')}
    `;

    selector.onchange = () => renderCobrar();
}

/**
 * =========================================================
 * 2. FUNCIONES DE CAJA Y CARRITO (LÓGICA VISUAL)
 * =========================================================
 */

function addToCart(productId) {
    if (!state || !state.stock) return;
    const item = state.stock.find(s => s.id == productId);
    
    if (!item) {
        console.error("Producto no encontrado ID:", productId);
        return;
    }

    if (item.stock_actual <= 0) {
        return showVikingToast(`¡Sin stock de ${item.nombre_producto}!`, true);
    }

    // Buscamos si ya está en el carrito (IMPORTANTE: producto_id es la clave)
    const existing = state.cart.find(c => c.producto_id == productId && c.tipo === 'Mercaderia');

    if (existing) {
        if (existing.cantidad < item.stock_actual) {
            existing.cantidad++;
            showVikingToast(`+1 ${item.nombre_producto}`);
        } else {
            return showVikingToast("Stock insuficiente para agregar más", true);
        }
    } else {
        // CREAMOS EL OBJETO: Aquí nace el producto_id para la rentabilidad
        state.cart.push({
            tipo: 'Mercaderia',
            producto_id: parseInt(productId), // Aseguramos que sea número
            alumno_id: state.selectedAlumnoId || null, // Capturamos el alumno si hay uno seleccionado
            nombre: item.nombre_producto,
            precio: item.precio_venta, 
            cantidad: 1,
            url_imagen: item.url_imagen 
        });
        showVikingToast(`${item.nombre_producto} añadido`);
    }

    if (typeof updateCartUI === 'function') updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cobrar-lista-carrito');
    if (!list) return; 
    
    if (state.cart.length === 0) {
        list.innerHTML = '<p class="text-center text-white-500 text-[11px] italic py-10">Sin ítems seleccionados</p>';
        updateTotales(0);
        return;
    }

    list.innerHTML = state.cart.map((c, idx) => `
        <div class="flex flex-col gap-2 bg-white/5 p-3 rounded-xl border border-white/5 mb-2">
            <div class="flex items-center justify-between">
                <div class="overflow-hidden text-left">
                    <p class="text-[11px] font-black uppercase italic truncate text-white">${c.nombre}</p>
                    <div class="flex gap-2">
                        <p class="text-[10px] text-gray-500 font-bold">VALOR: $ ${(c.precio || 0).toLocaleString()}</p>
                        <p class="text-[10px] text-red-500 font-bold">CANT: ${c.cantidad}</p>
                    </div>
                </div>
                <button onclick="removeFromCart(${idx})" class="text-red-600 hover:text-white">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
            
            <div class="flex items-center gap-2 mt-1 pt-2 border-t border-white/5">
                <div class="relative flex-1">
                    <input type="number" id="desc-input-${idx}" placeholder="Desc %" 
                        class="viking-input !py-1 !text-[9px] h-7 bg-black/40 border-white/10 w-full"
                        min="0" max="100">
                </div>
                <button onclick="aplicarDescuento(${idx})" 
                    class="h-7 px-3 rounded-lg text-[9px] font-black italic bg-red-600/20 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-black transition-all">
                    APLICAR
                </button>
            </div>
        </div>
    `).join('');

    const total = state.cart.reduce((acc, c) => acc + (c.cantidad * c.precio), 0);
    updateTotales(total);
    
    if (window.lucide) lucide.createIcons();
}

window.aplicarDescuento = function(index) {
    const input = document.getElementById(`desc-input-${index}`);
    const porcentaje = parseFloat(input.value);

    if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        return showVikingToast("Porcentaje inválido (0-100)", true);
    }

    const item = state.cart[index];
    
    // Calculamos el nuevo precio
    // Fórmula: PrecioOriginal - (PrecioOriginal * (Porcentaje / 100))
    const descuento = item.precio * (porcentaje / 100);
    const nuevoPrecio = item.precio - descuento;

    // Actualizamos el precio en el carrito
    item.precio = Math.round(nuevoPrecio); // Redondeamos para evitar decimales molestos
    
    showVikingToast(`Descuento del ${porcentaje}% aplicado`);
    updateCartUI();
};

function updateTotales(monto) {
    const elSub = document.getElementById('cobrar-subtotal');
    const elTot = document.getElementById('cobrar-total');
    if (elSub) elSub.innerText = `$ ${monto.toLocaleString()}`;
    if (elTot) elTot.innerText = `$ ${monto.toLocaleString()}`;
}

function removeFromCart(i) { 
    state.cart.splice(i, 1); 
    updateCartUI(); 
}

window.openModalNewExercise = function() {
    const selectGrupo = document.getElementById('lib-ex-grupo');
    if (selectGrupo) {
        selectGrupo.innerHTML = '<option value="">Seleccionar Grupo Muscular</option>';
        // Usamos los grupos que cargaste en el inicio
        const grupos = state.gruposMusculares || []; 
        grupos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.nombre.toUpperCase();
            selectGrupo.appendChild(opt);
        });
    }
    openModal('modal-nuevo-ejercicio');
};

// --- ACTUALIZACIÓN DE MÉTODO DE PAGO (CON ACTUALIZACIÓN DE PRECIOS DINÁMICOS) ---
window.setPaymentMethod = function(method) {
    const inputOculto = document.getElementById('metodo-pago');
    if (inputOculto) inputOculto.value = method;

    // Lógica de cuotas
    const cuotasCont = document.getElementById('cuotas-container');
    if (cuotasCont) {
        if (method === 'T. Credito') {
            cuotasCont.classList.remove('hidden');
        } else {
            cuotasCont.classList.add('hidden');
            const selCuotas = document.getElementById('cobrar-cuotas');
            if (selCuotas) selCuotas.value = "1";
        }
    }

    // --- NUEVO: RE-CALCULAR PRECIOS DE PLANES EN EL CARRITO SEGÚN EL MÉTODO SELECCIONADO ---
    if (state.cart && state.cart.length > 0) {
        state.cart.forEach(item => {
            if (item.tipo === 'Plan') {
                const planOriginal = state.planes.find(p => p.id === item.producto_id);
                if (planOriginal) {
                    if (method === 'Efectivo') {
                        item.precio = planOriginal.efectivo;
                    } else if (method === 'Transferencia' || method === 'MercadoPago') {
                        item.precio = planOriginal.transferencia;
                    } else if (method === 'T. Debito' || method === 'T. Credito') {
                        item.precio = planOriginal.debito_credito;
                    }
                }
            }
        });
        updateCartUI();
    }

    // Actualizar visual de los botones
    document.querySelectorAll('.btn-pago').forEach(btn => {
        const isMatch = btn.getAttribute('data-method') === method;
        btn.className = isMatch 
            ? "btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-red-600 text-black shadow-lg shadow-red-600/20 transform scale-105"
            : "btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-white/5 text-white-400 hover:text-white border border-transparent hover:border-red-600/30";
    });
};

window.updatePaymentButtons = function() {
    const container = document.getElementById('metodos-pago-container');
    if (!container) return;

    const currentTab = state.cobrarTab || 'mercaderia';
    
    let html = `
        <button onclick="setPaymentMethod('MercadoPago')" data-method="MercadoPago" class="btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-white/5 text-white-400 hover:text-white border border-transparent hover:border-red-600/30">Mercado Pago</button>
        <button onclick="setPaymentMethod('Transferencia')" data-method="Transferencia" class="btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-white/5 text-white-400 hover:text-white border border-transparent hover:border-red-600/30">Transf.</button>
        <button onclick="setPaymentMethod('Efectivo')" data-method="Efectivo" class="btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-red-600 text-black shadow-lg shadow-red-600/20 transform scale-105">Efectivo</button>
        <button onclick="setPaymentMethod('T. Debito')" data-method="T. Debito" class="btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-white/5 text-white-400 hover:text-white border border-transparent hover:border-red-600/30">T. Debito</button>
    `;

    if (currentTab === 'planes') {
        html += `<button onclick="setPaymentMethod('T. Credito')" data-method="T. Credito" class="btn-pago w-full py-3 rounded-xl text-[10px] font-black uppercase italic transition-all bg-white/5 text-white-400 hover:text-white border border-transparent hover:border-red-600/30">T. Credito</button>`;
    }

    container.innerHTML = html;
    setPaymentMethod('Efectivo');
};

window.exportarCajaExcel = function() {
    // 1. Intentamos obtener datos del estado o directamente del DOM (la tabla)
    const tablaBody = document.getElementById('table-caja');
    const filasTabla = tablaBody ? tablaBody.querySelectorAll('tr') : [];
    
    if (filasTabla.length === 0) {
        showVikingToast("No hay movimientos visibles para exportar", true);
        return;
    }

    showVikingToast("Preparando reporte Vikingo...");

    // 2. Mapeamos las filas de la tabla para asegurar que exportamos lo que estamos viendo
    const datosParaExportar = Array.from(filasTabla).map(tr => {
        const celdas = tr.querySelectorAll('td');
        // Si la fila tiene celdas, extraemos el texto
        if (celdas.length >= 6) {
            return {
                'FECHA': celdas[0].innerText.trim(),
                'TIPO': celdas[1].innerText.trim(),
                'DESCRIPCIÓN': celdas[2].innerText.trim(),
                'DETALLE': celdas[3].innerText.trim(),
                'MÉTODO': celdas[4].innerText.trim(),
                'CUOTAS': celdas[5].innerText.trim(),
                'MONTO': celdas[6].innerText.trim().replace('$', '').replace(/\./g, '').replace(',', '.')
            };
        }
        return null;
    }).filter(item => item !== null);

    // 3. Crear el libro de Excel con SheetJS (XLSX)
    try {
        const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
        
        // Ajustamos anchos de columna para que se vea pro (opcional)
        const wscols = [
            {wch: 12}, {wch: 10}, {wch: 35}, {wch: 35}, {wch: 15}, {wch: 8}, {wch: 15}
        ];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Balances_GymFit");

        // 4. Generar nombre de archivo con fecha y hora
        const ahora = new Date();
        const timestamp = `${ahora.getDate()}-${ahora.getMonth()+1}_${ahora.getHours()}hs`;
        
        XLSX.writeFile(workbook, `CAJA_GYMFIT_PRO_${timestamp}.xlsx`);
        
        showVikingToast("¡Excel forjado con éxito! ⚔️");
    } catch (error) {
        console.error("Error al exportar:", error);
        showVikingToast("Error al generar el archivo", true);
    }
};

/**
 * =========================================================
 * 3. LÓGICA DE COBRO (MODULARIZADA Y CONECTADA)
 * =========================================================
 */

async function procesarPagoVikingo(payload, actualizarUI = true) {
    if(actualizarUI) showVikingToast("Sincronizando con la Tesorería...");

    try {
        // CAMBIO CRÍTICO: Usamos apiFetch para incluir automáticamente el Token (evita el 401)
        // y para que el backend sepa a qué sucursal pertenece el movimiento.
        const res = await apiFetch('/cobros/procesar', 'POST', payload);

        // apiFetch ya devuelve el JSON parseado. Si hay error, devuelve {error: ...}
        if (res && !res.error) {
            if(actualizarUI) {
                showVikingToast("¡Victoria! Cobro registrado y Stock actualizado");
                
                const promises = [];
                // Recargamos datos para que la UI refleje el nuevo stock y saldo de caja
                if (typeof loadStock === 'function') promises.push(loadStock());
                if (typeof loadAlumnos === 'function') promises.push(loadAlumnos());
                if (typeof loadCaja === 'function') promises.push(loadCaja());
                
                // Refresco de rentabilidad para ver la ganancia al instante
                if (typeof generarInformeRentabilidad === 'function') promises.push(generarInformeRentabilidad());
                
                await Promise.all(promises);
                
                // Limpiamos el carrito y refrescamos la vista de ventas
                state.cart = [];
                if (typeof updateCartUI === 'function') updateCartUI();
                if (typeof renderCobrar === 'function') renderCobrar();
            }
            return true; 
        } else {
            // Manejo de errores detallado que viene del servidor
            const errorMsg = res.detail || res.error || "Error desconocido en el proceso";
            showVikingToast("Error: " + errorMsg, true);
            return false;
        }
    } catch (err) {
        console.error("Error en procesarPagoVikingo:", err);
        showVikingToast("Error de conexión con el servidor", true);
        return false;
    }
}

async function preparePlanCharge(alumnoId) {
    const alumno = state.alumnos.find(a => a.id === alumnoId);
    if (!alumno) return;

    const planSelect = document.getElementById(`plan-select-${alumnoId}`);
    const commentInput = document.getElementById(`plan-comment-${alumnoId}`);
    if (!planSelect) return;

    const planId = parseInt(planSelect.value);
    const plan = state.planes.find(p => p.id === planId);
    if (!plan) return showVikingToast("Selecciona un plan válido", true);

    const existe = state.cart.find(c => c.alumno_id === alumnoId && c.tipo === 'Plan');
    if(existe) return showVikingToast("Este alumno ya tiene un plan en el carrito", true);

    const comentario = commentInput ? commentInput.value.trim() : "";

    // --- NUEVO: DETERMINAR PRECIO INICIAL SEGÚN MÉTODO SELECCIONADO EN EL MOMENTO ---
    const metodoActual = document.getElementById('metodo-pago').value;
    let precioSeleccionado = plan.efectivo;
    if (metodoActual === 'Transferencia' || metodoActual === 'MercadoPago') {
        precioSeleccionado = plan.transferencia;
    } else if (metodoActual === 'T. Debito' || metodoActual === 'T. Credito') {
        precioSeleccionado = plan.debito_credito;
    }

    state.cart.push({
        tipo: 'Plan',
        producto_id: planId,
        alumno_id: alumnoId,
        nombre: `${plan.nombre} (${alumno.nombre_completo})`,
        precio: precioSeleccionado,
        cantidad: 1,
        descripcion2: comentario
    });

    showVikingToast("Plan sumado al carrito");
    updateCartUI();
}

async function finalizarVentaMercaderia() {
    if (state.cart.length === 0) return showVikingToast("El carrito está vacío", true);

    const total = state.cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const metodoEl = document.getElementById('metodo-pago');
    const metodoPago = metodoEl ? metodoEl.value : "Efectivo";

    const cuotasEl = document.getElementById('cobrar-cuotas');
    const cuotas = cuotasEl ? parseInt(cuotasEl.value) : 1;

    let mensajeConfirmacion = `¿Finalizar cobro total de $${total.toLocaleString()} con ${metodoPago}?`;
    if (metodoPago === 'T. Credito' && cuotas > 1) {
        mensajeConfirmacion = `¿Finalizar cobro total de $${total.toLocaleString()} en ${cuotas} cuotas con ${metodoPago}?`;
    }

    if (confirm(mensajeConfirmacion)) {
        showVikingToast("Procesando en la Tesorería...");
        let errores = 0;

        for (const item of state.cart) {
            // Usamos la función procesarPagoVikingo que ya tenés para mantener la consistencia
            const payload = {
                tipo: item.tipo,
                monto: item.precio * item.cantidad,
                descripcion: item.tipo === 'Plan' ? item.nombre : `Venta: ${item.nombre} (x${item.cantidad})`,
                descripcion2: item.descripcion2 || "",
                metodo_pago: metodoPago,
                cuotas: cuotas,
                producto_id: item.producto_id,
                alumno_id: item.alumno_id,
                cantidad: item.cantidad
            };

            // Llamamos a la función encargada del fetch (pasamos false para que no actualice la UI en cada iteración)
            const exito = await procesarPagoVikingo(payload, false);
            if (!exito) errores++;
        }

        if (errores === 0) {
            showVikingToast("¡Cobro exitoso! Datos actualizados.");

            // Capturamos el ítem de referencia para extraer datos del alumno y ticket
            const itemReferencia = state.cart[0];
            const alumnoActual = itemReferencia.alumno_id ? state.alumnos.find(a => a.id === itemReferencia.alumno_id) : null;

            // ⚔️ LÓGICA DE FACTURACIÓN: Solo si el ítem es un 'Plan'
            if (itemReferencia.tipo === 'Plan') {
                const infoFactura = {
                    pago_id: 0, // El backend lo convertirá a NULL automáticamente si es 0
                    usuario_id: parseInt(itemReferencia.alumno_id) || 0,
                    monto_total: parseFloat(total),
                    metodo_pago: metodoPago,
                    nro_ticket_postnet: String(itemReferencia.descripcion2 || "S/N"),
                    plan_nombre_snapshot: String(itemReferencia.nombre || "Plan Guerrero")
                };

                // 1. VIAJE AL BACKEND: Intentamos guardar en la DB (Sin popup de impresión)
                const facturaGuardada = await guardarComprobanteEnBD(infoFactura);

                if (facturaGuardada) {
					// 1. Verificamos si el alumno tiene teléfono cargado
					const tieneTelefono = alumnoActual && alumnoActual.telefono && alumnoActual.telefono.trim() !== "";

					if (tieneTelefono) {
						// El confirm es una acción bloqueante del usuario, ideal para disparar window.open después
						const respuesta = confirm(`Comprobante ${facturaGuardada.nro_factura} generado con éxito.\n\n¿Deseas enviárselo por WhatsApp a ${alumnoActual.nombre_completo}?`);
						
						if (respuesta) {
							// Verificamos la existencia de la función antes de llamar
							if (typeof window.enviarFacturaWhatsApp === 'function') {
								window.enviarFacturaWhatsApp(facturaGuardada);
							} else {
								console.error("Error: window.enviarFacturaWhatsApp no está definida en el script.");
								showVikingToast("Error técnico al abrir WhatsApp", true);
							}
						}
					} else {
						// Si no tiene teléfono, solo notificamos el éxito del guardado
						console.log("Comprobante guardado en DB. Alumno sin teléfono registrado.");
						showVikingToast("Comprobante registrado (Sin Teléfono)");
					}
				} else {
					// Si el backend falló (Error 500 o similar)
					console.error("Error crítico: El cobro impactó pero no se pudo generar el registro de factura.");
					showVikingToast("Error al registrar comprobante en DB", true);
				}
            } else {
                // Si es mercadería (agua, snacks, etc.), no hacemos nada extra
                console.log("Venta de mercadería detectada: Se omite generación de Factura A.");
            }

            // 3. LIMPIEZA Y ACTUALIZACIÓN DE INTERFAZ (Siempre se ejecuta)
            state.cart = [];
            if (typeof updateCartUI === 'function') updateCartUI();
            
            // Recarga sincronizada de datos maestros para reflejar stock y caja real
            const promesasRefresco = [loadStock(), loadCaja(), fetchAlumnos()];
            if (typeof generarInformeRentabilidad === 'function') promesasRefresco.push(generarInformeRentabilidad());
            
            await Promise.all(promesasRefresco);
            
            // Redibujamos la vista de cobro para vaciar el panel
            if (typeof renderCobrar === 'function') renderCobrar();
            
        } else {
            showVikingToast(`Hubo ${errores} errores en el proceso de cobro.`, true);
        }
    }
}

async function guardarComprobanteEnBD(datos) {
    try {
        // Llamamos al nuevo endpoint que creamos en el main.py
        const res = await apiFetch('/cobros/comprobante', 'POST', {
            pago_id: datos.pago_id,
            usuario_id: datos.usuario_id,
            monto_total: datos.monto_total,
            metodo_pago: datos.metodo_pago,
            nro_ticket_postnet: datos.nro_ticket_postnet,
            plan_nombre_snapshot: datos.plan_nombre_snapshot
        });

        if (res && !res.error) {
            console.log("Comprobante guardado en NeonDB:", res.nro_factura);
            return res; // Devuelve el ID y el Nro oficial (ej: 0001-00000001)
        }
    } catch (err) {
        console.error("Error al persistir comprobante:", err);
    }
    return null;
}

window.generateFacturaA = (data) => {
    // 1. Intentamos abrir la ventana
    const win = window.open('', '_blank');

    // 2. Verificamos si el navegador la bloqueó
    if (!win || win.closed || typeof win.closed === 'undefined') {
        alert("⚠️ El navegador bloqueó la factura. Por favor, habilita los pop-ups para este sitio y reintenta desde el historial.");
        return;
    }

    const nroRemito = Math.floor(Math.random() * 1000000); 
    
    // 3. Si win existe, escribimos el contenido
    win.document.write(`
        <html>
            <head>
                <title>Comprobante GYMFIT PRO</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="p-10 bg-white text-black">
                <div class="max-w-3xl mx-auto border-2 border-black p-8">
                    <div class="flex justify-between border-b-2 border-black pb-4">
                        <div>
                            <h1 class="text-3xl font-black italic text-red-600">GYMFIT PRO</h1>
                            <p class="text-[10px]">AV. SUAREZ 1581, CABA</p>
                            <p class="text-[10px]">CUIT: 20371620819</p>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-bold">FACTURA "A"</h2>
                            <p>N° 0001-${String(nroRemito).padStart(8, '0')}</p>
                            <p>Fecha: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="my-6">
                        <p class="font-bold uppercase">CLIENTE: ${data.alumno?.nombre_completo || 'Consumidor Final'}</p>
                        <p class="text-sm italic">DNI: ${data.alumno?.dni || 'N/A'}</p>
                        <p class="text-sm font-bold mt-2">TICKET POSNET: #${data.ticket || 'S/N'}</p>
                    </div>
                    <table class="w-full mb-8">
                        <thead>
                            <tr class="border-b-2 border-black">
                                <th class="text-left py-1 text-xs">CONCEPTO</th>
                                <th class="text-right py-1 text-xs">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(it => `
                                <tr class="border-b border-gray-100">
                                    <td class="py-2 text-sm">${it.nombre} (x${it.cantidad})</td>
                                    <td class="text-right font-bold text-sm">$ ${it.precio.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="text-right font-black text-2xl">
                        TOTAL: $ ${data.total.toLocaleString()}
                    </div>
                    <p class="text-[9px] mt-10 italic text-center text-gray-400">Documento de control interno no válido como factura fiscal.</p>
                </div>
                <script>
                    window.onload = () => { 
                        setTimeout(() => {
                            window.print(); 
                            // Opcional: window.close(); 
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    win.document.close();
};

		/**
 * ============================================================
 * MÓDULO DE RUTINAS VIKINGAS - SISTEMA INTEGRAL IRONMOD (RECONSTRUIDO)
 * Sincronizado con: ejercicios_libreria, rutina_dias, series_ejercicios
 * ============================================================
 */

// 1. INICIALIZACIÓN DEL ESTADO
if (!state.routineWizard) {
    state.routineWizard = {
        currentPage: 1,
        itemsPerPage: 10,
        filteredAlumnos: []
    };
}

function resetWizardState(alumnoId = null) {
    state.routineWizard = {
        ...state.routineWizard,
        alumnoId: alumnoId,
        currentStep: 1,
        tipo: 'normal',
        tipo_id: 1,
        cantDias: 3,
        cantSemanas: 5,
        nombre_grupo: 'NUEVA RUTINA',
        objetivo: 'Fase de acondicionamiento',
        vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        config: {}, 
        semanaActivaWizard: 1,
        activeDayKey: null,
        isTabSwitching: false,
        openDays: [],
        semanaActivaFicha: 1
    };
}

/**
 * Utilidades Visuales
 */
function getVikingInitials(a) {
    const nombre = a.nombre_completo || (a.usuario ? a.usuario.nombre_completo : null);
    if (!nombre || typeof nombre !== 'string') return "V";
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
}

/**
 * 1. CARGA DE METADATOS (Arsenal Vikingo)
 */
async function loadMusculacionMetadata() {
    try {
        const [grupos, ejercicios] = await Promise.all([
            apiFetch('/rutinas/grupos-musculares'),
            apiFetch('/rutinas/ejercicios') 
        ]);
        state.gruposMusculares = Array.isArray(grupos) ? grupos : [];
        state.ejerciciosLibreria = Array.isArray(ejercicios) ? ejercicios : [];
    } catch (e) {
        console.error("Error cargando metadatos:", e);
    }
}

function toggleTheme() {
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('viking-theme', theme);
}

// Al cargar la página aplica el tema guardado
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('viking-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
});

/**
 * 2. FICHA TÉCNICA (Visualización de Rutina)
 */
window.openFichaTecnica = async function(alumnoId) {
    const rutinaContainer = document.getElementById('ficha-rutina-container');
    if (!rutinaContainer) return;

    const isStaff = ["Profesor", "Administrador", "Supervisor"].includes(state.user?.rol_nombre);
    state.routineWizard.alumnoId = alumnoId;

    if (!state.routineWizard.isTabSwitching) {
        rutinaContainer.innerHTML = `
            <div class="col-span-2 py-16 flex flex-col items-center justify-center space-y-4">
                <div class="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-[10px] text-white/20 italic uppercase tracking-[0.3em] animate-pulse text-center">Sincronizando Arsenal...</p>
            </div>
        `;
    }

    const al = await apiFetch(`/alumnos/${alumnoId}/ficha`);
    if (al.error) {
        showVikingToast("Error de conexión", true);
        return;
    }

    const ids = {
        'ficha-avatar': getVikingInitials(al),
        'ficha-nombre': al.nombre_completo || 'Sin Nombre',
        'ficha-dni': "DNI: " + (al.dni || '---'),
        'ficha-plan': "Plan: " + (al.plan || al.plan_nombre || 'Sin Plan Activo')
    };
    Object.entries(ids).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    });

    // Cargamos la rutina activa
    let rutinaActiva = await apiFetch(`/rutinas/usuario/${alumnoId}`);
    
    if (rutinaActiva && !rutinaActiva.error) {
        const semIdActivo = state.routineWizard.semanaActivaFicha || 1;
        const esProg = rutinaActiva.tipo_id === 2 || rutinaActiva.tipo === 'progresiva';
        const objetivoId = `obj-group-0`;

        // --- LÓGICA DE SEMANAS DINÁMICAS ---
        let tabsHTML = '';
        if (esProg) {
            // Buscamos cuál es la semana más alta que tiene cargada esta rutina
            const todasLasSemanas = (rutinaActiva.dias || []).flatMap(d => 
                (d.ejercicios || []).map(ex => ex.semana_id)
            );
            const maxSemana = todasLasSemanas.length > 0 ? Math.max(...todasLasSemanas) : 1;

            tabsHTML = `
                <div class="flex gap-2 mb-8 bg-black/40 p-2 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                    ${Array.from({length: maxSemana}).map((_, i) => {
                        const id = i + 1;
                        return `
                        <button onclick="window.changeFichaSemana(${id}, ${alumnoId})"
                            class="flex-1 min-w-[100px] py-3 rounded-xl font-black italic uppercase text-[10px] transition-all
                            ${semIdActivo === id ? 'bg-red-600 text-black shadow-[0_0_20px_rgba(255,0,0,0.3)]' : 'bg-white/5 text-white/30 border border-white/10'}">
                            Semana ${id}
                        </button>`;
                    }).join('')}
                </div>`;
        }

        const diasHTML = (rutinaActiva.dias || []).map((d, dIdx) => {
            const diaId = `ficha-dia-${dIdx}`;
            const isOpen = state.routineWizard.openDays?.includes(diaId);
            
            let ejerciciosFiltrados = d.ejercicios || [];
            if (esProg) {
                ejerciciosFiltrados = ejerciciosFiltrados.filter(ex => ex.semana_id === semIdActivo);
            }

            if (esProg && ejerciciosFiltrados.length === 0) return ''; 

            return `
            <div class="bg-white/2 rounded-[2rem] border border-white/5 overflow-hidden mb-4 transition-all">
                <button onclick="window.toggleFichaElement('${diaId}')" class="w-full flex items-center justify-between p-6 group text-left">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black italic text-red-600">
                            ${d.nombre_dia.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="text-[13px] font-black italic uppercase text-white group-hover:text-red-500">${d.nombre_dia}</span>
                            <p class="text-[9px] text-white/30 font-bold uppercase tracking-widest">${ejerciciosFiltrados.length} Ejercicios</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-down" class="w-5 h-5 text-white/20 transition-transform ${isOpen ? 'rotate-180' : ''}"></i>
                </button>
                <div id="${diaId}" class="${isOpen ? '' : 'hidden'} p-6 space-y-6 bg-black/40 border-t border-white/5">
                    ${ejerciciosFiltrados.map(ex => {
                        const cleanName = (ex.ejercicio_obj?.nombre || "Ejercicio").trim();
                        const series = ex.series_detalle || [];
                        // Intentamos captar de ambos campos por las dudas de la DB
                        const notaTexto = ex.comentario || ex.comentarios || "";

                        return `
                            <div class="flex flex-col border-l-2 border-red-600/30 pl-6 relative">
                                <p class="text-[14px] font-black uppercase italic text-white mb-4">${cleanName}</p>
                                <div class="flex flex-col gap-2">
                                    ${series.map(s => `
                                        <div class="grid grid-cols-4 items-center bg-white/[0.03] px-5 py-3 rounded-2xl border border-white/5 text-center">
                                            <span class="text-[10px] font-black text-red-600">#${s.numero_serie}</span>
                                            <span class="text-[11px] font-black text-white">${s.repeticiones} Reps</span>
                                            <span class="text-[11px] font-black text-white">${s.peso}kg</span>
                                            <span class="text-[9px] text-white/40 italic">${s.descanso}</span>
                                        </div>
                                    `).join('')}
                                </div>
                                ${notaTexto ? `<div class="mt-3 p-3 bg-red-600/5 rounded-xl border border-red-600/10">
                                    <p class="text-[9px] text-white/60 italic font-medium"><span class="text-red-600 font-black not-italic mr-1">CONSIGNA:</span> ${notaTexto}</p>
                                </div>` : ''}
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');

        // --- RENDER FINAL CON VENCIMIENTO ---
        rutinaContainer.innerHTML = `
        <div class="col-span-2 mb-8 animate-in fade-in slide-in-from-bottom-4">
            <div class="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div class="flex items-center justify-between p-8">
                    <div class="flex items-center gap-6 cursor-pointer" onclick="window.toggleFichaElement('${objetivoId}')">
                        <div class="w-1.5 h-12 viking-bg-red rounded-full"></div>
                        <div class="text-left">
                            <h5 class="text-xl font-black italic uppercase text-white leading-none">${rutinaActiva.nombre_grupo || 'Rutina Actual'}</h5>
                            <div class="flex flex-col gap-1 mt-2">
                                <p class="text-[9px] text-white/40 font-bold italic uppercase tracking-widest">OBJETIVO: ${rutinaActiva.descripcion || 'General'}</p>
                                <p class="text-[9px] text-red-600 font-black uppercase tracking-widest flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-3 h-3"></i> 
                                    VENCE EL: ${rutinaActiva.fecha_vencimiento ? new Date(rutinaActiva.fecha_vencimiento).toLocaleDateString('es-AR') : 'S/D'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        ${isStaff ? `<button onclick="closeModal('modal-ficha-tecnica'); window.openRoutineEditor(${alumnoId}, true)" class="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-colors">EDITAR</button>` : ''}
                        <i data-lucide="chevron-down" class="w-6 h-6 text-white/20 cursor-pointer" onclick="window.toggleFichaElement('${objetivoId}')"></i>
                    </div>
                </div>
                <div id="${objetivoId}" class="p-8 bg-black/30 border-t border-white/5">
                    ${tabsHTML}
                    ${diasHTML}
                </div>
            </div>
        </div>`;
    } else {
        rutinaContainer.innerHTML = `
            <div class="col-span-2 p-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                <p class="opacity-20 font-black uppercase italic tracking-[0.4em] text-sm">Sin Arsenal Asignado</p>
            </div>`;
    }

    if (window.lucide) lucide.createIcons();
    if (!state.routineWizard.isTabSwitching) openModal('modal-ficha-tecnica');
    state.routineWizard.isTabSwitching = false;
};

window.changeFichaSemana = function(id, alumnoId) {
    state.routineWizard.semanaActivaFicha = id;
    state.routineWizard.isTabSwitching = true;
    window.openFichaTecnica(alumnoId);
};

window.toggleFichaElement = function(id) {
    const content = document.getElementById(id);
    if (!content) return;
    if (!state.routineWizard.openDays) state.routineWizard.openDays = [];
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        state.routineWizard.openDays.push(id);
    } else {
        content.classList.add('hidden');
        state.routineWizard.openDays = state.routineWizard.openDays.filter(d => d !== id);
    }
    if (window.lucide) lucide.createIcons();
};

/**
 * 3. WIZARD IRONMOD
 */
window.openRoutineEditor = async function(alumnoId, isEdit = false) {
    const al = state.alumnos.find(a => a.id === alumnoId);
    if (!al) return;

    resetWizardState(alumnoId);
    await loadMusculacionMetadata();

    if (isEdit) {
        let active = await apiFetch(`/rutinas/usuario/${alumnoId}`);
        if (active && !active.error) {
            state.routineWizard.tipo_id = active.tipo_id;
            state.routineWizard.tipo = active.tipo_id === 2 ? 'progresiva' : 'normal';
            state.routineWizard.nombre_grupo = active.nombre_grupo || active.objetivo;
            state.routineWizard.objetivo = active.descripcion;
            state.routineWizard.vencimiento = active.fecha_vencimiento;
            state.routineWizard.cantDias = active.dias.length;

            active.dias.forEach((d, dIdx) => {
                const dayNum = dIdx + 1;
                d.ejercicios.forEach(ex => {
                    const weekNum = ex.semana_id || 1;
                    const key = state.routineWizard.tipo === 'progresiva' ? `week${weekNum}_day${dayNum}` : `day_${dayNum}`;
                    
                    if(!state.routineWizard.config[key]) {
                        state.routineWizard.config[key] = { label: d.nombre_dia, exercises: [] };
                    }
                    
                    const serie = ex.series_detalle?.[0] || {};
                    state.routineWizard.config[key].exercises.push({
                        id: ex.ejercicio_id, 
                        uid: Math.random().toString(36).substr(2, 9), 
                        nombre: ex.ejercicio_obj?.nombre || "Ejercicio",
						series: ex.series_detalle?.length || '3',
                        reps: serie.repeticiones || '12', 
                        weight: serie.peso || '0', 
                        rest: serie.descanso || '90s',
                        comentario: ex.comentario || ''
                    });
                });
            });
        }
    }

    const titleEl = document.getElementById('rutina-editor-alumno');
    if (titleEl) titleEl.innerText = al.nombre_completo.toUpperCase();
    
    window.renderWizardStep();
    openModal('modal-rutina-editor');
};

window.renderWizardStep = function() {
    const body = document.getElementById('rutina-editor-body');
    const label = document.getElementById('rutina-editor-step-label');
    const fill = document.getElementById('editor-progress-fill');
    if (!body || !label) return;

    // 🛡️ CAPTURAR SCROLL DERECHO ANTES DE BORRAR EL HTML
    const scrollContainer = document.getElementById('wizard-main-scroll-area');
    const currentScroll = scrollContainer ? scrollContainer.scrollTop : 0;

    const step = state.routineWizard.currentStep;
    if (fill) fill.style.width = step === 1 ? '30%' : '100%';

    if (step === 1) {
        label.innerText = "PASO 1: CONFIGURACIÓN MAESTRA";
        body.innerHTML = `
            <div class="flex-1 p-10 lg:p-20 overflow-y-auto custom-scrollbar animate-in zoom-in-95">
                <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
                    <div class="col-span-full space-y-2">
                        <label class="text-[10px] font-black text-red-600 uppercase tracking-widest italic ml-2">Nombre del Plan</label>
                        <input type="text" value="${state.routineWizard.nombre_grupo}" oninput="state.routineWizard.nombre_grupo = this.value" class="viking-input !h-16 text-2xl font-black italic uppercase">
                    </div>

                    <div class="col-span-full space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Objetivo Técnico</label>
                        <textarea oninput="state.routineWizard.objetivo = this.value" class="viking-input h-32 py-5 text-sm font-medium">${state.routineWizard.objetivo || ''}</textarea>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Metodología</label>
                        <div class="flex gap-4">
                            <button onclick="state.routineWizard.tipo = 'normal'; state.routineWizard.tipo_id = 1; window.renderWizardStep();" 
                                class="flex-1 h-14 rounded-2xl border-2 font-black text-[10px] transition-all 
                                ${state.routineWizard.tipo_id === 1 ? 'bg-red-600 text-black border-red-600' : 'bg-white/5 border-white/5 text-white/30'}">
                                ESTÁNDAR
                            </button>
                            <button onclick="state.routineWizard.tipo = 'progresiva'; state.routineWizard.tipo_id = 2; state.routineWizard.cantSemanas = state.routineWizard.cantSemanas || 4; window.updateRoutineVencimiento(); window.renderWizardStep();" 
                                class="flex-1 h-14 rounded-2xl border-2 font-black text-[10px] transition-all
                                ${state.routineWizard.tipo_id === 2 ? 'bg-amber-600 text-black border-amber-600' : 'bg-white/5 border-white/5 text-white/30'}">
                                PROGRESIVA
                            </button>
                        </div>
                    </div>

                    <div class="space-y-2 ${state.routineWizard.tipo === 'progresiva' ? '' : 'hidden'}">
                        <label class="text-[10px] font-black text-amber-500 uppercase tracking-widest italic ml-2">Semanas</label>
                        <div class="grid grid-cols-4 gap-2">
                            ${[2,4,6,8].map(sw => `
                                <button onclick="state.routineWizard.cantSemanas = ${sw}; window.updateRoutineVencimiento(); window.renderWizardStep();" 
                                    class="h-14 rounded-2xl border-2 font-black transition-all text-xs
                                    ${state.routineWizard.cantSemanas === sw ? 'bg-amber-600 text-black border-amber-600' : 'bg-white/5 border-white/5 text-white/20'}">
                                    ${sw}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Vencimiento</label>
                        <input type="date" id="wizard-vencimiento" value="${state.routineWizard.vencimiento}" oninput="state.routineWizard.vencimiento = this.value" class="viking-input !h-14">
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Días por Semana</label>
                        <div class="grid grid-cols-6 gap-2">
                            ${[1,2,3,4,5,6].map(n => `
                                <button onclick="state.routineWizard.cantDias = ${n}; window.renderWizardStep();" 
                                    class="h-14 rounded-2xl border-2 font-black transition-all
                                    ${state.routineWizard.cantDias === n ? 'bg-red-600 text-black border-red-600' : 'bg-white/5 border-white/5 text-white/20'}">
                                    ${n}
                                </button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
    } else {
        label.innerText = "PASO 2: ASIGNACIÓN DE ARSENAL";
        const isProg = state.routineWizard.tipo === 'progresiva';
        const numSemanas = isProg ? (state.routineWizard.cantSemanas || 4) : 1;
        
        if(!state.routineWizard.semanaActivaWizard) state.routineWizard.semanaActivaWizard = 1;
        if(!state.routineWizard.diaActivoWizard) state.routineWizard.diaActivoWizard = 1;

        const currentKey = isProg 
            ? `week${state.routineWizard.semanaActivaWizard}_day${state.routineWizard.diaActivoWizard}` 
            : `day_${state.routineWizard.diaActivoWizard}`;
        
        const data = state.routineWizard.config[currentKey] || { label: `JORNADA ${state.routineWizard.diaActivoWizard}`, objetivo_dia: '', exercises: [] };

        body.innerHTML = `
            <div class="flex h-full w-full overflow-hidden bg-zinc-950">
                <div class="w-[320px] border-r border-white/5 flex flex-col bg-black/40 shrink-0">
                    <div class="p-6 border-b border-white/5 bg-black/20 space-y-4">
                        <label class="text-[9px] font-black text-red-600 uppercase tracking-[0.3em] block italic">Arsenal Disponible</label>
                        <input type="text" placeholder="BUSCAR EJERCICIO..." 
                            class="viking-input h-12 text-[10px] font-black italic border-white/10 focus:border-red-600" 
                            oninput="window.renderWizardLib(this.value)">
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" id="wizard-lib-results"></div>
                </div>

                <div class="flex-1 flex flex-col min-w-0">
                    ${isProg ? `
                    <div class="px-8 py-4 bg-black/60 border-b border-white/5 flex gap-3 overflow-x-auto no-scrollbar shrink-0">
                        ${Array.from({length: numSemanas}).map((_, i) => {
                            const w = i + 1;
                            const activa = state.routineWizard.semanaActivaWizard === w;
                            return `<button onclick="state.routineWizard.semanaActivaWizard = ${w}; window.renderWizardStep();" 
                                class="px-6 py-3 rounded-xl font-black italic text-[10px] transition-all border-2
                                ${activa ? 'bg-amber-600 text-black border-amber-600 shadow-lg' : 'bg-white/5 text-white/30 border-transparent'}">SEMANA ${w}</button>`;
                        }).join('')}
                    </div>` : ''}

                    <div class="px-8 py-4 bg-zinc-900 border-b border-white/5 flex gap-3 overflow-x-auto no-scrollbar shrink-0">
                        ${Array.from({length: state.routineWizard.cantDias}).map((_, i) => {
                            const d = i + 1;
                            const activa = state.routineWizard.diaActivoWizard === d;
                            return `<button onclick="state.routineWizard.diaActivoWizard = ${d}; window.renderWizardStep();" 
                                class="px-6 py-3 rounded-xl font-black italic text-[10px] transition-all border-2
                                ${activa ? 'bg-red-600 text-black border-red-600 shadow-lg' : 'bg-white/5 text-white/30 border-transparent'}">JORNADA ${d}</button>`;
                        }).join('')}
                    </div>

                    <div id="wizard-main-scroll-area" class="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                        <div class="w-full max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-500">
                            
                            <div class="flex flex-col gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-white/20 uppercase tracking-widest">Título de la Jornada</label>
                                        <input type="text" value="${data.label}" oninput="window.updateSessionData('${currentKey}', 'label', this.value)" 
                                            class="viking-input !bg-black/40 !h-14 !text-sm font-black uppercase italic border-white/10">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-white/20 uppercase tracking-widest">Objetivo del Día</label>
                                        <input type="text" value="${data.objetivo_dia || ''}" oninput="window.updateSessionData('${currentKey}', 'objetivo_dia', this.value)" 
                                            class="viking-input !bg-black/40 !h-14 !text-sm font-medium border-white/10">
                                    </div>
                                </div>
                                
                                <!-- BOTÓN DE CLONACIÓN REINTEGRADO -->
                                ${isProg && state.routineWizard.semanaActivaWizard > 1 ? `
                                <div class="flex justify-end pt-4 border-t border-white/5 relative z-10">
                                    <button onclick="window.clonePrevWeekDay(${state.routineWizard.diaActivoWizard})" 
                                        class="bg-amber-600/20 text-amber-500 border border-amber-600/30 px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic hover:bg-amber-600 hover:text-black transition-all shadow-xl flex items-center gap-2">
                                        <i data-lucide="copy" class="w-4 h-4"></i> CLONAR SEMANA ANTERIOR
                                    </button>
                                </div>` : ''}
                            </div>

                            <div class="space-y-4" id="wizard-exercises-list">
                                ${data.exercises.map((ex, exIdx) => window.renderExerciseItemWizard(currentKey, ex, exIdx)).join('')}
                                ${data.exercises.length === 0 ? `<div class="py-20 border-2 border-dashed border-white/5 rounded-[2.5rem] text-center opacity-20 font-black uppercase italic tracking-[0.3em]">Arsenal Vacío</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        // 🛡️ RESTAURAR SCROLL DERECHO
        const newScrollContainer = document.getElementById('wizard-main-scroll-area');
        if (newScrollContainer) newScrollContainer.scrollTop = currentScroll;

        window.renderWizardLib();
    }
    if (window.lucide) lucide.createIcons();
};

window.updateRoutineVencimiento = function() {
    // Si no es progresiva, no forzamos fecha (o ponemos 30 días por defecto)
    let semanas = state.routineWizard.tipo === 'progresiva' ? state.routineWizard.cantSemanas : 4;
    
    const hoy = new Date();
    // Sumamos los días (semanas * 7)
    hoy.setDate(hoy.getDate() + (semanas * 7));
    
    // Formateamos a YYYY-MM-DD para el input date
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    
    state.routineWizard.vencimiento = `${yyyy}-${mm}-${dd}`;
    
    // Actualizamos el input visualmente si ya existe en el DOM
    const inputVenc = document.getElementById('wizard-vencimiento');
    if (inputVenc) inputVenc.value = state.routineWizard.vencimiento;
};

window.renderExerciseItemWizard = (key, ex, idx) => {
    if (!ex.series_detalle) {
        ex.series_detalle = [{ numero_serie: 1, reps: ex.reps, weight: ex.weight, rest: ex.rest }];
    }

    return `
    <div class="bg-black/60 border border-white/5 rounded-3xl p-6 shadow-xl group hover:border-red-600/30 transition-all" id="ex-card-${ex.uid}">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <span class="w-8 h-8 rounded-xl bg-red-600 text-black text-[10px] flex items-center justify-center font-black italic">${idx + 1}</span>
                <h6 class="text-sm font-black italic uppercase text-white tracking-tighter">${ex.nombre}</h6>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                    <span class="text-[9px] font-black text-white/30 uppercase italic">Series:</span>
                    <input type="number" value="${ex.series || 1}" 
                        onchange="window.updateExFieldWizard('${key}', '${ex.uid}', 'series', this.value)"
                        class="w-8 bg-transparent text-red-500 font-black text-xs outline-none text-center">
                </div>
                <button onclick="window.removeExFromWizard('${key}', '${ex.uid}')" class="text-white/10 hover:text-red-600 transition-colors">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>
        </div>

        <div class="space-y-3" id="series-container-${ex.uid}">
            ${ex.series_detalle.map((s, sIdx) => `
                <div class="grid grid-cols-4 gap-3 items-center bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <div class="text-[10px] font-black text-white/20 ml-2">#${s.numero_serie}</div>
                    <input type="text" value="${s.reps}" oninput="window.updateSerieDetalle('${key}', '${ex.uid}', ${sIdx}, 'reps', this.value)"
                        class="bg-white/5 border border-white/5 rounded-lg text-[11px] font-black italic text-center text-red-600 h-9 outline-none focus:border-red-600 transition-all">
                    <input type="text" value="${s.weight}" oninput="window.updateSerieDetalle('${key}', '${ex.uid}', ${sIdx}, 'weight', this.value)"
                        class="bg-white/5 border border-white/5 rounded-lg text-[11px] font-black italic text-center text-red-600 h-9 outline-none focus:border-red-600 transition-all">
                    <input type="text" value="${s.rest}" oninput="window.updateSerieDetalle('${key}', '${ex.uid}', ${sIdx}, 'rest', this.value)"
                        class="bg-white/5 border border-white/5 rounded-lg text-[11px] font-black italic text-center text-red-600 h-9 outline-none focus:border-red-600 transition-all">
                </div>
            `).join('')}
        </div>
    </div>`;
};

window.renderWizardLib = (query = '') => {
    const container = document.getElementById('wizard-lib-results');
    if (!container) return;
    
    // 🛡️ CAPTURAR SCROLL IZQUIERDO
    const currentScroll = container.scrollTop;

    const filtered = (state.ejerciciosLibreria || []).filter(e => e.nombre.toLowerCase().includes(query.toLowerCase()));
    const groups = {};
    filtered.forEach(e => { 
        const g = e.grupo_muscular?.nombre || 'General'; 
        if (!groups[g]) groups[g] = []; 
        groups[g].push(e); 
    });
    
    container.innerHTML = Object.entries(groups).map(([name, exs]) => `
        <div>
            <h5 class="text-[9px] font-black text-red-600 uppercase tracking-widest mb-4 ml-2 italic border-l-2 border-red-600 pl-3">${name}</h5>
            <div class="space-y-2">
                ${exs.map(e => `
                    <button onclick="window.addExToWizard(${e.id}, '${e.nombre}')" 
                        class="w-full flex justify-between items-center p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[11px] font-black uppercase italic text-white/50 hover:bg-red-600 hover:text-black transition-all group">
                        ${e.nombre} <i data-lucide="plus" class="w-4 h-4 opacity-0 group-hover:opacity-100"></i>
                    </button>`).join('')}
            </div>
        </div>`).join('');

    // 🛡️ RESTAURAR SCROLL IZQUIERDO
    container.scrollTop = currentScroll;
    if (window.lucide) lucide.createIcons();
};

window.toggleWizardDay = (key) => { 
    state.routineWizard.activeDayKey = (state.routineWizard.activeDayKey === key) ? null : key; 
    window.renderWizardStep(); 
};

window.addExToWizard = (id, nombre) => {
    const isProg = state.routineWizard.tipo === 'progresiva';
    const key = isProg 
        ? `week${state.routineWizard.semanaActivaWizard}_day${state.routineWizard.diaActivoWizard}` 
        : `day_${state.routineWizard.diaActivoWizard}`;

    if (!state.routineWizard.config[key]) state.routineWizard.config[key] = { label: `JORNADA`, exercises: [] };
    
    state.routineWizard.config[key].exercises.push({ 
        id, 
        uid: Math.random().toString(36).substr(2, 9), 
        nombre,
        series: '3', 
        reps: '12', 
        weight: '0', 
        rest: '90s', 
        comentario: '' 
    });
    window.renderWizardStep();
};

window.clonePrevWeekDay = (dayNum) => {
    const curW = state.routineWizard.semanaActivaWizard;
    if (curW <= 1) return;
    
    const srcKey = `week${curW-1}_day${dayNum}`;
    const src = state.routineWizard.config[srcKey];
    
    if (!src || !src.exercises || src.exercises.length === 0) {
        return showVikingToast("No hay arsenal en la semana anterior", true);
    }
    
    const targetKey = `week${curW}_day${dayNum}`;
    state.routineWizard.config[targetKey] = JSON.parse(JSON.stringify(src));
    
    // Generar nuevos UIDs para que las referencias no se pisen
    state.routineWizard.config[targetKey].exercises.forEach(e => {
        e.uid = Math.random().toString(36).substr(2, 9);
    });

    window.renderWizardStep();
    showVikingToast(`Arsenal de Semana ${curW-1} clonado correctamente.`);
};

window.updateSessionData = (key, f, v) => { 
    if (!state.routineWizard.config[key]) state.routineWizard.config[key] = { label: '', exercises: [] }; 
    state.routineWizard.config[key][f] = v; 
};

window.updateExFieldWizard = (key, uid, f, v) => {
    const ex = state.routineWizard.config[key].exercises.find(e => e.uid === uid);
    if (!ex) return;

    if (f === 'series') {
        const nuevaCant = parseInt(v) || 1;
        const seriesActuales = ex.series_detalle || [];
        
        if (nuevaCant > seriesActuales.length) {
            for (let i = seriesActuales.length; i < nuevaCant; i++) {
                const base = seriesActuales[seriesActuales.length - 1] || { reps: '12', weight: '0', rest: '90s' };
                seriesActuales.push({ numero_serie: i + 1, reps: base.reps, weight: base.weight, rest: base.rest });
            }
        } else if (nuevaCant < seriesActuales.length) {
            ex.series_detalle = seriesActuales.slice(0, nuevaCant);
        }
        ex.series = nuevaCant;
        // Solo aquí re-renderizamos la lista de ejercicios porque cambió la estructura de la tarjeta
        window.renderWizardStep(); 
    } else {
        ex[f] = v;
    }
};

window.removeExFromWizard = (key, uid) => { 
    state.routineWizard.config[key].exercises = state.routineWizard.config[key].exercises.filter(e => e.uid !== uid); 
    window.renderWizardStep(); 
};

window.nextStep = () => {
    if (state.routineWizard.currentStep === 1) {
        if (!state.routineWizard.nombre_grupo) return showVikingToast("Asigna un nombre al plan", true);
        state.routineWizard.currentStep = 2;
        state.routineWizard.activeDayKey = state.routineWizard.tipo === 'progresiva' ? 'week1_day1' : 'day_1';
        window.renderWizardStep();
    } else { 
        window.saveFinalRutina(); 
    }
};

window.prevStep = () => { 
    if (state.routineWizard.currentStep === 2) { 
        state.routineWizard.currentStep = 1; 
        window.renderWizardStep(); 
    } 
};

/**
 * 4. PERSISTENCIA FINAL (SINCRONIZADA CON MAIN.PY)
 */
window.saveFinalRutina = async function() {
    const config = state.routineWizard.config;
    const isProg = state.routineWizard.tipo_id === 2;
    const processedDays = [];
    
    // Determinamos la cantidad de semanas según el tipo de rutina
    // Si es normal, es 1 semana. Si es progresiva, usamos el selector dinámico.
    const totalSemanas = isProg ? (state.routineWizard.cantSemanas || 4) : 1;

    // Iteramos por los días definidos en el Wizard (cantDias)
    for (let dNum = 1; dNum <= state.routineWizard.cantDias; dNum++) {
        const ejerciciosDia = [];
        
        if (isProg) {
            // Recolectamos ejercicios de todas las semanas para este día específico
            // Cambiamos el "5" fijo por la variable totalSemanas elegida en el paso 1
            for (let wNum = 1; wNum <= totalSemanas; wNum++) {
                const session = config[`week${wNum}_day${dNum}`];
                if (session && session.exercises) {
                    session.exercises.forEach(ex => {
                        ejerciciosDia.push({
                            ejercicio_id: ex.id,
                            semana_id: wNum, // Aquí se asigna dinámicamente la semana 2, 4, 6 u 8
                            comentario: ex.comentario || '',
                            series: ex.series_detalle.map(s => ({
								numero_serie: s.numero_serie,
								repeticiones: s.reps,
								peso: s.weight,
								descanso: s.rest
							})),
                            progreso_json: null // El backend espera un objeto o null
                        });
                    });
                }
            }
        } else {
            // Rutina normal: solo recolectamos el día correspondiente (Semana 1)
            const session = config[`day_${dNum}`];
            if (session && session.exercises) {
                session.exercises.forEach(ex => {
                    ejerciciosDia.push({
                        ejercicio_id: ex.id,
                        semana_id: 1, // Por defecto semana 1 en rutinas estándar
                        comentario: ex.comentario || '',
                        series: ex.series_detalle.map(s => ({
							numero_serie: s.numero_serie,
							repeticiones: s.reps,
							peso: s.weight,
							descanso: s.rest
						})),
                        progreso_json: null
                    });
                });
            }
        }

        // Definimos el nombre de la jornada (ej: "Pecho y Tríceps")
        const dName = (config[isProg ? `week1_day${dNum}` : `day_${dNum}`]?.label) || `Jornada ${dNum}`;
        
        processedDays.push({ 
            nombre_dia: dName, 
            ejercicios: ejerciciosDia 
        });
    }

    // Payload exacto según PlanRutinaCreate en el backend (main.py)
    const payload = {
        usuario_id: state.routineWizard.alumnoId,
        nombre_grupo: state.routineWizard.nombre_grupo, 
        objetivo: state.routineWizard.nombre_grupo, // Mantenemos por compatibilidad con el modelo
        descripcion: state.routineWizard.objetivo,  // El resumen técnico del ciclo
        tipo: state.routineWizard.tipo,
        fecha_vencimiento: state.routineWizard.vencimiento, // Esta fecha ya viene calculada por updateRoutineVencimiento
        dias: processedDays
    };

    // Notificación visual de inicio de forja
    showVikingToast("Sincronizando arsenal con la base de datos...");

    const res = await apiFetch('/rutinas/plan', 'POST', payload);
    
    if (!res.error) {
        showVikingToast("¡Arsenal vikingo forjado correctamente! ⚔️");
        
        // Cerramos el modal y refrescamos las vistas
        closeModal('modal-rutina-editor');
        
        // Actualizamos la lista de alumnos y rutinas para ver los cambios
        if(typeof fetchAlumnos === 'function') fetchAlumnos();
        if(typeof renderRutinas === 'function') renderRutinas();
        
    } else {
        showVikingToast("Error en la forja: " + res.error, true);
    }
};

window.updateSerieDetalle = (key, uid, sIdx, campo, valor) => {
    const ex = state.routineWizard.config[key].exercises.find(e => e.uid === uid);
    if (ex && ex.series_detalle[sIdx]) {
        ex.series_detalle[sIdx][campo] = valor;
        // NO RENDERIZAMOS NADA, solo guardamos el dato en memoria.
    }
};

/**
 * 5. VISTAS Y FILTROS
 */
window.renderRutinas = async function() {
    const rol = (state.user?.rol_nombre || "").toLowerCase();
    const list = document.getElementById('rutinas-lista');
    const studentView = document.getElementById('musculacion-student-view');
    const titleEl = document.getElementById('rutina-title');
    
    if (rol === "alumno") {
        if(list) list.parentElement.parentElement.classList.add('hidden');
        if(studentView) studentView.classList.remove('hidden');
        if(titleEl) titleEl.innerText = "MI ENTRENAMIENTO";
        window.openFichaTecnica(state.user.id);
    } else {
        if(studentView) studentView.classList.add('hidden');
        if(list) list.parentElement.parentElement.classList.remove('hidden');
        if(titleEl) titleEl.innerText = "CENTRAL DE ARSENAL";
        window.filterRutinas('todos');
    }
};

window.renderRutinasList = function(listaDatos) {
    const contenedor = document.getElementById('rutinas-lista');
    if(!contenedor) return;
    
    // Guardamos para que la paginación funcione
    state.routineWizard.filteredAlumnos = listaDatos;

    // --- ACTUALIZACIÓN DE ESTADÍSTICAS ---
    const total = state.alumnos.filter(a => {
		const nombrePlan = (a.plan?.nombre || "").toLowerCase().trim();
		return nombrePlan.includes('musculacion') || nombrePlan.includes('completo') || nombrePlan.includes('personalizado') || nombrePlan === 'premium';
	}).length;
    
    const conRutina = state.alumnos.filter(a => (a.planes_rutina && a.planes_rutina.length > 0)).length;
    const sinRutina = total - conRutina;

    if (document.getElementById('stats-rutinas-total')) document.getElementById('stats-rutinas-total').innerText = total;
    if (document.getElementById('stats-rutinas-cargados')) document.getElementById('stats-rutinas-cargados').innerText = conRutina;
    if (document.getElementById('stats-rutinas-pendientes')) document.getElementById('stats-rutinas-pendientes').innerText = sinRutina;
    if (document.getElementById('stats-rutinas-pagina')) document.getElementById('stats-rutinas-pagina').innerText = state.routineWizard.currentPage;

    // --- LÓGICA DE PAGINACIÓN ---
    const totalItems = listaDatos.length;
    const totalPages = Math.ceil(totalItems / state.routineWizard.itemsPerPage);
    const inicio = (state.routineWizard.currentPage - 1) * state.routineWizard.itemsPerPage;
    const fin = inicio + state.routineWizard.itemsPerPage;
    const listaPaginada = listaDatos.slice(inicio, fin);

    if (listaPaginada.length === 0) {
        contenedor.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-white/20 py-10">
                <i data-lucide="dumbbell" class="w-12 h-12 mb-2"></i>
                <p class="text-xs font-black uppercase italic tracking-widest">Sin atletas en el arsenal</p>
            </div>`;
        renderRutinasPagination(0);
        if(window.lucide) lucide.createIcons();
        return;
    }

    contenedor.innerHTML = listaPaginada.map(a => {
        const initials = getVikingInitials(a);
        const tieneRutina = a.planes_rutina && a.planes_rutina.length > 0;
        const activa = tieneRutina ? a.planes_rutina.find(r => r.activo) : null;
        
        const colorEstado = tieneRutina ? 'bg-green-600' : 'bg-red-600'; 
        const textoEstado = tieneRutina ? 'CARGADO' : 'PENDIENTE';
        const colorBadge = tieneRutina ? 'text-green-500 bg-green-500/10 border-green-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20';

        return `
        <div class="glass-card p-5 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center gap-6 hover:border-red-600/20 transition-all group relative overflow-hidden mb-3">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${colorEstado} opacity-40 group-hover:opacity-100 transition-opacity"></div>
            
            <div class="flex items-center gap-4 w-full md:w-1/3">
                <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-lg italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors shrink-0">
                    ${initials}
                </div>
                <div class="overflow-hidden">
                    <h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors truncate">${a.nombre_completo}</h4>
                    <div class="flex flex-col mt-1">
                        <p class="text-[10px] text-white/30 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                            <i data-lucide="id-card" class="w-3 h-3"></i> ${a.dni}
                        </p>
                        <p class="text-[10px] text-white/30 font-bold flex items-center gap-1.5 uppercase tracking-widest truncate">
                            <i data-lucide="ticket" class="w-3 h-3"></i> ${a.plan?.nombre || 'SIN PLAN'}
                        </p>
                    </div>
                </div>
            </div>

            <div class="flex-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                        <p class="text-[9px] text-white/20 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 italic">
                            <i data-lucide="dumbbell" class="w-3 h-3 text-red-600"></i> Plan Musculación
                        </p>
                        <p class="text-sm font-black uppercase italic text-white truncate">
                            ${activa ? (activa.nombre_grupo || activa.objetivo) : 'SIN ASIGNAR'}
                        </p>
                    </div>
                    <div class="flex flex-row md:flex-col items-center md:items-start justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${colorBadge} italic">
                                ${textoEstado}
                            </span>
                        </div>
                        <p class="text-[10px] text-white/20 font-bold italic flex items-center gap-1 uppercase tracking-tighter">
                            Venc: <span class="text-white">${activa ? (activa.fecha_vencimiento || 'N/A') : 'N/A'}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-3 min-w-[120px] border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                <button onclick="window.openFichaTecnica(${a.id})" class="h-12 w-12 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all border border-white/5" title="Ver Arsenal">
                    <i data-lucide="clipboard-list" class="w-5 h-5"></i>
                </button>
                <button onclick="window.openRoutineEditor(${a.id})" class="viking-bg-red text-black px-6 py-3 rounded-xl font-black uppercase italic text-[10px] shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                    <span>Arsenal</span>
                </button>
            </div>
        </div>`;
    }).join('');
    
    renderRutinasPagination(totalPages);
    if(window.lucide) lucide.createIcons();
};

window.filterRutinas = function(filtro) {
    if(!state.alumnos) return;
    state.routineWizard.currentPage = 1; // Reset al filtrar
    
    document.querySelectorAll('.filter-btn-rutina').forEach(btn => {
        btn.classList.remove('bg-red-600', 'text-black');
        btn.classList.add('text-white/30');
    });
    
    const activeBtn = document.getElementById('filter-rutina-' + filtro);
    if(activeBtn) {
        activeBtn.classList.remove('text-white/30');
        activeBtn.classList.add('bg-red-600', 'text-black');
    }

    const hoy = new Date().toISOString().split('T')[0];
    
    let base = state.alumnos.filter(a => {
		const nombrePlan = (a.plan?.nombre || "").toLowerCase().trim();
		return nombrePlan.includes('musculacion') || nombrePlan.includes('completo') || nombrePlan.includes('personalizado') || nombrePlan === 'premium';
	});

    let filtrados = base;
    if(filtro === 'con') filtrados = base.filter(a => (a.planes_rutina && a.planes_rutina.length > 0));
    if(filtro === 'sin') filtrados = base.filter(a => !(a.planes_rutina && a.planes_rutina.length > 0));
    if(filtro === 'vencidas') filtrados = base.filter(a => a.rutina_vencimiento && a.rutina_vencimiento < hoy);

    window.renderRutinasList(filtrados);
};

window.searchAlumnoRutina = function(query) {
    if(!query) { window.filterRutinas('todos'); return; }
    state.routineWizard.currentPage = 1;
    const q = query.toLowerCase().trim();
    const filtrados = (state.alumnos || []).filter(a => {
		const matchSearch = (a.nombre_completo || "").toLowerCase().includes(q) || (a.dni || "").includes(q);
		const nombrePlan = (a.plan?.nombre || "").toLowerCase().trim();
		const esMusc = nombrePlan.includes('musculacion') || nombrePlan.includes('completo') || nombrePlan.includes('personalizado') || nombrePlan === 'premium';
		return matchSearch && esMusc;
	});
    window.renderRutinasList(filtrados);
};

function renderRutinasPagination(totalPages) {
    const container = document.getElementById('rutinas-pagination');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button onclick="changeRutinasPage(${state.routineWizard.currentPage - 1})" ${state.routineWizard.currentPage === 1 ? 'disabled' : ''} 
            class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-red-600 hover:text-black transition-all disabled:opacity-20 disabled:pointer-events-none">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= state.routineWizard.currentPage - 1 && i <= state.routineWizard.currentPage + 1)) {
            html += `
                <button onclick="changeRutinasPage(${i})" 
                    class="w-10 h-10 rounded-xl font-black italic text-xs transition-all 
                    ${state.routineWizard.currentPage === i ? 'bg-red-600 text-black shadow-lg shadow-red-900/20' : 'bg-white/5 text-white/40 hover:text-white'}">
                    ${i}
                </button>
            `;
        } else if (i === state.routineWizard.currentPage - 2 || i === state.routineWizard.currentPage + 2) {
            html += `<span class="text-white/10">...</span>`;
        }
    }

    html += `
        <button onclick="changeRutinasPage(${state.routineWizard.currentPage + 1})" ${state.routineWizard.currentPage === totalPages ? 'disabled' : ''} 
            class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-red-600 hover:text-black transition-all disabled:opacity-20 disabled:pointer-events-none">
            <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
    `;

    container.innerHTML = html;
    if(window.lucide) lucide.createIcons();
}

window.changeRutinasPage = function(page) {
    state.routineWizard.currentPage = page;
    window.renderRutinasList(state.routineWizard.filteredAlumnos);
};

// =========================================================
// 4. GUARDADO DE RUTINA (FIX: ACTIVACIÓN Y PERSISTENCIA)
// =========================================================
const editorForm = document.getElementById('form-rutina-editor');
if (editorForm) {
    editorForm.onsubmit = async (e) => {
        e.preventDefault();
        const alumnoId = document.getElementById('rutina-editor-alumno-id').value;
        
        const dias = [];
        document.querySelectorAll('.rutina-dia-card').forEach(dayCard => {
            const ejercicios = [];
            dayCard.querySelectorAll('.exercise-row').forEach(exRow => {
                const series = [];
                exRow.querySelectorAll('.serie-row').forEach(sRow => {
                    series.push({
                        numero_serie: parseInt(sRow.dataset.serieNum),
                        repeticiones: sRow.querySelector('.serie-reps').value,
                        peso: sRow.querySelector('.serie-weight').value,
                        descanso: sRow.querySelector('.serie-rest').value
                    });
                });

                ejercicios.push({
                    ejercicio_id: parseInt(exRow.querySelector('.exercise-id').value) || null,
                    exercise_name: exRow.querySelector('.text-[13px]')?.innerText || "Ejercicio", 
                    series_detalle: series,
                    comentario: exRow.querySelector('.exercise-comment')?.value || ""
                });
            });

            dias.push({
                nombre_dia: dayCard.querySelector('.day-title').value,
                ejercicios: ejercicios
            });
        });

        const payload = {
            usuario_id: parseInt(alumnoId),
            objetivo: document.getElementById('rutina-objetivo').value,
            fecha_vencimiento: document.getElementById('rutina-vencimiento').value,
            activo: true, // <--- INDISPENSABLE PARA QUE QUEDE ACTIVA
            dias: dias
        };

        const res = await apiFetch('/rutinas', 'POST', payload);
        
        if(!res.error) {
            closeModal('modal-rutina-editor');
            showVikingToast("¡Arsenal de combate actualizado!");
            if (typeof fetchAlumnos === 'function') await fetchAlumnos();
            renderRutinas();
        } else {
            showVikingToast("Error al forjar la rutina: " + res.error, true);
        }
    };
}

        async function apiFetch(endpoint, method = 'GET', body = null) {
			const token = localStorage.getItem('viking_token');
			const headers = { 'Content-Type': 'application/json' };
			
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const options = { method, headers };
			if (body) options.body = JSON.stringify(body);
			
			try {
				console.log(`[API FETCH] ${method} ${endpoint}`, body || ""); // Log para debuguear
				const res = await fetch(`${API_BASE}${endpoint}`, options);
				
				// 1. Manejo de sesión expirada
				if (res.status === 401) {
					console.error("Sesión expirada detectada en:", endpoint);
					localStorage.removeItem('viking_token');
					location.reload();
					return { error: "Sesión expirada" };
				}

				// 2. LEER EL CUERPO
				const responseText = await res.text();
				let responseData;
				
				try {
					responseData = JSON.parse(responseText);
				} catch (e) {
					responseData = { error: responseText || "Error de formato en servidor" };
				}

				// 3. Manejo de Errores (400, 500, etc.)
				if (!res.ok) {
					const errorMsg = responseData.detail || responseData.error || `Error ${res.status}`;
					console.error(`[API ERROR] ${endpoint}:`, errorMsg);
					
					// 🔥 CORRECCIÓN IMPORTANTE: Devolvemos el objeto completo con un flag de error
					// en lugar de solo devolver un string, para no romper las interfaces que esperan datos.
					return { error: errorMsg, status: "ERROR", data: responseData };
				}

				return responseData;
			} catch (e) { 
				console.error("Error Crítico de Conexión:", e);
				return { error: "Error de conexión con el servidor" }; 
			}
		}

		// 3. LÓGICA DE BLOQUEO Y VENCIMIENTO (NUEVAS FUNCIONES)
		/**
		* Controla si se muestra el bloqueo total o el aviso preventivo.
		*/
		function checkUserMembresia(currentView = 'dashboard') {
			const user = state.user;
			if (!user || user.rol_nombre.toLowerCase() !== 'alumno') {
				const overlay = document.getElementById('bloqueo-vencimiento');
				if (overlay) overlay.classList.add('hidden');
				return;
			}

			const isExpired = user.is_expired;
			const diasRestantes = user.dias_restantes;
			const overlay = document.getElementById('bloqueo-vencimiento');

			// CASO A: PLAN VENCIDO (BLOQUEO TOTAL)
			if (isExpired) {
				// Solo permitimos ver el PERFIL para que el alumno vea sus datos
				if (currentView === 'perfil') {
					if (overlay) overlay.classList.add('hidden');
				} else {
					if (overlay) overlay.classList.remove('hidden');
				}
			} else {
				// Si no está vencido, ocultamos el bloqueo
				if (overlay) overlay.classList.add('hidden');

				// CASO B: PLAN POR VENCER (AVISO PREVENTIVO)
				// Si quedan 3 días o menos, mostramos el modal amarillo una vez por sesión
				if (diasRestantes >= 0 && diasRestantes <= 3) {
					if (!sessionStorage.getItem('aviso_vencimiento_mostrado')) {
						const labelDias = document.getElementById('aviso-vencimiento-dias');
						if (labelDias) labelDias.innerText = diasRestantes === 0 ? "HOY MISMO" : diasRestantes;
						
						// Pequeño delay para que no choque con la carga del dashboard
						setTimeout(() => openModal('modal-aviso-vencimiento'), 1200);
						sessionStorage.setItem('aviso_vencimiento_mostrado', 'true');
					}
				}
			}
		}

        function calculateIMC() {
            const peso = parseFloat(document.getElementById('al-peso').value);
            const alturaCm = parseFloat(document.getElementById('al-altura').value);
            if (peso > 5 && alturaCm > 50) {
                const alturaM = alturaCm / 100;
                document.getElementById('al-imc').value = (peso / (alturaM * alturaM)).toFixed(2);
            } else document.getElementById('al-imc').value = "";
        }

        function calculateIMCProfile() {
            const peso = parseFloat(document.getElementById('prof-input-peso').value);
            const alturaCm = parseFloat(document.getElementById('prof-input-altura').value);
            if (peso > 5 && alturaCm > 50) {
                const alturaM = alturaCm / 100;
                document.getElementById('prof-input-imc').value = (peso / (alturaM * alturaM)).toFixed(2);
            } else document.getElementById('prof-input-imc').value = "";
        }

        function toggleSidebar() { document.getElementById('sidebar').classList.toggle('sidebar-collapsed'); lucide.createIcons(); }
        function toggleSub(id) { document.getElementById(id).classList.toggle('hidden'); }
        function openModal(id) { document.getElementById(id).style.display = 'flex'; }
        function closeModal(id) {
			const modal = document.getElementById(id);
			if (modal) {
				modal.style.display = 'none'; // ELIMINA EL BLOQUEO INLINE
				modal.classList.add('hidden');
				modal.classList.remove('flex');
				
				// Reset de formularios si existen dentro
				const form = modal.querySelector('form');
				if (form) form.reset();
			}
		}

		/**
		* ACTUALIZACIÓN DE SWITCHVIEW
		* Asegúrate de que al cambiar a esta vista, traiga los datos.
		*/

		if (typeof window.switchView === 'function' && !window.switchView.isVikingo) {
				window.originalSwitchView = window.switchView;
			}

		const originalSwitchView = window.switchView;

        window.switchView = function(view) {
			console.log(`🚀 Navegando a: ${view}`);

			// --- 1. LÓGICA DE OCULTACIÓN (DOM) ---
			document.querySelectorAll('.view-content').forEach(v => {
				v.classList.remove('active');
				v.classList.add('hidden');
				v.style.setProperty('display', 'none', 'important'); 
			});

			const layouts = ['admin-dashboard-layout', 'alumno-dashboard-layout', 'view-professor-dashboard'];
			layouts.forEach(id => {
				const l = document.getElementById(id);
				if (l) {
					l.classList.add('hidden');
					l.style.setProperty('display', 'none', 'important');
				}
			});

			document.querySelectorAll('.nav-btn, .nav-item').forEach(b => b.classList.remove('active'));

			// --- 2. SELECCIÓN DE TARGET POR ROL ---
			let targetId = 'view-' + view;
			const rol = (state.user?.rol_nombre || "").toLowerCase();

			if (view === 'dashboard') {
				if (rol === "alumno") {
					targetId = 'view-dashboard';
					const aluLayout = document.getElementById('alumno-dashboard-layout');
					if (aluLayout) aluLayout.style.setProperty('display', 'block', 'important');
					if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
				} 
				else if (rol === "profesor") {
					targetId = 'view-professor-dashboard'; 
					const profView = document.getElementById('view-professor-dashboard');
					if (profView) profView.style.setProperty('display', 'block', 'important');
					if (typeof loadProfessorDashboard === 'function') loadProfessorDashboard();
				} 
				else {
					targetId = 'view-dashboard';
					const adminLayout = document.getElementById('admin-dashboard-layout');
					if (adminLayout) adminLayout.style.setProperty('display', 'block', 'important');
					if (typeof loadDashboard === 'function') loadDashboard();
				}
			}

			// --- 3. MOSTRAR VISTA FINAL ---
			const targetView = document.getElementById(targetId);
			if (targetView) {
				targetView.classList.add('active');
				targetView.classList.remove('hidden');
				targetView.style.setProperty('display', (view === 'dashboard' ? 'block' : 'flex'), 'important'); 
			}

			const n = document.getElementById('nav-' + view); 
			if (n) n.classList.add('active');
			
			const titleEl = document.getElementById('view-title');
			if (titleEl) titleEl.innerText = view.replace('-', ' ').toUpperCase();

			// --- 4. LÓGICA DE NEGOCIO Y CARGA DE DATOS ---

			if (typeof checkUserMembresia === 'function') checkUserMembresia(view);

			// Sección Mi Perfil
			if (view === 'perfil' && state.user) {
				const u = state.user;
				const initials = u.nombre_completo ? u.nombre_completo.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase() : "??";
				
				const nameHeader = document.getElementById('prof-name');
				const roleHeader = document.getElementById('prof-role');
				if (nameHeader) nameHeader.innerText = u.nombre_completo || "Usuario Vikingo";
				if (roleHeader) roleHeader.innerText = u.rol_nombre || "Staff";
				
				const elInitials = document.getElementById('user-initials');
				const elInitialsView = document.getElementById('prof-initials-view');
				if (elInitials) elInitials.innerText = initials;
				if (elInitialsView) elInitialsView.innerText = initials;
				
				const inputName = document.getElementById('prof-input-name');
				const inputDni = document.getElementById('prof-input-dni');
				const inputEmail = document.getElementById('prof-input-email');
				if (inputName) inputName.value = u.nombre_completo || "";
				if (inputDni) inputDni.value = u.dni || "";
				if (inputEmail) inputEmail.value = u.email || "";

				const fisicos = document.getElementById('perfil-datos-fisicos');
				if (fisicos) {
					if (rol === "alumno") {
						fisicos.classList.remove('hidden');
						fisicos.style.setProperty('display', 'grid', 'important');
						document.getElementById('prof-input-peso').value = u.peso || "";
						document.getElementById('prof-input-altura').value = u.altura || "";
						document.getElementById('prof-input-imc').value = u.imc || "";
					} else {
						fisicos.classList.add('hidden');
						fisicos.style.setProperty('display', 'none', 'important');
					}
				}
			}

			// Calendario
			if (view === 'calendario' && typeof renderCalendar === 'function') {
				renderCalendar();
				const isAdmin = (state.user?.rol_nombre === "Administrador" || state.user?.rol_nombre === "Supervisor");
				const panelFeriados = document.getElementById('admin-feriados-panel');
				if (panelFeriados) {
					if (isAdmin) {
						panelFeriados.classList.remove('hidden');
						panelFeriados.style.setProperty('display', 'block', 'important');
					} else {
						panelFeriados.classList.add('hidden');
						panelFeriados.style.setProperty('display', 'none', 'important');
					}
				}
			}

			if (view === 'cobrar' && typeof renderCobrar === 'function') renderCobrar();
			
			// ⚔️ CORRECCIÓN: Llamada con pequeño retardo para asegurar que la sesión esté cargada
			if (view === 'acceso-virtual') {
				console.log("📥 Solicitando carga de accesos...");
				setTimeout(() => {
					if (typeof fetchAccesos === 'function') {
						fetchAccesos();
					} else if (typeof renderAccesos === 'function') {
						renderAccesos();
					}
				}, 100); // Espera 100ms a que el DOM y el estado se estabilicen
			}
			
			if (view === 'rutinas' && typeof renderRutinas === 'function') renderRutinas();

			if (view === 'alumnos') {
				if (typeof renderAlumnosSection === 'function') renderAlumnosSection();
				if (typeof fetchAlumnos === 'function') fetchAlumnos();
				if (typeof loadSucursales === 'function') loadSucursales();
			}

			if (view === 'sucursales' && typeof loadSucursales === 'function') loadSucursales();

			if (view === 'merca' && typeof fetchStock === 'function') fetchStock();

			if (typeof applyPermissions === 'function') applyPermissions();
			if (window.lucide) {
				setTimeout(() => lucide.createIcons(), 50);
			}
		};

		window.switchView.isVikingo = true;
		console.log("✅ Sistema de navegación extendido correctamente.");

		async function handleLogin(e) {
			if (e && e.preventDefault) e.preventDefault();

			const dniInput = document.getElementById('login-dni');
			const passInput = document.getElementById('login-pass');
			const errorDiv = document.getElementById('login-error');
			const loginBtn = document.getElementById('login-button');

			if (!dniInput || !passInput) return;

			if (loginBtn) {
				loginBtn.disabled = true;
				loginBtn.innerText = "VERIFICANDO...";
			}

			const data = {
				dni: dniInput.value,
				password: passInput.value
			};

			try {
				const res = await apiFetch('/login', 'POST', data);

				if (res && !res.error) {
					// 1. SETEAR EL ESTADO GLOBAL DE INMEDIATO
					state.user = res; 

					// 2. GUARDAR EN STORAGE
					if (res.access_token) {
						localStorage.setItem('viking_token', res.access_token);
					}
					localStorage.setItem('viking_user', JSON.stringify(res));

					// 3. UI Y SIDEBAR
					document.getElementById('login-overlay').style.display = 'none';
					document.getElementById('sidebar').classList.remove('hidden');
					document.getElementById('main-content').classList.remove('hidden');

					const elName = document.getElementById('side-user-name');
					if (elName) elName.innerText = state.user.nombre_completo || "Usuario";

					const elRole = document.getElementById('side-user-role');
					if (elRole) elRole.innerText = state.user.rol_nombre || 'Staff';

					const name = state.user.nombre_completo || "Usuario Vikingo";
					const initials = name.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().substring(0, 2);
					const elInitials = document.getElementById('user-initials');
					if (elInitials) elInitials.innerText = initials;

					// 4. CARGA SECUENCIAL
					await loadProfesores();

					if (typeof initApp === 'function') {
						await initApp(); 
					} else {
						if (typeof loadClases === 'function') await loadClases();
						if (typeof loadStock === 'function') await loadStock();
					}

					// ⚔️ EVENTOS VIKINGOS: Chequeamos cumples al iniciar sesión
					if (typeof checkVikingBirthdays === 'function') {
						setTimeout(() => {
							checkVikingBirthdays();
						}, 500); 
					}

					// 5. NAVEGACIÓN
					switchView('dashboard');

					if (state.user.rol_nombre === "Alumno" && typeof renderStudentDashboard === 'function') {
						await renderStudentDashboard();
					}
					
					if (state.user.rol_nombre === "Profesor" && typeof loadProfessorDashboard === 'function') {
						await loadProfessorDashboard();
					}

					if (window.lucide) lucide.createIcons();
					showVikingToast(`¡Bienvenido, ${state.user.nombre_completo.split(' ')[0]}!`);

				} else {
					if (errorDiv) {
						errorDiv.innerText = res.error || "Credenciales incorrectas";
						errorDiv.classList.remove('hidden');
					}
					if (loginBtn) {
						loginBtn.disabled = false;
						loginBtn.innerText = "Ingresar";
					}
				}
			} catch (err) {
				console.error("Error en el login:", err);
				showVikingToast("Error de conexión", true);
				if (loginBtn) {
					loginBtn.disabled = false;
					loginBtn.innerText = "Ingresar";
				}
			}
		}



		window.toggleCamposGasto = function(tipo) {
			const groupCompra = document.getElementById('campos-compra-mercaderia');
			const containerDesc = document.getElementById('container-desc-gasto');
			const inputDesc = document.getElementById('input-desc-gasto');

			if (tipo === 'Compra') {
				// En compra ocultamos el campo de descripción manual
				if (groupCompra) groupCompra.classList.remove('hidden');
				if (containerDesc) containerDesc.classList.add('hidden');
				if (inputDesc) inputDesc.required = false;
				
				// Llenar productos en el select si existen en el estado
				const select = document.getElementById('input-producto-stock');
				if(select && window.state && window.state.stock) {
					select.innerHTML = window.state.stock.map(p => `<option value="${p.id}">${p.nombre_producto}</option>`).join('');
				}
			} else {
				// En egreso manual mostramos la descripción
				if (groupCompra) groupCompra.classList.add('hidden');
				if (containerDesc) containerDesc.classList.remove('hidden');
				if (inputDesc) inputDesc.required = true;
			}
		};

		window.loadCaja = async function() {
			const inputDesde = document.getElementById('caja-filtro-desde');
			const inputHasta = document.getElementById('caja-filtro-hasta');
			const inputDescFiltro = document.getElementById('caja-filtro-desc');
			const inputDetalleFiltro = document.getElementById('caja-filtro-detalle');
			
			// ⚔️ CAPTURA DE SUCURSAL: Clave para el perfil Administrador
			const sucursalSelect = document.getElementById('caja-filtro-sucursal');
			const sucursalIdVal = sucursalSelect ? sucursalSelect.value : "";

			// Muestra u oculta el contenedor en base al rol guardado en localStorage
			const datosUsuario = JSON.parse(localStorage.getItem('viking_user') || '{}');
			const nombreRol = (datosUsuario.rol_nombre || "").toLowerCase().trim();
			const contenedorSucursal = document.getElementById('contenedor-filtro-sucursal-caja');
			
			if (contenedorSucursal) {
				if (["administrador", "admin", "dueño", "supervisor"].includes(nombreRol)) {
					contenedorSucursal.classList.remove('hidden');
				} else {
					contenedorSucursal.classList.add('hidden');
				}
			}

			// 1. Seteo de HOY en formato LOCAL YYYY-MM-DD
			const timezoneOffset = new Date().getTimezoneOffset() * 60000;
			const hoyLocal = new Date(Date.now() - timezoneOffset).toISOString().split('T')[0];
			
			if (inputDesde && !inputDesde.value) inputDesde.value = hoyLocal;
			if (inputHasta && !inputHasta.value) inputHasta.value = hoyLocal;

			// 2. CONSTRUCCIÓN DE URL CON FILTROS DE SERVIDOR
			const fDesde = inputDesde.value;
			const fHasta = inputHasta.value;
			let url = `/caja/movimientos?fecha_desde=${fDesde}&fecha_hasta=${fHasta}`;
			if (sucursalIdVal) url += `&sucursal_id=${sucursalIdVal}`;
			
			// Traer los movimientos de la API
			const movs = await apiFetch(url);
			
			let calcIngresos = 0;
			let calcGastos = 0;
			const table = document.getElementById('table-caja');

			if (!Array.isArray(movs)) return;

			// Valores de filtros de búsqueda avanzados (normalizados)
			const valDesc = (inputDescFiltro?.value || "").toLowerCase().trim();
			const valDetalle = (inputDetalleFiltro?.value || "").toLowerCase().trim();

			// 3. FILTRADO CORREGIDO E INTELIGENTE (Frontend)
			const filtrados = movs.filter(m => {
				if (sucursalIdVal !== "" && String(m.sucursal_id) !== String(sucursalIdVal)) return false;

				if (!m.fecha) return false;

				let fechaZ = m.fecha;
				if (!fechaZ.endsWith('Z') && !fechaZ.includes('+')) {
					fechaZ += 'Z';
				}

				const d = new Date(fechaZ);
				const yyyy = d.getFullYear();
				const mm = String(d.getMonth() + 1).padStart(2, '0');
				const dd = String(d.getDate()).padStart(2, '0');
				const fechaMovLocal = `${yyyy}-${mm}-${dd}`;
													
				// Filtro de rango de fechas (Doble validación)
				if (fechaMovLocal < inputDesde.value || fechaMovLocal > inputHasta.value) return false;

				// Filtro Búsqueda en Descripción
				const descMov = (m.descripcion || "").toLowerCase();
				if (valDesc && !descMov.includes(valDesc)) return false;

				// Filtro Búsqueda en Detalle (descripcion2)
				const detMov = (m.descripcion2 || "").toLowerCase();
				if (valDetalle && !detMov.includes(valDetalle)) return false;

				// Filtro Método de Pago
				if (window.filtrosCaja && window.filtrosCaja.metodos && window.filtrosCaja.metodos.length > 0) {
					const metodoActual = m.metodo_pago || 'Efectivo';
					if (!window.filtrosCaja.metodos.includes(metodoActual)) return false;
				}

				return true;
			});

			// 4. Renderizado de Tabla (7 Columnas)
			if (table) {
				if (filtrados.length > 0) {
					filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

					table.innerHTML = filtrados.map(m => {
						const tipoRaw = (m.tipo || '').toLowerCase();
						const monto = Math.abs(parseFloat(m.monto));
						const metodo = m.metodo_pago || 'Efectivo';
						const cuotas = parseInt(m.cuotas) || 1;
						
						const esEgresoManual = tipoRaw === 'egreso' || tipoRaw === 'gasto' || tipoRaw === 'compra' || tipoRaw === 'salida';
						const esIngresoManual = tipoRaw === 'ingreso' || tipoRaw === 'entrada';
						const esPositivo = esIngresoManual || ((tipoRaw.includes('mercaderia') || tipoRaw.includes('plan') || tipoRaw.includes('venta') || tipoRaw.includes('cobro')) && !tipoRaw.includes('compra'));
						const esEgreso = !esPositivo && (esEgresoManual || tipoRaw.includes('compra') || tipoRaw.includes('pago'));

						if (esEgreso) calcGastos += monto;
						else calcIngresos += monto;

						const flujoTexto = esEgreso ? 'EGRESO' : 'INGRESO';
						const flujoColor = esEgreso ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20';

						let categoriaTag = m.tipo || 'Movimiento';
						let infoPrincipal = m.descripcion || '-';
						let notaManual = m.descripcion2 || '';

						if (tipoRaw.includes('plan')) {
							categoriaTag = "Plan GymFit";
							infoPrincipal = (m.descripcion || '').replace(/Cobro Plan\s*/i, '').replace(/Renovación\s*/i, '').trim();
						} 
						else if (tipoRaw.includes('mercaderia') || tipoRaw.includes('venta')) {
							categoriaTag = "Venta Stock";
							infoPrincipal = (m.descripcion || '').replace(/Venta Insumo:\s*/i, '').trim();
						}
						else if (tipoRaw.includes('compra')) {
							categoriaTag = "Reposición";
							infoPrincipal = (m.descripcion || '').replace(/Compra Stock:\s*/i, '').trim();
						}
						else if (esIngresoManual) {
							categoriaTag = "Ingreso Manual";
						}
						else if (esEgresoManual) {
							categoriaTag = "Gasto Extra";
						}

						let fZ = m.fecha;
						if (!fZ.endsWith('Z') && !fZ.includes('+')) fZ += 'Z';
						const d = new Date(fZ);
						const fDisplay = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
						const hDisplay = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

						let infoCuotasMonto = '';
						if (metodo === 'T. Credito' && cuotas > 1) {
							const valorCuota = monto / cuotas;
							infoCuotasMonto = `<span class="block text-[7px] text-red-500 font-black mt-0.5 tracking-tighter uppercase">
													$ ${valorCuota.toLocaleString()} x ${cuotas}
												</span>`;
						}

						return `
						<tr class="viking-table-row border-b border-white/5 hover:bg-white/5 transition-colors">
							<td class="py-4 pl-6">
								<span class="text-white text-[10px] font-black">${fDisplay}</span>
								<span class="block text-red text-[8px] font-bold">${hDisplay} HS</span>
							</td>
							<td class="py-4">
								<span class="px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider ${flujoColor}">${flujoTexto}</span>
							</td>
							<td class="py-4 text-white text-[10px] font-black uppercase tracking-tight">
								${infoPrincipal}
							</td>
							<td class="py-4 text-white/40 text-[9px] font-bold uppercase italic">
								<span class="text-white/60 block mb-0.5">${categoriaTag}</span>
								<span class="text-red-600/60">${notaManual}</span>
							</td>
							<td class="py-4 text-white/60 text-[10px] font-bold uppercase">
								${metodo}
							</td>
							<td class="py-4 text-white/30 text-[10px] font-bold">
								${cuotas} ${cuotas > 1 ? 'CUOTAS' : 'CUOTA'}
							</td>
							<td class="py-4 text-right pr-6 font-black italic text-white text-[12px]">
								$ ${monto.toLocaleString()}
								${infoCuotasMonto}
							</td>
						</tr>`;
					}).join('');
					
					if (window.lucide) lucide.createIcons();
				} else {
					table.innerHTML = '<tr><td colspan="7" class="text-center py-20 text-white/10 italic text-[10px] font-black uppercase tracking-[0.4em]">Sin movimientos que coincidan</td></tr>';
				}
			}

			// 5. TOTALES (Con restricción para Perfil Administracion)
			const calcBalance = calcIngresos - calcGastos;
			const divTotales = document.getElementById('contenedor-totales-caja');

			if (nombreRol === "administracion") {
				if (divTotales) divTotales.style.setProperty('display', 'none', 'important');
			} else {
				if (divTotales) divTotales.style.setProperty('display', 'grid', 'important');
				
				if(document.getElementById('caja-ingresos')) document.getElementById('caja-ingresos').innerText = `$ ${calcIngresos.toLocaleString()}`;
				if(document.getElementById('caja-gastos')) document.getElementById('caja-gastos').innerText = `$ ${calcGastos.toLocaleString()}`;
				if(document.getElementById('caja-balance')) {
					const eb = document.getElementById('caja-balance');
					eb.innerText = `$ ${calcBalance.toLocaleString()}`;
					eb.className = `text-4xl font-black italic ${calcBalance >= 0 ? 'text-green-500' : 'text-red-500'}`;
				}
			}
		};

		window.filtrosCaja = {
			metodos: [] 
		};

		window.toggleMetodoFiltro = function(metodo, btn) {
			const idx = window.filtrosCaja.metodos.indexOf(metodo);
			if (idx > -1) {
				window.filtrosCaja.metodos.splice(idx, 1);
				btn.classList.remove('active');
			} else {
				window.filtrosCaja.metodos.push(metodo);
				btn.classList.add('active');
			}
			window.loadCaja(); 
		};

		window.resetFiltrosCaja = function() {
			const timezoneOffset = new Date().getTimezoneOffset() * 60000;
			const hoy = new Date(Date.now() - timezoneOffset).toISOString().split('T')[0];
			
			const inputDesde = document.getElementById('caja-filtro-desde');
			const inputHasta = document.getElementById('caja-filtro-hasta');
			if (inputDesde) inputDesde.value = hoy;
			if (inputHasta) inputHasta.value = hoy;
			
			const inputDesc = document.getElementById('caja-filtro-desc');
			const inputDetalle = document.getElementById('caja-filtro-detalle');
			if (inputDesc) inputDesc.value = "";
			if (inputDetalle) inputDetalle.value = "";
			
			// ⚔️ FIX DE RESET: Devolvemos el selector de sucursal al estado global
			const selectCaja = document.getElementById('caja-filter-sucursal');
			if (selectCaja) selectCaja.value = "";
			
			window.filtrosCaja.metodos = [];
			document.querySelectorAll('.metodo-chip').forEach(btn => btn.classList.remove('active'));
			
			window.loadCaja();
		};

		// FUNCTION GUARDARMOVIMIENTO ABAJO:
		window.guardarMovimiento = async function(event) {
            if (event && event.preventDefault) event.preventDefault();

            const descInput = document.getElementById('input-desc-gasto');
            const notaInput = document.getElementById('input-nota-gasto');
            const montoInput = document.getElementById('input-monto-gasto');
            const tipoInput = document.getElementById('input-tipo-movimiento');
            const prodSelect = document.getElementById('input-producto-stock');
            const cantInput = document.getElementById('input-cantidad-compra');

            const monto = parseFloat(montoInput?.value) || 0;
            const tipoSeleccionado = tipoInput ? tipoInput.value : 'Gasto';
            
            // Inicializamos variables de contenido
            let descripcionFinal = "";
            let notaManual = notaInput?.value || '';

            if (monto <= 0) return alert("El monto debe ser mayor a 0");

            if (tipoSeleccionado === 'Compra') {
                const productoId = prodSelect.value;
                const cantidadAñadir = parseInt(cantInput.value) || 0;

                // Buscamos en el estado GLOBAL
                const currentStock = window.state?.stock || [];
                const producto = currentStock.find(p => String(p.id) === String(productoId));
                if (!producto) return alert("Producto no identificado.");

                // LÓGICA DE COMPRA: Ignoramos el campo "Descripción" del HTML (que ya está oculto).
                // La descripción principal (columna descripcion1) se genera solo con el producto y cantidad.
                descripcionFinal = `COMPRA: ${producto.nombre_producto.toUpperCase()} (x${cantidadAñadir} UNID)`;
                
                // La nota manual (columna descripcion2) se toma del campo Detalle/Nota.
                notaManual = notaInput?.value || '';

                // 1. ACTUALIZAR STOCK EN EL SERVIDOR
                try {
                    const nuevoStock = parseInt(producto.stock_actual) + cantidadAñadir;
                    // LLAMADA POSICIONAL CORREGIDA: apiFetch(url, metodo, data)
                    const resStock = await apiFetch(`/stock/${productoId}`, 'PUT', {
                        nombre_producto: producto.nombre_producto,
                        stock_actual: nuevoStock,
                        precio_venta: producto.precio_venta,
                        url_imagen: producto.url_imagen
                    });
                    
                    if (resStock.error || resStock.status === 'error') {
                        throw new Error(resStock.message || resStock.error || "Error desconocido");
                    }
                } catch (err) {
                    console.error("Falla en Stock:", err);
                    return alert("No se pudo actualizar el stock: " + err.message);
                }
            } else {
                // LÓGICA DE EGRESO MANUAL: Aquí sí usamos el campo Descripción del formulario.
                descripcionFinal = descInput?.value || 'Gasto General';
                notaManual = notaInput?.value || '';
            }

            // 2. REGISTRO EN CAJA
            try {
                // LLAMADA POSICIONAL CORREGIDA: apiFetch(url, metodo, data)
                const res = await apiFetch('/caja/movimientos', 'POST', {
                    tipo: tipoSeleccionado,
                    descripcion: descripcionFinal,
                    descripcion2: notaManual,
                    monto: monto,
                    metodo_pago: 'Efectivo'
                });

                if (!res.error && res.status !== 'error') {
                    document.getElementById('modal-gasto').classList.add('hidden');
                    
                    // Limpieza de campos
                    if(descInput) descInput.value = "";
                    if(notaInput) notaInput.value = "";
                    if(montoInput) montoInput.value = "";

                    // RECARGA GLOBAL
                    await window.loadCaja();
                    if (typeof window.loadStock === 'function') await window.loadStock();
                    
                    if (typeof showVikingToast === 'function') showVikingToast('Caja y Stock actualizados');
                } else {
                    alert("Error en Caja: " + (res.message || res.error));
                }
            } catch (e) {
                alert("Error de conexión al guardar.");
            }
        };

		// Función para alternar campos según si es Egreso o Compra de Stock
		window.toggleCamposGasto = function(tipo) {
			const groupCompra = document.getElementById('campos-compra-mercaderia');
			const containerDesc = document.getElementById('container-desc-gasto');
			const inputDesc = document.getElementById('input-desc-gasto');
			const labelDetalle = document.getElementById('label-detalle');
			const inputNota = document.getElementById('input-nota-gasto');

			if (tipo === 'Compra') {
				if (groupCompra) groupCompra.classList.remove('hidden');
				if (containerDesc) containerDesc.classList.add('hidden'); 
				if (inputDesc) inputDesc.required = false;
				if (labelDetalle) labelDetalle.innerText = "Nota / Detalle de Compra";
				if (inputNota) inputNota.placeholder = "Ej: Proveedor Central - Factura 123";
				
				const select = document.getElementById('input-producto-stock');
				if (select && window.state && window.state.stock) {
					select.innerHTML = window.state.stock.map(p => `<option value="${p.id}">${p.nombre_producto}</option>`).join('');
				}
			} else {
				if (groupCompra) groupCompra.classList.add('hidden');
				if (containerDesc) containerDesc.classList.remove('hidden');
				if (inputDesc) {
					inputDesc.required = true;
					inputDesc.placeholder = "Ej: Pago de Alquiler, Luz...";
				}
				if (labelDetalle) labelDetalle.innerText = "Detalle / Nota";
				if (inputNota) inputNota.placeholder = "Ej: Mes de Marzo, Factura A...";
			}
		};
			
        async function initApp() {
			try {
				// 1. Carga masiva de datos maestros
				await Promise.all([
					loadSucursales(), 
					fetchAlumnos(), 
					loadStaff(), 
					loadPlanes(), 
					loadStock(), 
					loadClases(), 
					fetchReservas(), 
					loadDashboard(), 
					loadMusculacionMetadata(), 
					loadCaja()
				]);
				
				// ⚔️ 1b. Inicializamos selectores
				if (typeof renderSucursalSelector === 'function') {
					renderSucursalSelector();
				}

				// ⚔️ 1c. Escuchador de cambios de sede
				document.getElementById('clase-sucursal-select')?.addEventListener('change', (e) => {
					if (typeof loadBoxes === 'function') {
						loadBoxes(e.target.value);
					}
				});

				// ⚔️ EVENTOS VIKINGOS: Chequeamos cumples una vez cargados los alumnos
				if (typeof checkVikingBirthdays === 'function') {
					checkVikingBirthdays();
				}

				// 2. Configuración de UI del calendario
				if (typeof setupCalendarFilters === 'function') {
					setupCalendarFilters();
				}
				
				// 3. Renderizado final
				await renderCalendar();

			} catch (error) {
				console.error("Error crítico en initApp:", error);
				renderCalendar();
				if (typeof renderSucursalSelector === 'function') renderSucursalSelector();
			}
		}

		async function loadDashboard() {
            console.log("⚔️ Sincronizando Central de Mando...");

            // 1. Cargar datos necesarios del servidor
            // Traemos Stock, Reservas e Historial de Acceso real
            // IMPORTANTE: Respetamos tus strings de apiFetch tal cual los tenías
            const [stockData, reservasData, accesoData, cajaResumen] = await Promise.all([
				apiFetch('/stock'),
				apiFetch('/reservas'),
				apiFetch('/acceso/historial'),
				apiFetch('/caja/resumen') // Esto ahora vendrá filtrado por el backend
			]);

			// Actualiza los numeritos de la caja en el Dash
			if (cajaResumen) {
				const balanceEl = document.getElementById('dash-balance-hoy');
				if (balanceEl) balanceEl.innerText = `$ ${cajaResumen.balance.toLocaleString()}`;
			}

            const stock = Array.isArray(stockData) ? stockData : [];
            const reservas = Array.isArray(reservasData) ? reservasData : [];
            const historialAcceso = Array.isArray(accesoData) ? accesoData : [];

            // Guardamos en el estado global por si otras funciones lo necesitan
            state.stock = stock;
            state.reservas = reservas;
            state.accesos = historialAcceso;

            // --- A. ÚLTIMOS ACCESOS (GENERAL / ALUMNOS) ---
            const accessContainer = document.getElementById('dash-last-access');
            if (accessContainer) {
                // Filtramos por rol "alumno" respetando tu lógica de separacion
                const alumnosLog = historialAcceso.filter(acc => (acc.rol || '').toLowerCase() === 'alumno');

                accessContainer.innerHTML = alumnosLog.length ? alumnosLog.slice(0, 10).map(acc => {
                    // Sincronizamos con el campo 'estado' que el main.py devuelve (que viene de 'accion' en la DB)
                    const isDenied = acc.estado === 'DENIED' || acc.estado === 'DENEGADO';
                    const colorClass = isDenied ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-blue-500 bg-blue-500/10 border-blue-500/20';
                    
                    // AGREGADO: Se muestra la fecha completa (Hora • Fecha)
                    const fechaCompleta = acc.fecha ? acc.fecha.replace(' - ', ' • ') : 'Ahora';

                    return `
                        <div class="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg ${isDenied ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'} flex items-center justify-center">
                                    <i data-lucide="user-check" class="w-4 h-4"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-black uppercase italic text-white group-hover:text-blue-400 truncate max-w-[120px]">${acc.nombre}</p>
                                    <p class="text-[8px] text-gray-500 font-bold">${fechaCompleta} • ${acc.metodo || 'QR'}</p>
                                </div>
                            </div>
                            <span class="text-[9px] px-2 py-1 rounded-md font-black uppercase italic ${colorClass}">${isDenied ? 'DENEGADO' : 'PERMITIDO'}</span>
                        </div>
                    `;
                }).join('') : '<p class="text-center text-gray-600 italic text-[10px] py-10">Esperando lecturas de QR...</p>';
            }

            // --- B. CONTROL DE STAFF (SOLO PROFESORES / ADMIN) ---
            const staffContainer = document.getElementById('dash-staff-access');
            if (staffContainer) {
                // Filtramos el historial para mostrar solo a los que NO son alumnos (Staff/Admin)
                const staffLog = historialAcceso.filter(acc => {
                    const rol = (acc.rol || '').toLowerCase();
                    return rol !== "alumno" && rol !== "" && rol !== "n/a";
                });

                staffContainer.innerHTML = staffLog.length ? staffLog.slice(0, 10).map(acc => {
                    // MODIFICADO: Aplicamos la misma lógica de "Acceso Virtual" para asegurar que traiga el día
                    const fechaCompleta = acc.fecha ? acc.fecha.replace(' - ', ' • ') : 'Ahora';

                    return `
                        <div class="flex items-center justify-between p-3 bg-red-600/[0.05] rounded-2xl border border-red-600/10 hover:border-red-600/30 transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-black italic text-black">
                                    ${(acc.nombre || '??').substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                    <p class="text-[10px] font-black uppercase italic text-white leading-none mb-1">${acc.nombre}</p>
                                    <p class="text-[8px] text-red-500/70 font-bold uppercase">${acc.rol || 'STAFF'}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-[9px] font-black text-white leading-none">${fechaCompleta}hs</p>
                                <p class="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">PRESENTE</p>
                            </div>
                        </div>
                    `;
                }).join('') : '<p class="text-center text-gray-600 italic text-[10px] py-10">Sin personal registrado hoy.</p>';
            }

            // --- C. ALERTAS DE STOCK (SINCRONIZADO) ---
            const stockContainer = document.getElementById('dash-low-stock');
            if (stockContainer) {
                const lowStock = stock.filter(s => s.stock_actual <= 5).sort((a,b) => a.stock_actual - b.stock_actual);
                if (lowStock.length === 0) {
                    stockContainer.innerHTML = '<div class="flex flex-col items-center justify-center h-full opacity-30"><i data-lucide="check-circle" class="w-12 h-12 mb-2 text-green-500"></i><p class="text-[10px] font-black italic">Stock Saludable</p></div>';
                } else {
                    stockContainer.innerHTML = lowStock.map(s => `
                        <div class="flex justify-between items-center p-3 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-500 flex items-center justify-center font-bold text-xs">
                                    ${s.stock_actual}
                                </div>
                                <div>
                                    <p class="text-[10px] font-black uppercase italic text-white">${s.nombre_producto}</p>
                                    <p class="text-[8px] text-red-500 font-bold uppercase">Reposición Urgente</p>
                                </div>
                            </div>
                            <button onclick="switchView('stock')" class="text-[9px] border border-white/10 text-gray-400 px-2 py-1 rounded hover:bg-white/10 transition-colors italic font-black uppercase">Ver</button>
                        </div>
                    `).join('');
                }
            }

            // --- D. TOP 5 CLASES (MANTENIDO) ---
            const topClassesContainer = document.getElementById('dash-top-clases');
            if (topClassesContainer) {
                const classCounts = {};
                reservas.forEach(r => {
                    const name = r.clase_nombre || "Clase";
                    classCounts[name] = (classCounts[name] || 0) + 1;
                });

                const sortedClasses = Object.entries(classCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                if (sortedClasses.length === 0) {
                    topClassesContainer.innerHTML = '<p class="text-center text-gray-500 italic text-[10px] py-10">No hay reservas registradas.</p>';
                } else {
                    topClassesContainer.innerHTML = sortedClasses.map(([name, count], index) => {
                        const colors = ["text-yellow-400", "text-gray-300", "text-amber-600", "text-gray-600", "text-gray-700"];
                        return `
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                            <div class="flex items-center gap-3">
                                <i data-lucide="medal" class="w-4 h-4 ${colors[index]}"></i>
                                <span class="text-[10px] font-black italic uppercase text-white">${index + 1}. ${name}</span>
                            </div>
                            <span class="text-[9px] font-black text-red-600 bg-red-600/10 px-2 py-0.5 rounded border border-red-600/20">${count} RES.</span>
                        </div>
                    `}).join('');
                }
            }

            // --- E. FRECUENCIA HORARIA (GRÁFICO MANTENIDO) ---
            const chartContainer = document.getElementById('dash-chart-container');
            const labelsContainer = document.getElementById('dash-chart-labels');
            
            if (chartContainer && labelsContainer) {
                const hoursMap = {};
                for(let i=7; i<=22; i++) hoursMap[i] = 0;

                reservas.forEach(r => {
                    if(r.horario) {
                        const h = Math.floor(parseFloat(r.horario));
                        if(hoursMap[h] !== undefined) hoursMap[h]++;
                    }
                });

                const maxVal = Math.max(...Object.values(hoursMap));
                const safeMax = maxVal === 0 ? 10 : maxVal;

                chartContainer.innerHTML = `
                    <div class="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[8px] text-gray-600 font-bold py-2 pointer-events-none">
                        <span>${safeMax}</span>
                        <span>${Math.round(safeMax/2)}</span>
                        <span>0</span>
                    </div>`;
                
                labelsContainer.innerHTML = "";

                Object.keys(hoursMap).forEach(h => {
                    const count = hoursMap[h];
                    const heightPercent = (count / safeMax) * 100;
                    const bar = document.createElement('div');
                    bar.className = "flex-1 mx-0.5 rounded-t-sm transition-all duration-500 hover:bg-red-500 relative group";
                    bar.style.height = `${Math.max(5, heightPercent)}%`;
                    bar.style.backgroundColor = `rgba(220, 38, 38, ${Math.max(0.2, count/safeMax)})`;
                    bar.innerHTML = `<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[8px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">${count}</div>`;
                    chartContainer.appendChild(bar);

                    if (h % 2 === 0 || h == 7) { 
                        const lbl = document.createElement('div');
                        lbl.innerText = `${h}h`;
                        lbl.className = "flex-1 text-center";
                        labelsContainer.appendChild(lbl);
                    } else {
                        labelsContainer.appendChild(document.createElement('div'));
                    }
                });
            }

            if (window.lucide) lucide.createIcons();
        }

        async function fetchAlumnos() {
			const d = await apiFetch('/alumnos');
			state.alumnos = Array.isArray(d) ? d : [];

			// 1. TRANSFORMACIÓN VISUAL DEL DASHBOARD (Mini Lista)
			// Buscamos la tabla original para reemplazarla por nuestro nuevo diseño de filas
			const dashTable = document.querySelector('#admin-dashboard-layout table');
			const dashListId = 'dash-alumnos-list-view';
			let dashContainer = document.getElementById(dashListId);

			// Si todavía existe la tabla (primera carga), la reemplazamos por un DIV contenedor
			if (!dashContainer && dashTable) {
				dashContainer = document.createElement('div');
				dashContainer.id = dashListId;
				dashContainer.className = "flex flex-col gap-2"; // Espacio entre filas
				// Reemplazamos la tabla entera (y sus cabeceras) por nuestra lista limpia
				if (dashTable.parentNode) dashTable.parentNode.replaceChild(dashContainer, dashTable);
			}

			if (dashContainer) {
				const topAlumnos = state.alumnos.slice(0, 5); // Solo mostramos los 5 recientes en dashboard
				if (topAlumnos.length === 0) {
					dashContainer.innerHTML = '<p class="text-center text-gray-500 italic text-[11px] py-4">No hay alumnos recientes.</p>';
				} else {
					dashContainer.innerHTML = topAlumnos.map(a => createAlumnoRow(a, 'dashboard')).join('');
				}
			}

			// 2. TRANSFORMACIÓN VISUAL DE LA SECCIÓN ALUMNOS (Lista Completa)
			const fullTable = document.querySelector('#view-alumnos table');
			const fullListId = 'full-alumnos-list-view';
			let fullContainer = document.getElementById(fullListId);

			if (!fullContainer && fullTable) {
				fullContainer = document.createElement('div');
				fullContainer.id = fullListId;
				fullContainer.className = "flex flex-col gap-3"; // Más espacio en la vista completa
				if (fullTable.parentNode) fullTable.parentNode.replaceChild(fullContainer, fullTable);
			}

			if (fullContainer) {
				if (state.alumnos.length === 0) {
					fullContainer.innerHTML = '<div class="text-center py-10"><i data-lucide="users" class="w-12 h-12 text-gray-600 mx-auto mb-4"></i><p class="text-gray-500 italic">No hay alumnos registrados.</p></div>';
				} else {
					fullContainer.innerHTML = state.alumnos.map(a => createAlumnoRow(a, 'full')).join('');
				}
			}

			if (window.lucide) lucide.createIcons();
			applyPermissions(); // Re-aplicamos permisos para ocultar botones de editar a quien no corresponda
		}

		// --- REEMPLAZA TU FUNCIÓN loadStaff POR ESTA NUEVA VERSIÓN VISUAL ---
		async function loadStaff() {
			// 1. Asegurar sucursales antes de procesar
			if (!state.sucursales || state.sucursales.length === 0) {
				await loadSucursales();
			}

			const [p, a] = await Promise.all([
				apiFetch('/profesores'),
				apiFetch('/administrativos')
			]);

			const isAdmin = state.user?.rol_nombre === "Administrador";
			const userSucursalId = state.user?.sucursal_id;

			// 2. Mostrar/Ocultar contenedores de filtros según rol
			const contProf = document.getElementById('container-filter-profesores');
			const contAdm = document.getElementById('container-filter-administrativos');
			if (contProf) isAdmin ? contProf.classList.remove('hidden') : contProf.classList.add('hidden');
			if (contAdm) isAdmin ? contAdm.classList.remove('hidden') : contAdm.classList.add('hidden');

			// 3. Filtrado
			let profesores = Array.isArray(p) ? p : [];
			let administrativos = Array.isArray(a) ? a : [];

			if (isAdmin) {
				const fProf = document.getElementById('filter-sucursal-profesores')?.value || 'all';
				const fAdm = document.getElementById('filter-sucursal-administrativos')?.value || 'all';
				if (fProf !== 'all') profesores = profesores.filter(u => String(u.sucursal_id) === String(fProf));
				if (fAdm !== 'all') administrativos = administrativos.filter(u => String(u.sucursal_id) === String(fAdm));
			} else {
				profesores = profesores.filter(u => String(u.sucursal_id) === String(userSucursalId));
				administrativos = administrativos.filter(u => String(u.sucursal_id) === String(userSucursalId));
			}

			state.profesores = profesores;
			state.administrativos = administrativos;

			// 4. Renderizado (Transformación Visual)
			const renderContent = (list, viewId, listId, type) => {
				const table = document.querySelector(`#${viewId} table`);
				let container = document.getElementById(listId);

				if (!container && table) {
					container = document.createElement('div');
					container.id = listId;
					container.className = "flex flex-col gap-3";
					table.parentNode.replaceChild(container, table);
				}

				if (container) {
					container.innerHTML = list.length === 0 
						? '<div class="text-center py-10 opacity-40 italic font-black uppercase">Sin registros en esta sede</div>' 
						: list.map(u => createStaffRow(u, type)).join('');
				}
			};

			renderContent(state.profesores, 'view-profesores', 'profesores-list-view', 'Profesor');
			renderContent(state.administrativos, 'view-administrativos', 'administrativos-list-view', 'Administracion');

			if (window.lucide) lucide.createIcons();
			applyPermissions();
		}

		function createStaffRow(u, type) {
			const initials = u.nombre_completo ? u.nombre_completo.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : "??";
			const roleLabel = type === 'Profesor' ? 'Coach / Especialidad' : 'Cargo / Función';
			const roleValue = u.especialidad || (type === 'Profesor' ? 'Entrenador General' : 'Administrativo');
			const icon = type === 'Profesor' ? 'dumbbell' : 'shield-check';

			// 🛡️ Búsqueda de sucursal corregida: usamos .sucursal
			const sede = state.sucursales?.find(s => String(s.id) === String(u.sucursal_id));
			const sucursalNombre = sede?.sucursal || "SEDE NO ASIGNADA";

			return `
			<div class="glass-card p-4 rounded-3xl border-white/5 flex flex-col md:flex-row md:items-center gap-4 hover:border-red-600/20 transition-all group relative overflow-hidden">
				<div class="absolute left-0 top-0 bottom-0 w-1 bg-red-600 opacity-30 group-hover:opacity-100 transition-opacity"></div>
				<div class="flex items-center gap-4 flex-1">
					<div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-sm italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors">
						${initials}
					</div>
					<div>
						<h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors">${u.nombre_completo}</h4>
						<div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
							<p class="text-[10px] text-white-500 font-bold flex items-center gap-1"><i data-lucide="id-card" class="w-3 h-3"></i> ${u.dni}</p>
							${u.email ? `<p class="text-[10px] text-gray-500 font-bold flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3"></i> ${u.email}</p>` : ''}
							<p class="text-[10px] text-red-500 font-black flex items-center gap-1 uppercase italic">
								<i data-lucide="map-pin" class="w-3 h-3"></i> ${sucursalNombre.toUpperCase()}
							</p>
						</div>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-6 md:justify-center border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-6">
					<div class="min-w-[150px]">
						<p class="text-[9px] text-white-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
							<i data-lucide="${icon}" class="w-3 h-3 text-red-600"></i> ${roleLabel}
						</p>
						<p class="text-[11px] font-black uppercase italic text-white truncate max-w-[200px]">${roleValue}</p>
					</div>
				</div>
				<div class="flex items-center justify-end border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-6 min-w-[100px]">
					<button onclick="openEditStaff(${u.id}, '${type}')" class="px-5 py-2.5 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-white/10 hover:text-red-500 transition-all flex items-center gap-2 shadow-lg action-col">
						<i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
						<span>Editar</span>
					</button>
				</div>
			</div>`;
		}

		/**
		 * GESTIÓN AVANZADA DE ALUMNOS (PUNTO 5)
		 * Incluye: Buscador, Filtros de Estado y Paginación (20 por hoja)
		 */

		// 1. Inicialización de variables de estado (asegurar que existan)
		if (!state.alumnosPage) state.alumnosPage = 1;
		if (!state.alumnosLimit) state.alumnosLimit = 20;
		if (!state.alumnosSearch) state.alumnosSearch = "";
		if (!state.alumnosStatusFilter) state.alumnosStatusFilter = "todos";

		/**
		 * Función Principal de Renderizado
		 */
		function renderAlumnos() {
			const container = document.getElementById('alumnos-list-view');
			if (!container) return;

			// Obtenemos la fecha de hoy en formato YYYY-MM-DD
			const hoy = new Date().toISOString().split('T')[0];

			// --- PASO A: FILTRADO ---
			let filtrados = state.alumnos.filter(a => {
				// Búsqueda por texto (Nombre o DNI)
				const matchesSearch = (a.nombre_completo || "").toLowerCase().includes(state.alumnosSearch.toLowerCase()) || 
									String(a.dni || "").includes(state.alumnosSearch);
				
				// Lógica de Estado: Es ACTIVO si tiene fecha y esa fecha es igual o mayor a hoy
				const isActive = a.fecha_vencimiento && a.fecha_vencimiento >= hoy;
				
				let matchesStatus = true;
				if (state.alumnosStatusFilter === "activos") {
					matchesStatus = isActive;
				} else if (state.alumnosStatusFilter === "vencidos") {
					matchesStatus = !isActive; // Es vencido si NO es activo
				}

				return matchesSearch && matchesStatus;
			});

			// --- PASO B: PAGINACIÓN ---
			const totalItems = filtrados.length;
			const totalPages = Math.ceil(totalItems / state.alumnosLimit) || 1;
			if (state.alumnosPage > totalPages) state.alumnosPage = totalPages;

			const inicio = (state.alumnosPage - 1) * state.alumnosLimit;
			const paginados = filtrados.slice(inicio, inicio + state.alumnosLimit);

			// --- PASO C: UI DE FILTROS (EL COLOR ROJO) ---
			// Buscamos todos los botones con la clase específica de alumnos
			document.querySelectorAll('.filter-btn-alumno').forEach(btn => {
				btn.classList.remove('bg-red-600', 'text-black');
				btn.classList.add('text-white-500', 'hover:text-white');
			});
			
			// Marcamos el botón activo
			const activeFilterBtn = document.getElementById('filter-' + state.alumnosStatusFilter);
			if (activeFilterBtn) {
				activeFilterBtn.classList.remove('text-white-500', 'hover:text-white');
				activeFilterBtn.classList.add('bg-red-600', 'text-black');
			}

			// --- PASO D: DIBUJAR EN PANTALLA ---
			if (paginados.length === 0) {
				container.innerHTML = `
					<div class="py-20 text-center opacity-20">
						<i data-lucide="shield-off" class="w-16 h-16 mx-auto mb-4"></i>
						<p class="font-black uppercase italic tracking-widest">No hay guerreros en la categoría: ${state.alumnosStatusFilter}</p>
					</div>`;
			} else {
				container.innerHTML = paginados.map(a => createAlumnoRow(a, 'listado')).join('');
			}

			// --- PASO E: ACTUALIZAR ESTADÍSTICAS Y ICONOS ---
			if (window.lucide) lucide.createIcons();
			
			// Actualizamos los numeritos de arriba (stats)
			const totalActivos = state.alumnos.filter(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy).length;
			
			if (document.getElementById('stats-total')) document.getElementById('stats-total').innerText = state.alumnos.length;
			if (document.getElementById('stats-activos')) document.getElementById('stats-activos').innerText = totalActivos;
			if (document.getElementById('stats-vencidos')) document.getElementById('stats-vencidos').innerText = state.alumnos.length - totalActivos;
		}
		
		/**
		 * UI de Paginación Superior
		 */
		function updatePaginationUI(total, items) {
			const pagContainer = document.getElementById('alumnos-pagination');
			if (!pagContainer) return;

			const start = items === 0 ? 0 : (state.alumnosPage - 1) * state.alumnosLimit + 1;
			const end = Math.min(state.alumnosPage * state.alumnosLimit, items);

			pagContainer.innerHTML = `
				<p class="text-[10px] font-black text-gray-400 uppercase italic">
					Mostrando <span class="text-white">${start}-${end}</span> de <span class="text-red-500">${items}</span> guerreros
				</p>
				<div class="flex items-center gap-3">
					<button onclick="changeAlumnosPage(${state.alumnosPage - 1})" ${state.alumnosPage === 1 ? 'disabled' : ''} 
						class="p-2 rounded-xl bg-white/5 text-gray-400 hover:bg-red-600 hover:text-black transition-all disabled:opacity-5">
						<i data-lucide="chevron-left" class="w-4 h-4"></i>
					</button>
					
					<span class="text-[10px] font-black px-4 italic bg-white/5 py-2 rounded-lg border border-white/5">
						HOJA <span class="text-red-600">${state.alumnosPage}</span> / ${total}
					</span>
					
					<button onclick="changeAlumnosPage(${state.alumnosPage + 1})" ${state.alumnosPage === total ? 'disabled' : ''} 
						class="p-2 rounded-xl bg-white/5 text-gray-400 hover:bg-red-600 hover:text-black transition-all disabled:opacity-5">
						<i data-lucide="chevron-right" class="w-4 h-4"></i>
					</button>
				</div>
			`;
			if (window.lucide) lucide.createIcons();
		}

		/**
		 * CONTROLES DE PAGINACIÓN ESTÉTICOS
		 */
		function renderPaginationControls(totalPages, totalItems) {
			let paginationContainer = document.getElementById('alumnos-pagination');
			
			// Si no existe el contenedor en el HTML, lo creamos dinámicamente al final de la vista
			if (!paginationContainer) {
				const view = document.getElementById('view-alumnos');
				paginationContainer = document.createElement('div');
				paginationContainer.id = 'alumnos-pagination';
				paginationContainer.className = "flex items-center justify-between mt-8 px-6 py-4 glass-card rounded-2xl border-white/5";
				view.appendChild(paginationContainer);
			}

			const inicioMostrado = totalItems === 0 ? 0 : (state.alumnosPage - 1) * state.alumnosLimit + 1;
			const finMostrado = Math.min(state.alumnosPage * state.alumnosLimit, totalItems);

			paginationContainer.innerHTML = `
				<p class="text-[10px] font-black text-gray-500 uppercase italic">
					Mostrando <span class="text-white">${inicioMostrado}-${finMostrado}</span> de <span class="text-white">${totalItems}</span> Guerreros
				</p>
				
				<div class="flex items-center gap-2">
					<button onclick="changeAlumnosPage(${state.alumnosPage - 1})" 
							${state.alumnosPage === 1 ? 'disabled' : ''} 
							class="p-2 rounded-xl bg-white/5 hover:bg-red-600 hover:text-black transition-all disabled:opacity-10 disabled:pointer-events-none">
						<i data-lucide="chevron-left" class="w-4 h-4"></i>
					</button>
					
					<div class="flex items-center gap-1">
						${generatePageButtons(totalPages, state.alumnosPage)}
					</div>

					<button onclick="changeAlumnosPage(${state.alumnosPage + 1})" 
							${state.alumnosPage === totalPages ? 'disabled' : ''} 
							class="p-2 rounded-xl bg-white/5 hover:bg-red-600 hover:text-black transition-all disabled:opacity-10 disabled:pointer-events-none">
						<i data-lucide="chevron-right" class="w-4 h-4"></i>
					</button>
				</div>
			`;
			if (window.lucide) lucide.createIcons();
		}

		function generatePageButtons(total, current) {
			let html = "";
			// Solo mostramos hasta 5 páginas para no romper el diseño
			for (let i = 1; i <= total; i++) {
				if (total > 5 && (i > 2 && i < total - 1 && Math.abs(i - current) > 1)) {
					if (i === 3 || i === total - 1) html += `<span class="text-gray-700 px-1">...</span>`;
					continue;
				}
				html += `
					<button onclick="changeAlumnosPage(${i})" 
						class="w-8 h-8 rounded-lg text-[10px] font-black transition-all ${i === current ? 'viking-bg-red text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}">
						${i}
					</button>`;
			}
			return html;
		}

		function changeAlumnosPage(p) {
			state.alumnosPage = p;
			renderAlumnos();
			const view = document.getElementById('view-alumnos');
			if (view) view.scrollIntoView({ behavior: 'smooth' });
		}

		/**
		 * FUNCIONES DE FILTRADO (Vincular a los inputs)
		 */
		function handleAlumnosSearch(val) {
			state.alumnosSearch = val;
			state.alumnosPage = 1; // Reiniciar a página 1 al buscar
			renderAlumnos();
		}

		function handleAlumnosStatusFilter(val) {
			state.alumnosStatusFilter = val;
			state.alumnosPage = 1;
			renderAlumnos();
		}

		/**
		 * Creación de Tarjeta de Alumno Premium
		 */
		function createAlumnoRow(a, type) {
			const initials = a.nombre_completo ? a.nombre_completo.split(' ').filter(n=>n).map(n=>n[0]).join('').substring(0,2).toUpperCase() : "??";
			const planName = a.plan?.nombre || 'SIN PLAN ACTIVO';
			const hoy = new Date().toISOString().split('T')[0];
			const isActive = a.fecha_vencimiento && a.fecha_vencimiento >= hoy;
			
			const statusColor = isActive ? 'text-green-500' : 'text-red-500';
			const statusText = isActive ? 'ACTIVO' : 'VENCIDO';
			const statusBg = isActive ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';

			if (type === 'dashboard') {
				return `
				<div class="glass-card p-3 rounded-2xl border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors group">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-lg viking-bg-red flex items-center justify-center font-black text-black text-[10px] italic shadow-md">${initials}</div>
						<div class="flex flex-col">
							<h4 class="text-[10px] font-black uppercase italic text-white group-hover:text-red-500 leading-none mb-1">${a.nombre_completo}</h4>
							<span class="text-[7px] px-1.5 py-0.5 rounded w-fit ${statusBg} ${statusColor} font-black uppercase tracking-wider">${statusText}</span>
						</div>
					</div>
					<button onclick="openEditAlumno(${a.id})" class="w-7 h-7 flex items-center justify-center bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white action-col">
						<i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
					</button>
				</div>`;
			} else {
				return `
				<div class="glass-card p-6 rounded-[2.5rem] border-white/5 flex flex-col lg:flex-row lg:items-center gap-6 hover:border-red-600/30 transition-all group relative overflow-hidden mb-3">
					<!-- Barra de estado lateral -->
					<div class="absolute left-0 top-0 bottom-0 w-1.5 ${isActive ? 'bg-green-500' : 'bg-red-500'} opacity-40 group-hover:opacity-100 transition-opacity"></div>
					
					<!-- Info Identidad -->
					<div class="flex items-center gap-5 flex-[1.2]">
						<div class="w-14 h-14 rounded-2xl viking-bg-red flex items-center justify-center font-black text-black text-lg italic shadow-xl group-hover:scale-110 transition-transform">
							${initials}
						</div>
						<div class="min-w-0">
							<h4 class="text-base font-black uppercase italic text-white group-hover:text-red-500 truncate">${a.nombre_completo}</h4>
							<p class="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 mt-1">
								<i data-lucide="id-card" class="w-3.5 h-3.5 text-red-600"></i> DNI: ${a.dni}
							</p>
						</div>
					</div>

					<!-- Info Plan (Ampliado) -->
					<div class="flex flex-wrap items-center gap-8 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-8 flex-[1.6]">
						<div class="flex-1 min-w-[200px]">
							<p class="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Plan de Entrenamiento</p>
							<p class="text-[13px] font-black uppercase italic text-white leading-tight">${planName}</p>
						</div>
						<div class="min-w-[90px]">
							<p class="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Estado</p>
							<span class="text-[10px] px-3 py-1.5 rounded-xl ${statusBg} ${statusColor} font-black uppercase tracking-widest border border-white/5">${statusText}</span>
						</div>
					</div>

					<!-- Fechas Críticas -->
					<div class="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-8 flex-[1.2]">
						<div class="flex gap-6 text-right">
							<div class="flex flex-col">
								<span class="text-[8px] text-gray-600 font-black uppercase tracking-tighter">Activación</span>
								<span class="text-[11px] font-bold text-gray-400 italic">${a.fecha_ultima_renovacion || '--/--/--'}</span>
							</div>
							<div class="flex flex-col">
								<span class="text-[8px] text-red-600 font-black uppercase tracking-tighter">Vencimiento</span>
								<span class="text-[13px] font-black text-white italic tracking-wide">${a.fecha_vencimiento || '--/--/--'}</span>
							</div>
						</div>
						
						<!-- Botón Editar con icono edit-3 -->
						<button onclick="openEditAlumno(${a.id})" class="p-4 bg-white/5 text-white rounded-2xl hover:bg-red-600 hover:text-black transition-all action-col border border-white/5 shadow-xl">
							<i data-lucide="edit-3" class="w-5 h-5"></i>
						</button>
					</div>
				</div>`;
			}
		}

		/**
		 * 1. CARGA DE PLANES Y TIPOS
		 * Mantiene tu lógica de filtros pero agrega la inicialización de los selectores del modal.
		 */
        async function loadPlanes() {
			const p = await apiFetch('/planes'); 
			const t = await apiFetch('/tipos-planes');
			
			state.planes = Array.isArray(p) ? p : []; 
			state.tiposPlanes = Array.isArray(t) ? t : [];
			
			// Configuración de los filtros de la pestaña de Planes
			const filterContainer = document.getElementById('planes-filter-container'); 
			if (filterContainer) {
				filterContainer.innerHTML = ''; 
				state.tiposPlanes.forEach((tipo, idx) => { 
					filterContainer.innerHTML += `<button onclick="filterPlanes(${tipo.id}, this)" class="filter-btn ${idx === 0 ? 'active' : ''}">${tipo.nombre.toUpperCase()}</button>`; 
				});
				if (state.tiposPlanes.length > 0) {
					filterPlanes(state.tiposPlanes[0].id, filterContainer.children[0]);
				}
			}

			// Llenar el primer paso del modal de alumnos (Tipo de Membresía)
			initAlumnoPlanSelectors();

			// Actualizar selector de tipos en el modal de edición de planes
			const selectPlanTipo = document.getElementById('plan-tipo');
			if (selectPlanTipo) {
				selectPlanTipo.innerHTML = state.tiposPlanes.map(t => `<option value="${t.id}">${t.nombre.toUpperCase()}</option>`).join('');
			}
		}

		/**
		 * 2. FLUJO DE SELECCIÓN DE PLAN (MODAL ALUMNO)
		 * Reemplaza la selección simple por una filtrada por Tipo.
		 */
		function initAlumnoPlanSelectors() {
			const selectTipo = document.getElementById('al-tipo-plan');
			if (selectTipo) {
				selectTipo.innerHTML = '<option value="">1. SELECCIONAR TIPO...</option>' + 
					state.tiposPlanes.map(t => `<option value="${t.id}">${t.nombre.toUpperCase()}</option>`).join('');
			}
			const selectPlan = document.getElementById('al-plan');
			if (selectPlan) selectPlan.innerHTML = '<option value="">2. ESPERANDO TIPO...</option>';
		}

		function filterPlanesByTipo() {
			const tipoId = document.getElementById('al-tipo-plan').value;
			const planSelect = document.getElementById('al-plan');
			const valorDisplay = document.getElementById('al-plan-valor-display');
			
			if (!tipoId) {
				planSelect.innerHTML = '<option value="">2. ESPERANDO TIPO...</option>';
				if (valorDisplay) valorDisplay.classList.add('hidden');
				return;
			}

			// Filtramos los planes del estado global por el ID del tipo seleccionado
			const filtrados = state.planes.filter(p => p.tipo_plan_id == tipoId);
			
			planSelect.innerHTML = '<option value="">2. SELECCIONAR PLAN...</option>' + 
				filtrados.map(p => `<option value="${p.id}">${p.nombre.toUpperCase()}</option>`).join('');
			
			if (valorDisplay) valorDisplay.classList.add('hidden');
		}
		/**
		 * Muestra el cuadro de precios para confirmar antes de guardar
		 */
		function showPlanValue() {
			const planId = document.getElementById('al-plan').value;
			const container = document.getElementById('al-plan-valor-display');
			
			if (!planId) {
				if (container) container.classList.add('hidden');
				return;
			}

			const plan = state.planes.find(p => p.id == planId);
			if (plan && container) {
				container.innerHTML = `
					<div class="flex flex-wrap gap-4 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl animate-in fade-in zoom-in-95">
						<div class="flex-1 min-w-[80px]">
							<p class="text-[8px] font-black text-white/40 uppercase">Efectivo</p>
							<p class="text-sm font-black text-green-500">$${(plan.efectivo || 0).toLocaleString()}</p>
						</div>
						<div class="flex-1 min-w-[80px]">
							<p class="text-[8px] font-black text-white/40 uppercase">Transf.</p>
							<p class="text-sm font-black text-blue-400">$${(plan.transferencia || 0).toLocaleString()}</p>
						</div>
						<div class="flex-1 min-w-[80px]">
							<p class="text-[8px] font-black text-white/40 uppercase">Tarjeta</p>
							<p class="text-sm font-black text-purple-400">$${(plan.debito_credito || 0).toLocaleString()}</p>
						</div>
					</div>
				`;
				container.classList.remove('hidden');
			}
			
			updateExpirationDate();
		}

		/**
		 * 3. CÁLCULO DE VENCIMIENTO
		 * Reemplaza a 'autoCalculateExpiry'. Ahora usa los días exactos de la DB.
		 */
		function updateExpirationDate() {
			const planId = document.getElementById('al-plan').value;
			const renovDate = document.getElementById('al-fecha-renovacion').value;
			const inputVenc = document.getElementById('al-fecha-vencimiento');

			if(!planId || !renovDate || !inputVenc) return;

			const plan = state.planes.find(p => p.id == planId);
			if (!plan) return;

			// Obtenemos los días desde el tipo de plan cargado en la relación
			const dias = plan.tipo?.duracion_dias || 30;
			
			let d = new Date(renovDate + 'T12:00:00'); // T12 para evitar errores de zona horaria
			d.setDate(d.getDate() + dias);
			
			inputVenc.value = d.toISOString().split('T')[0];
		}

        function filterPlanes(tipoId, btn) {
			// 1. Manejo de estados visuales de los botones de filtro
			document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); 
			if(btn) btn.classList.add('active');

			// 2. Filtrado por tipo
			const filtered = state.planes.filter(p => p.tipo_plan_id === tipoId);
			
			// 3. Permisos de edición
			const hideEdit = (state.user?.rol_nombre === "Profesor" || state.user?.rol_nombre === "Alumno" || state.user?.rol_nombre === "Administracion");
			
			// 4. Renderizado de tarjetas con los 3 NUEVOS PRECIOS
			document.getElementById('planes-container').innerHTML = filtered.map(p => `
				<div class="glass-card p-8 rounded-[2.5rem] flex flex-col border border-white/5 relative text-left hover:border-red-600/20 transition-all group">
					${hideEdit ? '' : `
						<button onclick="openEditPlan(${p.id})" class="absolute top-6 right-6 text-white/20 hover:text-red-600 transition-colors">
							<i data-lucide="edit-3" class="w-5 h-5"></i>
						</button>
					`}
					
					<span class="text-[10px] font-black text-red-600 uppercase italic tracking-widest mb-2">
						${p.tipo?.nombre || 'PLAN'}
					</span>
					
					<h4 class="text-xl font-black uppercase italic mb-6 leading-tight text-white group-hover:text-red-500 transition-colors">
						${p.nombre}
					</h4>

					<!-- BLOQUE DE PRECIOS MULTIMODAL -->
					<div class="space-y-3 bg-black/40 p-5 rounded-3xl border border-white/5 mb-6">
						<div class="flex justify-between items-center">
							<span class="text-[10px] font-bold text-white/30 uppercase italic">Efectivo</span>
							<span class="text-lg font-black text-green-500">$${(p.efectivo || 0).toLocaleString()}</span>
						</div>
						<div class="flex justify-between items-center border-t border-white/5 pt-3">
							<span class="text-[10px] font-bold text-white/30 uppercase italic">Transferencia</span>
							<span class="text-lg font-black text-blue-400">$${(p.transferencia || 0).toLocaleString()}</span>
						</div>
						<div class="flex justify-between items-center border-t border-white/5 pt-3">
							<span class="text-[10px] font-bold text-white/30 uppercase italic">Tarjeta / Débito</span>
							<span class="text-lg font-black text-purple-400">$${(p.debito_credito || 0).toLocaleString()}</span>
						</div>
					</div>

					<div class="flex items-center gap-2 text-white/20">
						<i data-lucide="check-circle-2" class="w-3 h-3"></i>
						<span class="text-[10px] font-bold uppercase italic">${p.clases_mensuales || 0} Créditos mensuales</span>
					</div>
				</div>
			`).join('');

			if (window.lucide) lucide.createIcons();
			applyPermissions();
		}

        /**
		 * RENDERIZADO DE STOCK CON IMÁGENES (PUNTO 5)
		 */
		window.loadStock = async function() {
			const data = await apiFetch('/stock');
			
			// 1. Sincronizamos los datos en ambos estados para que el HTML y el JS lo vean
			const stockData = Array.isArray(data) ? data : [];
			
			// Actualizamos el state local del script
			state.stock = stockData; 
			
			// Actualizamos el window.state global para que el HTML lo vea
			window.state = window.state || {}; 
			window.state.stock = stockData;    

			const container = document.getElementById('stock-container');
			if (!container) return;

			if (state.stock.length === 0) {
				container.innerHTML = `
					<div class="col-span-full py-20 text-center opacity-20">
						<i data-lucide="package-x" class="w-16 h-16 mx-auto mb-4"></i>
						<p class="font-black uppercase italic tracking-widest">Sin provisiones</p>
					</div>`;
			} else {
				container.innerHTML = state.stock.map(s => {
					const stockBajo = s.stock_actual <= 5;
					let finalImgUrl;

					const imgData = s.url_imagen || s.url_images || s.imagen || "";

					if (imgData && imgData.startsWith('http')) {
						finalImgUrl = imgData;
					} else if (imgData && imgData.length > 100) {
						finalImgUrl = imgData; 
					} else {
						const n = (s.nombre_producto || "").trim().split(' ');
						const clave = n[n.length - 1].toLowerCase();
						finalImgUrl = `https://github.com/vikingo-44/Software-Gym/blob/main/imagenes/${clave}.png?raw=true`;
					}

					return `
					<div class="glass-card p-4 rounded-[2.5rem] border-white/5 flex flex-col gap-4 hover:border-red-600/30 transition-all group relative overflow-hidden shadow-xl">
						<div class="w-full h-40 rounded-[1.8rem] overflow-hidden bg-black/40 relative group">
							<img src="${finalImgUrl}" 
								class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700"
								onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
							
							<div class="hidden absolute inset-0 bg-zinc-900 items-center justify-center flex-col gap-2">
								<i data-lucide="package" class="w-8 h-8 text-white/10"></i>
								<span class="text-[8px] font-black uppercase text-white/20">Sin Imagen</span>
							</div>

							<div class="absolute top-3 right-3 bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-black text-white italic">
								$ ${s.precio_venta.toLocaleString()}
							</div>
						</div>
						<div class="px-2 pb-2">
							<h4 class="text-[13px] font-black uppercase italic text-white truncate mb-3 tracking-tight">${s.nombre_producto}</h4>
							<div class="flex items-center justify-between">
								<div class="flex flex-col">
									<span class="text-[8px] text-white-500 font-black uppercase tracking-widest leading-none mb-1">Stock disponible</span>
									<span class="text-sm font-black italic ${stockBajo ? 'text-red-500 animate-pulse' : 'text-white'}">
										${s.stock_actual} <span class="text-[9px] opacity-40 uppercase">unidades</span>
									</span>
								</div>
								<button onclick="openEditStock(${s.id})" 
										class="w-10 h-10 grid place-items-center bg-white/5 rounded-xl border border-white/5 text-gray-400 hover:bg-red-600 hover:text-black hover:scale-110 transition-all p-0">
									<i data-lucide="edit-3" class="w-5 h-5"></i>
								</button>
							</div>
						</div>
					</div>`;
				}).join('');
			}
			
			if (window.lucide) lucide.createIcons();
		};

		window.loadStock = loadStock;
		
		// FUNCIÓN PARA PREVISUALIZAR Y CONVERTIR A BASE64
		function previewStockImage(event) {
			const file = event.target.files[0];
			if (!file) return;

			if (file.size > 2 * 1024 * 1024) { // Límite 2MB
				showVikingToast("La imagen es muy pesada (Máx 2MB)", true);
				return;
			}

			const reader = new FileReader();
			reader.onload = function(e) {
				const base64 = e.target.result;
				document.getElementById('stock-imagen-base64').value = base64;
				
				const preview = document.getElementById('stock-img-preview');
				preview.src = base64;
				preview.classList.remove('hidden');
				document.getElementById('stock-img-placeholder').classList.add('hidden');
			};
			reader.readAsDataURL(file);
		}

        async function loadClases() {
			const data = await apiFetch('/clases'); 
			const todasLasClases = Array.isArray(data) ? data : [];

			// Capturamos el filtro seleccionado en la interfaz
			const filtroSede = document.getElementById('filtro-clases-sucursal')?.value || 'todas';
			const rol = (state.user.rol_nombre || "").toLowerCase().trim();

			// ⚔️ ROLES AUTORIZADOS PARA VER MULTI-SEDE
			const rolesConPermisoVista = ["administrador", "supervisor", "staff", "administrativo", "administracion", "alumno"];

			// FILTRO DE VISIBILIDAD COMBINADO
			state.clases = todasLasClases.filter(c => {
				// 🛡️ REGLA 1: Si el rol NO está en la lista blanca, queda bloqueado a su sucursal_id
				if (!rolesConPermisoVista.includes(rol)) {
					return c.sucursal_id === state.user.sucursal_id;
				}
				
				// 👑 REGLA 2: Si el rol está autorizado, responde dinámicamente al selector
				if (filtroSede === 'todas') return true;
				return c.sucursal_id == filtroSede;
			});

			const container = document.getElementById('clases-container');
			if (!container) return;

			if (state.clases.length === 0) {
				container.innerHTML = `
					<div class="col-span-full p-16 border border-dashed border-white/10 rounded-[3rem] text-center bg-white/2">
						<i data-lucide="calendar-x-2" class="w-12 h-12 mx-auto mb-4 text-white/10"></i>
						<p class="text-[12px] text-gray-600 font-black uppercase italic tracking-[0.2em]">No hay clases en esta sede</p>
						<p class="text-[10px] text-gray-700 mt-2 font-bold">Cambia el filtro o usa "Alta de Clase".</p>
					</div>`;
			} else {
				const canEdit = (rol === "administrador" || rol === "supervisor");
				
				container.innerHTML = state.clases.map(c => `
					<div class="glass-card p-6 rounded-[2.5rem] border border-white/5 flex flex-col justify-between hover:border-red-600/20 transition-all group">
						<div>
							<div class="flex items-center gap-4 mb-6">
								<div class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-black text-sm italic shadow-lg" style="background-color: ${c.color || '#FF0000'}">
									${c.nombre ? c.nombre[0].toUpperCase() : '?'}
								</div>
								<div>
									<h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors">${c.nombre}</h4>
									<p class="text-[10px] text-white-500 font-bold uppercase tracking-wider flex items-center gap-1">
										<i data-lucide="user" class="w-3 h-3"></i> ${c.coach || 'Sin Coach'}
									</p>
								</div>
							</div>
						</div>

						${canEdit ? `
						<button onclick="openEditClase(${c.id})" class="w-full py-4 bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase italic hover:bg-white/10 hover:text-red-600 transition-all flex items-center justify-center gap-2 border border-white/5">
							<i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
							Configuración Técnica
						</button>
						` : '<p class="text-[9px] text-gray-700 italic text-center">Solo lectura</p>'}
					</div>
				`).join('');
			}

			// Refrescar iconos
			if (window.lucide) lucide.createIcons();
			
			// Si estamos viendo el calendario, lo sincronizamos
			if(document.getElementById('view-calendario')?.classList.contains('active')) {
				renderCalendar();
			}
			
			// Aplicamos permisos de UI adicionales
			if (typeof applyPermissions === 'function') applyPermissions();
		}
		
		async function loadProfesores() {
			// Esta función llena la memoria con los profesores para usarlos en el select de turnos
			const res = await apiFetch('/profesores');
			state.profesores = (!res.error && Array.isArray(res)) ? res : [];
		}

        function openModalAlumno() { 
			document.getElementById('modal-alumno-title').innerText = "Nuevo Alumno"; 
			document.getElementById('al-id').value = ""; 
			document.getElementById('al-fecha-renovacion').value = new Date().toISOString().split('T')[0]; 
			
			// Resetear sucursal
			if(document.getElementById('al-sucursal')) document.getElementById('al-sucursal').value = "";
			
			loadSucursales();
			if (typeof openModal === 'function') openModal('modal-alumno'); 
		}

        	function openEditAlumno(id) {
				// 1. Buscamos al guerrero en el estado global
				const al = state.alumnos.find(x => x.id == id); 
				if(!al) return;
				
				// 2. Carga de datos básicos en el modal
				document.getElementById('modal-alumno-title').innerText = al.nombre_completo;
				document.getElementById('al-id').value = al.id; 
				document.getElementById('al-nombre').value = al.nombre_completo; 
				document.getElementById('al-dni').value = al.dni;
				document.getElementById('al-email').value = al.email || ""; 
				document.getElementById('al-telefono').value = al.telefono || "";
				document.getElementById('al-genero').value = al.genero || "Masculino";

				const selSuc = document.getElementById('al-sucursal');
				if(selSuc) selSuc.value = al.sucursal_id || "";
				
				document.getElementById('al-peso').value = al.peso || "";
				document.getElementById('al-altura').value = al.altura || ""; 
				document.getElementById('al-imc').value = al.imc || ""; 

				// 3. ⚔️ FUNCIÓN DE LIMPIEZA VIKINGA
				// Asegura que el formato sea exactamente YYYY-MM-DD para el input date
				const limpiarFecha = (fecha) => {
					if (!fecha) return "";
					// Extraemos solo los primeros 10 caracteres (YYYY-MM-DD)
					// Esto previene errores si la fecha viene con hora o formato ISO completo
					return fecha.toString().substring(0, 10);
				};

				// 4. ⚔️ CARGA FORZADA DE FECHAS
				// Usamos un timeout para asegurar que el modal esté listo para recibir los valores
				setTimeout(() => {
					const valNac = limpiarFecha(al.fecha_nacimiento);
					const valCert = limpiarFecha(al.fecha_certificado);

					const inputNac = document.getElementById('al-fecha-nacimiento');
					const inputCert = document.getElementById('al-fecha-certificado');

					if (inputNac) {
						inputNac.value = valNac;
					}
					if (inputCert) {
						inputCert.value = valCert;
					}
					
					// Log de control para verificar que el dato llegó al modal
					console.log("Fechas cargadas en modal:", { nacimiento: valNac, certificado: valCert });
				}, 100);

				document.getElementById('al-certificado-entregado').checked = al.certificado_entregado || false;
				
				// 5. Control de permisos para eliminar (Solo Admin o Supervisor)
				const delBtn = document.getElementById('btn-delete-alumno'); 
				if(state.user && (state.user.rol_nombre === "Administrador" || state.user.rol_nombre === "Supervisor")) {
					delBtn.classList.remove('hidden');
				} else {
					delBtn.classList.add('hidden');
				}
				delBtn.onclick = () => deleteRecord('alumnos', id, 'modal-alumno', fetchAlumnos);
				
				// 6. Preparación final del modal
				if (typeof loadSucursales === 'function') loadSucursales();
				if (typeof setAlumnoTab === 'function') setAlumnoTab('personal');
				if (typeof openModal === 'function') openModal('modal-alumno');
			}

		window.setAlumnoTab = function(tab) {
			// 1. Ocultar todos los contenidos de las solapas
			document.querySelectorAll('.alumno-tab-content').forEach(content => {
				content.classList.add('hidden');
			});
			
			// 2. Mostrar la solapa seleccionada
			const selectedContent = document.getElementById('tab-alumno-' + tab);
			if (selectedContent) {
				selectedContent.classList.remove('hidden');
			}

			// 3. Resetear estilos de los botones (Todos opacos y sin borde)
			document.querySelectorAll('.alumno-tab-btn').forEach(btn => {
				btn.classList.remove('border-red-600', 'text-white');
				btn.classList.add('border-transparent', 'text-white/20');
			});

			// 4. Resaltar el botón activo (Buscamos por ID)
			const activeBtn = document.getElementById('btn-tab-' + tab);
			if (activeBtn) {
				activeBtn.classList.remove('border-transparent', 'text-white/20');
				activeBtn.classList.add('border-red-600', 'text-white');
			}

			// Obtenemos el ID del alumno del input oculto del modal
			const alId = document.getElementById('al-id').value;
			if (!alId) return; // Si es un alumno nuevo, no cargamos historiales

			// 5. Lógica específica para la pestaña de Suscripción/Pagos
			// 5. Lógica específica para la pestaña de Suscripción/Pagos
            if (tab === 'suscripcion') {
                const al = state.alumnos.find(x => x.id == alId);
                
                if (al) {
                    // ⚔️ CONTROL DE EXTRACTO VIKINGO: Buscamos el plan por el nuevo objeto anidado o por plan_id si existiera
                    const idDelPlan = al.plan_id || (al.plan ? al.plan.id : null);
                    const planActual = state.planes.find(p => p.id == idDelPlan);
                    
                    // Si el plan existe en state.planes tiene la propiedad 'tipo', sino intentamos leer de la data viva del alumno
                    const nombreMembresia = (planActual && planActual.tipo) ? planActual.tipo.nombre : "MEMBRESÍA";
                    
                    // Si no encuentra el plan en la lista global, usamos el objeto directo inyectado en el alumno
                    const textoNombrePlan = planActual ? planActual.nombre : (al.plan ? al.plan.nombre : "SIN PLAN ASIGNADO");
                    
                    // Actualizamos los textos en el modal
                    const elTipo = document.getElementById('info-plan-tipo');
                    const elNombre = document.getElementById('info-plan-nombre');
                    const elVence = document.getElementById('info-plan-vence');

                    if(elTipo) elTipo.innerText = nombreMembresia.toUpperCase();
                    if(elNombre) elNombre.innerText = textoNombrePlan.toUpperCase();
                    if(elVence) elVence.innerText = al.fecha_vencimiento || "---";
                    
                    // Cargamos el historial de pagos de caja desde la API
                    if (typeof loadAlumnoHistorial === 'function') {
                        loadAlumnoHistorial(alId);
                    }
                }
            }

			// ⚔️ 6. Lógica específica para la pestaña de COMPROBANTES (NUEVA)
			if (tab === 'comprobantes') {
				// Llamamos a la función que busca las Facturas A en la tabla 'comprobantes'
				if (typeof loadComprobantesAlumno === 'function') {
					loadComprobantesAlumno(alId);
				} else {
					console.error("La función loadComprobantesAlumno no está definida.");
				}
			}
		};

		async function loadAlumnoHistorial(alumnoId) {
			const contenedor = document.getElementById('historial-pagos-lista');
			if(!contenedor) return;

			contenedor.innerHTML = '<p class="text-[10px] italic text-white/20">Cargando historial...</p>';
			
			// Llamada a la API
			const res = await apiFetch(`/alumnos/${alumnoId}/historial-pagos`);
			
			// Si res no es un array, lo convertimos en lista vacía (evita error .map)
			const pagos = Array.isArray(res) ? res : [];
			
			if(pagos.length === 0) {
				contenedor.innerHTML = `
					<div class="py-10 text-center opacity-20">
						<i data-lucide="receipt-text" class="w-8 h-8 mx-auto mb-2"></i>
						<p class="text-[10px] italic uppercase font-black tracking-widest">Sin registros de pago</p>
					</div>`;
				if(window.lucide) lucide.createIcons();
				return;
			}

			contenedor.innerHTML = pagos.map(p => {
				// Aseguramos que el monto sea un número para que no rompa el toLocaleString
				const montoNum = parseFloat(p.monto) || 0;
				
				return `
					<div class="flex justify-between items-center p-4 bg-white/[0.03] rounded-2xl border border-white/5 mb-2 hover:border-green-500/30 transition-all">
						<div class="text-left">
							<p class="text-[10px] font-black uppercase italic text-white">${p.descripcion}</p>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-[8px] text-white/40 uppercase font-bold">${p.fecha}</span>
								<span class="w-1 h-1 rounded-full bg-white/10"></span>
								<span class="text-[8px] text-green-500/60 uppercase font-black">${p.metodo}</span>
							</div>
							${p.nota ? `<p class="text-[8px] text-red-600/60 italic mt-1 font-bold">Nota: ${p.nota}</p>` : ''}
						</div>
						<div class="text-right">
							<p class="text-[12px] font-black text-green-500 italic">$ ${montoNum.toLocaleString()}</p>
						</div>
					</div>
				`;
			}).join('');
			
			if(window.lucide) lucide.createIcons();
		}

		async function loadComprobantesAlumno(alumnoId) {
			const lista = document.getElementById('historial-comprobantes-lista');
			lista.innerHTML = '<p class="text-center text-white/20 text-[10px] py-10 italic">Buscando en los archivos...</p>';

			try {
				// Llamada al endpoint que creamos en el Backend
				const comprobantes = await apiFetch(`/comprobantes/usuario/${alumnoId}`, 'GET');

				if (!comprobantes || comprobantes.length === 0) {
					lista.innerHTML = '<p class="text-center text-white/20 text-[10px] py-10 italic uppercase">No hay facturas registradas para este guerrero.</p>';
					return;
				}

				lista.innerHTML = comprobantes.map(c => {
					const fecha = new Date(c.fecha_emision).toLocaleDateString();
					
					return `
					<div class="glass-card p-4 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-red-600/30 transition-all">
						<div class="flex items-center gap-4">
							<div class="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center text-red-500">
								<i data-lucide="file-text" class="w-5 h-5"></i>
							</div>
							<div>
								<p class="text-[11px] font-black text-white italic uppercase tracking-tighter">${c.nro_factura}</p>
								<p class="text-[9px] text-white/40 font-bold uppercase">${fecha} • ${c.metodo_pago}</p>
							</div>
						</div>

						<div class="flex gap-2">
							<button onclick='reimprimirFactura(${JSON.stringify(c)})' class="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all" title="Ver / Imprimir">
								<i data-lucide="printer" class="w-4 h-4"></i>
							</button>
							
							<button onclick='enviarFacturaWhatsApp(${JSON.stringify(c)})' class="p-2 bg-green-600/10 rounded-lg text-green-500 hover:bg-green-600 hover:text-black transition-all" title="Enviar por WhatsApp">
								<i data-lucide="message-circle" class="w-4 h-4"></i>
							</button>
						</div>
					</div>`;
				}).join('');

				if (window.lucide) lucide.createIcons();

			} catch (err) {
				console.error("Error al cargar comprobantes:", err);
				lista.innerHTML = '<p class="text-center text-red-500 text-[10px] py-10 uppercase">Error al conectar con el servidor.</p>';
			}
		}

		// Función para volver a abrir el PDF generado anteriormente
		window.reimprimirFactura = (c) => {
			// Buscamos el alumno actual en el estado para tener sus datos (DNI, Nombre)
			const alumno = state.alumnos.find(a => a.id === c.usuario_id);
			
			window.generateFacturaA({
				alumno: alumno,
				items: [{ nombre: c.plan_nombre_snapshot, precio: c.monto_total, cantidad: 1 }],
				total: c.monto_total,
				metodo: c.metodo_pago,
				ticket: c.nro_ticket_postnet,
				nro_oficial: c.nro_factura // Usamos el Nro que ya estaba en la DB
			});
		};

		// Función para enviar por WhatsApp
		window.enviarFacturaWhatsApp = (comprobante) => {
			try {
				// 1. Buscamos al alumno en el estado global
				// Usamos == para evitar problemas si uno es string y el otro number
				const alumno = state.alumnos.find(a => a.id == comprobante.usuario_id);
				
				if (!alumno || !alumno.telefono) {
					showVikingToast("El guerrero no tiene teléfono registrado.", true);
					return;
				}

				// 2. Formateo de teléfono robusto
				let tel = alumno.telefono.replace(/\D/g, '');
				// Si tiene 10 dígitos (ej: 11...), le ponemos el prefijo de Argentina
				if (tel.length === 10) tel = '549' + tel;

				// ⚔️ 3. URL DE VISUALIZACIÓN (Sincronizada con el Backend)
				// Importante: Usamos /view para que FastAPI devuelva el HTML y no el error 404
				const compId = comprobante.id || comprobante.pago_id; 
				const urlVisualizacion = `https://gymfit-pro.onrender.com/api/comprobantes/${compId}/view`;

				// 4. Construcción del mensaje
				const texto = `*GYMFIT PRO* ⚔️\n\n` +
							`Hola *${alumno.nombre_completo}*, confirmamos la recepción de tu pago:\n\n` +
							`• *Factura:* ${comprobante.nro_factura}\n` +
							`• *Detalle:* ${comprobante.plan_nombre_snapshot}\n` +
							`• *Monto:* $${parseFloat(comprobante.monto_total).toLocaleString()}\n\n` +
							`📥 *Mirá tu comprobante aquí:* \n${urlVisualizacion}\n\n` +
							`¡Gracias por entrenar con nosotros!`;

				const urlWA = `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`;

				// 5. Intento de apertura directa
				console.log("Abriendo WhatsApp: ", urlVisualizacion);
				const win = window.open(urlWA, '_blank');
				
				if (!win) {
					// Plan B: Trigger invisible para saltar bloqueadores de pop-ups
					const trigger = document.getElementById('whatsapp-trigger');
					if (trigger) {
						trigger.href = urlWA;
						trigger.click();
					} else {
						alert("⚠️ Por favor, habilitá los pop-ups para enviar el WhatsApp.");
					}
				}
			} catch (error) {
				console.error("Error en enviarFacturaWhatsApp:", error);
				showVikingToast("Error al procesar el mensaje", true);
			}
		};
        document.getElementById('form-alumno').onsubmit = async (e) => {
			e.preventDefault(); 
			
			const id = document.getElementById('al-id').value;
			
			const data = { 
				nombre_completo: document.getElementById('al-nombre').value, 
				dni: document.getElementById('al-dni').value, 
				email: document.getElementById('al-email').value,
				telefono: document.getElementById('al-telefono').value,
				genero: document.getElementById('al-genero').value,
				sucursal_id: parseInt(document.getElementById('al-sucursal').value) || null, 
				peso: parseFloat(document.getElementById('al-peso').value) || null, 
				altura: parseFloat(document.getElementById('al-altura').value) || null, 
				imc: parseFloat(document.getElementById('al-imc').value) || null,  
				fecha_nacimiento: document.getElementById('al-fecha-nacimiento').value || null, 
				fecha_certificado: document.getElementById('al-fecha-certificado').value || null, 
				certificado_entregado: document.getElementById('al-certificado-entregado').checked 
			};
			
			const pass = document.getElementById('al-pass').value; 
			if (pass) data.password = pass;
			
			const res = await apiFetch(id ? `/alumnos/${id}` : '/alumnos', id ? 'PUT' : 'POST', data);
			
			if (!res.error) { 
				closeModal('modal-alumno'); 
				
				// ⚔️ CRUCIAL: Esperamos a que los datos nuevos bajen del servidor
				await fetchAlumnos(); 
				
				// Notificación Vikinga
				const msg = id ? "Guerrero Actualizado" : "Nuevo Guerrero Reclutado";
				if (typeof showVikingToast === 'function') {
					showVikingToast(msg); 
				} else if (typeof showToast === 'function') {
					showToast(msg);
				}
			} else {
				if (typeof showVikingToast === 'function') showVikingToast(res.error, true);
			}
		};

        async function openModalStaff(rol) {
			document.getElementById('modal-staff-title').innerText = "Alta " + rol;
			document.getElementById('stf-id').value = "";
			document.getElementById('stf-rol').value = rol;

			// Si por alguna razón están vacías, las pedimos antes de llenar el select
			if (!state.sucursales || state.sucursales.length === 0) {
				state.sucursales = await apiFetch('/sucursales');
			}

			fillSucursalSelect('stf-sucursal');
			openModal('modal-staff');
		}

        function openEditStaff(id, rol) {
			const user = (rol === 'Profesor' ? state.profesores : state.administrativos).find(x => x.id == id);
			if(!user) return;
			
			document.getElementById('modal-staff-title').innerText = "Editar " + rol;
			document.getElementById('stf-id').value = user.id;
			document.getElementById('stf-rol').value = rol;
			document.getElementById('stf-nombre').value = user.nombre_completo;
			document.getElementById('stf-dni').value = user.dni;
			document.getElementById('stf-esp').value = user.especialidad || "";
			document.getElementById('stf-pass').required = false; // Opcional en edición

			// Llenar select y seleccionar la sucursal actual del usuario
			fillSucursalSelect('stf-sucursal', user.sucursal_id);

			const delBtn = document.getElementById('btn-delete-staff');
			if(state.user.rol_nombre === "Administrador" || state.user.rol_nombre === "Supervisor") delBtn.classList.remove('hidden');
			delBtn.onclick = () => deleteRecord('staff', id, 'modal-staff', loadStaff);
			
			openModal('modal-staff');
		}

        document.getElementById('form-staff').onsubmit = async (e) => {
			e.preventDefault();
			const id = document.getElementById('stf-id').value;
			const rol = document.getElementById('stf-rol').value;
			
			const data = { 
				nombre_completo: document.getElementById('stf-nombre').value, 
				dni: document.getElementById('stf-dni').value, 
				especialidad: document.getElementById('stf-esp').value, 
				perfil_nombre: rol,
				sucursal_id: document.getElementById('stf-sucursal').value // <--- LO NUEVO
			};
			
			const pass = document.getElementById('stf-pass').value;
			if(pass) data.password = pass;

			const res = await apiFetch(id ? `/staff/${id}` : '/staff', id ? 'PUT' : 'POST', data);
			if(!res.error) { 
				closeModal('modal-staff'); 
				loadStaff(); 
				showVikingToast("Personal Guardado Correctamente"); 
			}
		};

		// Función auxiliar para no repetir código
		function fillSucursalSelect(selectId, selectedId = null) {
			const select = document.getElementById(selectId);
			if (!select) return;

			select.innerHTML = '<option value="">Seleccionar Sucursal...</option>';

			// Verificamos que state.sucursales exista y sea un array
			if (state.sucursales && Array.isArray(state.sucursales)) {
				state.sucursales.forEach(s => {
					const opt = document.createElement('option');
					opt.value = s.id;
					opt.textContent = s.sucursal;
					if (selectedId && s.id == selectedId) opt.selected = true;
					select.appendChild(opt);
				});
			} else {
				console.error("❌ Error: state.sucursales no está definido o no es un array.");
				// Opcional: intentar cargar sucursales si están vacías
				if (typeof loadSucursales === 'function') loadSucursales();
			}
		}

		// SECCION PLANES
		// Alta de Plan Nuevo
			function openModalPlan() { 
				document.getElementById('form-plan').reset();
				document.getElementById('plan-id').value = ""; 
				
				// Valores por defecto
				const elClases = document.getElementById('plan-clases');
				if(elClases) elClases.value = "12"; 
				
				document.getElementById('modal-plan-title').innerText = "Nuevo Plan Maestro"; 
				document.getElementById('btn-delete-plan').classList.add('hidden');
				openModal('modal-plan'); 
			}

        // Función para editar un plan existente
			function openEditPlan(id) {
				const p = state.planes.find(x => x.id == id); 
				if(!p) return;

				document.getElementById('plan-id').value = p.id; 
				document.getElementById('plan-nombre').value = p.nombre; 
				document.getElementById('plan-tipo').value = p.tipo_plan_id; 
				
				// CAMBIO CRÍTICO: p.precio ya no existe, ahora es p.efectivo
				document.getElementById('plan-efectivo').value = p.efectivo || 0;
				document.getElementById('plan-transferencia').value = p.transferencia || 0;
				document.getElementById('plan-debito').value = p.debito_credito || 0;
				
				const elClases = document.getElementById('plan-clases');
				if(elClases) elClases.value = p.clases_mensuales || 0;

				const delBtn = document.getElementById('btn-delete-plan'); 
				if(state.user.rol_nombre === "Administrador" || state.user.rol_nombre === "Supervisor") {
					delBtn.classList.remove('hidden');
					delBtn.onclick = () => deleteRecord('planes', p.id, 'modal-plan', loadPlanes);
				} else {
					delBtn.classList.add('hidden');
				}
				
				document.getElementById('modal-plan-title').innerText = "Editar Plan: " + p.nombre;
				openModal('modal-plan');
			}

        // Lógica de envío del formulario de planes
			document.getElementById('form-plan').onsubmit = async (e) => {
				e.preventDefault(); 
				const id = document.getElementById('plan-id').value;
				
				// ⚔️ CONFIGURACIÓN SINCRO: Enviamos las propiedades exactas que espera PlanUpdate en Pydantic
				const data = { 
					nombre: document.getElementById('plan-nombre').value, 
					efectivo: parseFloat(document.getElementById('plan-efectivo').value || 0), 
					transferencia: parseFloat(document.getElementById('plan-transferencia').value || 0), 
					debito_credito: parseFloat(document.getElementById('plan-debito').value || 0), // Volvemos al nombre correcto
					tipo_plan_id: parseInt(document.getElementById('plan-tipo').value),
					clases_mensuales: parseInt(document.getElementById('plan-clases').value || 0) 
				};
				
				const res = await apiFetch(id ? `/planes/${id}` : '/planes', id ? 'PUT' : 'POST', data);
				
				if(!res.error) { 
					closeModal('modal-plan'); 
					loadPlanes(); 
					showVikingToast("Plan Guardado ⚔️"); 
				} else {
					showVikingToast(res.error, true);
				}
			};

		// ==========================================
		// 2. MOTOR DE CRÉDITOS (INFALIBLE)
		// ==========================================

		 /**
		 * Calcula el estado de créditos de un alumno.
		 * Prioriza el campo numérico 'clases_mensuales' de la base de datos.
		 */
		function calcularEstadoCreditosVikingo(usuario, todasLasReservas) {
			if (!usuario || !usuario.plan) {
				return { disponible: 0, total: 0, usado: 0, esFull: false, vencido: true };
			}

			// 1. Cupo total directo de la DB (144, 72, 36, 24, etc.)
			let limiteTotal = parseInt(usuario.plan.clases_mensuales, 10) || 0;
			
			// ⚔️ LA ÚNICA REGLA: Si pusiste 999 en la DB es Infinito. Todo lo demás es número real.
			// Eliminamos CUALQUIER otra validación por texto o palabra clave.
			const esFull = (limiteTotal === 999);

			// 2. Límites del ciclo real del pase del alumno
			const inicioPase = usuario.fecha_ultima_renovacion ? new Date(usuario.fecha_ultima_renovacion) : new Date();
			inicioPase.setHours(0,0,0,0);
			
			const finPase = usuario.fecha_vencimiento ? new Date(usuario.fecha_vencimiento) : new Date();
			finPase.setHours(23,59,59,999);

			// 3. Contamos las reservas del ciclo contratado
			const reservasDelCiclo = todasLasReservas.filter(res => {
				const esMismoUsuario = String(res.usuario_id) === String(usuario.id) || (res.alumno_dni && String(res.alumno_dni) === String(usuario.dni));
				if (!esMismoUsuario) return false;
				
				const fechaRes = new Date(res.fecha_clase || res.fecha);
				return fechaRes >= inicioPase && fechaRes <= finPase;
			});

			const usado = reservasDelCiclo.length;
			
			const hoy = new Date();
			hoy.setHours(0,0,0,0);
			const estaVencido = new Date(usuario.fecha_vencimiento) < hoy;

			return {
				disponible: esFull ? "∞" : Math.max(0, limiteTotal - usado),
				total: esFull ? "LIBRE" : limiteTotal,
				usado: usado,
				esFull: esFull,
				vencido: estaVencido,
				limiteAlcanzado: !esFull && usado >= limiteTotal
			};
		}

        // ABRIR MODAL PARA NUEVO PRODUCTO
		function openModalStock() {
			const form = document.getElementById('form-stock');
			if(form) form.reset();
			
			document.getElementById('stock-id').value = "";
			document.getElementById('stock-imagen-base64').value = "";
			document.getElementById('stock-img-preview').classList.add('hidden');
			document.getElementById('stock-img-placeholder').classList.remove('hidden');
			document.getElementById('modal-stock-title').innerText = "Alta de Mercadería";
			
			// MOSTRAR sección de gasto porque es nuevo
			document.getElementById('seccion-gasto-inicial').classList.remove('hidden');

			const delBtn = document.getElementById('btn-delete-stock');
			if(delBtn) delBtn.classList.add('hidden');

			openModal('modal-stock');
			if (window.lucide) lucide.createIcons();
		}
		
		function openEditStock(id) {
			const s = state.stock.find(x => x.id == id);
			if (!s) return;

			document.getElementById('stock-id').value = s.id;
			document.getElementById('stock-nombre').value = s.nombre_producto;
			document.getElementById('stock-cant').value = s.stock_actual;
			document.getElementById('stock-precio').value = s.precio_venta;
			
			// OCULTAR sección de gasto al editar
			document.getElementById('seccion-gasto-inicial').classList.add('hidden');

			const base64 = s.url_imagen || s.imagen || "";
			document.getElementById('stock-imagen-base64').value = base64;
			
			const preview = document.getElementById('stock-img-preview');
			const placeholder = document.getElementById('stock-img-placeholder');
			if(base64 && base64.length > 100) {
				preview.src = base64;
				preview.classList.remove('hidden');
				placeholder.classList.add('hidden');
			} else {
				preview.classList.add('hidden');
				placeholder.classList.remove('hidden');
			}

			document.getElementById('modal-stock-title').innerText = "Editar Mercadería";
			const delBtn = document.getElementById('btn-delete-stock');
			if(delBtn) {
				delBtn.classList.remove('hidden');
				delBtn.onclick = () => deleteRecord('stock', s.id, 'modal-stock', loadStock);
			}

			openModal('modal-stock');
			if (window.lucide) lucide.createIcons();
		}

		window.openEditStock = openEditStock;
				
		// 1. Definimos la función única de guardado
		async function saveStockVikingo(e) {
			if(e && e.preventDefault) e.preventDefault();
			
			// 1. Capturamos los valores NI BIEN arranca la función
			const idExistente = document.getElementById('stock-id').value;
			const nombre = document.getElementById('stock-nombre').value;
			const cantidadACargar = parseInt(document.getElementById('stock-cant').value) || 0;
			const precioVenta = parseFloat(document.getElementById('stock-precio').value) || 0;
			const imagenB64 = document.getElementById('stock-imagen-base64').value;
			
			const montoCosto = parseFloat(document.getElementById('stock-costo-total').value) || 0;
			const notaCosto = document.getElementById('stock-costo-nota').value || `Compra inicial: ${nombre}`;
			const metodoPago = document.getElementById('stock-costo-metodo').value;

			const payload = {
				nombre_producto: nombre,
				stock_actual: cantidadACargar,
				precio_venta: precioVenta,
				url_imagen: imagenB64 
			};

			if(!payload.nombre_producto) return showVikingToast("Falta el nombre", true);

			const method = idExistente ? 'PUT' : 'POST';
			const endpoint = idExistente ? `/stock/${idExistente}` : '/stock';

			showVikingToast("Sincronizando con el GymFit App...");
			
			// 2. Ejecutamos el guardado del producto
			const res = await apiFetch(endpoint, method, payload);
			
			if(!res.error) {
				// --- LÓGICA DE GASTO AUTOMÁTICO EN CAJA ---
				
				if (!idExistente && montoCosto > 0) {
					
					// BUSCAMOS EL ID EN DIFERENTES FORMATOS (res.id, res.data.id, etc.)
					const nuevoProductoId = res.id || (res.data ? res.data.id : (res[0] ? res[0].id : null)); 

					// 🛑 CARTELITO DE DIAGNÓSTICO VIKINGO 🛑
					alert(`🔍 DIAGNÓSTICO DE CARGA:\n\n` +
						`1. Producto Guardado: ${nombre}\n` +
						`2. ID recibido del Server: ${nuevoProductoId}\n` +
						`3. Cantidad capturada: ${cantidadACargar}\n` +
						`4. Costo Total: $${montoCosto}\n\n` +
						`Si el ID es 'null' o 'undefined', el problema es el Backend.`);

					const dataCaja = {
						descripcion: notaCosto,
						monto: montoCosto,
						tipo: 'Egreso',
						metodo_pago: metodoPago,
						descripcion2: `Carga automática de stock: ${cantidadACargar} unidades`,
						producto_id: nuevoProductoId, 
						cantidad: cantidadACargar 
					};

					console.log("DEBUG RENTABILIDAD - Enviando a Caja:", dataCaja);

					// Enviamos el egreso a la caja
					await apiFetch('/caja/movimientos', 'POST', dataCaja);
					
					showVikingToast("Mercadería y Gasto de Caja registrados");
				} else {
					showVikingToast(idExistente ? "Producto Actualizado" : "Producto Registrado");
				}

				closeModal('modal-stock');
				
				setTimeout(() => {
					if (typeof loadStock === 'function') loadStock();
					if (typeof generarInformeRentabilidad === 'function') generarInformeRentabilidad();
				}, 300); 
			} else {
				showVikingToast("Error: " + res.error, true);
			}
		}

		// 2. Exportamos a window por si lo usás en atributos onclick del HTML
		window.saveStockVikingo = saveStockVikingo;

		// 3. Vinculamos el evento submit de forma limpia
		const stockForm = document.getElementById('form-stock');
		if (stockForm) {
			stockForm.onsubmit = saveStockVikingo;
		}

		/**
		 * VISTA DE RENTABILIDAD
		 * Ahora incluye filtrado por fechas y renderizado de gráfico automático.
		 */
		async function generarInformeRentabilidad() {
			// 0. Capturamos los filtros de fecha del DOM (asegúrate de tener estos inputs en tu HTML)
			const fechaDesde = document.getElementById('fecha-desde')?.value || '';
			const fechaHasta = document.getElementById('fecha-hasta')?.value || '';

			// 1. Traemos la info fresca de la DB con filtros
			const resStock = await apiFetch('/stock', 'GET');
			// Enviamos los filtros al backend para que el servidor haga el trabajo pesado
			const resCaja = await apiFetch(`/caja/movimientos?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`, 'GET');

			if(resStock.error || resCaja.error) return showVikingToast("Error al cargar datos", true);

			const stock = resStock;
			const movimientos = resCaja;
			const body = document.getElementById('tabla-rentabilidad-body');
			body.innerHTML = '';

			let totalesGeneral = { inversion: 0, recaudacion: 0 };
			let datosGrafico = { labels: [], ganancias: [] };

			stock.forEach(producto => {
				const historial = movimientos.filter(m => parseInt(m.producto_id) === producto.id);

				let inversionProducto = 0;
				let recaudacionProducto = 0;
				let unidadesVendidas = 0;
				let unidadesCompradas = 0;

				historial.forEach(mov => {
					const monto = parseFloat(mov.monto);
					const cant = parseInt(mov.cantidad) || 0;

					if (mov.tipo.toLowerCase() === 'egreso') {
						inversionProducto += monto;
						unidadesCompradas += cant;
					} else if (mov.tipo.toLowerCase() === 'ingreso') {
						recaudacionProducto += monto;
						unidadesVendidas += cant;
					}
				});

				if (inversionProducto > 0 || recaudacionProducto > 0) {
					const utilidad = recaudacionProducto - inversionProducto;
					const margen = inversionProducto > 0 ? ((utilidad / inversionProducto) * 100).toFixed(1) : 0;
					
					totalesGeneral.inversion += inversionProducto;
					totalesGeneral.recaudacion += recaudacionProducto;

					// Preparamos datos para el gráfico
					datosGrafico.labels.push(producto.nombre_producto);
					datosGrafico.ganancias.push(utilidad);

					body.innerHTML += `
						<tr class="border-b border-white/5 hover:bg-white/10 transition-colors">
							<td class="p-4">
								<div class="font-bold text-white">${producto.nombre_producto}</div>
								<div class="text-[10px] text-white/40 italic">${producto.categoria || 'Sin categoría'}</div>
							</td>
							<td class="p-4 text-red-400">$${inversionProducto.toLocaleString()} <span class="text-[10px] block text-white/20">(${unidadesCompradas} un.)</span></td>
							<td class="p-4 text-green-400">$${recaudacionProducto.toLocaleString()} <span class="text-[10px] block text-white/20">(${unidadesVendidas} un.)</span></td>
							<td class="p-4">
								<span class="${utilidad >= 0 ? 'text-green-500' : 'text-red-500'} font-bold">
									$${utilidad.toLocaleString()}
								</span>
								<div class="text-[10px] text-white/40">${margen}% margen</div>
							</td>
							<td class="p-4 text-right">
								<span class="px-2 py-1 rounded text-[10px] font-black ${utilidad >= 0 ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-600'}">
									${utilidad >= 0 ? 'RENTABLE' : 'ALERTA'}
								</span>
							</td>
						</tr>
					`;
				}
			});

			// Actualizamos las tarjetas de arriba
			document.getElementById('renta-total-compra').innerText = `$${totalesGeneral.inversion.toLocaleString()}`;
			document.getElementById('renta-total-venta').innerText = `$${totalesGeneral.recaudacion.toLocaleString()}`;
			const totalUtilidad = totalesGeneral.recaudacion - totalesGeneral.inversion;
			document.getElementById('renta-utilidad').innerText = `$${totalUtilidad.toLocaleString()}`;
			document.getElementById('renta-utilidad').className = `text-4xl font-black ${totalUtilidad >= 0 ? 'text-white' : 'text-red-500'} italic tracking-tight`;

			// --- INTEGRACIÓN DE GRÁFICO (CHART.JS) ---
			const ctx = document.getElementById('rentabilidadChart').getContext('2d');
			if (window.myChart) window.myChart.destroy();
			window.myChart = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: datosGrafico.labels,
					datasets: [{
						label: 'Utilidad por Producto ($)',
						data: datosGrafico.ganancias,
						backgroundColor: datosGrafico.ganancias.map(g => g >= 0 ? '#22c55e' : '#ef4444')
					}]
				},
				options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
			});

			actualizarDashboard(resCaja, resStock);

		}

		/**
		 * ESTA ES LA FUNCIÓN NUEVA QUE VAMOS A LLAMAR
		 * Se encarga de procesar los datos crudos y dibujar los gráficos.
		 */
		function actualizarDashboard(movimientos, stock) {
			// A. VENTAS POR DÍA (Total de ingresos diarios)
			const ventasPorDia = movimientos
				.filter(m => m.tipo.toLowerCase() === 'ingreso')
				.reduce((acc, mov) => {
					let fecha = mov.fecha.split(' ')[0];
					acc[fecha] = (acc[fecha] || 0) + parseFloat(mov.monto);
					return acc;
				}, {});

			// B. RENTABILIDAD POR PRODUCTO (Cálculo)
			const datosRentabilidad = stock.map(p => {
				const hist = movimientos.filter(m => String(m.producto_id) === String(p.id));
				const inv = hist.filter(m => m.tipo.toLowerCase() === 'egreso').reduce((a, b) => a + parseFloat(b.monto), 0);
				const rec = hist.filter(m => m.tipo.toLowerCase() === 'ingreso').reduce((a, b) => a + parseFloat(b.monto), 0);
				return { nombre: p.nombre_producto, utilidad: rec - inv };
			}).filter(d => d.utilidad !== 0);

			// --- CONFIGURACIÓN DE GRÁFICOS ---
			const config = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

			// 1. Gráfico de Líneas (Ventas)
			const ctxVentas = document.getElementById('chartVentas').getContext('2d');
			if (window.chartVentas) window.chartVentas.destroy();
			window.chartVentas = new Chart(ctxVentas, {
				type: 'line',
				data: {
					labels: Object.keys(ventasPorDia),
					datasets: [{ label: 'Ventas ($)', data: Object.values(ventasPorDia), borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true }]
				},
				options: config
			});

			// 2. Gráfico de Barras (Rentabilidad)
			const ctxRenta = document.getElementById('chartRentabilidad').getContext('2d');
			if (window.chartRenta) window.chartRenta.destroy();
			window.chartRenta = new Chart(ctxRenta, {
				type: 'bar',
				data: {
					labels: datosRentabilidad.map(d => d.nombre),
					datasets: [{ label: 'Utilidad ($)', data: datosRentabilidad.map(d => d.utilidad), backgroundColor: '#ef4444' }]
				},
				options: config
			});
		}

        /**
		 * LÓGICA DE CLASES Y DISCIPLINAS
		 */

		// --- CARGAR LISTA DE BOXES ---
		async function loadBoxes() {
			const select = document.getElementById('cl-box');
			if (!select) return;

			try {
				// ⚔️ LLAMADA GLOBAL: Ya no enviamos sucursal_id porque el backend devuelve todo
				const boxes = await apiFetch('/tipo_box');

				if (!boxes.error && Array.isArray(boxes)) {
					if (boxes.length > 0) {
						// Guardamos el valor actual por si estamos editando, para no perder la selección
						const currentVal = select.value;

						select.innerHTML = boxes.map(b => 
							`<option value="${b.id}">${b.nombre.toUpperCase()}</option>`
						).join('');

						// Si había un valor seleccionado (en edición), intentamos restaurarlo
						if (currentVal) select.value = currentVal;
					} else {
						// Si por alguna razón la tabla está vacía, ponemos la opción por defecto
						select.innerHTML = '<option value="1">PRINCIPAL</option>';
					}
				} else {
					// Salvavidas técnico
					select.innerHTML = '<option value="1">PRINCIPAL</option>';
				}
			} catch (err) {
				console.error("❌ Error en loadBoxes:", err);
				select.innerHTML = '<option value="1">PRINCIPAL</option>';
			}
		}

		function openModalClase() { 
			document.getElementById('form-clase').reset(); 
			document.getElementById('cl-id').value = ""; 
			document.getElementById('cl-schedule-slots').innerHTML = '<p class="text-[9px] text-gray-600 italic py-4 text-center">No hay horarios definidos</p>';
			document.getElementById('modal-clase-title').innerText = "Alta de Clase";
			document.getElementById('btn-delete-clase').classList.add('hidden'); 
			
			const selectorSede = document.getElementById('clase-sucursal-select');
				if (selectorSede) {
					// Solo el Administrador/Dueño ve el selector para elegir dónde crear la clase
					const esAdmin = state.user.rol_nombre.toLowerCase() === 'administrador';
					selectorSede.closest('.flex-col').style.display = esAdmin ? 'flex' : 'none';
				}

			loadBoxes(); 
			openModal('modal-clase'); 
		}

		async function openEditClase(id) {
			const c = state.clases.find(x => x.id == id); 
			if(!c) return;

			// ⚔️ 1. Sincronizamos la sede del modal con la sede de la clase antes de cargar boxes
			const sucursalSelect = document.getElementById('clase-sucursal-select');
			if (sucursalSelect) {
				sucursalSelect.value = c.sucursal_id;
			}

			// ⚔️ 2. Cargamos los boxes específicamente de la sede de esta clase
			// Usamos el ID de la clase directamente para evitar errores de "timing"
			await loadBoxes(c.sucursal_id); 

			// 3. Llenamos los campos básicos del modal
			document.getElementById('cl-id').value = c.id; 
			document.getElementById('modal-clase-title').innerText = "Editar: " + c.nombre;
			document.getElementById('cl-nombre').value = c.nombre; 
			
			// ⚔️ 4. Seteamos el Box (ahora que el select ya tiene las opciones de la sede correcta)
			document.getElementById('cl-box').value = c.box_id || ""; 
			
			document.getElementById('cl-cupo').value = c.capacidad_max;
			document.getElementById('cl-color').value = c.color || "#FF0000";
			
			// 5. Limpiamos y cargamos los horarios
			const slotsContainer = document.getElementById('cl-schedule-slots');
			slotsContainer.innerHTML = "";

			const horarios = Array.isArray(c.horarios_detalle) ? c.horarios_detalle : [];
			if (horarios.length > 0) {
				horarios.forEach(h => addNewScheduleSlot(h));
			} else {
				// Si no tiene horarios (raro), creamos uno por defecto
				addNewScheduleSlot({ dia: 1, horario: 7, coach: c.coach || "" });
			}

			// 6. Lógica de permisos para eliminar
			// Consideramos Administrador, Supervisor y agregamos el chequeo del rol "administracion" si fuera necesario
			const rol = (state.user?.rol_nombre || "").toLowerCase();
			const isAdmin = (rol === "administrador" || rol === "supervisor");
			
			const delBtn = document.getElementById('btn-delete-clase'); 
			if(delBtn) {
				delBtn.classList.toggle('hidden', !isAdmin);
				delBtn.onclick = () => deleteRecord('clases', c.id, 'modal-clase', loadClases);
			}

			// 7. Abrimos el modal
			openModal('modal-clase');
		}

		function openNewClase() {
			document.getElementById('form-clase').reset();
			document.getElementById('cl-id').value = "";
			document.getElementById('cl-schedule-slots').innerHTML = "";
			document.getElementById('modal-clase-title').innerText = "Nueva Clase";
			
			loadBoxes();
			addNewScheduleSlot();
			openModal('modal-clase');
		}

		async function loadProfesores() {
			const res = await apiFetch('/profesores');
			if (!res.error) {
				state.profesores = res;
			}
		}

		// --- GUARDAR CLASE (RESTAURADA COMO FUNCION ASYNC NOMBRADA) ---
		async function saveClaseVikinga(e) {
			if(e) e.preventDefault();
			
			const id = document.getElementById('cl-id').value;
			const slotRows = document.querySelectorAll('.schedule-slot-row');
			const sucursalSelect = document.getElementById('clase-sucursal-select');
			
			// DETERMINACIÓN DE LA SEDE (RAÍZ DEL FILTRO)
			// Si el usuario es Administrador, saca la sede del select. 
			// Si no, la saca de su propio perfil de usuario (state.user.sucursal_id).
			const rolActual = (state.user.rol_nombre || "").toLowerCase();
			const sucursalFinal = (rolActual === 'administrador') 
				? parseInt(sucursalSelect.value) 
				: state.user.sucursal_id;

			if(!sucursalFinal) {
				return showVikingToast("ERROR: Debes seleccionar una sucursal", true);
			}

			const horarios_detalle = [];
			slotRows.forEach(row => {
				const diaEl = row.querySelector('.slot-dia');
				const horaEl = row.querySelector('.slot-hora');
				const coachEl = row.querySelector('.slot-coach'); 
				
				if(diaEl && horaEl) {
					let nombreCoach = "Staff";
					if (coachEl) {
						nombreCoach = coachEl.tagName === 'SELECT' 
							? coachEl.options[coachEl.selectedIndex].text 
							: coachEl.value;
					}

					horarios_detalle.push({
						dia: parseInt(diaEl.value),
						horario: parseFloat(horaEl.value),
						coach: nombreCoach || "Staff" 
					});
				}
			});

			if(horarios_detalle.length === 0) {
				return showVikingToast("Añade al menos un turno para la clase", true);
			}

			const mainCoach = horarios_detalle[0].coach || "Staff";

			const payload = {
				nombre: document.getElementById('cl-nombre').value,
				box_id: parseInt(document.getElementById('cl-box').value),
				coach: String(mainCoach),
				color: document.getElementById('cl-color').value,
				capacidad_max: parseInt(document.getElementById('cl-cupo').value) || 20,
				horarios_detalle: horarios_detalle,
				sucursal_id: sucursalFinal // ASIGNACIÓN CRÍTICA
			};

			const method = id ? 'PUT' : 'POST';
			const endpoint = id ? `/clases/${id}` : '/clases';
			
			try {
				const res = await apiFetch(endpoint, method, payload);
				if(!res.error) {
					showVikingToast(id ? "¡Sede Actualizada!" : "¡Clase Asignada a Sede!");
					closeModal('modal-clase');
					// Refrescamos la lista de clases y el calendario
					await loadClases(); 
					if (typeof renderCalendar === 'function') renderCalendar();
				} else {
					showVikingToast("Error: " + JSON.stringify(res.detail || res.error), true);
				}
			} catch (err) {
				console.error(err);
				showVikingToast("Fallo en la conexión", true);
			}
		}

		window.onload = async () => {
			await loadProfesores();
			await loadBoxes();
		};
		
		// --- GESTIÓN DE SUCURSALES ---
		async function loadSucursales() {
			try {
				const response = await fetch(`${API_BASE}/sucursales`, {
					headers: { 'Authorization': `Bearer ${localStorage.getItem('viking_token')}` }
				});
				
				if (!response.ok) throw new Error("Error en API");
				const sucursalData = await response.json();

				// Guardar en el estado global
				state.sucursales = sucursalData; 
				
				// 1. Renderizar Tarjetas en la vista de Sucursales
				const container = document.getElementById('sucursales-container');
				if (container) {
					container.innerHTML = sucursalData.length === 0 
						? '<div class="col-span-full py-20 text-center opacity-30 italic font-black uppercase"><i data-lucide="map-pin-off" class="w-12 h-12 mx-auto mb-4"></i><p>No hay sedes registradas</p></div>'
						: sucursalData.map(s => `
							<div class="glass-card p-8 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all group relative overflow-hidden">
								<div class="flex justify-between items-start mb-6">
									<div class="p-4 bg-red-600/10 rounded-2xl text-red-500 group-hover:bg-red-600 group-hover:text-black transition-all">
										<i data-lucide="map-pin" class="w-6 h-6"></i>
									</div>
									<button onclick="window.deleteSucursal(${s.id})" class="text-white/10 hover:text-red-600 transition-colors z-10">
										<i data-lucide="trash-2" class="w-5 h-5"></i>
									</button>
								</div>
								<h4 class="text-2xl font-black italic uppercase text-white mb-2 tracking-tighter">${s.sucursal}</h4>
								<p class="text-[10px] text-white-500 font-bold uppercase tracking-[0.2em] italic">${s.direccion}</p>
							</div>`).join('');
				}

				// 2. Selectores de Filtro de Personal, Alumnos, Cobros Y CAJA (Agregado acá)
				const selectProf = document.getElementById('filter-sucursal-profesores');
				const selectAdm = document.getElementById('filter-sucursal-administrativos');
				const selectAlu = document.getElementById('filter-sucursal-alumnos');
				const selectCob = document.getElementById('cobrar-sucursal-filter'); 
				const selectCaja = document.getElementById('caja-filtro-sucursal'); // <--- ⚔️ AGREGADO PARA TU FILTRO DE CAJA

				[selectProf, selectAdm, selectAlu, selectCob, selectCaja].forEach(sel => {
					if (sel) {
						const current = sel.value || (sel.id === 'cobrar-sucursal-filter' || sel.id === 'caja-filtro-sucursal' ? "" : "all");
						const firstOptionText = "TODAS LAS SEDES";
						const firstOptionValue = (sel.id === 'cobrar-sucursal-filter' || sel.id === 'caja-filtro-sucursal') ? "" : "all";

						sel.innerHTML = `<option value="${firstOptionValue}" class="bg-zinc-900 text-white font-black italic uppercase">${firstOptionText}</option>` + 
							sucursalData.map(s => `<option value="${s.id}" class="bg-zinc-900 text-white font-black italic uppercase">${s.sucursal.toUpperCase()}</option>`).join('');
						sel.value = current;
						
						if (sel.id === 'cobrar-sucursal-filter') {
							sel.onchange = () => renderCobrar();
						}
					}
				});

				// 3. Selector en modal de Alumnos
				const selectAl = document.getElementById('al-sucursal');
				if (selectAl) {
					const currentVal = selectAl.value;
					selectAl.innerHTML = '<option value="" class="bg-zinc-900 text-white">Seleccionar Sucursal...</option>' + 
						sucursalData.map(s => `<option value="${s.id}">${s.sucursal.toUpperCase()}</option>`).join('');
					if(currentVal) selectAl.value = currentVal;
				}

				// 4. Selector en modal de CLASES y Filtro de CLASES
				const selectCl = document.getElementById('clase-sucursal-select');
				const selectFiltroCl = document.getElementById('filtro-clases-sucursal');

				if (selectCl) {
					selectCl.innerHTML = sucursalData.map(s => `<option value="${s.id}" class="bg-zinc-900 text-white font-bold italic uppercase">${s.sucursal.toUpperCase()}</option>`).join('');
				}
				if (selectFiltroCl) {
					const current = selectFiltroCl.value || 'todas';
					selectFiltroCl.innerHTML = '<option value="todas" class="bg-zinc-900 text-white font-bold italic uppercase">TODAS LAS SEDES</option>' + 
						sucursalData.map(s => `<option value="${s.id}" class="bg-zinc-900 text-white font-bold italic uppercase">${s.sucursal.toUpperCase()}</option>`).join('');
					selectFiltroCl.value = current;
				}

				if(window.lucide) lucide.createIcons();
			} catch (error) {
				console.error("❌ Error cargando sucursales:", error);
			}
		}

        async function handleDrop(e, dia, horario) { e.preventDefault(); const id = e.dataTransfer.getData("clase_id"); if (!id) return; const res = await apiFetch(`/clases/${id}/move`, 'PUT', { dia, horario }); if (!res.error) { loadClases(); showVikingToast("Clase Reubicada"); } }
        
        async function deleteRecord(entity, id, modalId, callback) { if(!confirm("¿Deseas eliminar este registro?")) return; const res = await apiFetch(`/${entity}/${id}`, 'DELETE'); if(!res.error) { closeModal(modalId); callback(); showVikingToast("Registro Eliminado", true); } }
        
        async function handleProfileUpdate(e) { 
            e.preventDefault(); 
            const pass = document.getElementById('prof-input-pass').value; 
            const isAlumno = state.user.rol_nombre === 'Alumno';
            
            let data = { 
                nombre_completo: document.getElementById('prof-input-name').value, 
                dni: String(document.getElementById('prof-input-dni').value), 
                email: document.getElementById('prof-input-email').value
            }; 

            if(pass) data.password = pass; 
            let endpoint = "";

            if (isAlumno) {
                endpoint = `/alumnos/${state.user.id}`;
                data.plan_id = state.user.plan_id || state.user.plan?.id;
                data.peso = parseFloat(document.getElementById('prof-input-peso').value) || null;
                data.altura = parseFloat(document.getElementById('prof-input-altura').value) || null;
                data.imc = parseFloat(document.getElementById('prof-input-imc').value) || null;
            } else {
                endpoint = `/staff/${state.user.id}`;
                data.perfil_nombre = state.user.rol_nombre;
            }

            const res = await apiFetch(endpoint, 'PUT', data); 
            if(!res.error) { 
                state.user.nombre_completo = data.nombre_completo; 
                state.user.email = data.email;
                if (isAlumno) {
                    state.user.peso = data.peso;
                    state.user.altura = data.altura;
                    state.user.imc = data.imc;
                }

                document.getElementById('side-user-name').innerText = data.nombre_completo; 
                document.getElementById('prof-name').innerText = data.nombre_completo;
                const initials = data.nombre_completo.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();
                document.getElementById('user-initials').innerText = initials;
                document.getElementById('prof-initials-view').innerText = initials;
                
                showVikingToast("Perfil Vikingo Actualizado"); 
                if(isAlumno) renderStudentDashboard();
            } else {
                showVikingToast("Error: " + res.error, true);
            }
        }

        document.getElementById('form-rutina-editor').onsubmit = async (e) => {
            e.preventDefault();
            
            const elAlumnoId = document.getElementById('rutina-editor-alumno-id') || document.getElementById('edit-rutina-user-id');
            const elObjetivo = document.getElementById('rutina-objetivo') || document.getElementById('edit-rutina-objetivo');
            const elVencimiento = document.getElementById('rutina-vencimiento') || document.getElementById('edit-rutina-vencimiento');
            const elNombreGrupo = document.getElementById('rutina-nombre-grupo');
            const elDescripcion = document.getElementById('rutina-descripcion');

            if (!elAlumnoId) {
                console.error("No se encontró el input del ID del alumno. Revisa que el ID en el HTML sea 'rutina-editor-alumno-id'");
                showVikingToast("Error técnico: Campo de ID no encontrado en el HTML", true);
                return;
            }

            const alumnoId = parseInt(elAlumnoId.value);
            
            if (isNaN(alumnoId)) {
                showVikingToast("Error: Debes seleccionar un alumno de la lista", true);
                return;
            }

            const payload = {
                usuario_id: alumnoId,
                nombre_grupo: elNombreGrupo ? elNombreGrupo.value : "Rutina Nueva",
                descripcion: elDescripcion ? elDescripcion.value : "",
                objetivo: elObjetivo ? elObjetivo.value : "Mejora general",
                fecha_vencimiento: elVencimiento ? elVencimiento.value : null,
                dias: []
            };

            const dayCards = document.querySelectorAll('.rutina-dia-card') || document.querySelectorAll('.day-block');
            let hasValidationError = false;

            payload.dias = Array.from(dayCards).map(card => {
                const inputNombreDia = card.querySelector('.day-title');
                const nombre_dia = inputNombreDia ? inputNombreDia.value : "Día";
                
                const exercisesRows = card.querySelectorAll('.exercise-row');
                
                const ejercicios = Array.from(exercisesRows).map(row => {
                    const inputExId = row.querySelector('.exercise-id');
                    const exId = parseInt(inputExId.value);

                    const rowsDeSeries = row.querySelectorAll('.serie-row');
                    const seriesData = Array.from(rowsDeSeries).map(sRow => {
                        return {
                            numero_serie: parseInt(sRow.dataset.serieNum),
                            repeticiones: sRow.querySelector('.serie-reps').value || "0",
                            peso: sRow.querySelector('.serie-weight').value || "0",
                            descanso: sRow.querySelector('.serie-rest').value || "0"
                        };
                    });

                    return {
                        ejercicio_id: exId,
                        series: seriesData, 
                        comentario: row.querySelector('.exercise-comment')?.value || ""
                    };
                });
                
                return { nombre_dia, ejercicios };
            });

            if (hasValidationError) {
                showVikingToast("Error: Tienes ejercicios sin seleccionar en la lista", true);
                return;
            }

            if (payload.dias.length === 0 || payload.dias.every(d => d.ejercicios.length === 0)) {
                showVikingToast("Error: La rutina debe tener al menos un ejercicio", true);
                return;
            }

            const res = await apiFetch('/rutinas/plan', 'POST', payload);
            
            if (!res.error) {
                closeModal('modal-rutina-editor');
                showVikingToast("¡Plan de Rutina Vikingo Guardado!");
                if (typeof renderRutinas === 'function') renderRutinas();
            } else {
                let msg = res.error;
                try { 
                    const parsed = JSON.parse(res.error);
                    if (parsed.detail) msg = parsed.detail;
                } catch(e) {}
                showVikingToast("Error Vikingo: " + msg, true);
            }
        };

		// 1. VARIABLES GLOBALES (Deben estar fuera de las funciones)
		let videoStream = null;
		let isScanning = false;
		let lastScannedData = null; // Para evitar lecturas duplicadas seguidas
		let scanCooldown = false;   // Bloqueo temporal tras una lectura exitosa
		let lastScannedDNI = null;
		let feedbackTimeout = null; // Para poder frenar el cierre automático

		// 1. Abrir Escáner y Encender Cámara
		async function startScanner() {
			const modal = document.getElementById('modal-scanner-live');
			const video = document.getElementById('scanner-video');
			const hud = document.getElementById('scanner-hud');
			
			// ⚔️ CORRECCIÓN: Limpieza profunda de streams anteriores para evitar conflictos de hardware
			if (videoStream) {
				videoStream.getTracks().forEach(track => track.stop());
				videoStream = null;
			}
			
			// Limpiamos cualquier rastro de la lectura anterior en la UI
			hideFeedback();
			
			// Mostramos el modal
			if (modal) {
				modal.classList.remove('hidden');
				modal.classList.add('flex');
			}
			if (hud) hud.classList.remove('hidden');

			// VALIDACIÓN CRÍTICA: HTTPS
			if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
				showCameraError("ERROR DE SEGURIDAD: La cámara requiere una conexión segura HTTPS.");
				return;
			}

			const attempts = [
				{ 
					video: { 
						width: { ideal: 640 }, 
						height: { ideal: 480 },
						aspectRatio: { ideal: 1.3333333333 },
						frameRate: { ideal: 30 }
					} 
				},
				{ video: { facingMode: "user" } },
				{ video: true }
			];

			let lastError = null;

			for (const config of attempts) {
				try {
					console.log("Intentando acceso con configuración:", config);
					videoStream = await navigator.mediaDevices.getUserMedia(config);
					if (videoStream) break;
				} catch (err) {
					lastError = err;
					console.warn("Fallo un intento de cámara:", err.name);
				}
			}
			
			if (videoStream && video) {
				video.srcObject = videoStream;
				video.onloadedmetadata = () => {
					video.play();
					
					// Filtro Anti-encandilamiento
					video.style.filter = "brightness(0.85) contrast(1.4) grayscale(0.2)";
					video.style.objectFit = "contain"; 

					isScanning = true;
					lastScannedDNI = null; 
					console.log("🛡️ Ojo de Odín Activo: Buscando QR...");
					
					// ⚔️ CORRECCIÓN: Aseguramos que el bucle solo se inicie una vez
					if (typeof scanLoop === 'function') {
						requestAnimationFrame(scanLoop);
					}
				};
			} else {
				console.error("No se pudo inicializar ninguna cámara:", lastError);
				showCameraError("No hay acceso a la cámara. Asegúrate de tener habilitados los permisos en el navegador.");
			}
		}

		/**
		 * 2. BUCLE DE DETECCIÓN (Detección Real Automática)
		 * Esta función corre analizando el video frame por frame.
		 */
		function scanLoop() {
			if (!isScanning) return; 

			const video = document.getElementById('scanner-video');
			
			// ⚔️ CORRECCIÓN: Buscamos o creamos el canvas una sola vez, sin recrear elementos innecesarios
			let canvasElement = document.getElementById('scanner-canvas');
			if (!canvasElement) {
				canvasElement = document.createElement('canvas');
				canvasElement.id = 'scanner-canvas';
				canvasElement.className = 'hidden';
				document.body.appendChild(canvasElement);
			}

			const canvas = canvasElement.getContext("2d", { willReadFrequently: true });

			if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
				// Ajustamos las dimensiones del canvas al video
				if (canvasElement.height !== video.videoHeight || canvasElement.width !== video.videoWidth) {
					canvasElement.height = video.videoHeight;
					canvasElement.width = video.videoWidth;
				}
				
				canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
				
				// ⚔️ OPTIMIZACIÓN: Solo leemos el área central o la imagen completa si es necesario.
				// Si el QR tarda en leer, esto es lo que lo acelera.
				const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
				
				const code = (typeof jsQR !== 'undefined') 
					? jsQR(imageData.data, imageData.width, imageData.height, { 
						inversionAttempts: "dontInvert" 
					}) 
					: null;

				if (code && code.data && !scanCooldown) {
					// Comparamos el dato detectado
					if (code.data !== lastScannedDNI) {
						console.log("🎯 QR Detectado:", code.data);
						lastScannedDNI = code.data;
						processAccess(code.data);
						return; // Salimos del bucle para esperar a que processAccess termine
					}
				}
			}

			// Continuamos el bucle si no se encontró nada o si seguimos escaneando
			requestAnimationFrame(scanLoop);
		}

		/**
		 * 3. PROCESAR ACCESO (Comunicación con Backend)
		 */
		async function processAccess(qrData) {
			scanCooldown = true; 
			if (feedbackTimeout) clearTimeout(feedbackTimeout);
			
			const nameDisplay = document.getElementById('scanner-user-name');
			if (nameDisplay) nameDisplay.innerText = "VERIFICANDO...";

			// ⚔️ CORRECCIÓN CRÍTICA: Forzamos la obtención de tiempo local
			const now = new Date();
			// Usamos getHours y getMinutes directos, asegurando formato numérico
			const hours = now.getHours();
			const minutes = now.getMinutes();
			const localTimeFloat = parseFloat((hours + (minutes / 60.0)).toFixed(2));
			
			// getDay() devuelve 0 (Domingo) a 6 (Sábado). 
			// Aseguramos que sea un número real.
			const localDay = parseInt(now.getDay()); 

			console.log(`DEBUG TÓTEM: Enviando -> Hora: ${localTimeFloat}, Día: ${localDay}`);

			try {
				const payload = { 
					qr_data: qrData,
					hora_local: localTimeFloat, // Ya es un float limpio
					dia_local: localDay         // Ya es un int limpio
				};

				const response = await apiFetch('/acceso/validar', 'POST', payload);
				
				// Manejo de respuesta
				if (response && response.status === "CHOOSE_ACTIVITY") {
					showChooseActivityUI(response);
				} else if (response && (response.error || response.status === "DENIED")) {
					showFeedback({ 
						status: "DENIED", 
						nombre: response.nombre || "ERROR", 
						message: response.message || response.error || "Acceso denegado", 
						color: "red" 
					});
					startFeedbackTimer(4000);
				} else if (response) {
					showFeedback(response);
					
					// Actualización de UI solo si es necesario
					if (typeof loadDashboard === 'function') loadDashboard();
					if (typeof renderAccesos === 'function') renderAccesos();
					
					startFeedbackTimer(4000);
				}
			} catch (e) {
				console.error("Error crítico en validación:", e);
				showFeedback({ 
					status: "DENIED", 
					nombre: "SISTEMA", 
					message: "Error de conexión con el servidor", 
					color: "red" 
				});
				startFeedbackTimer(4000);
			}
		}

		/**
		 * Panel interactivo: Solo aparece si el backend devuelve CHOOSE_ACTIVITY
		 */
		function showChooseActivityUI(data) {
			const overlay = document.getElementById('scanner-feedback-overlay');
			const icon = document.getElementById('scanner-icon-container');
			const status = document.getElementById('scanner-status-text');
			const name = document.getElementById('scanner-user-name');
			const msg = document.getElementById('scanner-msg');

			if (!overlay) return;

			overlay.classList.remove('hidden');
			overlay.classList.add('flex');
			overlay.style.boxShadow = "inset 0 0 150px rgba(234, 179, 8, 0.4)";
			overlay.style.border = "8px solid #eab308";
			overlay.style.backgroundColor = "rgba(0,0,0,0.98)";

			name.innerText = data.nombre ? data.nombre.toUpperCase() : "ALUMNO";
			status.innerText = "¿QUÉ ENTRENÁS HOY?";
			status.className = "text-4xl font-black uppercase italic text-yellow-500 mb-6 tracking-wide text-center drop-shadow-[0_0_10px_#eab308]";
			
			// ⚔️ CORRECCIÓN: Usamos un manejo de eventos limpio en lugar de stringify en el HTML
			// Esto evita errores de sintaxis con caracteres especiales
			icon.innerHTML = `
				<div class="flex flex-col sm:flex-row gap-4 w-full max-w-md px-6 justify-center items-center pointer-events-auto z-50">
					<button id="btn-clase" class="w-full sm:w-64 py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase italic rounded-2xl shadow-lg shadow-red-600/30 transition-all transform hover:scale-105 flex flex-col items-center justify-center border border-red-500/30">
						<span class="text-sm tracking-tight">Vengo a la clase de</span>
						<span class="text-lg font-black tracking-normal">${data.clase_nombre}</span>
						<span class="text-[10px] text-zinc-300 font-bold mt-0.5">${data.horario} HS • DESCUENTA 1 CUPO</span>
					</button>
					<button id="btn-musculacion" class="w-full sm:w-64 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase italic rounded-2xl shadow-lg transition-all transform hover:scale-105 flex flex-col items-center justify-center border border-zinc-700">
						<span class="text-sm tracking-tight">Ingresar solo a la</span>
						<span class="text-lg font-black tracking-normal">SALA DE MUSCULACIÓN</span>
					</button>
				</div>
			`;

			// ⚔️ CORRECCIÓN: Asignamos los eventos de forma segura
			document.getElementById('btn-clase').onclick = () => confirmarIngresoClase(data);
			document.getElementById('btn-musculacion').onclick = () => confirmarIngresoMusculacion(data.nombre);

			msg.innerHTML = `<span class="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-2 block">Tenés 15 segundos para elegir</span>`;

			// ⚔️ SEGURIDAD: Auto-cancelar si el usuario se queda parado ahí
			if (feedbackTimeout) clearTimeout(feedbackTimeout);
			feedbackTimeout = setTimeout(() => {
				if (!overlay.classList.contains('hidden')) {
					hideFeedback();
					scanCooldown = false;
					lastScannedDNI = null;
					requestAnimationFrame(scanLoop);
				}
			}, 15000); // Se cierra solo a los 15 segundos
		}

		async function confirmarIngresoClase(data) {
			try {
				// Preparamos el payload exactamente como el backend lo espera
				const payload = {
					usuario_id: parseInt(data.usuario_id),
					clase_id: parseInt(data.clase_id),
					horario: parseFloat(data.horario_float),
					dia_semana: parseInt(data.dia_semana),
					fecha_clase: data.fecha_clase
				};

				// Enviamos al backend. Si hay error, apiFetch nos devuelve { error: "mensaje" }
				const booking = await apiFetch('/reservas', 'POST', payload);

				// ⚔️ CORRECCIÓN: Validamos si existe la propiedad 'error' que definimos en el nuevo apiFetch
				if (booking && booking.error) {
					showFeedback({ 
						status: "DENIED", 
						nombre: data.nombre, 
						message: booking.error, // El mensaje real (ej: "Sin cupos disponibles")
						color: "red" 
					});
				} else {
					// Reserva exitosa
					showFeedback({ 
						status: "AUTHORIZED", 
						nombre: data.nombre, 
						message: `Reserva confirmada en ${data.clase_nombre}. ¡Adelante!`, 
						color: "green" 
					});
				}
			} catch (err) { 
				console.error("Error crítico en reserva:", err);
				showFeedback({ 
					status: "DENIED", 
					nombre: data.nombre, 
					message: "Fallo de comunicación con el sistema.", 
					color: "red" 
				});
			}
			
			// Esto asegura que, pase lo que pase, el tótem vuelva a estar disponible
			startFeedbackTimer(4000);
		}

		async function confirmarIngresoMusculacion(nombreAlumno) {
			// ⚔️ CORRECCIÓN: Enviamos un log al backend para que registre que el alumno entró a Sala
			// Esto es vital para tus reportes de asistencia
			try {
				await apiFetch('/acceso/registrar-musculacion', 'POST', {
					nombre: nombreAlumno,
					tipo: "MUSCULACION"
				});
			} catch (err) {
				console.warn("No se pudo registrar el ingreso a musculación en el log:", err);
			}

			// Feedback visual para el alumno
			showFeedback({ 
				status: "AUTHORIZED", 
				nombre: nombreAlumno, 
				message: "Ingreso registrado a Sala de Musculación.", 
				color: "green" 
			});
			
			startFeedbackTimer(4000);
		}

		function showFeedback(data) {
			const overlay = document.getElementById('scanner-feedback-overlay');
			const icon = document.getElementById('scanner-icon-container');
			const status = document.getElementById('scanner-status-text');
			const name = document.getElementById('scanner-user-name');
			const msg = document.getElementById('scanner-msg');

			if (!overlay) return;

			// Reset de estilos previos
			overlay.classList.remove('hidden');
			overlay.classList.add('flex');
			overlay.style.backgroundColor = "rgba(0,0,0,0.95)";
			
			name.innerText = data.nombre || "DESCONOCIDO";
			msg.innerText = data.message || "";
			
			const color = data.color || "red";
			
			if (color === 'green') {
				status.innerText = "ACCESO PERMITIDO";
				status.className = "text-5xl font-black italic text-green-500 mb-2";
				overlay.style.border = "8px solid #22c55e";
				icon.innerHTML = `<div class="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center animate-bounce"><i data-lucide="check" class="w-16 h-16 text-black"></i></div>`;
			} else {
				status.innerText = "ACCESO DENEGADO";
				status.className = "text-5xl font-black italic text-red-600 mb-2";
				overlay.style.border = "8px solid #dc2626";
				icon.innerHTML = `<div class="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center animate-shake"><i data-lucide="x" class="w-16 h-16 text-white"></i></div>`;
			}

			// ⚔️ SEGURIDAD: Solo llamar a lucide si está disponible para evitar errores en consola
			if (window.lucide && typeof window.lucide.createIcons === 'function') {
				window.lucide.createIcons();
			}
		}

		function startFeedbackTimer(ms) {
			if (feedbackTimeout) clearTimeout(feedbackTimeout);
			feedbackTimeout = setTimeout(() => {
				if (isScanning) {
					hideFeedback();
					scanCooldown = false;
					lastScannedDNI = null; 
					requestAnimationFrame(scanLoop);
				}
			}, ms);
		}

		function hideFeedback() {
			const overlay = document.getElementById('scanner-feedback-overlay');
			if (overlay) { 
				overlay.classList.add('hidden'); 
				overlay.classList.remove('flex'); 
				// Limpiamos bordes para que no queden guardados de la sesión anterior
				overlay.style.border = "none"; 
			}
		}

		// ⚔️ 1. ABRIR CENTRAL DE WHATSAPP
		function openWhatsAppCentral() {
			const select = document.getElementById('wa-alumno-select');
			const alumnosConTel = state.alumnos.filter(a => a.telefono && a.telefono.trim() !== "");

			if (alumnosConTel.length === 0) {
				return showVikingToast("No hay alumnos con teléfono cargado", true);
			}

			// Llenamos el select de alumnos
			select.innerHTML = alumnosConTel.map(a => 
				`<option value="${a.telefono}" data-nombre="${a.nombre_completo}">${a.nombre_completo.toUpperCase()} (${a.telefono})</option>`
			).join('');

			// Limpiamos el textarea
			document.getElementById('wa-mensaje-texto').value = "";
			document.getElementById('wa-mensaje-pre-select').value = "";

			openModal('modal-whatsapp');
			if(window.lucide) lucide.createIcons();
		}

		// ⚔️ 2. ACTUALIZAR TEXTO AL ELEGIR PREDEFINIDO
		function updateWAMessage(val) {
			const textarea = document.getElementById('wa-mensaje-texto');
			const selectAlumno = document.getElementById('wa-alumno-select');
			const nombreAlumno = selectAlumno.options[selectAlumno.selectedIndex]?.getAttribute('data-nombre') || "Vikingo";

			if (!val) {
				textarea.value = "";
				return;
			}

			// Reemplazamos el placeholder por el nombre real del alumno
			let mensajeFinal = val.replace("HOLA_ALUMNO!", `¡Hola ${nombreAlumno.split(' ')[0]}! 👋`);
			textarea.value = mensajeFinal;
		}

		// ⚔️ 3. EL DISPARO FINAL
		function sendVikingWhatsApp() {
			const telefono = document.getElementById('wa-alumno-select').value;
			const mensaje = document.getElementById('wa-mensaje-texto').value;
			const trigger = document.getElementById('whatsapp-trigger');

			if (!telefono || !mensaje) {
				return showVikingToast("Falta elegir alumno o escribir mensaje", true);
			}

			// Limpiamos el teléfono (por si tiene espacios o guiones ruidosos)
			const telLimpio = telefono.replace(/\D/g, '');
			
			// Generamos la URL de WhatsApp
			const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
			
			// Ejecutamos el disparo
			trigger.href = url;
			trigger.click();

			showVikingToast("¡WhatsApp abierto!");
			closeModal('modal-whatsapp');
		}

		async function checkVikingBirthdays() {
			// ⚔️ Diagnóstico Vikingo
			console.log("DEBUG - Objeto usuario completo:", state.user);
			
			// En tu objeto, el rol parece estar en 'rol_nombre' o 'nombre_completo'
			// Vamos a ser bien prácticos y buscar en ambos
			const miRol = (state.user?.rol_nombre || state.user?.nombre_completo || "").toLowerCase().trim();
			
			console.log("DEBUG - Rol detectado y procesado:", miRol);

			// Lista de permitidos ajustada a lo que salió en tu consola
			const rolesAdmin = ["administrador", "supervisor", "administracion", "staff", "admin"];

			if (!rolesAdmin.includes(miRol)) {
				console.warn(`🚫 Acceso denegado. El rol '${miRol}' no está en la lista.`);
				return;
			}

			try {
				const cumplen = await apiFetch('/alumnos/cumpleanios');
				if (Array.isArray(cumplen) && cumplen.length > 0) {
					const listaDiv = document.getElementById('lista-cumpleanios');
					if (!listaDiv) return;

					listaDiv.innerHTML = cumplen.map(a => `
						<div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-black text-[10px]">
									${a.nombre_completo.substring(0,1)}
								</div>
								<div class="text-left">
									<p class="text-xs font-black text-white uppercase italic">${a.nombre_completo}</p>
									<p class="text-[9px] text-white/40 font-bold">¡FESTEJA HOY!</p>
								</div>
							</div>
							<button onclick="openWhatsAppDesdeCumple('${a.telefono}', '${a.nombre_completo}')" 
									class="p-2 bg-green-500/10 text-green-500 rounded-lg">
								<i data-lucide="message-circle" class="w-4 h-4"></i>
							</button>
						</div>
					`).join('');

					if(window.lucide) lucide.createIcons();
					openModal('modal-cumpleanios');
				}
			} catch (err) {
				console.error("Error en cumples:", err);
			}
		}

	// Función auxiliar para saludar rápido
	function openWhatsAppDesdeCumple(tel, nombre) {
		if (!tel) return showVikingToast("El alumno no tiene teléfono", true);
		const mensaje = `¡Hola ${nombre.split(' ')[0]}! 👋 ¡Feliz cumpleaños te desea todo el equipo de ND TRAINING! Pasá por el box a retirar tu regalo. 🎂⚔️`;
		const url = `https://wa.me/${tel.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
		window.open(url, '_blank');
	}

		/**
		 * 6. LIMPIEZA Y CIERRE
		 */
		function hideFeedback() {
			const overlay = document.getElementById('scanner-feedback-overlay');
			if (overlay) {
				overlay.classList.add('hidden');
				overlay.classList.remove('flex');
			}
		}

		function stopScanner() {
			isScanning = false;
			const modal = document.getElementById('modal-scanner-live');
			const video = document.getElementById('scanner-video');

			if (videoStream) {
				videoStream.getTracks().forEach(track => track.stop());
				videoStream = null;
			}
			
			if (video) video.srcObject = null;
			if (modal) {
				modal.classList.add('hidden');
				modal.classList.remove('flex');
			}
		}

		/**
		 * 7. UTILIDADES
		 */
		async function generateVikingHash(dni) {
			const message = dni + SECRET_KEY;
			const encoder = new TextEncoder();
			const data = encoder.encode(message);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		}

		function showCameraError(msg) {
			const err = document.getElementById('scanner-error-msg');
			const txt = document.getElementById('scanner-error-text');
			if (txt) txt.innerText = msg;
			if (err) {
				err.classList.remove('hidden');
				err.classList.add('flex');
			}
		}

		// Vincular al botón de "Ver Molinetes" o crear uno nuevo en el Dashboard
		// Para probarlo, puedes llamar startScanner() desde la consola o añadir un botón.

        function openModalNewExercise() {
            openModal('modal-nuevo-ejercicio');
        }

		/**
         * 1. OBTENER HISTORIAL DE ACCESOS DEL SERVIDOR
         * Se llama al entrar a la vista o después de un escaneo.
         */
        async function fetchAccesos() {
            // ⚔️ CORRECCIÓN: Uso de tu llave correcta 'viking_token'
            const token = localStorage.getItem('viking_token') || (state ? state.token : null);
            
            if (!token) {
                console.warn("⚠️ No hay sesión activa. Saltando sincronización...");
                return; 
            }

            console.log("🔄 Sincronizando historial de accesos...");
            try {
                const res = await apiFetch('/acceso/historial'); 
                
                if (res && !res.error && Array.isArray(res)) {
                    state.accesos = res.map(acc => {
                        let horaResult = "--:--";
                        let fechaResult = "--/--";

                        try {
                            // Procesamiento de fecha para separar Hora y Fecha
                            let dateObj = new Date(acc.fecha.replace(/-/g, '/'));
                            
                            if (!isNaN(dateObj.getTime())) {
                                const h = String(dateObj.getHours()).padStart(2, '0');
                                const m = String(dateObj.getMinutes()).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                
                                horaResult = `${h}:${m}`;
                                fechaResult = `${day}/${month}`;
                            } else if (acc.fecha && acc.fecha.includes(' - ')) {
                                // Fallback si el formato viene como "HH:mm - DD/MM/YY"
                                let [h, f] = acc.fecha.split(' - ');
                                horaResult = h;
                                fechaResult = f.substring(0, 5); // DD/MM
                            }
                        } catch (e) {
                            console.warn("Error procesando fecha, usando original:", e);
                        }

                        // ⚔️ RETORNO CON DATOS SEPARADOS Y ACTIVIDAD
                        return {
                            ...acc,
                            fecha_local: `${horaResult} - ${fechaResult}`, // Esto lo mantiene compatible con el render anterior
                            hora_solo: horaResult,
                            fecha_solo: fechaResult,
                            // Se asegura de tomar la actividad real guardada en BD
                            actividad: acc.actividad || acc.clase_nombre || 'MUSCULACIÓN'
                        };
                    });
                    
                    // Disparamos el renderizado
                    if (typeof renderAccesos === 'function') {
                        renderAccesos();
                    }
                } else {
                    console.warn("Respuesta del servidor inesperada o vacía.");
                }
            } catch (error) {
                console.error("Error grave en fetchAccesos:", error);
            }
        }

        // 2. EL INTEGRADOR DEL ESCÁNER (Llamar esto desde scanLoop en index.html)
        async function procesarEscaneoRealTime(codigoQR) {
            try {
                const response = await apiFetch('/acceso/validar', {
                    method: 'POST',
                    body: JSON.stringify({ qr_data: codigoQR })
                });

                if (typeof showScannerFeedback === 'function') {
                    showScannerFeedback(response.status === "AUTHORIZED", response);
                }

                // ACTUALIZACIÓN FORZADA: Refrescamos la lista inmediatamente tras el escaneo
                console.log("⚡ Acceso detectado: Actualizando historial...");
                await fetchAccesos(); 

            } catch (error) {
                console.error("Error procesando escaneo:", error);
            }
        }

        // Renderiza la lista de ingresos con estilo de filas/tarjetas
        function renderAccesos() {
            const container = document.getElementById('acceso-list-view');
            if (!container) return;

            if (!state.accesos || state.accesos.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 opacity-20">
                        <i data-lucide="database-zap" class="w-12 h-12 mb-4"></i>
                        <p class="text-sm font-white uppercase italic tracking-widest">Esperando Guerreros...</p>
                    </div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            container.innerHTML = state.accesos.map(acc => {
                const isAuth = acc.estado === 'AUTHORIZED' || acc.estado === 'AUTORIZADO';
                const statusText = isAuth ? 'Permitido' : 'Denegado';
                const statusColor = isAuth ? 'text-green-500' : 'text-red-500';
                const bgColor = isAuth ? 'bg-green-500/10' : 'bg-red-500/10';
                const borderColor = isAuth ? 'border-green-500/20' : 'border-red-500/20';

                // Partir fecha y hora correctamente según el formato "HH:mm - DD/MM/YY"
                const partes = acc.fecha_local ? acc.fecha_local.split(' - ') : ["--:--", "--/--"];
                const horaSolo = partes[0];
                const fechaSolo = partes[1];

                return `
                    <div class="grid grid-cols-12 gap-2 px-6 py-4 ${bgColor} border ${borderColor} rounded-2xl items-center text-[10px] transition-all hover:scale-[1.01]">
                        <div class="col-span-3 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black italic border border-white/10">
                                ${acc.nombre ? acc.nombre.substring(0,2).toUpperCase() : '??'}
                            </div>
                            <span class="text-[11px] font-black uppercase italic text-white truncate">${acc.nombre}</span>
                        </div>

                        <span class="col-span-2 text-center font-bold text-white-400 truncate">${acc.dni}</span>

                        <span class="col-span-1 text-center font-black text-white/80">${fechaSolo || '--'}</span>

                        <span class="col-span-1 text-center font-black text-white/80">${horaSolo || '--'}</span>

                        <span class="col-span-2 text-center font-black text-yellow-500 uppercase italic truncate px-1">
                            ${acc.actividad || 'MUSCULACIÓN'}
                        </span>

                        <div class="col-span-1 flex justify-center items-center gap-1">
                            <i data-lucide="${acc.metodo?.includes('QR') ? 'qr-code' : 'hard-drive'}" class="w-3 h-3 text-red-600"></i>
                            <span class="font-bold text-white-500 uppercase">${acc.metodo || 'S/D'}</span>
                        </div>

                        <div class="col-span-2 text-right">
                            <span class="px-3 py-1 rounded-full ${statusColor} text-[9px] font-black bg-black/40 border border-current uppercase italic">
                                ${statusText}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        }

        async function procesarEscaneo(codigoQR) {
            try {
                const response = await apiFetch('/acceso/validar', {
                    method: 'POST',
                    body: JSON.stringify({ qr_data: codigoQR })
                });

                if (response.success) {
                    if (typeof showScannerFeedback === 'function') {
                        showScannerFeedback(true, response.usuario);
                    }

                    // Actualización inmediata al detectar un guerrero
                    console.log("⚡ Guerrero detectado: Actualizando historial...");
                    await fetchAccesos(); 
                    
                } else {
                    if (typeof showScannerFeedback === 'function') {
                        showScannerFeedback(false, null, response.error);
                    }
                }
            } catch (error) {
                console.error("Error en proceso de escaneo:", error);
            }
        }

        // 3. EL REFRESCO DE CORTESÍA (POLLING)
        let vikingoRefreshInterval = null;

        function iniciarRefrescoAutomatico() {
            if (vikingoRefreshInterval) clearInterval(vikingoRefreshInterval);

            console.log("🛡️ Centinela Vikingo activado (Refresco cada 15s)");
            
            vikingoRefreshInterval = setInterval(() => {
                if (!document.hidden) {
                    fetchAccesos();
                }
            }, 15000); 
        }

        /**
         * 3. REGISTRAR NUEVO ACCESO (LLAMADO DESDE EL ESCÁNER)
         * Actualiza la lista en tiempo real sin recargar.
         */
        /*
        function registerAccessLog(nombre, dni, metodo, estado, actividad = 'MUSCULACIÓN') { 
            const nuevoAcceso = {
                nombre: nombre,
                dni: dni,
                fecha_local: `${new Date().toLocaleTimeString()} - ${new Date().toLocaleDateString()}`,
                metodo: metodo,
                estado: estado,
                actividad: actividad 
            };

            if (!state.accesos) state.accesos = [];
            state.accesos.unshift(nuevoAcceso);
            if (state.accesos.length > 50) state.accesos.pop();

            const currentView = document.querySelector('.view-content.active')?.id;
            if (currentView === 'view-acceso-virtual') {
                renderAccesos();
            }
        }
        */

			// FUNCIONES PARA EL MODAL DE MI QR
			async function showMyQR() {
				const user = state.user || JSON.parse(localStorage.getItem('user'));
				
				if (!user) {
					showVikingToast("Sesión no encontrada", true);
					return;
				}

				// Validación de plan SOLO para Alumnos
				if (user.rol_nombre === "Alumno") {
					const hoy = new Date().toISOString().split('T')[0];
					const vencimiento = user.fecha_vencimiento || "0000-00-00";
					if (vencimiento < hoy) {
						showVikingToast("ACCESO DENEGADO: Plan vencido.", true);
						return;
					}
				}

				const modal = document.getElementById('modal-mi-qr');
				const img = document.getElementById('img-mi-qr');
				const dniTxt = document.getElementById('qr-user-dni');
				const nameTxt = document.getElementById('qr-user-name');

				if (modal && img) {
					try {
						if (dniTxt) dniTxt.innerText = user.dni;
						if (nameTxt) nameTxt.innerText = user.nombre_completo;
						
						const hash = await generateVikingHash(user.dni);
						const qrData = `${user.dni}:${hash}`;
						
						img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&color=000000&bgcolor=ffffff&margin=10`;

						// Quitamos 'hidden', agregamos 'flex' y forzamos display
						modal.classList.remove('hidden');
						modal.classList.add('flex');
						modal.style.setProperty('display', 'flex', 'important'); 

						if (window.lucide) lucide.createIcons();
					} catch (error) {
						console.error("Error QR:", error);
						showVikingToast("Error al generar acceso", true);
					}
				} else {
					console.error("No se encontró el modal 'modal-mi-qr' en el DOM.");
				}
			}


				function closeMyQR() {
					const modal = document.getElementById('modal-mi-qr');
					if (modal) {
						modal.classList.add('hidden');
						modal.classList.remove('flex');
						modal.style.display = 'none'; // ELIMINA EL BLOQUEO
					}
				}

				async function generateVikingHash(dni) {
					const message = dni + SECRET_KEY;
					const encoder = new TextEncoder();
					const data = encoder.encode(message);
					const hashBuffer = await crypto.subtle.digest('SHA-256', data);
					const hashArray = Array.from(new Uint8Array(hashBuffer));
					return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
				}

				// Alternar entre Login y Reset
        function toggleResetPass(showReset) {
            document.getElementById('login-form-container').classList.toggle('hidden', showReset);
            document.getElementById('reset-form-container').classList.toggle('hidden', !showReset);
            document.getElementById('login-error').classList.add('hidden');
        }

        // --- PUNTO 2: Reset de Contraseña ---
        async function handleResetPassword(e) {
            e.preventDefault();
            const dni = document.getElementById('reset-dni').value;
            const pass = document.getElementById('reset-pass-new').value;
            const confirm = document.getElementById('reset-pass-confirm').value;
            const btn = document.getElementById('reset-button');

            if (pass !== confirm) {
                showVikingToast("Las contraseñas no coinciden", true);
                return;
            }

            btn.disabled = true;
            btn.innerText = "PROCESANDO...";

            // Buscamos al usuario por DNI para obtener su ID (Necesario para el endpoint PUT /staff o /alumnos)
            // Primero intentamos buscarlo en la base de datos de usuarios general
            const res = await apiFetch(`/usuarios/reset-password`, 'PUT', { 
                dni: dni, 
                password: pass 
            });

            if (!res.error) {
                showVikingToast("¡Contraseña actualizada con éxito!");
                toggleResetPass(false); // Volver al login
            } else {
                showVikingToast("Error: " + res.error, true);
            }
            btn.disabled = false;
            btn.innerText = "Cambiar Contraseña";
        }

		/**
		 * MOTOR DE AUDIO VIKINGO
		 * Genera tonos sintéticos para feedback inmediato en el molinete.
		 */
		function playVikingSound(type) {
			const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			const oscillator = audioCtx.createOscillator();
			const gainNode = audioCtx.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioCtx.destination);

			switch(type) {
				case 'success': // VERDE: Tono agudo y corto
					oscillator.type = 'sine';
					oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
					gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
					oscillator.start();
					oscillator.stop(audioCtx.currentTime + 0.2);
					break;
					
				case 'warning': // AMARILLO: Dos tonos (Aviso de vencimiento)
					oscillator.type = 'triangle';
					oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); 
					gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
					oscillator.start();
					oscillator.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.3);
					oscillator.stop(audioCtx.currentTime + 0.4);
					break;

				case 'error': // ROJO: Tono grave y vibrante
					oscillator.type = 'sawtooth';
					oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
					gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
					oscillator.start();
					oscillator.stop(audioCtx.currentTime + 0.5);
					break;
			}
		}

		async function loadFeriados() {
			// 🛡️ Capturamos la sucursal activa
			const sucursalId = state.viewing_sucursal_id || state.user?.sucursal_id;
			
			// Si no hay ID de sucursal, no disparamos la petición para evitar el error 422
			if (!sucursalId) {
				state.feriados = [];
				return;
			}

			try {
				// Enviamos el sucursal_id como parámetro de consulta (query param)
				const data = await apiFetch(`/feriados?sucursal_id=${parseInt(sucursalId)}`); 
				state.feriados = data || [];
			} catch (e) {
				console.error("Error cargando feriados:", e);
				state.feriados = [];
			}
		}

		async function loadClasesFeriado() {
			// 🛡️ Capturamos la sucursal activa
			const sucursalId = state.viewing_sucursal_id || state.user?.sucursal_id;
			
			// Si no hay ID de sucursal, no disparamos la petición para evitar el error 422
			if (!sucursalId) {
				state.clasesFeriado = [];
				return;
			}

			try {
				// Enviamos el sucursal_id como parámetro de consulta (query param)
				const data = await apiFetch(`/clases-feriado?sucursal_id=${parseInt(sucursalId)}`); 
				state.clasesFeriado = data || [];
			} catch (e) {
				console.error("Error cargando clases de feriado:", e);
				state.clasesFeriado = [];
			}
		}

		// Ponela justo arriba de window.switchView
		async function crearFeriadoVikingo() {
			console.log("🛡️ Intentando crear día especial...");
			const fechaEl = document.getElementById('feriado-fecha');
			const motivoEl = document.getElementById('feriado-motivo');
			
			// CAPTURA CRÍTICA: Tomamos la sucursal de la vista actual o la del usuario logueado
			const sucursalId = state.viewing_sucursal_id || state.user?.sucursal_id;

			if (!fechaEl || !motivoEl) return;
			if (!sucursalId) return showVikingToast("No se detectó sucursal activa", true);

			const fecha = fechaEl.value;
			const motivo = motivoEl.value;

			if (!fecha || !motivo) {
				if (typeof showVikingToast === 'function') showVikingToast("Completá fecha y motivo, fiera", true);
				else alert("Completá fecha y motivo");
				return;
			}

			try {
				// Enviamos el sucursal_id para que el impacto sea solo en esta sede
				const res = await apiFetch('/feriados', 'POST', {
					fecha: fecha,
					motivo: motivo,
					abierto: false,
					sucursal_id: parseInt(sucursalId) 
				});

				if (!res.error) {
					if (typeof showVikingToast === 'function') showVikingToast("¡Día especial marcado en esta sede!");
					
					// ⚔️ CAMBIO VIKINGO: Habilitamos visualmente la sección de cargar clases especiales
					const seccionClases = document.getElementById('seccion-programacion-clases');
					if (seccionClases) {
						seccionClases.classList.remove('opacity-50', 'pointer-events-none');
					}

					// No limpiamos la fecha acá para que te sirva de referencia al cargar las clases abajo
					// Pero sí el motivo si querés
					motivoEl.value = "";
					
					// Recargamos los datos del estado
					await loadFeriados();
					// Refrescamos el calendario (ahora filtrará por el sucursal_id guardado)
					renderCalendar();
				} else {
					showVikingToast("Error: " + res.error, true);
				}
			} catch (err) {
				console.error("Error en crearFeriadoVikingo:", err);
			}
		}

		// La asignamos a window para que el HTML la vea sí o si
		window.crearFeriadoVikingo = crearFeriadoVikingo;

		async function crearClaseFeriadoVikinga() {
			// Usamos la misma fecha que está arriba en el selector de feriados
			const fecha = document.getElementById('feriado-fecha').value;
			const nombre = document.getElementById('clase-feriado-nombre').value;
			const horario = document.getElementById('clase-feriado-hora').value;
			const cupo = document.getElementById('clase-feriado-cupo').value;
			
			// 🛡️ CAPTURA DE SEDE: 
			// Priorizamos la sede que el Admin está viendo en el calendario. 
			// Si no hay una vista específica (viewing_sucursal_id), usamos la del login.
			const sucursalId = state.viewing_sucursal_id || state.user?.sucursal_id;

			// Validación de datos y sucursal
			if (!fecha || !nombre || !horario) {
				showVikingToast("Falta fecha, nombre u horario", true);
				return;
			}

			if (!sucursalId) {
				showVikingToast("Error: No se detectó la sucursal activa", true);
				return;
			}

			// Enviamos el payload incluyendo sucursal_id para evitar el NULL en la DB
			const res = await apiFetch('/clases-feriado', 'POST', {
				fecha: fecha,
				nombre: nombre,
				horario: parseFloat(horario),
				capacidad_max: parseInt(cupo) || 40,
				color: "#FF0000",
				sucursal_id: parseInt(sucursalId) // <--- ASIGNACIÓN CRÍTICA
			});

			if (!res.error) {
				showVikingToast("¡Clase especial cargada en esta sede!");
				
				// Limpiamos los campos específicos del formulario
				document.getElementById('clase-feriado-nombre').value = "";
				document.getElementById('clase-feriado-hora').value = "";
				const cupoEl = document.getElementById('clase-feriado-cupo');
				if(cupoEl) cupoEl.value = "40"; 
				
				// Recargamos los datos del estado filtrados por sede y redibujamos
				await loadClasesFeriado();
				renderCalendar();
			} else {
				// Mostramos el detalle del error que venga del backend
				showVikingToast("Error: " + (res.detail || res.error), true);
			}
		}
		window.crearClaseFeriadoVikinga = crearClaseFeriadoVikinga;

		// 1. FUNCIÓN PARA LLENAR LOS SELECTS (Llamala al abrir el panel)
		function popularSelectsFeriado(fila) {
			const selectNombre = fila.querySelector('.clase-feriado-nombre');
			const selectHora = fila.querySelector('.clase-feriado-hora');
			const selectProf = fila.querySelector('.clase-feriado-profesor');
			const inputCupo = fila.querySelector('.clase-feriado-cupo'); // Referencia al nuevo campo de cupo

			if (!selectNombre || !selectHora || !selectProf) return;

			// 1. Llenar Actividades (Filtramos nombres únicos de state.clases)
			if (state.clases && state.clases.length > 0) {
				const actividades = [...new Set(state.clases.map(c => c.nombre))];
				// Agregamos un option vacío inicial para forzar el cambio
				selectNombre.innerHTML = '<option value="" selected disabled>Seleccionar...</option>' + 
										actividades.map(a => `<option value="${a}">${a}</option>`).join('');
				
				// ⚔️ EVENTO DE CUPO AUTOMÁTICO:
				// Cuando cambia la actividad, buscamos su cupo original en el estado global
				selectNombre.onchange = (e) => {
					const nombreElegido = e.target.value;
					const claseReferencia = state.clases.find(c => c.nombre === nombreElegido);
					
					if (claseReferencia && inputCupo) {
						// Seteamos el cupo original de la clase (o 20 si no tiene)
						inputCupo.value = claseReferencia.capacidad_max || 20;
					}
				};
			} else {
				selectNombre.innerHTML = '<option value="">Sin clases cargadas</option>';
			}

			// 2. Llenar Horarios
			let opcionesHora = "";
			for(let h=7; h<=21.5; h+=0.5) {
				const label = h % 1 === 0 ? `${h}:00` : `${Math.floor(h)}:30`;
				opcionesHora += `<option value="${h}">${label}</option>`;
			}
			selectHora.innerHTML = opcionesHora;

			// 3. Llenar Profesores (Combinamos profesores y administrativos)
			const staff = [...(state.profesores || []), ...(state.administrativos || [])];
			if (staff.length > 0) {
				selectProf.innerHTML = staff.map(p => `<option value="${p.nombre_completo}">${p.nombre_completo}</option>`).join('');
			} else {
				selectProf.innerHTML = '<option value="">Sin staff cargado</option>';
			}
		}

		window.toggleMenuFeriados = function() {
			const content = document.getElementById('menu-feriados-content');
			if (!content) return;
			
			content.classList.toggle('hidden');
			
			// Si lo estamos mostrando, llenamos los selects con la data fresca
			if (!content.classList.contains('hidden')) {
				const filas = document.querySelectorAll('.fila-clase-feriado');
				filas.forEach(f => popularSelectsFeriado(f));
				if (window.lucide) lucide.createIcons();
			}
		};

		// 2. FUNCIÓN PARA AGREGAR MÁS FILAS (El "+")
		window.agregarFilaClaseFeriado = function() {
			const contenedor = document.getElementById('contenedor-filas-feriado');
			const filasActuales = contenedor.querySelectorAll('.fila-clase-feriado');
			const ultimaFila = filasActuales[filasActuales.length - 1];
			
			if (!ultimaFila) return;

			const nuevaFila = ultimaFila.cloneNode(true);
			
			// Limpiamos los valores de la nueva fila para que no herede lo de la anterior
			nuevaFila.querySelector('.clase-feriado-nombre').value = "";
			nuevaFila.querySelector('.clase-feriado-cupo').value = "20";

			contenedor.appendChild(nuevaFila);
			
			// Llenamos los selects de la nueva fila ( Actividades, Staff, etc)
			popularSelectsFeriado(nuevaFila);
			
			if (window.lucide) lucide.createIcons();
		};

		// 3. GUARDADO MASIVO (Manda todas las filas al servidor)
		window.guardarClasesFeriadoBulk = async function() {
			const fecha = document.getElementById('feriado-fecha').value;
			// Tomamos la sede actual en visualización para asignar el feriado correctamente
			const currentSucursalId = state.viewing_sucursal_id || state.user?.sucursal_id;

			if (!fecha) return showVikingToast("Primero elegí la fecha", true);
			if (!currentSucursalId) return showVikingToast("No se detectó la sucursal", true);

			const filas = document.querySelectorAll('.fila-clase-feriado');
			let errores = 0;
			let cargados = 0;

			// Marcamos primero el día como feriado/especial para esa sucursal
			const motivo = document.getElementById('feriado-motivo').value || "Día Especial";
			
			try {
				await apiFetch('/feriados', 'POST', {
					fecha: fecha,
					motivo: motivo,
					abierto: false,
					sucursal_id: currentSucursalId
				});

				for (let fila of filas) {
					const nombre = fila.querySelector('.clase-feriado-nombre').value;
					if (!nombre) continue; // Saltamos filas vacías

					// ⚔️ CAPTURA DINÁMICA DE CUPO:
					// Tomamos el valor del input que se llenó automáticamente al elegir la actividad
					const cupoInput = fila.querySelector('.clase-feriado-cupo');
					const capacidad = cupoInput ? parseInt(cupoInput.value) : 20;

					const payload = {
						fecha: fecha,
						nombre: nombre,
						horario: parseFloat(fila.querySelector('.clase-feriado-hora').value),
						profesor: fila.querySelector('.clase-feriado-profesor').value,
						capacidad_max: capacidad, // <--- Ahora usa el cupo corregido
						color: "#FF0000",
						sucursal_id: currentSucursalId 
					};

					const res = await apiFetch('/clases-feriado', 'POST', payload);
					if (res.error) {
						errores++;
					} else {
						cargados++;
					}
				}

				if (errores === 0 && cargados > 0) {
					if (typeof showVikingToast === 'function') showVikingToast("¡Todas las clases cargadas!");
					
					// ⚔️ UI: Si todo salió bien, ocultamos el panel y reseteamos
					toggleMenuFeriados();
					
					await loadFeriados();
					await loadClasesFeriado();
					renderCalendar();
				} else if (cargados > 0) {
					showVikingToast(`Se cargaron ${cargados} clases, pero hubo ${errores} errores`, true);
					await loadFeriados();
					await loadClasesFeriado();
					renderCalendar();
				} else if (errores > 0) {
					showVikingToast(`Error crítico: No se pudo cargar ninguna clase`, true);
				}

			} catch (err) {
				console.error("Error en el guardado masivo:", err);
				showVikingToast("Fallo en la comunicación con el servidor", true);
			}
		};

		// Ejecutamos la carga inicial de los selects al cargar la página o abrir el panel
		document.addEventListener('DOMContentLoaded', () => {
			const filaInicial = document.querySelector('.fila-clase-feriado');
			if(filaInicial) popularSelectsFeriado(filaInicial);
		});

        // --- PUNTO 3: Dashboard Específico Profesor ---
        async function loadProfessorDashboard() {
			if (!state.user || state.user.rol_nombre !== "Profesor") return;
			
			console.log("📊 Cargando métricas de Coach...");
			
			// Obtener datos frescos de la API
			const [clasesRaw, reservasRaw] = await Promise.all([
				apiFetch('/clases'),
				apiFetch('/reservas')
			]);

			// Validar que no haya errores en las respuestas
			const clases = Array.isArray(clasesRaw) ? clasesRaw : [];
			const reservas = Array.isArray(reservasRaw) ? reservasRaw : [];

			// 1. Filtrar clases asignadas a este profesor
			const misClases = clases.filter(c => c.coach === state.user.nombre_completo);
			const containerHoy = document.getElementById('prof-dash-today-classes');
			
			if (containerHoy) {
				if (misClases.length === 0) {
					containerHoy.innerHTML = '<p class="text-center text-gray-500 italic text-[10px] py-10">No tienes clases asignadas.</p>';
				} else {
					containerHoy.innerHTML = misClases.map(c => `
						<div class="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-red-600/30 transition-all">
							<div>
								<p class="text-[11px] font-black uppercase italic text-white">${c.nombre}</p>
								<p class="text-[9px] text-gray-500 font-bold uppercase">Cupo: ${c.capacidad_max} Guerreros</p>
							</div>
							<div class="w-2 h-10 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.2)]" style="background-color: ${c.color || '#FF0000'}"></div>
						</div>
					`).join('');
				}
			}

			// 2. Cálculo de convocatoria (Alumnos totales en sus clases)
			const misIds = misClases.map(c => c.id);
			const misReservas = reservas.filter(r => misIds.includes(r.clase_id));
			
			const elTotal = document.getElementById('prof-dash-total-students');
			if (elTotal) elTotal.innerText = misReservas.length;

			// 3. Ranking de alumnos más frecuentes
			const studentCounts = {};
			misReservas.forEach(r => {
				if (r.alumno_dni) {
					studentCounts[r.alumno_dni] = (studentCounts[r.alumno_dni] || 0) + 1;
				}
			});

			const topStudents = Object.entries(studentCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5);

			const containerTop = document.getElementById('prof-dash-top-students');
			if (containerTop) {
				if (topStudents.length === 0) {
					containerTop.innerHTML = '<p class="text-center text-gray-600 italic text-[10px] py-4">Sin actividad registrada.</p>';
				} else {
					containerTop.innerHTML = topStudents.map(([dni, count]) => `
						<div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
							<div class="flex items-center gap-3">
								<div class="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
								<span class="text-[10px] font-black italic uppercase text-white">${dni}</span>
							</div>
							<span class="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-lg">${count} ASISTENCIAS</span>
						</div>
					`).join('');
				}
			}

			if (window.lucide) lucide.createIcons();
		}

			// --- VARIABLES DE ESTADO PARA PAGINACIÓN ---
            if (!state.currentPageAlumnos) state.currentPageAlumnos = 1;
            state.itemsPerPage = 15;
            state.filteredAlumnos = []; // Almacena el resultado de filtros/búsqueda para paginar

            /**
             * 1. Renderizado de la Lista (DISEÑO STAFF + PAGINACIÓN + STATS)
             */
            function renderAlumnosList(listaDatos) {
				const contenedor = document.getElementById('lista-alumnos-container');
				if (!contenedor) return;

				// Guardamos la lista actual para que la paginación sepa sobre qué trabajar
				state.filteredAlumnos = listaDatos;

				// --- ACTUALIZACIÓN DE ESTADÍSTICAS VIKINGAS ---
				// Corregido: Las estadísticas ahora se basan en listaDatos (la lista ya filtrada por sede/busqueda)
				const hoy = new Date().toISOString().split('T')[0];
				const total = listaDatos.length;
				const activos = listaDatos.filter(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy).length;
				const vencidos = total - activos;

				if (document.getElementById('stats-total')) document.getElementById('stats-total').innerText = total;
				if (document.getElementById('stats-activos')) document.getElementById('stats-activos').innerText = activos;
				if (document.getElementById('stats-vencidos')) document.getElementById('stats-vencidos').innerText = vencidos;
				if (document.getElementById('stats-pagina')) document.getElementById('stats-pagina').innerText = state.currentPageAlumnos;

				// --- LÓGICA DE PAGINACIÓN ---
				const totalItems = listaDatos.length;
				const totalPages = Math.ceil(totalItems / state.itemsPerPage);
				
				const inicio = (state.currentPageAlumnos - 1) * state.itemsPerPage;
				const fin = inicio + state.itemsPerPage;
				const listaPaginada = listaDatos.slice(inicio, fin);

				if (listaPaginada.length === 0) {
					contenedor.innerHTML = `
						<div class="h-full flex flex-col items-center justify-center text-white/20 py-10">
							<i data-lucide="users" class="w-12 h-12 mb-2"></i>
							<p class="text-xs font-black uppercase italic tracking-widest">Sin resultados en el arsenal</p>
						</div>`;
					renderPaginationControls(0);
					if (window.lucide) lucide.createIcons();
					return;
				}

				contenedor.innerHTML = listaPaginada.map(a => {
					// Lógica de Estado
					const estaVencido = !a.fecha_vencimiento || a.fecha_vencimiento < hoy;
					const colorEstado = estaVencido ? 'bg-red-600' : 'bg-green-600'; 
					const textoEstado = estaVencido ? 'VENCIDO' : 'ACTIVO';
					const colorBadge = estaVencido ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-green-500 bg-green-500/10 border-green-500/20';

					const initials = a.nombre_completo ? a.nombre_completo.substring(0, 2).toUpperCase() : "??";
					const planNombre = a.plan ? a.plan.nombre : 'Sin Plan';

					// 🛡️ BÚSQUEDA DE SUCURSAL (Igual que en Staff)
					const sedeObj = state.sucursales?.find(s => String(s.id) === String(a.sucursal_id));
					const sucursalNombre = a.sucursal_nombre || sedeObj?.sucursal || "SEDE NO ASIGNADA";

					return `
					<div class="glass-card p-5 rounded-3xl border-white/5 flex flex-col md:flex-row md:items-center gap-6 hover:border-red-600/20 transition-all group relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1.5 ${colorEstado} opacity-40 group-hover:opacity-100 transition-opacity"></div>
						
						<div class="flex items-center gap-4 w-full md:w-1/3">
							<div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-lg italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors shrink-0">
								${initials}
							</div>
							<div class="overflow-hidden">
								<h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors truncate">${a.nombre_completo}</h4>
								<div class="flex flex-col mt-1 gap-1">
									<p class="text-[10px] text-white-500 font-bold flex items-center gap-1.5"><i data-lucide="id-card" class="w-3 h-3"></i> ${a.dni}</p>
									<p class="text-[9px] text-red-500 font-black flex items-center gap-1.5 uppercase italic">
										<i data-lucide="map-pin" class="w-3 h-3"></i> ${sucursalNombre.toUpperCase()}
									</p>
								</div>
							</div>
						</div>

						<div class="flex-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
								
								<div>
									<p class="text-[9px] text-white-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
										<i data-lucide="ticket" class="w-3 h-3 text-red-600"></i> Plan Actual
									</p>
									<p class="text-sm font-black uppercase italic text-white truncate">${planNombre}</p>
								</div>

								<div class="flex flex-row md:flex-col items-center md:items-start justify-between gap-2">
									<div class="flex items-center gap-2">
										<span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${colorBadge}">
											${textoEstado}
										</span>
									</div>
									<p class="text-[10px] text-white-500 font-bold italic flex items-center gap-1">
										Vence: <span class="text-white">${a.fecha_vencimiento || 'N/A'}</span>
									</p>
								</div>
							</div>
						</div>

						<div class="flex items-center justify-end min-w-[100px] border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
							<button onclick="openEditAlumno(${a.id})" class="px-6 py-3 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-white/10 hover:text-red-500 transition-all flex items-center gap-2 shadow-lg w-full md:w-auto justify-center">
								<i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
								<span>Editar</span>
							</button>
						</div>
					</div>
					`;
				}).join('');
				
				renderPaginationControls(totalPages);
				if (window.lucide) lucide.createIcons();
			}

            /**
             * 2. Función de Filtrado
             */
            function filterAlumnos(filtro) {
				// 1. Validar que existan alumnos
				if (!state.alumnos) return;

				// 2. Si se pasa un nuevo filtro (desde botones), actualizar estado. 
				// Si no (desde el select), usar el que ya estaba.
				if (filtro) {
					state.alumnosStatusFilter = filtro;
				} else {
					filtro = state.alumnosStatusFilter || 'todos';
				}

				// 3. Resetear página
				state.currentPageAlumnos = 1; 

				// 4. Obtener valores de los otros filtros (Sucursal y Buscador)
				const sucursalSelect = document.getElementById('filter-sucursal-alumnos');
				const sucursalId = sucursalSelect ? sucursalSelect.value : 'all';
				
				const searchInput = document.getElementById('search-alumno-input');
				const searchVal = searchInput ? searchInput.value.toLowerCase() : "";

				// 5. UI: Gestionar botones de estado (Activos/Vencidos)
				document.querySelectorAll('.filter-btn, .filter-btn-alumno').forEach(btn => {
					btn.classList.remove('bg-red-600', 'text-black');
					btn.classList.add('text-white-500', 'hover:text-white');
				});

				const activeBtn = document.getElementById('filter-' + filtro);
				if (activeBtn) {
					activeBtn.classList.remove('text-white-500', 'hover:text-white');
					activeBtn.classList.add('bg-red-600', 'text-black');
				}

				// 6. LÓGICA DE FILTRADO COMBINADA
				const hoy = new Date().toISOString().split('T')[0];
				let filtrados = [...state.alumnos];

				// A. Filtrar por Sede
				if (sucursalId !== 'all') {
					filtrados = filtrados.filter(a => String(a.sucursal_id) === String(sucursalId));
				}

				// B. Filtrar por Estado (Todos, Activos o Vencidos)
				if (filtro === 'activos') {
					filtrados = filtrados.filter(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy);
				} else if (filtro === 'vencidos') {
					filtrados = filtrados.filter(a => !a.fecha_vencimiento || a.fecha_vencimiento < hoy);
				}

				// C. Filtrar por Buscador (Si el usuario escribió algo)
				if (searchVal) {
					filtrados = filtrados.filter(a => 
						(a.nombre_completo && a.nombre_completo.toLowerCase().includes(searchVal)) || 
						(a.dni && a.dni.includes(searchVal))
					);
				}

				// 7. Renderizar
				if (typeof renderAlumnosList === 'function') {
					renderAlumnosList(filtrados);
				}
			}


            /**
             * 3. Función de Búsqueda
             */
            function searchAlumno(query) {
                state.currentPageAlumnos = 1; // Siempre volvemos a la página 1 al buscar
                if(!query) { filterAlumnos('todos'); return; }
                
                // Al buscar, reseteamos todos los botones de filtro a su estado normal (gris)
                document.querySelectorAll('.filter-btn, .filter-btn-alumno').forEach(btn => {
                    btn.classList.remove('bg-red-600', 'text-black');
                    btn.classList.add('text-white-500', 'hover:text-white');
                });

                const q = query.toLowerCase();
                const filtrados = state.alumnos.filter(a => a.nombre_completo.toLowerCase().includes(q) || a.dni.includes(q));
                renderAlumnosList(filtrados);
            }

            /**
             * 4. Genera los botones de la paginación
             */
            function renderPaginationControls(totalPages) {
                const paginator = document.getElementById('alumnos-pagination');
                if (!paginator) return;
                
                // Si no hay resultados o solo hay una página, ocultamos paginador
                if (totalPages <= 1) {
                    paginator.innerHTML = "";
                    return;
                }

                const isFirstPage = state.currentPageAlumnos === 1;
                const isLastPage = state.currentPageAlumnos === totalPages;

                // Botón Anterior
                let html = `
                    <button onclick="${isFirstPage ? '' : 'window.changePageAlumnos(' + (state.currentPageAlumnos - 1) + ')'}" 
                            class="p-3 rounded-xl bg-white/5 border border-white/10 text-white transition-all ${isFirstPage ? 'opacity-20 cursor-not-allowed' : 'hover:bg-red-600 hover:text-black'}"
                            ${isFirstPage ? 'disabled' : ''}>
                        <i data-lucide="chevron-left" class="w-4 h-4"></i>
                    </button>
                `;

                // Números de página inteligentes
                for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= state.currentPageAlumnos - 1 && i <= state.currentPageAlumnos + 1)) {
                        html += `
                            <button onclick="window.changePageAlumnos(${i})" 
                                    class="w-10 h-10 rounded-xl font-black italic text-[11px] transition-all ${state.currentPageAlumnos === i ? 'bg-red-600 text-black shadow-lg shadow-red-600/20' : 'bg-white/5 text-white/40 hover:text-white border border-white/10'}">
                                ${i}
                            </button>
                        `;
                    } else if (i === state.currentPageAlumnos - 2 || i === state.currentPageAlumnos + 2) {
                        html += `<span class="text-white/20">...</span>`;
                    }
                }

                // Botón Siguiente
                html += `
                    <button onclick="${isLastPage ? '' : 'window.changePageAlumnos(' + (state.currentPageAlumnos + 1) + ')'}" 
                            class="p-3 rounded-xl bg-white/5 border border-white/10 text-white transition-all ${isLastPage ? 'opacity-20 cursor-not-allowed' : 'hover:bg-red-600 hover:text-black'}"
                            ${isLastPage ? 'disabled' : ''}>
                        <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </button>
                `;

                paginator.innerHTML = html;
                if(window.lucide) lucide.createIcons();
            }

            /**
             * 5. Cambia la página y refresca la lista
             */
            function changePageAlumnos(newPage) {
                const totalPages = Math.ceil(state.filteredAlumnos.length / state.itemsPerPage);
                if (newPage < 1 || newPage > totalPages) return;
                
                state.currentPageAlumnos = newPage;
                renderAlumnosList(state.filteredAlumnos);
                
                // Scroll arriba del contenedor suavemente
                const contenedor = document.getElementById('lista-alumnos-container');
                if(contenedor) {
                    contenedor.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            // ==========================================
            // NUEVA LÓGICA DE ALUMNOS (FIX PANTALLA VACÍA)
            // ==========================================

            /**
             * 6. Función de Entrada (Trigger inicial)
             */
            function renderAlumnosSection() {
                filterAlumnos('todos');
            }

            /**
             * 7. Utilidades Generales de la Interfaz
             */
            function toggleMobileMenu() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('mobile-overlay');
                
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            }

            /**
             * 8. Cierre de Sesión
             */
            function cerrarSesionVikinga() {
                // 1. Borrar datos de sesión
                localStorage.removeItem('viking_user');
                localStorage.removeItem('viking_token');
                
                // 2. Limpiar estado global
                if (typeof state !== 'undefined') {
                    state.user = null;
                }

                // 3. Recargar página
                location.reload();
            }

            // --- VINCULACIÓN CON WINDOW (Para acceso desde el HTML) ---
            window.filterAlumnos = filterAlumnos;
            window.searchAlumno = searchAlumno;
            window.renderAlumnosList = renderAlumnosList;
            window.changePageAlumnos = changePageAlumnos;
            window.renderPaginationControls = renderPaginationControls;
            window.renderAlumnosSection = renderAlumnosSection;
            window.toggleMobileMenu = toggleMobileMenu;
            window.cerrarSesionVikinga = cerrarSesionVikinga;

        document.getElementById('form-nuevo-ejercicio-lib').onsubmit = async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('lib-ex-nombre').value;
            const grupo_id = parseInt(document.getElementById('lib-ex-grupo').value);
            
            const res = await apiFetch('/rutinas/ejercicios', 'POST', { nombre, grupo_muscular_id: grupo_id });
            if (!res.error) {
                showVikingToast("Ejercicio creado en librería");
                closeModal('modal-nuevo-ejercicio');
                await loadMusculacionMetadata();
            } else {
                showVikingToast("Error al crear: " + res.error, true);
            }
        };
		
		document.getElementById('form-clase').onsubmit = saveClaseVikinga;

		/**
		 * =========================================================
		 * 4. PUENTES DE COMPATIBILIDAD (ALIAS MÁGICOS)
		 * =========================================================
		 * Esto permite que tu HTML viejo llame a funciones con nombres
		 * antiguos y sean redirigidos automáticamente a las nuevas.
		 */

		/**
		 * Muestra el aviso (toast) configurado en el HTML
		 */
		function showToast(message, type = "success") {
			const toast = document.getElementById('viking-toast');
			if (toast) {
				toast.innerText = message;
				toast.classList.add('show');
				// Cambiar color según tipo si es necesario
				toast.style.borderLeft = type === "error" ? "4px solid #ff0000" : "4px solid #00ff00";
				
				setTimeout(() => toast.classList.remove('show'), 3000);
			}
		}
		
		// Aseguramos que estén disponibles globalmente
		window.showToast = showToast;
		window.openModal = openModal;
		window.closeModal = closeModal;

		window.openModalSucursal = function() {
			console.log("📂 Abriendo modal de sucursal...");
			const form = document.getElementById('form-sucursal');
			if (form) form.reset();
			
			const idInput = document.getElementById('suc-id');
			if (idInput) idInput.value = '';
			
			const title = document.getElementById('modal-sucursal-title');
			if (title) title.innerText = "Nueva Sucursal";
			
			const modal = document.getElementById('modal-sucursal');
			if (modal) {
				modal.classList.remove('hidden');
				modal.style.display = 'flex'; 
			}
		};


		window.handleSaveSucursal = async function(e) {
			if(e) e.preventDefault();
			
			const data = {
				sucursal: document.getElementById('suc-nombre').value,
				direccion: document.getElementById('suc-direccion').value
			};

			try {
				const response = await fetch(`${API_BASE}/sucursales`, {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${localStorage.getItem('viking_token')}`
					},
					body: JSON.stringify(data)
				});

				if (response.ok) {
					showToast("Sede Vikinga establecida");
					if (typeof closeModal === 'function') {
						closeModal('modal-sucursal');
					} else {
						document.getElementById('modal-sucursal').classList.add('hidden');
					}
					loadSucursales();
				} else {
					const error = await response.json();
					showToast(error.detail || "Error al crear sucursal", "error");
				}
			} catch (error) {
				showToast("Error de conexión con el servidor", "error");
			}
		};

		// --- FILTROS SECCIÓN RUTINAS ---
		window.filterRutinas = function(filtro) {
			if(!state.alumnos) return;
			
			// Actualizar botones visualmente (filtros de rutina)
			document.querySelectorAll('.filter-btn-rutina').forEach(btn => {
				btn.classList.remove('bg-red-600', 'text-black');
				btn.classList.add('text-white-500', 'hover:text-white');
			});
			const activeBtn = document.getElementById('filter-rutina-' + filtro);
			if(activeBtn) {
				activeBtn.classList.remove('text-white-500', 'hover:text-white');
				activeBtn.classList.add('bg-red-600', 'text-black');
			}

			const hoy = new Date().toISOString().split('T')[0];
			
			// Filtro base: Solo alumnos con planes que permiten musculación
			let baseMusculacion = state.alumnos.filter(a => {
				const planNombre = (a.plan?.nombre || "").toLowerCase();
				const normalized = planNombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
				return normalized.includes('musculacion') || normalized.includes('completo') || normalized.includes('personalizado') || planNombre === 'premium';
			});

			let filtrados = baseMusculacion;
			
			// Aplicar filtros de estado de rutina
			if(filtro === 'con') filtrados = baseMusculacion.filter(a => a.rutina_id);
			if(filtro === 'sin') filtrados = baseMusculacion.filter(a => !a.rutina_id);
			if(filtro === 'vencidas') filtrados = baseMusculacion.filter(a => a.rutina_vencimiento && a.rutina_vencimiento < hoy);
			
			renderRutinasList(filtrados);
		}

		// Búsqueda en Rutinas
		window.searchRutinaAlumno = function(query) {
			if(!query) { filterRutinas('todos'); return; }
			
			document.querySelectorAll('.filter-btn-rutina').forEach(btn => {
				btn.classList.remove('bg-red-600', 'text-black');
				btn.classList.add('text-white-500');
			});

			const q = query.toLowerCase();
			const filtrados = state.alumnos.filter(a => {
				// Primero que sea de musculación
				const planNombre = (a.plan?.nombre || "").toLowerCase();
				const normalized = planNombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
				const esMusculo = normalized.includes('musculacion') || normalized.includes('completo') || normalized.includes('personalizado') || planNombre === 'premium';
				
				// Luego buscamos por nombre o dni
				return esMusculo && (a.nombre_completo.toLowerCase().includes(q) || a.dni.includes(q));
			});
			renderRutinasList(filtrados);
		}

		window.renderRutinasList = function(listaDatos) {
			const contenedor = document.getElementById('rutinas-lista');
			if(!contenedor) return;

			if(listaDatos.length === 0) {
				contenedor.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-10"><i data-lucide="dumbbell" class="w-12 h-12 mb-2"></i><p class="text-xs font-black uppercase italic">Sin guerreros en esta categoría</p></div>`;
				if(window.lucide) lucide.createIcons();
				return;
			}

			const hoy = new Date().toISOString().split('T')[0];

			contenedor.innerHTML = listaDatos.map(a => {
				// Lógica de Estado de Plan (Identica a Alumnos)
				const estaVencido = !a.fecha_vencimiento || a.fecha_vencimiento < hoy;
				const colorEstado = estaVencido ? 'bg-red-600' : 'bg-green-600'; 
				const textoEstado = estaVencido ? 'VENCIDO' : 'ACTIVO';
				const colorBadge = estaVencido ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-green-500 bg-green-500/10 border-green-500/20';

				const initials = a.nombre_completo ? a.nombre_completo.substring(0,2).toUpperCase() : "??";
				const planNombre = a.plan ? a.plan.nombre : 'Sin Plan';

				return `
				<div class="glass-card p-5 rounded-3xl border-white/5 flex flex-col md:flex-row md:items-center gap-6 hover:border-red-600/20 transition-all group relative overflow-hidden bg-gradient-to-r from-white/[0.01] to-transparent">
					<div class="absolute left-0 top-0 bottom-0 w-1.5 ${colorEstado} opacity-40 group-hover:opacity-100 transition-opacity"></div>
					
					<!-- IDENTIDAD -->
					<div class="flex items-center gap-4 w-full md:w-1/3">
						<div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-lg italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors shrink-0">
							${initials}
						</div>
						<div class="overflow-hidden">
							<h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors truncate">${a.nombre_completo}</h4>
							<p class="text-[10px] text-white-500 font-bold flex items-center gap-1.5 mt-1"><i data-lucide="id-card" class="w-3 h-3"></i> ${a.dni}</p>
						</div>
					</div>

					<!-- PLAN Y ESTADO -->
					<div class="flex-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
							<div>
								<p class="text-[9px] text-white-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
									<i data-lucide="ticket" class="w-3 h-3 text-red-600"></i> Plan Actual
								</p>
								<p class="text-sm font-black uppercase italic text-white truncate">${planNombre}</p>
							</div>
							<div class="flex flex-row md:flex-col items-center md:items-start justify-between gap-2">
								<span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${colorBadge}">
									${textoEstado}
								</span>
								<p class="text-[10px] text-white-500 font-bold italic">
									Vence: <span class="text-white">${a.fecha_vencimiento || 'N/A'}</span>
								</p>
							</div>
						</div>
					</div>

					<!-- ACCIONES: FICHA, HISTORIAL, NUEVA RUTINA -->
					<div class="flex items-center justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0 gap-2">
						<button onclick="openFichaTecnica(${a.id})" class="p-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all" title="Ficha Técnica">
							<i data-lucide="clipboard-list" class="w-4 h-4"></i>
						</button>

						
						<button onclick="openHistorialRutinas(${a.id})" class="p-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg transition-all" title="Historial">
							<i data-lucide="history" class="w-4 h-4"></i>
						</button>

						<button onclick="openRoutineEditor(${a.id}, false)" class="px-6 py-3 viking-bg-red text-black rounded-xl text-[10px] font-black uppercase italic hover:scale-105 transition-all shadow-lg flex items-center gap-2">
							<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
							<span>Nueva Rutina</span>
						</button>
					</div>
				</div>
				`;
			}).join('');
			
			if(window.lucide) lucide.createIcons();
		};

		window.deleteSucursal = async function(id) {
			if (!confirm("¿Deseas eliminar esta sede? Los alumnos asignados quedarán sin sucursal.")) return;
			try {
				const response = await fetch(`${API_BASE}/sucursales/${id}`, {
					method: 'DELETE',
					headers: { 'Authorization': `Bearer ${localStorage.getItem('viking_token')}` }
				});
				if (response.ok) {
					loadSucursales();
					showToast("Sucursal eliminada");
				}
			} catch (error) {
				showToast("No se pudo eliminar la sucursal", "error");
			}
		};
				
		// Si el botón dice onclick="finalizarVenta()", ejecuta finalizarVentaMercaderia()
		window.finalizarVenta = finalizarVentaMercaderia; 

		// Si el botón dice onclick="confirmarCobroFinal()", ejecuta finalizarVentaMercaderia()
		window.confirmarCobroFinal = finalizarVentaMercaderia;

        window.onclick = function(event) {
            if (event.target.classList.contains('search-exercise-input')) return;
            document.querySelectorAll('.exercise-results-list').forEach(list => list.classList.add('hidden'));
        };
        
		window.addEventListener('load', () => {
			// 1. Lógica existente: Inicializar formulario de stock
			const f = document.getElementById('form-stock');
			if(f) f.onsubmit = saveStockVikingo;

			/**
			 * BARRERA DE SEGURIDAD MULTISUCURSAL
			 * Solo activamos el motor de datos si el usuario está logueado.
			 * Esto evita el error 401 y el bucle de refresco infinito.
			 */
			const token = localStorage.getItem('viking_token') || (state && state.token);

			if (token) {
				// 2. PRIORIDAD 1: Activar el motor de tiempo real para el historial
				// Solo si hay token, procedemos a pedir datos al servidor
				if (typeof fetchAccesos === 'function') {
					console.log("🚀 Sesión detectada. Iniciando carga de datos de acceso...");
					fetchAccesos(); // Carga inicial inmediata
				}

				if (typeof iniciarRefrescoAutomatico === 'function') {
					iniciarRefrescoAutomatico(); // Arranca el ciclo de actualización constante
				}
			} else {
				// Si no hay token, el sistema permanece en "reposo" hasta el login exitoso
				console.log("🔒 Sistema en espera: No hay sesión activa para sincronizar historial.");
			}
		});
		
        window.onload = async () => {
    // --- 1. PERSISTENCIA DE SESIÓN (EL CORAZÓN DEL F5) ---
    const savedUser = localStorage.getItem('viking_user');
    const savedToken = localStorage.getItem('viking_token');

    if (savedUser && savedToken) {
        console.log("⚔️ Sesión recuperada: Entrando al Valhalla...");
        const user = JSON.parse(savedUser);
        
        // Restaurar el estado global para que las APIs funcionen
        state.user = user;

        // Ocultar login y mostrar el sistema
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

        // Llenar datos de UI
        const elName = document.getElementById('side-user-name');
        if (elName) elName.innerText = user.nombre_completo || "Usuario";

        const elRole = document.getElementById('side-user-role');
        if (elRole) elRole.innerText = user.rol_nombre || 'Staff';

        // Lógica de Iniciales
        const name = user.nombre_completo || "Usuario Vikingo";
        const initials = name.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const elInitials = document.getElementById('user-initials');
        if (elInitials) elInitials.innerText = initials;

        // Cargar datos maestros (Profesores, etc.)
        await loadProfesores();

        if (typeof initApp === 'function') {
            await initApp();
        } else {
            if (typeof loadClases === 'function') loadClases();
            if (typeof loadStock === 'function') loadStock();
        }

        // Ir al Dashboard directamente
        switchView('dashboard');

        // Dashboards específicos según el rol
        if (user.rol_nombre === "Alumno" && typeof renderStudentDashboard === 'function') await renderStudentDashboard();
        if (user.rol_nombre === "Profesor" && typeof loadProfessorDashboard === 'function') await loadProfessorDashboard();
    }

    // --- 2. CONFIGURACIÓN DE FORMULARIOS (TU LÓGICA ORIGINAL) ---
    const formClase = document.getElementById('form-clase');
    if(formClase) {
        formClase.onsubmit = saveClaseVikinga;
    }

    // Dibujar iconos de Lucide
    if(window.lucide) lucide.createIcons();
};