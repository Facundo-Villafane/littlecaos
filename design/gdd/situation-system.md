---
sidebar_position: 7
title: Sistema de Situaciones
description: El corazón diferencial del juego — reglas de campo narrativas que cambian el significado y efectividad de cada carta por encuentro.
---

# Situation System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-17
> **Last Verified**: 2026-05-17
> **Implements Pillar**: Situaciones como Escenario Narrativo · Caos Ordenado · Caos como Oportunidad · Rejugabilidad por Combinaciones

## Overview

El Situation System es el escenario narrativo que envuelve cada encuentro: el contexto social o absurdo que hace que las mismas cartas signifiquen cosas distintas. Cuando el jugador entra a un encuentro con "Audiencia Real" activa, "Mentira Convincente" tiene más peso que un golpe físico; el mismo mazo con "Monstruo Tímido" activo convierte los ataques directos en la peor opción. El sistema no cambia las reglas de combate — cambia la *lectura* de cada carta.

Técnicamente, el Situation System mantiene la Situación activa del encuentro en curso y expone la interface `get_cost_modifiers(card_type, card_tags) → Array[delta: int]` que el Card System consulta al inicio de cada turno para calcular el `costo_efectivo` de cada carta en mano. Además, define las condiciones de victoria alternativas que el Combat System evalúa en paralelo al objetivo estándar de HP = 0. Las Situaciones son enteramente data-driven: cada una es un recurso de datos con un nombre, una regla de campo en una línea, un conjunto de modificadores de costo por tipo y tag de carta, y opcionalmente una condición de victoria alternativa.

El jugador puede leer la Situación activa antes de tomar cualquier decisión de turno, y puede — a través de ciertas cartas o mecánicas del encuentro — modificarla o interactuar activamente con ella durante el combate. Sin este sistema el juego pierde su diferencial central: las cartas se vuelven herramientas genéricas de combate, cada encuentro se ve igual con el mismo mazo, y la rejugabilidad por combinaciones desaparece porque las combinaciones ya no producen lecturas distintas.

## Player Fantasy

Tu mano está llena de malas ideas. El encuentro tiene una regla rara. Y en el momento en que las ponés juntas — cuando jugás *"Toser Incómodamente"* en "Banquete del Conde Paranoico" y funciona — te das cuenta de que no fue suerte. Fue que leíste la sala.

El Situation System vive en ese instante. El jugador no llega a cada encuentro con un plan optimizado; llega con un mazo construido para otra cosa, y de repente la Situación activa le muestra que una de sus cartas "basura" era exactamente lo que este escenario pedía. La victoria no viene de ser el mejor deckbuilder del cuarto — viene de haber elegido, entre todas tus malas ideas, la que la escena estaba esperando.

El feeling central no es "soy poderoso gracias a mis cartas". Es "soy poderoso gracias a dónde estoy parado". La Situación es el setup; el jugador pone el remate. Y la satisfacción es doble: descubriste el patrón (puedo internalizar esto), y lo aprovechaste justo cuando importaba (aunque el caos lo haya servido en bandeja).

Las microhistorias emergentes del juego — "la vez que le gané al ogro con un discurso motivacional innecesario" — solo existen si el Situation System entrega esta sensación. Si falla, el jugador lee la Situación como un modifier de stats y evalúa matemáticamente qué carta maximiza su daño. Las Situaciones dejan de ser escenas y se convierten en boosts condicionales — el juego pierde su identidad y gana un clon de Slay the Spire con menos cartas y más texto de sabor.

## Detailed Design

### Core Rules

**1. Estructura data-driven de una Situación**

Cada Situación es un `SituationData` Resource con los siguientes campos:

```gdscript
class_name SituationData
extends Resource

@export var id: String = ""
@export var name: String = ""
@export var flavor_text: String = ""   # 1 línea que el jugador lee en el encuentro
@export var rule_text: String = ""     # regla mecánica ≤ 120 chars

## Modificadores de costo — pasivos, evaluados cada turno
## Cada entry: { "filter_type": "tag"|"card_type", "value": String, "delta": int }
@export var cost_modifiers: Array[Dictionary] = []

## Victoria alternativa
@export var has_alt_victory: bool = false
@export var alt_victory_type: String = ""   # "survive_turns" | "reduce_status_to_zero" |
                                             # "play_n_distinct_types" | "play_card_type_n_times"
@export var alt_victory_params: Dictionary = {}

## Efectos de trigger — apply/remove estados en triggers de turno
## Cada entry: { "trigger": String, "condition": {}, "effects": Array }
@export var trigger_effects: Array[Dictionary] = []

## Modificadores de comportamiento de enemigo
## Cada entry: { "type": String, ... }
@export var enemy_behavior_modifiers: Array[Dictionary] = []

## Interacción activa — Tag-bonus inmediato
@export var interaction_tag: String = ""           # "" = mecanismo inactivo
@export var interaction_bonus_effects: Array[Dictionary] = []

## Interacción activa — Track con umbral
@export var track_enabled: bool = false
@export var track_trigger_tags: Array[String] = []
@export var track_points_per_play: int = 1
@export var track_max_points: int = 0
@export var track_threshold: int = 0
@export var track_effects: Array[Dictionary] = []
```

---

**2. Selección y carga por encuentro**

