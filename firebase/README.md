# Seguridad de Firebase (Fitness Control)

Proyecto: `fitness-campestre-e218c` · Realtime Database.

Hasta ahora la base aceptaba lecturas y escrituras **sin ninguna sesión**: bastaba la apiKey
(que es pública porque la app está en GitHub Pages) para leer todo o borrarlo.
Desde esta versión la app inicia una **sesión anónima de Firebase** en cada equipo antes de
conectarse, y `database.rules.json` exige esa sesión.

## Qué protege y qué no

| Protege | No protege todavía |
|---|---|
| Lecturas y escrituras sin sesión (curl, scripts, buscadores de bases abiertas) | Alguien que lea el código, cree su propia sesión anónima con la apiKey y escriba |
| Volver a guardar PIN en texto plano (`instructores/*/pin` se rechaza) | Distinguir coordinación de instructores: todos los equipos con sesión pueden escribir |
| Contraseñas de acceso con formato inválido en `fitness/cfg/acceso` | Borrado total desde un equipo con sesión |

Restringir la apiKey al dominio (paso 4) cierra buena parte de la segunda columna desde otros
sitios. La separación por rol (solo coordinación cambia instructores y contraseñas) requiere
que coordinación entre con una cuenta de Firebase (correo y contraseña) y que la app escriba
por ruta (lote 3); se deja para después.

## Pasos, en este orden

> ⚠ No publiques las reglas antes del paso 2: los equipos con la versión anterior de la app
> no tienen sesión y quedarían sin poder leer ni guardar.

1. **Activar el acceso anónimo**
   Firebase Console → proyecto *fitness-campestre-e218c* → **Authentication** →
   *Comenzar* (si es la primera vez) → pestaña **Sign-in method** → **Anónimo** → Habilitar → Guardar.

2. **Publicar esta versión de la app y esperar a que todos la tengan**
   Fusionar la rama a `main` (GitHub Pages la publica en 1–2 minutos). Cada teléfono toma la
   versión nueva la siguiente vez que abre la app con internet. Pide a coordinación e
   instructores que la abran una vez; conviene esperar **un día**.
   Para comprobarlo: Authentication → **Users** debe ir mostrando usuarios *anónimos*,
   uno por equipo.

3. **Publicar las reglas**
   Realtime Database → pestaña **Reglas** → reemplazar todo por el contenido de
   `database.rules.json` → **Publicar**.
   Antes de publicar copia las reglas actuales a un archivo por si hay que regresar.
   Si algo falla, en la app el indicador dirá *"Sin permiso para leer la nube"*: vuelve a pegar
   las reglas anteriores y avísame.

4. **Restringir la apiKey al sitio**
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=fitness-campestre-e218c)
   → Credenciales → la clave **Browser key (auto created by Firebase)** →
   *Restricciones de aplicaciones*: **Sitios web** → agregar
   `https://cfitnesscampestre-star.github.io/*` → Guardar.
   (Si alguna vez usas la app desde otro dominio, agrégalo también.)

5. **Dominios autorizados**
   Authentication → **Settings** → *Authorized domains* → comprobar que esté
   `cfitnesscampestre-star.github.io`.

## Nodos que usa la app

- `fitness/…` — datos principales (instructores, registros, recorridos, suplencias, firmas activas,
  agenda, eventos, `cfg/acceso`, `notif_tokens`, `firmasSuplencias`).
- `fc_sup_firmas/…` — hoja y firmas de suplencias.

Los módulos de Gerencia, Metodología y Mantenimiento usan **otros** proyectos de Firebase;
estas reglas no los afectan.
