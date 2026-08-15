# Servicios adicionales de API de la aplicación

En cada apartado de nivel 2 especificaremos un modulo de servicios de la API.

## API Resultados

Cada jornada tiene 3 tipos de resultados, los de los primeros 14 partidos (1,X,2); los del partido 15 (0-0, 0-1,1-0.... M-M) (un tipo distinto de resultado) y 6 categorias de premios en base al número de aciertos (valores en euros)

Los resultdos los registra el administrador

Entedemos que deberi haber una tabla resultadosJornada con

- idJornada
- Resultado[1..14]= expresion regular ^[1X2]$. 14 columans como esta Resultado1, Resultado2.... Resultado14
- Resultado15: expresion regular:^[012M]-[012M]$
- PremioCategoria10: importe
- PremioCategoria11: importe
- PremioCategoria12: importe
- PremioCategoria13: importe
- PremioCategoria14: importe
- PremioCategoria15: importe

- **Registro de resultados**:Cada jornada se registran por parte del **administrador** los resultados de la jornada activa.
- **Tipos de resultados**: Los partidos tienes 2 tipos de resultados:
  - Los 14 primeros partidos de cada jornada pueden tener los sigiuentes resultados que se basan en la victoria: 1=victoria local, X=Empate, 2=Victoria visitante.
  - El partido 15 es especial y se basa en el múmero de goles, y se apuesta al numero de goles marcados el local y el numero de goles marcados por el visitante. Los valores viables son 0=el equipo marca 0 goles, 1=el equipo marca un gol, 2=el equipo marca 2 goles, M=el equipo marca 3 o más goles.
  - En un partido de liga de la quiniela no hay penaltis, y siempre se apuesta a la victoria del equipo (14 primeros) y al numero de goles en el partido 15.
  - Todos los partidos tendrá resultado antes de cerrarla. En caso de que no se pueda celebrar un encuentro, el organimos de Loterias y apuestas del estado celebra un sorteo y publica el resultado del mismo.
- **Premios**: Todas las jornadas tienes 6 categoría de premios en función de los aciertos: 10, 11, 12, 13, 14, 15
  - Los premios son importes de euros
  - Si no hay acertantes de una categoria el premio es 0 y se acula un bote (el bote no es relevante)
  - Si hay muchos acertantes se puede decidir que el premio es 0 y se añadira a la recaduación de las proximas jornadas (bote). El bote no es relevante para la API.
- **Flujo normal** de trabajo es:
  1. Administrador crea jornadas o jornadas.
  2. El administrador activa la jornada para que los usuarios puedan hacer la apuestas
  3. Los usuarios hacen sus apuestas
  4. El administrador se cierra las apuestas de la jornada, o se puede establecer una hora de cierre automática (en la que no se admiten mas apuetas) en la que los usuarios no pueden crear o editar sus apuestas.
  5. El administrador introduce los resultados y premios
  6. El administrador cierra la jornada y se hacen los calculos. En este caso se cierra la jornada para los calculos

Sobre las apuestas, los calculos especificaremos en puntos siguientes, este es el momento de los resultados.

### Cuestiones y respuestas

1. **¿Dónde vive el resultado de cada partido?** ¿Columnas nuevas en la tabla `partidos`, o una tabla `resultados` aparte con una fila por partido?

   > Respuesta: mejor en una tabla aparte, con una fila por partido y referenciando `partido_id`.

2. **¿El cierre es una única acción o dos distintas?** El flujo menciona un cierre en el paso 4 (dejar de admitir apuestas) y otro en el paso 6 (disparar los cálculos).

   > Respuesta: hay 2 cierres posibles:
   >
   > 1. Cierre de apuestas: los usuarios de la peña no pueden crear o editar sus apuestas.
   > 2. Cierre de la jornada: están los resultados y se hacen los cálculos (que especificaremos luego).

3. **¿Cómo se modela la hora de cierre automática?** ¿Un campo opcional por jornada, o el cierre siempre es una acción manual del administrador?

   > Respuesta: sí, puestos a modificar, mejor añadir 3 fechas, solo editables por el administrador:
   >
   > 1. Fecha de apertura de apuestas: permite a los usuarios crear o editar apuestas.
   > 2. Fecha de cierre de apuestas: ya no permite al usuario crear o editar apuestas.
   > 3. Fecha de cierre de la jornada: indicará que se han creado los resultados y realizado los cálculos.