Al recibir `SceneManager.transition_completed(ActiveEncounter)`, el SituationSystem:
1. Lee `ActiveEncounter.situation_id`. Si está vacío, selecciona aleatoriamente del pool completo.
2. Carga `SituationData` via `DataLoader.get_situation(id)`.
3. Inicializa el estado de runtime (contadores de Track, contadores de alt_victory, `enemy_id` para `reduce_status_to_zero`).
4. Ejecuta los efectos con `trigger: "on_encounter_start"`.
5. Emite `situation_loaded(situation_data)`.

El pool en MVP es el conjunto completo de Situaciones disponibles — sin filtrado por acto ni por tipo de nodo.

---

**3. Efectos de costo (pasivos)**

`get_cost_modifiers(card_type, card_tags) → Array[int]` recorre `cost_modifiers` de la Situación activa. Por cada entry cuyo filtro aplica a la carta consultada, agrega `delta` al array resultado.

Filtros soportados:
- `{ "filter_type": "tag", "value": "social", "delta": -1 }` — aplica a cartas con ese tag
- `{ "filter_type": "card_type", "value": "invocacion", "delta": +1 }` — aplica por tipo de carta

Si el Track cruzó su umbral y sus `track_effects` incluyen `cost_modifier`, esos deltas también se incluyen en el array. El Card System recibe el array resultante sin saber qué parte viene del Track y qué parte del modificador base.

---

**4. Efectos de trigger**

El Combat System llama `fire_trigger(trigger_id)` en los momentos adecuados. El SituationSystem dispara los `trigger_effects` cuyo trigger coincide y cuya condición (si tiene) evalúa true.

| trigger_id | Disparado por | Momento |
|---|---|---|
| `on_encounter_start` | SituationSystem al cargar | Automático al cargar — sin necesidad de llamada externa |
| `on_turn_start` | Combat System | Inicio del paso 2 del turno del jugador (después de telegráfico, antes del robo) |
| `on_card_played` | Card System (via `notify_card_played`) | Antes de resolver cada carta |
| `on_turn_end` | Combat System | Paso 8 del turno, antes del decay de estados |
| `on_enemy_turn_end` | Combat System | Al finalizar el turno del enemigo |

Las condiciones de trigger y los tipos de efecto reutilizan exactamente el vocabulario del Data Config GDD.

---

**5. Victoria alternativa**

Si `has_alt_victory: true`, el Combat System evalúa `check_alt_victory()` al inicio de cada turno y después de resolver cada efecto de carta. Si retorna `true`, declara victoria con el mismo flujo que HP del enemigo = 0.

| tipo | Condición | Params |
|---|---|---|
| `survive_turns` | El jugador sobrevivió N turnos | `{ "turns": N }` |
| `reduce_status_to_zero` | Un estado del enemigo llega a 0 stacks (fue > 0 antes) | `{ "status_id": "confianza_excesiva", "target": "enemy" }` |
| `play_n_distinct_types` | N tipos de carta distintos jugados en el encuentro | `{ "count": N }` |
| `play_card_type_n_times` | N cartas de un tipo específico jugadas | `{ "card_type": "social", "count": N }` |

Para `reduce_status_to_zero`: el SituationSystem se suscribe a `StatusEffectSystem.status_changed` al cargar la Situación. Cuando llega el signal con `new_stack_count == 0` y los parámetros coinciden, marca la condición interna como cumplida. Combat System la detecta en el próximo `check_alt_victory()`.

---

**6. Modificadores de comportamiento de enemigo**

`get_enemy_behavior_modifiers() → Array[Dictionary]` — llamado por el Enemy System al seleccionar intención. Modificadores soportados en MVP:

- `{ "type": "skip_attack_if_allies_present" }` — el enemigo pasa su turno si hay aliados en campo del jugador
- `{ "type": "hp_floor", "value": N }` — el HP del enemigo no baja de `N` hasta el fin del encuentro

---

**7. Mecanismo de interacción activa**

Una Situación puede tener uno, ambos, o ningún mecanismo de interacción activa.

**Tag-bonus inmediato:**
Si `interaction_tag != ""`, el Card System llama `card_has_interaction(card_tags) → bool` al cachear costos. Las cartas que retornan `true` reciben un indicador visual en la UI. Al jugarse, el Card System llama `fire_interaction_bonus()` que ejecuta `interaction_bonus_effects` inmediatamente usando el vocabulario de efectos del Data Config GDD.

**Track con umbral:**
Si `track_enabled: true`, el sistema mantiene `track_current` (runtime, no en datos). Al recibir `notify_card_played()` con una carta cuyo tag está en `track_trigger_tags`, incrementa `track_current` en `track_points_per_play` (clampeado a `track_max_points`). Al cruzar `track_threshold` por primera vez en el encuentro, ejecuta `track_effects`. El progreso del Track es visible en la UI como barra/contador. El umbral se cruza exactamente una vez por encuentro.

**Ambos mecanismos en la misma Situación:** posible. Una Situación puede tener tag-bonus para sinergias inmediatas y un Track para el arco largo del encuentro.

---

**8. Invariantes del sistema**

- Una sola Situación activa por encuentro. No puede cambiarse mid-encuentro.
- `get_active_situation()` retorna `null` cuando no hay encuentro activo.
- `get_cost_modifiers()` retorna `[]` cuando no hay Situación activa — el Card System no recibe error.
- La Situación se limpia automáticamente al recibir `SceneManager.transition_completed` (salida del encuentro).

---

### States and Transitions

