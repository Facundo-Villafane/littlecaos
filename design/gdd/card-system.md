---
sidebar_position: 5
title: Sistema de Cartas
description: El átomo del juego — mano de 4, recurso Impulso, ciclo de mazo, tipos de carta y economía de turno.
---

# Card System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-16
> **Last Verified**: 2026-05-16
> **Implements Pillar**: Decisiones Rápidas · Caos Ordenado

## Summary

El Card System gestiona el átomo del juego: la mano de 4 cartas, el recurso Impulso, el ciclo de mazo (robar, jugar, descartar, barajar), y la economía de turno que hace posibles las Decisiones Rápidas. Es la interface entre el jugador y cada encuentro — la mano que tiene en un momento dado es el único poder real que controla.

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `Data Configuration System`

## Overview

El Card System define cómo el jugador interactúa con el juego momento a momento. Al inicio de cada turno roba 4 cartas de su mazo y recibe 3 puntos de Impulso. Jugar una carta gasta su costo en Impulso y ejecuta su efecto. Al finalizar el turno, las cartas no jugadas se descartan. Cuando el mazo se agota, la pila de descarte se baraja y se convierte en el nuevo mazo. El sistema no tiene azar en las decisiones — el azar es qué 4 cartas tocaron, pero la elección de cuáles jugar y en qué orden es siempre del jugador.

El Card System no procesa el significado narrativo de las cartas — eso es el Situation System. No determina el resultado del encuentro — eso es el Combat System. Lo que hace es garantizar que cada turno el jugador tenga exactamente la información necesaria para tomar una decisión en menos de 10 segundos: una mano acotada, un recurso visible, y efectos sin ambigüedad.

## Player Fantasy

El jugador es un desastre con buen criterio. Recibe 4 cartas — algunas parecen inútiles, una es absurda, otra es demasiado cara. Lee la Situación activa. Y de repente ve: la carta absurda era la correcta para este momento. No la eligió porque fuera "buena" — la eligió porque leyó la escena. El dominio no viene de optimizar un combo de daño; viene de entender que "Pedirle perdón al perro del villano" es la jugada correcta cuando la Situación es "El enemigo solo puede ser atacado por argumentos irracionales".

Sobre ese piso de lectura, la improvisación: jugás tres cartas en cadena, el resultado no era lo que planeabas, y funcionó de todas formas. La satisfacción no es "lo calculé" — es "no puedo creer que eso funcionó". Ese momento es la historia que el jugador le cuenta a alguien después del run.

Si el sistema falla en entregar esto, el juego se convierte en Slay the Spire con menos cartas — el jugador arma el combo óptimo por turno y las Situaciones se vuelven decoración. La promesa de "héroe incompetente pero clever" colapsa en "optimizador eficiente con skin cómico".

## Detailed Design

### Core Rules

**1. Estructura del turno**

Secuencia exacta e invariable por turno:

1. **Telegráfico enemigo**: el enemigo revela su intención — acción tipo + valor de daño (visible para el jugador). El jugador lee esto antes de cualquier decisión propia.
2. **Robo de mano**: el jugador roba 4 cartas del mazo (aplica ciclo de mazo si corresponde — ver §6).
3. **Tirada de maná**: el jugador lanza 2d6. El resultado = maná disponible para este turno. Si resultado = 2 (snake eyes): recibe estado Vergüenza 1 turno. Si resultado = 12 (doble 6): roba 1 carta adicional inmediatamente.
4. **Cálculo de costos efectivos**: Card System calcula y cachea el `costo_efectivo` de cada carta en mano (base + modificadores de Situación activa + modificadores de estado del jugador). No se recalcula hasta el próximo robo.
5. **Acción del jugador**: juega cartas en cualquier orden gastando maná. Puede jugar 0 o más cartas. El orden de juego importa — cada carta resuelve completamente antes de poder jugar la siguiente.
6. **Ataque automático de aliados**: el Combat System ejecuta el ataque de todos los aliados activos en el campo (en orden de llegada). Cada aliado inflige su `ataque` fijo al enemigo.
7. **Ataque del enemigo**: el Combat System ejecuta la intención telegrafada. El daño se resuelve según la secuencia de prioridad (§5).
8. **Fin de turno**: cartas no jugadas se descartan. Efectos de fin de turno resuelven en orden: cartas → reliquias → estados alterados.

**2. Reglas de maná**