4. **¿Los premios van en 6 columnas fijas o en una tabla aparte?** Como las categorías son siempre las mismas 6 (10 a 15 aciertos).

   > Respuesta: pueden ir en la tabla de resultados como 6 columnas, es parte de los resultados de la jornada.

5. **¿El caso del partido no disputado (sorteo de Loterías) es transparente para la API?**
   > Respuesta: efectivamente es transparente, es un resultado más; solo se quiere indicar que siempre hay resultado, aunque el partido no se celebre.

### Cuestiones pendientes (abiertas)

1. **Sobre el punto 3** — ¿el estado de si se admiten apuestas se deriva solo comparando `ahora()` contra las 3 fechas (sin campo de estado aparte), usando el mismo campo de fecha tanto para el cierre manual como para el programado? ¿O prefieres mantener además un campo de estado explícito (enum `creada`/`abierta`/`cerrada_apuestas`/`calculada`) junto a las fechas?

**Respuesta**: No hace falta estado, creo que lo hace mas complejo y habria que gestionarlo a veces manualmente.

1. **Sobre el punto 4** — hay una contradicción con el punto 1: los premios son por jornada, no por partido, así que "6 columnas en la tabla de resultados" (que es por partido, una fila por partido) implicaría duplicarlas en las 15 filas de cada jornada. ¿Prefieres:
   - (a) una tabla/fila aparte a nivel de jornada (p. ej. `resultados_jornada`: `jornada_id` + 6 columnas de premio, quizá junto con las 3 fechas), o
   - (b) meter las 6 columnas de premio directamente en la tabla `jornadas`?

**Respuesta**: (a) yo pensaba qen una tabla "resultados" por jornada, en la que hubiera los resultados de 14 partidos, el del 15 y el valor de las 6 categorias de premios.

## Apuestas API

En cada jornada los miembros de la peña pueden hacer apuestas, con las siguientes características:

- Solo se pueden hacer y editar a puestas con la joranda abierta, la fecha actual esta entre la fecha de apertura de apuestas y la de cierre de apuestas
- Cada miembro puede hacer:
  - 2 apuestas para cada 1 de los 14 partidos, estas apuestas son obligatorias. Valores 1,X,2.
  - 1 apuesta para el partido 15, esta apuesta es opcional para cada miembro en este caso se apuesta ©© para el primer partido y [0,1,2,M] para el segundo partido (2 valores)
-

Entendosmo que se modelaria como una nueva tabla apuestaJornadaMiembro con los siguientes campos

- idJornada
- idMiembro: de la apuesta
- idApuesta: expresion regular ^[1,2]$, 2 apuestas por jornada por miembro.
- Partidos[1..14]: expresion regular ^[1X2]$, una columna por cada uno de los 14 partidos, obligatorios toddos
- Partido 15: expresion regular ^[012M]-[012M]$
- fechaCrecacion
- fechaActualizacion
- idUsario: el usuario que creo la apuesta, puede el propio usuario o un administrador. Hay que distingir si el usuario lo creo o no. El objetivo es saber el % deveces que creo el usuiaro la apuesta.

### Matizaciones

Sobre el flujo y la acciones de la peña:

- La peña siempre, todas las jornadas realiaza 2 apuestas por los miembros, en caso de que no la cree, el administrador la hara por ellos
- El partido 15, solo se puede realizar una apuesta real, el administrador en fución de las sugerencia de los usaurios, decide manualmente cual es la apuesta de esa jornada
  Esto quiere decirque si hay 10 miembros habrá 20 apuestas (2x10) pero solo 1 de la puesta 15.
- Las apuestas se realizan realmente todas las semanas en una administración de loterias o online. La peña obtendrá los ingresos de los premios, pero esto es para el apartado de cálculos.

## Calculos API

- **Requiere**: Requisitos para realizar los calculso
  - Existan apuestas por parte de los miembros de la peña
  - Que administrador haya introduccido los resultados de la jornada, incluidos los premios.
- **Objetivo**
  - Establecer el raking de cada miembro en la jornada
  - Establecer el pago de cada miembro en la jornada
  - Establecer los ingresos de la peña en la jornada que era los pagos de cada miembro + los premios
- **Ejecución del proceso**
  - El procesos se llama manualmetne por parte del administrado

