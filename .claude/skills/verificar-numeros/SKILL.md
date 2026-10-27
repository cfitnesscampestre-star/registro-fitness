---
name: verificar-numeros
description: Verificar que Fitness Control dé números correctos (aforo, asistentes, horas, faltas, suplencias, pendientes, gimnasia de Gerencia, sincronización entre dispositivos) y revisar los datos reales en busca de registros que alteren reportes. Usar antes de publicar cualquier cambio, al investigar un número que "no cuadra", al arreglar un bug de cálculo o de guardado, o cuando pidan auditar los datos o los reportes.
---

# Verificar números

Dos herramientas, en `tests/`:

| Herramienta | Qué revisa | Cuándo |
|---|---|---|
| `node tests/verificar.js [palabra]` | La **lógica**: la app real en Chromium con datos de resultado conocido y una nube falsa. Comprueba pantallas y reportes. | Antes de cada push/PR y al arreglar un bug |
| `node tests/revisar-datos.js respaldo.json [desde] [hasta]` | Los **datos reales**: una exportación de Firebase. Busca registros que hacen salir números mal. | Cuando un total no cuadra o para auditar un periodo |

Las dos terminan con código 0 si todo está bien y 1 si hay algo incorrecto. Ninguna toca la base real.

## 1. Pruebas de lógica (`tests/verificar.js`)

```bash
node tests/verificar.js              # todo (≈1-2 min)
node tests/verificar.js suplencias   # solo escenarios cuyo nombre contenga la palabra
```

Requisitos: Node y Playwright con Chromium. En la nube de Claude Code ya están (`require('playwright')` funciona en cualquier carpeta). En una compu: `npm install && npx playwright install chromium`.

Resultado por comprobación:
- `✔` correcto.
- `✖` número incorrecto → **no publicar** hasta arreglarlo (o hasta corregir la prueba si el error es de la prueba; confirmarlo leyendo el código, nunca ajustando el número esperado para que pase).
- `⚠` hallazgo conocido: el número es discutible y espera decisión del equipo. No hace fallar la corrida. Al arreglarlo pasa a `✔` solo.

### Cómo funciona

- `tests/lib/entorno.js` levanta un servidor local con el repo, abre Chromium y sustituye los scripts de Firebase (gstatic) por un **Firebase falso en memoria** (`FakeDB`) que vive en Node.
- `env.abrir(nombre, { hora, rol, instId })` abre un "dispositivo": la app real, con sesión iniciada (`_loginExitoso`), el reloj fijado en `hora` (zona de México) y conectada a la nube falsa. Varios dispositivos comparten la nube → se prueban guardados a la vez.
- `d.quitarSenal()` / `d.volverSenal()`: escrituras en cola y aplicadas al reconectar, como el SDK real.
- `env.db.sembrar({ 'fitness': {...}, 'gerencia_deportes/data/gimnasia': {...} })` carga datos; `env.db.leer('fitness/registros')` lee lo que quedó en la nube.
- `d.ev(fn, arg)` corre código dentro de la app (sus variables globales: `registros`, `instructores`, `renderAll`, `guardarRecorrido`…).

### Al arreglar un bug: primero la prueba

1. Agregar un `escenario(...)` en `tests/verificar.js` con datos mínimos donde el resultado correcto se calcule a mano, y anotar el cálculo en un comentario.
2. Correrlo y ver que **falla** con el código actual (si no falla, la prueba no reproduce el bug).
3. Arreglar el código y ver que pasa. Correr todo para ver que nada más se rompió.
4. Para comprobar que la prueba detecta el bug viejo: `git worktree add /tmp/viejo <commit>` , copiar `tests/` ahí y correrla.

Preferir manejar la app como lo hace la persona (las funciones de los botones: `guardarClase`, `turboGuardar`, `guardarRecorrido`, `eliminarRegistro`, `instCapAbrir` + clic en `#cp-guardar`, gestos táctiles en `#turbo-card`) en vez de modificar `registros` a mano, para que la prueba cubra el camino real.

### Qué cubre hoy

1. Resumen: horas (duración real), asistentes, faltas, suplencias; dashboard = reporte mensual = reporte de suplencias.
2. Hoy + gimnasia: una lista de Gerencia = un registro con la duración completa; cubre todas las horas de todas las profesoras del grupo (`regEnSlot`); las niñas se cuentan una vez.
3. Recorrido: actualizar el número conserva la suplencia (externa, o con suplente dado de baja), también deslizando.
4. Reporte de suplencias: avisa de las programadas que no cuentan y por qué.
5. Sincronización: dos dispositivos a la vez, uno sin señal, borrados que no regresan, mismos datos al final.
6. Portal: clase con suplencia programada se guarda como suplencia.
7. Ids únicos.

### Hallazgos conocidos (esperan decisión, no "arreglar" sin preguntar)

- **Aforo promedio del dashboard**: promedia por instructor y cuenta 0% a quien no tuvo clases en el periodo. Por clase daría otro número.
- **Horas de una suplencia**: se suman al titular (`inst_id`), no al suplente.
- **Reporte mensual**: cuenta 1 clase = 1 hora; el dashboard usa `dur`.

## 2. Revisión de datos reales (`tests/revisar-datos.js`)

1. Pedir la exportación: consola de Firebase → proyecto `fitness-campestre-e218c` → Realtime Database → menú ⋮ → **Exportar JSON**. (Contiene datos del club: no subirla al repo ni a ningún servicio; trabajarla en la carpeta temporal.)
2. `node tests/revisar-datos.js respaldo.json 2026-10-01 2026-10-31`

Reglas: `✖` duplicados (cuentan doble), día que no coincide con la fecha (la clase sale Pendiente), suplencia sin suplente o con suplente inexistente/igual al titular, instructor inexistente, estado desconocido, fecha/hora inválidas, asistentes negativos o > 150% del cupo, id distinto a su clave, borrado que regresó. `⚠` sobre el cupo, sin cupo, duración vacía o > 4 h, clase fuera del horario, sin `updatedAt`, gimnasia sin `ger_insts`, suplencias programadas que no cuentan.

Al reportar resultados a la persona: decir cuántos registros y qué periodo, los errores con ejemplos concretos (fecha, clase, instructor) y qué número de qué reporte alteran. No corregir datos reales sin que lo pida; proponer la corrección (normalmente desde Historial → Editar, en la app).

## Reglas de la lógica que las pruebas protegen

- Clase ↔ registro: por instructor + fecha + día + hora (`regEnSlot` en `core.js`); las listas de Gerencia cubren todo su bloque para las profesoras de `ger_insts`.
- Impartidas = estado `ok` o `sub`; faltas = `falta`; suplencias = `sub`. Horas = `dur`/60 (60 si falta).
- Subidas a la nube por ruta (`registros/<id>`), nunca reemplazando la colección; borrar = `marcarBorrado(col, id)` + quitarlo de la lista.
- Ids nuevos con `nuevoIdRegistro()`, nunca "el más alto + 1".
- Todo guardado pasa por `renderAll()` (guarda local, sube y redibuja, incluida la pantalla de inicio del celular).
- Al cambiar un `js/*.js`, subir su `?v=` en `index.html`.