- Fuente: exclusivamente la tirada de 2d6 al inicio del turno (paso 3). Rango posible: 2–12.
- No acumula entre turnos: el maná no gastado no pasa al siguiente turno. Sí persiste como escudo hasta que el enemigo ataca (paso 7).
- No puede ir por debajo de 0: el daño absorbido por maná no genera "deuda de maná".
- **Snake eyes (doble 1 = 2)**: maná = 2 más estado Vergüenza por 1 turno. El jugador aún puede jugar cartas con el maná recibido.
- **Doble 6 (= 12)**: maná = 12 más roba 1 carta extra del mazo inmediatamente.

**3. Reglas de juego de cartas**

- Para jugar una carta: `maná_actual ≥ costo_efectivo`.
- No hay límite de cartas por turno más allá del maná disponible y las cartas en mano (máximo 4).
- No hay restricción por tipo: el jugador puede jugar múltiples cartas del mismo tipo en el mismo turno.
- Carta no costeable: la acción no se ejecuta, la carta permanece en mano, sin penalidad.
- Cartas de costo 0: se pueden jugar sin restricción de maná. El jugador puede jugar todas las que tenga en mano si lo desea.
- Resolución inmediata y secuencial: cada carta resuelve completamente antes de que el jugador pueda jugar la siguiente.

**4. Mecánica de aliados** *(invocación — el Combat System gestiona al aliado tras la invocación)*

- Una carta de invocación, al jugarse, emite `ally_summoned(AllyData)` hacia el Combat System y se consume.
- El Card System no trackea al aliado después de esta emisión. Ciclo de vida, HP y ataque automático son responsabilidad del Combat System.
- **Límite de campo**: máximo 3 aliados simultáneos. Si el campo está lleno (3 aliados), la carta de invocación no puede jugarse (aparece como inactiva en mano).
- Los aliados no persisten entre encuentros. Al fin de cada encuentro (victoria o derrota), todos los aliados son removidos.

**5. Secuencia de resolución de daño enemigo** *(ejecutada por el Combat System)*

```
Daño enemigo →
  [¿Hay aliados en campo?]
    SÍ → Aliado aleatorio recibe todo el daño (overflow se pierde — no se traslada)
    NO → Maná actual del jugador absorbe daño 1-a-1 →
           [¿Daño > Maná?]
             NO → Maná reduce, HP intacto
             SÍ → Maná = 0, exceso → HP del jugador
                    [¿HP = 0?] → Derrota
```

"Maná actual" = maná que quedó sin gastar después del paso 5. El jugador controla su propio escudo eligiendo cuánto maná gasta en cartas cada turno.

**6. Ciclo de mazo**

- Al robar en el paso 2: si el mazo está vacío, la pila de descarte se baraja automáticamente y se convierte en el nuevo mazo. El proceso es transparente para el jugador.
- El ciclo puede ocurrir a mitad de un robo (ej: necesita 4, solo quedan 2 → baraja descarte → completa con 2 del nuevo mazo).
- Si mazo Y descarte están vacíos: el jugador roba las cartas disponibles. Turno con 0 cartas es posible, no es derrota.
- Las cartas en mano al momento del ciclo NO se barajan — solo la pila de descarte.
- Al ganar un encuentro, las cartas en mano se descartan antes de salir.

**7. Condiciones de fin de encuentro**

- **Victoria primaria**: HP del enemigo llega a 0. Encuentro termina inmediatamente.
- **Victoria alternativa**: condiciones especiales definidas por la Situación activa (ej.: sobrevivir N turnos, reducir un estado del enemigo a 0). Evaluadas al inicio de cada turno y al resolver cada efecto de carta.
- **Derrota**: HP del jugador llega a 0. Run termina.
- Al fin del encuentro: aliados removidos, estados con duración "por encuentro" expiran, HP del jugador y mazo persisten, SceneManager.request_transition() gestiona la pantalla siguiente.

---

### States and Transitions

**Estados de una carta (ciclo de vida):**

| Estado | Descripción | Transiciones válidas |
|---|---|---|
| `InDrawPile` | En el mazo de robo | → `InHand` (al ser robada) |
| `InHand` | En la mano del jugador | → `Resolving` (al jugarse) · → `InDiscardPile` (al fin de turno sin jugarla) |
| `Resolving` | Efecto ejecutándose (transiente) | → `InDiscardPile` (tras resolver) · → `Consumed` (carta de invocación consumida al invocar aliado) |
| `InDiscardPile` | En la pila de descarte | → `InDrawPile` (al barajarse la pila) |
| `Consumed` | Carta de invocación consumida | Estado terminal — carta no regresa al mazo [open question: ¿va al descarte igualmente?] |

**Estados del maná (por turno):**

