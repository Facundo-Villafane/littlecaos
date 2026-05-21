---
sidebar_position: 11
title: Sistema de Combate
description: La máquina de estados del encuentro — orquestación del turno, gestión de aliados, condiciones de victoria y derrota, y flujo post-encuentro.
---

# Combat System

> **Status**: Designed
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Caos Ordenado · Decisiones Rápidas · Caos como Oportunidad

## Overview

El Combat System es la máquina de estados del encuentro: el controlador central que avanza el ciclo de turno, llama a cada subsistema en el momento correcto, evalúa las condiciones de victoria y derrota, gestiona el ciclo de vida de los aliados, y desencadena la transición al flujo de recompensa cuando el encuentro termina. Técnicamente orquesta la secuencia de 8 pasos definida en el Card System GDD — telegráfico del enemigo, robo de mano, tirada de maná, cacheo de costos, acciones del jugador, ataques de aliados, ataque del enemigo y descarte — llamando a Card System, Situation System, Status Effect System, Enemy System y Player Character System en los momentos exactos que cada API requiere. No define lo que las cartas hacen, lo que las Situaciones significan, ni cómo los estados alterados funcionan; llama a los sistemas que sí lo definen y conecta sus respuestas en un ciclo coherente de turno.

Para el jugador, el Combat System es la tensión de cada turno: la decisión de cuánto maná gastar en cartas versus conservar como escudo, el momento en que la victoria alternativa de la Situación se cumple mientras el HP del enemigo sigue alto, la elección de si un aliado absorbe el próximo golpe o guardarlo para más tarde. El jugador nunca ve el Combat System directamente — es la presión estructural invisible que convierte una mano de 4 cartas en una decisión que importa.

## Player Fantasy

Tirás dos dados y te toca un 5. El enemigo telegrafió 9 de daño. Mirás la mano: cuatro cartas, una cuesta más de lo que tenés, dos hacen daño chiquito, una aplica un estado que no parecía relevante. Hay un aliado en el campo. Tenés exactamente el tiempo que necesitás para armar una jugada que funcione, y ninguna jugada perfecta disponible. Lo que decidís en los próximos diez segundos — eso es el combate.

El placer central del sistema no es la carta que elegís. Es la cadena de decisiones que chocan simultáneamente: cuánto maná tirás al ataque y cuánto guardás para el escudo, si el aliado absorbe el golpe de 9 ahora o lo reservás para el multi-hit que viene después, qué carta dejás en la mano hoy sabiendo que vuelve en dos turnos cuando la Situación sea otra. Cada decisión cambia la siguiente: jugás la primera carta y el cálculo de escudo ya cambió; el aliado muere absorbiendo el golpe y de repente tenés más maná del que creías que ibas a necesitar. El momento de claridad no es "encontré la jugada óptima" — es "encontré la jugada que resuelve el problema más urgente sin crear uno peor". Y en Caos en Mano, eso siempre tiene un costo.

Si el sistema falla en entregar esto, el combate se vuelve administrativo: jugás todo lo que podés, dejás el resto como escudo, esperás el próximo turno. El escudo de maná deja de ser una decisión táctica y pasa a ser un número que se calcula solo. Los aliados son puntos de HP adicional, no recursos con costo de oportunidad. Las Situaciones son modificadores de costo, no escenarios que cambian lo que está en juego. El jugador no necesita improvisar porque el sistema nunca lo pone en una situación donde improvisar sea necesario — y el juego que no queremos ser es exactamente ese.

## Detailed Design

### Core Rules

**1. El Combat System como orquestador**

El Combat System no implementa la lógica de ningún subsistema — llama a sus APIs en el orden y momento correctos. Toda la lógica de cartas, costos, estados alterados, intenciones enemigas e Idea Brillante vive en los subsistemas respectivos. El Combat System es el director de escena: sabe cuándo llamar a quién, interpreta las señales que recibe, y decide cuándo el encuentro termina.

---

**2. Ciclo de turno — secuencia de 8 pasos**

| Paso | Nombre | Sistema principal | Acción |
|---|---|---|---|
| 1 | Telegráfico del enemigo | EnemySystem | `select_intention()` — cachea intención, la muestra al jugador |
| 2 | Robo de mano | CardSystem | `draw_hand(4)` — roba hasta 4 cartas, cicla si es necesario |
| 3 | Tirada de maná | CardSystem | `roll_mana()` — 2d6; Combat System aplica efectos de resultado |
| 4 | Cacheo de costos | CardSystem | `cache_costs()` — lee mods de Situación y estados, calcula `costo_efectivo` |
| 5 | Fase de acción del jugador | — | Input libre; Combat System escucha `card_effect_resolved` |
| 5.5 | Revisión de Confianza Excesiva | StatusEffectSystem | Si stacks ≥ 1: `mana_current = 0` |
| 6 | Ataques de aliados | EnemySystem | Cada aliado vivo ataca en orden de invocación |
| 7 | Ejecución de la intención | vía cadena | Resolución de daño del enemigo contra aliados / escudo / HP |
| 8 | Fin de turno | CardSystem, SituationSystem, StatusEffectSystem | Descarte + triggers de fin de turno + decay de estados |

La secuencia es estricta e invariable por turno. Los pasos 1-4 y 5.5-8 son dirigidos por sistema. El paso 5 es la única ventana de agencia del jugador en el turno.

**Detalle del paso 3 (tirada de maná):**
- Snake eyes (resultado = 2): `StatusEffectSystem.apply_status(player_id, "vergüenza", 1)`.
- Doble 6 (resultado = 12): `CardSystem.draw_extra(1)`.
- En todos los casos: cachea `mana_current = resultado`.

**Detalle del paso 5.5 (Confianza Excesiva):**
Después de que el jugador termina su fase de acción (antes del paso 6): si `StatusEffectSystem.get_stack_count(player_id, "confianza_excesiva") >= 1`, el Combat System fuerza `mana_current = 0`. Este drain ocurre antes de los ataques de aliados y antes de que el escudo absorba daño.

**Detalle del paso 8 (fin de turno):**
Orden exacto: `CardSystem.discard_hand()` → `SituationSystem.fire_trigger("on_turn_end")` → `StatusEffectSystem.tick_end_of_turn(player_id)` → `SituationSystem.fire_trigger("on_enemy_turn_end")` → `StatusEffectSystem.tick_end_of_turn(enemy_id)`.

---

**3. Reglas de aliados**