| Estado | Descripción | Transiciones válidas |
|---|---|---|
| `Unloaded` | Sin Situación activa. Todas las queries retornan null/vacío. | → `Active` al recibir `transition_completed(ActiveEncounter)` |
| `Active` | SituationData cargada. Efectos activos. Contadores de Track y alt_victory en curso. | → `Unloaded` al recibir `transition_completed` (salida del encuentro) |

**Invariante:** `active == (get_active_situation() != null)`. No existe estado activo sin `SituationData` cargada.

---

### Interactions with Other Systems

| Sistema | Qué hace el Situation System | Interface |
|---|---|---|
| **DataLoader** | Lee `SituationData` al iniciar el encuentro | `DataLoader.get_situation(id) → SituationData` |
| **Card System** | Provee deltas de costo; marca cartas con interaction_tag; dispara bonus al jugar carta; recibe notificación de carta jugada para Track/alt_victory | `get_cost_modifiers(card_type, tags) → Array[int]`; `card_has_interaction(tags) → bool`; `fire_interaction_bonus(type, tags)`; recibe `notify_card_played(type, tags)` |
| **Combat System** | Recibe triggers de turno; provee evaluación de victoria alternativa | `fire_trigger(trigger_id)`; `check_alt_victory() → bool` |
| **Status Effect System** | Llama `apply_status`/`remove_status` para trigger_effects; escucha `status_changed` para `reduce_status_to_zero` | Llama: `StatusEffectSystem.apply_status()`; Escucha: `StatusEffectSystem.status_changed` |
| **Enemy System** | Provee modificadores de comportamiento del enemigo | `get_enemy_behavior_modifiers() → Array[Dictionary]` |
| **Scene Management** | Escucha transition para cargar y limpiar | Escucha `SceneManager.transition_completed(ActiveEncounter)` |
| **UI** | Provee la Situación activa para display y el progreso de alt_victory/Track | `get_active_situation() → SituationData`; `get_alt_victory_progress() → Dictionary` |

## Formulas

### Fórmula 1: Acumulación de Track

`track_current_new = min(track_current + track_points_per_play, track_max_points)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `track_current` | int | 0–`track_max_points` | Puntos acumulados en el encuentro (runtime, inicializa en 0) |
| `track_points_per_play` | int | 1–`track_max_points` | Puntos sumados por cada carta elegible jugada |
| `track_max_points` | int | 1–∞ | Techo del Track, definido en `SituationData` |

**Rango de salida:** 0 a `track_max_points`.

**Disparo del umbral:** `track_effects` se ejecutan exactamente una vez, la primera vez que `track_current_new >= track_threshold` y el flag `threshold_crossed` estaba en false. El flag permanece true el resto del encuentro.

**Ejemplo:** `track_max_points=5`, `track_threshold=3`, `track_points_per_play=1`. Con 2 puntos, juega carta elegible → `min(3,5)=3`. `3>=3` y flag=false → se disparan los efectos, flag→true. Próxima carta elegible → `min(4,5)=4`. Flag=true → no se vuelve a disparar.

---

### Fórmula 2a: Victoria alternativa — survive_turns

`victory = (turns_survived >= turns_required)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `turns_survived` | int | 0–∞ | Turnos completos con el jugador vivo al finalizar el `on_turn_end` |
| `turns_required` | int | 1–∞ | Valor `turns` de `alt_victory_params` |

"Turno sobrevivido" = el ataque del enemigo se resolvió sin que el HP del jugador llegara a 0.

**Ejemplo:** `turns_required=5`. Tras el 5to `on_turn_end` con vida → `victory=true`.

---

### Fórmula 2b: Victoria alternativa — reduce_status_to_zero

`victory = status_was_positive AND (new_stack_count == 0)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `status_was_positive` | bool | — | Flag interno: el estado tuvo stacks > 0 en algún momento del encuentro |
| `new_stack_count` | int | 0–`stack_cap` | Valor del signal `StatusEffectSystem.status_changed` |

El flag previene victoria si el estado nunca fue activo (enemigo con el estado ya en 0 al inicio).

**Ejemplo:** Enemigo llega a 3 stacks de Confianza Excesiva → `status_was_positive=true`. Al decaer a 0 → signal llega con `new_stack_count=0` → `victory=true`.

---

### Fórmula 2c: Victoria alternativa — play_n_distinct_types

`victory = (|distinct_types_played| >= count_required)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `distinct_types_played` | Set[String] | cardinalidad 0–N tipos | Conjunto de `card_type` únicos jugados. Inserción idempotente. |
| `count_required` | int | 1–N tipos | Cantidad requerida |

**Ejemplo:** `count_required=3`. Jugó "accion", "social", "objeto" → `|{…}|=3 >= 3` → victory.

---

### Fórmula 2d: Victoria alternativa — play_card_type_n_times

`victory = (card_type_count >= count_required)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `card_type_count` | int | 0–∞ | Contador acumulativo de cartas del tipo objetivo jugadas. La misma carta jugada N veces suma N. |
| `count_required` | int | 1–∞ | Cantidad requerida |
| `target_card_type` | String | vocabulario de card_types | Tipo a contabilizar |

**Ejemplo:** `target_card_type="social"`, `count_required=4`. Juega 4 cartas social → `card_type_count=4 >= 4` → victory.

---

### Fórmula 3: Evaluación de get_cost_modifiers()

```
mod_array = [entry.delta for entry in cost_modifiers if filter_matches(entry)]
          + [entry.delta for entry in track_cost_effects if threshold_crossed_flag == true]

