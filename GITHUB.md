# Publicar Tecnimus en GitHub Pages

1. Descomprime el ZIP.
2. En tu repositorio de GitHub, entra en **Add file → Upload files**.
3. Sube **el contenido de la carpeta `tecnimus-online`**: `docs`, `server`, `package.json`, etc. deben quedar en la raíz del repositorio. No subas el ZIP sin descomprimir ni anides todo en otra carpeta.
4. Guarda los cambios en tu rama principal.
5. Ve a **Settings → Pages** y selecciona **Deploy from a branch**.
6. Elige tu rama principal, por ejemplo **main**, y la carpeta **/docs**. Pulsa **Save**.
7. Abre el enlace que muestra Pages cuando termine de publicar. Si tenías una Beta antigua, actualiza sin caché para cargar el nuevo CSS.

**Jugar solo** funciona directamente en Pages. La mesa online y la voz necesitan el servidor de `server`.

## Conectar el servidor online

En un alojamiento que ejecute Node.js, conecta este mismo repositorio, usa Node.js 22 o superior y el comando de inicio `npm start`. No hay dependencias externas ni compilación. Usa una sola instancia y una dirección HTTPS.

Configura esta variable del servidor:

```text
ALLOWED_ORIGINS=https://TU-USUARIO.github.io
```

Sustituye `TU-USUARIO` por tu usuario. **No añadas `/nombre-del-repositorio`**: esta variable identifica el origen de la web. Si usas un dominio personalizado, añade su origen exacto. Puedes permitir varios separados por comas.

En Pages, despliega **Conectar servidor**, pega su URL HTTPS y pulsa **Conectar**. La selección queda guardada en ese navegador. Al copiar la invitación se añade la URL para que tus amigos usen el mismo servidor.

Para que todos conecten automáticamente desde la portada, edita `docs/config.js` en GitHub:

```js
window.TECNIMUS_CONFIG = {
  serverUrl: 'https://TU-SERVIDOR'
};
```

Pon la dirección real de tu servidor. GitHub vuelve a publicar al guardar el cambio. Aquí sólo se pone una URL pública; nunca contraseñas ni secretos. Si habías guardado otro servidor desde la interfaz, cambia también esa selección en **Conectar servidor**.

El servidor también sirve la web en su propia dirección: podéis entrar allí directamente.

## Prueba con amigos

1. Crea una mesa y copia la invitación.
2. Tu compañero y los rivales abren el enlace desde sus dispositivos.
3. Cada uno pulsa **Activar voz** y permite su micrófono. Toda la mesa escucha.
4. Si la partida conecta pero la voz falla entre redes, configura TURN siguiendo el README; STUN por sí solo no resuelve todas las redes.
5. Después de cortar el primer mus, envía una seña. Tu compañero recibe el significado. Un rival puede pulsar tu avatar mientras haces el gesto y cazarla.

No se ha publicado ni contratado ningún servidor en esta entrega.
