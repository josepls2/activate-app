# Configuración de Firebase

## 1. Estado del proyecto piloto

Proyecto Firebase conectado: `activayte-34e0b`.

- Firestore `(default)` creado en `europe-southwest1` (Madrid), edición
  Standard y protección contra borrado activada.
- Email/Password activado en Firebase Authentication.
- Apps registradas para Web, iOS y Android.
- `GoogleService-Info.plist`, `google-services.json` y `.env.local` instalados
  localmente y excluidos de Git.
- Reglas e índices actuales desplegados el 29 de julio de 2026.
- Documentos `rooms/upstairs`, `rooms/downstairs` y `rooms/physio` creados con
  los nombres `Sala de arriba`, `Sala de abajo` y `Sala de fisio`.
- El proyecto se mantiene deliberadamente en Spark. Las Cloud Functions quedan
  preparadas para una fase futura, pero no forman parte del piloto sin
  facturación.
- Acceso al proyecto verificado con la cuenta Google
  `joseplopezsole22@gmail.com`.

Para producción definitiva siguen siendo recomendables proyectos separados para
desarrollo, staging y producción.

## 2. Proteger los proyectos

1. Crea proyectos Firebase separados para desarrollo, staging y producción,
   todos bajo una cuenta propiedad de Activate.
2. Para el piloto sin coste, conserva Spark sin vincular una cuenta de
   facturación y revisa las cuotas de uso de Firestore. Si más adelante se
   decide desplegar Cloud Functions, habrá que aprobar expresamente Blaze.
3. Activa **Authentication > Sign-in method > Email/Password**.
4. Crea Firestore en una región europea. La ubicación no se puede cambiar
   después.
5. Registra tres aplicaciones:
   - iOS: `com.activatepersonaltraining.app`;
   - Android: `com.activatepersonaltraining.app`;
   - Web: panel privado de Dirección.
6. Limita los permisos IAM: dos propietarios como máximo, cuentas nominales,
   2FA y nada de credenciales compartidas.

Firebase Auth emite y renueva sus tokens. No se guardan contraseñas ni se
implementa un segundo sistema JWT.

## 3. Ver la base de datos

### Producción o staging

1. Abre <https://console.firebase.google.com/>.
2. Selecciona el proyecto correcto.
3. Entra en **Databases & Storage > Firestore Database > Data**.
4. Las colecciones principales serán `users`, `bookings`, `sessions`, `rooms`,
   `feedback`, `faqMessages` y `activityLogs`.
5. Usa **Authentication > Users** para ver las cuentas de acceso. La contraseña
   nunca se puede consultar.
6. Usa **Firestore > Rules**, **Indexes** y **Usage** para revisar permisos,
   índices y consumo.

Mientras el proyecto permanezca en Spark, el alta inicial de cuentas, roles y
packs debe hacerse mediante el flujo Spark que se implemente o, temporalmente,
desde Firebase Console. No se deben abrir estos campos a escrituras arbitrarias
de clientes.

### Entorno local

Arranca los emuladores:

```bash
npx firebase emulators:start --only auth,functions,firestore
```

Después abre <http://127.0.0.1:4000>. La interfaz del emulador permite ver Auth,
Firestore y los registros de Functions sin tocar datos reales.

## 4. Backend futuro con Blaze

Desde la raíz:

```bash
npm --prefix functions install
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,functions
```

Firestore y las Functions preparadas usan `europe-southwest1` (Madrid).

Las operaciones privilegiadas del panel son:

- `adminCreateClient`: crea Auth, perfil, pack inicial, tutor si procede y
  auditoría;
- `adminAddPackSessions`: suma sesiones al pack con validación y auditoría.

Estas Functions no se despliegan mientras Activate mantenga Spark. Antes del
piloto se deben sustituir sus llamadas por transacciones de Firestore
restringidas por reglas, o mantener esas operaciones como gestión manual de
Dirección.

Las reglas e índices actuales ya están publicados. No existe ninguna cuenta de
facturación vinculada por esta configuración.