filter_matches(entry) =
  (entry.filter_type == "card_type" AND entry.value == card_type)
  OR
  (entry.filter_type == "tag" AND entry.value IN card_tags)
```

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `cost_modifiers` | Array[Dictionary] | 0–N entradas | Modificadores pasivos de la Situación activa |
| `entry.delta` | int | -3–+3 | Delta de costo por entrada que aplica |
| `track_cost_effects` | Array[Dictionary] | 0–N entradas | Deltas del Track (solo incluidos si umbral fue cruzado) |
| `mod_array` | Array[int] | — | Array devuelto al Card System; `[]` si nada aplica |

**Multiplicidad:** Una carta puede coincidir con múltiples entradas simultáneamente — todos los deltas se incluyen en el array.

**Rango de salida:** Array de cero o más enteros. El Card System los suma como `Σmod_situación` en `costo_efectivo = max(0, costo_base + Σmod_situación + mod_estado_total)`.

**Ejemplo:** Situación con `cost_modifiers = [{ tag: "social", delta: -1 }]`. Carta con `card_type="accion"`, `tags=["social","verbal"]` → `"social" IN tags` → aplica → `mod_array=[-1]` → `Σmod_situación=-1`.

## Edge Cases

- **Si `track_threshold: 0` en los datos de la Situación**: La condición se cumple desde el primer frame del encuentro, antes de que el jugador tome ninguna acción. Los `track_effects` se ejecutan durante la inicialización del encuentro. Configuración inválida — el DataLoader debe validar `track_threshold >= 1` al cargar.

- **Si `track_threshold > track_max_points`**: La condición `track_current >= track_threshold` nunca puede ser verdadera (el Track no puede superar `track_max_points`). Los efectos del Track no se ejecutan nunca en el encuentro. Configuración silenciosamente rota — el DataLoader debe validar `track_threshold <= track_max_points` al cargar.

- **Si `track_points_per_play > track_threshold`**: El Track cruza el umbral en la primera carta elegible, saltando valores intermedios. Los efectos se disparan exactamente una vez. La barra de progreso de la UI salta de 0 al umbral en un solo frame — no mostrar valores previos como si se hubieran acumulado gradualmente.

- **Si el HP del enemigo llega a 0 en el mismo frame en que se cumple una condición de victoria alternativa**: El Combat System detecta victoria primaria (HP = 0) durante la resolución del efecto de carta. `check_alt_victory()` se evalúa después de resolver el efecto. Gana la victoria primaria — el flujo de victoria alternativa no se ejecuta.

- **Si el jugador muere (HP = 0) en el mismo turno en que `survive_turns` se cumpliría**: El jugador muere en el paso 7. `on_turn_end` no se ejecuta. `turns_survived` no se incrementa. La derrota tiene prioridad sobre cualquier condición de victoria alternativa — no hay empate.

- **Si el enemigo entra al encuentro con el estado objetivo de `reduce_status_to_zero` ya en 0 stacks**: `status_was_positive = false`. El signal `status_changed` con `new_stack_count == 0` no dispara victoria — el flag exige que el estado haya sido activo en el encuentro antes de decaer. La condición requiere que el estado se aplique Y luego se elimine.

- **Si `remove_all_status()` limpia el estado objetivo de `reduce_status_to_zero` en lugar del decay natural**: El signal `status_changed` se emite con `new_stack_count = 0`. El SituationSystem lo detecta y declara victoria de la misma manera que con decay natural. `remove_all_status()` no es una ruta de escape de la condición.

- **Si `status_changed` llega del jugador y la condición apunta al enemigo**: La condición debe verificar `entity_id == target_entity_id` antes de evaluar. Una Vergüenza del jugador decayendo a 0 no dispara victoria configurada para el enemigo. El implementador debe filtrar por `entity_id` AND `status_id` simultáneamente.

- **Si `cost_modifiers` tiene dos entradas que coinciden con la misma carta y sus deltas se cancelan (ej: +1 y -1)**: El array retornado contiene `[+1, -1]`. El Card System suma `0`. Un array con suma cero no es equivalente a un array vacío — el Card System no debe deduplicar. Ambos deltas son resultado válido.

- **Si el jugador tiene Sospechoso activo y la Situación tiene `interaction_tag` que coincide con una carta `[direct_attack]` bloqueada**: `card_has_interaction()` puede retornar `true` para esa carta, pero la carta es injugable. La UI no debe mostrar el indicador de interacción sobre cartas bloqueadas — evaluar jugabilidad (Sospechoso) antes de mostrar el indicador.

- **Si `track_effects` incluye un `cost_modifier` y el umbral se cruza durante la fase de acción del jugador (paso 5)**: El delta del Track se incluye en `get_cost_modifiers()` desde ese momento, pero el cache del paso 4 ya fue calculado. Las cartas en mano ese turno mantienen sus costos cacheados; el delta del Track aplica en el siguiente turno. Mismo comportamiento que Vergüenza aplicada mid-turno (Status Effect GDD).

- **Si ambos mecanismos de interacción activa están habilitados y el `interaction_tag` también está en `track_trigger_tags`**: Al jugar una carta elegible, `fire_interaction_bonus()` se ejecuta primero, luego se actualiza el Track. Ambos son independientes. Orden de ejecución determinístico: bonus primero, Track después.

- **Si `ActiveEncounter.situation_id` no está vacío pero el id no existe en el DataLoader**: `DataLoader.get_situation(id)` retorna `null`. El SituationSystem no puede quedar en estado `Unloaded` silencioso con un encuentro activo. Fallback requerido: loguear el error y seleccionar aleatoriamente del pool.

- **Si el Track nunca cruzó su umbral porque el jugador no jugó cartas elegibles**: Los `track_effects` no se ejecutan en el encuentro. Al limpiar en `transition_completed`, el estado de runtime se descarta. Sin efecto residual en el encuentro siguiente.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| Data Configuration System | Este sistema depende | Lee `SituationData` via `DataLoader.get_situation(id)`. Sin DataLoader no puede cargar ninguna Situación. Dependencia upstream dura. |
| Card System | Bidireccional | Card System depende de este para obtener `get_cost_modifiers()` cada turno. Este sistema usa el vocabulario de `card_type` y `card_tags` definido en CardData schema (Data Config, referenciado desde Card System). El vocabulario de tags debe ser consistente entre ambos sistemas. |
| Status Effect System | Bidireccional | Este sistema llama `StatusEffectSystem.apply_status()` y `remove_status()` para trigger_effects. Este sistema escucha `StatusEffectSystem.status_changed` para la victoria alternativa `reduce_status_to_zero`. El Status Effect System llama a `apply_status()` al ejecutar efectos de Situación, pero no tiene referencia directa a este sistema. |
| Combat System | Depende de este | Llama `fire_trigger(trigger_id)` en los momentos de turno definidos. Llama `check_alt_victory()` al inicio de cada turno y después de resolver cada efecto de carta. |
| Enemy System | Depende de este | Llama `get_enemy_behavior_modifiers()` al seleccionar intención de turno. |
| Scene Management System | Evento | Este sistema escucha `SceneManager.transition_completed(ActiveEncounter)` para cargar la Situación al iniciar un encuentro y limpiarla al salir. Mismo patrón que el Status Effect System.

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `SITUATION_POOL_SIZE` (cantidad de Situaciones disponibles) | 8 | 5–25 | Más variedad por run, menos repetición | Menos de 5 hace que el jugador vea la misma Situación en múltiples runs seguidas |
| `MAX_COST_MODIFIER_DELTA` (límite de delta por entry de cost_modifiers) | ±3 | ±1 a ±5 | Situaciones con más impacto en la economía de turno — algunas cartas pueden volverse gratuitas o injugables | Situaciones más sutiles; el jugador puede ignorarlas sin penalidad severa |
| `TRACK_MAX_POINTS` (cap del Track por Situación) | Variable por Situación (típico: 3–5) | 1–10 | Track más largo = arco narrativo más extendido por encuentro | Track corto = se llena rápido, la interacción activa se siente como bonus automático |
| `TRACK_THRESHOLD` (umbral de disparo por Situación) | Variable por Situación (típico: igual o menor que max_points) | 1–`track_max_points` | Más difícil de alcanzar — recompensa encuentros largos | Fácil de alcanzar — el jugador activa el bonus aunque no juegue para ello |
| `TURNS_REQUIRED` (para alt_victory survive_turns) | Variable por Situación (típico: 3–6) | 1–10 | Encuentros más largos y mayor tensión | Victoria muy fácil de conseguir sin esfuerzo del jugador |
| Repetición de Situaciones por run | Sin restricción (MVP) | Post-MVP: sin repetición en la misma run | Sin restricción = posible ver la misma Situación dos veces en la run | Restricción total = requiere pool >= cantidad de encuentros en la run |
| Visibilidad del Track | Siempre visible cuando `track_enabled` | Alternativa: visible solo tras primera acumulación | Visible desde inicio = el jugador ve el objetivo antes de comprometerse | Visible tarde = puede sorprender con "hay una meta oculta acá"

## Visual/Audio Requirements

*Principio rector: El panel de Situación es lo primero que el jugador lee en cada encuentro. Los eventos visuales deben reforzar cuándo el jugador está sinergizando con la Situación (Dorado) y cuándo la victoria alternativa está próxima.*

| Evento | Visual | Color (art bible §4) | Audio | Prioridad |
|---|---|---|---|---|
| Situación cargada al inicio del encuentro | Panel tipo pergamino entra con **Snap** (escala `0→1.15→1.0`, ~0.25s). `PointLight2D` de la Situación sube de energy 0 a 1.2 en sincronía. | Pergamino `#F5E6C8` fondo, Tinta `#2C1B0E` borde — información neutral al llegar | Papel/pergamino desplegándose — seco, físico, ~0.3s. Sin reverb. "Algo fue colocado en la mesa." | HIGH |
| Panel en reposo (jugador leyendo) | Estado persistente, no animación. `flavor_text` en tipografía grande inclinada (registro narrativo); `rule_text` debajo, más pequeño y vertical (registro mecánico). Línea de trazo a mano los separa. | — | Silencio intencional — el jugador está leyendo. | MEDIUM |
| Track acumula un punto | Nuevo segmento del Track aparece relleno por corte **Directo** (sin tween). Micro-**Thud** del elemento: baja 3–4px en Y, retorno en ~0.1s. | Dorado Caos `#F2B71F` — el jugador encontró el patrón | Tick seco, ~0.1s. Estilo: marca de lápiz. Reproducible en loop rápido sin sonar como glitch. | HIGH |
| Track cruza el umbral | **Thud** pesado del Track (escala `1.0→1.25→1.0`, ~0.3s). Destello de blanco puro en el relleno por ~0.08s, vuelve al Dorado. Contorno del panel hace **Spring** breve. Si `track_effect` baja costos, el borde del panel toma acento Verde Absurdo `#6BBF5E` por el resto del encuentro. | Dorado `#F2B71F` dominante | Sello de madera sobre pergamino + nota de laúd corta (~0.4s total). "Sello puesto, asunto cerrado." | HIGH |
| Victoria alternativa cumplida | El indicador de progreso hace **Snap** `1.0→1.3→1.0` en el frame de cumplimiento. Cartel de victoria a mano sobre el panel con **Thud** fuerte (`0→1.4→1.0`, ~0.4s). `PointLight2D` sube a energy 2.0 durante el beat de victoria. | Dorado `#F2B71F` exclusivo — cierra el arco cromático del Track. Sin verde ni azul. | Fanfare de laúd/cuerda medieval (~1.0s) — distinto al hit de victoria por HP. Comunica "performance completada", no "enemigo derrotado". | HIGH |
| Carta con interaction_tag en mano | Garabato tipo estrella de 3–5 puntas, esquina superior derecha de la carta. Entra con **Snap** al robar o al cargar la Situación. **Spring** muy sutil en loop (~2s/ciclo, ±3% scale) — respira, no parpadea. **No mostrar sobre cartas bloqueadas por Sospechoso.** | Dorado `#F2B71F` — sinergia como recurso capitalizable | Shimmer/chime suave, ~0.2s. Se reproduce una sola vez por turno aunque haya múltiples cartas elegibles en mano. | HIGH |

