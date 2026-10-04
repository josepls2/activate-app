# Qué necesita Activate para llevar la app a la realidad

El prototipo permite validar la experiencia. Para usarlo con clientes reales se
necesitan las siguientes decisiones, cuentas y validaciones.

## 1. Información que debe confirmar Activate

- Catálogo completo de packs:
  - nombre;
  - número de sesiones;
  - duración de 45 o 60 minutos;
  - precio, aunque el cobro sea externo;
  - caducidad;
  - posibilidad de congelarlo;
  - reglas de consumo y reembolso.
- Qué ocurre al cancelar entre 4 y 24 horas. El documento aportado no lo define.
- Quién tendrá el rol **Dirección** y podrá confirmar, cancelar y reasignar.
- Confirmar que Roger será Dirección y entrenador con una sola cuenta.
- Datos del centro: dirección, teléfono, email, horarios y canales de soporte.
- Si Xavi, Lydia, Adrià y Eleonora necesitan cuenta propia o solo deben aparecer
  como ocupantes/colaboradores.
- Qué datos nutricionales serán reales y quién será responsable de actualizarlos.
- Qué parte del ciclo puede ver cada entrenador asignado al activar “Compartir
  resumen”. La implementación actual comparte flujo, síntomas y estado de
  ánimo, nunca las notas privadas.

## 2. Revisión legal imprescindible

Un profesional debe preparar y validar:

- términos y política de cancelación;
- política de privacidad y conservación de datos;
- tratamiento de datos de salud y del ciclo menstrual;
- consentimiento explícito, voluntario y revocable para compartir el ciclo;
- documento específico para menores firmado por padre, madre o tutor;
- autorización de imagen separada y revocable;
- cláusulas de aptitud física, seguro, responsabilidad y no reembolso;
- textos y mecanismo para ejercer acceso, rectificación y supresión.

El documento actual afirma que firma una persona de 18 años o más, por lo que no
puede reutilizarse sin cambios para los clientes menores.

## 3. Cuentas y servicios

- Cuenta Apple Developer de la empresa.
- Cuenta de organización en Google Play Console.
- Proyecto Firebase bajo titularidad de Activate. Para el piloto se mantendrá
  en Spark, sin facturación.
- Dominio y emails corporativos.
- Acceso a App Store Connect y Play Console para quien publique.
- Certificados, políticas de firma y responsable de incidencias.

La build Android ya apunta a Android 16/API 36, el nivel requerido para enviar
aplicaciones nuevas a Google Play desde el 31 de agosto de 2026:
<https://developer.android.com/google/play/requirements/target-sdk>.

## 4. Trabajo técnico restante

- El acceso a Firebase ya está verificado, y las reglas e índices están
  desplegados. Activate ha decidido mantener Spark; falta adaptar los flujos
  privilegiados que actualmente llaman a Cloud Functions.
- Completar en Android la migración de datos operativos a Firebase; iOS ya usa
  listeners para lectura y debe migrar sus escrituras a transacciones
  compatibles con Spark.
- Crear las cuentas nominales del equipo y probar el email de primer acceso.
- Completar en Android la baja de cuenta; iOS ya incluye la solicitud.
- Implementar notificaciones de confirmación, cambio y recordatorio.
- Registrar y aplicar las cancelaciones con su antelación real.
- Cifrar o aislar los datos de salud y limitar quién puede consultarlos.
- Añadir exportación/borrado de datos y registro de consentimientos versionado.
- Sustituir todas las métricas y planes demo por datos configurables.
- Preparar monitorización, copias de seguridad y respuesta ante incidentes.

## 5. Validación del piloto

Antes de publicar:

1. Probar con cuentas ficticias de cada rol.
2. Ejecutar un piloto interno con Roger, Dirección y un colaborador de sala.
3. Probar clientes adultos y un alta de menor con tutor.
4. Validar reservas simultáneas, cambios, cancelaciones y pack agotado.
5. Revisar accesibilidad y dispositivos iOS/Android reales.
6. Distribuir primero por TestFlight y Google Play Internal Testing.
7. Corregir incidencias y solo después abrir el centro piloto a clientes.