- Límite: máximo 3 aliados activos simultáneamente. El Card System bloquea la invocación cuando `aliados_activos >= 3`; el Combat System no recibe `ally_summoned` en ese caso.
- Al recibir `ally_summoned(AllyData)`: Combat System crea un `AllyRecord` con `{id, hp_current, hp_max, ataque, summon_order}` y lo agrega a `ally_list`.
- Paso 6 (ataques): itera `ally_list` en orden de `summon_order`, saltando aliados `alive == false`. Llama `EnemySystem.take_damage(ally.ataque)` por cada aliado vivo.
- Si el enemigo muere durante los ataques de aliados: transición inmediata a VICTORY_RESOLUTION. Los aliados restantes en la lista no atacan ese turno.
- Absorción del ataque enemigo: si hay aliados vivos, UN aliado aleatorio absorbe la intención completa (single-hit O el total del multi-hit como unidad — ver regla 5). Overflow se descarta — nunca se transfiere al jugador ni a otros aliados.
- Si el daño recibido supera el HP del aliado: `ally.alive = false`, el aliado se remueve del campo. Combat System emite `ally_died(ally_id)` para la UI.
- Persistencia: los aliados NO persisten entre encuentros. Se limpian en POST_ENCOUNTER.

**Dato estructural por aliado:**
```
AllyRecord {
  id:           String   -- id del AllyData
  hp_current:   int      -- inicializado desde AllyData.hp
  hp_max:       int      -- para UI
  ataque:       int      -- fijo, de AllyData.attack_per_turn
  summon_order: int      -- índice de invocación (0-based, inmutable)
  alive:        bool
}
```

---

**4. Cadena de resolución del daño enemigo (single-hit)**

```
Paso 1 — ¿Hay aliados vivos?
  SÍ →  Un aliado aleatorio absorbe daño_modificado completo.
         Si daño_modificado >= aliado.hp_current: aliado muere, overflow descartado.
         HP del jugador: sin cambio.
  NO →  Paso 2 — Absorción por escudo de maná.
         daño_a_hp = max(0, daño_modificado - mana_actual)
         mana_actual -= min(daño_modificado, mana_actual)
         Si daño_a_hp > 0: PlayerCharacterSystem.take_damage(daño_a_hp)
```

Donde `daño_modificado = max(0, damage - stacks_vergüenza_enemigo) + stacks_confianza_enemigo`. Ver Fórmulas §1 para la definición completa con variables.

---

**5. Cadena de resolución del daño enemigo (multi-hit)**

Para intenciones `multi_hit`, el routing de aliados se decide UNA sola vez antes de la primera instancia:

- **Si hay aliados vivos**: el aliado aleatorio absorbe `daño_total_modificado` (suma de todas las instancias post-estado) como una unidad. El jugador no recibe daño aunque el aliado muera. Overflow del total sobre el HP del aliado se descarta.
- **Sin aliados**: el escudo de maná se agota acumulativamente a través de las instancias. Cada instancia procesa contra el `mana_actual` en ese momento — que puede estar parcialmente o totalmente drenado por instancias anteriores. `mana_current` no se resetea entre instancias. Ver Fórmulas §2 para el cálculo exacto.

Si el HP del enemigo llega a 0 durante una instancia: las instancias restantes se cancelan. Victoria inmediata.

---

**6. Daño del jugador al enemigo**

Al recibir `card_effect_resolved(type: "damage_to_enemy", params: {amount: int})`:

```
daño_aplicado = floor(amount × SituationSystem.get_enemy_damage_multiplier())
EnemySystem.take_damage(daño_aplicado)
```

Los ataques de aliados (paso 6) aplican el mismo multiplicador:

```
daño_aliado = floor(ally.ataque × SituationSystem.get_enemy_damage_multiplier())
EnemySystem.take_damage(daño_aliado)
```

El `damage_received_multiplier` de la Situación aplica a TODA fuente de daño hacia el enemigo — cartas del jugador y ataques de aliados por igual. Por defecto es `1.0`.

---

**7. Evaluación de victoria y derrota**

| Momento | Condición evaluada | Acción |
|---|---|---|
| Después de cada `card_effect_resolved` (paso 5) | `EnemySystem.get_hp() <= 0` | → VICTORY_RESOLUTION |
| Después de cada `card_effect_resolved` (paso 5) | `SituationSystem.check_alt_victory() == true` | → VICTORY_RESOLUTION |
| Después de cada ataque de aliado (paso 6) | `EnemySystem.get_hp() <= 0` | → VICTORY_RESOLUTION |
| Después de cada ataque de aliado (paso 6) | `SituationSystem.check_alt_victory() == true` | → VICTORY_RESOLUTION |
| Después del paso 7 (ataque enemigo) | Señal `player_died()` recibida | → DEFEAT_RESOLUTION |
| Después del paso 7 | `SituationSystem.check_alt_victory() == true` | → VICTORY_RESOLUTION |

**Prioridad cuando victoria y derrota ocurren en el mismo frame**: la derrota tiene prioridad sobre la victoria alternativa. Si el ataque del enemigo mata al jugador en el mismo frame en que se cumpliría un `survive_turns`, el jugador muere.

**Victoria de run (jefe)**: cuando `enemy_defeated()` llega y `is_boss_encounter == true`, el Combat System llama `SceneManager.request_transition(RunVictory)` en lugar de `Reward`.

---

**8. Resolución post-encuentro**

Secuencia al activar VICTORY_RESOLUTION:

1. Detener acciones pendientes. Bloquear input del jugador.
2. Disparar animación de victoria (visual — no bloquea la lógica).
3. `ally_list.clear()` — todos los aliados eliminados.
4. `StatusEffectSystem.remove_all_status(all_entity_ids)` — limpieza de estados del encuentro.
5. HP del jugador NO se resetea — persiste al siguiente encuentro.
6. Estado del mazo NO se resetea — persiste.
7. `ib_counter` se resetea en el próximo `transition_completed` (Player Character System lo maneja directamente).
8. Si `is_boss_encounter`: `SceneManager.request_transition(RunVictory)`. Si no: `SceneManager.request_transition(Reward)`.

---

**9. Inicialización del encuentro**

Al recibir `SceneManager.transition_completed(ActiveEncounter)`:

| # | Llamada | Propósito |
|---|---|---|
| 1 | Lee payload | Obtiene: tipo (`regular`/`boss`), `enemy_id`, `situation_id` |
| 2 | `SituationSystem.load_situation(situation_id)` | Situación activa — triggers y alt-victory vigentes |
| 3 | `EnemySystem.load_enemy(enemy_id)` | Enemigo instanciado. Si jefe: `phase=1`, `script_index=0`, `phase_transition_fired=false` |
| 4 | `PlayerCharacterSystem.reset_ib_counter()` | IB = 0 |
| 5 | Reinicia estado interno | `ally_list=[]`, `mana_current=0`, `current_intention=null`, `is_boss_encounter`, `turn_number=0` |
| 6 | `CardSystem.reset_hand()` | Safety: descarta cartas residuales |
| 7 | Emite `encounter_started(encounter_data)` | UI configura el layout del encuentro |
| 8 | → ENEMY_TELEGRAPH | Comienza turno 1 |

