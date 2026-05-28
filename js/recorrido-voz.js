

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENTRADA POR VOZ — MODO TURBO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _vozRecognition = null;
let _vozEscuchando = false;

const _numSpEs = {
  cero:0,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,
  diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,
  'dieciséis':16,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,
  veinte:20,veintiuno:21,'veintidós':22,veintidos:22,'veintitrés':23,veintitres:23,
  veinticuatro:24,veinticinco:25,'veintiséis':26,veintiseis:26,veintisiete:27,
  veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,
  sesenta:60,setenta:70,ochenta:80,noventa:90
};

function _parsearNumeroVoz(texto) {
  const t = texto.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,'');
  const digitos = parseInt(t.replace(/[^0-9]/g,''));
  if (!isNaN(digitos) && t.replace(/[^0-9]/g,'').length > 0) return digitos;
  if (_numSpEs[t] !== undefined) return _numSpEs[t];
  const partes = t.split(/\s+y\s+/);
  if (partes.length === 2) {
    const a = _numSpEs[partes[0].trim()];
    const b = _numSpEs[partes[1].trim()];
    if (a !== undefined && b !== undefined) return a + b;
  }
  return null;
}

function turboVozIniciar(e) {
  e.preventDefault();
  if (_vozEscuchando) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Tu navegador no soporta voz. Usa Chrome en Android.', 'err');
    return;
  }
  const btn = document.getElementById('tc-voz-btn');
  if (btn) {
    btn.style.background = 'rgba(224,80,80,.25)';
    btn.style.borderColor = 'var(--red)';
    btn.style.color = 'var(--red2)';
    btn.style.transform = 'scale(1.12)';
  }
  if (navigator.vibrate) navigator.vibrate(30);
  _vozRecognition = new SpeechRecognition();
  _vozRecognition.lang = 'es-MX';
  _vozRecognition.continuous = false;
  _vozRecognition.interimResults = false;
  _vozEscuchando = true;
  _vozRecognition.onresult = (event) => {
    const texto = event.results[0][0].transcript;
    const num = _parsearNumeroVoz(texto);
    if (num !== null && num >= 0) {
      const inp = document.getElementById('tc-asis');
      if (inp) {
        inp.value = num;
        turboActualizarColor();
        if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
        setTimeout(() => turboGuardar(), 400);
      }
    } else {
      showToast(`No entendí "${texto}". Di solo un número.`, 'warn');
    }
  };
  _vozRecognition.onerror = (e) => {
    if (e.error !== 'aborted') showToast('Error de micrófono: ' + e.error, 'err');
    _vozReset();
  };
  _vozRecognition.onend = () => { _vozReset(); };
  try { _vozRecognition.start(); } catch(err) { _vozReset(); }
}

function turboVozDetener(e) {
  e.preventDefault();
  if (_vozRecognition) {
    try { _vozRecognition.stop(); } catch(_) {}
  }
  _vozReset();
}

function _vozReset() {
  _vozEscuchando = false;
  const btn = document.getElementById('tc-voz-btn');
  if (btn) {
    btn.style.background = 'var(--panel2)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--txt2)';
    btn.style.transform = 'scale(1)';
  }
}
