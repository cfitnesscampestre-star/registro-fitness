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

// ── Contraseñas de fábrica: solo su hash (el texto ya no está en el código) ──
// Valen únicamente mientras coordinación no haya puesto una propia. En cuanto se cambia,
// la nueva se guarda en Firebase (fitness/cfg/acceso) y aplica en todos los equipos.
const HASH_ADMIN_DEFAULT   = '5df9b9796ea44ee9668fafaa0792d4c6e377325d7cf522458c6197435732bfe6';
const HASH_USUARIO_DEFAULT = '4c2ea9c645083b32f144c3ac4d72b23b88e68a172a8063b21982a9a75a911359';
function _hashDefault(rol) { return rol === 'admin' ? HASH_ADMIN_DEFAULT : HASH_USUARIO_DEFAULT; }

// ── Hash con sal (PBKDF2-SHA256) para contraseñas y PIN ──
// Formato guardado: pbkdf2$<iteraciones>$<sal hex>$<hash hex>. También se aceptan los
// SHA-256 sin sal de la versión anterior (64 hex), que se actualizan al entrar.
const PBKDF2_ITER = 120000;
function _hex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); }
function _deHex(h) { return new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16))); }
async function _pbkdf2(texto, salHex, iter) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(texto), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: _deHex(salHex), iterations: iter }, clave, 256);
  return _hex(bits);
}
async function hashSecreto(texto) {
  const sal = _hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2$${PBKDF2_ITER}$${sal}$${await _pbkdf2(texto, sal, PBKDF2_ITER)}`;
}
async function verificarSecreto(texto, guardado) {
  if (!guardado || typeof guardado !== 'string') return false;
  const m = guardado.match(/^pbkdf2\$(\d+)\$([0-9a-f]+)\$([0-9a-f]{64})$/);
  if (m) return (await _pbkdf2(texto, m[2], parseInt(m[1], 10))) === m[3];
  if (/^[0-9a-f]{64}$/.test(guardado)) return (await sha256(texto)) === guardado;
  return false;
}
function hashValido(h) { return typeof h === 'string' && (/^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$/.test(h) || /^[0-9a-f]{64}$/.test(h)); }

// ── Inicializar hashes en primer arranque ──
async function inicializarHashes() {
  // Migrar texto plano si existía (versión anterior)
  const passViejaAdmin = localStorage.getItem('fc_pass_admin');
  const passViejaUser  = localStorage.getItem('fc_pass_usuario');
  if (passViejaAdmin) { localStorage.setItem('fc_hash_admin', await hashSecreto(passViejaAdmin)); localStorage.removeItem('fc_pass_admin'); }
  if (passViejaUser)  { localStorage.setItem('fc_hash_usuario', await hashSecreto(passViejaUser)); localStorage.removeItem('fc_pass_usuario'); }
  if (!hashValido(localStorage.getItem('fc_hash_admin')))   localStorage.setItem('fc_hash_admin', HASH_ADMIN_DEFAULT);
  if (!hashValido(localStorage.getItem('fc_hash_usuario'))) localStorage.setItem('fc_hash_usuario', HASH_USUARIO_DEFAULT);
  // Copias en texto plano de PIN que guardaban versiones anteriores: ya no se usan
  try {
    Object.keys(localStorage).filter(k => /^fc_pin_/.test(k)).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// ── Contraseñas compartidas entre equipos (fitness/cfg/acceso en Firebase) ──
// Este equipo guarda una copia (fc_hash_<rol>) para poder entrar sin conexión.
// Si un cambio no alcanzó a subir, queda marcado como pendiente y se sube al conectar.
function _publicarAcceso(rol) {
  const h = localStorage.getItem('fc_hash_' + rol);
  if (!hashValido(h)) return;
  localStorage.setItem('fc_acceso_pend_' + rol, '1');
  if (typeof fbDb === 'undefined' || !fbDb) return;
  fbDb.ref('fitness/cfg/acceso/' + rol).set(h)
    .then(() => localStorage.removeItem('fc_acceso_pend_' + rol))
    .catch(e => console.warn('[Acceso] no se pudo guardar en la nube:', e && e.message));
}
// La llama firmas.js cada vez que llegan datos de la nube
function aplicarAccesoNube(acceso) {
  ['admin', 'usuario'].forEach(rol => {
    const local = localStorage.getItem('fc_hash_' + rol);
    const nube = acceso && acceso[rol];
    if (localStorage.getItem('fc_acceso_pend_' + rol)) { _publicarAcceso(rol); return; }
    if (hashValido(nube)) { if (nube !== local) localStorage.setItem('fc_hash_' + rol, nube); return; }
    // La nube aún no tiene contraseña: la sube solo un equipo con sesión de coordinación y
    // solo si la de este equipo NO es la de fábrica (así la de fábrica nunca pisa una real).
    if (typeof rolActual !== 'undefined' && rolActual === 'admin' && hashValido(local) && local !== _hashDefault(rol)) _publicarAcceso(rol);
  });
}

async function cambiarPass(rol) {
  const v = id => (document.getElementById(id) || {}).value || '';
  const limpiar = ids => ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  if (typeof rolActual === 'undefined' || rolActual !== 'admin') { showToast('Solo coordinación puede cambiar contraseñas.', 'err'); return; }
  const nueva    = rol === 'admin' ? v('cp-admin-nueva')    : v('cp-user-nueva');
  const confirma = rol === 'admin' ? v('cp-admin-confirma') : v('cp-user-confirma');
  if (rol === 'admin' && !(await verificarSecreto(v('cp-admin-actual'), localStorage.getItem('fc_hash_admin')))) {
    showToast('La contraseña actual no es correcta.', 'err'); return;
  }
  if (nueva.length < 8) { showToast('La contraseña nueva debe tener al menos 8 caracteres.', 'err'); return; }
  if (nueva !== confirma) { showToast('La confirmación no coincide con la contraseña nueva.', 'err'); return; }
  if ((await sha256(nueva)) === _hashDefault(rol)) { showToast('Esa es la contraseña de fábrica. Elige otra.', 'err'); return; }
  localStorage.setItem('fc_hash_' + rol, await hashSecreto(nueva));
  limpiarIntentos(rol);
  _publicarAcceso(rol);
  limpiar(rol === 'admin' ? ['cp-admin-actual', 'cp-admin-nueva', 'cp-admin-confirma'] : ['cp-user-nueva', 'cp-user-confirma']);
  const enLinea = typeof fbDb !== 'undefined' && fbDb && (typeof fbConectado === 'undefined' || fbConectado);
  showToast(`Contraseña de ${rol === 'admin' ? 'Coordinador' : 'Consulta'} cambiada. ` +
            (enLinea ? 'Ya aplica en todos los equipos.' : 'Se enviará a los demás equipos al volver la conexión.'), 'ok');
  if (rol === 'admin') cerrarModal('m-cambiar-pass');
}

// ── PIN de instructores ──
// Se guarda solo el hash (inst.pinHash). Quien lea la base ya no ve los PIN, aunque con
// 4 dígitos el hash solo frena la lectura casual: la protección real son las reglas de Firebase.
function instTienePin(inst) { return !!(inst && (hashValido(inst.pinHash) || inst.pin)); }
async function verificarPinInst(inst, pin) {
  if (!inst || !pin) return false;
  if (hashValido(inst.pinHash)) return verificarSecreto(pin, inst.pinHash);
  return !!inst.pin && String(inst.pin) === pin;          // PIN viejo aún sin migrar
}
function pinValido(pin) { return /^\d{4,6}$/.test(pin); }
async function asignarPinInst(inst, pin) {
  inst.pinHash = await hashSecreto(pin);
  delete inst.pin;
  inst.updatedAt = Date.now();
}
// Coordinación convierte los PIN en texto plano que aún queden en la base
let _migrandoPines = false;
async function migrarPinesInstructores() {
  if (_migrandoPines || typeof rolActual === 'undefined' || rolActual !== 'admin') return;
  const pendientes = (typeof instructores !== 'undefined' ? instructores : []).filter(i => i && i.pin);
  if (!pendientes.length) return;
  _migrandoPines = true;
  try {
    for (const inst of pendientes) await asignarPinInst(inst, String(inst.pin));
    if (typeof guardarLocal === 'function') guardarLocal();
    if (typeof sincronizarFirebase === 'function') sincronizarFirebase();
    console.log(`[Acceso] ${pendientes.length} PIN convertidos a hash`);
  } catch (e) { console.warn('[Acceso] migración de PIN:', e); }
  finally { _migrandoPines = false; }
}

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
      (instructores || []).filter(i => instActivo(i)).map(i => `<option value="${escHtml(i.id)}">${escHtml(i.nombre)}</option>`).join('');
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

  // ── Login instructor (PIN de 4–6 dígitos, se compara contra su hash) ──
  if (rolLoginSeleccionado === 'instructor') {
    const instId = parseInt(document.getElementById('login-instructor-sel').value);
    if (!instId) {
      errTxt.textContent = 'Selecciona tu nombre primero.';
      errEl.style.display = 'block';
      return;
    }
    const instObj = (typeof instructores !== 'undefined')
      ? instructores.find(i => i.id === instId || String(i.id) === String(instId))
      : null;
    // Mismo bloqueo por intentos que coordinación, por instructor (antes no había límite)
    const claveBloq = 'instructor_' + instId;
    const bloqInst = getRolBloqueado(claveBloq);
    if (bloqInst) {
      errTxt.textContent = `⛔ Demasiados intentos. Espera ${tiempoRestante(bloqInst)} para intentar de nuevo.`;
      errEl.style.display = 'block';
      return;
    }
    if (!instObj) {
      _loginFallido('instructor', 'Aún no se cargan los datos de instructores. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    if (!instTienePin(instObj)) {
      _loginFallido('instructor', 'Aún no tienes PIN. Pídeselo a coordinación.');
      return;
    }
    if (await verificarPinInst(instObj, pass)) {
      limpiarIntentos(claveBloq);
      _loginExitoso('instructor', instId);
    } else {
      const restantes = MAX_INTENTOS - registrarIntentoFallido(claveBloq);
      _loginFallido('instructor', restantes > 0
        ? `PIN incorrecto. ${restantes} intento(s) restante(s).`
        : `⛔ Demasiados intentos. Espera ${tiempoRestante(getRolBloqueado(claveBloq))} para intentar de nuevo.`);
    }
    return;
  }

  const bloqueadoHasta = getRolBloqueado(rolLoginSeleccionado);
  if (bloqueadoHasta) {
    errTxt.textContent = `⛔ Cuenta bloqueada. Espera ${tiempoRestante(bloqueadoHasta)}.`;
    errEl.style.display = 'block';
    return;
  }

  // ── Hashear lo que ingresó el usuario y comparar ──
  const rol = rolLoginSeleccionado;
  const hashGuardado = localStorage.getItem('fc_hash_' + rol);

  if (await verificarSecreto(pass, hashGuardado)) {
    limpiarIntentos(rol);
    const deFabrica = hashGuardado === _hashDefault(rol);
    // Hash viejo sin sal (no de fábrica): actualizarlo y compartirlo
    if (!deFabrica && /^[0-9a-f]{64}$/.test(hashGuardado)) {
      localStorage.setItem('fc_hash_' + rol, await hashSecreto(pass));
      if (rol === 'admin') _publicarAcceso(rol);
    }
    _loginExitoso(rol, null);
    if (rol === 'admin') {
      setTimeout(migrarPinesInstructores, 1500);
      if (deFabrica) setTimeout(() => {
        showToast('Estás usando la contraseña de fábrica, que cualquiera puede conocer. Cámbiala ahora: aplicará en todos los equipos.', 'warn');
        abrirModal('m-cambiar-pass');
      }, 1200);
    }
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
    // ── Inicializar notificaciones push ──
    setTimeout(() => {
      if (typeof initNotificaciones === 'function') initNotificaciones();
    }, 2000);
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
    // ── Inicializar notificaciones si es sesión de coordinador ──
    if (sesRol === 'admin' || sesRol === 'usuario') {
      setTimeout(() => {
        if (typeof initNotificaciones === 'function') initNotificaciones();
      }, 3000);
    }
    return { rol: sesRol, instId: localStorage.getItem('fc_ses_inst_id') };
  }
  // Sesión inválida, expirada o de otro dispositivo — limpiar
  localStorage.removeItem('fc_ses_rol');
  localStorage.removeItem('fc_ses_ttl');
  localStorage.removeItem('fc_ses_fp');
  localStorage.removeItem('fc_ses_inst_id');
  return null;
}

// ── Cerrar sesión — usado por los botones "Salir" del portal de instructor,
// del encabezado y del menú del coordinador. Limpia la sesión guardada y
// recarga para volver limpio a la pantalla de login. ──
function cerrarSesion() {
  try {
    localStorage.removeItem('fc_ses_rol');
    localStorage.removeItem('fc_ses_ttl');
    localStorage.removeItem('fc_ses_fp');
    localStorage.removeItem('fc_ses_inst_id');
    sessionStorage.removeItem('fc_rol');
    sessionStorage.removeItem('fc_inst_id');
  } catch (e) { console.warn('Error limpiando sesión:', e); }
  location.reload();
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