Todos los pasos son síncronos. Las animaciones de entrada se disparan en el paso 7 pero no bloquean el avance de la lógica.

---

### States and Transitions

| Estado | Descripción | Activado por | Sale hacia | Agencia |
|---|---|---|---|---|
| `ENCOUNTER_INIT` | Inicialización de sistemas | `transition_completed(ActiveEncounter)` | `ENEMY_TELEGRAPH` al completar | Sistema |
| `ENEMY_TELEGRAPH` | `select_intention()` — intención cacheada y mostrada | Inicio de turno o fin de `END_OF_TURN` | `DRAW_HAND` | Sistema |
| `DRAW_HAND` | `draw_hand(4)` — cicla mazo si es necesario | Telegráfico completado | `ROLL_MANA` | Sistema |
| `ROLL_MANA` | 2d6 + efectos de snake eyes / doble 6 | Draw completado | `CACHE_COSTS` | Sistema |
| `CACHE_COSTS` | `cache_costs()` — `costo_efectivo` calculado para cada carta | Roll completado | `PLAYER_ACTION` | Sistema |
| `PLAYER_ACTION` | Input libre del jugador — juega 0 o más cartas | Cache completado | Jugador termina turno | **Jugador** |
| `CONFIANZA_CHECK` | Si Confianza ≥ 1: `mana_current = 0` | Fin de fase del jugador | `ALLY_ATTACK` | Sistema |
| `ALLY_ATTACK` | Aliados atacan en orden de invocación | Check completado | `VICTORY_RESOLUTION` si enemy HP = 0; sino `ENEMY_ATTACK` | Sistema |
| `ENEMY_ATTACK` | Cadena de resolución de daño enemigo | Ataques de aliados completados | `DEFEAT_RESOLUTION` si `player_died()`; `VICTORY_RESOLUTION` si alt-victory; sino `END_OF_TURN` | Sistema |
| `END_OF_TURN` | Descarte + `on_turn_end` + ticks de estado (jugador y enemigo) | Ataque enemigo sin fin de run | `ENEMY_TELEGRAPH` (turno siguiente) | Sistema |
| `VICTORY_RESOLUTION` | HP enemigo = 0 O alt-victory = true | Desde PLAYER_ACTION, ALLY_ATTACK o ENEMY_ATTACK | `POST_ENCOUNTER` | Sistema |
| `DEFEAT_RESOLUTION` | `player_died()` recibido | Desde ENEMY_ATTACK | `SceneManager.request_transition(GameOver)` | Sistema |
| `POST_ENCOUNTER` | Limpieza + transición | Desde VICTORY_RESOLUTION | SceneManager toma control | Sistema |

**Diagrama de flujo (por turno):**

```
ENCOUNTER_INIT
  → ENEMY_TELEGRAPH → DRAW_HAND → ROLL_MANA → CACHE_COSTS
    → PLAYER_ACTION ─── victoria ──→ VICTORY_RESOLUTION → POST_ENCOUNTER
      → CONFIANZA_CHECK → ALLY_ATTACK ─── victoria ──→ VICTORY_RESOLUTION
        → ENEMY_ATTACK ─── derrota ──→ DEFEAT_RESOLUTION → GameOver
          │         └── victoria ──→ VICTORY_RESOLUTION
          └── (ninguna) → END_OF_TURN → (vuelve a ENEMY_TELEGRAPH)
```

**Invariante**: solo un estado activo por turno. Los estados visuales (animaciones) corren en paralelo pero no bloquean la máquina de estados.

---

### Interactions with Other Systems

| Sistema | Recibe del Combat System | Provee al Combat System |
|---|---|---|
| **CardSystem** | Llamadas: `draw_hand(N)`, `roll_mana()`, `cache_costs()`, `draw_extra(1)`, `discard_hand()`, `reset_hand()` | Señales: `card_effect_resolved(type, params)`, `ally_summoned(AllyData)` |
| **SituationSystem** | Llamadas: `load_situation(id)`, `fire_trigger(id)`, `check_alt_victory()`, lee `get_enemy_damage_multiplier()` | Evaluación de alt-victory, modificadores de costo (vía CardSystem), efectos de trigger |
| **StatusEffectSystem** | Llamadas: `apply_status(id, status, stacks)`, `get_stack_count(id, status)`, `tick_end_of_turn(id)`, `remove_all_status(ids)` | Delta de daño via `get_damage_modifier(enemy_id)` para cadena de resolución |
| **EnemySystem** | Llamadas: `load_enemy(id)`, `select_intention()`, `take_damage(amount)` | Señal: `enemy_defeated()`. Datos: `current_intention`, `get_hp()` |
| **PlayerCharacterSystem** | Llamadas: `take_damage(amount)`, `heal(amount)`, `reset_ib_counter()` | Señal: `player_died()`. Datos: `get_hp()` |
| **SceneManager** | Llamadas: `request_transition(Reward/GameOver/RunVictory)`. Emite: `encounter_started(data)` | Señal: `transition_completed(ActiveEncounter)` |
| **UI layer** | Señales: `encounter_started()`, `ally_summoned()`, `ally_died()`, `mana_drained()`, `encounter_victory()`, `encounter_defeat()` | Señal de input: "fin de turno" (vía UI) |

**Nota sobre StatusEffectSystem y Confianza Excesiva**: `get_damage_modifier(enemy_id) → int` retorna el delta aditivo neto de Vergüenza (`-(stacks)`) sobre el daño de salida del enemigo. La bonificación de Confianza Excesiva (`+stacks_confianza`) se aplica separadamente leyendo `get_stack_count(enemy_id, "confianza_excesiva")` directamente, ya que en la fórmula de daño se suma *después* del `max(0,…)` de Vergüenza. Esta separación es necesaria para preservar el orden de operaciones correcto.

## Formulas

### Fórmula 1: Daño del enemigo al jugador — single-hit

Cadena autorizada para intenciones `direct_attack` y `status_attack`.

**Paso 1 — modificación por estados:**

`daño_modificado = max(0, damage - stacks_vergüenza_enemigo) + stacks_confianza_enemigo`

**Paso 2A — sin aliados — absorción por escudo de maná:**

`daño_a_hp = max(0, daño_modificado - mana_actual)`

`mana_post = max(0, mana_actual - daño_modificado)`

**Paso 2B — con aliados — absorción por aliado:**