## 5. Crear la primera cuenta de Dirección

Es el único alta manual necesaria:

1. En **Authentication > Users**, crea el email del jefe.
2. Copia su `uid`.
3. En **Firestore > Data**, crea `users/{uid}` con:

```text
uid:              el uid copiado
email:            el email de Dirección
name:             el nombre visible
role:             boss
isTrainer:        true
status:           active
```

Roger puede ser la primera cuenta `boss` con `isTrainer: true`; no necesita una
segunda cuenta. Crea Tobias y Domi con `role: trainer` e `isTrainer: true`.
5. Inicia sesión en la miniweb. A partir de ahí, los clientes se crean desde el
   panel, no desde Firebase Console.

En producción conviene actualizar el envío del enlace de configuración de
contraseña para que salga automáticamente desde el email corporativo.

## 6. Conectar la miniweb

1. En **Project settings > General > Your apps**, abre la aplicación Web y
   copia su objeto de configuración.
2. Copia `admin-web/.env.example` como `admin-web/.env.local`.
3. Rellena las variables `NEXT_PUBLIC_FIREBASE_*`.
4. Añade el dominio definitivo en
   **Authentication > Settings > Authorized domains**.
5. Ejecuta:

```bash
cd admin-web
npm install
npm test
npm run dev
```

Sin esas variables, el panel queda bloqueado. No existe modo demostración ni
credenciales incorporadas al código.

La configuración pública de Firebase no es una contraseña. En el piloto Spark,
la protección real la forman Authentication, Firestore Rules, App Check e IAM.
Nunca se debe incluir una cuenta de servicio o clave privada en la web.

## 7. Conectar iOS

1. `GoogleService-Info.plist` ya está añadido al target iOS.
2. Auth, Firestore, Functions y App Check están añadidos con Swift Package
   Manager.
3. App Check se configura antes de `FirebaseApp.configure()`: proveedor de
   depuración en Debug y App Attest en Release.
4. El login y la lectura de perfil/rol ya usan Firebase. Sustituye las llamadas
   obligatorias a Functions por transacciones Firestore autorizadas para el
   piloto Spark.
5. Mantén Face ID/Touch ID como desbloqueo local de una sesión ya autenticada,
   nunca como asignación de rol.
6. Registra la app iOS en App Check y aplica enforcement sólo después de
   validar tokens en un dispositivo firmado.

## 8. Conectar Android

1. `google-services.json` ya está instalado en `android/app/`.
2. Los plugins y SDK de Auth, Firestore y App Check ya están en Gradle; el SDK
   de Functions permanece instalado pero no debe ser obligatorio en Spark.
3. El login y la lectura de perfil/rol ya usan Firebase. Sustituye los datos
   locales restantes de `DemoStore` por repositorios y transacciones de
   Firestore compatibles con Spark.
4. Mantén la lógica de roles y transiciones sensibles en el backend.
5. Registra la huella SHA-256 de Play App Signing en App Check y aplica
   enforcement sólo después de validar el canal interno.

Los archivos de configuración móviles y `.env.local` están ignorados por Git.

## 9. App Check, notificaciones y operación

- iOS: App Attest/DeviceCheck.
- Android: Play Integrity.
- Web: reCAPTCHA Enterprise.
- Activa primero las métricas de App Check; aplica enforcement cuando todas las
  versiones reales ya envíen tokens válidos.
- Para notificaciones iOS, sube una clave APNs a Firebase; usa FCM también en
  Android.
- Activa Crashlytics y revisa las cuotas de Firestore. Las copias programadas,
  restauraciones administradas y alertas de facturación no están disponibles
  en el piloto Spark.

## 10. Pagos

Los pagos quedan fuera del piloto. Dirección solo añade sesiones después de
comprobar un cobro realizado fuera de la app; el panel no guarda tarjeta,
precio ni medio de pago. Esto reduce el alcance técnico, pero no sustituye las
obligaciones contables o fiscales de los cobros externos.