### Proceso de cálculo

Ademas de los resultados de la jornada basados en los resultados, hay unos resultados de cada miembor de la peña que se calculan apartir de sus apuestas
y los resultados de las jornadas

Basícamente se calculan

- los aciertos de cada una de sus apuesta para los 15 partidos
- Se hace el calculo del pago de la jornada en función de los resultados de cada miembro respecto del resto
- Este proceso se realizar manualmente por parte del administrador

Entedemos que inicialemnte deberia haber una tabla resultadosJornadaMiembro en la que se persistan

- idJornada
- idMiembro
- Aciertos de la apuesta 1
- Aciertos de la apuesta 2
- Premios de la apuesta 1
- Premios de la apuesta 2
- Ranking respecto losm miembros de usando maximo de aciertos (ver proceso a continacion), en que puesto quedo.
- Pago resultados del calculo
- fechaCreacion
- fechaActualización

habra una ruta /calculos que recibe como parametro una temporada (opcional) y una jornada(obligatori)
Solo se pueden calcular jorndas de temporadas activas.

1. Para cada miembro se establece que apuesta tienes mas aciertos para la jornada
2. Se ordenan los miembros por el número maximo de aciertos en la jornada
3. Si hay empates se establecen grupos, que se ordenan por el numero de acierto
4. En función de ese orden se le asigna y empezando por los que menos aciertaron se les asignan unos "pagos"
   1. Hay una tabla que recoge lo pagos a realizar en función del orden del grupo
   2. Los pagos se asigna empezado por abajo, y en base a grupos, es decir, si hay solo 2 grupos, al primero se le asigna el máximo pago, y al segundo el siguiente maximo escalon de pago,.
   3. Si todos aciertan el mismo valor, todos pagan el maximo de la tabla
   4. Si hay un unico acertate, se le asigna como pago el minimo de la tabla, el primer escalon. (1,00)

### Matizaciones

-La peña esta pensada inicialmente para 10 miembros

| Escalon | Pago |
| 10 | 2,50 |
| 09 | 2,40 |
| 08 | 2,30 |
| 07 | 2,20 |
| 06 | 2,10 |
| 05 | 2,00 |
| 04 | 1,90 |
| 03 | 1,80 |
| 02 | 1,70 |
| 01 | 1,50 |

Esposible que haya que crear esta tabla de configuración ,pero no requiere API inicialmente, se carga a mano
Campos

- idEscalon
- escalonDePago: expresion regular:^(10|[1-9])$
- importeEscalon: valor del pago en euros.

### Ejemplo de calculo 1

- Suma de premios: no hubo premos esta jorda
- Pas1 maximos, nos quedamos el maxximo de la suma de aciertos de las 2 apuesta
- Escalon de pagos, al que menos acerto (user 6 = 5) se le asigna el maximo escalon de pagos que es el 10, al siguiente que menos acerto el siguiente escalon de pago que es el 9 a los usaurios (user 3 y user 9 = 9)
- Valor de pago, es el valor en euros del escalon de pago
- el total de aportacion al bote en la jornada de calcula como: valor de pago + valor premios -1,5 (fijo y valor de la apuesta)

| jornad 2 | aciertos apuesta 1 | aciertos apuesta 2 | suma premios | Paso1 maximos | Paso 2 Escalon depago | Paso 3 valor del pago | paso 4total bote |
| :------- | :----------------- | :----------------- | :----------- | :------------ | :-------------------- | :-------------------- | :--------------- |
| user 1   | 3                  | 7                  |              | 7             | 7                     | 2,2                   | 0,7              |
| user 2   | 5                  | 7                  |              | 7             | 7                     | 2,2                   | 0,7              |
| user 3   | 8                  | 8                  |              | 8             | 9                     | 2,4                   | 0,9              |
| user 4   | 4                  | 7                  |              | 7             | 7                     | 2,2                   | 0,7              |
| user 5   | 6                  | 7                  |              | 7             | 7                     | 2,2                   | 0,7              |
| user 6   | 5                  | 5                  |              | 5             | 10                    | 2,5                   | 1                |
| user 7   | 6                  | 8                  |              | 8             | 8                     | 2,3                   | 0,8              |
| user 8   | 8                  | 7                  |              | 8             | 8                     | 2,3                   | 0,8              |
| user 9   | 6                  | 6                  |              | 6             | 9                     | 2,4                   | 0,9              |
| user 10  | 6                  | 7                  |              | 7             | 7                     | 2,2                   | 0,7              |

