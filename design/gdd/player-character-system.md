---
sidebar_position: 8
title: Sistema de Personaje Jugador
description: El Improvisador — stats, HP, mazo inicial, y la mecánica de Idea Brillante que convierte los estados negativos en poder.
---

# Player Character System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-18
> **Implements Pillar**: Caos como Oportunidad · Caos Ordenado

## Overview

El Player Character System define a El Improvisador — el único personaje jugable en MVP — como una entidad de juego con tres propiedades fundamentales: su HP máximo, su mazo inicial de 10 cartas, y su mecánica especial "Idea Brillante". HP determina cuánto daño puede absorber antes de que el run termine en derrota; el mazo inicial define el conjunto de herramientas con que el jugador empieza cada run; e Idea Brillante es el contador que acumula cada vez que el jugador recibe un estado negativo y que, al alcanzar un umbral, otorga un beneficio inmediato.

La identidad de diseño del sistema es la conversión del caos en oportunidad. La mecánica de Idea Brillante hace que los estados negativos (Vergüenza, Sospechoso) que el jugador debería querer evitar sean en cambio combustible: cada estado negativo aplicado acumula Idea Brillante, y el jugador que acepta el caos estratégicamente puede desencadenar efectos que el jugador que solo evita estados nunca activa. El personaje es literalmente más poderoso cuando le va mal.

Sin este sistema el juego pierde su identidad central: las Situaciones se convierten en modificadores de costo sin corazón, los estados negativos son solo castigos, y el loop de "caos → oportunidad" desaparece. El Player Character System es lo que hace que la promesa del juego — que el aventurero incompetente convierte cada desastre en victoria — sea verdad mecánica, no solo texto de sabor.

## Player Fantasy

El Improvisador no es bueno en esto. Lo que pasa es que estar mal en esto resulta ser, casualmente, la estrategia correcta.

La fantasía no es poder — es vindicación. El jugador acumula Vergüenza, recibe Sospechoso encima, y en el momento en que todo parece perdido, el sistema le devuelve una Idea Brillante: de repente hay una jugada que antes no existía, y resulta que era exactamente la que necesitaba. El caos no era un obstáculo — era el plan. En retrospectiva.

El "¡EUREKA!" del desastrado es el momento central de la experiencia. No es "calculé bien", no es "lo optimicé" — es "no puedo creer que eso funcionó, pero tiene todo el sentido del mundo ahora que lo pienso". Es el instante donde el humor emerge no del jugador fallando, sino de que el caos, inexplicablemente, validó sus peores instintos. El Improvisador es cómplice del universo en una broma cuyo remate fue una victoria.

Si el sistema falla en entregar esto, Idea Brillante se convierte en un contador de puntos vacío. El jugador activa el umbral y piensa "bien, bono". Los estados negativos pasan a ser castigos con descuento — sigue siendo malo recibirlos, y el beneficio no compensa la incomodidad. El personaje pierde su identidad: ya no es el genio del desastre, es solo un aventurero con peor DPS que acumula bonos por castigo.

## Detailed Design

### Core Rules

**1. Propiedades de El Improvisador**

El Improvisador tiene exactamente tres propiedades en MVP:

- **`hp_actual`**: HP corriente durante el run. Inicia en `HP_BASE` (40) al comenzar un run nuevo. Persiste entre encuentros — no se resetea entre combates.
- **`deck_inicial`**: Lista de 10 IDs de carta cargada desde `player_characters.json` via DataLoader. Define el mazo con el que el jugador empieza cada run. No cambia a lo largo del run (las modificaciones de mazo son del Deck Building System).
- **`ib_counter`**: Contador entero de Idea Brillante. Inicia en 0 al comienzo de cada encuentro. Se resetea a 0 al final de cada encuentro (no persiste entre combates).

No hay stat de ataque, defensa, ni velocidad separado del personaje. Todo el poder ofensivo viene de las cartas.

---

**2. Mecánica de Idea Brillante**

