# Activate · Web app

App principal de Activate Personal Training (sustituye a la app de iOS) para
los cuatro roles —cliente, entrenador, Dirección y usuario de sala—. Usa el
proyecto Firebase `activayte-34e0b` en plan **Spark** (sin Cloud Functions).

Se puede abrir en cualquier navegador y, en el iPhone, instalar como app:
Safari → **Compartir** → **Añadir a pantalla de inicio**.

## Arrancar en local

Requisitos: Node.js 20 o superior. No hace falta configurar nada: la
configuración pública de Firebase ya va en `src/lib/firebase.ts`.

```bash
cd web
npm install
npm run dev
```

Abre <http://127.0.0.1:5173>.

### Modo demo (sólo en `npm run dev`)

Para revisar pantallas sin tocar datos reales:

- <http://127.0.0.1:5173/?demo=client>
- <http://127.0.0.1:5173/?demo=trainer>
- <http://127.0.0.1:5173/?demo=boss>
- <http://127.0.0.1:5173/?demo=reserve>
- <http://127.0.0.1:5173/?demo=new> (bienvenida del primer acceso)

El modo demo no se incluye en la versión publicada.

## Publicar en GitHub (sin usar el comando `firebase`)

GitHub hace todo en cada `push`:

| Workflow | Qué hace |
| --- | --- |
| `web.yml` | Compila la web y la publica en GitHub Pages |
| `firebase-rules.yml` | Prueba las reglas con el emulador y, si pasan, publica reglas e índices en Firebase |
| `notifier.yml` | Cada 20 min envía las notificaciones push |

### Paso a paso (una sola vez)

1. **Crea el repositorio** en GitHub, por ejemplo `activate-app`, **público**
   (GitHub Pages gratis sólo funciona con repositorios públicos; no hay
   secretos en el código: la configuración de Firebase es pública por diseño y
   la seguridad la dan las reglas). Desde la carpeta del proyecto:

   ```bash
   cd ~/Documents/"Aplicacio Activate"
   git add .
   git commit -m "Web app de Activate"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/activate-app.git
   git push -u origin main
   ```

2. **Activa Pages** — en el repositorio: Settings → Pages → *Build and
   deployment* → Source: **GitHub Actions**. Luego Actions → «Web (GitHub
   Pages)» → *Run workflow*. La web quedará en
   `https://TU_USUARIO.github.io/activate-app/`.

3. **Autoriza el dominio en Firebase** — Firebase Console → Authentication →
   Configuración → *Dominios autorizados* → añade `TU_USUARIO.github.io`.

4. **Cuenta de servicio** (para reglas y notificaciones) — Google Cloud
   Console (proyecto `activayte-34e0b`) → IAM y administración → Cuentas de
   servicio → *Crear cuenta de servicio* `activate-github`, con estos roles:
   - Usuario de Cloud Datastore
   - Administrador de índices de Cloud Datastore
   - Administrador de reglas de Firebase
   - Administrador de la API de Firebase Cloud Messaging
   - Consumidor de Service Usage

   Entra en la cuenta → *Claves* → *Agregar clave* → *JSON*. Se descarga un
   archivo: **no lo guardes en la carpeta del proyecto**.

5. **Guarda la clave en GitHub** — Settings → Secrets and variables →
   Actions → *New repository secret*: nombre `FIREBASE_SERVICE_ACCOUNT`, valor
   = todo el contenido del JSON. Después Actions → «Reglas de Firestore» →
   *Run workflow*.

6. **Notificaciones push** (opcional) — Firebase Console → Configuración del
   proyecto → Cloud Messaging → *Certificados push web* → *Generar par de
   claves*. En GitHub: Settings → Secrets and variables → Actions → pestaña
   **Variables** → `VITE_FCM_VAPID_KEY` = la clave. Vuelve a ejecutar «Web
   (GitHub Pages)».

A partir de ahí, cada `git push` publica los cambios solo.

> Si usas un dominio propio en Pages, crea la variable `BASE_PATH` con valor
> `/` y añade ese dominio en el paso 3.

## Qué hace cada rol

La jerarquía no cambia: **Dirección > entrenador > cliente**, y el **usuario
de sala** sólo reserva salas. Los pagos no se gestionan en la app.