### Ejemplo 2 calculos 2

- En este caso hay un unico maximo acertante (user 6 = 10) y por tanto se le asigna la categoria de pago 1, 1,50
- Hay un premio de categoria 10, de 10,49, por tanto la aportación de usuarios 6 al bote es 1,50 + 10,49 - 1,50 (fijo y precio de la apuesta)
- Empezamos por cogerlos maxmos en paso 1
- luego asignamos es maximo escalo de pago a todos los que acertaron menos, en este caso user 2 = 4, que ser 10 y paga 2,5 (sacar de tabla)
- luego asginamos el siguiente escalon de pago de forma descente, el 9 a user 9 y user 4, que hacertaron 5
- luegoa asignamos el escalon de pago el 8, a user 1 que tuvo 6 aciertos
- los calculos terminan cuando todos los usuarios tengan un escalon de pago asignado.
- e

| jornad 2 | aciertos apuesta 1 | aciertos apuesta 2 | suma premios | Paso1 maximos | Paso 2 Escalon depago | Paso 3 valor del pago | paso 4total bote |
| :------- | :----------------- | :----------------- | :----------- | :------------ | :-------------------- | :-------------------- | :--------------- |
| user 1   | 6                  | 4                  |              | 6             | 8                     | 2,3                   | 2,3              |
| user 2   | 4                  | 4                  |              | 4             | 10                    | 2                     | 2                |
| user 3   | 7                  | 4                  |              | 7             | 7                     | 2,2                   | 2,2              |
| user 4   | 5                  | 5                  |              | 5             | 9                     | 2,4                   | 2,4              |
| user 5   | 8                  | 7                  |              | 8             | 6                     | 2,1                   | 2,1              |
| user 6   | 8                  | 10                 | 10,49        | 10            | 1                     | 1,5                   | 11,99            |
| user 7   | 7                  | 6                  |              | 7             | 7                     | 2,2                   | 2,2              |
| user 8   | 6                  | 7                  |              | 7             | 7                     | 2,2                   | 2,2              |
| user 9   | 5                  | 5                  |              | 5             | 9                     | 2,4                   | 2,4              |
| user 10  | 7                  | 7                  |              | 7             | 7                     | 2,2                   | 2,2              |

## Perfil del usario

El usuario de la aplicación tanto user como administrador necestia una API para gestionar sus datos

- Nombre
- Apellidos
- Correo
- Apodo
- Teléfono
- Credito: ver apartado de pagos

entedemos que son datos que extiende la tabla de usuario, que habra que retocar.

## Dashboar API

Necesitamos uan API para proporcionar datos al usaurio, tanto de la peña (datos agragados de los miembros) como del cada usuario individual.

Alguna API puede ya existir en base a los modulso implementados

- Ultimo resultado
- Pagos, etc.

Incialmente cro que vamos a mostar para cada user

- Pagos totales de la temporada
- Media de aciertos de la temporada
- Maximo aciertos en una apuesta de la temporada
- Minimo del año
- Máximo premio
- Premios totales

A nivel de jornada

- Pagos de la jornada
- Bote generado en la jornada
- Media de aciertos con las 2 apuestas
- Medida de acierto con la apuesta con maximos

A nivel de temporada

- Maximos aciertos y usarios que hicieron el maximo numero
- Minimos aciertos y usauros que lo hiciero
- Premios totales
- Pagos totales
- Bote total

hay que decidir si se necestia persistencia, emrincipio son pocos registros de datos, se podra ri con claculos al vuelo.
Pero también se puede plantear hacer una tabla, persistir y calcular estadisticas al cerrar cada jornada.

En este aparatado se pueden ir añadiendo end-points en el futuro

## API Pagos

Los usuarios hacen pagos de forma discontinua.
Fisicamente entregan dinero a un administrador que los suma a su cuenta.

La gestión del dinero es a nivel de usuario, y se mantiene a los largos de las temporadas
Es un dato del usuario

creeomos que debe haber una tabla pagosMiembro

- idMiembro
- importePago
- fechaPago
- fechaCreacion

Cada pago, aumenta el credito del miembro de la tabla de usuarios.