El Player Character System escucha `StatusEffectSystem.negative_status_applied_to_player(status_id, stack_delta)`. Solo los estados clasificados como negativos emiten esta señal (Vergüenza y Sospechoso en MVP; Confianza Excesiva e Inspirado NO).

Cada vez que llega la señal:

1. `ib_counter += stack_delta`
2. Calcular `disparos = floor(ib_counter / IB_UMBRAL)`
3. Si `disparos > 0`: emitir `signal idea_brillante_triggered(cards_to_draw = disparos * IB_CARDS_POR_DISPARO)` y `ib_counter = ib_counter mod IB_UMBRAL`

El Card System escucha `idea_brillante_triggered(cards_to_draw)` y roba esa cantidad de cartas inmediatamente, con las mismas reglas del ciclo de mazo del Card System (si el mazo se agota, se baraja el descarte).

**Condiciones de disparo múltiple**: Si un único `stack_delta` lleva el contador a ≥ 2 × `IB_UMBRAL`, se disparan múltiples robos en el mismo frame. En la práctica el cap de estados (Vergüenza=3, Sospechoso=3) hace casi imposible superar 1 × umbral en un solo delta, pero la fórmula lo maneja correctamente sin caso especial.

**Reset al inicio del encuentro**: cuando `SceneManager.transition_completed(ActiveEncounter)` llega, el Player Character System resetea `ib_counter = 0` antes de que el encuentro comience. Cualquier IB no disparado del encuentro anterior se pierde.

---

**3. HP y daño**

El Combat System llama `take_damage(amount: int)` para aplicar daño al HP:

`hp_actual_new = max(0, hp_actual - amount)`

Si `hp_actual_new == 0`, el sistema emite `signal player_died()` en el mismo frame. El Combat System escucha esta señal y desencadena el flujo de GameOver via SceneManager.

HP se puede restaurar via `heal(amount: int)`:

`hp_actual_new = min(HP_BASE, hp_actual + amount)`

No hay overhealing — HP nunca supera `HP_BASE`. La curación viene exclusivamente de efectos externos (nodos de descanso del Node Map System, ciertos efectos de carta). El Player Character System no se cura a sí mismo.

---

**4. Carga desde datos**

Al iniciar un run nuevo, el Player Character System lee `PlayerCharacterData` del DataLoader:
- `id: "el_improvisador"`
- `hp_base: 40`
- `starting_deck: Array[String]` — lista de 10 IDs de carta del mazo inicial

Los valores en datos son la fuente de verdad. Los constantes de código (`HP_BASE`, `IB_UMBRAL`, `IB_CARDS_POR_DISPARO`) son su versión runtime.

---

### States and Transitions

| Estado | Descripción | Transiciones válidas |
|---|---|---|
| `Alive` | `hp_actual > 0`. Gameplay normal. Todos los sistemas operan con normalidad. | → `Dead` cuando `take_damage()` resulta en `hp_actual == 0` |
| `Dead` | `hp_actual == 0`. Run termina. | Estado terminal. `player_died` emitido → SceneManager transiciona a GameOver. |

**Estado del IB counter (valor, no state machine):**

| Fase | Condición | Descripción |
|---|---|---|
| Acumulando | `0 ≤ ib_counter < IB_UMBRAL` | Normal. Cada estado negativo suma. |
| Disparando | `ib_counter ≥ IB_UMBRAL` | Signal emitida, counter = mod residuo. Puede volver a Acumulando inmediatamente si el residuo > 0. |
| Reseteado | `ib_counter == 0` | Al inicio de cada encuentro o después de un disparo sin residuo. |

---

### Interactions with Other Systems

