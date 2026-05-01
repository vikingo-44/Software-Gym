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
			const navItems = document.querySelectorAll('.nav-item');
			
			navItems.forEach(item => {
				item.addEventListener('click', () => {
					// Solo si estamos en resolución móvil/tablet
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

			// Bloqueo de zoom por gestos de dedos (Multi-touch)
			document.addEventListener('touchstart', (e) => {
				if (e.touches.length > 1) {
					e.preventDefault();
				}
			}, { passive: false });

			// Bloqueo de zoom por doble tap
			let lastTouchEnd = 0;
			document.addEventListener('touchend', (e) => {
				const now = (new Date()).getTime();
				if (now - lastTouchEnd <= 300) {
					e.preventDefault();
				}
				lastTouchEnd = now;
			}, false);
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
			
			// 1. CONTENEDORES (Secciones de título)
			const contenedoresSeccion = {
				staff: document.getElementById('nav-section-staff'),
				operativa: document.getElementById('nav-section-operativa'),
				virtual: document.getElementById('nav-section-virtual')
			};

			// 2. ITEMS INDIVIDUALES (Botones)
			// AGREGAMOS 'sucursales' a la lista para poder controlarlo
			const itemsMenu = {
				alumnos: document.getElementById('nav-alumnos'),
				planes: document.getElementById('nav-planes'),
				clases: document.getElementById('nav-clases'),
				facturacion: document.getElementById('nav-cobrar'),
				acceso: document.getElementById('nav-acceso-virtual'),
				sucursales: document.getElementById('nav-sucursales'),
				rutinas: document.getElementById('nav-rutinas') // <-- AGREGADO
			};

			// RESET: Contenedores a BLOCK
			Object.values(contenedoresSeccion).forEach(el => {
				if (el) el.style.setProperty('display', 'block', 'important');
			});

			// RESET: Items a FLEX (Volvemos a mostrar todo por defecto)
			Object.values(itemsMenu).forEach(el => {
				if (el) el.style.setProperty('display', 'flex', 'important');
			});

			// --- LÓGICA POR ROL ---

			// A. Alumnos (Ocultan secciones y casi todos los botones)
			if (rol === "alumno") {
				// Escondemos todas las secciones de título
				Object.values(contenedoresSeccion).forEach(el => { 
					if(el) el.style.setProperty('display', 'none', 'important'); 
				});
				
				// Escondemos los botones restringidos (Sucursales, Planes, Facturación, etc.)
				const itemsParaOcultar = ['planes', 'facturacion', 'sucursales', 'alumnos', 'clases', 'rutinas'];
				itemsParaOcultar.forEach(key => {
					if(itemsMenu[key]) itemsMenu[key].style.setProperty('display', 'none', 'important');
				});
			}

			// B. Profesores (Pueden ver alumnos, pero no facturación ni sucursales)
			else if (rol === "profesor") {
				if(itemsMenu.facturacion) itemsMenu.facturacion.style.setProperty('display', 'none', 'important');
				if(itemsMenu.sucursales) itemsMenu.sucursales.style.setProperty('display', 'none', 'important');
				if(itemsMenu.planes) itemsMenu.planes.style.setProperty('display', 'none', 'important');
				// El profesor suele necesitar ver 'alumnos' para las rutinas
			}

			// C. Administrativo (Oculta solo Staff)
			else if (rol === "administracion" || rol === "administrativo") {
				if (contenedoresSeccion.staff) contenedoresSeccion.staff.style.setProperty('display', 'none', 'important');
				
				const staffDashboardPanel = document.getElementById('dash-staff-access');
				if (staffDashboardPanel) {
					const card = staffDashboardPanel.closest('.glass-card');
					if (card) card.style.setProperty('display', 'none', 'important');
				}
			}

			if (window.lucide) lucide.createIcons();
		}

		/**
		* REQUERIMIENTO: Mostrar fecha exacta en el Dashboard del Alumno.
		* Se actualiza la función renderStudentDashboard para formatear 'fecha_clase'.
		*/

		async function renderStudentDashboard() {
			const u = state.user; 
			if (!u) return;
			
			// 1. CARGA DE DATOS BÁSICOS
			// Usamos ?. para evitar errores si algún elemento no existe en el DOM
			const elName = document.getElementById('al-dash-name');
			const elPlan = document.getElementById('al-dash-plan');
			const elVenc = document.getElementById('al-dash-vencimiento');

			if (elName) elName.innerText = u.nombre_completo || "Usuario Vikingo";
			if (document.getElementById('al-dash-dni')) document.getElementById('al-dash-dni').innerText = u.dni || "-";
			if (elPlan) elPlan.innerText = u.plan?.nombre || u.plan_nombre || 'SIN PLAN';
			if (elVenc) elVenc.innerText = u.fecha_vencimiento ? new Date(u.fecha_vencimiento).toLocaleDateString('es-AR') : '-';
			if (document.getElementById('al-dash-renovacion')) document.getElementById('al-dash-renovacion').innerText = u.fecha_ultima_renovacion || '-';
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
				const hoy = new Date();
				const diff = (hoy - fCert) / (1000 * 60 * 60 * 24);
				if (diff > 365) {
					elPlan.innerHTML += ` <span class="text-[8px] bg-red-600 text-black font-black px-2 py-0.5 rounded ml-2 italic">CERTIF. VENCIDO</span>`;
				}
			}

			// 2. GESTIÓN DE CRÉDITOS Y RESERVAS (Membresía)
			const limite = u.plan?.clases_mensuales || 0;
			const esFull = limite >= 99; 

			// Sincronizamos reservas
			const allReservas = await apiFetch('/reservas');
			if (!allReservas.error && Array.isArray(allReservas)) {
				state.reservas = allReservas; 
			}
			
			const hoy = new Date();
			const reservasMes = (state.reservas || []).filter(r => {
				const fecha = new Date(r.fecha_clase + 'T00:00:00'); 
				return (r.alumno_dni === u.dni || r.usuario_id === u.id) && 
					fecha.getMonth() === hoy.getMonth() &&
					fecha.getFullYear() === hoy.getFullYear();
			});

			const usadas = reservasMes.length;
			const restantes = esFull ? "∞" : Math.max(0, limite - usadas);

			const elUsadas = document.getElementById('al-dash-usadas');
			if(elUsadas) elUsadas.innerText = usadas;
			
			const elCreditos = document.getElementById('al-dash-creditos');
			if(elCreditos) {
				elCreditos.innerHTML = esFull ? 
					`<span class="text-2xl">∞</span>` : 
					`<span class="${restantes <= 2 ? 'text-red-500' : 'text-white'}">${restantes}</span>`;
			}

			// 3. RESUMEN DE RUTINA (Vinculado a openFichaTecnica)
			try {
				let resRutina = await apiFetch(`/rutinas/usuario/${u.id}`);
				// Normalizamos la respuesta por si viene un array o un objeto
				let rutina = (Array.isArray(resRutina) && resRutina.length > 0) ? resRutina[0] : (resRutina?.id ? resRutina : null);

				const summaryContainer = document.getElementById('al-dash-rutina-summary'); 
				const contentContainer = document.getElementById('al-dash-rutina-content');

				if (summaryContainer && contentContainer) {
					if (rutina && rutina.nombre_grupo) {
						summaryContainer.classList.remove('hidden');
						summaryContainer.classList.add('flex'); // Aseguramos que sea flex para el justify-between
						
						contentContainer.innerHTML = `
							<p class="text-[12px] font-black italic text-white mb-0.5 uppercase tracking-tighter">${rutina.nombre_grupo}</p>
							<p class="text-[9px] text-red-600 font-black uppercase tracking-widest">${rutina.descripcion || 'PLAN PERSONALIZADO'}</p>
						`;
						
						// Actualizamos el botón para que dispare la ficha
						const btnVer = summaryContainer.querySelector('button');
						if (btnVer) {
							btnVer.innerText = "ENTRENAR AHORA";
							btnVer.onclick = () => window.openFichaTecnica(u.id);
						}
					} else {
						summaryContainer.classList.add('hidden');
					}
				}
			} catch (err) {
				console.error("Error al cargar rutina en dashboard:", err);
			}
			
			// 4. PRÓXIMAS CLASES
			const upcoming = document.getElementById('al-dash-upcoming');
			const misR = (state.reservas || []).filter(r => 
				(r.alumno_dni === u.dni || r.usuario_id === u.id) && 
				new Date(r.fecha_clase + 'T23:59:59') >= hoy
			);
			
			// Ordenar cronológicamente
			misR.sort((a, b) => new Date(a.fecha_clase) - new Date(b.fecha_clase));

			if (upcoming) {
				upcoming.innerHTML = misR.length ? misR.map(r => {
					let fechaDisplay = "S/F";
					if (r.fecha_clase) {
						const [y, m, d] = r.fecha_clase.split('-');
						const dateObj = new Date(y, m - 1, d);
						fechaDisplay = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
					}

					return `
						<div class="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 mb-3 group hover:border-red-600/30 transition-all">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center text-red-500">
									<i data-lucide="clock" class="w-4 h-4"></i>
								</div>
								<div>
									<p class="text-[11px] font-black uppercase italic text-white leading-none mb-1">${r.clase_nombre}</p>
									<p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">${fechaDisplay} @ ${r.horario || ''} HS</p>
								</div>
							</div>
							<button onclick="cancelBooking(${r.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-white/10 hover:text-red-600 hover:bg-red-600/10 transition-all">
								<i data-lucide="trash-2" class="w-4 h-4"></i>
							</button>
						</div>
					`}).join('') : '<p class="text-gray-500 italic text-[11px] text-center py-4">No tienes reservas activas.</p>';
				
				if (window.lucide) lucide.createIcons();
			}
		}
		
		// 1. Dibuja una fila de horario (Día + Hora + Coach)
			function addNewScheduleSlot(data = { dia: 1, horario: 7, coach: "" }) {
				const container = document.getElementById('cl-schedule-slots');
				if (container.querySelector('p.italic')) container.innerHTML = "";

				const row = document.createElement('div');
				row.className = "schedule-slot-row flex flex-col gap-2 bg-white/5 p-3 rounded-2xl border border-white/5 mb-2";
				
				const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
				
				// Opciones de Días
				let diasOptions = "";
				for(let d=1; d<=6; d++) diasOptions += `<option value="${d}" ${data.dia == d ? 'selected' : ''}>${diasMap[d]}</option>`;

				// Opciones de Horas
				let horasOptions = "";
				for(let i=7; i<=21.5; i+=0.5) {
					const label = i % 1 === 0 ? `${i}:00` : `${Math.floor(i)}:30`;
					horasOptions += `<option value="${i}" ${data.horario == i ? 'selected' : ''}>${label} HS</option>`;
				}

				row.innerHTML = `
					<div class="flex items-center justify-between gap-2">
						<select class="viking-input py-1 h-9 text-[10px] flex-1 slot-dia">${diasOptions}</select>
						<select class="viking-input py-1 h-9 text-[10px] flex-1 slot-hora">${horasOptions}</select>
						<button type="button" onclick="this.closest('.schedule-slot-row').remove()" class="text-red-500 p-1">
							<i data-lucide="x" class="w-4 h-4"></i>
						</button>
					</div>
				`;
				container.appendChild(row);
				if(window.lucide) lucide.createIcons();
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
                    // CORRECCIÓN: Ahora filtramos por Clase ID, Día y Horario exacto.
                    const inscriptos = state.reservas.filter(r => 
                        String(r.clase_id) === String(claseId) &&
                        Number(r.dia_semana) === Number(dia) &&
                        Number(r.horario) === Number(horario)
                    );

                    const listaDiv = document.getElementById('inscriptos-lista');
                    
                    // Agregamos un título informativo (opcional, pero útil)
                    const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
                    const labelHora = horario % 1 === 0 ? `${horario}:00` : `${Math.floor(horario)}:30`;
                    // Si tienes un elemento para título en el modal, podrías actualizarlo aquí, si no, solo mostramos la lista.

                    listaDiv.innerHTML = inscriptos.length ? inscriptos.map(r => {
                        return `
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div>
                                <p class="text-[12px] font-black uppercase italic text-left text-white">${r.alumno_nombre || r.alumno_dni}</p>
                                <p class="text-[9px] text-gray-500 font-bold">DNI: ${r.alumno_dni}</p>
                            </div>
                            <!-- CORRECCIÓN: Pasamos dia y horario al borrar para refrescar la misma vista -->
                            <button onclick="deleteBookingAdmin(${r.id}, ${claseId}, ${dia}, ${horario})" class="text-red-600 hover:text-white transition-colors">
                                <i data-lucide="user-minus" class="w-4 h-4"></i>
                            </button>
                        </div>`;
                    }).join('') : `<p class="text-center text-gray-500 italic py-10">No hay alumnos en el turno del ${diasMap[dia]} ${labelHora}hs.</p>`;
                    
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

					cal.innerHTML = "";
					cal.className = "calendar-container min-w-[900px] h-[750px] overflow-y-auto custom-scrollbar grid grid-cols-[80px_repeat(6,1fr)] bg-white/[0.02]";
					cal.style.gridAutoRows = "40px";

					// CARGA DE DATOS (Agregamos feriados y clases especiales al estado)
					if (!state.clases || state.clases.length === 0) {
						state.clases = await apiFetch('/clases');
					}
					// Si no existen en el state, los traemos (ajustá las rutas a tus endpoints)
					if (!state.feriados) state.feriados = await apiFetch('/api/feriados') || [];
					if (!state.clasesFeriado) state.clasesFeriado = await apiFetch('/api/clases-feriado') || [];

					const isAdmin = (state.user?.rol_nombre === "Administrador" || state.user?.rol_nombre === "Supervisor" || state.user?.rol_nombre === "Profesor");
					const esAlumno = (state.user?.rol_nombre === "Alumno");

					const hoy = new Date();
					const diaSemanaActual = hoy.getDay(); 
					const diffParaLunes = diaSemanaActual === 0 ? 6 : diaSemanaActual - 1;
					
					const fechaLunesBase = new Date(hoy);
					fechaLunesBase.setDate(hoy.getDate() - diffParaLunes);
					
					const fechaLunes = new Date(fechaLunesBase);
					fechaLunes.setDate(fechaLunesBase.getDate() + (state.calendar.weekOffset * 7));

					const labelSemana = document.getElementById('label-semana-vikinga');
					if(labelSemana) {
						const fFin = new Date(fechaLunes);
						fFin.setDate(fechaLunes.getDate() + 5);
						labelSemana.innerText = `${fechaLunes.toLocaleDateString('es-ES', {day:'2-digit', month:'short'})} - ${fFin.toLocaleDateString('es-ES', {day:'2-digit', month:'short'})}`.toUpperCase();
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

					// --- 3. GRILLA (Filas de 40px) ---
					for(let h=7; h<=21.5; h+=0.5) {
						const label = h % 1 === 0 ? `${h}:00` : `${Math.floor(h)}:30`;
						const hourLabel = document.createElement('div');
						hourLabel.className = "cal-cell flex items-center justify-center font-black text-[10px] text-white/40 bg-white/5 border-r border-white/20";
						hourLabel.style.height = "40px";
						hourLabel.innerText = label;
						cal.appendChild(hourLabel);
						
						for(let d=1; d<=6; d++) {
							const isSat = d === 6; 
							const isClosed = isSat && (h < 10 || h > 13);
							const cellId = `cell-${d}-${h.toString().replace('.','_')}`;
							const cell = document.createElement('div');
							cell.id = cellId;
							cell.style.height = "40px";
							cell.className = `cal-cell relative border-b border-r border-white/5 hover:bg-white/5 transition-colors ${isClosed ? 'bg-black/40 pointer-events-none' : ''}`;
							
							if (isAdmin && !isClosed) {
								cell.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; cell.classList.add('bg-red-600/10'); };
								cell.ondragleave = () => cell.classList.remove('bg-red-600/10');
								cell.ondrop = async (e) => {
									// Mantenemos tu lógica de Drop intacta
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
										new_horario: newHorario
									});
									if (!res.error) {
										showVikingToast("¡Turno Reubicado!");
										state.clases = await apiFetch('/clases');
										renderCalendar(); 
									} else {
										showVikingToast("Error al mover: " + res.error, true);
									}
								};
							}
							cal.appendChild(cell);
						}
					}

					// --- 4. RENDERIZADO DE CLASES (INTEGRADO CON FERIADOS) ---
					// Recorremos los 6 días para ver si alguno es feriado antes de pintar
					for (let d = 1; d <= 6; d++) {
						const index = d - 1;
						const fechaSlot = new Date(fechaLunes); 
						fechaSlot.setDate(fechaLunes.getDate() + index);
						const fechaSlotStr = fechaSlot.toISOString().split('T')[0];

						// ¿ESTE DÍA ES FERIADO?
						const infoFeriado = state.feriados?.find(f => f.fecha === fechaSlotStr);

						if (infoFeriado) {
							// --- LÓGICA FERIADO: Ignora cronograma normal y busca clases especiales ---
							// Aunque el servidor mande fruta, el calendario sigue en pie
							const listaSegura = Array.isArray(state.clasesFeriado) ? state.clasesFeriado : [];
							const clasesEspecialesHoy = listaSegura.filter(cf => cf.fecha === fechaSlotStr);
							
							clasesEspecialesHoy.forEach(c => {
								const hKey = c.horario.toString().replace('.', '_');
								const cell = document.getElementById(`cell-${d}-${hKey}`);
								if (cell) {
									// PINTAR BADGE (Tu misma lógica adaptada a la clase de feriado)
									const getTextColorClass = (hexColor) => {
										if (!hexColor) return { text: 'text-white', sub: 'text-white/70', bg: 'bg-white/20' };
										const r = parseInt(hexColor.substr(1, 2), 16), g = parseInt(hexColor.substr(3, 2), 16), b = parseInt(hexColor.substr(5, 2), 16);
										const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
										return (yiq >= 128) ? { text: 'text-black', sub: 'text-black/60', bg: 'bg-black/10' } : { text: 'text-white', sub: 'text-white/80', bg: 'bg-white/20' };
									};
									const colores = getTextColorClass(c.color || '#FF0000');
									const reservasArray = Array.isArray(state.reservas) ? state.reservas : [];
									const cupoMax = c.capacidad_max || 40;
									const cupoActual = reservasArray.filter(r => String(r.clase_id) === String(c.id) && Number(r.horario) === Number(c.horario) && String(r.fecha_clase) === String(fechaSlotStr)).length;
									const estaLleno = cupoActual >= cupoMax;

									const badge = document.createElement('div');
									badge.className = "absolute top-0.5 left-0.5 right-0.5 rounded-xl flex flex-col items-center justify-center text-center overflow-hidden z-20 p-1 shadow-xl"; 
									badge.style.height = "79px";
									badge.style.backgroundColor = c.color || '#FF0000';
									badge.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full space-y-0.5">
										<span class="text-[10px] font-black uppercase italic leading-[1.1] ${colores.text}">${c.nombre}</span>
										<span class="text-[8px] font-bold uppercase opacity-90 leading-[1] ${colores.text}">ESPECIAL</span>
										<div class="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black ${colores.bg} ${estaLleno ? 'text-red-500 font-bold bg-white' : colores.text}">${cupoActual}/${cupoMax}</div>
									</div>`;
									badge.onclick = (e) => {
										e.stopPropagation();
										if (esAlumno) {
											if (estaLleno) showVikingToast("Cupo lleno", true);
											else confirmarReservaVikinga(c, d, c.horario, fechaSlotStr);
										} else { openInscriptos(c.id, d, c.horario, fechaSlotStr); }
									};
									cell.appendChild(badge);
								}
							});
							
							// Bloqueamos las celdas del feriado que no tienen clase especial
							for(let h=7; h<=21.5; h+=0.5) {
								const cell = document.getElementById(`cell-${d}-${h.toString().replace('.', '_')}`);
								if (cell && cell.innerHTML === "") {
									cell.classList.add('bg-black/60');
									cell.style.pointerEvents = 'none';
								}
							}
						} else {
							// --- LÓGICA NORMAL: El código que ya tenías funcionando ---
							if(state.clases && Array.isArray(state.clases)){
								state.clases.forEach(c => {
									if(state.calendar.currentBox !== 'Principal') {
										if(c.box_nombre !== state.calendar.currentBox) return;
									} else {
										if(c.box_nombre && c.box_nombre !== 'Principal') return;
									}

									const horarios = Array.isArray(c.horarios_detalle) ? c.horarios_detalle : [];
									
									const getTextColorClass = (hexColor) => {
										if (!hexColor) return { text: 'text-white', sub: 'text-white/70', bg: 'bg-white/20' };
										const r = parseInt(hexColor.substr(1, 2), 16);
										const g = parseInt(hexColor.substr(3, 2), 16);
										const b = parseInt(hexColor.substr(5, 2), 16);
										const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
										return (yiq >= 128) ? { text: 'text-black', sub: 'text-black/60', bg: 'bg-black/10' } : { text: 'text-white', sub: 'text-white/80', bg: 'bg-white/20' };
									};
									const colores = getTextColorClass(c.color || '#FF0000');

									horarios.forEach(slot => {
										if (slot.dia === d) {
											const hKey = slot.horario.toString().replace('.', '_');
											const cell = document.getElementById(`cell-${d}-${hKey}`);
											
											if (cell) {
												const reservasArray = Array.isArray(state.reservas) ? state.reservas : [];
												const cupoMax = c.capacidad_max || 40;
												const cupoActual = reservasArray.filter(r => 
													String(r.clase_id) === String(c.id) && 
													Number(r.dia_semana) === Number(slot.dia) && 
													Number(r.horario) === Number(slot.horario) &&
													String(r.fecha_clase) === String(fechaSlotStr)
												).length;

												const estaLleno = cupoActual >= cupoMax;
												const badge = document.createElement('div');
												badge.className = "absolute top-0.5 left-0.5 right-0.5 rounded-xl flex flex-col items-center justify-center text-center overflow-hidden z-20 p-1 shadow-xl"; 
												badge.style.height = "79px";
												badge.style.backgroundColor = c.color || '#FF0000';
												
												if (isAdmin) {
													badge.draggable = true; 
													badge.ondragstart = (e) => {
														e.dataTransfer.setData("claseId", c.id);
														e.dataTransfer.setData("oldDia", slot.dia);
														e.dataTransfer.setData("oldHorario", slot.horario);
														badge.classList.add('opacity-40');
													};
													badge.ondragend = () => badge.classList.remove('opacity-40');
												}

												badge.innerHTML = `
													<div class="flex flex-col items-center justify-center w-full h-full space-y-0.5">
														<span class="text-[10px] font-black uppercase italic leading-[1.1] ${colores.text}" style="display: block; width: 100%; white-space: normal;">${c.nombre}</span>
														<span class="text-[8px] font-bold uppercase opacity-90 leading-[1] ${colores.text}">${slot.coach || 'STAFF'}</span>
														<div class="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black ${colores.bg} ${estaLleno ? 'text-red-500 font-bold bg-white' : colores.text}">${cupoActual}/${cupoMax}</div>
													</div>`;
												
												badge.onclick = (e) => {
													e.stopPropagation();
													if (esAlumno) {
														if (estaLleno) showVikingToast("Cupo lleno", true);
														else confirmarReservaVikinga(c, slot.dia, slot.horario, fechaSlotStr);
													} else {
														openInscriptos(c.id, slot.dia, slot.horario, fechaSlotStr);
													}
												};
												cell.appendChild(badge);
											}
										}
									});
								});
							}
						}
					}

					if (window.lucide) lucide.createIcons();
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

    if (!state.cobrarTab) state.cobrarTab = 'mercaderia';
    if (window.updatePaymentButtons) window.updatePaymentButtons();

    const searchVal = document.getElementById('cobrar-search').value.toLowerCase();
    
    if (state.cobrarTab === 'mercaderia') {
        const filtered = state.stock.filter(s => 
            (s.nombre_producto || "").toLowerCase().includes(searchVal)
        );

        displayArea.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar" id="cobrar-catalogo"></div>`;
        const catalog = document.getElementById('cobrar-catalogo');
        
        catalog.innerHTML = filtered.map(s => {
			// --- CORRECCIÓN DEFINITIVA: Se utiliza 'stock_actual' de la DB ---
			const stockActual = parseInt(s.stock_actual) || 0;
			
			let stockColorClass = "text-white/40"; 
			if (stockActual <= 0) {
				stockColorClass = "text-red-500 font-black";
			} else if (stockActual < 5) {
				stockColorClass = "text-yellow-500 font-bold";
			}

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
        // --- SECCIÓN PLANES (Sin cambios, ya que funciona) ---
        const hoy = new Date().toISOString().split('T')[0];
        const filteredAl = state.alumnos.filter(a => 
            (a.nombre_completo || "").toLowerCase().includes(searchVal) || (a.dni || "").includes(searchVal)
        );

        displayArea.innerHTML = `
            <div class="glass-card p-8 rounded-[2.5rem] h-[800px] flex flex-col border border-white/5">
                <h4 class="text-[11px] font-black uppercase italic text-red-600 mb-6 tracking-widest border-b border-white/5 pb-4">
                    Guerreros para Renovación
                </h4>
                <div class="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                    ${filteredAl.map(a => {
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
                    }).join('')}
                </div>
            </div>`;
    }
    if (window.lucide) lucide.createIcons();
    if (typeof updateCartUI === 'function') updateCartUI();
}
document.getElementById('cobrar-search').oninput = renderCobrar;

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
        const response = await fetch(`${API_BASE}/cobros/procesar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();

        if (response.ok) {
            if(actualizarUI) {
                showVikingToast("¡Victoria! Cobro registrado y Stock actualizado");
                const promises = [];
                if (typeof loadStock === 'function') promises.push(loadStock());
                if (typeof loadAlumnos === 'function') promises.push(loadAlumnos());
                if (typeof loadCaja === 'function') promises.push(loadCaja());
                
                // --- AGREGAMOS EL REFRESCO DE RENTABILIDAD AQUÍ ---
                if (typeof generarInformeRentabilidad === 'function') promises.push(generarInformeRentabilidad());
                
                await Promise.all(promises);
                state.cart = [];
                updateCartUI();
                if (typeof renderCobrar === 'function') renderCobrar();
            }
            return true; 
        } else {
            showVikingToast("Error: " + (res.detail || "Error desconocido"), true);
            return false;
        }
    } catch (err) {
        console.error(err);
        showVikingToast("Error de conexión", true);
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
            state.cart = []; 
            updateCartUI();
            
            // --- REFRESCAMOS TODO INCLUYENDO RENTABILIDAD ---
            const promesas = [loadStock(), loadCaja(), fetchAlumnos()];
            if (typeof generarInformeRentabilidad === 'function') promesas.push(generarInformeRentabilidad());
            
            await Promise.all(promesas);
            renderCobrar();
        } else {
            showVikingToast(`Hubo ${errores} errores en el proceso.`, true);
        }
    }
}

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

    const step = state.routineWizard.currentStep;
    if (fill) fill.style.width = step === 1 ? '30%' : '100%';

    if (step === 1) {
        label.innerText = "PASO 1: CONFIGURACIÓN MAESTRA";
        body.innerHTML = `
            <div class="flex-1 p-10 lg:p-20 overflow-y-auto custom-scrollbar animate-in zoom-in-95">
                <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
                    <div class="col-span-full space-y-2">
                        <label class="text-[10px] font-black text-red-600 uppercase tracking-widest italic ml-2">Nombre del Plan (Ej: Volumen Vikingo)</label>
                        <input type="text" value="${state.routineWizard.nombre_grupo}" oninput="state.routineWizard.nombre_grupo = this.value" class="viking-input !h-16 text-2xl font-black italic uppercase">
                    </div>

                    <div class="col-span-full space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Objetivo o Resumen Técnico</label>
                        <textarea oninput="state.routineWizard.objetivo = this.value" class="viking-input h-32 py-5 text-sm font-medium" placeholder="Describe el enfoque del ciclo (ej: Enfoque en hipertrofia sarcoplasmática)...">${state.routineWizard.objetivo || ''}</textarea>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Metodología de Carga</label>
                        <div class="flex gap-4">
                            <button onclick="state.routineWizard.tipo = 'normal'; state.routineWizard.tipo_id = 1; window.renderWizardStep();" 
                                class="flex-1 h-14 rounded-2xl border-2 font-black text-[10px] transition-all 
                                ${state.routineWizard.tipo_id === 1 ? 'bg-red-600 text-black border-red-600 shadow-lg shadow-red-900/20' : 'bg-white/5 border-white/5 text-white/30'}">
                                ESTÁNDAR
                            </button>
                            <button onclick="state.routineWizard.tipo = 'progresiva'; state.routineWizard.tipo_id = 2; state.routineWizard.cantSemanas = state.routineWizard.cantSemanas || 4; window.updateRoutineVencimiento(); window.renderWizardStep();" 
                                class="flex-1 h-14 rounded-2xl border-2 font-black text-[10px] transition-all
                                ${state.routineWizard.tipo_id === 2 ? 'bg-amber-600 text-black border-amber-600 shadow-lg shadow-amber-900/20' : 'bg-white/5 border-white/5 text-white/30'}">
                                PROGRESIVA
                            </button>
                        </div>
                    </div>

                    <div class="space-y-2 ${state.routineWizard.tipo === 'progresiva' ? 'animate-in fade-in slide-in-from-top-2' : 'hidden'}">
                        <label class="text-[10px] font-black text-amber-500 uppercase tracking-widest italic ml-2">Duración del Ciclo (Semanas)</label>
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
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Fecha de Vencimiento (Automática)</label>
                        <input type="date" id="wizard-vencimiento" value="${state.routineWizard.vencimiento}" oninput="state.routineWizard.vencimiento = this.value" class="viking-input !h-14">
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/30 uppercase tracking-widest italic ml-2">Días por Semana</label>
                        <div class="grid grid-cols-6 gap-2">
                            ${[1,2,3,4,5,6].map(n => `
                                <button onclick="state.routineWizard.cantDias = ${n}; window.renderWizardStep();" 
                                    class="h-14 rounded-2xl border-2 font-black transition-all
                                    ${state.routineWizard.cantDias === n ? 'bg-red-600 text-black border-red-600' : 'bg-white/5 border-white/5 text-white/20 hover:border-white/20'}">
                                    ${n}
                                </button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
    } else {
        label.innerText = "PASO 2: ASIGNACIÓN DE ARSENAL";
        const numSemanas = state.routineWizard.tipo === 'progresiva' ? (state.routineWizard.cantSemanas || 4) : 1;

        body.innerHTML = `
            <div class="flex h-full w-full overflow-hidden bg-zinc-950">
                <div class="w-[320px] border-r border-white/5 flex flex-col bg-black/40 shrink-0">
                    <div class="p-6 border-b border-white/5 bg-black/20 space-y-4">
                        <label class="text-[9px] font-black text-red-600 uppercase tracking-[0.3em] block italic">Arsenal Disponible</label>
                        <input type="text" placeholder="BUSCAR EJERCICIO..." 
                            class="viking-input h-12 text-[10px] font-black italic border-white/10 focus:border-red-600" 
                            oninput="window.renderWizardLib(this.value)">
                        
                        <button onclick="window.openModalNewExercise()" class="w-full py-3 border border-dashed border-white/20 rounded-xl text-[9px] font-black uppercase text-white/40 hover:border-red-600 hover:text-red-600 transition-all flex items-center justify-center gap-2">
                            <i data-lucide="plus-circle" class="w-3 h-3"></i> Crear nuevo en Librería
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" id="wizard-lib-results">
                        </div>
                </div>

                <div class="flex-1 flex flex-col min-w-0">
                    
                    ${state.routineWizard.tipo === 'progresiva' ? `
                    <div class="px-8 py-4 bg-black/60 border-b border-white/5 flex gap-3 overflow-x-auto no-scrollbar shrink-0">
                        ${Array.from({length: numSemanas}).map((_, i) => {
                            const w = i + 1;
                            const activa = state.routineWizard.semanaActivaWizard === w;
                            return `
                            <button onclick="state.routineWizard.semanaActivaWizard = ${w}; window.renderWizardStep();" 
                                class="px-8 py-3 rounded-xl font-black italic text-[11px] transition-all whitespace-nowrap border-2
                                ${activa ? 'bg-red-600 text-black border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'bg-white/5 text-white/30 border-transparent hover:border-white/10'}">
                                SEMANA ${w}
                            </button>`;
                        }).join('')}
                    </div>` : ''}

                    <div class="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                        <div class="w-full max-w-[1200px] mx-auto space-y-8">
                            
                            ${Array.from({length: state.routineWizard.cantDias}).map((_, i) => {
                                const dayNum = i + 1;
                                const key = state.routineWizard.tipo === 'progresiva' ? `week${state.routineWizard.semanaActivaWizard}_day${dayNum}` : `day_${dayNum}`;
                                const isOpen = state.routineWizard.activeDayKey === key;
                                // Recuperamos data incluyendo el objetivo_dia
                                const data = state.routineWizard.config[key] || { label: `JORNADA ${dayNum}`, objetivo_dia: '', exercises: [] };
                                
                                return `
                                <div class="group border-2 rounded-[2.5rem] transition-all duration-500 
                                    ${isOpen ? 'border-red-600 bg-red-600/[0.03] shadow-[0_0_40px_rgba(220,38,38,0.05)]' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}">
                                    
                                    <div onclick="window.toggleWizardDay('${key}')" class="w-full flex items-center justify-between p-8 cursor-pointer">
                                        <div class="flex items-center gap-8">
                                            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black italic transition-all duration-500
                                                ${isOpen ? 'bg-red-600 text-black rotate-3' : 'bg-white/5 text-white/20 group-hover:text-white'}">
                                                ${dayNum}
                                            </div>
                                            <div>
                                                <span class="block text-[10px] font-black text-red-600/50 uppercase tracking-[0.3em] mb-1">Configuración</span>
                                                <span class="text-2xl font-black italic uppercase text-white tracking-tighter">${data.label}</span>
                                                ${data.objetivo_dia ? `<p class="text-[10px] text-red-600 font-bold uppercase italic mt-1">${data.objetivo_dia}</p>` : ''}
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-6">
                                            ${state.routineWizard.tipo === 'progresiva' && state.routineWizard.semanaActivaWizard > 1 ? `
                                                <button onclick="event.stopPropagation(); window.clonePrevWeekDay(${dayNum})" 
                                                    class="bg-amber-600/10 text-amber-500 border border-amber-600/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic hover:bg-amber-600 hover:text-black transition-all shadow-xl">
                                                    CLONAR ANTERIOR
                                                </button>` : ''}
                                            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-500 ${isOpen ? 'rotate-180 bg-red-600/20' : ''}">
                                                <i data-lucide="chevron-down" class="w-6 h-6 ${isOpen ? 'text-red-600' : 'text-white/20'}"></i>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    ${isOpen ? `
                                    <div class="p-10 border-t border-white/5 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div class="space-y-2">
                                                <label class="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Título de la Jornada</label>
                                                <input type="text" value="${data.label}" oninput="window.updateSessionData('${key}', 'label', this.value)" 
                                                    class="viking-input !bg-black/40 !h-14 !text-sm font-black uppercase italic border-white/10" placeholder="EJ: PECHO PESADO">
                                            </div>
                                            <div class="space-y-2">
                                                <label class="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Objetivo del Día (Consigna)</label>
                                                <input type="text" value="${data.objetivo_dia || ''}" oninput="window.updateSessionData('${key}', 'objetivo_dia', this.value)" 
                                                    class="viking-input !bg-black/40 !h-14 !text-sm font-medium border-white/10" placeholder="Ej: Foco en la fase excéntrica...">
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-1 gap-4">
                                            ${data.exercises.map((ex, exIdx) => window.renderExerciseItemWizard(key, ex, exIdx)).join('')}
                                            ${data.exercises.length === 0 ? `
                                                <div class="py-20 border-2 border-dashed border-white/5 rounded-[2rem] text-center">
                                                    <p class="text-white/10 font-black italic text-xs uppercase tracking-[0.4em]">Arsenal Vacío</p>
                                                </div>` : ''}
                                        </div>
                                    </div>` : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
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

window.renderExerciseItemWizard = (key, ex, idx) => `
    <div class="bg-black/60 border border-white/5 rounded-3xl p-6 shadow-xl group hover:border-red-600/30 transition-all">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <span class="w-8 h-8 rounded-xl bg-red-600 text-black text-[10px] flex items-center justify-center font-black italic">${idx + 1}</span>
                <h6 class="text-sm font-black italic uppercase text-white tracking-tighter">${ex.nombre}</h6>
            </div>
            <button onclick="window.removeExFromWizard('${key}', '${ex.uid}')" class="text-white/10 hover:text-red-600 transition-colors">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        </div>
        <div class="grid grid-cols-4 gap-4">
            ${['reps', 'weight', 'rest'].map(f => `
                <div class="space-y-1">
                    <label class="text-[8px] font-black text-white/20 uppercase ml-1">${f === 'reps' ? 'Reps' : f === 'weight' ? 'Peso' : 'Desc.'}</label>
                    <input type="text" value="${ex[f]}" oninput="window.updateExFieldWizard('${key}', '${ex.uid}', '${f}', this.value)" 
                        class="w-full bg-white/5 border border-white/5 rounded-xl text-[11px] font-black italic text-center text-red-600 h-10 outline-none focus:border-red-600 transition-all">
                </div>`).join('')}
            
            <div class="space-y-1">
                <label class="text-[8px] font-black text-white/20 uppercase ml-1">Consigna</label>
                <input type="text" value="${ex.comentario || ''}" oninput="window.updateExFieldWizard('${key}', '${ex.uid}', 'comentario', this.value)" 
                    class="w-full bg-white/5 border border-white/5 rounded-xl text-[10px] font-medium text-white/60 px-3 h-10 outline-none focus:border-red-600 transition-all" placeholder="...">
            </div>
        </div>
    </div>`;

window.renderWizardLib = (query = '') => {
    const container = document.getElementById('wizard-lib-results');
    if (!container) return;
    const filtered = (state.ejerciciosLibreria || []).filter(e => e.nombre.toLowerCase().includes(query.toLowerCase()));
    const groups = {};
    filtered.forEach(e => { 
        const g = e.grupo_muscular?.nombre || 'General'; 
        if (!groups[g]) groups[g] = []; 
        groups[g].push(e); 
    });
    
    container.innerHTML = Object.entries(groups).map(([name, exs]) => `
        <div class="animate-in fade-in slide-in-from-left-2">
            <h5 class="text-[9px] font-black text-red-600 uppercase tracking-widest mb-4 ml-2 italic border-l-2 border-red-600 pl-3">${name}</h5>
            <div class="space-y-2">
                ${exs.map(e => `
                    <button onclick="window.addExToWizard(${e.id}, '${e.nombre}')" 
                        class="w-full flex justify-between items-center p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[11px] font-black uppercase italic text-white/50 hover:bg-red-600 hover:text-black hover:border-red-600 transition-all group">
                        ${e.nombre} 
                        <i data-lucide="plus" class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all"></i>
                    </button>`).join('')}
            </div>
        </div>`).join('');
    if (window.lucide) lucide.createIcons();
};

window.toggleWizardDay = (key) => { 
    state.routineWizard.activeDayKey = (state.routineWizard.activeDayKey === key) ? null : key; 
    window.renderWizardStep(); 
};

window.addExToWizard = (id, nombre) => {
    const key = state.routineWizard.activeDayKey;
    if (!key) return showVikingToast("Selecciona una jornada primero", true);
    if (!state.routineWizard.config[key]) state.routineWizard.config[key] = { label: `JORNADA`, exercises: [] };
    state.routineWizard.config[key].exercises.push({ 
        id, 
        uid: Math.random().toString(36).substr(2, 9), 
        nombre, 
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
    const src = state.routineWizard.config[`week${curW-1}_day${dayNum}`];
    if (!src || src.exercises.length === 0) return showVikingToast("No hay arsenal en la semana anterior", true);
    
    state.routineWizard.config[`week${curW}_day${dayNum}`] = JSON.parse(JSON.stringify(src));
    state.routineWizard.config[`week${curW}_day${dayNum}`].exercises.forEach(e => e.uid = Math.random().toString(36).substr(2, 9));
    window.renderWizardStep();
    showVikingToast(`Semana ${curW-1} clonada con éxito.`);
};

window.updateSessionData = (key, f, v) => { 
    if (!state.routineWizard.config[key]) state.routineWizard.config[key] = { label: '', exercises: [] }; 
    state.routineWizard.config[key][f] = v; 
};

window.updateExFieldWizard = (key, uid, f, v) => { 
    const ex = state.routineWizard.config[key].exercises.find(e => e.uid === uid); 
    if (ex) ex[f] = v; 
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
                            series: [{
                                numero_serie: 1,
                                repeticiones: ex.reps,
                                peso: ex.weight,
                                descanso: ex.rest
                            }],
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
                        series: [{
                            numero_serie: 1,
                            repeticiones: ex.reps,
                            peso: ex.weight,
                            descanso: ex.rest
                        }],
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
				const res = await fetch(`${API_BASE}${endpoint}`, options);
				
				// 1. Manejo de sesión expirada
				if (res.status === 401) {
					localStorage.removeItem('viking_token');
					location.reload();
					return { error: "Sesión expirada" };
				}

				// 2. LEER EL CUERPO UNA SOLA VEZ
				const responseText = await res.text();
				
				// 3. Intentar parsear como JSON
				let responseData;
				try {
					responseData = JSON.parse(responseText);
				} catch (e) {
					// Si no es JSON, devolvemos el texto plano (útil para errores 500 crudos)
					responseData = { error: responseText || "Error desconocido del servidor" };
				}

				if (!res.ok) {
					return { error: responseData.detail || responseData.error || "Error en la petición" };
				}

				return responseData;
			} catch (e) { 
				console.error("Error Fetch:", e);
				return { error: "Error de conexión" }; 
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

        window.switchView = function(view) {
			console.log(`🚀 Navegando a: ${view}`);

			// 1. Ocultar todas las vistas de contenido
			document.querySelectorAll('.view-content').forEach(v => {
				v.classList.remove('active');
				v.classList.add('hidden');
				v.style.setProperty('display', 'none', 'important'); 
			});

			// 2. Ocultar layouts internos de Dashboard
			const layouts = ['admin-dashboard-layout', 'alumno-dashboard-layout', 'view-professor-dashboard'];
			layouts.forEach(id => {
				const l = document.getElementById(id);
				if (l) {
					l.classList.add('hidden');
					l.style.setProperty('display', 'none', 'important');
				}
			});

			// 3. Desactivar botones de navegación
			document.querySelectorAll('.nav-btn, .nav-item').forEach(b => b.classList.remove('active'));

			// 4. Lógica de selección de Dashboard por ROL
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

			// 5. Mostrar la vista final
			const targetView = document.getElementById(targetId);
			if (targetView) {
				targetView.classList.add('active');
				targetView.classList.remove('hidden');
				targetView.style.setProperty('display', (view === 'dashboard' ? 'block' : 'flex'), 'important'); 
			}

			// 6. Activar botón de menú
			const n = document.getElementById('nav-' + view); 
			if (n) n.classList.add('active');
			
			// 7. Cambiar título
			const titleEl = document.getElementById('view-title');
			if (titleEl) titleEl.innerText = view.replace('-', ' ').toUpperCase();

			// 8. LÓGICA DE BLOQUEO POR VENCIMIENTO
			if (typeof checkUserMembresia === 'function') checkUserMembresia(view);

			// 9. CORRECCIÓN: Carga de datos en "Mi Perfil"
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

			// 10. Cargas de datos adicionales según sección
			if (view === 'calendario' && typeof renderCalendar === 'function') {
                renderCalendar();

                // --- LÓGICA DE VISIBILIDAD PARA EL PANEL DE FERIADOS ---
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
			if (view === 'acceso-virtual' && typeof renderAccesos === 'function') renderAccesos();
			
			// INTEGRACIÓN RUTINAS
			if (view === 'rutinas') {
				renderRutinas();
			}

			if (view === 'alumnos') {
				if (typeof renderAlumnosSection === 'function') renderAlumnosSection();
			}

			// 11. Aplicar permisos de visibilidad final
			if (typeof applyPermissions === 'function') applyPermissions();
			
			if (window.lucide) lucide.createIcons();
		};

		async function handleLogin(e) {
			// 1. Detener el refresco automático del formulario
			if (e && e.preventDefault) e.preventDefault();

			const dniInput = document.getElementById('login-dni');
			const passInput = document.getElementById('login-pass');
			const errorDiv = document.getElementById('login-error');
			const loginBtn = document.getElementById('login-button');

			if (!dniInput || !passInput) return;

			// Feedback visual de carga
			if (loginBtn) {
				loginBtn.disabled = true;
				loginBtn.innerText = "VERIFICANDO...";
			}

			const data = {
				dni: dniInput.value,
				password: passInput.value
			};

			// --- BLOQUE DE USUARIO LOCAL (BYPASS) ---
			// ---if (dni === "admin" && password === "1234") {
				// ---console.log("🛡️ Acceso de emergencia local activado");
				
				// ---const mockUser = {
				// ---  id: 999,
				// ---  nombre_completo: "ADMINISTRADOR LOCAL",
				// ---  dni: "admin",
			// ---      rol_nombre: "Administrador",
			// ---      access_token: "viking-bypass-token-local"
			// ---  };

				// Guardamos en memoria para que no se cierre con F5
			// ---  localStorage.setItem('viking_token', mockUser.access_token);
			// ---  localStorage.setItem('viking_user', JSON.stringify(mockUser));
				
			// ---  state.user = mockUser;

				// Limpiamos y ocultamos el login
			// ---  document.getElementById('login-overlay').style.display = 'none';
			// ---  document.getElementById('sidebar').classList.remove('hidden');
			// ---  document.getElementById('main-content').classList.remove('hidden');
				
				// Actualizamos la UI
			// ---  if (document.getElementById('side-user-name')) document.getElementById('side-user-name').innerText = mockUser.nombre_completo;
			// ---  if (document.getElementById('side-user-role')) document.getElementById('side-user-role').innerText = mockUser.rol_nombre;
			// ---  if (document.getElementById('user-initials')) document.getElementById('user-initials').innerText = "AL";

			// ---  switchView('dashboard');
			// ---  if (window.lucide) lucide.createIcons();
				
			// ---  showVikingToast("MODO LOCAL ACTIVADO ⚔️");
			// ---  return; // Detenemos aquí para que no intente ir a Render
			// ---}
			// --- FIN DEL BLOQUE LOCAL ---

			try {
				const res = await apiFetch('/login', 'POST', data);

				if (res && !res.error) {
					// --- NUEVO: GUARDAR TOKEN JWT ---
					if (res.access_token) {
						localStorage.setItem('viking_token', res.access_token);
					}

					// --- NUEVO: GUARDAR SESIÓN PARA F5 ---
					localStorage.setItem('viking_user', JSON.stringify(res));

					// Guardamos al usuario en el estado global
					state.user = res;

					// 2. Ocultar Login y mostrar App
					document.getElementById('login-overlay').style.display = 'none';
					document.getElementById('sidebar').classList.remove('hidden');
					document.getElementById('main-content').classList.remove('hidden');

					// 3. Cargar datos del usuario en la barra lateral
					const elName = document.getElementById('side-user-name');
					if (elName) elName.innerText = res.nombre_completo || "Usuario";

					const elRole = document.getElementById('side-user-role');
					if (elRole) elRole.innerText = res.rol_nombre || 'Staff';

					// --- LÓGICA DE INICIALES ---
					const name = res.nombre_completo || "Usuario Vikingo";
					const initials = name.split(' ')
						.filter(n => n)
						.map(n => n[0])
						.join('')
						.toUpperCase()
						.substring(0, 2);

					const elInitials = document.getElementById('user-initials');
					if (elInitials) elInitials.innerText = initials;

					// 4. Cargar datos maestros (Profesores, Clases, etc.)
					await loadProfesores();

					if (typeof initApp === 'function') {
						await initApp();
					} else {
						if (typeof loadClases === 'function') loadClases();
						if (typeof loadStock === 'function') loadStock();
					}

					// 5. Cambiar a la vista principal
					switchView('dashboard');

					// --- Renderizar Dashboard específico si es Alumno ---
					if (res.rol_nombre === "Alumno" && typeof renderStudentDashboard === 'function') {
						await renderStudentDashboard();
					}
					
					// --- MEJORA: Precarga de datos si es Profesor ---
					if (res.rol_nombre === "Profesor" && typeof loadProfessorDashboard === 'function') {
						await loadProfessorDashboard();
					}

					// Refrescar iconos
					if (window.lucide) lucide.createIcons();

					showVikingToast(`¡Bienvenido, ${res.nombre_completo.split(' ')[0]}!`);

				} else {
					// Mostrar error si las credenciales fallan
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
				console.error("Error en el proceso de login:", err);
				showVikingToast("Error de conexión con el servidor", true);
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

			// 1. Seteo de HOY en formato LOCAL YYYY-MM-DD
			const timezoneOffset = new Date().getTimezoneOffset() * 60000;
			const hoyLocal = new Date(Date.now() - timezoneOffset).toISOString().split('T')[0];
			
			if (inputDesde && !inputDesde.value) inputDesde.value = hoyLocal;
			if (inputHasta && !inputHasta.value) inputHasta.value = hoyLocal;

			// 2. Traer los movimientos de la API
			const movs = await apiFetch('/caja/movimientos');
			
			let calcIngresos = 0;
			let calcGastos = 0;
			const table = document.getElementById('table-caja');

			if (!Array.isArray(movs)) return;

			// Valores de filtros de búsqueda avanzados (normalizados a minúsculas)
			const valDesc = (inputDescFiltro?.value || "").toLowerCase().trim();
			const valDetalle = (inputDetalleFiltro?.value || "").toLowerCase().trim();

			// 3. FILTRADO CORREGIDO E INTELIGENTE (Basado en Local Time + Filtros avanzados)
			const filtrados = movs.filter(m => {
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
									
				// Filtro de rango de fechas
				if (fechaMovLocal < inputDesde.value || fechaMovLocal > inputHasta.value) return false;

				// Filtro Búsqueda en Descripción (Columna 3) - Verificación robusta de nulos
				const descMov = (m.descripcion || "").toLowerCase();
				if (valDesc && !descMov.includes(valDesc)) return false;

				// Filtro Búsqueda en Detalle (Columna 4 - descripcion2) - Verificación robusta de nulos
				const detMov = (m.descripcion2 || "").toLowerCase();
				if (valDetalle && !detMov.includes(valDetalle)) return false;

				// Filtro Método de Pago (Chips múltiples)
				if (window.filtrosCaja.metodos.length > 0) {
					const metodoActual = m.metodo_pago || 'Efectivo';
					if (!window.filtrosCaja.metodos.includes(metodoActual)) return false;
				}

				return true;
			});

			// 4. Renderizado de Tabla (7 Columnas: Fecha | Tipo | Desc | Detalle | Metodo | Cuotas | Monto)
			if (table) {
				if (filtrados.length > 0) {
					// Ordenamos por fecha descendente (más nuevos primero)
					filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

					table.innerHTML = filtrados.map(m => {
						const tipoRaw = (m.tipo || '').toLowerCase();
						const monto = Math.abs(parseFloat(m.monto));
						const metodo = m.metodo_pago || 'Efectivo';
						const cuotas = parseInt(m.cuotas) || 1;
						
						// Lógica de Clasificación (Ingreso vs Egreso) para totales y colores
						const esEgresoManual = tipoRaw === 'egreso' || tipoRaw === 'gasto' || tipoRaw === 'compra' || tipoRaw === 'salida';
						const esIngresoManual = tipoRaw === 'ingreso' || tipoRaw === 'entrada';
						const esPositivo = esIngresoManual || ((tipoRaw.includes('mercaderia') || tipoRaw.includes('plan') || tipoRaw.includes('venta') || tipoRaw.includes('cobro')) && !tipoRaw.includes('compra'));
						const esEgreso = !esPositivo && (esEgresoManual || tipoRaw.includes('compra') || tipoRaw.includes('pago'));

						if (esEgreso) calcGastos += monto;
						else calcIngresos += monto;

						const flujoTexto = esEgreso ? 'EGRESO' : 'INGRESO';
						const flujoColor = esEgreso ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20';

						// --- LÓGICA DE ORGANIZACIÓN DE COLUMNAS (MANTENIDA SEGUN TU BASE) ---
						let categoriaTag = m.tipo || 'Movimiento';
						let infoPrincipal = m.descripcion || '-';
						let notaManual = m.descripcion2 || ''; // Recibimos la nueva columna de notas manuales

						// Si es un plan (Renovación o Nuevo)
						if (tipoRaw.includes('plan')) {
							categoriaTag = "Plan GymFit";
							infoPrincipal = (m.descripcion || '').replace(/Cobro Plan\s*/i, '').replace(/Renovación\s*/i, '').trim();
						} 
						// Si es venta de productos (Stock)
						else if (tipoRaw.includes('mercaderia') || tipoRaw.includes('venta')) {
							categoriaTag = "Venta Stock";
							infoPrincipal = (m.descripcion || '').replace(/Venta Insumo:\s*/i, '').trim();
						}
						// Si es compra para reponer stock
						else if (tipoRaw.includes('compra')) {
							categoriaTag = "Reposición";
							infoPrincipal = (m.descripcion || '').replace(/Compra Stock:\s*/i, '').trim();
						}
						// Si es un movimiento manual de caja
						else if (esIngresoManual) {
							categoriaTag = "Ingreso Manual";
						}
						else if (esEgresoManual) {
							categoriaTag = "Gasto Extra";
						}

						// Formateo de Fecha y Hora Local
						let fechaZ = m.fecha;
						if (!fechaZ.endsWith('Z') && !fechaZ.includes('+')) fechaZ += 'Z';
						const d = new Date(fechaZ);
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
							<!-- DESCRIPCIÓN: Muestra el Alumno, Producto o Motivo -->
							<td class="py-4 text-white text-[10px] font-black uppercase tracking-tight">
								${infoPrincipal}
							</td>
							<!-- DETALLE: Muestra la Categoría y la Nota Manual (descripcion2) -->
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

			// 5. Totales (Con restricción para Perfil Administracion)
            const calcBalance = calcIngresos - calcGastos;
            
            // Leemos el usuario de la sesión (clave 'viking_user' según tu handleLogin)
            const datosUsuario = JSON.parse(localStorage.getItem('viking_user') || '{}');
            const nombreRol = (datosUsuario.rol_nombre || "").toLowerCase().trim();
            const divTotales = document.getElementById('contenedor-totales-caja');

            if (nombreRol === "administracion") {
                // Si es el staff de recepción, ocultamos el bloque de saldos por completo
                if (divTotales) divTotales.style.setProperty('display', 'none', 'important');
            } else {
                // Si es Administrador o Supervisor, mostramos los saldos normalmente
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

		/**
		* SISTEMA DE CAJA VIKINGA - FILTROS PRO
		* Gestión de estado para filtros de columna
		*/
		window.filtrosCaja = {
			metodos: [] // Lista de métodos seleccionados para filtrar
		};

		/**
		* Función para alternar los métodos en el filtro múltiple
		*/
		window.toggleMetodoFiltro = function(metodo, btn) {
			const idx = window.filtrosCaja.metodos.indexOf(metodo);
			if (idx > -1) {
				window.filtrosCaja.metodos.splice(idx, 1);
				btn.classList.remove('active');
			} else {
				window.filtrosCaja.metodos.push(metodo);
				btn.classList.add('active');
			}
			window.loadCaja(); // Recargar con el nuevo filtro
		};

		/**
		* Resetea todos los filtros a su estado inicial
		* Se mantiene tu base original de fechas y se agrega la limpieza de buscadores/chips.
		*/
		window.resetFiltrosCaja = function() {
			const timezoneOffset = new Date().getTimezoneOffset() * 60000;
			const hoy = new Date(Date.now() - timezoneOffset).toISOString().split('T')[0];
			
			// Limpieza de Fechas (Tu base original)
			const inputDesde = document.getElementById('caja-filtro-desde');
			const inputHasta = document.getElementById('caja-filtro-hasta');
			if (inputDesde) inputDesde.value = hoy;
			if (inputHasta) inputHasta.value = hoy;
			
			// Limpieza de Buscadores de Texto
			const inputDesc = document.getElementById('caja-filtro-desc');
			const inputDetalle = document.getElementById('caja-filtro-detalle');
			if (inputDesc) inputDesc.value = "";
			if (inputDetalle) inputDetalle.value = "";
			
			// Limpieza de Filtros de Método
			window.filtrosCaja.metodos = [];
			document.querySelectorAll('.metodo-chip').forEach(btn => btn.classList.remove('active'));
			
			// Recarga (Tu base original)
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
				await Promise.all([
					apiFetch('/sucursales').then(res => state.sucursales = res),
					fetchAlumnos(), 
					loadStaff(), 
					loadPlanes(), 
					loadStock(), 
					loadClases(), 
					fetchReservas(), 
					loadDashboard(), 
					loadMusculacionMetadata(), 
					loadCaja(),
					// Agregamos .catch al final de cada una para que no traben el resto
					loadFeriados().catch(e => console.error("Error en feriados, sigo igual...")), 
					loadClasesFeriado().catch(e => console.error("Error en clases feriado, sigo igual..."))
				]);
				
				// Esto se va a ejecutar SI O SI ahora
				renderCalendar();
			} catch (error) {
				console.error("Error crítico:", error);
				// Salvavidas final:
				renderCalendar();
			}
		}

		async function loadDashboard() {
            console.log("⚔️ Sincronizando Central de Mando...");

            // 1. Cargar datos necesarios del servidor
            // Traemos Stock, Reservas e Historial de Acceso real
            // IMPORTANTE: Respetamos tus strings de apiFetch tal cual los tenías
            const [stockData, reservasData, accesoData] = await Promise.all([
                apiFetch('/stock'),
                apiFetch('/reservas'),
                apiFetch('/acceso/historial')
            ]);

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
			// 1. Obtener datos
			const [p, a] = await Promise.all([
				apiFetch('/profesores'),
				apiFetch('/administrativos')
			]);
			state.profesores = Array.isArray(p) ? p : [];
			state.administrativos = Array.isArray(a) ? a : [];

			// 2. TRANSFORMACIÓN VISUAL: PROFESORES
			const profTable = document.querySelector('#view-profesores table');
			const profListId = 'profesores-list-view';
			let profContainer = document.getElementById(profListId);

			// Si existe la tabla antigua, la reemplazamos por el contenedor de tarjetas
			if (!profContainer && profTable) {
				profContainer = document.createElement('div');
				profContainer.id = profListId;
				profContainer.className = "flex flex-col gap-3";
				if (profTable.parentNode) profTable.parentNode.replaceChild(profContainer, profTable);
			}

			if (profContainer) {
				if (state.profesores.length === 0) {
					profContainer.innerHTML = '<div class="text-center py-10"><i data-lucide="user-x" class="w-12 h-12 text-gray-600 mx-auto mb-4"></i><p class="text-gray-500 italic">No hay profesores registrados.</p></div>';
				} else {
					profContainer.innerHTML = state.profesores.map(u => createStaffRow(u, 'Profesor')).join('');
				}
			}

			// 3. TRANSFORMACIÓN VISUAL: ADMINISTRATIVOS
			const admTable = document.querySelector('#view-administrativos table');
			const admListId = 'administrativos-list-view';
			let admContainer = document.getElementById(admListId);

			if (!admContainer && admTable) {
				admContainer = document.createElement('div');
				admContainer.id = admListId;
				admContainer.className = "flex flex-col gap-3";
				if (admTable.parentNode) admTable.parentNode.replaceChild(admContainer, admTable);
			}

			if (admContainer) {
				if (state.administrativos.length === 0) {
					admContainer.innerHTML = '<div class="text-center py-10"><i data-lucide="shield-alert" class="w-12 h-12 text-gray-600 mx-auto mb-4"></i><p class="text-gray-500 italic">No hay administrativos registrados.</p></div>';
				} else {
					admContainer.innerHTML = state.administrativos.map(u => createStaffRow(u, 'Administracion')).join('');
				}
			}

			// Actualizar selectores en modales (como en crear clase)
			const coachSelect = document.getElementById('cl-coach-select');
			if (coachSelect) {
				coachSelect.innerHTML = '<option value="">Seleccionar Coach</option>' + 
					state.profesores.map(x => `<option value="${x.nombre_completo}">${x.nombre_completo}</option>`).join('');
			}

			if (window.lucide) lucide.createIcons();
			applyPermissions(); // Asegurar que solo Admin/Supervisor vea los botones de editar
		}

			// --- NUEVA FUNCIÓN AUXILIAR PARA CREAR TARJETAS DE STAFF ---
			function createStaffRow(u, type) {
				const initials = u.nombre_completo ? u.nombre_completo.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : "??";
				const roleLabel = type === 'Profesor' ? 'Coach / Especialidad' : 'Cargo / Función';
				const roleValue = u.especialidad || (type === 'Profesor' ? 'Entrenador General' : 'Administrativo');
				
				// Icono según tipo
				const icon = type === 'Profesor' ? 'dumbbell' : 'shield-check';

				return `
				<div class="glass-card p-4 rounded-3xl border-white/5 flex flex-col md:flex-row md:items-center gap-4 hover:border-red-600/20 transition-all group relative overflow-hidden">
					<!-- Barra lateral decorativa -->
					<div class="absolute left-0 top-0 bottom-0 w-1 bg-red-600 opacity-30 group-hover:opacity-100 transition-opacity"></div>
					
					<!-- Info Principal -->
					<div class="flex items-center gap-4 flex-1">
						<div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-sm italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors">
							${initials}
						</div>
						<div>
							<h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors">${u.nombre_completo}</h4>
							<div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
								<p class="text-[10px] text-white-500 font-bold flex items-center gap-1"><i data-lucide="id-card" class="w-3 h-3"></i> ${u.dni}</p>
								${u.email ? `<p class="text-[10px] text-gray-500 font-bold flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3"></i> ${u.email}</p>` : ''}
							</div>
						</div>
					</div>

					<!-- Rol / Especialidad -->
					<div class="flex flex-wrap items-center gap-6 md:justify-center border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-6">
						<div class="min-w-[150px]">
							<p class="text-[9px] text-white-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
								<i data-lucide="${icon}" class="w-3 h-3 text-red-600"></i> ${roleLabel}
							</p>
							<p class="text-[11px] font-black uppercase italic text-white truncate max-w-[200px]">${roleValue}</p>
						</div>
					</div>

					<!-- Acciones -->
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
			// 1. Pedir datos al servidor
			const data = await apiFetch('/clases'); 
			state.clases = Array.isArray(data) ? data : [];

			// 2. Localizar el contenedor en el HTML
			const container = document.getElementById('clases-container');
			if (!container) return;

			// 3. Si no hay clases, mostrar mensaje de vacío
			if (state.clases.length === 0) {
				container.innerHTML = `
					<div class="col-span-3 p-16 border border-dashed border-white/10 rounded-[3rem] text-center bg-white/2">
						<p class="text-[12px] text-gray-600 font-black uppercase italic tracking-[0.2em]">No hay clases configuradas</p>
						<p class="text-[10px] text-gray-700 mt-2 font-bold">Usa el botón "Alta de Clase" para comenzar.</p>
					</div>`;
			} else {
				// 4. Dibujar las tarjetas (Solo con info técnica y botón de editar)
				const canEdit = (state.user?.rol_nombre === "Administrador" || state.user?.rol_nombre === "Supervisor");
				
				container.innerHTML = state.clases.map(c => `
					<div class="glass-card p-6 rounded-[2.5rem] border-white/5 flex flex-col justify-between hover:border-red-600/20 transition-all group">
						<div>
							<div class="flex items-center gap-4 mb-6">
								<!-- Icono con el color de la clase -->
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

						<!-- Botón de edición: Solo aparece para Admin/Supervisor -->
						${canEdit ? `
						<button onclick="openEditClase(${c.id})" class="w-full py-4 bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase italic hover:bg-white/10 hover:text-red-600 transition-all flex items-center justify-center gap-2 border border-white/5">
							<i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
							Configuración Técnica
						</button>
						` : '<p class="text-[9px] text-gray-700 italic text-center">Solo lectura</p>'}
					</div>
				`).join('');
			}

			// 5. Refrescar iconos y otros componentes
			lucide.createIcons();
			if(document.getElementById('view-calendario')?.classList.contains('active')) renderCalendar();
			applyPermissions();
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
			const al = state.alumnos.find(x => x.id == id); 
			if(!al) return;
			
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
			document.getElementById('al-fecha-nacimiento').value = al.fecha_nacimiento || "";
			document.getElementById('al-fecha-certificado').value = al.fecha_certificado || "";
			document.getElementById('al-certificado-entregado').checked = al.certificado_entregado || false;
			
			// Control de botón eliminar
			const delBtn = document.getElementById('btn-delete-alumno'); 
			if(state.user && (state.user.rol_nombre === "Administrador" || state.user.rol_nombre === "Supervisor")) {
				delBtn.classList.remove('hidden');
			} else {
				delBtn.classList.add('hidden');
			}
			delBtn.onclick = () => deleteRecord('alumnos', id, 'modal-alumno', fetchAlumnos);
			
			loadSucursales();
			setAlumnoTab('personal'); // Resetear a la primera pestaña siempre
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

			// 5. Lógica específica para la pestaña de Suscripción/Pagos
			if (tab === 'suscripcion') {
				const alId = document.getElementById('al-id').value;
				if (!alId) return; // Si es un alumno nuevo, no hay historial que cargar

				const al = state.alumnos.find(x => x.id == alId);
				
				if (al) {
					// Buscamos el plan y el TIPO de membresía (Mensual, Trimestral, etc.)
					const planActual = state.planes.find(p => p.id == al.plan_id);
					
					// Si el plan existe y tiene la propiedad 'tipo', extraemos el nombre (Mensual, etc.)
					const nombreMembresia = (planActual && planActual.tipo) ? planActual.tipo.nombre : "MEMBRESÍA";
					
					// Actualizamos los textos en el modal
					const elTipo = document.getElementById('info-plan-tipo');
					const elNombre = document.getElementById('info-plan-nombre');
					const elVence = document.getElementById('info-plan-vence');

					if(elTipo) elTipo.innerText = nombreMembresia.toUpperCase();
					if(elNombre) elNombre.innerText = planActual ? planActual.nombre : "SIN PLAN ASIGNADO";
					if(elVence) elVence.innerText = al.fecha_vencimiento || "---";
					
					// Cargamos el historial de pagos desde la API
					loadAlumnoHistorial(alId);
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
				fetchAlumnos(); 
				
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
				
				const data = { 
					nombre: document.getElementById('plan-nombre').value, 
					efectivo: parseFloat(document.getElementById('plan-efectivo').value || 0), 
					transferencia: parseFloat(document.getElementById('plan-transferencia').value || 0), 
					debito_credito: parseFloat(document.getElementById('plan-debito').value || 0), 
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

			// PRIORIDAD 1: El valor numérico que definiste en el modal (Viene de la DB)
			let limiteMensual = parseInt(usuario.plan.clases_mensuales) || 0;
			const planNombre = (usuario.plan.nombre || "").toLowerCase();
			let esFull = false;

			// PRIORIDAD 2: Respaldo por nombre (Si el número en DB es 0)
			if (limiteMensual === 0) {
				if (planNombre.includes('libre') || planNombre.includes('full') || planNombre.includes('ilimitado')) {
					limiteMensual = 999;
				} else if (planNombre.includes('12')) limiteMensual = 12;
				else if (planNombre.includes('8')) limiteMensual = 8;
				else if (planNombre.includes('6')) limiteMensual = 6;
			}

			// Lógica de Pase Libre: si es 999 o dice libre, no descuenta cupos
			if (limiteMensual >= 99 || planNombre.includes('libre')) esFull = true;

			const ahora = new Date();
			const mesActual = ahora.getMonth();
			const anioActual = ahora.getFullYear();

			const reservasDelMes = todasLasReservas.filter(res => {
				const esMismoUsuario = String(res.usuario_id) === String(usuario.id) || (res.alumno_dni && String(res.alumno_dni) === String(usuario.dni));
				if (!esMismoUsuario) return false;
				const fechaRes = new Date(res.fecha_clase || res.fecha);
				return fechaRes.getMonth() === mesActual && fechaRes.getFullYear() === anioActual;
			});

			const usado = reservasDelMes.length;
			const fechaVence = new Date(usuario.fecha_vencimiento);
			const hoy = new Date();
			hoy.setHours(0,0,0,0);
			const estaVencido = fechaVence < hoy;

			return {
				disponible: esFull ? "∞" : Math.max(0, limiteMensual - usado),
				total: esFull ? "LIBRE" : limiteMensual,
				usado: usado,
				esFull: esFull,
				vencido: estaVencido,
				limiteAlcanzado: !esFull && usado >= limiteMensual
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

		// VISTA DE RENTABILIDAD
		async function generarInformeRentabilidad() {
			// 1. Traemos la info fresca de la DB
			const resStock = await apiFetch('/stock', 'GET');
			const resCaja = await apiFetch('/caja/movimientos', 'GET'); // O filtrar por fecha desde el backend

			if(resStock.error || resCaja.error) return showVikingToast("Error al cargar datos", true);

			const stock = resStock;
			const movimientos = resCaja;
			const body = document.getElementById('tabla-rentabilidad-body');
			body.innerHTML = '';

			let totalesGeneral = { inversion: 0, recaudacion: 0 };

			stock.forEach(producto => {
				// Filtramos movimientos de caja vinculados a ESTE producto por ID
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
			document.getElementById('renta-utilidad').className = `text-2xl font-bold ${totalUtilidad >= 0 ? 'text-white' : 'text-red-500'}`;
		}

        /**
		 * LÓGICA DE CLASES Y DISCIPLINAS
		 */

		// --- CARGAR LISTA DE BOXES ---
		async function loadBoxes() {
			const select = document.getElementById('cl-box');
			if (!select) return;
			const boxes = await apiFetch('/tipo_box');
			if (!boxes.error && Array.isArray(boxes)) {
				select.innerHTML = boxes.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('');
			} else {
				select.innerHTML = '<option value="1">Principal</option><option value="2">Calistenia</option><option value="3">Musculación</option>';
			}
		}

		function openModalClase() { 
			document.getElementById('form-clase').reset(); 
			document.getElementById('cl-id').value = ""; 
			document.getElementById('cl-schedule-slots').innerHTML = '<p class="text-[9px] text-gray-600 italic py-4 text-center">No hay horarios definidos</p>';
			document.getElementById('modal-clase-title').innerText = "Alta de Clase";
			document.getElementById('btn-delete-clase').classList.add('hidden'); 
			
			loadBoxes(); 
			openModal('modal-clase'); 
		}
		
		function addNewScheduleSlot(data = { dia: 1, horario: 7, coach: "" }) {
			const container = document.getElementById('cl-schedule-slots');
			if (!container) return;

			if (container.querySelector('p.italic')) container.innerHTML = "";

			const row = document.createElement('div');
			row.className = "schedule-slot-row flex flex-col gap-2 bg-white/5 p-3 rounded-xl border border-white/5 mb-3 group hover:border-red-600/30 transition-all";
			
			const diasMap = {1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado'};
			
			let diasOptions = "";
			for(let d=1; d<=6; d++) {
				diasOptions += `<option value="${d}" ${data.dia == d ? 'selected' : ''}>${diasMap[d]}</option>`;
			}

			let horasOptions = "";
			for(let i=7; i<=21.5; i+=0.5) {
				const label = i % 1 === 0 ? `${i}:00` : `${Math.floor(i)}:30`;
				horasOptions += `<option value="${i}" ${data.horario == i ? 'selected' : ''}>${label} HS</option>`;
			}

			let coachOptions = `<option value="">Asignar Profesor...</option>`;
			if (state.profesores && state.profesores.length > 0) {
				coachOptions += state.profesores.map(p => 
					`<option value="${p.nombre_completo}" ${data.coach === p.nombre_completo ? 'selected' : ''}>${p.nombre_completo}</option>`
				).join('');
			} else {
				coachOptions += `<option value="Staff">Staff General</option>`;
			}

			row.innerHTML = `
				<div class="flex items-center justify-between">
					<span class="text-[9px] font-black text-red-600 uppercase italic tracking-widest">Turno</span>
					<button type="button" onclick="this.closest('.schedule-slot-row').remove()" class="text-gray-500 hover:text-red-500 transition-all">
						<i data-lucide="x" class="w-4 h-4"></i>
					</button>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<select class="viking-input py-1 h-9 text-[10px] slot-dia bg-black/40 border-white/10">${diasOptions}</select>
					<select class="viking-input py-1 h-9 text-[10px] slot-hora bg-black/40 border-white/10">${horasOptions}</select>
				</div>
				<div class="w-full">
					<select class="viking-input py-1 h-9 text-[10px] w-full slot-coach bg-black/40 border-white/10 text-gray-300">
						${coachOptions}
					</select>
				</div>
			`;
			container.appendChild(row);
			if(window.lucide) lucide.createIcons();
		}

		async function openEditClase(id) {
			const c = state.clases.find(x => x.id == id); 
			if(!c) return;

			await loadBoxes(); 

			document.getElementById('cl-id').value = c.id; 
			document.getElementById('modal-clase-title').innerText = "Editar: " + c.nombre;
			document.getElementById('cl-nombre').value = c.nombre; 
			document.getElementById('cl-box').value = c.box_id || 1; 
			document.getElementById('cl-cupo').value = c.capacidad_max;
			document.getElementById('cl-color').value = c.color || "#FF0000";
			
			const slotsContainer = document.getElementById('cl-schedule-slots');
			slotsContainer.innerHTML = "";

			const horarios = Array.isArray(c.horarios_detalle) ? c.horarios_detalle : [];
			if (horarios.length > 0) {
				horarios.forEach(h => addNewScheduleSlot(h));
			} else {
				addNewScheduleSlot({ dia: 1, horario: 7, coach: c.coach || "" });
			}

			const isAdmin = (state.user?.rol_nombre === "Administrador" || state.user?.rol_nombre === "Supervisor");
			const delBtn = document.getElementById('btn-delete-clase'); 
			if(delBtn) {
				delBtn.classList.toggle('hidden', !isAdmin);
				delBtn.onclick = () => deleteRecord('clases', c.id, 'modal-clase', loadClases);
			}

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
				return showVikingToast("Añade al menos un horario", true);
			}

			const mainCoach = horarios_detalle[0].coach || "Staff";

			const payload = {
				nombre: document.getElementById('cl-nombre').value,
				box_id: parseInt(document.getElementById('cl-box').value),
				coach: String(mainCoach),
				color: document.getElementById('cl-color').value,
				capacidad_max: parseInt(document.getElementById('cl-cupo').value) || 20,
				horarios_detalle: horarios_detalle
			};

			const method = id ? 'PUT' : 'POST';
			const endpoint = id ? `/clases/${id}` : '/clases';
			
			try {
				const res = await apiFetch(endpoint, method, payload);
				if(!res.error) {
					showVikingToast(id ? "¡Clase Actualizada!" : "¡Clase Creada!");
					closeModal('modal-clase');
					if (typeof loadClases === 'function') loadClases();
				} else {
					showVikingToast("Error: " + JSON.stringify(res.detail || res.error), true);
				}
			} catch (err) {
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
				const sucursales = await response.json();
				
				// --- 1. Renderizar Tarjetas en la vista de Sucursales ---
				const container = document.getElementById('sucursales-container');
				if (container) {
					if (sucursales.length === 0) {
						container.innerHTML = `
							<div class="col-span-full py-20 text-center opacity-30 italic font-black uppercase">
								<i data-lucide="map-pin-off" class="w-12 h-12 mx-auto mb-4"></i>
								<p class="font-black uppercase italic">No hay sedes registradas en el arsenal</p>
							</div>`;
					} else {
						container.innerHTML = sucursales.map(s => `
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
							</div>
						`).join('');
					}
				}

				// --- 2. Actualizar el Selector (Select) en el modal de alumnos ---
				const selectAl = document.getElementById('al-sucursal');
				if (selectAl) {
					const currentVal = selectAl.value;
					selectAl.innerHTML = '<option value="">Seleccionar Sucursal...</option>' + 
						sucursales.map(s => `<option value="${s.id}">${s.sucursal.toUpperCase()}</option>`).join('');
					if(currentVal) selectAl.value = currentVal;
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

		// 1. Abrir Escáner y Encender Cámara
		async function startScanner() {
			const modal = document.getElementById('modal-scanner-live');
			const video = document.getElementById('scanner-video');
			const hud = document.getElementById('scanner-hud');
			
			// Limpiamos cualquier rastro de la lectura anterior en la UI
			hideFeedback();
			
			// Mostramos el modal
			if (modal) {
				modal.classList.remove('hidden');
				modal.classList.add('flex');
			}
			if (hud) hud.classList.remove('hidden');

			// VALIDACIÓN CRÍTICA: HTTPS (Obligatorio para cámaras en la mayoría de tablets)
			if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
				showCameraError("ERROR DE SEGURIDAD: La cámara requiere una conexión segura HTTPS. Verifica la URL.");
				return;
			}

			// Definimos una lista de intentos (Constraints) desde lo más ideal a lo más básico
			const attempts = [
				// Intento 1: Cámara frontal con resolución flexible
				{ 
					video: { 
						facingMode: "user", 
						width: { min: 320, ideal: 1280 }, 
						height: { min: 240, ideal: 720 },
						aspectRatio: { ideal: 1.7777777778 }
					} 
				},
				// Intento 2: Cámara frontal sin restricciones de resolución (para tablets viejas)
				{ 
					video: { facingMode: "user" } 
				},
				// Intento 3: Cualquier cámara disponible (último recurso)
				{ 
					video: true 
				}
			];

			let lastError = null;

			// Bucle de compatibilidad: Probamos cada configuración hasta que una funcione
			for (const config of attempts) {
				try {
					console.log("Intentando acceso con configuración:", config);
					videoStream = await navigator.mediaDevices.getUserMedia(config);
					if (videoStream) break; // Si tuvimos éxito, salimos del bucle
				} catch (err) {
					lastError = err;
					console.warn("Fallo un intento de cámara:", err.name);
					// Continuamos al siguiente intento...
				}
			}
			
			if (videoStream && video) {
				video.srcObject = videoStream;
				video.onloadedmetadata = () => {
					video.play();
					isScanning = true;
					lastScannedDNI = null; 
					console.log("🛡️ Ojo de Odín Activo: Buscando QR...");
					requestAnimationFrame(scanLoop); 
				};
			} else {
				console.error("No se pudo inicializar ninguna cámara después de varios intentos:", lastError);
				showCameraError("No hay acceso a la cámara. Asegúrate de usar Chrome y tener habilitados los permisos en la tablet.");
			}
		}

		/**
		 * 2. BUCLE DE DETECCIÓN (Detección Real Automática)
		 * Esta función corre analizando el video frame por frame.
		 */
		function scanLoop() {
			if (!isScanning) return; 

			const video = document.getElementById('scanner-video');
			let canvasElement = document.getElementById('scanner-canvas');
			
			// Si no existe el canvas auxiliar, lo creamos dinámicamente
			if (!canvasElement) {
				canvasElement = document.createElement('canvas');
				canvasElement.id = 'scanner-canvas';
				canvasElement.className = 'hidden';
				document.body.appendChild(canvasElement);
			}

			const canvas = canvasElement.getContext("2d", { willReadFrequently: true });

			if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
				canvasElement.height = video.videoHeight;
				canvasElement.width = video.videoWidth;
				
				// Procesamos la imagen del video
				canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
				const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
				
				// Intentamos detectar el QR con la librería jsQR
				const code = (typeof jsQR !== 'undefined') 
					? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" }) 
					: null;

				// Si encontró un código y no estamos esperando (cooldown)
				if (code && code.data && !scanCooldown) {
					if (code.data !== lastScannedDNI) {
						console.log("🎯 QR Detectado:", code.data);
						lastScannedDNI = code.data;
						processAccess(code.data);
						return; // Pausamos el bucle hasta procesar
					}
				}
			}

			requestAnimationFrame(scanLoop);
		}

		/**
		 * 3. PROCESAR ACCESO (Comunicación con Backend)
		 */
		async function processAccess(qrData) {
			scanCooldown = true; 
			
			const nameDisplay = document.getElementById('scanner-user-name');
			if (nameDisplay) nameDisplay.innerText = "VERIFICANDO...";

			try {
				// Consultamos al servidor. 
				const response = await apiFetch('/acceso/validar', 'POST', { qr_data: qrData });
				
				if (response.error) {
					showFeedback({ 
						status: "DENIED", 
						message: response.error, 
						nombre: "SISTEMA" 
					});
				} else {
					showFeedback(response);
					
					// --- NUEVO: Refrescar datos globales ---
					// Llamamos a loadDashboard para que los paneles de "Accesos Recientes" se actualicen
					if (typeof loadDashboard === 'function') {
						console.log("🔄 Actualizando paneles del Dashboard...");
						loadDashboard(); 
					}
					
					// Si el usuario está en la vista de Acceso Virtual, refrescamos esa lista también
					if (typeof renderAccesos === 'function') {
						renderAccesos();
					}
				}

			} catch (e) {
				console.error("Error en la validación:", e);
				showFeedback({ 
					status: "DENIED", 
					message: "Error de red/servidor", 
					nombre: "SISTEMA" 
				});
			}

			// Esperamos 4 segundos para el feedback visual
			setTimeout(() => {
				if (isScanning) {
					hideFeedback();
					scanCooldown = false;
					lastScannedDNI = null; 
					requestAnimationFrame(scanLoop);
				}
			}, 4000);
		}

		/**
		 * 4. SIMULACIÓN (Para los botones del modal)
		 */
		async function simulateScan(type) {
			if (scanCooldown) return;
			
			let dniToTest = "00000000";
			
			if (type === 'ok') {
				// Buscar un alumno activo en el estado local para simular
				const hoy = new Date().toISOString().split('T')[0];
				const alumno = state.alumnos.find(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy);
				if (alumno) {
					dniToTest = alumno.dni;
				} else {
					showVikingToast("No hay alumnos activos para simular", true);
					return;
				}
			} else {
				dniToTest = "99999999"; // DNI que no existe o vencido
			}

			// Generar el hash para evitar el error de "formato no válido" si el backend lo requiere
			const hash = await generateVikingHash(dniToTest);
			const fullData = `${dniToTest}:${hash}`;
			
			processAccess(fullData);
		}

		/**
		 * UI: MOSTRAR RESULTADO BASADO EN EL COLOR DEL SERVIDOR
		 * Ahora con soporte para Verde (OK), Amarillo (Vence), Azul (Staff) y Rojo (Error).
		 */
		function showFeedback(data) {
			const overlay = document.getElementById('scanner-feedback-overlay');
			const icon = document.getElementById('scanner-icon-container');
			const status = document.getElementById('scanner-status-text');
			const name = document.getElementById('scanner-user-name');
			const msg = document.getElementById('scanner-msg');

			if (!overlay) return;

			// Reset total de estilos antes de pintar el nuevo estado
			overlay.classList.remove('hidden');
			overlay.classList.add('flex');
			overlay.style.boxShadow = "none";
			overlay.style.border = "none";
			overlay.style.backgroundColor = "rgba(0,0,0,0.95)";

			name.innerText = data.nombre || "DESCONOCIDO";
			msg.innerText = data.message || "";

			// Obtenemos el color que manda el Jefe (Backend)
			const colorServidor = data.color || "red";

			if (colorServidor === 'green') {
				// --- ESTADO VERDE: ALUMNO AL DÍA ---
				status.innerText = "ACCESO PERMITIDO";
				status.className = "text-5xl font-black uppercase italic text-green-500 mb-2 tracking-wide text-center drop-shadow-[0_0_10px_#22c55e]";
				overlay.style.boxShadow = "inset 0 0 150px rgba(34, 197, 94, 0.4)";
				overlay.style.border = "8px solid #22c55e";
				icon.innerHTML = `<div class="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_60px_#22c55e] animate-bounce"><i data-lucide="check" class="w-16 h-16 text-black"></i></div>`;
				playVikingSound('success');

			} else if (colorServidor === 'yellow') {
				// --- ESTADO AMARILLO: PRÓXIMO A VENCER ---
				status.innerText = "¡ATENCIÓN: VENCE PRONTO!";
				status.className = "text-4xl font-black uppercase italic text-yellow-500 mb-2 tracking-wide text-center drop-shadow-[0_0_15px_#eab308]";
				overlay.style.boxShadow = "inset 0 0 150px rgba(234, 179, 8, 0.5)";
				overlay.style.border = "8px solid #eab308";
				icon.innerHTML = `<div class="w-32 h-32 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_60px_#eab308]"><i data-lucide="alert-triangle" class="w-16 h-16 text-black"></i></div>`;
				playVikingSound('warning');

			} else if (colorServidor === 'blue') {
				// --- ESTADO AZUL: STAFF (Administrativo, Profes, etc) ---
				status.innerText = "ACCESO STAFF";
				status.className = "text-5xl font-black uppercase italic text-blue-500 mb-2 tracking-wide text-center drop-shadow-[0_0_15px_#3b82f6]";
				overlay.style.boxShadow = "inset 0 0 150px rgba(59, 130, 246, 0.4)";
				overlay.style.border = "8px solid #3b82f6";
				icon.innerHTML = `<div class="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_60px_#3b82f6]"><i data-lucide="shield-check" class="w-16 h-16 text-white"></i></div>`;
				playVikingSound('success'); // El sonido de staff es el de éxito

			} else {
				// --- ESTADO ROJO: DENEGADO / ERROR ---
				status.innerText = "ACCESO DENEGADO";
				status.className = "text-5xl font-black uppercase italic text-red-600 mb-2 tracking-wide text-center drop-shadow-[0_0_10px_#dc2626]";
				overlay.style.boxShadow = "inset 0 0 150px rgba(220, 38, 38, 0.4)";
				overlay.style.border = "8px solid #dc2626";
				icon.innerHTML = `<div class="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_60px_#dc2626] animate-shake"><i data-lucide="x" class="w-16 h-16 text-white"></i></div>`;
				playVikingSound('error');
			}

			if (window.lucide) lucide.createIcons();
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

			// 🛡️ SEGURIDAD: Si no hay token, no intentamos pedir datos
			if (!localStorage.getItem('gymfit_token') && !state.token) {
				console.warn("⚠️ Intento de sincronización sin sesión activa. Abortando.");
				return; 
			}

            console.log("🔄 Sincronizando historial...");
            try {
                const res = await apiFetch('/acceso/historial'); 
                
                if (!res.error && Array.isArray(res)) {
                    state.accesos = res.map(acc => {
                        let fechaMostrar = acc.fecha;

                        try {
                            /**
                             * AJUSTE DE SEGURIDAD:
                             * Si el servidor (main.py) ya resta las 3 horas, aquí debe ser 0.
                             * Si ponemos -3 aquí también, se atrasa 6 horas en total.
                             */
                            const manualOffset = 0; 
                            
                            // Intentamos convertir el string del servidor a un objeto Date
                            // Reemplazamos el guion por barra para mejor compatibilidad en navegadores
                            let dateObj = new Date(acc.fecha.replace(/-/g, '/'));

                            // Si la fecha es inválida (formato custom), procesamos el string manualmente
                            if (isNaN(dateObj.getTime())) {
                                if (acc.fecha && acc.fecha.includes(' - ')) {
                                    let [horaCompleta, fechaCompleta] = acc.fecha.split(' - ');
                                    let [hh, mm] = horaCompleta.split(':');
                                    
                                    // Calculamos la nueva hora asegurando que sea positiva (0-23)
                                    let nuevaHH = (parseInt(hh) + manualOffset + 24) % 24;
                                    fechaMostrar = `${String(nuevaHH).padStart(2, '0')}:${mm} - ${fechaCompleta}`;
                                }
                            } else {
                                // Si es una fecha válida, restamos las horas directamente al objeto Date
                                dateObj.setHours(dateObj.getHours() + manualOffset);
                                
                                const h = String(dateObj.getHours()).padStart(2, '0');
                                const m = String(dateObj.getMinutes()).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const year = String(dateObj.getFullYear()).substring(2);
                                
                                fechaMostrar = `${h}:${m} - ${day}/${month}/${year}`;
                            }
                        } catch (e) {
                            console.warn("Error crítico procesando fecha, usando original:", e);
                            fechaMostrar = acc.fecha; // Fallback al original
                        }

                        return {
                            ...acc,
                            fecha_local: fechaMostrar
                        };
                    });
                    
                    // Gatillo de renderizado
                    if (typeof renderAccesos === 'function') {
                        renderAccesos();
                    }
                }
            } catch (error) {
                console.error("Error en sincronización automática:", error);
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
					if(window.lucide) lucide.createIcons();
					return;
				}

				container.innerHTML = state.accesos.map(acc => {
					const isAuth = acc.estado === 'AUTHORIZED' || acc.estado === 'AUTORIZADO';
					const statusColor = isAuth ? 'text-green-500' : 'text-red-500';
					const bgColor = isAuth ? 'bg-green-500/10' : 'bg-red-500/10';
					const borderColor = isAuth ? 'border-green-500/20' : 'border-red-500/20';

					return `
						<div class="grid grid-cols-5 gap-4 px-6 py-4 ${bgColor} border ${borderColor} rounded-2xl items-center transition-all hover:scale-[1.01]">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black italic border border-white/10">
									${acc.nombre ? acc.nombre.substring(0,2).toUpperCase() : '??'}
								</div>
								<span class="text-[11px] font-black uppercase italic text-white truncate">${acc.nombre}</span>
							</div>

							<span class="text-[10px] font-bold text-white-400">${acc.dni}</span>

							<div class="flex flex-col">
								<!-- Se muestra el texto directo del servidor -->
								<span class="text-[10px] font-black text-white/80">${acc.fecha_local}</span>
							</div>

							<div class="flex items-center gap-2">
								<i data-lucide="${acc.metodo && acc.metodo.includes('QR') ? 'qr-code' : 'hard-drive'}" class="w-3 h-3 text-red-600"></i>
								<span class="text-[9px] font-bold text-white-500 uppercase">${acc.metodo || 'S/D'}</span>
							</div>

							<div class="text-right">
								<span class="px-3 py-1 rounded-full ${statusColor} text-[9px] font-black bg-black/40 border border-current uppercase italic">
									${isAuth ? 'Permitido' : 'Denegado'}
								</span>
							</div>
						</div>
					`;
				}).join('');

				if(window.lucide) lucide.createIcons();
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
			function registerAccessLog(nombre, dni, metodo, estado) {
				const nuevoAcceso = {
					nombre: nombre,
					dni: dni,
					fecha: new Date().toLocaleTimeString(),
					metodo: metodo,
					estado: estado
				};

				if (!state.accesos) state.accesos = [];
				
				// Lo agregamos al principio del array
				state.accesos.unshift(nuevoAcceso);
				
				// Mantenemos solo los últimos 50 para no matar el navegador
				if (state.accesos.length > 50) state.accesos.pop();

				// Si estamos viendo la pantalla de accesos, refrescamos la lista
				const currentView = document.querySelector('.view-content.active')?.id;
				if (currentView === 'view-acceso-virtual') {
					renderAccesos();
				}
			}

			/**
			 * 4. ACTUALIZACIÓN DE SWITCHVIEW
			 * Asegúrate de que al cambiar a esta vista, traiga los datos.
			 */

			if (typeof window.switchView === 'function' && !window.switchView.isVikingo) {
				window.originalSwitchView = window.switchView;
			}

			const originalSwitchView = window.switchView;

			window.switchView = function(view) {
				console.log(`🚀 Navegando a: ${view}`);

				// 2. Ejecutamos primero la función original de navegación
				if (typeof originalSwitchView === 'function') {
					originalSwitchView(view);
				} else {
					console.warn("⚠️ originalSwitchView no definida. Solo se ejecutará lógica de carga.");
					// Fallback para ocultar/mostrar vistas si no existe la original
					document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
					const target = document.getElementById(`view-${view}`);
					if(target) target.classList.remove('hidden');
				}
				
				// 3. Lógica específica por vista (Carga de datos)
				switch (view) {
					case 'dashboard':
						if (typeof loadDashboard === 'function') {
							loadDashboard();
						}
						break;

					case 'acceso-virtual':
						if (typeof fetchAccesos === 'function') {
							fetchAccesos();
						} else if (typeof renderAccesos === 'function') {
							renderAccesos();
						}
						break;

					case 'alumnos':
						// Aseguramos que la lista esté fresca y cargamos sucursales para el select del modal
						if (typeof fetchAlumnos === 'function') {
							fetchAlumnos();
						}
						if (typeof loadSucursales === 'function') {
							loadSucursales();
						}
						break;

					case 'sucursales':
						// NUEVO: Cargamos la vista de sedes vikingas
						if (typeof loadSucursales === 'function') {
							loadSucursales();
						}
						break;

					case 'merca':
						if (typeof fetchStock === 'function') {
							fetchStock();
						}
						break;

					default:
						break;
				}

				// 4. Refrescar iconos globales de Lucide si están presentes
				if (window.lucide) {
					setTimeout(() => lucide.createIcons(), 50);
				}
			};
			window.switchView.isVikingo = true;

			console.log("✅ Sistema de navegación extendido correctamente.");
			
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
			try {
				// QUITAMOS el /api porque apiFetch ya lo pone
				const data = await apiFetch('/feriados'); 
				state.feriados = data || [];
			} catch (e) {
				console.error("Error cargando feriados:", e);
				state.feriados = [];
			}
		}

		async function loadClasesFeriado() {
			try {
				// QUITAMOS el /api aquí también
				const data = await apiFetch('/clases-feriado'); 
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

			if (!fechaEl || !motivoEl) return;

			const fecha = fechaEl.value;
			const motivo = motivoEl.value;

			if (!fecha || !motivo) {
				if (typeof showVikingToast === 'function') showVikingToast("Completá fecha y motivo, fiera", true);
				else alert("Completá fecha y motivo");
				return;
			}

			try {
				// Usamos la ruta sin el /api/ duplicado
				const res = await apiFetch('/feriados', 'POST', {
					fecha: fecha,
					motivo: motivo,
					abierto: false
				});

				if (!res.error) {
					if (typeof showVikingToast === 'function') showVikingToast("¡Día especial marcado!");
					
					fechaEl.value = "";
					motivoEl.value = "";
					
					// Recargamos los datos del estado
					await loadFeriados();
					// Refrescamos el calendario
					renderCalendar();
				} else {
					alert("Error: " + res.error);
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

			if (!fecha || !nombre || !horario) {
				showVikingToast("Falta fecha, nombre u horario", true);
				return;
			}

			const res = await apiFetch('/clases-feriado', 'POST', {
				fecha: fecha,
				nombre: nombre,
				horario: parseFloat(horario),
				capacidad_max: parseInt(cupo),
				color: "#FF0000" // O el color que prefieras
			});

			if (!res.error) {
				showVikingToast("¡Clase especial cargada!");
				document.getElementById('clase-feriado-nombre').value = "";
				document.getElementById('clase-feriado-hora').value = "";
				
				// Recargamos y dibujamos
				await loadClasesFeriado();
				renderCalendar();
			} else {
				showVikingToast("Error: " + res.error, true);
			}
		}
		window.crearClaseFeriadoVikinga = crearClaseFeriadoVikinga;

		// 1. FUNCIÓN PARA LLENAR LOS SELECTS (Llamala al abrir el panel)
		function popularSelectsFeriado(fila) {
			const selectNombre = fila.querySelector('.clase-feriado-nombre');
			const selectHora = fila.querySelector('.clase-feriado-hora');
			const selectProf = fila.querySelector('.clase-feriado-profesor');

			if (!selectNombre || !selectHora || !selectProf) return;

			// 1. Llenar Actividades (Filtramos nombres únicos de state.clases)
			if (state.clases && state.clases.length > 0) {
				const actividades = [...new Set(state.clases.map(c => c.nombre))];
				selectNombre.innerHTML = actividades.map(a => `<option value="${a}">${a}</option>`).join('');
			} else {
				selectNombre.innerHTML = '<option value="">Sin clases cargadas</option>';
			}

			// 2. Llenar Horarios (Este ya te funcionaba, lo mantenemos)
			let opcionesHora = "";
			for(let h=7; h<=21.5; h+=0.5) {
				const label = h % 1 === 0 ? `${h}:00` : `${Math.floor(h)}:30`;
				opcionesHora += `<option value="${h}">${label}</option>`;
			}
			selectHora.innerHTML = opcionesHora;

			// 3. Llenar Profesores (Combinamos profesores y administrativos si hace falta)
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
			
			// Agregamos la fila al DOM
			contenedor.appendChild(nuevaFila);
			
			// La poblamos específicamente para que traiga los selects llenos
			popularSelectsFeriado(nuevaFila);
			
			if (window.lucide) lucide.createIcons();
		};
		// 3. GUARDADO MASIVO (Manda todas las filas al servidor)
		window.guardarClasesFeriadoBulk = async function() {
			const fecha = document.getElementById('feriado-fecha').value;
			if (!fecha) return showVikingToast("Primero elegí la fecha", true);

			const filas = document.querySelectorAll('.fila-clase-feriado');
			let errores = 0;

			for (let fila of filas) {
				const payload = {
					fecha: fecha,
					nombre: fila.querySelector('.clase-feriado-nombre').value,
					horario: parseFloat(fila.querySelector('.clase-feriado-hora').value),
					profesor: fila.querySelector('.clase-feriado-profesor').value, // Asegurate de tener este campo en el modelo
					capacidad_max: 40,
					color: "#FF0000"
				};

				const res = await apiFetch('/clases-feriado', 'POST', payload);
				if (res.error) errores++;
			}

			if (errores === 0) {
				showVikingToast("¡Todas las clases cargadas!");
				await loadClasesFeriado();
				renderCalendar();
			} else {
				showVikingToast(`Se cargaron algunas, pero hubo ${errores} errores`, true);
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
                if(!contenedor) return;

                // Guardamos la lista actual para que la paginación sepa sobre qué trabajar
                state.filteredAlumnos = listaDatos;

                // --- ACTUALIZACIÓN DE ESTADÍSTICAS VIKINGAS ---
                const hoy = new Date().toISOString().split('T')[0];
                const listaSegura = state.alumnos || [];
				const total = listaSegura.length;
				const activos = listaSegura.filter(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy).length;
                const vencidos = total - activos;

                if (document.getElementById('stats-total')) document.getElementById('stats-total').innerText = total;
                if (document.getElementById('stats-activos')) document.getElementById('stats-activos').innerText = activos;
                if (document.getElementById('stats-vencidos')) document.getElementById('stats-vencidos').innerText = vencidos;
                if (document.getElementById('stats-pagina')) document.getElementById('stats-pagina').innerText = state.currentPageAlumnos;

                // --- LÓGICA DE PAGINACIÓN ---
                const totalItems = listaDatos.length;
                const totalPages = Math.ceil(totalItems / state.itemsPerPage);
                
                // Recorte de la lista según la página
                const inicio = (state.currentPageAlumnos - 1) * state.itemsPerPage;
                const fin = inicio + state.itemsPerPage;
                const listaPaginada = listaDatos.slice(inicio, fin);

                if(listaPaginada.length === 0) {
                    contenedor.innerHTML = `
                        <div class="h-full flex flex-col items-center justify-center text-white/20 py-10">
                            <i data-lucide="users" class="w-12 h-12 mb-2"></i>
                            <p class="text-xs font-black uppercase italic tracking-widest">Sin resultados en el arsenal</p>
                        </div>`;
                    renderPaginationControls(0); // Limpiar paginación si no hay datos
                    if(window.lucide) lucide.createIcons();
                    return;
                }

                contenedor.innerHTML = listaPaginada.map(a => {
                    // Lógica de Estado
                    const estaVencido = !a.fecha_vencimiento || a.fecha_vencimiento < hoy;
                    const colorEstado = estaVencido ? 'bg-red-600' : 'bg-green-600'; 
                    const textoEstado = estaVencido ? 'VENCIDO' : 'ACTIVO';
                    const colorBadge = estaVencido ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-green-500 bg-green-500/10 border-green-500/20';

                    const initials = a.nombre_completo ? a.nombre_completo.substring(0,2).toUpperCase() : "??";
                    const planNombre = a.plan ? a.plan.nombre : 'Sin Plan';

                    return `
                    <div class="glass-card p-5 rounded-3xl border-white/5 flex flex-col md:flex-row md:items-center gap-6 hover:border-red-600/20 transition-all group relative overflow-hidden">
                        <!-- Barra lateral decorativa -->
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 ${colorEstado} opacity-40 group-hover:opacity-100 transition-opacity"></div>
                        
                        <!-- COLUMNA 1: IDENTIDAD -->
                        <div class="flex items-center gap-4 w-full md:w-1/3">
                            <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-lg italic shadow-lg group-hover:bg-red-600 group-hover:text-black transition-colors shrink-0">
                                ${initials}
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors truncate">${a.nombre_completo}</h4>
                                <div class="flex flex-col mt-1">
                                    <p class="text-[10px] text-white-500 font-bold flex items-center gap-1.5"><i data-lucide="id-card" class="w-3 h-3"></i> ${a.dni}</p>
                                    ${a.email ? `<p class="text-[10px] text-white-500 font-bold flex items-center gap-1.5 truncate"><i data-lucide="mail" class="w-3 h-3"></i> ${a.email}</p>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- COLUMNA 2: PLAN Y ESTADO -->
                        <div class="flex-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                
                                <!-- Info Plan -->
                                <div>
                                    <p class="text-[9px] text-white-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <i data-lucide="ticket" class="w-3 h-3 text-red-600"></i> Plan Actual
                                    </p>
                                    <p class="text-sm font-black uppercase italic text-white truncate">${planNombre}</p>
                                </div>

                                <!-- Estado y Fechas -->
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

                        <!-- COLUMNA 3: ACCIONES -->
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
                if(window.lucide) lucide.createIcons();
            }

            /**
             * 2. Función de Filtrado
             */
            function filterAlumnos(filtro) {
				// 1. Validar que existan alumnos en el estado
				if (!state.alumnos) return;

				// 2. Actualizar el estado global del filtro y resetear página
				state.alumnosStatusFilter = filtro; // Guardamos qué filtro está activo
				state.alumnosPage = 1;              // Resetear a la página 1
				state.currentPageAlumnos = 1;       // Sincronizar con tu otra variable de página si existe

				// 3. Limpiar el buscador para evitar conflictos visuales
				const searchInput = document.getElementById('search-alumno-input');
				if (searchInput) {
					searchInput.value = "";
					state.alumnosSearch = ""; // Limpiamos también el texto de búsqueda en el estado
				}

				// 4. UI: REINICIAR BOTONES (Limpiar colores de todos)
				document.querySelectorAll('.filter-btn, .filter-btn-alumno').forEach(btn => {
					btn.classList.remove('bg-red-600', 'text-black');
					btn.classList.add('text-white-500', 'hover:text-white');
				});

				// 5. UI: MARCAR EL BOTÓN SELECCIONADO
				const activeBtn = document.getElementById('filter-' + filtro);
				if (activeBtn) {
					activeBtn.classList.remove('text-white-500', 'hover:text-white');
					activeBtn.classList.add('bg-red-600', 'text-black');
				}

				// --- AGREGADO: Obtener el valor del filtro de sucursal ---
				const sucursalSelect = document.getElementById('filter-sucursal-alumnos');
				const sucursalId = sucursalSelect ? sucursalSelect.value : 'all';

				// 6. LÓGICA DE FILTRADO (Combinando Estado + Sucursal)
				const hoy = new Date().toISOString().split('T')[0];
				
				// Primero filtramos por sucursal si no es "all"
				let filtrados = sucursalId === 'all' 
					? state.alumnos 
					: state.alumnos.filter(a => a.sucursal_id == sucursalId);

				// Luego filtramos por el estado (todos, activos o vencidos)
				if (filtro === 'activos') {
					filtrados = filtrados.filter(a => a.fecha_vencimiento && a.fecha_vencimiento >= hoy);
				} else if (filtro === 'vencidos') {
					filtrados = filtrados.filter(a => !a.fecha_vencimiento || a.fecha_vencimiento < hoy);
				}

				// 7. RENDERIZAR RESULTADOS
				if (typeof renderAlumnosList === 'function') {
					renderAlumnosList(filtrados);
				} else {
					// Si tu renderizador principal usa el estado global, recordá actualizar la lista filtrada allí si es necesario
					renderAlumnos(); 
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
			const token = localStorage.getItem('gymfit_token') || (state && state.token);

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