```
aliado_objetivo = random_choice(aliados_vivos_en_campo)
IF daño_modificado >= aliado_objetivo.hp_current:
    aliado_objetivo.alive = false  // muere; overflow descartado
ELSE:
    aliado_objetivo.hp_current -= daño_modificado
daño_a_hp_jugador = 0  // siempre, incluso si el aliado muere
```

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `damage` | int | 0–16 | Valor fijo de `IntentionData.damage` |
| `stacks_vergüenza_enemigo` | int | 0–3 | Reduce el daño de salida del enemigo |
| `stacks_confianza_enemigo` | int | 0–4 | Amplifica el daño de salida del enemigo |
| `daño_modificado` | int | 0–20 | Post-estados; flooreado en 0 por `max(0,…)` |
| `mana_actual` | int | 0–12 | Maná del jugador al inicio del paso 7 |
| `aliados_vivos` | int | 0–3 | Si > 0: routing al aliado |
| `aliado.hp_current` | int | 1–∞ | HP del aliado objetivo |
| `daño_a_hp` | int | 0–20 | 0 siempre con aliados presentes |

**Rango de salida:** 0–20 (sin aliados). Siempre 0 (con aliados — jugador no recibe daño aunque el aliado muera).

**Ejemplo A (sin aliados):** El Ogro, "Negociación Agresiva" (`damage=10`), con 1 Vergüenza y 2 Confianza. Jugador con 4 maná. `daño_modificado = max(0,10-1)+2 = 11`. `daño_a_hp = max(0,11-4) = 7`.

**Ejemplo B (con aliado que sobrevive):** Misma intención. Aliado con `hp_current=15`. `daño_al_aliado=11`. `hp_current=4`. Jugador: HP sin cambio.

**Ejemplo C (con aliado que muere):** Aliado con `hp_current=8`. `11 >= 8` → aliado muere, overflow (3) descartado. Jugador: HP sin cambio.

---

### Fórmula 2: Daño del enemigo al jugador — multi-hit

Para intenciones `multi_hit`. El routing de aliados se decide **una sola vez** antes de la primera instancia.

**Daño por instancia (igual para todas):**

`daño_instancia = max(0, damage_per_instance - stacks_vergüenza_enemigo) + stacks_confianza_enemigo`

Los stacks son iguales en todas las instancias — no se consumen entre golpes.

**Rama A — con aliados — absorción total como unidad:**

`daño_total = hit_count × daño_instancia`

```
aliado_objetivo = random_choice(aliados_vivos)
IF daño_total >= aliado_objetivo.hp_current:
    aliado_objetivo.alive = false  // overflow descartado
ELSE:
    aliado_objetivo.hp_current -= daño_total
daño_a_hp_jugador = 0
```

**Rama B — sin aliados — escudo se agota acumulativamente:**

Para instancia `i` de 1 a `hit_count` (donde `mana_pre_1 = mana_actual`):

```
daño_a_hp_i = max(0, daño_instancia - mana_pre_i)
mana_post_i = max(0, mana_pre_i - daño_instancia)
mana_pre_(i+1) = mana_post_i
```

`daño_a_hp_total = Σ daño_a_hp_i`

Si el HP del enemigo llega a 0 durante una instancia: las instancias restantes se cancelan.

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `damage` | int | 2–16 | `IntentionData.damage` — total nominal |
| `hit_count` | int | 2–4 | `IntentionData.hit_count` |
| `damage_per_instance` | int | 1–8 | `damage / hit_count` — siempre entero en MVP |
| `stacks_vergüenza_enemigo` | int | 0–3 | Aplica igual a cada instancia |
| `stacks_confianza_enemigo` | int | 0–4 | Aplica igual a cada instancia |
| `daño_instancia` | int | 0–12 | Daño post-estado por instancia |
| `mana_pre_i` | int | 0–12 | Maná antes de la instancia i; decrece con cada golpe |
| `daño_a_hp_i` | int | 0–12 | Daño al HP en instancia i |
| `daño_a_hp_total` | int | 0–36 | Suma de todas las instancias (MVP máximo práctico: 18) |

**Rango de salida (Rama B):** 0 (maná cubre todo) a 18 en MVP (Juglar, 3 instancias de 2, con 4 Confianza: `3×(2+4)=18`).

**Ejemplo — depleción acumulativa:** La Bruja, "Conjuro con Queja Adjunta" (`hit_count=2`, `damage_per_instance=2`, sin estados). Jugador con 3 maná, sin aliados.
- Instancia 1: `daño_instancia=2`, `mana_pre=3`. `daño_a_hp_1=max(0,2-3)=0`. `mana_post=1`.
- Instancia 2: `daño_instancia=2`, `mana_pre=1`. `daño_a_hp_2=max(0,2-1)=1`. `mana_post=0`.
- Total: `daño_a_hp_total=1`. Jugador pierde 1 HP.

**Ejemplo — aliado absorbe total:** El Juglar (2 Confianza), "Catarata de Pelotas" (`hit_count=3`, `damage_per_instance=2`). Aliado con `hp_current=10`. `daño_instancia=max(0,2-0)+2=4`. `daño_total=12`. `12 >= 10` → aliado muere, overflow (2) descartado. Jugador: HP sin cambio.

---

### Fórmula 3: Daño de carta del jugador al enemigo

MVP: todas las cartas son single-instance. Multi-hit de carta es post-MVP.

`daño_carta = daño_base + stacks_confianza_jugador`

`daño_aplicado = floor(daño_carta × damage_received_multiplier)`

`EnemySystem.take_damage(daño_aplicado)`

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `daño_base` | int | 1–8 | `CardData.effect.damage` |
| `stacks_confianza_jugador` | int | 0–4 | Bonus aditivo por stack del jugador |
| `daño_carta` | int | 1–12 | Daño antes del multiplicador situacional |
| `damage_received_multiplier` | float | 0.0–2.0 | Seteado por la Situación activa; default 1.0 |
| `daño_aplicado` | int | 0–∞ | Pasado a `EnemySystem.take_damage()` |

**Rango de salida de `daño_carta`:** 1 a 12 en MVP (mínimo base=1, cap Confianza=4). `daño_aplicado` sin cap definido — el HP del enemigo es el techo práctico.

**Ejemplo:** Jugador con 3 Confianza. Carta con `daño_base=4`. Situación con `damage_received_multiplier=1.5`. `daño_carta=7`. `daño_aplicado=floor(7×1.5)=10`.

> **Post-MVP — cartas multi-instancia**: aplicar esta fórmula por instancia con `daño_base_instancia`. Requiere agregar `hit_count` a `CardData.effect`. No implementar en MVP.

---

