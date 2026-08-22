# Plan de arranque

El error más común en proyectos así es empezar por la tecnología. Se arma la app, se automatiza el envío, y al final hay tres personas registradas y nadie sabe si los mensajes sirvieron de algo.

Aquí el orden es al revés: **primero se prueba que el mensaje llega bien, después se prueba que se puede sostener, y hasta el final se automatiza.**

---

## Fase 0 — Diez personas, todo a mano (semanas 1 a 4)

**Objetivo:** averiguar si un mensaje de un desconocido bien intencionado de verdad le hace bien a alguien, o si se siente raro.

Qué se hace:

1. Escoge entre 5 y 10 personas. Al principio, gente que ya conoces o que alguien de confianza te recomendó: una vecina que enviudó, un primo que está lejos, alguien de la iglesia que dejó de salir. Personas reales con nombre, no una lista.
2. **Pídeles permiso explícito.** Con estas palabras o parecidas: *"Estoy empezando algo para mandar mensajitos de ánimo a gente que le caiga bien recibirlos. ¿Te gustaría que te llegara uno? Puedes decirme que no, o decirme que ya no en cualquier momento."* Que digan que sí en voz alta o por escrito. Un "pues... está bien" no es un sí.
3. Pregúntales tres cosas y anótalas: **cada cuándo** lo quieren, **qué tipo** de mensaje les gusta, y **a qué hora** del día les cae mejor.
4. Manda los mensajes desde la app de este proyecto, uno por uno, leyéndolos antes de enviar.
5. A las dos semanas, pregúntale a cada quien: *"¿Te han servido? ¿Te han estorbado? ¿Le cambiarías algo?"*

**Cuesta:** nada. Solo el tiempo de una persona, unos 15 minutos al día.

**Señal para pasar a la Fase 1:** al menos 7 de cada 10 dicen que quieren seguir recibiéndolos, y por lo menos una persona te pide de más — te pide otro día, o te pide que le mandes a alguien más. Ese "¿le puedes mandar a mi mamá?" es la señal de verdad.

**Señal de alto:** si la gente contesta con cortesía pero sin ganas, o si contestan cosas que no sabes cómo responder, no sigas creciendo. Arregla eso primero (ver `PRIVACIDAD_Y_SEGURIDAD.md`).

---

## Fase 1 — Treinta a cincuenta personas, con voluntarios (meses 2 a 4)

**Objetivo:** dejar de depender de una sola persona.

Qué cambia:

- **Entra un formulario de registro** (Google Forms es suficiente). Pide: nombre, teléfono, frecuencia, tipo de mensaje, y una casilla de consentimiento con el texto de `PRIVACIDAD_Y_SEGURIDAD.md`. Nada más. No pidas edad, dirección, ni diagnóstico.
- **Entran de 2 a 4 voluntarios.** Cada uno se hace cargo de 10 a 15 personas — sus personas, siempre las mismas. Que sea la misma voz la que escribe es justamente lo que hace que no se sienta a máquina.
- **Los voluntarios escriben mensajes propios**, no solo los de la biblioteca. Los buenos se agregan a `MENSAJES.md` para todos.
- **Una regla de equipo:** nadie manda mensajes desde su número personal. Se consigue un número aparte (una línea prepago barata, o un número de Google Voice / WhatsApp Business) para que la vida privada de los voluntarios no quede expuesta.

**Cuesta:** el número aparte, unos 100 a 200 pesos al mes (o gratis con Google Voice en EE. UU.).

**Señal para pasar a la Fase 2:** los voluntarios se están atrasando. Cuando un voluntario dice "se me juntaron los de tres días", ya no alcanza el trabajo manual.

---

## Fase 2 — Automatizar el recordatorio, no el cariño (meses 4 a 8)

Esta es la distinción que sostiene el proyecto: **lo que se automatiza es el recordatorio de mandar, no el mensaje mismo.**

Qué se automatiza primero, en este orden:

1. **La lista de "a quién le toca hoy"** — ya lo hace la app de este repo. Es lo que más tiempo ahorra y lo que menos riesgo tiene.
2. **Los cumpleaños y fechas difíciles** — un recordatorio el día del cumpleaños, o el aniversario de una pérdida si la persona lo compartió. Estos son los mensajes que más se sienten, y son los que más fácil se olvidan.
3. **El envío en sí** — hasta el final. Cuando ya sean más de 100 personas.

Herramientas, cuando llegue el momento:

| Necesidad | Opción barata | Cuándo conviene |
|---|---|---|
| Mandar SMS automático | Twilio (se paga por mensaje, centavos) | Estados Unidos, o gente sin WhatsApp |
| Mandar WhatsApp automático | WhatsApp Business API (vía Twilio o 360dialog) | México y Latinoamérica; requiere aprobación de plantillas |
| Guardar los registros | Google Sheets, o Airtable | Hasta unas 500 personas alcanza de sobra |
| Pegar todo | Make.com o Zapier | Solo si nadie del equipo programa |

**Advertencia sobre WhatsApp:** la API oficial de negocios obliga a que los mensajes que **tú inicias** sean plantillas aprobadas por Meta, y cobra por cada conversación. Mandar mensajes masivos desde WhatsApp normal, sin la API, hace que bloqueen el número — le pasa a todos los proyectos que lo intentan. Por eso la Fase 0 y la Fase 1 se mandan **a mano**: no es pereza técnica, es lo único que no te tumba el número.

---

## Fase 3 — Que se sostenga (a partir del mes 8)

A esta altura el problema ya no es enviar. Es que el proyecto no dependa de que una persona nunca se canse.

Lo que hay que resolver:

- **Relevos de voluntarios.** Que cada quien tenga un suplente. Que se pueda decir "esta semana no puedo" sin que alguien se quede sin su mensaje.
- **Un segundo par de ojos.** Alguien que revise las respuestas difíciles, para que ningún voluntario cargue solo con una conversación pesada.
- **Costo.** Con 500 personas a un mensaje diario por WhatsApp API, el costo mensual ya es real. Ahí se decide: donaciones, una fundación, una parroquia, o bajar la frecuencia.

---

## Lo que se mide (y lo que no)

Mídelo con tres números, revisados una vez al mes:

1. **Cuántos siguen** — de los que se registraron, cuántos no han pedido baja. Si baja del 80%, algo está mal en los mensajes o en la frecuencia.
2. **Cuántos contestan** — no todos van a contestar y está bien. Pero si nadie contesta nunca, el mensaje se está sintiendo como publicidad.
3. **Cuántos llegaron recomendados** — la gente que llega porque alguien la mandó. Es el único número que dice que el proyecto de verdad sirve.

**No midas** cuántos mensajes mandaste. Es el número más fácil de subir y el que menos significa.

---

## Nombre

`Un Mensaje Para Ti` es el nombre de trabajo y funciona bien: dice exactamente qué es y no promete curar nada.

Otras opciones, con su matiz:

- **Conexión Humana** — más amplio; sirve si algún día el proyecto crece a llamadas o visitas, pero suena más a organización que a mensaje.
- **No Estás Solo** — el más directo, pero le nombra a la persona un problema que quizá no quiere que le nombren. Un mensaje que llega diciendo "no estás solo" en el nombre del remitente puede sentirse como una etiqueta.
- **Alguien Pensó En Ti** — el más cercano al sentimiento real del proyecto, y es fácil de decir en voz alta al invitar a alguien.

Recomendación: quédate con **Un Mensaje Para Ti** para arrancar. Es claro, es cariñoso y no compromete a nada. El nombre se puede cambiar en la Fase 2 sin costo; lo que no se puede cambiar sin costo es la lista de gente que ya confió.