| Estado | Descripción | Transiciones |
|---|---|---|
| `Idle` | Entre turnos, sin valor | → `Available` al tirar los dados (paso 3) |
| `Available` | Tirado y activo; el jugador puede gastar | → `Locked` al iniciar transición de escena o fin de turno |
| `Locked` | Turno en transición; no se pueden tomar acciones | → `Idle` al completar la transición |

El valor de maná actual (`mana_current: int`) es una variable dentro del estado `Available`, no un estado separado. `is_playable` de cada carta en mano se recalcula cada vez que `mana_current` cambia.

---

### Interactions with Other Systems

| Sistema | Qué hace el Card System | Interface |
|---|---|---|
| **DataLoader** | Lee `CardData` al instanciar cartas del mazo | `DataLoader.get_card(id) → CardData` (inmutable) |
| **Situation System** | Lee modificadores de costo activos al cachear `costo_efectivo` (paso 4) | `SituationSystem.get_cost_modifiers(card_type, card_tags) → Array[delta: int]` |
| **Status Effect System** | Lee modificadores de costo por estados del jugador activos (paso 4) | `StatusEffectSystem.get_card_cost_modifiers(card_type) → Array[delta: int]` |
| **Combat System** | Emite efectos de carta para resolución; emite `ally_summoned(AllyData)` al invocar aliados | `signal card_effect_resolved(effect_type, params)` · `signal ally_summoned(AllyData)` |
| **Enemy System** | Lee la intención del enemigo para mostrarla (paso 1); no afecta lógica del Card System | `EnemySystem.get_current_intent() → IntentData` |
| **Deck Building System** | Expone el mazo para modificarlo post-encuentro | `get_deck() → Array[CardData]` · `add_card(CardData)` · `remove_card(id)` · `upgrade_card(id)` |
| **Scene Management System** | Escucha `transition_completed` para inicializar el encuentro | Escucha `SceneManager.transition_completed(ActiveEncounter)` |

**Restricción de diseño**: Las cartas de invocación transfieren la responsabilidad del aliado al Combat System vía signal. El Card System no tiene referencia a `AllyInstance` después de emitir `ally_summoned`. El ciclo de vida del aliado (HP, ataque, muerte) es propiedad exclusiva del Combat System.

---

> **⚠️ Retrofit pendiente al Data Config GDD:**
> - Agregar `AllyData` como quinto tipo de contenido (`res://data/allies/allies.json`)
> - Schema de AllyData: `id`, `name`, `hp`, `attack_per_turn`, `flavor_text`, `art_key`
> - Agregar tipo de efecto `summon_ally` al vocabulario: `{ "type": "summon_ally", "ally_id": "string" }`

## Formulas

### Fórmula 1: Costo Efectivo de Carta

`costo_efectivo = max(0, costo_base + Σ(modificadores_situación) + Σ(modificadores_estado))`

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `costo_base` | int | 0–3 | Costo definido en `CardData.cost` |
| `modificadores_situación` | Array[int] | -3 a +3 cada uno | Deltas de la Situación activa via `SituationSystem.get_cost_modifiers()` |
| `modificadores_estado` | Array[int] | -3 a +3 cada uno | Deltas por estados del jugador via `StatusEffectSystem.get_card_cost_modifiers()` |

**Rango de salida:** 0 (mínimo — el `max(0,…)` impide costos negativos) a 6+ (si los modificadores son muy positivos).

**Cuándo se calcula:** Una vez por turno en el paso 4, cacheado en `CardInstance.cost_effective` hasta el próximo robo. `is_playable` se recalcula si cambia `mana_current`, pero `cost_effective` no.

**Ejemplo:** Carta con `costo_base=2`, Situación aplica `+1` a tipo combate, estado "Inspirado" aplica `-1` a todas las cartas. `costo_efectivo = max(0, 2+1-1) = 2`.

---

### Fórmula 2: Daño Final al HP del Jugador

`daño_a_hp = max(0, daño_enemigo - maná_actual)`

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `daño_enemigo` | int | 2–12 | Resultado de la tirada 2d6 del enemigo |
| `maná_actual` | int | 0–12 | Maná que quedó sin gastar tras el paso 5 (Acción del jugador) |

**Rango de salida:** 0 (maná absorbió todo) a 12 (sin maná, enemigo tiró 12).

**Ejemplo:** Enemigo tira 8. El jugador gastó 6 de maná, le quedan 4. Sin aliados. `daño_a_hp = max(0, 8-4) = 4`.

---

### Distribución de 2d6 (referencia de balance)