### Fórmula 4: Daño de aliado al enemigo

`daño_aliado = floor(ally.ataque × damage_received_multiplier)`

`EnemySystem.take_damage(daño_aliado)`

El `damage_received_multiplier` de la Situación aplica a ataques de aliados con el mismo criterio que a cartas del jugador. La Vergüenza del enemigo NO afecta ataques de aliados — Vergüenza reduce el daño de *salida* del enemigo, no el daño *recibido* de ninguna fuente.

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `ally.ataque` | int | 1–8 | Valor fijo de `AllyData.attack_per_turn` |
| `damage_received_multiplier` | float | 0.0–2.0 | Mismo que en Fórmula 3; default 1.0 |
| `daño_aliado` | int | 0–16 | `floor(ataque × multiplier)` |

**Rango de salida:** 0 (multiplicador=0) a ~16 (aliado alto, multiplicador×2). Valores exactos dependen del contenido de las cartas de invocación (a definir en autoría de las 20 cartas MVP).

**Ejemplo:** Aliado con `ataque=3`. Situación con `damage_received_multiplier=2.0`. `daño_aliado=floor(3×2.0)=6`.

---

### Fórmula 5: Activación de fase del jefe

*Citada del Enemy System GDD §Fórmula 4. El Combat System la evalúa tras cada `EnemySystem.take_damage()` en el encuentro de jefe.*

`activar_fase_2 = (hp_current_post_damage ≤ phase_threshold) AND NOT fase_2_ya_activa`

**Orden de evaluación dentro de un `take_damage()` sobre el jefe:**

1. `hp_current -= amount` (flooreado en 0).
2. Si `hp_current == 0`: emitir `enemy_defeated`. **NO evaluar esta fórmula.** HP=0 tiene prioridad absoluta.
3. Evaluar fórmula 5. Si `true`: `fase_2_ya_activa = true`. Insertar intención de transición como próxima en el script.

**Variables:**

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `hp_current_post_damage` | int | 0–60 | HP del jefe después de aplicar el daño |
| `phase_threshold` | int | 1–59 | Umbral de activación de Fase 2; MVP = 30 |
| `fase_2_ya_activa` | bool | — | Flag de un único disparo |
| `activar_fase_2` | bool | — | Salida: `true` solo una vez por encuentro |

**Rango de salida:** Booleano. Una vez `fase_2_ya_activa=true`, siempre retorna `false`.

**Ejemplo:** Jefe en HP=34, `fase_2_ya_activa=false`. Jugador inflige 6. `hp_current=28`. `28≤30 AND NOT false → true`. Transición queda en cola. `fase_2_ya_activa=true`. Siguiente evaluación: `hp=15 ≤ 30 AND NOT true → false`.

## Edge Cases

- **Si `damage=0` en una intención `direct_attack`** (ej: enemigo con Vergüenza 3 que normalmente hace 3 de daño): `daño_modificado = max(0, 0-3) = 0`. Maná sin cambio. HP sin cambio. La lógica del escudo se ejecuta de todas formas — el resultado es 0 daño. No es un turno pasado: el tipo de intención sigue siendo `direct_attack` para cualquier sistema que lo observe.

- **Si la tirada 2d6 da 12 (doble 6) Y el jugador tiene stacks de Confianza Excesiva**: la carta extra se roba en el paso 3. El `mana_current` se fuerza a 0 en el paso 5.5. El bonus de robo se preserva; el maná no. El drain de Confianza Excesiva ocurre siempre en el 5.5 — no en el paso 3.

- **Si el jugador gasta todo su maná en cartas (paso 5, `mana_current=0`) Y tiene stacks de Confianza Excesiva**: el paso 5.5 fuerza `mana_current=0` sobre un valor ya en 0. Es un no-op correcto. Los stacks de Confianza NO se decrementan en el paso 5.5 — el decay ocurre en el paso 8.

- **Si el drain de Confianza Excesiva (paso 5.5) precede a una intención multi-hit del enemigo sin aliados**: `mana_pre_1 = 0` en la Rama B de Fórmula 2. Todas las instancias hacen su `daño_instancia` completo directo al HP. Este es el mayor pico de daño posible en el sistema — la Confianza Excesiva actúa como penalidad de HP efectiva contra multi-hits.

- **Si `stacks_vergüenza_enemigo` supera `damage`** (ej: Vergüenza=3, `damage=2`): `max(0, 2-3) = 0`. Si el enemigo también tiene Confianza, el bonus SE suma al 0: `0 + stacks_confianza`. El `max(0,…)` aplica solo al término de Vergüenza; la Confianza se añade después. El ataque puede seguir haciendo daño aunque Vergüenza anulara el base.

- **Si el jugador tiene Vergüenza Y Confianza Excesiva activos simultáneamente en el paso 5.5**: Vergüenza afecta el daño de SALIDA del enemigo (Fórmulas 1/2), no el `mana_current`. El check del paso 5.5 lee solo `get_stack_count(player_id, "confianza_excesiva")` — los stacks de Vergüenza del jugador no interfieren.

- **Si un aliado ataca en el paso 6 y mata al enemigo, y hay otros aliados en la lista**: transición inmediata a VICTORY_RESOLUTION. Los aliados restantes NO atacan ese turno. El check de victoria ocurre después de CADA ataque de aliado, no al final de todos.

- **Si dos condiciones de victoria se dan en el mismo check** (HP del enemigo = 0 Y `check_alt_victory()` = true): ambas llevan a VICTORY_RESOLUTION. La transición se emite una sola vez.

- **Si el ataque del enemigo (paso 7) mata al jugador Y cumpliría la condición de `survive_turns` al final de turno**: la derrota tiene prioridad. `player_died()` se emite. `on_turn_end` no se ejecuta — `turns_survived` no se incrementa. El jugador muere antes de que el turno se "cuente".

- **Si una instancia de un multi-hit (Rama B, sin aliados) drena `mana_current` a 0**: las instancias restantes tienen `mana_pre_i = 0`. Cada instancia hace su `daño_instancia` completo al HP. El estado de `mana_current` se propaga acumulativamente — NO se resetea al valor original del turno para cada instancia.

- **Si `daño_instancia = 0` para todas las instancias de un multi-hit** (ej: Vergüenza cubre todo el `damage_per_instance`): Rama B — `daño_a_hp_i = 0` en cada instancia. El maná queda sin cambio. El sistema itera todas las instancias — son tres hits de 0 daño, no un turno pasado. Las animaciones de golpe se ejecutan.

- **Si `daño_total` en Rama A (multi-hit con aliado) es exactamente igual al `hp_current` del aliado**: la condición `daño_total >= aliado.hp_current` es true. El aliado muere. Overflow = 0 pero `ally_died` se emite. El jugador no recibe daño.

