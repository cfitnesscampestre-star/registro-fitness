// ═══════════════════════════════════════════════════════════════
// IMPORTAR REGISTROS ESTIMADOS
// Carga un JSON con registros marcados `estimado: true` (los generados
// para rellenar huecos) y los agrega a `registros` SIN tocar ni
// sobrescribir ningún registro existente. Solo importa los marcados
// como estimados, así que funciona con cualquiera de los dos archivos
// (solo-nuevos o completo). También permite quitarlos en bloque.
// ═══════════════════════════════════════════════════════════════

function importarEstimadosAbrir() {
  let inp = document.getElementById('imp-est-file');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.id = 'imp-est-file';
    inp.style.display = 'none';
    inp.addEventListener('change', importarEstimadosLeer);
    document.body.appendChild(inp);
  }
  inp.value = '';
  inp.click();
}

function importarEstimadosLeer(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onerror = () => showToast('No se pudo leer el archivo', 'err');
  rd.onload = () => {
    let data;
    try { data = JSON.parse(rd.result); }
    catch (e) { showToast('El archivo no es un JSON válido', 'err'); return; }
    let lista = Array.isArray(data) ? data : Object.values(data || {});
    // Solo registros marcados como estimados y con los campos mínimos
    lista = lista.filter(r => r && r.estimado === true && r.inst_id != null && r.fecha && r.hora && r.clase);
    if (!lista.length) { showToast('No hay registros estimados en ese archivo', 'warn'); return; }
    importarEstimadosAplicar(lista);
  };
  rd.readAsText(file);
}

function importarEstimadosAplicar(lista) {
  const hoyStr = (typeof fechaLocalStr === 'function') ? fechaLocalStr(new Date()) : new Date().toISOString().slice(0, 10);
  const idsUsados = new Set(registros.map(r => String(r.id)));
  const llaves = new Set(registros.map(r => `${r.inst_id}|${r.fecha}|${r.hora}`));
  const nuevos = [];
  let dupId = 0, dupSlot = 0, futuros = 0, instInexistente = 0;

  lista.forEach(r => {
    if (r.fecha > hoyStr) { futuros++; return; }
    if (!instructores.some(i => String(i.id) === String(r.inst_id))) { instInexistente++; return; }
    if (idsUsados.has(String(r.id))) { dupId++; return; }
    const k = `${r.inst_id}|${r.fecha}|${r.hora}`;
    if (llaves.has(k)) { dupSlot++; return; }
    llaves.add(k);
    nuevos.push(r);
  });

  if (!nuevos.length) {
    showToast(`Nada que importar (ya existentes: ${dupId + dupSlot})`, 'warn');
    return;
  }
  const fechas = nuevos.map(r => r.fecha).sort();
  const msg = `Se agregarán ${nuevos.length} registros estimados\n` +
    `Del ${fechas[0]} al ${fechas[fechas.length - 1]}\n\n` +
    `Omitidos: ${dupId + dupSlot} ya existentes` +
    (futuros ? `, ${futuros} con fecha futura` : '') +
    (instInexistente ? `, ${instInexistente} de instructor inexistente` : '') +
    `\n\nNo se modifica ningún registro actual. Cada uno queda marcado como "estimado".\n¿Continuar?`;
  if (!confirm(msg)) return;

  nuevos.forEach(r => registros.push({ ...r, updatedAt: Date.now() }));
  registrarLog('sistema', `Importados ${nuevos.length} registros estimados (${fechas[0]} a ${fechas[fechas.length - 1]})`);
  renderAll();  // guarda en local y sincroniza con Firebase
  if (typeof renderHistorial === 'function' && document.getElementById('v-historial')?.classList.contains('on')) renderHistorial();
  showToast(`${nuevos.length} registros estimados importados`, 'ok');
}

function quitarEstimados() {
  const ids = registros.filter(r => r.estimado === true).map(r => parseInt(r.id));
  if (!ids.length) { showToast('No hay registros estimados', 'info'); return; }
  if (!confirm(`¿Quitar los ${ids.length} registros marcados como estimados?\n\nLos registros reales no se tocan.`)) return;
  if (typeof _eliminarRegistrosPorId === 'function') _eliminarRegistrosPorId(ids);
  registrarLog('sistema', `Quitados ${ids.length} registros estimados`);
  showToast(`${ids.length} registros estimados quitados`, 'ok');
}

window.importarEstimadosAbrir = importarEstimadosAbrir;
window.quitarEstimados = quitarEstimados;
