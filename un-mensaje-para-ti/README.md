# Un Mensaje Para Ti

Un servicio sencillo para enviar mensajes de ánimo, compañía y cariño a personas que **se registran voluntariamente** para recibirlos.

La idea es simple: que alguien que se siente solo, invisible o cansado reciba, en su teléfono, un mensaje escrito por una persona real que se acordó de él o de ella.

## Qué hay aquí

- **[`app/index.html`](app/index.html)** — la herramienta de trabajo. Un solo archivo, sin instalación ni cuentas: se abre en el navegador del celular o de la computadora. Sirve para registrar personas, ver **a quién le toca mensaje hoy**, elegir el mensaje adecuado y abrirlo ya escrito en WhatsApp o SMS con un toque. Guarda todo en el propio dispositivo.
- **[`docs/PLAN.md`](docs/PLAN.md)** — cómo arrancar de verdad: las cuatro fases, de 10 personas hechas a mano hasta el envío automático, con la señal concreta que dice cuándo pasar de una fase a la siguiente.
- **[`docs/MENSAJES.md`](docs/MENSAJES.md)** — la biblioteca de mensajes (46 para empezar), organizada por tipo, con las reglas de cómo se escribe un mensaje que acompaña sin sonar a frase de calendario.
- **[`docs/PRIVACIDAD_Y_SEGURIDAD.md`](docs/PRIVACIDAD_Y_SEGURIDAD.md)** — consentimiento, manejo de datos, y qué hacer cuando alguien responde con algo grave. Esto no es opcional: es lo que separa un proyecto que ayuda de uno que hace daño sin querer.

## La idea central

Casi todo lo que hace falta para empezar **no es tecnología**. Es una lista de personas que dijeron que sí, unos mensajes bien escritos, y alguien que se acuerde de mandarlos.

Por eso la herramienta no manda nada sola. Le quita a la persona encargada todo el trabajo aburrido — llevar la cuenta de a quién le toca, qué frecuencia pidió, qué mensaje ya recibió, no repetir — y le deja solamente la parte humana: leer el mensaje, decidir si es el correcto para esa persona hoy, y apretar enviar.

Cuando ya haya suficientes personas para que eso sea imposible a mano, entonces sí se automatiza. Ni antes.

## Para empezar hoy mismo

1. Abre `app/index.html` en el celular o la computadora.
2. Registra 5 o 10 personas de confianza que hayan dicho que sí quieren recibir mensajes.
3. Cada mañana abre la pestaña **Hoy** y manda los que aparecen.
4. Después de dos semanas, pregúntales qué les pareció. Ese es el único dato que importa al principio.

---

*English: a consent-based service that sends short messages of encouragement and companionship to people who sign up for them. `app/index.html` is a zero-dependency tool for running the manual phase — it tracks who is due today, picks a non-repeating message matching their stated preference, and opens it pre-written in WhatsApp or SMS. See `docs/` for the rollout plan, the message library, and the privacy and crisis-response rules.*