> **📌 Asset Spec** — Los requirements de Visual/Audio están definidos. Después de que el art bible esté aprobado, ejecutar `/asset-spec system:situation-system` para producir specs por asset, dimensiones y prompts de generación desde esta sección.

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| Panel de Situación activa | Siempre visible durante el encuentro. Muestra: nombre de la Situación, `flavor_text` (1 línea, registro narrativo), `rule_text` (≤ 120 chars, registro mecánico). Jerarquía tipográfica clara, separados por línea a mano. | Art bible §7.5 (layout del encuentro) |
| Barra/contador de Track | Visible cuando `track_enabled`. Muestra `track_current / track_threshold`. Relleno Dorado Caos. Actualización inmediata (Directo). Oculto cuando `track_enabled: false`. | Este GDD §Visual/Audio Eventos 3–4 |
| Indicador de progreso de victoria alternativa | Visible cuando `has_alt_victory`. Muestra el progreso hacia la condición: "Turno 2/5", "3 tipos distintos jugados", etc. Actualiza en tiempo real. Diseño diferenciado del Track — son objetivos distintos. | Diferido a `/ux-design encounter-screen` |
| Indicador de interaction_tag en cartas | Garabato Dorado sobre carta en mano cuando `card_has_interaction() == true`. Ausente si la carta está bloqueada (Sospechoso). | Art bible §7.4, §7.5 y este GDD §Visual/Audio Evento 6 |