- **Cliente**
  - *Inicio*: próxima sesión, objetivo semanal de clases (anillo de progreso),
    racha de semanas cumplidas, historial de 8 semanas, insignias, retos y
    consejo del día.
  - *Entrenos*: pide sesiones, retira solicitudes pendientes y cancela él
    mismo con más de 24 h (la sesión vuelve al bono). Con menos margen, chat.
  - *Retos*: retos semanales con check-in diario o contador, nota para el
    entrenador y feedback semanal; *Clasificación* semanal opcional (sólo nombre
    e inicial; sesiones = 10 pts + puntos de retos aprobados).
  - *Chat* tipo WhatsApp con su equipo de entrenadores: nombre de quien
    escribe, separadores por día, ✓ enviado / ✓✓ leído, responder citando,
    copiar y eliminar para todos (la primera hora).
  - Plan nutricional, consejos de vida sana y (si Dirección lo activa) ciclo.
  - *Perfil*: ajustes agrupados (cuenta, entrenamiento, notificaciones,
    privacidad, ayuda, instalar la app).
- **Entrenador**
  - *Hoy*: sesiones de hoy, solicitudes, retos por revisar, clientes sin venir
    en 14 días (con botón para escribirles) y top de la clasificación.
  - Confirma/rechaza solicitudes, completa sesiones con feedback o marca
    «No se presentó».
  - Crea retos para sus clientes (plantillas), da feedback semanal y aprueba
    retos (suma puntos).
  - *Ficha* de cada cliente: asistencia, racha, bono, próximas sesiones, retos y
    **notas privadas** (sólo las ven sus entrenadores y Dirección).
  - *Chats*: bandeja con buscador, no leídos y todos sus clientes (puede
    empezar la conversación él), respuestas rápidas, acceso a la ficha desde el
    chat y botón «Escribir a…» en cada sesión.
  - Publica consejos y planes nutricionales.
- **Dirección**: todo lo anterior, más retos para todo el centro, **alta
  guiada en 3 pasos** (datos → bono con paquetes 5/10/20 o personalizado y
  entrenadores → confirmar), bonos, cambio de entrenadores, reprogramar o
  cancelar sesiones, activar el acceso de los entrenadores y tramitar bajas.
- **Usuario de sala**: consulta la ocupación, solicita salas con su bono y
  retira solicitudes pendientes.

El primer acceso de clientes y usuarios de sala muestra una bienvenida:
términos (+ imagen), objetivo semanal y clasificación, y notificaciones.

### Datos nuevos en Firestore

| Colección | Contenido | Quién escribe |
| --- | --- | --- |
| `challenges` | Retos por semana (`weekKey` = lunes) | Dirección (todo el centro) o entrenador (sus clientes) |
| `challengeProgress/{reto}_{cliente}` | Progreso, nota, feedback, aprobado | Cliente (progreso) y su entrenador/Dirección (feedback) |
| `leaderboard/{semana}_{cliente}` | Sesiones y puntos de la semana | Se actualiza al completar sesiones o aprobar retos |
| `tips` | Consejos publicados por el equipo | Entrenadores y Dirección |
| `trainerNotes/{cliente}` | Notas privadas del cliente | Sus entrenadores y Dirección |

## Reglas de Firestore (importante)

La web usa `../firestore.rules` y `../firestore.indexes.json`. Se publican
solos con el workflow «Reglas de Firestore» al hacer push (ver arriba), después
de pasar los tests de `tests/` con el emulador.

Si alguna vez necesitas hacerlo a mano sin el comando `firebase`: Firebase
Console → Firestore Database → **Reglas** → pega el contenido de
`firestore.rules` → *Publicar*.

Lo que garantizan, además de los permisos por rol:

- El saldo de un bono sólo cambia en la misma operación que crea, completa o
  cancela la sesión correspondiente (nadie puede tocar saldos sueltos, salvo
  Dirección al añadir bonos).
- Una sesión confirmada copia exactamente la solicitud (fecha, entrenador,
  sala, duración) y los bloqueos de ocupación coinciden con su hora real.
- Las solicitudes no admiten fechas pasadas, horas mal formadas ni campos extra.
- Los mensajes no se pueden enviar en nombre de otra persona.
- Un cliente sólo puede cancelar su propia sesión con más de 24 h, y en la
  misma operación se le devuelve la sesión al bono.
- Los retos, su progreso y la clasificación siguen la jerarquía: el cliente
  sólo toca su progreso y su visibilidad; el feedback, la aprobación y los
  puntos son del entrenador asignado o de Dirección. Quien no se apunta a la
  clasificación no aparece para los demás.

`admin-web` sigue siendo compatible. **La app de iOS ya no**: sus
confirmaciones fallarán con estas reglas (ya no se usa).


## Notificaciones

- **Con la app abierta** (también en segundo plano): avisos al instante de
  solicitudes nuevas, confirmaciones, cancelaciones, reprogramaciones, mensajes
  y planes de nutrición. Puntos rojos en Chat y Reservas cuando hay pendientes.