| Resultado | Probabilidad | Nota |
|---|---|---|
| 2 (snake eyes) | 1/36 ≈ 2.8% | Activa penalidad: estado Vergüenza |
| 3–6 | ~41.7% | Rango bajo — 0–2 cartas jugables |
| 7 (promedio) | 6/36 ≈ 16.7% | Valor central del diseño |
| 8–11 | ~38.9% | Rango alto — 2–3+ cartas jugables |
| 12 (doble 6) | 1/36 ≈ 2.8% | Activa bonus: roba 1 carta extra |

El jugador puede esperar 4–10 de maná en ~83% de los turnos. Los costos de cartas (0–3 por defecto) se calibran contra este rango — con 7 de maná promedio, el jugador puede jugar 2–3 cartas de costo moderado por turno.

## Edge Cases

- **Si un efecto de carta otorga maná a mitad de turno**: el `costo_efectivo` cacheado de las cartas en mano NO cambia (se calculó al robar). Sin embargo, `is_playable` SÍ se recalcula contra el nuevo `maná_actual`. Cartas antes injugables pueden volverse jugables. La UI trackea cambios en `maná_actual`, no en `costo_efectivo`.

- **Si el bonus de doble 6 (carta extra) ocurre con el mazo vacío**: se dispara el ciclo de mazo primero (descarte se baraja), luego se roba la carta extra del nuevo mazo. Si descarte también está vacío, el jugador no roba la carta bonus. Sin estado de error.

- **Si un efecto de carta reduce el HP del enemigo a 0 mientras hay ataques de aliados pendientes**: la victoria se declara inmediatamente. Ataques de aliados pendientes se cancelan. El encuentro termina en el primer evento que lleva HP del enemigo a 0.

- **Si el costo efectivo de todas las cartas en mano supera el maná disponible** (incluso con snake eyes = 2): el jugador mantiene los 2 de maná como escudo. Sin cartas jugables, el maná sin gastar sigue protegiendo. Este es el peor caso intencional del sistema — la agencia del jugador es conservar el escudo.

- **Si un efecto modifica los modificadores de costo de la Situación activa a mitad de turno**: el `costo_efectivo` cacheado NO se recalcula. El nuevo estado aplica en el próximo turno. Invariante: los costos son fijos desde el momento en que el jugador ve su mano.

- **Si el mazo tiene exactamente 4 cartas, el jugador roba 4, y luego saca doble 6**: el mazo llega a 0 durante el robo normal. La carta bonus dispara el ciclo (descarte se baraja), se roba del nuevo mazo. Resultado: 5 cartas en mano, ciclo transparente.

- **Si las cartas jugadas este turno ya están en el descarte cuando el mazo se agota**: las cartas jugadas van al descarte inmediatamente al resolverse (`Resolving → InDiscardPile`). El ciclo puede incluir cartas jugadas en el mismo turno. Mecánicamente correcto aunque puede sentirse contra-intuitivo.

- **Si un aliado absorbe el daño del enemigo y muere, y el overflow no se traslada**: el HP y el maná del jugador quedan intactos. Un aliado con 1 HP sigue siendo protección total por ese turno. Mientras exista cualquier aliado, el jugador no puede ser golpeado directamente ese turno.

- **Si el jugador tiene 0 cartas en mano y saca snake eyes**: estado Vergüenza se aplica normalmente. El jugador tiene 2 de maná como escudo, 0 cartas para jugar. Los modificadores de costo de Vergüenza afectan 0 cartas. Sin caso especial necesario.

- **Si el campo tiene 3 aliados y un efecto reduce el límite de campo**: el límite es restricción a nuevas invocaciones, no expulsión de aliados existentes. Los 3 aliados activos permanecen. Condición de "campo lleno": `aliados_en_campo >= LIMITE_CAMPO` (no `>`).

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| Data Configuration System | Este sistema depende | Lee `CardData` via `DataLoader.get_card()` para instanciar cartas del mazo. Única dependencia upstream. |
| Situation System | Depende de este | Provee modificadores de costo via `get_cost_modifiers(card_type, card_tags)`. Card System los aplica al cachear `costo_efectivo`. |
| Status Effect System | Depende de este | Provee modificadores de costo por estado del jugador via `get_card_cost_modifiers(card_type)`. Card System los aplica en el mismo paso de cálculo. |
| Combat System | Depende de este | Recibe signals `card_effect_resolved(type, params)` y `ally_summoned(AllyData)`. Gestiona el turno, ataques de aliados, y resolución de daño. Card System alimenta al Combat System con efectos; Combat System los ejecuta. |
| Enemy System | Dependencia de lectura | Card System lee `EnemySystem.get_current_intent()` en el paso 1 del turno. No afecta lógica del Card System. |
| Deck Building System | Depende de este | Lee el mazo actual y llama a `add_card()`, `remove_card()`, `upgrade_card()` post-encuentro. |
| Scene Management System | Evento | Card System escucha `SceneManager.transition_completed(ActiveEncounter)` para inicializar el estado del encuentro (mazo listo, mano vacía, maná en Idle). |