> **📌 UX Flag — Situation System**: Este sistema tiene UI requirements complejos (panel de Situación, Track, indicador de victoria alternativa, indicadores en cartas). En Phase 4 (Pre-Production), ejecutar `/ux-design encounter-screen` para definir el layout exacto de todos estos elementos. Las historias que referencien UI del Situation System deben citar `design/ux/encounter-screen.md`, no este GDD directamente.

## Acceptance Criteria

Tests unitarios en `tests/unit/situation-system/` (BLOCKING — Logic). Tests de integración para AC-15, AC-17, AC-18, AC-27, AC-32 en `tests/integration/situation-system/` (BLOCKING). AC-36 y AC-37 son tests de carga de datos (DataLoader).

- **AC-01 (Carga por ID):** DADO un encuentro con `situation_id` válido, CUANDO `transition_completed(ActiveEncounter)` llega, ENTONCES `get_active_situation()` retorna la `SituationData` correspondiente y se emite `situation_loaded`.

- **AC-02 (Carga aleatoria):** DADO `situation_id` vacío y al menos una Situación en el pool, CUANDO `transition_completed` llega, ENTONCES `get_active_situation()` retorna una Situación no-null del pool, fija durante todo el encuentro.

- **AC-03 (Fallback por ID inválido):** DADO `situation_id` que no existe en DataLoader, CUANDO carga, ENTONCES el sistema loguea el error y selecciona aleatoriamente — no queda en estado `Unloaded` silencioso.

- **AC-04 (get_cost_modifiers — filtro por tag):** DADO `cost_modifiers = [{ tag: "social", delta: -1 }]`, CUANDO `get_cost_modifiers("accion", ["social","verbal"])`, ENTONCES resultado es `[-1]`.

- **AC-05 (get_cost_modifiers — filtro por card_type):** DADO `cost_modifiers = [{ card_type: "invocacion", delta: +1 }]`, CUANDO `get_cost_modifiers("invocacion", [])`, ENTONCES resultado es `[+1]`.

- **AC-06 (get_cost_modifiers — multiplicidad):** DADO dos filtros que coinciden con la misma carta (uno por tag y otro por card_type), CUANDO `get_cost_modifiers()`, ENTONCES ambos deltas aparecen en el array resultante.