- **Con la app cerrada (push)**: requiere la variable `VITE_FCM_VAPID_KEY`
  (paso 6) y el secreto de la cuenta de servicio (paso 5); el envío lo hace
  `../notifier` desde GitHub Actions. Incluye recordatorio de
  cada sesión en las 24 h previas.
- Cada persona las activa en **Perfil → Notificaciones**. En iPhone hace falta
  añadir la web a la pantalla de inicio (iOS 16.4+).

## Alternativa: Firebase Hosting

`firebase.json` también deja preparada la publicación en
`https://activayte-34e0b.web.app` con cabeceras de seguridad (requiere el
comando `firebase`):

```bash
npm run build && npx firebase-tools deploy --only hosting
```

## Seguridad

- Política de seguridad de contenido (CSP) estricta: en GitHub Pages va como
  `<meta>` en la página (lo añade `vite.config.ts` al compilar); en Firebase
  Hosting, además, como cabeceras (`firebase.json`).
- Las altas de clientes y entrenadores usan una sesión secundaria en memoria:
  la cuenta nueva nunca queda guardada en el navegador de Dirección.
- «Mantener la sesión en este dispositivo» desactivado = la sesión se borra al
  cerrar la pestaña (para ordenadores compartidos).
- La recuperación de contraseña no revela si un email tiene cuenta.
- Cuentas desactivadas o con baja solicitada no pueden entrar.
- El directorio del equipo (con emails) ya no es visible para clientes.
- Recomendado en Google Cloud Console → Credenciales: restringe la API key de
  la app web a tus dominios (`TU_USUARIO.github.io/*`, `localhost:5173/*`).
- Recomendado en Firebase Console → Authentication → Configuración: activa la
  protección contra enumeración de emails.

### App Check (opcional)

1. Firebase Console → App Check → registra la app web con reCAPTCHA Enterprise.
2. En GitHub → Settings → Secrets and variables → Actions → Variables:
   `VITE_APPCHECK_SITE_KEY` = la clave.
3. Vuelve a ejecutar «Web (GitHub Pages)». Cuando las métricas sean correctas, activa la
   aplicación obligatoria de App Check en Firestore.

## Equivalencias con iOS

| iOS (SwiftUI) | Web (React) |
| --- | --- |
| `Data/AppStore.swift` | `src/lib/store.ts` |
| `Models/DomainModels.swift` + `Theme.swift` | `src/lib/domain.ts` + `src/styles.css` |
| `Views/Components.swift` | `src/ui.tsx` |
| `ContentView.swift` (pestañas, toast) | `src/App.tsx` |
| `Views/*View.swift` | `src/views/*View.tsx` |
| `DeviceCalendarService.swift` (EventKit) | `src/lib/calendar.ts` (descarga `.ics`) |
| `BiometricCredentialStore` (Face ID) | Sesión persistente de Firebase en el navegador |
| — (no existía) | Notificaciones: `src/lib/notifications.ts`, `public/sw.js`, `../notifier` |

Diferencias deliberadas:

- **Face ID / Touch ID**: no existe en web. La sesión queda abierta en el
  dispositivo hasta pulsar «Cerrar sesión».
- **Calendario**: «Añadir a mi calendario» descarga un `.ics` que el iPhone,
  Android o el ordenador abren con su calendario.
- **Rango de Dirección**: «Personalizado» (sin función en iOS) pasa a ser
  «Todo».
- **Horas**: si la hora preseleccionada está ocupada, se elige la primera libre.
- En escritorio la barra de pestañas pasa a ser un menú lateral.
- Añadido respecto a iOS: el entrenador responde en el chat (bandeja de
  conversaciones), publica planes de nutrición, y Dirección activa accesos de
  entrenadores, cambia entrenadores de un cliente y tramita bajas.
- Las consultas descargan sólo los últimos 90 días de sesiones (y la ocupación
  desde ayer) en vez de todo el historial.

## Estructura

```text
web/
├── index.html            Meta PWA e iconos
├── public/               Logo, iconos, manifest y service worker
├── src/
│   ├── main.tsx
│   ├── App.tsx           Navegación por rol
│   ├── ui.tsx            Componentes compartidos
│   ├── styles.css        Tema oscuro de Activate
│   ├── lib/
│   │   ├── firebase.ts   Inicialización (+ app secundaria para altas)
│   │   ├── store.ts      Estado, listeners y transacciones
│   │   ├── domain.ts     Tipos y utilidades
│   │   ├── engagement.ts Rachas, insignias, inactivos y consejos
│   │   ├── calendar.ts   Exportación .ics
│   │   └── demo.ts       Datos ficticios (sólo desarrollo)
│   └── views/            Una pantalla por archivo
├── tests/                Tests de firestore.rules (emulador)
├── firebase.json         Firebase Hosting (alternativa)
└── .firebaserc
```
