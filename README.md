# Activate Personal Training

Piloto para un único centro. La aplicación principal es la **web app**
(`web/`), instalable en el móvil, con un rol por cuenta (cliente, entrenador,
Dirección y usuario de sala) y Firebase (`activayte-34e0b`, plan Spark) como
backend. Las notificaciones push con la app cerrada las envía `notifier/`.
La app de iOS ya no se utiliza. No incluye pagos dentro de la app.

**Empieza por [`web/README.md`](web/README.md).**

> Lo que sigue describe el piloto original (iOS/Android) y se conserva como
> referencia.

## Qué incluye

- Acceso Firebase por email y contraseña; el rol lo asigna la cuenta y no se
  puede elegir en la pantalla de entrada.
- Calendario filtrado según el rol.
- Sesiones de 45 o 60 minutos según el pack del cliente.
- Número de sesión dentro del pack y sesiones disponibles.
- El cliente elige día, hora, sala y uno de sus entrenadores asignados; su
  entrenador confirma directamente la solicitud.
- El usuario de sala solicita `Sala de arriba`, `Sala de abajo` o
  `Sala de fisio`; Dirección confirma y gestiona su bono.
- Detección en backend de solapamientos de sala y entrenador.
- Equipo del piloto:
  - entrenadores: Roger, Tobias y Domi;
  - fisioterapeuta: Xavi;
  - alquiler de sala: Lydia y Adrià;
  - alquiler de saleta de fisio: Eleonora.
- Consulta anónima de horas ocupadas para todos los roles, sin datos del cliente.
- Feedback, chat con FAQ, nutrición orientativa y tracker de ciclo privado.
- Términos, autorización de imagen y base de consentimiento para menores.
- Reglas Firestore cerradas por defecto, funciones transaccionales y auditoría.
- Pestaña exclusiva de Dirección para dar de alta clientes, asignar varios
  entrenadores, crear usuarios de sala y añadir bonos.
- Roger puede usar una sola cuenta como Dirección y entrenador.
- El ciclo sólo aparece en cuentas de clientas habilitadas y su resumen sólo se
  comparte voluntariamente con entrenadores asignados.
- Aceptación versionada de términos y autorización de imagen independiente.
- Exportación de sesiones confirmadas al calendario de Apple o Android.

El proyecto Firebase objetivo es `activayte-34e0b`. Los archivos de
configuración Web/iOS/Android están instalados y el backend está preparado.
iOS ya usa listeners de Firestore; Android autentica y lee el perfil/rol, pero
aún conserva datos operativos locales y no está listo para publicación.
Email/Password está activo, las reglas e índices actuales están desplegados y
las tres salas están creadas. El proyecto se mantiene en Spark sin facturación:
las Cloud Functions se conservan para una fase futura, pero los flujos de
escritura privilegiados deben adaptarse a Spark antes del piloto real.

## Estructura

```text
.
├── web/                    Web app principal (React + Firebase)
├── notifier/               Notificaciones push sin Cloud Functions
├── ios/                    SwiftUI, iOS 17+ (ya no se usa)
├── android/                Kotlin + Jetpack Compose, Android 8+
├── admin-web/              Miniweb privada de Dirección
├── functions/              Firebase Cloud Functions, Node.js 22
├── firestore.rules         Autorización por rol y recurso
├── firestore.indexes.json
└── docs/
```

## Probar iOS

Requisitos: Xcode 26.2 o superior y iOS 17 o superior.

1. Abre `ios/CodexGym.xcodeproj`.
2. Selecciona el esquema técnico `CodexGym`.
3. Conecta y desbloquea el iPhone, confía en este Mac y selecciónalo en la barra
   superior.
4. Ejecuta con `⌘R`; el nombre visible de la app es **Activate**.

### Estructura en Xcode

- `Main.storyboard`: entrada visual de UIKit y controlador raíz.
- `CodexGymApp.swift`: `UIApplicationDelegate` marcado con `@main`.
- `RootViewController.swift`: aloja la interfaz SwiftUI adaptable.
- `ContentView.swift`: decide entre el acceso y la aplicación autenticada.
- `MainView`, dentro de `ContentView.swift`: reúne la navegación hacia todas
  las vistas disponibles para la cuenta.
- `Views/`: contiene cada pantalla independiente.
- `Data/AppStore.swift`: mantiene el estado y asigna el rol según la cuenta
  autenticada. El usuario no puede elegir sus permisos en el login.

### Probar Face ID

1. Entra por primera vez con una cuenta Firebase real. La app guarda únicamente
   el UID en el Keychain protegido; nunca guarda la contraseña.
2. Cierra completamente la app sin pulsar `Cerrar sesión` y vuelve a abrirla.
   En la pantalla de acceso aparecerá
   `Acceder con Face ID`.
3. Pulsa el botón y valida Face ID o Touch ID en el dispositivo. Configura tu
   equipo de firma en `Signing & Capabilities` antes de ejecutar con `⌘R`.

Si Xcode solicita aceptar la licencia:

```bash
sudo xcodebuild -license
```

Después se puede ejecutar:

```bash
xcodebuild \
  -project ios/CodexGym.xcodeproj \
  -scheme CodexGym \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO \
  test
```

## Probar Android

Requisitos: Android Studio, JDK 21 y Android SDK 36. El proyecto incluye
`android/.java-version` para fijar Java 21; Java 25 todavía no es compatible con
esta combinación de Gradle/Kotlin.

Abre la carpeta `android/` en Android Studio y ejecuta el módulo `app`, o usa:

```bash
cd android
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  ./gradlew testDebugUnitTest assembleDebug
```

El APK de desarrollo se genera en
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Backend y tests

Los tests puros no necesitan Firebase:

```bash
npm test
npm run lint
```

Para probar Auth, Functions y Firestore localmente:

```bash
cd functions
npm install
cd ..
npx firebase emulators:start --only auth,functions,firestore
```

En otra terminal:

```bash
export GCLOUD_PROJECT=activate-local
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
npm --prefix functions run seed
```

El seed se niega a ejecutarse si no detecta los tres valores de emulador.

## Probar la miniweb

```bash
cd admin-web
npm install
npm run dev
```

Abre <http://127.0.0.1:3000>. El archivo local `.env.local` ya contiene la
configuración pública del proyecto Firebase real y está excluido de Git. Sin
configuración, el panel queda bloqueado: no existe acceso demo, registro público
ni selector de rol. Firebase obtiene el rol `boss` de la cuenta autenticada.

La web permite crear clientes, asignar Roger/Tobias/Domi, indicar packs de 45 o
60 minutos, registrar tutor de un menor y añadir sesiones. No contiene cobros,
precios ni datos de tarjeta.

Antes de un piloto con datos reales, revisa
[lo que falta para producción](docs/NEXT_STEPS.md),
[la configuración de Firebase](docs/FIREBASE_SETUP.md) y
[el checklist de producción](docs/PRODUCTION_CHECKLIST.md). Las decisiones
concretas que debe confirmar Activate están en
[confirmación del cliente y producción](docs/CLIENT_CONFIRMATION_AND_PRODUCTION.md).
