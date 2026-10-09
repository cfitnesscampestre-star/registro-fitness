/* pines.js — Genera PIN aleatorios para los profesores y descarga la lista (CSV que abre en Excel).
   · "Generar PINs": crea un PIN de 4 dígitos distinto por profesor activo, pide confirmación, lo guarda y descarga la lista.
   · "Lista de PINs": descarga la lista con los PIN que tienen ahora (sin cambiar nada).
   Solo coordinación (rol admin). */
(function () {
  'use strict';
  function esAdmin() { return typeof rolActual !== 'undefined' && rolActual === 'admin'; }
  function activos() { return (instructores || []).filter(function (i) { return typeof instActivo !== 'function' || instActivo(i); }); }
  function pinActual(i) { return i.pin || localStorage.getItem('fc_pin_' + i.id) || '1234'; }
  function malo(p) { return /^(\d)\1{3}$/.test(p) || '01234567890'.indexOf(p) >= 0 || '9876543210'.indexOf(p) >= 0 || p === '1234'; }
  function rnd() { var a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0] % 10000).padStart(4, '0'); }
  function descargar(filas, nombre) {
    var csv = '﻿Profesor,PIN\r\n' + filas.map(function (f) { return '"' + String(f[0]).replace(/"/g, '""') + '",' + f[1]; }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fecha() { return fechaLocalStr(new Date()); }

  window.pinesDescargarLista = function () {
    if (!esAdmin()) return;
    var f = activos().map(function (i) { return [i.nombre, pinActual(i)]; }).sort(function (a, b) { return a[0].localeCompare(b[0]); });
    descargar(f, 'pines-profesores-' + fecha() + '.csv');
  };

  window.pinesGenerar = async function () {
    if (!esAdmin()) return;
    var act = activos(), usados = new Set(), nuevo = new Map();
    act.forEach(function (i) { var p; do { p = rnd(); } while (usados.has(p) || malo(p)); usados.add(p); nuevo.set(i, p); });
    if (!confirm('Se van a CAMBIAR los PIN de ' + act.length + ' profesores activos.\nLos PIN anteriores dejarán de funcionar.\n\n¿Generar PIN nuevos y descargar la lista?')) return;
    act.forEach(function (i) { i.pin = nuevo.get(i); try { localStorage.setItem('fc_pin_' + i.id, i.pin); } catch (e) {} i.updatedAt = Date.now(); });
    try { guardarLocal(); } catch (e) {}
    try { await sincronizarFirebase(); } catch (e) {}
    try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
    var f = act.map(function (i) { return [i.nombre, i.pin]; }).sort(function (a, b) { return a[0].localeCompare(b[0]); });
    descargar(f, 'pines-profesores-' + fecha() + '.csv');
    try { showToast('PIN nuevos guardados. Lista descargada.', 'ok'); } catch (e) {}
  };
})();
