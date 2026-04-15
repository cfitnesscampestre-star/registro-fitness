// ═══════════════════════════════════════════════════════════════
// AUTH.JS — Sistema de autenticación seguro
// SHA-256 · Bloqueo por intentos · Sesión con TTL + fingerprint
// ═══════════════════════════════════════════════════════════════

// ── Hash SHA-256 usando WebCrypto API (nativo en todos los navegadores) ──
async function sha256(texto) {
  const msgBuffer = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Fingerprint básico del dispositivo (evita reutilizar sesiones entre equipos) ──
function getDeviceFingerprint() {
  const ua = navigator.userAgent;
  const lang = navigator.language;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screen = `${window.screen.width}x${window.screen.height}`;
  return btoa(`${ua}|${lang}|${tz}|${screen}`).slice(0, 32);
}

// ── Control de intentos fallidos ──
const MAX_INTENTOS = 5;
const BLOQUEO_MS   = 15 * 60 * 1000; // 15 minutos

function getIntentosKey(rol) {
  return `fc_intentos_${rol}`;
}
function getBloqueoKey(rol) {
  return `fc_bloqueo_${rol}`;
}

function registrarIntentoFallido(rol) {
  const key = getIntentosKey(rol);
  const bloqueoKey = getBloqueoKey(rol);
  let intentos = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(intentos));
  if (intentos >= MAX_INTENTOS) {
    localStorage.setItem(bloqueoKey, String(Date.now() + BLOQUEO_MS));
    localStorage.setItem(key, '0');
  }
  return intentos;
}

function limpiarIntentos(rol) {
  localStorage.removeItem(getIntentosKey(rol));
  localStorage.removeItem(getBloqueoKey(rol));
}

function getRolBloqueado(rol) {
  const bloqueoKey = getBloqueoKey(rol);
  const hasta = parseInt(localStorage.getItem(bloqueoKey) || '0');
  if (!hasta) return null;
  if (Date.now() < hasta) return hasta; // sigue bloqueado
  localStorage.removeItem(bloqueoKey);  // ya expiró, limpiar
  return null;
}