| Sistema | Qué hace el Player Character System | Interface |
|---|---|---|
| **DataLoader** | Lee `PlayerCharacterData` al iniciar un run nuevo | `DataLoader.get_player_character("el_improvisador") → PlayerCharacterData` |
| **Status Effect System** | Escucha la señal de estados negativos para acumular IB | Escucha: `StatusEffectSystem.negative_status_applied_to_player(status_id, stack_delta)` |
| **Card System** | Emite señal cuando IB se dispara; Card System roba las cartas | `signal idea_brillante_triggered(cards_to_draw: int)` |
| **Combat System** | Expone `take_damage()`, `heal()`, `get_hp()`. Emite `player_died` cuando HP llega a 0. | `take_damage(amount: int)`, `heal(amount: int)`, `get_hp() → int`, `signal player_died()` |
| **Scene Management** | Escucha transition para resetear IB counter al iniciar encuentro | Escucha: `SceneManager.transition_completed(ActiveEncounter)` → resetea `ib_counter = 0` |
| **HUD/UI** | Expone HP e IB counter en tiempo real para display | `get_hp() → int`, `get_ib_counter() → int`, `signal hp_changed(new_hp)`, `signal ib_counter_changed(new_ib)` |

## Formulas

### Fórmula 1: Acumulación de Idea Brillante

`ib_counter_new = ib_counter + stack_delta`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `ib_counter` | int | 0–(`IB_UMBRAL` - 1) | Valor del contador antes de recibir la señal |
| `stack_delta` | int | 1–`IB_UMBRAL` | Stacks a sumar, enviados por `negative_status_applied_to_player` |
| `IB_UMBRAL` | int const | 5 | Umbral de disparo |
| `ib_counter_new` | int | 0–∞ | Valor intermedio antes de resolución del umbral |

No se clampea aquí — puede superar `IB_UMBRAL`. La Fórmula 2 resuelve el umbral inmediatamente.

**Ejemplo:** `ib_counter = 3`, `stack_delta = 2` → `ib_counter_new = 5`.

---

### Fórmula 2: Disparo y Reset del Umbral

```
disparos        = floor(ib_counter_new / IB_UMBRAL)
ib_counter_post = ib_counter_new mod IB_UMBRAL
cartas_robadas  = disparos × IB_CARDS_POR_DISPARO
```

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `ib_counter_new` | int | 0–∞ | Salida de Fórmula 1 |
| `IB_UMBRAL` | int const | 5 | Umbral de disparo y divisor |
| `IB_CARDS_POR_DISPARO` | int const | 2 | Cartas robadas por cada disparo |
| `disparos` | int | 0–N | Veces que se cruzó el umbral en este frame |
| `ib_counter_post` | int | 0–4 | Residuo conservado para la próxima acumulación |
| `cartas_robadas` | int | 0–N×2 | Cartas a robar inmediatamente |

**El reset es parcial** — el residuo se conserva, no se descarta.

**Ejemplo A (disparo simple):** `ib_counter_new = 5` → `disparos = 1`, `ib_counter_post = 0`, `cartas_robadas = 2`.

**Ejemplo B (doble disparo):** `ib_counter = 2`, `stack_delta = 8` → `ib_counter_new = 10` → `disparos = 2`, `ib_counter_post = 0`, `cartas_robadas = 4`.

**Ejemplo C (sin disparo):** `ib_counter = 1`, `stack_delta = 2` → `ib_counter_new = 3` → `disparos = 0`, `ib_counter_post = 3`, `cartas_robadas = 0`.

---

### Fórmula 3: Daño al HP del Jugador

`hp_actual_new = max(0, hp_actual - daño_a_hp)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `hp_actual` | int | 0–`HP_BASE` | HP antes del golpe |
| `HP_BASE` | int const | 40 | HP máximo; valor inicial al comenzar el run |
| `daño_a_hp` | int | 0–12 | Daño neto tras absorción de maná (definido en Card System GDD) |
| `hp_actual_new` | int | 0–`HP_BASE` | HP resultante |

**Ejemplo:** `hp_actual = 18`, `daño_a_hp = 7` → `11`. Clampeo: `hp_actual = 3`, `daño_a_hp = 9` → `0`.

---

### Fórmula 4: Curación

`hp_actual_new = min(HP_BASE, hp_actual + heal_amount)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `hp_actual` | int | 0–`HP_BASE` | HP antes de curar |
| `heal_amount` | int | 1–`HP_BASE` | Cantidad a curar |
| `hp_actual_new` | int | 0–`HP_BASE` | HP resultante; sin overhealing |

