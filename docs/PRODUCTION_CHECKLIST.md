# Checklist de producción

La aplicación no debe publicarse con datos reales hasta completar todos los
puntos críticos.

## Crítico: plataforma y seguridad

- [ ] Proyectos Firebase separados para desarrollo, staging y producción.
- [x] Proyecto en Spark sin facturación durante el piloto.
- [ ] Cuotas gratuitas de Firestore supervisadas y procedimiento definido si
      se alcanza un límite.
- [ ] Región europea de Firestore confirmada antes de crear la base.
- [ ] Email/Password activo y emails de recuperación personalizados.
- [ ] Firestore Rules, índices y transacciones compatibles con Spark
      desplegados y probados.
- [ ] App Check activo en iOS, Android y web.
- [ ] Cuenta de Dirección nominal, con 2FA y sin contraseña compartida.
- [ ] Roger configurado como `boss` + `isTrainer`, sin duplicar su cuenta.
- [ ] Dominio de la miniweb autorizado en Firebase Authentication.
- [ ] Estrategia de copia externa/manual definida; las copias administradas de
      Firestore requieren facturación.
- [ ] Auditoría `activityLogs`, alertas de errores y procedimiento de incidentes.

## Crítico: producto

- [ ] iOS conectado a Auth y Firestore sin llamadas obligatorias a Functions;
      datos demo fuera de Release.
- [ ] Android conectado a Auth y Firestore; datos demo fuera de
      Release.
- [ ] Miniweb conectada al Firebase real; modo demo fuera del despliegue.
- [ ] Alta, recuperación, desactivación y borrado de cuentas probados.
- [ ] Alta de cliente y usuario de sala, aceptación de términos y bonos probados.
- [ ] Packs reales, caducidad y reglas de cancelación aprobados.
- [ ] Reservas simultáneas, conflictos, sesión agotada y auditoría probados.
- [ ] APNs/FCM y recordatorios probados en teléfonos físicos.
- [ ] Crashlytics activo sin registrar datos sensibles en logs.

## Crítico: legal y privacidad

- [ ] Términos y política de cancelación revisados profesionalmente.
- [ ] Política de privacidad, registro de tratamientos y plazos de conservación.
- [ ] Base jurídica y consentimiento explícito para salud/ciclo menstrual.
- [ ] Acceso a salud limitado, cifrado/aislamiento y compartición voluntaria.
- [ ] Flujo específico para menores y evidencia del tutor cuando corresponda.
- [ ] Consentimiento de imagen separado, opcional y revocable.
- [ ] Exportación, rectificación y supresión de datos disponibles.
- [ ] Contratos de encargado y revisión de transferencias/proveedores.
- [ ] Valorada la necesidad de una evaluación de impacto de protección de datos.

## Distribución

- [ ] Cuenta Apple Developer de organización y App Store Connect.
- [ ] Cuenta Google Play Console de organización.
- [ ] Bundle ID/package, iconos, capturas, privacidad y ficha de tienda finales.
- [ ] Pruebas internas con cuentas ficticias.
- [ ] TestFlight y Google Play Internal Testing con el equipo del centro.
- [ ] Piloto limitado, soporte definido y plan de reversión.

## Fuera del piloto

- [ ] No existe pago, Stripe, compra in-app ni almacenamiento de tarjetas.
- [ ] Dirección solo acredita sesiones tras verificar el cobro externo.
- [ ] Cualquier futura integración de pagos requiere una fase técnica, legal,
      fiscal y de políticas de tienda independiente.