**⚠️ Retrofit pendiente al Data Config GDD**: agregar `AllyData` como quinto content type (`res://data/allies/allies.json`) y el efecto `summon_ally` al vocabulario de efectos. Ver Sección C para el schema completo.

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `HAND_SIZE` | 4 | 3–6 | Más opciones por turno, más tiempo de decisión | Menos opciones, decisiones más rápidas pero potencialmente frustrantes |
| `MANA_DICE_COUNT` | 2 (2d6) | 1–3 | Más varianza, campana más amplia | 1 dado = maná lineal, menos tensión económica |
| `MANA_DICE_SIDES` | 6 (d6) | 4–10 | Rango de maná más alto | Rango más bajo; costos de cartas deben escalar acordemente |
| `CARD_COST_MAX` | 3 | 2–6 | Cartas más poderosas y costosas, mayor tensión de gasto vs. escudo | Todas las cartas son casi gratuitas respecto al maná medio |
| `FIELD_LIMIT` | 3 | 1–5 | Más aliados simultáneos, mayor complejidad de campo | Estrategia de campo más simple |
| `STARTING_DECK_SIZE` | 10 | 8–15 | Mazo inicial más variado, ciclos más lentos | Ciclos más rápidos, el jugador ve sus cartas con más frecuencia |
| Bonus de doble 6 | Robar 1 carta extra | Variable | Puede reemplazarse por: +2 maná, robar 2 cartas, un aliado temporal | — |
| Penalidad de snake eyes | Estado Vergüenza 1 turno | Variable | Puede cambiarse por: descarta 1 carta, pierde 1 HP, sin penalidad | — |
| Daño mínimo de enemigo (2d6) | 2 | No reducir por debajo de 2 | Los enemigos siempre representan amenaza real | — |
| Daño máximo de enemigo (2d6) | 12 | No aumentar sin revisar HP del jugador | Turnos de alto riesgo frecuentes | Encuentros menos tensos |

## Visual/Audio Requirements

*Principio rector*: Cada evento del sistema tiene respuesta visual y sonora. Las visuales siguen el lenguaje de animación de art bible §7.4 (Snap/Thud/Spring/Directo) y el vocabulario semántico de color de §4. Los eventos 5, 6, 7 están completamente definidos en §7 — se referencian sin rediseñar.