**Ejemplo:** `hp_actual = 30`, `heal_amount = 15` → `min(40, 45) = 40`.

---

### Fórmula 5: Condición de Derrota

`derrota = (hp_actual_new == 0)`

Se evalúa exactamente una vez, inmediatamente después de aplicar Fórmula 3. Si `true`, se emite `signal player_died()` y el run termina antes de cualquier otra acción del jugador.

## Edge Cases

- **Si `ib_counter` tiene residuo (ej: 3) al finalizar un encuentro**: el residuo se pierde al inicio del próximo encuentro (reset a 0). Los puntos no disparados no se llevan al siguiente combate.

- **Si dos estados negativos son aplicados en el mismo frame del mismo turno**: el Player Character System procesa cada señal `negative_status_applied_to_player` secuencialmente. Puede dispararse Idea Brillante dos veces en el mismo frame si dos aplicaciones sucesivas cruzan el umbral en cadena.

- **Si la señal llegaría con `stack_delta = 0` (cap lleno)**: el Status Effect GDD ya documenta que la señal NO se emite cuando el cap está lleno. El Player Character System no necesita manejar este caso — la señal simplemente no llega.

- **Si IB se dispara en el mismo frame en que HP llega a 0**: La derrota se evalúa al recibir `take_damage()`. Si `player_died` es emitido, el run termina — el robo de cartas de IB del mismo frame se cancela. La muerte tiene prioridad.

- **Si el Card System intenta robar cartas por IB pero el mazo Y el descarte están vacíos**: Sigue las reglas del ciclo de mazo del Card System — no hay error, el jugador roba lo disponible (puede ser 0). El disparo de IB fue correcto; el robo incompleto es comportamiento válido definido en Card System GDD.

- **Si `heal(amount)` es llamado con HP ya en `HP_BASE`**: `min(40, 40 + amount) = 40`. HP no cambia. La señal `hp_changed` no se emite si el valor no varió.

- **Si `take_damage(0)` es llamado**: `max(0, hp - 0) = hp`. HP no cambia. `player_died` no se emite. El Combat System debería evitar llamadas con damage = 0.

- **Si el run inicia (nuevo run, no nuevo encuentro)**: `hp_actual` se setea a `HP_BASE`, `ib_counter` se setea a 0. No hay residuo de un run anterior.

- **Si Inspirado es aplicado al jugador**: Inspirado NO es negativo — la señal `negative_status_applied_to_player` no se emite. `ib_counter` no cambia. El Player Character System nunca procesa la aplicación de Inspirado.

- **Si IB dispara `cartas_robadas = 2` con el jugador ya con 4 cartas en mano**: El robo de IB no está limitado por `HAND_SIZE`. El jugador puede tener temporalmente 5–6 cartas en mano cuando IB dispara fuera del turno de robo. Interacción emergente intencional.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| Data Configuration System | Este sistema depende | Lee `PlayerCharacterData` via `DataLoader.get_player_character()`. Sin DataLoader no puede cargar HP ni mazo inicial. Dependencia upstream dura. |
| Card System | Bidireccional | Este sistema emite `idea_brillante_triggered(cards_to_draw)` que el Card System escucha para ejecutar el robo. El `deck_inicial` (10 cartas) es gestionado por el Card System una vez cargado. |
| Status Effect System | Este sistema depende | Escucha `StatusEffectSystem.negative_status_applied_to_player(status_id, stack_delta)` para acumular IB. Sin esta señal, IB nunca acumula. |
| Combat System | Depende de este | Llama `take_damage(amount)` y `heal(amount)`. Escucha `signal player_died()` para gestionar GameOver. Lee `get_hp()` para evaluaciones de daño. |
| Scene Management System | Evento | Escucha `SceneManager.transition_completed(ActiveEncounter)` para resetear `ib_counter = 0` al iniciar cada encuentro. |
| HUD/UI | Depende de este | Lee `get_hp()` y `get_ib_counter()`. Escucha `signal hp_changed(new_hp)` y `signal ib_counter_changed(new_ib)` para actualizaciones en tiempo real. |

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `HP_BASE` | 40 | 20–60 | El jugador aguanta más encuentros con daño acumulado — menos tensión por resource management | El jugador muere antes de llegar al jefe — mayor presión, posiblemente frustrante en runs iniciales |
| `IB_UMBRAL` | 5 | 3–10 | IB se dispara con menos frecuencia — momentos más raros y épicos | IB se dispara casi en cada estado negativo — pierde el peso del "EUREKA" |
| `IB_CARDS_POR_DISPARO` | 2 | 1–3 | Más cartas por disparo — IB más explosiva, mayor varianza | 1 carta — más sutil; 3+ cartas — demasiado disruptivo para el balance de mano |
| Mazo inicial (cantidad) | 10 | 8–12 | Ver `starting_deck_size` en Card System GDD — misma propiedad | — |

