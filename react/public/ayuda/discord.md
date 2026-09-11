# Conectar Discord

Con Discord conectado, tu perfil enseña **tu estado en vivo**: si estás en línea, ausente o no molestar, a qué estás jugando, y qué escuchas en Spotify con su carátula.

Se conecta desde **Ajustes** en el panel.

## Qué permisos pide, y por qué

Pide tres cosas:

- **identify** — tu id, tu nombre y tu avatar. Es lo que hace que el widget sepa quién eres.
- **email** — tu correo, para poder atar esa conexión a tu cuenta.
- **guilds.join** — *unirse a servidores por ti*.

El tercero suele llamar la atención, y con razón. Sirve para una sola cosa: **Discord sólo le cuenta tu estado a un bot que comparta servidor contigo**. Sin eso no hay forma de saber si estás en línea.

Antes ese paso lo dabas tú: había que entrar a mano a un servidor ajeno. Ahora nuestro bot te mete en el nuestro al conectar, que es exactamente lo mismo pero sin que tengas que buscarlo. La pantalla de permisos de Discord lo dice con esas palabras; no pasa nada en silencio.

Si no quieres eso, no conectes Discord. El resto de tu perfil funciona igual.

## Cada cuánto se actualiza

Se toma una foto de tu estado cada minuto o dos. No es instantáneo: si cambias de juego, tu perfil tarda hasta un par de minutos en enterarse.

Y si la foto tiene más de cinco minutos, tu perfil **no dice nada** en vez de enseñar un estado viejo. Un «en línea» de hace tres días es peor que no decir nada.

## Lo que se guarda

Tu id de Discord, tu nombre, tu avatar, tu estado, a qué juegas y qué escuchas. Nada de tus mensajes, tus servidores ni tus amigos — un bot de presencia no los ve.

## Desconectarlo

Desde Ajustes, el mismo sitio. Si Discord es tu **única** forma de entrar a la cuenta, no te deja quitarlo sin conectar otra antes: es la red que evita que te quedes fuera de tu propio perfil.
