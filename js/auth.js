// ═══ AUTH — Fitness Control · Club Campestre ═══
// ═══════════════════════════════════════════
// SISTEMA DE LOGIN CON ROLES
// ═══════════════════════════════════════════
// Contraseñas — para cambiarlas, edita estas líneas:
const PASS_ADMIN   = 'fitness2025';   // Coordinador — acceso total
const PASS_USUARIO = 'campestre';     // Consulta — solo lectura

let rolActual = null;
let rolLoginSeleccionado = 'admin';

function seleccionarRol(rol) {
  rolLoginSeleccionado = rol;
  document.getElementById('role-btn-admin').classList.toggle('selected', rol === 'admin');
  document.getElementById('role-btn-usuario').classList.toggle('selected', rol === 'usuario');
  document.getElementById('login-pass').focus();
}

function intentarLogin() {
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const passCorrecta = rolLoginSeleccionado === 'admin'
    ? (localStorage.getItem('fc_pass_admin') || PASS_ADMIN)
    : (localStorage.getItem('fc_pass_usuario') || PASS_USUARIO);

  if(pass === passCorrecta) {
    rolActual = rolLoginSeleccionado;
    sessionStorage.setItem('fc_rol', rolActual);
    aplicarRol(rolActual);
    document.getElementById('login-screen').classList.add('oculto');
    document.getElementById('login-pass').value = '';
  } else {
    errEl.style.display = 'block';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    // Shake animation
    const box = document.querySelector('.login-box');
    box.style.animation = 'none';
    setTimeout(()=>box.style.animation='shake .3s ease',10);
  }
}

function aplicarRol(rol) {
  rolActual = rol;
  document.body.classList.toggle('rol-usuario', rol === 'usuario');
  document.body.classList.toggle('rol-admin', rol === 'admin');

  if(rol === 'admin') {
    document.querySelectorAll('.solo-admin').forEach(el=>el.style.display='');
  } else {
    document.querySelectorAll('.solo-admin').forEach(el=>el.style.display='none');
  }
}

function cerrarSesion() {
  if(!confirm('¿Cerrar sesión?')) return;
  rolActual = null;
  sessionStorage.removeItem('fc_rol');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-screen').classList.remove('oculto');
}

function abrirModalCambiarPass() {
  // Limpiar campos
  ['cp-admin-actual','cp-admin-nueva','cp-admin-confirma','cp-user-nueva','cp-user-confirma'].forEach(id=>{
    document.getElementById(id).value='';
  });
  document.getElementById('m-cambiar-pass').classList.add('on');
}

function cambiarPass(tipo) {
  if(tipo === 'admin') {
    const actual = document.getElementById('cp-admin-actual').value;
    const nueva  = document.getElementById('cp-admin-nueva').value.trim();
    const conf   = document.getElementById('cp-admin-confirma').value.trim();
    const passActual = localStorage.getItem('fc_pass_admin') || PASS_ADMIN;
    if(actual !== passActual){ toast('La contraseña actual del Coordinador es incorrecta','err'); return; }
    if(!nueva || nueva.length < 4){ toast('La nueva contraseña debe tener al menos 4 caracteres','err'); return; }
    if(nueva !== conf){ toast('Las contraseñas nuevas no coinciden','err'); return; }
    localStorage.setItem('fc_pass_admin', nueva);
    toast('Contraseña de Coordinador actualizada — anótala','ok',5000);
    cerrarModal('m-cambiar-pass');
  } else {
    const nueva = document.getElementById('cp-user-nueva').value.trim();
    const conf  = document.getElementById('cp-user-confirma').value.trim();
    if(!nueva || nueva.length < 4){ toast('La nueva contraseña debe tener al menos 4 caracteres','err'); return; }
    if(nueva !== conf){ toast('Las contraseñas nuevas no coinciden','err'); return; }
    localStorage.setItem('fc_pass_usuario', nueva);
    toast('Contraseña de Consulta actualizada — anótala','ok',5000);
    cerrarModal('m-cambiar-pass');
  }
}

// ── Animación shake para login ────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}';
  document.head.appendChild(s);
})();


// ═══════════════════════════════════════════
// SUPLENCIAS PLANIFICADAS
// ═══════════════════════════════════════════