- **AC-07 (get_cost_modifiers — Unloaded):** DADO que no hay Situación activa, CUANDO `get_cost_modifiers()`, ENTONCES resultado es `[]` sin error ni excepción.

- **AC-08 (get_cost_modifiers — suma cero no colapsa):** DADO `cost_modifiers` con dos entradas que matchean la misma carta con deltas `+1` y `-1`, CUANDO `get_cost_modifiers()`, ENTONCES resultado es `[+1, -1]` — el sistema no deduplica aunque la suma sea cero.

- **AC-09 (fire_trigger on_encounter_start):** DADO `trigger_effects` con `on_encounter_start`, CUANDO SituationSystem termina la inicialización, ENTONCES los efectos se ejecutan exactamente una vez sin llamada externa del Combat System.

- **AC-10 (fire_trigger on_turn_start):** DADO trigger_effect para `on_turn_start`, CUANDO Combat System llama `fire_trigger("on_turn_start")`, ENTONCES el efecto se ejecuta exactamente una vez ese turno.

- **AC-11 (fire_trigger on_card_played):** DADO trigger_effect para `on_card_played`, CUANDO Card System llama `fire_trigger("on_card_played")` antes de resolver una carta, ENTONCES el efecto se ejecuta antes de la resolución de la carta.

- **AC-12 (fire_trigger on_turn_end):** DADO trigger_effect para `on_turn_end`, CUANDO Combat System llama `fire_trigger("on_turn_end")` en el paso 8, ENTONCES el efecto se ejecuta antes del decay de estados.

- **AC-13 (Alt-victory survive_turns — cumplida):** DADO `survive_turns` con `turns_required: 3`, CUANDO el jugador sobrevive el paso 7 del turno 3 y se ejecuta `on_turn_end`, ENTONCES `check_alt_victory()` retorna `true`.

- **AC-14 (survive_turns — derrota tiene prioridad):** DADO `survive_turns` con `turns_survived: 2`, CUANDO el jugador muere durante el turno 3 antes de ejecutar `on_turn_end`, ENTONCES `on_turn_end` no se ejecuta, `turns_survived` permanece en 2, resultado es derrota.

- **AC-15 (Alt-victory reduce_status_to_zero — cumplida):** DADO el enemigo llegó a ≥1 stack de `confianza_excesiva` (`status_was_positive = true`), CUANDO `status_changed` llega con `entity_id == enemy`, `status_id == "confianza_excesiva"`, `new_stack_count == 0`, ENTONCES `check_alt_victory()` retorna `true`.

- **AC-16 (reduce_status_to_zero — estado nunca activo no dispara):** DADO que el estado apuntado nunca acumuló stacks en el encuentro (`status_was_positive = false`), CUANDO `status_changed` con `new_stack_count == 0`, ENTONCES `check_alt_victory()` retorna `false`.

- **AC-17 (reduce_status_to_zero — remove_all_status dispara igual que decay):** DADO `status_was_positive = true`, CUANDO `remove_all_status()` emite `status_changed` con `new_stack_count == 0`, ENTONCES `check_alt_victory()` retorna `true` — `remove_all_status()` no es una ruta de escape de la condición.

- **AC-18 (reduce_status_to_zero — filtro por entity_id):** DADO condición apuntando al enemigo, CUANDO `status_changed` llega del jugador con `new_stack_count == 0`, ENTONCES `check_alt_victory()` retorna `false`.

- **AC-19 (Alt-victory play_n_distinct_types — cumplida):** DADO `count_required: 3`, CUANDO el jugador juega cartas de tipos "accion", "social" y "objeto" en el encuentro, ENTONCES `check_alt_victory()` retorna `true`.

- **AC-20 (play_n_distinct_types — idempotente):** DADO `count_required: 3`, CUANDO el jugador juega 5 cartas pero solo de tipos "accion" y "social", ENTONCES `check_alt_victory()` retorna `false` — el set tiene cardinalidad 2.

- **AC-21 (Alt-victory play_card_type_n_times — acumulativo):** DADO `card_type: "social"`, `count_required: 4`, CUANDO el jugador juega 4 cartas social (incluyendo repeticiones de la misma carta), ENTONCES `check_alt_victory()` retorna `true`.

- **AC-22 (Victoria primaria tiene prioridad):** DADO victoria alternativa activa, CUANDO HP del enemigo llega a 0 durante la resolución de una carta, ENTONCES gana victoria primaria — `check_alt_victory()` no activa el flujo de victoria alternativa en ese frame.

- **AC-23 (Enemy behavior — skip_attack_if_allies_present):** DADO `enemy_behavior_modifiers = [{ type: "skip_attack_if_allies_present" }]`, CUANDO `get_enemy_behavior_modifiers()`, ENTONCES el array incluye ese diccionario.

- **AC-24 (Enemy behavior — Unloaded retorna vacío):** DADO que no hay Situación activa, CUANDO `get_enemy_behavior_modifiers()`, ENTONCES resultado es `[]` sin error.

- **AC-25 (card_has_interaction — tag coincide):** DADO `interaction_tag: "social"`, CUANDO `card_has_interaction(["social","verbal"])`, ENTONCES `true`.

- **AC-26 (card_has_interaction — mecanismo inactivo):** DADO `interaction_tag: ""`, CUANDO `card_has_interaction(["social"])`, ENTONCES `false`.