- **Si el routing de aliados (Rama A) se decide al inicio del multi-hit y el aliado muere absorbiendo el total**: el routing es vinculante para toda la intención. El jugador no recibe daño de ninguna instancia — aunque el aliado muera durante la absorción.

- **Si hay exactamente 3 aliados vivos y se juega una carta de invocación**: el Card System bloquea la carta como injugable. El Combat System no recibe `ally_summoned`. No hay path donde un cuarto aliado entre a `ally_list`.

- **Si el jefe recibe daño que lleva su `hp_current` exactamente a 0 en Phase 1**: `hp_current == 0` → `enemy_defeated` emitido. Fórmula 5 NO se evalúa. La transición de Fase 2 no ocurre. Un jefe con HP=0 no tiene fases.

- **Si el HP del jefe cruza el umbral de fase y el turno actual del script es `buff_self` o `posture`**: el Sospechoso override no aplica (no es `direct_attack`). La intención de transición se inserta como PRÓXIMA en el script — la intención actual se ejecuta normalmente este turno.

- **Si Phase 2 comienza y el jefe ya tenía stacks de Confianza Excesiva de Phase 1**: los stacks persisten — no hay limpieza de estados en la transición de fase. La intención de transición aplica 2 stacks adicionales sobre los que ya existían.

