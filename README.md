# Tecnimus · Beta Online 2

Mus a 40 piedras con seis avatares de cómic, mesas privadas y bots. Esta versión añade **voz para toda la mesa**, **señas que los rivales pueden detectar** y botones con fondos y relieve estables. La Beta 4 individual sigue disponible en **Jugar solo**.

## Subirlo a GitHub

Sigue **[GITHUB.md](GITHUB.md)**. La carpeta `docs` es la web que publica GitHub Pages; `server` contiene el servidor online. No hace falta hacer una APK para abrir la web en el móvil.

Puedes publicar Pages y jugar solo inmediatamente. Para jugar con amigos y usar voz, conecta un servidor Node.js mediante **Conectar servidor** o configura `docs/config.js`. Esta entrega no tiene todavía un servidor público desplegado.

## Empezar en Windows

1. Descomprime la carpeta completa.
2. Instala Node.js 22 o superior desde https://nodejs.org/.
3. Haz doble clic en **INICIAR-WINDOWS.bat** y mantén abierta la ventana del servidor.
4. Abre **http://localhost:3000**.
5. Escribe tu nombre, elige un avatar y pulsa **Crear mesa privada**.
6. Comparte la invitación. Tus amigos eligen asiento y entran con su nombre.
7. Pulsa **¡Que empiece la timba!**. Los sitios libres los ocupan bots.

Para probar varias personas en un PC, usa perfiles o navegadores distintos. Para jugar solo sin servidor puedes abrir `docs/solo.html` directamente. Para la partida desde tu wifi, abre `http://IP-DEL-PC:3000` en el móvil; esa dirección HTTP normalmente no admite micrófono.

## Voz

- Disponible en la sala online, desde la espera antes de empezar hasta la revancha. **Toda la mesa escucha**, también los rivales.
- Pulsa **Activar voz** y permite el micrófono. No se solicita ni se captura audio antes de pulsarlo.
- **Silenciar micrófono** corta tu transmisión; **Silenciar escucha** silencia las voces recibidas. **Apagar voz** libera el micrófono.
- Si el navegador bloquea la reproducción, aparece **Reproducir voces**. Usa auriculares para evitar eco.
- La captura se apaga al salir de la página, abandonar la mesa o perder la conexión. Tras volver, actívala de nuevo.
- Necesita **HTTPS** o `localhost`. Para voz en móvil usa la dirección HTTPS del servidor o GitHub Pages conectado a él.

El audio utiliza WebRTC entre jugadores. El servidor del juego intercambia ofertas de conexión, pero no graba las voces. Se usa STUN de Google por defecto. Algunas redes móviles, NAT o cortafuegos necesitan **TURN**, un servidor que retransmite el audio: sin él, la conexión de voz no está garantizada en todas las redes.

| Variable | Uso |
| --- | --- |
| `STUN_URLS` | URLs STUN separadas por comas; sustituye el valor predeterminado. |
| `TURN_URLS` | URLs TURN/TURNS separadas por comas del servicio de retransmisión que hayas configurado. |
| `TURN_SECRET` | Secreto compartido de un servidor TURN compatible con credenciales temporales HMAC, como coturn con `use-auth-secret`. |

Las credenciales TURN duran una hora y se generan en el servidor. Si una sesión muy larga deja de conectar, apaga y activa la voz para renovarlas. No pongas `TURN_SECRET` en GitHub, `docs/config.js` ni enlaces de invitación. No se incluye ni se ha contratado un servicio TURN.

## Señas y rivales atentos

Después de cortar el primer mus, pulsa **Señas**. Sólo aparecen las que corresponden a tu mano. Tu socio recibe su significado y puede pulsar **Visto**; un socio bot confirma automáticamente.

El avatar muestra el gesto durante **2,5 segundos**. Los otros jugadores también lo ven. Un rival puede pulsar el avatar durante ese instante para **cazar la seña**: su pareja recibe el significado y vosotros veis quién os ha pillado. Terminado el gesto, ya no puede detectarlo. Las cartas siguen ocultas hasta el descubrimiento normal.

Los bots también pueden enviar señas y detectar algunos gestos rivales; tienen en cuenta las señas cazadas al decidir los envites. Las señas no consumen el turno ni reinician su reloj. Esta mecánica corresponde a la mesa online; el modo individual conserva su sistema original de señas.

## Botones

Los botones usan superficies CSS con color sólido, degradado y relieve, sin depender de imágenes de textura. Se corrigió el texto oscuro sobre fondos oscuros y se mantienen legibles al desactivarlos. Las cartas desactivadas conservan sus dibujos. Hay foco visible para teclado y se respeta la preferencia de reducir movimiento.

## Servidor por internet

- Node.js 22 o superior; inicio: `npm start`. No necesita instalar dependencias externas.
- Puerto: variable `PORT` del alojamiento, 3000 por defecto. Salud: `/health`.
- Una sola instancia: salas y sesiones viven en memoria. Reiniciar pierde las partidas; las salas inactivas caducan tras seis horas.
- Publica con HTTPS. Para Pages separado del servidor, configura `ALLOWED_ORIGINS` con su origen exacto, por ejemplo `https://txuwa.github.io`.
- El proxy debe permitir conexiones duraderas a `/api/events`, sin almacenar en búfer ni cachear SSE. No alojes esa ruta como una función de ejecución breve.
- Incluye un `Dockerfile` para alojamientos con contenedores.
- `.env.example` muestra las variables. No se carga automáticamente: configúralas en el alojamiento o en el entorno de ejecución.

## Reglas y conexión

Reparto, descartes, turnos y puntuación se controlan en el servidor. Cada jugador recibe sólo sus cuatro cartas hasta el descubrimiento. Se conservan grande, chica, pares y juego/punto; envites, reenvites, quiero/no quiero y órdago; mano rotatoria y victoria a 40. El compañero puede querer tras el primer rechazo.

Tras 30 segundos desconectado, un bot cubre tus turnos hasta que vuelvas. El turno tiene un máximo de 90 segundos. Si abandonas expresamente, pierdes el asiento. Hay resumen de mano, efectos de sonido y revancha.

La web recibe estado por SSE autenticado y envía decisiones por HTTP. Las sesiones se guardan en el navegador por servidor; las invitaciones llevan código de sala y, cuando procede, dirección pública del servidor, nunca una credencial de sesión.

## Validación y límites

**25 pruebas automatizadas pasan**, incluidas 500 partidas completas de bots, cuatro sesiones HTTP, cliente con DOM simulado, señas cazadas y caducadas, CORS y sesiones desde Pages, señalización privada de voz, negociación simultánea, ICE temprano, silencios, permisos denegados y liberación del micrófono. Se revisaron las rutas de recursos y los colores de los botones: contraste mínimo de 4,59:1 en las combinaciones comprobadas.

La voz se ha comprobado con dispositivos WebRTC simulados, no con conversaciones entre móviles físicos ni redes distintas. Sigue pendiente probar el audio y el diseño en los navegadores y móviles finales. El servidor y TURN se configuran antes de esa prueba por internet.

No hay todavía cuentas, ranking, historial permanente, matchmaking ni APK.

## Desarrollo

```sh
npm start
npm test
```

`docs/mus-rules.js` contiene las reglas compartidas; `server/engine.cjs`, la partida; `server/index.cjs`, las salas y señalización; `docs/online.js`, la interfaz; `docs/voice.js`, el audio; y `docs/connection.js`, sesiones y SSE. Los gráficos originales se conservan en `docs/assets`.
