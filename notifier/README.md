# Notificador push de Activate

El plan Spark de Firebase no permite Cloud Functions, así que las
notificaciones con la app **cerrada** las envía este pequeño programa. Se
ejecuta cada cierto tiempo, mira qué ha cambiado en Firestore desde la última
vez y manda los avisos con Firebase Cloud Messaging (gratis en Spark).

Con la app **abierta** no hace falta: la web avisa al instante por sí sola.

## Qué avisa

| Quién | Cuándo |
| --- | --- |
| Entrenador | Nueva solicitud de entrenamiento; solicitud retirada; sesión cancelada por el cliente; mensaje de un cliente |
| Dirección | Nueva reserva de sala; reserva de sala retirada |
| Cliente / usuario de sala | Sesión confirmada o rechazada, cancelada, reprogramada, feedback nuevo, plan nutricional nuevo, mensaje del entrenador |
| Cliente | Reto semanal nuevo (de su entrenador o de todo el centro); feedback o aprobación de un reto |
| Cliente | Recordatorio en las 24 h previas a cada sesión (una vez) |

No se avisa a quien hizo el cambio (p. ej. Dirección no recibe su propia
cancelación).

## Puesta en marcha (una vez)

Se configura junto con la web: sigue los pasos 4, 5 y 6 de
[`web/README.md` → Publicar en GitHub](../web/README.md#publicar-en-github-sin-usar-el-comando-firebase)
(cuenta de servicio, secreto `FIREBASE_SERVICE_ACCOUNT` y variable
`VITE_FCM_VAPID_KEY`). El índice que necesita para los mensajes se publica
solo con el workflow «Reglas de Firestore».

El workflow `.github/workflows/notifier.yml` se ejecuta cada 20 minutos de
7:00 a 23:00 aprox. (hora de Madrid). Puedes lanzarlo a mano en *Actions* →
*Notificaciones push* → *Run workflow*. Mientras falte el secreto, termina
sin hacer nada (con un aviso).

### Alternativa: un ordenador siempre encendido

```bash
cd notifier
npm install
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/activate-github.json
npm run loop        # revisa cada 5 minutos
```

## Comprobar sin enviar

```bash
npm run dry-run     # muestra los avisos que mandaría, sin enviar ni guardar
npm test            # tests de la lógica (no necesita Firebase)
```

El estado (última ejecución y resultado) se guarda en Firestore en
`system/notifier`; las reglas no dejan que ningún usuario lo lea ni lo cambie.

## Notas

- En iPhone las notificaciones push sólo funcionan con la web **añadida a la
  pantalla de inicio** (iOS 16.4 o superior) y tras activarlas en Perfil.
- Cada usuario activa o desactiva las notificaciones en Perfil →
  Notificaciones, por dispositivo. Al cerrar sesión, el dispositivo se da de
  baja automáticamente.
- Los dispositivos que ya no existen se borran solos al fallar el envío.