*`starting_deck_size = 10` es propiedad del Card System GDD. Este sistema respeta ese valor sin redefinirlo.*

## Visual/Audio Requirements

*Principio rector: El Improvisador es reactivo, no telegráfico — sus animaciones son de consecuencia, no de intención. El Dorado `#F2B71F` es su color exclusivo en combate, particularmente para Idea Brillante.*

| Evento | Visual | Color | Audio | Prioridad |
|---|---|---|---|---|
| Idle durante encuentro | Spring loop, ~3-4s/ciclo. Oscilación de peso de un pie al otro. Micro-movimiento de ceja cada ~6s. Nunca en guardia, nunca quieto del todo. | Ninguno — estado base | Ambiental muy suave (shuffle, opcional). No triggereado. | MEDIUM |
| Recibe daño | **Thud**, ~0.4s. Desplazamiento 8-10px, squash vertical ~15%, spring back. Mueca de sorpresa molesta, no dolor heroico. | Flash de Rojo Urgente `#D94444` en modo aditivo, ~0.05s | "Tunk" sordo con pitch ascendente — bongo suave, ~0.3s. Slapstick, no violencia. | HIGH |
| HP crítico (≤10 HP) | Temblor leve continuo (~12hz) como capa sobre idle. Traspié casi-caída cada ~4s que se corrige. Postura obstinada, no asustada. | Rim glow pulsante Rojo Urgente `#D94444`, ~1Hz | Loop suave de estado (respiración entrecortada). Al entrar: "thud" de bajo rango + silencio dramático. | HIGH |
| Muere (HP = 0) | **3 beats:** (1) hit final + squash extremo + ojos en X (**Directo**, ~0.15s); (2) pausa de incredulidad — oscila y mira al jugador "¿en serio?" (~0.35s); (3) cae al piso con **Thud** + estrellitas orbitando en loop | Beat 3: flash Rojo Urgente. Estrellitas: Dorado `#F2B71F` (irónico) | Beat 1: impacto sordo. Beat 2: silencio + chirrido descendente. Beat 3: THUD + polvo + tintineo en loop | HIGH |
| Idea Brillante dispara | **CRITICAL.** Snap `1.0→0→1.3→1.0`, ~0.15s. Ojos abiertos. Outline del sprite +2px. Rayo de idea estilo tinta expresiva con Snap. Activo: rayo orbita en Spring lento (~2s/ciclo), postura "pecho afuera + dedo levantado" overrides idle. | Dorado `#F2B71F` dominante. Flash de Verde Absurdo `#6BBF5E` en el momento de Snap. | (1) "ding" de campana aguda ~0.1s; (2) stinger musical ascendente 0.5-1.0s — único momento del personaje que rompe en espacio musical; (3) zumbido suave en loop mientras IB cargada | CRITICAL |
| Recibe estado negativo | Ícono con Snap `0→1.2→1.0`. Vergüenza = encogimiento + rubor de tinta. Sospechoso = miradas nerviosas izquierda-derecha + fingir normalidad. Borde Dorado pulsante en el ícono señaliza que suma hacia IB. | Verde Absurdo `#6BBF5E` para el estado. Rojo Urgente en ícono si también causa daño. | Vergüenza: "boing" descendente suave. Sospechoso: silbido nervioso cortísimo. ~0.2s | HIGH |

