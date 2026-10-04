# Confirmación de Activate y salida a producción

Estado actualizado: 29 de julio de 2026.

## Decisiones ya incorporadas

- Una sola aplicación iOS/Android; el rol procede de Firebase.
- Dirección ve toda la operativa, puede mover horarios, crear clientes y añadir bonos.
- Roger puede ser Dirección y entrenador con una única cuenta protegida.
- Cada cliente puede tener más de un entrenador.
- Cada entrenador ve sus clientes, su agenda y las horas ocupadas.
- El entrenador confirma directamente las solicitudes de entrenamiento de sus clientes.
- El usuario de sala funciona con bono y puede reservar `Sala de arriba`,
  `Sala de abajo` o `Sala de fisio`.
- Dirección confirma las reservas de sala.
- Una reserva de sala consume una sesión al confirmarse y la devuelve si Dirección la cancela.
- Clientes y usuarios de sala ven únicamente sus propios datos y la ocupación anónima.
- Las horas ocupadas aparecen en rojo y tachadas.
- Las sesiones confirmadas se pueden añadir al calendario del dispositivo.
- El módulo de ciclo sólo aparece en cuentas de clientas donde Dirección activa
  `cycleTrackingEnabled`.
- El resumen de ciclo sólo se comparte con entrenadores asignados si la propia
  clienta lo activa.
- Las notas privadas del ciclo se guardan separadas y nunca se comparten.
- Dirección puede crear usuarios de sala y asignarles un bono desde la app.
- Cliente y usuario de sala deben aceptar los términos antes de reservar; la
  autorización de imagen es independiente.

## Confirmaciones que faltan de Activate

### Cuentas y centro

- Correo real de Roger y confirmación de que será la primera cuenta de
  Dirección con capacidad de entrenador.
- Correos reales de Tobias y Domi.
- Confirmar si Xavi necesita cuenta y qué permisos tendrá.
- Confirmar si Lydia, Adrià y Eleonora tendrán cuentas de usuario de sala.
- Dirección y dirección postal oficial del centro.
- Horario exacto, festivos y días de cierre.

### Bonos y reservas

- Lista definitiva de bonos: nombre, sesiones, duración de 45/60 minutos y caducidad.
- Bonos específicos de sala: sesiones, duración y caducidad.
- Confirmar que el bono de sala se descuenta al confirmar la reserva.
- Antelación mínima y máxima para pedir una reserva.
- Tiempo mínimo entre dos reservas y posibles tiempos de preparación de sala.
- Regla definitiva para cancelaciones entre 4 y 24 horas; el documento actual no la define.
- Qué ocurre con una sesión si el entrenador cancela.
- Si un cliente puede escoger cualquiera de sus entrenadores asignados o existe uno principal.

### Privacidad, salud y menores

- Texto definitivo de términos y condiciones revisado por un profesional.
- Política de privacidad y URL pública.
- Plazos de conservación y eliminación de datos.
- Consentimiento explícito para compartir el resumen del ciclo con entrenadores.
- Confirmar exactamente qué campos del ciclo puede ver el entrenador.
- Procedimiento de alta y consentimiento de padre, madre o tutor para menores.
- Edad mínima para usar la app y correo del responsable legal.
- Responsable o contacto para privacidad y solicitudes de derechos.
- Texto definitivo e independiente para autorización de imagen.

### Operativa

- Quién puede cancelar una sesión ya confirmada.
- Si Dirección puede cambiar también el entrenador, además de fecha, hora y sala.
- Notificaciones necesarias: nueva solicitud, confirmación, cambio, cancelación y bono bajo.
- Correo y teléfono de soporte que aparecerán en las tiendas.

## Trabajo técnico pendiente antes del piloto real

1. Mantener Firebase en Spark sin cuenta de facturación.
2. Adaptar las escrituras que dependían de Cloud Functions a transacciones
   Firestore protegidas, o realizar temporalmente la gestión privilegiada desde
   Firebase Console.
3. Crear cuentas de Dirección y entrenadores con roles protegidos.
4. Los tres documentos de sala ya están creados; faltan las cuentas y bonos
   iniciales reales.
5. App Check ya está integrado en el código. Registrar las apps firmadas,
   observar métricas y sólo entonces activar enforcement.
6. Supervisar las cuotas gratuitas de Firestore; Spark no genera consumo
   facturable ni admite copias administradas.
7. Hacer pruebas reales con una cuenta de cada rol.
8. Migrar Android al mismo flujo Firebase de sesiones y bonos; ahora su autenticación es real, pero parte de sus datos operativos sigue siendo de demostración.
9. Revisar accesibilidad, textos legales, copias de seguridad y procedimiento de incidencias.

## Publicación Apple

- Cuenta activa de Apple Developer y equipo de firma configurado en Xcode.
- App creada en App Store Connect con identificador `com.activatepersonaltraining.app`.
- Certificados, perfiles, versión y número de compilación.
- Política de privacidad, URL de soporte y datos de contacto.
- Declaración de privacidad de la app, especialmente ciclo, salud, menores y datos de contacto.
- Capturas, descripción, palabras clave, categoría y clasificación de edad.
- Prueba en iPhone físico y distribución inicial mediante TestFlight.
- Revisión del flujo de eliminación de cuenta y del acceso al calendario.

## Publicación Android

- Cuenta de Google Play Console.
- Clave de firma de producción protegida y Play App Signing.
- Ficha de tienda, política de privacidad y formulario Data Safety.
- Pruebas internas antes de producción.
- Revisión de paridad funcional con iOS.