- **AC-27 (fire_interaction_bonus — se ejecuta al jugar carta elegible):** DADO `interaction_tag: "social"` con `interaction_bonus_effects` definidos, CUANDO el jugador juega carta con tag "social" y Card System llama `fire_interaction_bonus()`, ENTONCES los bonus effects se ejecutan inmediatamente.

- **AC-28 (Track — acumulación con clamp):** DADO `track_max_points: 5`, `track_current: 4`, `track_points_per_play: 2`, CUANDO carta elegible jugada, ENTONCES `track_current = 5` (no 6).

- **AC-29 (Track — umbral se cruza exactamente una vez):** DADO `track_threshold: 3`, `track_max_points: 5`, `track_current: 0`, CUANDO el jugador juega 3 cartas elegibles consecutivas, ENTONCES `track_effects` se ejecutan al cruzar de 2 a 3, y no vuelven a ejecutarse al llegar a 4 ni 5.

- **AC-30 (Track — no dispara antes del umbral):** DADO `track_threshold: 3`, `track_current: 0`, CUANDO 2 cartas elegibles jugadas, ENTONCES `track_effects` no se ejecutan y `threshold_crossed` permanece false.

- **AC-31 (Track — salto sobre el umbral dispara igual):** DADO `track_threshold: 3`, `track_points_per_play: 4`, `track_current: 0`, CUANDO 1 carta elegible jugada, ENTONCES `track_effects` se disparan exactamente una vez.

- **AC-32 (Track — cost_modifier incluido tras cruzar umbral):** DADO `track_effect` de tipo `cost_modifier` con `{ tag: "social", delta: -2 }` y `threshold_crossed == true`, CUANDO `get_cost_modifiers("accion", ["social"])`, ENTONCES `-2` aparece en el resultado.

- **AC-33 (Track — cost_modifier NO incluido antes del umbral):** DADO mismo escenario pero `threshold_crossed == false`, CUANDO `get_cost_modifiers()`, ENTONCES el delta del Track no aparece en el resultado.

- **AC-34 (Ambos mecanismos — orden de ejecución):** DADO `interaction_tag: "social"` y `track_trigger_tags: ["social"]` activos simultáneamente, CUANDO carta "social" jugada, ENTONCES `fire_interaction_bonus()` se ejecuta primero, luego `track_current` se actualiza — orden determinístico en toda reproducción.

- **AC-35 (Limpieza en transition_completed):** DADO Situación activa con `track_current: 3`, `threshold_crossed: true`, y contadores de victoria en curso, CUANDO `transition_completed` de salida del encuentro, ENTONCES `get_active_situation() == null`, `get_cost_modifiers() == []`, y todo estado de runtime descartado sin efecto residual en el encuentro siguiente.

- **AC-36 (Validación — track_threshold: 0 rechazado):** DADO `SituationData` con `track_threshold: 0`, CUANDO DataLoader intenta cargar, ENTONCES la carga es rechazada con error de validación explícito.

- **AC-37 (Validación — track_threshold > track_max_points rechazado):** DADO `track_threshold: 10` y `track_max_points: 5`, CUANDO DataLoader intenta cargar, ENTONCES la carga es rechazada con error de validación.

- **AC-38 (Estado Unloaded — todas las queries retornan vacío):** DADO SituationSystem en `Unloaded`, CUANDO se llaman `get_active_situation()`, `get_cost_modifiers()`, `get_enemy_behavior_modifiers()`, `card_has_interaction()`, `check_alt_victory()`, ENTONCES todos retornan sus valores vacíos correspondientes sin error.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿Las 8 Situaciones MVP específicas están definidas? | Pendiente — content work | El Game Designer proporcionó 8 Situaciones de ejemplo que validan el schema (ver el design session). Deben revisarse como contenido final antes de producción y prototipo. |
| ¿El jugador puede ver el pool de Situaciones posibles antes de entrar al encuentro? | Pendiente — UX/diseño | Si el jugador puede anticipar Situaciones, la estrategia de deckbuilding post-encuentro cambia significativamente. Resolver en `/ux-design encounter-screen` o en el Node Map System GDD. |
| ¿La selección aleatoria excluye Situaciones ya vistas en la run actual? | Pendiente — tuning | Sin restricción en MVP. Si el playtest muestra que la repetición rompe el factor sorpresa, agregar filtro "no-repeat" post-MVP. |
| ¿La condición de victoria alternativa es visible al jugador desde el inicio del encuentro? | Pendiente — UX | Si no es visible desde el inicio, el jugador puede descubrirla mid-encuentro (sorpresa vs. plan). Resolver con el diseño del panel de Situación en `/ux-design encounter-screen`. |
| ¿El tag `direct_attack` es suficiente para expresar exclusiones de Situaciones como "Monstruo Tímido"? | Pendiente — Data Config retrofit | El tag `direct_attack` está pendiente de retrofit en `registries.json` (anotado también en Status Effect GDD). El Situation System lo necesita para cost_modifiers. Resolver antes del primer playtest. |
| ¿Qué card_types existen en el vocabulario completo? | Pendiente — Card content | Los filtros de `cost_modifiers` usan `card_type` pero el vocabulario completo (accion, social, objeto, invocacion, etc.) depende del diseño de las 20 cartas MVP. Definir en el contenido de cartas antes de autear Situaciones. |