> **📌 Asset Spec** — Visual/Audio definidos. Ejecutar `/asset-spec system:player-character-system` para producir specs de assets, resoluciones y prompts de generación.

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| Barra de HP | Siempre visible durante el encuentro. Muestra `hp_actual / HP_BASE`. Cambia visualmente al entrar en estado crítico (≤10 HP). | Art bible §7.5 (HUD layout de encuentro) |
| Contador de IB | Barra o contador progresivo 0–`IB_UMBRAL` (5). Muestra cuánto falta para el próximo disparo de Idea Brillante. Legible en la ventana de decisión de 10 segundos. | Este GDD §Visual/Audio, §Formulas |
| Sprite de El Improvisador | Zona del encuentro con los estados visuales definidos (idle, daño, crítico, IB activa, muerte). Íconos de estado sobre el sprite (definidos en Status Effect GDD). | Art bible §7.5, Status Effect GDD §UI Requirements |

> **📌 UX Flag — Player Character System**: Este sistema tiene UI requirements en el HUD del encuentro (HP, IB counter, sprite con estados). En Phase 4 (Pre-Production), ejecutar `/ux-design encounter-screen` para definir el layout exacto. Las historias de UI deben citar `design/ux/encounter-screen.md`.

## Acceptance Criteria

Tests unitarios en `tests/unit/player-character-system/` (BLOCKING — Logic). Tests de integración para AC-08, AC-15, AC-16 en `tests/integration/player-character-system/` (BLOCKING).

- **AC-01 (Init HP al run):** DADO run nuevo, CUANDO Player Character System carga desde DataLoader, ENTONCES `hp_actual = 40` e `ib_counter = 0`.

- **AC-02 (HP persiste entre encuentros):** DADO `hp_actual = 27` al terminar un encuentro, CUANDO `transition_completed` llega, ENTONCES `hp_actual` sigue en 27 — no se resetea.

- **AC-03 (IB reset al inicio de encuentro):** DADO `ib_counter = 3` al finalizar un encuentro, CUANDO `transition_completed` llega, ENTONCES `ib_counter = 0` — el residuo se descarta.

- **AC-04 (IB acumula sin disparar):** DADO `ib_counter = 1`, CUANDO `negative_status_applied_to_player("vergüenza", 2)`, ENTONCES `ib_counter = 3`, sin `idea_brillante_triggered`, sin robo.

- **AC-05 (IB disparo — umbral exacto):** DADO `ib_counter = 3`, CUANDO `negative_status_applied_to_player("vergüenza", 2)`, ENTONCES se emite `idea_brillante_triggered(2)` y `ib_counter = 0`.

- **AC-06 (IB disparo — con residuo):** DADO `ib_counter = 2`, CUANDO `negative_status_applied_to_player("sospechoso", 4)`, ENTONCES `disparos = 1`, se emite `idea_brillante_triggered(2)`, `ib_counter = 1` (residuo 6 mod 5).

- **AC-07 (IB doble disparo en un delta):** DADO `ib_counter = 0`, CUANDO `negative_status_applied_to_player("vergüenza", 10)`, ENTONCES `disparos = 2`, se emite `idea_brillante_triggered(4)`, `ib_counter = 0`.

- **AC-08 (Dos estados negativos en el mismo frame):** DADO `ib_counter = 3`, CUANDO en el mismo frame llegan `negative_status_applied_to_player("vergüenza", 2)` y luego `negative_status_applied_to_player("sospechoso", 3)`, ENTONCES el primer evento dispara IB (`ib_counter = 0`), el segundo acumula sin disparar (`ib_counter = 3`). `idea_brillante_triggered` emitida exactamente una vez. *(Nota: orden asume procesamiento secuencial — verificar con CONNECT_DEFERRED en implementación.)*