- **Si el script index del jefe se reinicia a 0 al iniciar Phase 2**: `fase_2_ya_activa` debe permanecer en `true`. Si el flag se resetea con el script index, la condición `(hp≤30 AND NOT false)` podría re-evaluar como `true` en el próximo `take_damage()`. El flag de un único disparo es permanente para el encuentro.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| **Card System** | Bidireccional | El Combat System llama `draw_hand()`, `roll_mana()`, `cache_costs()`, `draw_extra()`, `discard_hand()`, `reset_hand()`. Recibe señales `card_effect_resolved(type, params)` y `ally_summoned(AllyData)`. El Card System define el ciclo de turno — el Combat System lo ejecuta. |
| **Situation System** | Bidireccional | El Combat System llama `load_situation()`, `fire_trigger()`, `check_alt_victory()`, y lee `get_enemy_damage_multiplier()`. La Situación activa afecta la economía de maná (vía Card System) y puede terminar el encuentro antes de tiempo mediante alt-victory. |
| **Status Effect System** | Bidireccional | El Combat System llama `apply_status()` (para snake eyes), `get_stack_count()`, `tick_end_of_turn()`, y `remove_all_status()`. Lee `get_damage_modifier(enemy_id)` para la cadena de daño. Sin este sistema, la cadena de daño no puede calcular los modificadores de Vergüenza y Confianza. |
| **Enemy System** | Bidireccional | El Combat System llama `load_enemy()`, `select_intention()`, y `take_damage()`. Escucha `signal enemy_defeated()`. El Enemy System es la fuente de verdad del HP y las intenciones; el Combat System gestiona el encuentro alrededor de ese estado. |
| **Player Character System** | Bidireccional | El Combat System llama `take_damage()`, `heal()`, y `reset_ib_counter()`. Escucha `signal player_died()`. Sin esta señal, el Combat System no puede detectar la condición de derrota. HP del jugador persiste entre encuentros y no es propiedad del Combat System. |
| **Scene Management System** | Evento bidireccional | El Combat System escucha `transition_completed(ActiveEncounter)` para inicializar el encuentro. Llama `request_transition(Reward/GameOver/RunVictory)` para finalizarlo. Sin el SceneManager, no hay forma de iniciar ni terminar un encuentro. |
| **Data Configuration System** | Indirecta (upstream) | Todos los datos de cartas, Situaciones, enemigos y aliados se cargan desde archivos de datos via DataLoader. El Combat System no llama al DataLoader directamente — los subsistemas (Card, Situation, Enemy) lo hacen. Dependencia estructural dura. |
| **Deck Building System** | Depende de este | El Deck Building System (#10) necesita saber que un encuentro terminó en victoria para ofrecer la pantalla de recompensa. El Combat System le entrega el control vía `SceneManager.request_transition(Reward)`. |
| **Node Map System** | Depende de este | El Node Map System (#11) define qué encuentro se carga por nodo. El Combat System acepta `ActiveEncounter` del SceneManager y lo ejecuta — no hace preguntas sobre qué nodo lo generó. |
| **Save System** | Depende de este | El Save System (#12) persiste el estado del run. El Combat System no tiene un contrato de save directo — el estado que importa (HP del jugador, mazo) vive en Player Character System y Card System. El Save System los lee directamente. |

## Tuning Knobs

El Combat System es un orquestador — la mayoría de los parámetros tuneables viven en los subsistemas que llama. Los knobs listados aquí son los que el Combat System lee y aplica directamente.

**Parámetros propios del Combat System:**

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `FIELD_LIMIT` (máx. aliados simultáneos) | 3 | 1–5 | Estrategias de campo más complejas; más opciones de absorción de daño | 1 aliado = mecánica de escudo más simple; menos decisiones de campo |
| Comportamiento de overflow de aliado | Descartado (no se transfiere) | N/A | Variante post-MVP: overflow transfiere al siguiente aliado o al escudo de maná | N/A — el descarte es la regla base |
| Routing multi-hit con aliados | Absorción total como unidad | N/A | Variante post-MVP: per-instancia, el aliado puede morir en la instancia 1 y exponer las siguientes | N/A — el routing unitario es la regla MVP |

**Knobs de subsistemas que más afectan el combate** *(no son propiedad del Combat System — modificar en el GDD fuente):*

| Parámetro | Fuente | Efecto en el combate |
|---|---|---|
| `HP_BASE` del jugador (60) | Player Character System | Determina cuántos encuentros puede absorber antes del jefe |
| Maná: dados (2d6) | Card System | El rango 2–12 con promedio 7 define toda la economía escudo vs. ataque |
| `HAND_SIZE` (4) | Card System | Menor mano = decisiones más rápidas, menos opciones por turno |
| Daño de intenciones (`IntentionData.damage`) | Enemy System | Distribución Easy/Medium/Hard/Boss calibra la tensión del escudo |
| HP por tier de enemigo | Enemy System | Duración de encuentro y exposición acumulada al daño |
| Phase 2 threshold del jefe (30 HP) | Enemy System | Cuándo ocurre el giro dramático en el encuentro de jefe |
| `damage_received_multiplier` por Situación | Situation System | El único parámetro de daño que la Situación activa puede modificar directamente |
| Stack caps de estados (Vergüenza=3, Confianza=4) | Status Effect System | Techo del bonus/penalidad — limita picos de daño del enemigo |

## Visual/Audio Requirements

*Principio rector: El Combat System es el director de escena del encuentro — orquesta entradas, victorias y derrotas, pero nunca roba el foco de los sistemas que definen los momentos individuales. Los eventos de carta, intención, estado y aliado individual están definidos en sus GDDs respectivos. Esta sección cubre únicamente los umbrales estructurales: el telón que sube y el telón que baja.*

| Evento | Visual | Color | Audio | Prioridad |
|---|---|---|---|---|
| **Inicio de encuentro regular** — `encounter_started(data)` | Panel de Situación entra con **Snap** (~0.25s, ver Situation System GDD). Sprite del enemigo desliza desde el borde derecho: ~80px en 0.3s con **Spring** leve al detenerse (rebote de 4px, retorno 0.1s). `flavor_text` del enemigo aparece como línea de tinta sin panel — fade in 0.2s, persiste 1.5s, fade out. HP bar snappea a posición una vez asentado el sprite. La mano de cartas y la banda de maná no aparecen hasta `DRAW_HAND` — la pantalla "respira" 0.3s con enemigo y Situación solos. | Ningún color de amenaza al entrar. HP bar en Dorado Caos `#F2B71F` (llena). El tono de amenaza entra con la primera intención telegrafada. | `sfx_encounter_start` — algo que entra en escena, físico y levemente cómico. Tono medio, <0.4s. Solapado con el desplegado de pergamino de Situación. | HIGH |
| **Inicio de encuentro de jefe** — `is_boss_encounter == true` | Igual al regular con diferencias: (1) Corte negro de 3 frames (~0.05s) antes de que el sprite entre — un parpadeo de oscuridad, sin fade. La música cambia en ese mismo frame. (2) Sprite del Inquisidor: deslizamiento más lento, 0.5s, Spring más amortiguado. (3) `flavor_text` persiste 2.5s en lettering +10% más grande. (4) `CanvasModulate(0.78, 0.85, 1.0)` activo desde el primer frame — no entra gradualmente. | El corte negro sin tinte de color. `CanvasModulate` azul-gris del jefe aplicado desde el primer frame (Enemy System GDD §Visual). | `sfx_boss_encounter_start` — más grave, más ceremonioso. "Algo de peso tomó asiento." <0.6s. Música de jefe entra simultáneamente — única transición de música del MVP. | HIGH |
| **Declaración de victoria** — `VICTORY_RESOLUTION` activa | Input del jugador bloqueado (Directo). Mano de cartas y banda de maná: fade out 0.15s (Spring suave). Panel de Situación: destella Dorado Caos **Snap** (`1.0→1.15→1.0`, ~0.2s) luego fade out 0.3s. Texto de victoria estampado en zona central — **Snap** escala `0→1.25→1.0` en 0.15s, estilo sello de madera en lettering de tinta gruesa. Contenido del texto: *TBD — definir en `/ux-design encounter-screen`*. El estado se sostiene 1.2s antes de que SceneManager tome control. | Dorado Caos `#F2B71F` para el destello del panel y el sello de texto. Sin Rojo ni Verde Absurdo — la victoria es cálida y definitiva. | Sello de madera sobre pergamino — más pesado que el del Situation System GDD Track. ~0.3s. Opcionalmente: nota de laúd corta encadenada ~0.1s después. La música no cambia — la pantalla de recompensa lo maneja. | HIGH |
| **Victoria alternativa** — `check_alt_victory() == true`, enemigo vivo | Igual que la declaración de victoria con diferencias: (1) Sprite del enemigo permanece en idle — NO snappea a pose de derrota (el enemigo sigue vivo). (2) Sobre el sprite del enemigo: ícono de interrogación boceto (el mismo de PASS_TURN del Enemy System GDD) — **Snap** `0→1.2→1.0`, persiste mientras la pantalla está visible. (3) El sello de texto de victoria incluye una pequeña estrella de tinta en la esquina superior izquierda. | Estrella en Verde Absurdo `#6BBF5E`. El resto igual: Dorado `#F2B71F`. La combinación Dorado + Verde Absurdo comunica "ganaste, pero de una manera rara." | Sello de madera de victoria + nota de viento corta y leve (flauta o silbato) ~0.1s después. Discreta — el resultado inesperado tiene su propio timbre. | HIGH |
| **Declaración de derrota** — `player_died()`, `DEFEAT_RESOLUTION` | Animación de muerte del jugador (3 beats del Player Character System GDD) se ejecuta completa. Después del Beat 3 (caída + estrellitas en loop): vignette de tinta negra se cierra desde los bordes — lenta, 0.8s. El sprite del jugador caído queda visible en el centro; todo lo demás queda cubierto. El sprite del enemigo permanece en su pose de anticipación o idle — no celebra. La viñeta se sostiene 0.5s antes de que SceneManager tome control. El texto de derrota pertenece a la pantalla de GameOver. | Vignette en Tinta `#2C1B0E`. Estrellitas del jugador en Dorado Caos `#F2B71F` (irónico, Player Character System GDD). | Después del Beat 3 del jugador: silencio de 0.3s. Luego: nota grave de cuerda (cello o viola), tono descendente único, ~0.6s, sin reverb. El silencio hace el trabajo. | HIGH |
| **Aliado muere absorbiendo ataque** — señal `ally_died(ally_id)` | Sprite del aliado: **Directo** — corte a escala `0.0` en 1 frame (igual que la pose de derrota del enemigo — el corte abrupto es el remate). Inmediatamente después: puff de polvo de tinta (3–4 partículas de tinta dispersas en radio de ~20px, loop de 2 frames × 3 ciclos, ~0.1s). Sin squash/stretch, sin fade — el aliado cumplió su función. El slot queda vacío. | Polvo en Tinta `#2C1B0E`. Sin color de amenaza — no es daño al jugador, es un sacrificio. | `sfx_ally_died` — golpe suave de madera sobre superficie acolchada, ~0.2s. Menos peso que `sfx_direct_attack_execute`. | HIGH |

> **📌 Asset Spec** — Visual/Audio requirements definidos. Después de que el art bible esté aprobado, ejecutar `/asset-spec system:combat-system` para producir specs de assets, dimensiones y prompts de generación.

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| **Campo de aliados** | Zona visible durante el encuentro con 1–3 slots de aliado. Cada aliado activo muestra su sprite, HP actual y HP máximo (barra segmentada al estilo art bible §3.4). Slot vacío = invisible. Actualiza en tiempo real al recibir `ally_summoned` y `ally_died`. | Art bible §7.5 (layout de encuentro), este GDD §Visual/Audio |
| **Indicador de victoria alternativa activa** | Cuando `has_alt_victory == true`: indicador de progreso visible durante el encuentro, diferenciado del Track de Situación. Actualización en tiempo real desde `SituationSystem.get_alt_victory_progress()`. | Situation System GDD §UI Requirements |
| **Overlay de victoria / derrota** | Sello de victoria y vignette de derrota aparecen sobre el encuentro activo antes de que SceneManager transite. Contenido del texto de victoria: TBD en `/ux-design encounter-screen`. | Este GDD §Visual/Audio |
| **Layout general del encuentro** | Integra: zona del enemigo, panel de Situación, campo de aliados, banda de maná, mano de cartas, HP del jugador, IB counter, telegráfico del enemigo, íconos de estado alterado. El layout exacto pertenece al UX spec. | Art bible §7.5, `/ux-design encounter-screen` |

> **📌 UX Flag — Combat System**: Este sistema es el encuentro completo — todas sus UI requirements convergen en un único screen crítico. En Phase 4 (Pre-Production), ejecutar `/ux-design encounter-screen` para definir el layout integrado de todos los elementos. Los tickets de implementación de UI de combate deben citar `design/ux/encounter-screen.md`, no este GDD directamente.

## Acceptance Criteria

**AC-COMBAT-01 — Turn sequence is invariant**
Verificado: el ciclo de 8 pasos avanza en el orden exacto
ENEMY_TELEGRAPH → DRAW_HAND → ROLL_MANA → CACHE_COSTS → PLAYER_ACTION
→ CONFIANZA_CHECK → ALLY_ATTACK → ENEMY_ATTACK → END_OF_TURN.
Ningún paso puede saltarse, revertirse ni ejecutarse fuera de orden en una partida normal.

**AC-COMBAT-02 — Fórmula 1 (single-hit) aplica correctamente**
Dado: `damage=10`, `vergüenza_enemigo=1`, `confianza_enemigo=2`, `mana_actual=4`, sin aliados.
Resultado esperado: `daño_modificado=11`, `daño_a_hp=7`, `mana_post=0`.
El HP del jugador decrece exactamente 7; el maná queda en 0.

**AC-COMBAT-03 — Fórmula 2 (multi-hit, Rama B) acumula escudo correctamente**
Dado: `hit_count=2`, `damage_per_instance=2`, sin estados, `mana_actual=3`, sin aliados.
Resultado esperado: Instancia 1 → `daño_a_hp=0`, `mana=1`. Instancia 2 → `daño_a_hp=1`, `mana=0`. Total: 1 HP de daño al jugador.

**AC-COMBAT-04 — Aliado absorbe daño en lugar del jugador**
Dado: al menos 1 aliado activo, enemigo con intención `direct_attack`.
Resultado esperado: el aliado recibe el `daño_modificado` completo; el HP del jugador no cambia, incluso si el aliado muere absorbiendo. `ally_died` se emite si el aliado muere.

**AC-COMBAT-05 — Overflow de daño a aliado se descarta (no transfiere)**
Dado: aliado con `hp_current=5`, `daño_modificado=9`.
Resultado esperado: aliado muere (`alive=false`), overflow (4) descartado. Jugador: HP sin cambio.

**AC-COMBAT-06 — Confianza Excesiva drena maná en el paso 5.5**
Dado: jugador con ≥1 stack de Confianza Excesiva al terminar la fase de acción.
Resultado esperado: `mana_current` forzado a 0 antes del paso 6 (ataques de aliados). Si ya era 0, es un no-op correcto.

**AC-COMBAT-07 — Snake eyes aplica Vergüenza**
Dado: tirada 2d6 = 2 (snake eyes).
Resultado esperado: `apply_status(player_id, "vergüenza", 1)` llamado. `mana_current = 2`. El robo de mano ocurre igual.

**AC-COMBAT-08 — Doble 6 llama `draw_extra(1)`**
Dado: tirada 2d6 = 12.
Resultado esperado: `draw_extra(1)` llamado después de cachear `mana_current=12`.

**AC-COMBAT-09 — Victoria por HP = 0 activa VICTORY_RESOLUTION desde cualquier paso**
La condición `EnemySystem.get_hp() <= 0` verifica después de cada `card_effect_resolved` (paso 5) y después de cada ataque de aliado (paso 6). Una victoria detectada en cualquiera de estos puntos activa VICTORY_RESOLUTION sin ejecutar los pasos restantes del turno.

**AC-COMBAT-10 — Derrota tiene prioridad sobre victoria alternativa simultánea**
Dado: en el mismo frame, `player_died()` recibido Y `check_alt_victory()` = true.
Resultado esperado: `DEFEAT_RESOLUTION` activa. `request_transition(GameOver)` llamado. No `VICTORY_RESOLUTION`.

**AC-COMBAT-11 — Ataques de aliados se detienen si el enemigo muere mid-lista**
Dado: 3 aliados activos; el primero mata al enemigo.
Resultado esperado: VICTORY_RESOLUTION activa inmediatamente. Los otros 2 aliados no atacan ese turno.

**AC-COMBAT-12 — Límite de 3 aliados se respeta**
Dado: 3 aliados activos en campo.
Resultado esperado: una carta de invocación no produce `ally_summoned`. `ally_list.count()` nunca supera 3.

**AC-COMBAT-13 — Transición de Fase 2 del jefe se dispara exactamente una vez**
Dado: jefe con `phase_threshold=30`. Jugador inflige daño que lleva HP de 34 a 28.
Resultado esperado: intención de transición insertada en el script. `fase_2_ya_activa=true`.
Verificar también: daño adicional posterior no re-dispara la transición.

**AC-COMBAT-14 — HP=0 del jefe suprime la transición de fase 2**
Dado: HP del jefe en 32, `fase_2_ya_activa=false`. Jugador inflige 32 de daño en un solo hit.
Resultado esperado: `hp_current=0` → `enemy_defeated` emitido. Fórmula 5 NO evaluada. Transición de Fase 2 no ocurre.

**AC-COMBAT-15 — POST_ENCOUNTER limpia aliados y estados; HP y mazo persisten**
Después de VICTORY_RESOLUTION: `ally_list.count() == 0`, todos los estados de todas las entidades eliminados. HP del jugador y estado del mazo iguales al valor al momento de la victoria.

**AC-COMBAT-16 — Routing de jefe vs regular correcto**
Encuentro regular: `request_transition(Reward)`. Encuentro de jefe: `request_transition(RunVictory)`.

## Open Questions

Ninguna — todas las preguntas identificadas durante el diseño se resolvieron inline o fueron delegadas a sus GDDs respectivos. Texto de pantalla de victoria: TBD en `/ux-design encounter-screen`.