function tiempoRestante(hasta) {
  const ms = hasta - Date.now();
  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

// ── Contraseñas por defecto (hasheadas) — se migran al primer uso ──
// Estos son los hashes de 'fitness2025' y 'campestre'
// Si el usuario ya cambió la contraseña, se usa la guardada en localStorage
const HASH_ADMIN_DEFAULT   = 'a8f2c1e4b9d3f6a5c2e8b7d4f1a3c6e9b2d5f8a1c4e7b0d3f6a9c2e5b8d1f4a7'; // placeholder
const HASH_USUARIO_DEFAULT = 'c3d6f9a2e5b8d1f4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6'; // placeholder

// ── Inicializar hashes en primer arranque ──
async function inicializarHashes() {
  // Si ya existe hash guardado, no hacer nada
  if (localStorage.getItem('fc_hash_admin')) return;

  // Primera vez: hashear las contraseñas por defecto y guardar
  const hashAdmin   = await sha256('fitness2025');
  const hashUsuario = await sha256('campestre');
  localStorage.setItem('fc_hash_admin',   hashAdmin);
  localStorage.setItem('fc_hash_usuario', hashUsuario);

  // Migrar contraseñas en texto plano si existían de versiones anteriores
  const passViejaAdmin = localStorage.getItem('fc_pass_admin');
  const passViejaUser  = localStorage.getItem('fc_pass_usuario');
  if (passViejaAdmin) {
    const h = await sha256(passViejaAdmin);
    localStorage.setItem('fc_hash_admin', h);
    localStorage.removeItem('fc_pass_admin'); // eliminar texto plano
  }
  if (passViejaUser) {
    const h = await sha256(passViejaUser);
    localStorage.setItem('fc_hash_usuario', h);
    localStorage.removeItem('fc_pass_usuario');
  }
}

// ── Selección de rol en la pantalla de login ──
function seleccionarRol(rol) {
  rolLoginSeleccionado = rol;
  document.getElementById('role-btn-admin').classList.toggle('selected', rol === 'admin');
  document.getElementById('role-btn-usuario').classList.toggle('selected', rol === 'usuario');
  document.getElementById('role-btn-instructor').classList.toggle('selected', rol === 'instructor');

  const instWrap = document.getElementById('login-instructor-select-wrap');
  const passLbl  = document.getElementById('login-pass-label');
  if (rol === 'instructor') {
    const sel = document.getElementById('login-instructor-sel');
    sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>' +
      (instructores || []).map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    instWrap.style.display = 'block';
    passLbl.textContent = 'PIN (4 dígitos)';
    document.getElementById('login-pass').placeholder = 'Ingresa tu PIN...';
  } else {
    instWrap.style.display = 'none';
    passLbl.textContent = 'Contraseña';
    document.getElementById('login-pass').placeholder = 'Ingresa tu contraseña...';
  }

  // Mostrar estado de bloqueo si aplica
  _actualizarUIBloqueo(rol);
  document.getElementById('login-pass').focus();
}

function loginInstructorSelChange() {
  document.getElementById('login-pass').focus();
}

// ── Actualizar UI con estado de bloqueo ──
function _actualizarUIBloqueo(rol) {
  const errEl  = document.getElementById('login-error');
  const errTxt = document.getElementById('login-error-txt');
  const btnLogin = document.querySelector('.login-btn');
  const bloqueadoHasta = getRolBloqueado(rol);

  if (bloqueadoHasta) {
    errTxt.textContent = `⛔ Demasiados intentos fallidos. Espera ${tiempoRestante(bloqueadoHasta)} para intentar de nuevo.`;
    errEl.style.display = 'block';
    if (btnLogin) btnLogin.disabled = true;
    // Actualizar countdown cada segundo
    if (window._bloqueoTimer) clearInterval(window._bloqueoTimer);
    window._bloqueoTimer = setInterval(() => {
      const restante = getRolBloqueado(rolLoginSeleccionado);
      if (!restante) {
        clearInterval(window._bloqueoTimer);
        errEl.style.display = 'none';
        if (btnLogin) btnLogin.disabled = false;
      } else {
        errTxt.textContent = `⛔ Demasiados intentos fallidos. Espera ${tiempoRestante(restante)} para intentar de nuevo.`;
      }
    }, 1000);
  } else {
    if (btnLogin) btnLogin.disabled = false;
    if (window._bloqueoTimer) clearInterval(window._bloqueoTimer);
  }
}

// ── Login principal ──
async function intentarLogin() {
  const pass   = document.getElementById('login-pass').value;
  const errEl  = document.getElementById('login-error');
  const errTxt = document.getElementById('login-error-txt');
  errEl.style.display = 'none';

  // ── Login instructor (PIN numérico — sin hashear, cortos) ──
  if (rolLoginSeleccionado === 'instructor') {
    const instId = parseInt(document.getElementById('login-instructor-sel').value);
    if (!instId) {
      errTxt.textContent = 'Selecciona tu nombre primero.';
      errEl.style.display = 'block';
      return;
    }
    const pinGuardado = localStorage.getItem(`fc_pin_${instId}`) || '1234';
    if (pass === pinGuardado) {
      _loginExitoso('instructor', instId);
    } else {
      _loginFallido('instructor', 'PIN incorrecto. Intenta de nuevo.');
    }
    return;
  }

  // ── Verificar bloqueo antes de validar contraseña ──
  const bloqueadoHasta = getRolBloqueado(rolLoginSeleccionado);
  if (bloqueadoHasta) {
    errTxt.textContent = `⛔ Cuenta bloqueada. Espera ${tiempoRestante(bloqueadoHasta)}.`;
    errEl.style.display = 'block';
    return;
  }

  // ── Hashear lo que ingresó el usuario y comparar ──
  const hashIngresado = await sha256(pass);
  const hashGuardado  = rolLoginSeleccionado === 'admin'
    ? localStorage.getItem('fc_hash_admin')
    : localStorage.getItem('fc_hash_usuario');

  if (hashIngresado === hashGuardado) {
    limpiarIntentos(rolLoginSeleccionado);
    _loginExitoso(rolLoginSeleccionado, null);
  } else {
    const intentos = registrarIntentoFallido(rolLoginSeleccionado);
    const restantes = MAX_INTENTOS - intentos;
    if (restantes <= 0) {
      _actualizarUIBloqueo(rolLoginSeleccionado);
    } else {
      _loginFallido(rolLoginSeleccionado, `Contraseña incorrecta. ${restantes} intento(s) restante(s).`);
    }
  }
}

function _loginExitoso(rol, instId) {
  rolActual = rol;
  if (instId) instActualId = instId;
  const fingerprint = getDeviceFingerprint();
  // Guardar sesión con TTL 8h + fingerprint
  localStorage.setItem('fc_ses_rol',        rol);
  localStorage.setItem('fc_ses_ttl',        String(Date.now() + 8 * 3600000));
  localStorage.setItem('fc_ses_fp',         fingerprint);
  if (instId) localStorage.setItem('fc_ses_inst_id', String(instId));
  sessionStorage.setItem('fc_rol',     rol);
  if (instId) sessionStorage.setItem('fc_inst_id', String(instId));

  aplicarRol(rol);
  document.getElementById('login-screen').classList.add('oculto');
  document.getElementById('login-pass').value = '';

  if (rol === 'instructor') {
    abrirPortalInstructorLocal();
  } else {
    renderAll();
    renderCal();
    if (window.innerWidth <= 640) switchSection('hoy');
  }
}

function _loginFallido(rol, mensaje) {
  const errEl  = document.getElementById('login-error');
  const errTxt = document.getElementById('login-error-txt');
  errTxt.textContent = mensaje;
  errEl.style.display = 'block';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-pass').focus();
  const box = document.querySelector('.login-box');
  box.style.animation = 'none';
  setTimeout(() => box.style.animation = 'shake .3s ease', 10);
}

// ── Verificar sesión al cargar (con fingerprint) ──
function verificarSesionGuardada() {
  const sesRol  = localStorage.getItem('fc_ses_rol');
  const sesTTL  = parseInt(localStorage.getItem('fc_ses_ttl') || '0');
  const sesFP   = localStorage.getItem('fc_ses_fp');
  const fpActual = getDeviceFingerprint();

  if (sesRol && sesTTL > Date.now() && sesFP === fpActual) {
    return { rol: sesRol, instId: localStorage.getItem('fc_ses_inst_id') };
  }
  // Sesión inválida, expirada o de otro dispositivo — limpiar
  localStorage.removeItem('fc_ses_rol');
  localStorage.removeItem('fc_ses_ttl');
  localStorage.removeItem('fc_ses_fp');
  localStorage.removeItem('fc_ses_inst_id');
  return null;
}

function aplicarRol(rol) {
  rolActual = rol;
  document.body.classList.toggle('rol-usuario', rol === 'usuario');
  document.body.classList.toggle('rol-admin', rol === 'admin');
  document.body.classList.toggle('rol-instructor', rol === 'instructor');
  document.querySelectorAll('.solo-admin').forEach(el => {
    el.style.display = (rol === 'admin') ? '' : 'none';
  });
}

function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  if (typeof instPararPoll === 'function') instPararPoll();
  rolActual = null;
  instActualId = null;
  sessionStorage.removeItem('fc_rol');
  sessionStorage.removeItem('fc_inst_id');
  localStorage.removeItem('fc_ses_rol');
  localStorage.removeItem('fc_ses_inst_id');
  localStorage.removeItem('fc_ses_ttl');
  localStorage.removeItem('fc_ses_fp');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';

  // Ocultar pantalla del instructor
  const instScreen = document.getElementById('instructor-screen');
  if (instScreen) instScreen.style.display = 'none';

  // Restaurar TODOS los elementos que abrirPortalInstructorLocal ocultó
  const hdr = document.getElementById('hdr');
  if (hdr) hdr.style.display = '';
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = '';
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = '';
  const sectionNav = document.getElementById('section-nav');
  if (sectionNav) sectionNav.style.display = '';
  const backBar = document.getElementById('mob-back-bar');
  if (backBar) backBar.style.display = '';

  // Asegurar que al menos una vista esté activa para que no quede pantalla en blanco
  const hayVistaActiva = document.querySelector('.vista.on');
  if (!hayVistaActiva) {
    // Activar la vista de inicio por defecto
    const vInicio = document.getElementById('v-hoy') || document.querySelector('.vista');
    if (vInicio) {
      document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));
      vInicio.classList.add('on');
    }
    const tabInicio = document.querySelector('[data-v="hoy"]') || document.querySelector('.tab');
    if (tabInicio) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
      tabInicio.classList.add('on');
    }
  }

  document.getElementById('login-screen').classList.remove('oculto');
  seleccionarRol('admin');
}