- **AC-09 (Inspirado no acumula IB):** DADO cualquier `ib_counter`, CUANDO Inspirado es aplicado al jugador, ENTONCES `negative_status_applied_to_player` no se emite (responsabilidad del Status Effect System) e `ib_counter` no cambia.

- **AC-10 (Daño — clampeado a 0):** DADO `hp_actual = 5`, CUANDO `take_damage(9)`, ENTONCES `hp_actual = 0`. HP nunca resulta negativo.

- **AC-11 (Derrota emite signal):** DADO `hp_actual = 3`, CUANDO `take_damage(3)`, ENTONCES `hp_actual = 0` y `signal player_died()` se emite en el mismo frame antes de cualquier otra acción.

- **AC-12 (take_damage(0) no emite player_died):** DADO `hp_actual = 15`, CUANDO `take_damage(0)`, ENTONCES HP no cambia y `player_died` no se emite.

- **AC-13 (Curación sin overhealing):** DADO `hp_actual = 30`, CUANDO `heal(15)`, ENTONCES `hp_actual = min(40, 45) = 40`.

- **AC-14 (Curación en HP_BASE no emite signal):** DADO `hp_actual = 40`, CUANDO `heal(5)`, ENTONCES `hp_actual = 40` y `hp_changed` no se emite.

- **AC-15 (Muerte tiene prioridad sobre IB):** DADO `hp_actual = 2` e `ib_counter = 3`, CUANDO en el mismo frame `take_damage(2)` y `negative_status_applied_to_player("vergüenza", 2)`, ENTONCES `player_died()` se emite y el robo de IB del mismo frame no ocurre. *(Nota: mecanismo exacto de bloqueo a definir en implementación.)*

- **AC-16 (IB con mano llena — robo ocurre igual):** DADO jugador con 4 cartas en mano e `ib_counter = 3`, CUANDO `negative_status_applied_to_player("vergüenza", 2)`, ENTONCES `idea_brillante_triggered(2)` se emite y el Card System roba 2 cartas. La mano puede superar `HAND_SIZE` temporalmente. Sin cancelación ni error.

- **AC-17 (signal hp_changed):** DADO `hp_actual = 20`, CUANDO `take_damage(5)`, ENTONCES `hp_changed(15)` se emite con el nuevo valor.

- **AC-18 (signal ib_counter_changed):** DADO `ib_counter = 2`, CUANDO `negative_status_applied_to_player("vergüenza", 1)`, ENTONCES `ib_counter_changed(3)` se emite. Al disparar IB, `ib_counter_changed` se emite con el valor post-reset.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿Cuáles son las 10 cartas del mazo inicial? | Pendiente — content work | La composición del deck inicial es contenido, no regla de sistema. Definir durante prototipo junto con el diseño de las 20 cartas MVP. Debe incluir variedad de tipos de carta. |
| ¿Cómo se cura HP entre encuentros? | Pendiente — Node Map GDD | El Player Character System no define curación autónoma. La mecánica de descanso es responsabilidad del Node Map System GDD (#11). Hasta entonces, HP no se puede curar entre encuentros. |
| ¿El retrofit de `PlayerCharacterData` al Data Config GDD es requerido antes de implementar? | Pendiente — retrofit | El Data Config GDD no tiene un schema de `PlayerCharacterData`. Requiere retrofit con: `id`, `hp_base`, `starting_deck: Array[String]`. Agregar antes de la primera historia de implementación. |
| ¿La señal `negative_status_applied_to_player` puede suprimirse por mecánicas del personaje? | Diferido post-MVP | En MVP no hay supresión. La única supresión existente es cuando el cap de estado está lleno (Status Effect GDD). Cualquier mecánica de mitigación es post-MVP. |
