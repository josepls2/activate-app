# Estado de implementación

## Prototipo entregado

| Área | iOS | Android | Miniweb / Backend |
| --- | --- | --- | --- |
| Marca y logo de Activate | Sí | Sí | N/A |
| Login demo y cuatro roles | Sí | Sí | Usuarios de emulador |
| Sesiones filtradas por rol | Sí | Sí | Reglas Firestore |
| Duración por pack, 45/60 min | Sí | Sí | Validación confiable |
| Número de sesión del pack | Sí | Sí | Se guarda en sesión |
| Solicitud del cliente | Sí | Sí | `createBooking` |
| Propuesta del entrenador | Sí | Sí | `proposeBookingTime` |
| Confirmación de Dirección | Sí | Sí | Transacción y auditoría |
| Conflicto de sala/entrenador | Demo visual | Demo visual | Validado |
| Descuento al completar sesión | Sí | Sí | Actualización transaccional |
| Ocupación solo lectura | Sí | Sí | Reglas Firestore |
| Feedback y chat FAQ | Sí | Sí | Functions disponibles |
| Nutrición | Vista demo | Vista demo | Pendiente de modelo real |
| Ciclo menstrual | Registro local | Registro local | Pendiente de almacenamiento cifrado |
| Pack | Consulta | Consulta | Catálogo pendiente |
| Pagos dentro de la app | Excluido | Excluido | Excluido |
| Menores y responsable legal | Modelo y términos | Términos | Bloqueo sin responsable |
| Autorización de imagen | Estado separado | Estado separado | Campo de perfil |
| Alta de clientes por Dirección | N/A | N/A | Miniweb + `adminCreateClient` |
| Añadir sesiones al pack | Consulta | Consulta | Miniweb + `adminAddPackSessions` |

## Qué es demo y qué es producción

El código móvil actual permite recorrer y probar los flujos, pero sus datos
están en memoria. No es todavía una app publicable con clientes reales.

Antes de producción hay que:

- crear los proyectos Firebase de desarrollo, pruebas y producción;
- conectar iOS y Android al backend y retirar los datos demo en Release;
- conectar la miniweb al Firebase real y automatizar el email de primer acceso;
- definir los packs reales, su vigencia y política de consumo;
- revisar legalmente términos, privacidad, salud, menores e imagen;
- implementar notificaciones APNs/FCM y recordatorios;
- añadir tests de Firestore Rules, accesibilidad, carga y dispositivos reales;
- preparar TestFlight y Google Play Internal Testing;
- definir quién tendrá el rol Dirección y quién gestionará las altas.

## Decisiones aplicadas

- El producto visible se llama **Activate Personal Training**.
- El piloto solo contempla un centro.
- Las plataformas son iOS y Android; Windows se ha retirado.
- `boss` sigue siendo el identificador técnico del rol **Dirección**.
- `reserve` es el identificador técnico de colaboradores con consulta de salas.
- Los entrenamientos solo pueden durar 45 o 60 minutos.
- La duración se obtiene del perfil/pack del servidor, no del valor enviado por
  el móvil.
- No se compra ni se paga desde la app en esta fase.
- El tracker de ciclo es voluntario y privado; compartir el resumen requiere
  una acción expresa.
- Un menor no puede solicitar sesiones si falta el responsable legal.
