# Política de seguridad del proyecto

No subas `GoogleService-Info.plist`, `google-services.json`, cuentas de
servicio, tokens ni archivos `.env`. Los patrones correspondientes ya están en
`.gitignore`.

## Principios aplicados

- Denegación por defecto en Firestore.
- Rol administrativo canónico `boss`.
- Un cliente solo lee sus sesiones y solicitudes.
- Un entrenador solo lee sus propios clientes y únicamente puede completar sus
  sesiones confirmadas.
- `reserve` no puede leer datos de clientes ni modificar ocupación.
- Las reservas se crean, proponen, confirman y rechazan mediante funciones
  confiables.
- La confirmación comprueba solapamientos de entrenador y sala dentro de la
  transacción.
- Cada mutación sensible crea un documento de auditoría.
- El seed solo funciona contra emuladores declarados explícitamente.
- La duración de una reserva se toma del pack del servidor y solo admite 45/60.
- Un menor no puede reservar sin responsable legal asociado.
- Los datos del ciclo se consideran datos de salud y no se comparten por defecto.
- La autorización de imagen se registra separada de los términos del servicio.

## Reporte

Si encuentras una vulnerabilidad, no abras un issue público con datos reales.
Comunícala al propietario del repositorio con pasos de reproducción mínimos y
sin incluir credenciales.

## Dependencias

Auditoría realizada el 27 de julio de 2026:

- dependencias desplegadas: 0 avisos críticos, 0 altos y 9 moderados;
- los avisos moderados son transitivos de Firebase Admin/Google Cloud;
- `npm audit fix --force` propone degradar versiones principales y no debe
  ejecutarse sin validar compatibilidad;
- debe repetirse la auditoría antes de cada despliegue y actualizar cuando el
  árbol oficial de Firebase publique correcciones compatibles.