| # | Evento | Feedback visual | Principio de arte | Categoría de audio | Prioridad |
|---|--------|----------------|-------------------|--------------------|-----------|
| 1 | Inicio de turno — tirada de dados | Dos dados dibujados a mano aparecen en zona central (Scale `0→1.2→1.0` Snap), ruedan con tween de fricción decreciente, se detienen. Número total en Dorado Caos `#F2B71F` flota sobre los dados (Scale `0→1.2→1.0`). Duración máxima: 0.4s | Squash/stretch en rebote de parada. Dados con borde irregular, trazo 2px Tinta. | Dos golpes de madera/hueso sobre tabla, deceleración audible, stop seco | HIGH |
| 2 | Snake eyes (resultado=2) | Flash Verde Absurdo 1 frame sobre dados. Ícono de estado Vergüenza sobre el Improvisador: Scale `0→1.3→1.0` Snap, forma redondeada (daltonismo: curva = cómico per §4). Número "2" en Dorado Caos aparece normal | Verde Absurdo = estado cómico per §4. Ícono con forma + texto "Vergüenza" | Cómico de fallo menor — slide descendente corto o pequeño "boing" | HIGH |
| 3 | Doble 6 (resultado=12) | Flash Dorado 1 frame. Número "12" +20% scale. La animación de carta extra (evento #4) se dispara 0.05s después | Dorado = algo que salió bien per §4. Stagger causa→efecto visible | Ding brillante — timbre metálico corto, tono ascendente. Diferente del robo normal | HIGH |
| 4 | Carta robada a la mano | Scale `0.0→1.1→1.0`, desde -20px Y. Stagger 0.05s entre cartas del batch. Curva Snap per §7.4. X de no-jugable aparece inmediatamente después si corresponde. La carta aparece ya inclinada al ángulo de su slot (±6°) | §7.4 "Carta aparece en mano". Slot define ángulo final — la carta no gira, aparece en posición | Slide suave de carta, stagger audible en el batch de 4 | HIGH |
| 5 | Carta seleccionada / hover | `position.y -=10`, `rotation→0°` en 0.08s Snap — **definido en §7.4, no se rediseña** | §7.4, §7.5 | Click suave o pop muy corto | HIGH |
| 6 | Carta jugada | Vuela en arco hacia el enemigo siguiendo su ángulo de rotación. Scale `1.0→0.6` al llegar. 0.2s Thud — **definido en §7.4, no se rediseña** | §7.4, §3.3 | Whoosh + impacto al resolver | HIGH |
| 7 | Carta marcada como no jugable | X de tinta Scale `0.0→1.3→1.0` en 0.1s — **definido en §7.4 y §3.3, no se rediseña** | §7.4, §3.3 | Trazo seco de pluma/lápiz sobre papel | HIGH |
| 8 | Maná actualizado | Cambio directo de sprite en la banda de Impulso (Directo per §7.4). Círculos Dorado→vacío al gastar, vacío→Dorado al recibir. Número Caption cambia simultáneamente por corte directo | Directo = feedback inmediato per §7.4. Dorado = recurso per §4. Glifo de chispa acompaña al color (daltonismo) | Al gastar: click seco metálico. Al recibir: chime corto funcional | HIGH |
| 9 | Maná usado como escudo (absorbe daño) | **Minimalista**: número de daño en Rojo Urgente aparece sobre el Improvisador + banda de Impulso baja simultáneamente (Directo). El contraste "bajó el Impulso" vs "bajó el HP" enseña la mecánica. Sin VFX de bloqueo separado. | Rojo Urgente = daño per §4. La separación visual entre banda de Impulso y barra de HP comunica qué absorbió el golpe | Impacto absorbido — diferente del hit directo al HP | HIGH |
| 10 | Aliado invocado | Sprite del aliado aparece en zona de campo: Scale `0.0→1.15→1.0` Snap, desde -15px Y. Delay 0.1s tras la llegada de la carta de invocación — secuencia causa→efecto visible | Snap per §7.4. Silueta del aliado: lenguaje angular = entidad del juego per §3.5 | Materialización — aire desplazado, algo "entra en escena". Tono medio-agudo, no épico | MEDIUM |
| 11 | Aliado ataca automáticamente | Sprite del aliado: micro-squash horizontal + dash ~20px hacia el enemigo y retorno. 0.3s total. Número de daño sobre el enemigo: Rojo Urgente, reglas exactas de §7.4 | Squash/stretch per §5.4. El dash es movimiento físico, no magia. Número de daño idéntico al de cartas | Hit breve — menos peso que el hit del jugador. El aliado es ayudante, no protagonista | MEDIUM |
| 12 | Ciclo de mazo | Ícono de pila de descarte: pulse Scale `1.0→1.1→1.0` (0.15s Spring). Flecha circular aparece brevemente (Scale `0→1→0` en 0.3s). Ícono del mazo nuevo recibe el mismo pulse. **Discreta** — no interrumpe el robo | Transparencia intencional del evento per GDD §6 | Shuffle breve (<0.3s) — cartas siendo barajadas en acelerado | MEDIUM |
| 13 | Fin de turno / descarte de mano | Cartas no jugadas se deslizan hacia la pila de descarte en stagger 0.05s. Scale `1.0→0.0` con movimiento hacia abajo-derecha. Curva Thud al llegar | Thud = movimiento con peso per §7.4. Movimiento hacia la pila refuerza topología del sistema | Slides en stagger + pequeño golpe al llegar a la pila | HIGH |

**Notas de implementación para audio:**
- Formato: SFX cortos en WAV per §8.1. Sin reverb de sala.
- Evento #6 (carta jugada): el hit puede tener 2–3 variantes por categoría de efecto — decisión del sound designer.
- Eventos #1 y #8 ocurren al inicio de turno (dados + Impulso). Asegurar que los sonidos sean distinguibles en capas.

## UI Requirements

La interfaz de la mano de cartas es el UI más crítico del juego — el jugador lo lee en cada turno bajo un timer de 10 segundos.

| Elemento de UI | Descripción | Especificado en |
|---|---|---|
| Mano de cartas (4 slots) | Fan con ángulos ±6° por slot, cartas con material de pergamino y tinta. Estados: idle, hover/seleccionada, no-jugable (X de tinta), jugada (sale en arco) | Art bible §7.5 "Franja inferior" + §7.4 |
| Banda de Impulso (maná) | N círculos en cuero, llenos = Dorado Caos + glifo de chispa, vacíos = Pergamino + trazo. Número Caption debajo siempre visible | Art bible §7.5 + §7.3 |
| Display de dados | Área de tirada en zona central despejada (§3.5). Dados dibujados a mano, resultado visible durante el turno | Este GDD §Visual/Audio evento #1 |
| Indicador de campo de aliados | Máximo 3 slots de aliado visibles. Estado: vacío / ocupado (sprite del aliado) | Diseño pendiente — Ver Open Questions |
| Indicador de pila de mazo/descarte | Conteo de cartas en el mazo y en el descarte, visibles permanentemente | Art bible §7.7 (Mapa del Mazo referenciado) |

> **📌 UX Flag — Card System**: Esta sistema tiene UI requirements complejos (mano de cartas, banda de maná, display de dados, campo de aliados). En Phase 4 (Pre-Production), ejecutar `/ux-design` para crear un UX spec para la pantalla de encuentro completa antes de escribir epics. Las historias que referencien UI deben citar `design/ux/encounter-screen.md`, no este GDD directamente.

## Cross-References

| Este documento referencia | Fuente | Elemento referenciado | Naturaleza |
|---|---|---|---|
| CardData schema (id, name, cost, type, tags, effects, upgradeable, upgraded_effects, rarity) | `design/gdd/data-configuration-system.md` | Schema completo de CardData | Dependencia de datos |
| Vocabulario de efectos tagueados (deal_damage, apply_status, draw_cards, etc.) | `design/gdd/data-configuration-system.md` | Sección C §4 | Dependencia de regla |
| `summon_ally` efecto + AllyData schema | `design/gdd/data-configuration-system.md` | **⚠️ RETROFIT PENDIENTE** — debe agregarse | Retrofit requerido |
| SceneManager.transition_completed(ActiveEncounter) | `design/gdd/scene-management-system.md` | Signal de transición | Trigger de estado |
| SceneManager.request_transition(Reward/Defeat/Victory) | `design/gdd/scene-management-system.md` | API de transición | Dependencia de estado |
| Valores de CanvasModulate por estado | `design/art/art-bible.md` §2 | Color de estados (verificar que los sprites de cartas sobreviven el grading de Jefe y Derrota) | Dependencia visual |
| Lenguaje de animación de cartas | `design/art/art-bible.md` §7.4, §3.3 | Timings, curvas, estados visuales de carta | Dependencia visual |

## Acceptance Criteria

Tests unitarios en `tests/unit/card-system/` (BLOCKING — Logic). Tests de integración en `tests/integration/card-system/` para AC-09 y AC-10 (Combat System). AC-14 es Performance — requiere hardware objetivo.

- **AC-01 (Secuencia de turno):** DADO un encuentro activo, CUANDO comienza un turno, ENTONCES los pasos se ejecutan en orden exacto: telegráfico → robo 4 cartas → tirada 2d6 → cache costos → acción jugador → ataque aliados → ataque enemigo → descarte. Ningún paso ocurre fuera de orden.

- **AC-02 (2d6 como única fuente de maná):** DADO el inicio de la fase de tirada, CUANDO el sistema resuelve 2d6, ENTONCES `mana_current` toma exactamente la suma (rango 2–12) y no existe otro mecanismo que establezca el maná inicial del turno.

- **AC-03 (Snake eyes = Vergüenza + maná 2):** DADO una tirada 2d6, CUANDO ambos dados muestran 1, ENTONCES el jugador recibe 2 de maná Y estado Vergüenza por 1 turno. El jugador puede gastar esos 2 de maná normalmente.

- **AC-04 (Doble 6 = maná 12 + carta extra):** DADO una tirada 2d6, CUANDO ambos dados muestran 6, ENTONCES el jugador recibe 12 de maná Y roba 1 carta extra inmediatamente. Si el mazo está vacío, se dispara el ciclo antes del robo extra. Si ambos mazo y descarte están vacíos, no se roba la carta sin generar error.

- **AC-05 (Costo efectivo cacheado al robo):** DADO que el jugador roba su mano, CUANDO el sistema cachea `costo_efectivo`, ENTONCES `costo_efectivo = max(0, costo_base + Σmod_situación + Σmod_estado)` y ese valor no cambia si los modificadores cambian durante el turno — solo aplica al próximo robo.

- **AC-06 (Costo efectivo nunca negativo):** DADO una carta con `costo_base=1`, modificador de Situación `-2`, modificador de Estado `-1`, CUANDO el sistema calcula `costo_efectivo`, ENTONCES el resultado es `max(0, 1-2-1) = 0`. El costo efectivo es 0, la carta es jugable con cualquier maná ≥ 0.

- **AC-07 (Carta no costeable rechazada sin penalidad):** DADO que el jugador tiene 3 de maná y una carta con `costo_efectivo=5`, CUANDO el jugador intenta jugarla, ENTONCES la acción no se ejecuta, la carta permanece en mano como inactiva, el maná no cambia, sin penalidad.

- **AC-08 (Maná residual = escudo 1:1):** DADO que el jugador termina su fase de acción con 4 de maná y no hay aliados, CUANDO el enemigo ataca con daño=7, ENTONCES `daño_a_hp = max(0, 7-4) = 3`, el HP baja exactamente 3, y `mana_current` llega a 0 (no negativo).

- **AC-09 (Aliado absorbe todo el daño, overflow se pierde):** DADO al menos un aliado en campo, CUANDO el enemigo ataca, ENTONCES un aliado aleatorio recibe la totalidad del daño. Si el daño supera el HP del aliado y muere, el exceso se descarta completamente — HP y maná del jugador no cambian ese turno.

- **AC-10 (Invocación emite signal y respeta límite de campo):** DADO campo con 2 aliados, CUANDO el jugador juega una carta de invocación con maná suficiente, ENTONCES Card System emite `ally_summoned(AllyData)` y la carta pasa a `Consumed` (sin referencia retenida al aliado). DADO campo con 3 aliados, CUANDO el jugador intenta jugar una carta de invocación, ENTONCES la carta es inactiva y no puede jugarse.

- **AC-11 (Ciclo de mazo transparente):** DADO mazo con 2 cartas y descarte con 6, CUANDO el jugador roba 4 cartas, ENTONCES el sistema roba 2 del mazo, baraja el descarte automáticamente, completa con 2 del nuevo mazo. El jugador termina con exactamente 4 cartas en mano. Sin estado de error visible.

- **AC-12 (Condiciones de victoria y derrota):** DADO HP del enemigo > 0, CUANDO un efecto lleva su HP a 0 o menos, ENTONCES la victoria se declara inmediatamente y ataques de aliados pendientes se cancelan. DADO HP del jugador > 0, CUANDO el daño lleva su HP a 0 o menos, ENTONCES la derrota se declara y el run termina.

- **AC-13 (Descarte al fin de turno):** DADO cartas en mano al completar la fase de acción, CUANDO el turno llega al paso de fin de turno, ENTONCES todas las cartas no jugadas van a `InDiscardPile`. Efectos de fin de turno resuelven en orden: cartas → reliquias → estados.

- **AC-14 (Performance — ciclo de turno < 16ms):** DADO mazo con 30 cartas, 4 en mano, 2 modificadores de Situación, 1 de Estado, y 3 aliados en campo, CUANDO el sistema ejecuta un turno completo, ENTONCES el tiempo de procesamiento lógico del Card System (excluye renderizado y animaciones) es inferior a 16ms en hardware mínimo objetivo.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿Las cartas de invocación van al descarte tras usarse, o se eliminan del mazo permanentemente? | Pendiente | Si van al descarte, el mazo puede invocar el mismo aliado múltiples veces por run. Si se eliminan (Consumed permanente), el jugador pierde el slot de mazo por el resto del run. Afecta la economy de Deck Building. Resolver antes de diseñar el Deck Building System GDD. |
| ¿El jugador tiene un historial visible de tiradas de dados de los turnos anteriores? | Diferido a UX | Potencialmente útil para aprendizaje de patrones. Decisión de UX, no de Card System. |
| ¿El timer de 10 segundos (Decisiones Rápidas) comienza antes o después de la animación de dados? | Pendiente — combate | El timer debe empezar cuando el jugador tiene información suficiente para decidir (después de ver dados + mano). Si la animación de dados tarda 0.4s, el timer empieza al finalizar. Confirmar con Combat System GDD. |
| ¿Cómo funciona el "mejorar carta" del Deck Building System respecto a `upgraded_effects`? | Diferido al Deck Building GDD | CardData tiene `upgraded_effects` (array de efectos). Card System expone `upgrade_card(id)` que intercambia los efectos. Los detalles de qué constituye una "mejora" son del Deck Building System. |
| ¿El display de campo de aliados tiene slots fijos (3 slots siempre visibles) o slots dinámicos (aparecen al invocar)? | Diferido a UX | Slots fijos son más predecibles visualmente (el jugador sabe cuánto espacio tiene). Slots dinámicos son más limpios cuando no hay aliados. Resolver en `/ux-design encounter-screen`. |
