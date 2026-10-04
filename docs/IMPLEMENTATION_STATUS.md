# Estado de implementación

Actualizado: 29 de julio de 2026.

| Área | iOS | Android | Backend |
| --- | --- | --- | --- |
| Login y rol desde Firebase | Implementado | Implementado | Auth + perfil Firestore |
| Main.storyboard | Implementado | No aplica | — |
| Face ID / Touch ID | Implementado | Pendiente biometría Android | Sesión Firebase existente |
| Sesiones y reservas reales | Lectura Firestore; escritura aún usa Functions | Datos operativos aún demo | Functions probadas, no desplegadas |
| Cliente con varios entrenadores | Implementado | Pendiente de paridad | Validado |
| Roger jefe + entrenador | Una cuenta con `isTrainer` | Perfil leído | Validado |
| Confirmación de entrenamiento | Entrenador asignado o Dirección | Flujo visual corregido | Transacción |
| Reserva con bono de sala | Implementado | Pendiente de paridad | Transacción + devolución |
| Tres salas, incluida Sala de fisio | Implementado | Implementado visualmente | Validado |
| Horas ocupadas rojas/tachadas | Implementado | Pendiente de paridad | Ocupación anónima |
| Alta de clientes y usuarios de sala | Pestaña Dirección; requiere adaptación Spark | Pendiente | Function no desplegada |
| Añadir bonos | Pestaña Dirección; requiere adaptación Spark | Pendiente | Function no desplegada |
| Mover/cancelar horarios | Dirección; requiere adaptación Spark | Pendiente | Functions no desplegadas |
| Sesiones restantes en inicio | Implementado | Implementado visualmente | Perfil/pack |
| Calendario Apple/Android | Implementado | Implementado | — |
| Ciclo sólo en clientas habilitadas | Implementado | Visibilidad implementada | Campo protegido |
| Resumen del ciclo al entrenador asignado | Implementado | Pendiente | Reglas preparadas |
| Aceptación de términos e imagen | Implementado | Pendiente | Consentimiento auditado |
| Eliminación de cuenta | Implementado | Pendiente | Function |
| App Check | Debug + App Attest integrados | Debug + Play Integrity integrados | Enforcement pendiente |

## Comprobaciones superadas

- iOS compila para `generic/platform=iOS` sin simulador y sin firma.
- `Main.storyboard` es la entrada real de UIKit y aloja la interfaz SwiftUI
  adaptable.
- Android compila y supera sus tests unitarios con las dependencias oficiales
  de App Check.
- Backend: 11 tests superados y análisis sintáctico correcto.
- Firebase: Email/Password activo, reglas e índices actuales desplegados y
  documentos de las tres salas creados.

## Lo que impide llamarlo producción

- Por decisión de Activate el proyecto continuará en Spark. Cloud Functions no
  se pueden desplegar; las escrituras privilegiadas de iOS deben migrarse a un
  flujo compatible con Spark antes de probar con usuarios reales.
- Faltan correos reales y creación de las cuentas del equipo.
- No existe una identidad de firma Apple válida configurada en este Mac.
- El iPhone 16 detectado no está conectado/desbloqueado.
- Android todavía usa datos locales para la operativa y no debe subirse a Play
  hasta completar su paridad Firebase.
- Los textos legales, packs y reglas de cancelación siguen pendientes de
  aprobación de Activate y revisión profesional.
- App Check todavía no debe ponerse en modo obligatorio: primero hay que
  registrar las apps firmadas y comprobar sus métricas.

La miniweb queda como herramienta opcional. La gestión principal se ha
integrado en la app iOS y se protege también en el servidor.