function abrirModalCambiarPass() {
  ['cp-admin-actual','cp-admin-nueva','cp-admin-confirma','cp-user-nueva','cp-user-confirma']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('m-cambiar-pass').classList.add('on');
}

// ── Cambiar contraseña — guarda hash, nunca texto plano ──
async function cambiarPass(tipo) {
  if (tipo === 'admin') {
    const actual = document.getElementById('cp-admin-actual').value;
    const nueva  = document.getElementById('cp-admin-nueva').value.trim();
    const conf   = document.getElementById('cp-admin-confirma').value.trim();
    // Verificar contraseña actual comparando hashes
    const hashActual   = await sha256(actual);
    const hashGuardado = localStorage.getItem('fc_hash_admin');
    if (hashActual !== hashGuardado) { showToast('La contraseña actual del Coordinador es incorrecta.', 'err'); return; }
    if (!nueva || nueva.length < 6)  { showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'err'); return; }
    if (nueva !== conf)               { showToast('Las contraseñas nuevas no coinciden.', 'err'); return; }
    const hashNueva = await sha256(nueva);
    localStorage.setItem('fc_hash_admin', hashNueva);
    localStorage.removeItem('fc_pass_admin'); // eliminar versión vieja si existía
    showToast('✔ Contraseña de Coordinador actualizada correctamente.', 'ok');
    cerrarModal('m-cambiar-pass');
  } else {
    const nueva = document.getElementById('cp-user-nueva').value.trim();
    const conf  = document.getElementById('cp-user-confirma').value.trim();
    if (!nueva || nueva.length < 6) { showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'err'); return; }
    if (nueva !== conf)             { showToast('Las contraseñas nuevas no coinciden.', 'err'); return; }
    const hashNueva = await sha256(nueva);
    localStorage.setItem('fc_hash_usuario', hashNueva);
    localStorage.removeItem('fc_pass_usuario');
    showToast('✔ Contraseña de Consulta actualizada correctamente.', 'ok');
    cerrarModal('m-cambiar-pass');
  }
}

// ── Animación shake ──
(function () {
  const s = document.createElement('style');
  s.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}';
  document.head.appendChild(s);
})();
