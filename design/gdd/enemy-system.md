---
sidebar_position: 9
title: Sistema de Enemigos
description: Diseño de enemigos — intenciones telegrafadas, HP, stats, estados alterados, y las 6 criaturas MVP más el jefe.
---

# Enemy System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-18
> **Implements Pillar**: Caos Ordenado · Situaciones como Escenario Narrativo · Caos como Oportunidad

## Overview

El Enemy System define a cada oponente que el jugador enfrenta en Caos en Mano: qué es un enemigo como entidad de datos — sus HP, rango de daño, conjunto de intenciones posibles e interacciones con estados alterados — y qué experimenta el jugador al combatirlo. Cada turno, el enemigo telegrafía una intención legible de su pool antes de que el jugador robe o tire maná, entregando la información que el jugador necesita para tomar una decisión táctica en menos de 10 segundos. Los enemigos pueden recibir y mantener estados alterados (Vergüenza reduce su daño de salida; Sospechoso puede forzarlos a pasar el turno), y pueden aplicar estados al jugador como parte de sus intenciones. El sistema es responsable de los 6 enemigos MVP y 1 jefe, cada uno con un perfil de comportamiento distinto que genera problemas tácticos y situaciones cómicas diferentes al combinarse con las Situaciones activas. Sin este sistema no hay oponente, no hay intención que leer, no hay estado que explotar — y las reglas de campo narrativas del Situation System no tienen objetivo sobre el cual actuar.

## Player Fantasy

Cada enemigo en Caos en Mano se toma su rol completamente en serio — y ese es exactamente el problema que tiene. El Caballero Confiado va a dar un discurso épico antes de atacar. El Burócrata va a exigir la documentación correspondiente. La Bruja Indignada va a maldecirte con propiedad y decoro. No saben que están en una comedia; creen que están en una epopeya. El jugador no enfrenta obstáculos: enfrenta *personajes comprometidos con su bit*. El placer central del sistema viene de romperles el bit.

Cuando aplicás Vergüenza al Caballero justo antes de su discurso, no le quitás puntos de vida — le quitás el momento. Cuando el Burócrata telegrafía "Exigir Sello Oficial" y vos jugás cualquier carta remotamente irrespetuosa, la escena que él tenía planeada deja de existir. Cuando Sospechoso le bloquea sus intenciones de ataque directo y el enemigo pasa el turno mirando hacia otro lado, eso no es una mecánica de bloqueo — es un personaje que perdió la concentración. Los estados alterados son el idioma narrativo del bit roto: Vergüenza es cuando el bit se derrumba, Confianza Excesiva es cuando el bit reddobla peligrosamente, Sospechoso es cuando el bit se pone paranoico. La intención telegrafada cada turno es la primera línea del chiste — la carta que el jugador elige es el remate.

Si el sistema falla en entregar esto, los enemigos se convierten en bolsas de HP con íconos flotando sobre la cabeza. Vergüenza pasa a ser "–1 daño por stack" en vez de "el Caballero no puede mirarte a los ojos". La Bruja telegrafía "4 de daño" en vez de "Maldición Formal con Documento Adjunto". El Burócrata muere sin que nadie recuerde quién era. El mundo pierde su tono de epopeya absurda mal escrita — y queda un combate de cartas genérico con texto de sabor encima.

## Detailed Design

### Core Rules

**1. Enemy Entity Data Schema**

Each enemy is defined as `EnemyData` — a JSON resource loaded by `DataLoader`. No code changes are needed to add a new enemy; the schema is expressive enough for all MVP enemy behaviors.

```
EnemyData {
  id:                  String          -- e.g., "caballero_confiado"
  name:                String          -- display name
  flavor_text:         String          -- 1-line "bit" shown at encounter start
  art_archetype:       String          -- art bible archetype key
  difficulty_tier:     String          -- "easy" | "medium" | "hard" | "boss"
  hp:                  int
  intention_pool:      Array[IntentionData]
  exposed_properties:  Array[String]   -- always ["hp", "current_intention_type",
                                       --         "active_statuses"]
}
```

Enemies have no attack stat, speed stat, or defense stat. All offensive output is declared per intention.

**2. Intention Data Schema**

```
IntentionData {
  id:               String                        -- unique within the enemy
  display_name:     String                        -- shown in telegraph UI
  flavor_text:      String                        -- 1-line narrative description
  type:             String                        -- see taxonomy below
  tags:             Array[String]                 -- includes "[direct_attack]" if applicable
  damage:           int                           -- flat, fixed value; 0 for non-damaging
  status_applied:   Array[StatusApplicationData]
  weight:           int                           -- 1–10; 1 = uniform
  disabled_when:    Array[String]                 -- status IDs that disable this intention
}

StatusApplicationData {
  target:     String    -- "player" | "self"
  status_id:  String    -- vergüenza | confianza_excesiva | sospechoso | inspirado
  stacks:     int
}
```

**3. Intention Type Taxonomy**

| Type | Mechanical behavior | Tags | Sospechoso interaction |
|---|---|---|---|
| `direct_attack` | Deals `damage` through player's mana shield | `[direct_attack]` | Blocked entirely → pass turn (or boss override) |
| `status_attack` | Deals `damage` (can be 0) AND applies statuses | `[direct_attack]` if damage > 0 | Blocked if tagged |
| `buff_self` | Applies statuses to itself; 0 damage | — | Never blocked |
| `posture` | 0 damage, no effects — enemy spends turn in-narrative | — | Never blocked |
| `multi_hit` | `damage` split across N instances; each instance tagged `[direct_attack]` | `[direct_attack]` | Blocked entirely; Vergüenza reduces each instance separately; Confianza Excesiva adds per instance |

**Damage is fixed per intention — there is no enemy dice roll.** The telegraphed damage value is exact and absolute; the player always knows the precise consequence of not shielding.

**4. Intention Selection Algorithm (Regular Enemies)**

```
FUNCTION select_intention(enemy):
  1. eligible_pool = []
  2. For each intention I in enemy.intention_pool:
       For each status_id in I.disabled_when:
         IF StatusEffectSystem.get_stack_count(enemy.id, status_id) > 0: SKIP I
       ELSE: append I to eligible_pool with weight I.weight
  3. IF eligible_pool is EMPTY:
       RETURN PASS_TURN  (damage=0, type="posture", display_name="(Pasa el turno)")
  4. total_weight = sum of eligible weights
     roll = random_int(0, total_weight - 1)
     Walk eligible_pool until cumulative weight > roll → RETURN that intention
  5. Cache as enemy.current_intention (unchanged until next turn's selection)
```

Weights let designers express character: El Caballero telegraphs his speech (weight 3) more often than his heavy strike (weight 1). All weights default to 1 (uniform) and are tuned during playtest.

**Boss exception:** Boss does NOT use this algorithm — see Boss Design Rules below.

**5. The 6 MVP Enemy Profiles**

Damage convention by tier: Easy Attack 3–5, Heavy 6–8. Medium Attack 5–7, Heavy 8–10. Hard Attack 6–8, Heavy 9–12.

---

**El Caballero Confiado** — Easy | HP: 18

*Bit:* Está convencido de que este es el clímax de su épica. Tiene un discurso preparado. No va a callarlo por nada del mundo.

*Art archetype:* Caballero con armadura barata, penacho doblado, pose heroica en situación claramente inadecuada.

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `discurso_heroico` | "Discurso Heroico" | posture | 0 | — | 3 |
| `espadazo_confiado` | "Espadazo Confiado" | direct_attack | 5 | — | 2 |
| `pecho_afuera` | "Pecho Afuera" | buff_self | 0 | self: confianza_excesiva 1 | 2 |
| `embate_del_heroe` | "¡Embate del Héroe!" | direct_attack | 7 | — | 1 |

*disabled_when:* `espadazo_confiado`, `embate_del_heroe` → `["sospechoso"]`

*Teaching role:* Introduces telegraphed intentions. `discurso_heroico` gives the player a free turn — teaches mana management without punishment.

---

**El Burócrata** — Easy | HP: 16

*Bit:* Tiene formularios. Tiene sellos. Tiene un proceso. Y va a seguirlo aunque le cueste la vida.

*Art archetype:* Funcionario con sombrero de copa, carpeta de pergaminos desbordante, sello oficial enorme.

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `exigir_documentacion` | "Exigir Documentación" | status_attack | 0 | player: vergüenza 2 | 3 |
| `sello_oficial` | "Sello Oficial" | direct_attack | 5 | — | 2 |
| `revision_de_expediente` | "Revisión de Expediente" | status_attack | 3 | player: sospechoso 1 | 2 |
| `formulario_47_b` | "Formulario 47-B" | posture | 0 | — | 1 |

*disabled_when:* `sello_oficial`, `revision_de_expediente` → `["sospechoso"]`

*Teaching role:* First status-applying enemy. `exigir_documentacion` (0 damage, 2 Vergüenza) teaches that non-damaging intentions can be more threatening than direct attacks.

---

**La Bruja Indignada** — Medium | HP: 26

*Bit:* No está mal que seas su enemigo. Está mal que seas tan poco ceremonioso al respecto. Hay protocolos para esto.

*Art archetype:* Bruja con sombrero puntiagudo impecable, varita de madera oscura, expresión de profundo hastío ante tanto amateur.

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `maldicion_formal` | "Maldición Formal" | status_attack | 5 | player: vergüenza 1 | 2 |
| `correccion_protocolar` | "Corrección Protocolar" | status_attack | 0 | player: sospechoso 2 | 3 |
| `rayo_de_decepcion` | "Rayo de Decepción" | direct_attack | 8 | — | 2 |
| `conjuro_con_queja` | "Conjuro con Queja Adjunta" | multi_hit | 4 | — | 1 |

`conjuro_con_queja`: 2 instances of 2 damage each (total 4). Vergüenza reduces each instance separately.

*disabled_when:* `maldicion_formal`, `rayo_de_decepcion`, `conjuro_con_queja` → `["sospechoso"]`

*Teaching role:* First multi_hit encounter. `correccion_protocolar` (0 damage, Sospechoso 2) teaches that 0-damage turns can be the most dangerous setup moves.

---

**El Guardia Tímido** — Medium | HP: 24

*Bit:* Tiene el trabajo. No tiene las ganas. Ni el entrenamiento. En realidad no está seguro de por qué está aquí.

*Art archetype:* Guardia con armadura dos talles grande, lanza que no sabe sostener, expresión de "¿alguien más puede hacer esto?".

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `golpe_resignado` | "Golpe Resignado" | direct_attack | 7 | — | 2 |
| `esto_no_esta_en_mi_contrato` | "Esto No Está en mi Contrato" | posture | 0 | — | 3 |
| `grito_de_trabajo` | "¡A las Armas! (Casi)" | buff_self | 0 | self: vergüenza 1 | 2 |
| `lanzada_mas_bien` | "Lanzada Más Bien" | direct_attack | 9 | — | 1 |

`grito_de_trabajo` self-applies Vergüenza — the Guardia debuffs himself. Next `lanzada_mas_bien` after self-Vergüenza: `max(0, 9-1) = 8`.

*disabled_when:* `golpe_resignado`, `lanzada_mas_bien` → `["sospechoso"]`

*Teaching role:* Introduces self-debuffing enemies and the first genuinely threatening single hit (9 damage).

---

**El Juglar Perturbado** — Medium | HP: 26

*Bit:* Hace malabares. Nadie se lo pidió. El número no termina nunca.

*Art archetype:* Juglar con demasiadas pelotas en el aire, concentración total e inapropiada, cascabeles que suenan en el peor momento.

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `lanzamiento_preciso` | "Lanzamiento Preciso" | direct_attack | 6 | — | 2 |
| `catarata_de_pelotas` | "Catarata de Pelotas" | multi_hit | 6 | — | 2 |
| `el_numero_especial` | "El Número Especial" | buff_self | 0 | self: confianza_excesiva 2 | 2 |
| `se_distrae` | "Se Distrae" | posture | 0 | — | 1 |

`catarata_de_pelotas`: 3 instances of 2 damage each. After `el_numero_especial` (+2 Confianza Excesiva): 3 × (2+2) = **12 total damage** — highest spike in the regular enemy pool.

*disabled_when:* `lanzamiento_preciso`, `catarata_de_pelotas` → `["sospechoso"]`

*Teaching role:* First escalating threat. Letting the Juglar buff himself turns the next multi_hit into a 12-damage spike — teaches the player to prioritize status removal.

---

**El Ogro Diplomático** — Hard | HP: 40

*Bit:* Es enorme. Es brutal. Y está comprometido con resolver esto amigablemente. Su idea de "amigablemente" es la tuya, pero en voz más alta.

*Art archetype:* Ogro con chaleco de negociador (dos talles pequeño), maletín gigante de madera, expresión de "trabajemos juntos en esto" con nueve dientes.

| ID | Display | Type | Dmg | Status applied | Wt |
|---|---|---|---|---|---|
| `propuesta_razonable` | "Propuesta Razonable" | direct_attack | 8 | — | 2 |
| `negociacion_agresiva` | "Negociación Agresiva" | status_attack | 10 | player: vergüenza 1 | 2 |
| `impasse` | "Impasse" | posture | 0 | — | 1 |
| `acuerdo_final` | "Acuerdo Final" | buff_self | 0 | self: confianza_excesiva 1 | 2 |

`negociacion_agresiva` (10 damage + Vergüenza 1) is the hardest single hit in the regular enemy pool.

*disabled_when:* `propuesta_razonable`, `negociacion_agresiva` → `["sospechoso"]`

*Teaching role:* Hard difficulty. 40 HP extends the encounter. Introduces the Confianza Excesiva escalation loop for hard-tier content.

---

**6. Boss Profile — El Gran Inquisidor del Formulario Correcto**

*Bit:* No está aquí para derrotarte. Está aquí para que este encuentro se procese correctamente. Tiene un expediente de tu caso. El doble de formularios que el Burócrata. Y se niega a que esta situación se resuelva sin la documentación en orden.

*Art archetype:* Magistrado en silla-trono de papeleo apilado, sello oficial del tamaño de un escudo, toga con insignias de todos los departamentos, serenidad burocrática absoluta ante el caos.

**HP: 60 | Phase 2 threshold: 30 HP**

**Script structure:**

```
BossScript {
  phase_1_script:       Array[IntentionData]  -- while HP > 30
  phase_threshold:      int = 30
  phase_transition:     IntentionData         -- fires ONCE when HP crosses 30
  phase_2_script:       Array[IntentionData]  -- while HP <= 30
  sospechoso_override:  IntentionData         -- replaces blocked direct_attack turns
}
```

**Phase 1 — "Procedimiento Estándar"** (HP > 30, cycles in order then loops):

| Turn | Intention | Type | Dmg | Status |
|---|---|---|---|---|
| 1 | "Formulario de Apertura" | posture | 0 | — |
| 2 | "Primer Sello" | status_attack | 0 | player: vergüenza 2 |
| 3 | "Advertencia Formal" | direct_attack | 7 | — |
| 4 | "Doble Sello" | status_attack | 4 | player: vergüenza 1 + sospechoso 1 |
| 5 | "Consultar Superior" | buff_self | 0 | self: confianza_excesiva 1 |
| 6 | "Resolución Administrativa" | direct_attack | 9 | — |
| *(loop)* | | | | |

**Phase Transition (fires ONCE when HP first crosses 30):**

| Intention | Type | Dmg | Status |
|---|---|---|---|
| "¡Esto Requiere Expediente Especial!" | posture | 0 | self: confianza_excesiva 2 |

*0 damage. Boss self-buffs heavily. One free turn for the player to prepare for Phase 2.*

**Phase 2 — "Procedimiento de Emergencia"** (HP ≤ 30, cycles then loops):

| Turn | Intention | Type | Dmg | Status |
|---|---|---|---|---|
| 1 | "Acusación Formal" | status_attack | 5 | player: vergüenza 2 |
| 2 | "Castigo Protocolar" | direct_attack | 10 | — |
| 3 | "Sello de Condena" | multi_hit | 8 | — |
| 4 | "Fallo Final" | status_attack | 8 | player: sospechoso 2 |
| *(loop)* | | | | |

"Sello de Condena": 2 instances of 4 damage each. With any Confianza Excesiva stacks from Phase 1: 2 × (4 + stacks).

**Sospechoso Override:**

When the player applies Sospechoso to the boss and the current scripted intention is a `direct_attack`, the boss executes its `sospechoso_override` instead:

| "El expediente valida el proceso" | buff_self | 0 | self: confianza_excesiva 1 |

*The Inquisidor interprets being observed as validation his process is working. The player avoids the damage but escalates the boss's Confianza Excesiva. Strategic trade-off, not a free win.*

Non-`direct_attack` scripted turns (posture, status_attack, buff_self) are not affected by Sospechoso.

**7. Boss Design Rules**

1. **Position:** Boss always appears at the final encounter node of the run. Node Map System reserves a designated boss node type.
2. **HP floor:** All bosses in any future content must have HP ≥ 50. Ensures the phase threshold activates in a meaningful mid-fight moment.
3. **Phase count:** MVP bosses have exactly 2 phases. The transition intention fires exactly once when HP first crosses the threshold — even if a single hit carries HP from above the threshold to well below it.
4. **No randomness:** The `select_intention()` algorithm is never called for boss entities. The boss always executes the next step in its script.
5. **Sospechoso override (not immunity):** Bosses do not pass their turn when Sospechoso is active. Each scripted `direct_attack` is replaced by `sospechoso_override_intention`. Non-`direct_attack` turns proceed normally.
6. **Vergüenza applies normally:** Boss damage is reduced via `max(0, damage - stacks)`. Boss is not immune. "Castigo Protocolar" (10 dmg) at Vergüenza cap=3: `max(0, 10-3) = 7`. Still threatening.
7. **No mid-boss healing:** Boss HP is strictly a countdown. Phase transitions do not restore HP.
8. **Phase transition narrative beat:** 1–2 lines of flavor text fire during the transition posture turn. Duration ≤ 2 seconds. Does not interrupt turn sequence.
9. **Post-boss:** Boss HP reaching 0 triggers run-end victory. SceneManager transitions to the victory screen.

**8. Situación-Exposed Enemy Properties**

Active Situaciones access enemy state through the read-only `EnemyState` interface:

| Property | Access | Situación use |
|---|---|---|
| `hp` | Read-only | Alt-victory conditions (e.g., "reduce enemy to exactly 5 HP") |
| `current_intention_type` | Read-only | Conditional trigger effects (e.g., "if enemy telegraphs `posture`, player gains Inspirado 1") |
| `current_intention_damage` | Read-only | Conditional card cost modifiers |
| `active_statuses` | Read-only via StatusEffectSystem | Conditional effects based on enemy state |
| `damage_received_multiplier` | Read/Write (default 1.0) | Encounter-level resistance or amplification |
| `status_immunity` | Write (empty default) | Encounter-length immunity to specific status IDs |

```
EnemyState (read-only interface exposed to SituationSystem):
  get_hp() → int
  get_current_intention() → IntentionData
  get_damage_multiplier() → float
  is_immune_to(status_id: String) → bool
  get_active_statuses() → Dictionary[String, int]
```

### States and Transitions

**Enemy encounter lifecycle:**

```
[ Inactive ]  ←— not yet spawned
     │ encounter begins (SceneManager spawns encounter)
     ▼
[ Active ] — hp_current > 0; intention selection runs each turn
     │
     │ take_damage() results in hp_current == 0
     ▼
[ Defeated ] — emits signal enemy_defeated(); terminal state
```

**Intention lifecycle per turn:**

```
[ Selection ] → intention selected at Step 1 (telegraph phase)
      │
      ▼
[ Revealed ] → intention shown to player; cached as current_intention
               (unchanged while player acts and allies attack)
      │
      ▼
[ Executing ] → intention effect resolves at Step 7
      │
      ▼
[ Completed ] → back to Selection for the next turn
```

### Interactions with Other Systems

| System | Interface | When |
|---|---|---|
| **DataLoader** | Reads `EnemyData` JSON at encounter start | On `SceneManager.transition_completed(ActiveEncounter)` |
| **StatusEffectSystem** | `get_stack_count(enemy.id, status_id)` — evaluate disabled intentions; `apply_status(player_id, …)` — execute status intentions; `tick_end_of_turn(enemy.id)` — decay enemy statuses | Intention selection and turn execution |
| **CombatSystem** | Exposes `take_damage(amount: int)` — called by CombatSystem when player/ally deals damage; emits `signal enemy_defeated()` when HP reaches 0 | On card resolution and ally attack steps |
| **SituationSystem** | Exposes read-only `EnemyState`; applies `damage_received_multiplier` and `status_immunity` from `SituationData.enemy_behavior_modifiers` on encounter load | Encounter start (mods applied once) and card resolution (multiplier read) |
| **SceneManager** | Listens to `transition_completed(ActiveEncounter)` to initialize; victory handled by CombatSystem listening to `enemy_defeated` | Encounter lifecycle |

> **⚠️ Card System GDD retrofit note:** The Card System GDD §Formulas describes `daño_enemigo` as "resultado de la tirada 2d6 del enemigo." This GDD supersedes that interpretation: `daño_enemigo` is the fixed `damage` value declared in the active `IntentionData`, not a dice roll. The Card System GDD formula variable label should be updated in a future retrofit session.

## Formulas

### Fórmula 1: Probabilidad de selección de intención ponderada

`p(I) = weight_I / Σ weight_eligible`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|----------|---------|------|-------|-------------|
| Peso de la intención | `weight_I` | int | 1–10 | Peso declarado en `IntentionData.weight` |
| Suma de pesos elegibles | `Σ weight_eligible` | int | 1–40 | Suma de pesos de todas las intenciones no deshabilitadas este turno |
| Probabilidad de selección | `p(I)` | float | 0.0–1.0 | Probabilidad de que I sea seleccionada |

**Rango de salida:** 0.0 a 1.0. Si I está deshabilitada: `p(I) = 0`. Si es la única elegible: `p(I) = 1.0`. La suma sobre todo el pool elegible es exactamente 1.0.

**Ejemplo:** El Caballero Confiado con Sospechoso activo. Pool reducido a `discurso_heroico` (w=3) + `pecho_afuera` (w=2). `Σ = 5`. `p(discurso_heroico) = 0.60`, `p(pecho_afuera) = 0.40`.

---

### Fórmula 2: Daño del enemigo al jugador (cadena de resolución)

**Paso 1 — Modificación por estados del enemigo:**

`daño_modificado = max(0, damage - stacks_vergüenza_enemigo) + stacks_confianza_enemigo`

*Aplica `daño_con_vergüenza` y `daño_con_confianza` del Status Effect System GDD §Formulas 4 y 5. Para intenciones `single_hit` (direct_attack, status_attack), ambos modificadores aplican sobre el valor total.*

**Paso 2 — Absorción del escudo de maná** *(resuelto por Combat System):*

`daño_a_hp = max(0, daño_modificado - absorcion_escudo)`

**Cadena completa:**

`daño_a_hp = max(0, max(0, damage - stacks_vergüenza_enemigo) + stacks_confianza_enemigo - absorcion_escudo)`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|----------|---------|------|-------|-------------|
| Daño declarado en la intención | `damage` | int | 0–16 | Valor fijo de `IntentionData.damage` |
| Stacks de Vergüenza en el enemigo | `stacks_vergüenza_enemigo` | int | 0–3 | Reduce el daño de salida del enemigo |
| Stacks de Confianza Excesiva en el enemigo | `stacks_confianza_enemigo` | int | 0–4 | Amplifica el daño de salida del enemigo |
| Daño post-estado | `daño_modificado` | int | 0–20 | Daño después de Vergüenza y Confianza; nunca negativo |
| Absorción del escudo de maná | `absorcion_escudo` | int | 0–12 | Maná actual del jugador en el momento de la resolución |
| Daño final al HP del jugador | `daño_a_hp` | int | 0–20 | Cantidad que reduce `hp_current`; nunca negativo |

**Rango de salida:** 0 a 20. Con escudo completo (12 maná) absorbe hasta 12 puntos; cualquier exceso penetra al HP.

**Ejemplo:** El Ogro Diplomático ejecuta "Negociación Agresiva" (`damage=10`), tiene 2 stacks Confianza Excesiva y 1 Vergüenza. Jugador con 4 maná. `daño_modificado = max(0, 10-1) + 2 = 11`. `daño_a_hp = max(0, 11-4) = 7`.

---

### Fórmula 3: Daño por instancia en intenciones multi-hit

`damage_per_instance = damage / hit_count`

*`damage` y `hit_count` se declaran ambos en `IntentionData`. La división es siempre entera exacta — los valores se diseñan para no producir fracciones.*

`daño_instancia = max(0, damage_per_instance - stacks_vergüenza_enemigo) + stacks_confianza_enemigo`

*Cada instancia aplica esta fórmula de forma independiente. Los stacks de Vergüenza no se consumen por golpe — son un modificador de duración, no de cantidad.*

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|----------|---------|------|-------|-------------|
| Daño total declarado | `damage` | int | 2–16 | `IntentionData.damage` — total nominal de la intención |
| Número de instancias | `hit_count` | int | 2–4 | `IntentionData.hit_count` — declarado junto a `damage` |
| Daño por instancia (base) | `damage_per_instance` | int | 1–8 | División entera de `damage / hit_count` |
| Stacks Vergüenza en el enemigo | `stacks_vergüenza_enemigo` | int | 0–3 | Reduce cada instancia independientemente |
| Stacks Confianza Excesiva en el enemigo | `stacks_confianza_enemigo` | int | 0–4 | Amplifica cada instancia independientemente |
| Daño por instancia post-estado | `daño_instancia` | int | 0–12 | Nunca negativo |

**Rango de salida por instancia:** 0 a 12. Rango del total (2–4 instancias): 0 a 48 teórico (imposible en MVP).

**Ejemplo — "Catarata de Pelotas" tras "El Número Especial":** `damage=6`, `hit_count=3`, `damage_per_instance=2`. El Juglar tiene 2 stacks Confianza Excesiva. `daño_instancia = max(0, 2-0) + 2 = 4`. Tres instancias de 4 = **12 daño total**.

**Ejemplo — "Conjuro con Queja Adjunta":** `damage=4`, `hit_count=2`, `damage_per_instance=2`. Sin estados. `daño_instancia = 2`. Dos instancias de 2 = 4 daño total.

> *El comportamiento del escudo entre instancias de un multi-hit (si el primer golpe consume el maná y el segundo penetra directamente al HP) es responsabilidad del Combat System GDD.*

---

### Fórmula 4: Umbral de activación de fase del jefe

`activar_fase_2 = (hp_current_post_damage ≤ phase_threshold) AND NOT fase_2_ya_activa`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|----------|---------|------|-------|-------------|
| HP actual del jefe | `hp_current` | int | 0–60 | HP tras aplicar el daño del turno actual |
| Umbral de fase | `phase_threshold` | int | 1–(hp_max − 1) | HP al que se activa Fase 2; MVP = 30 |
| HP máximo del jefe | `hp_max` | int | ≥ 50 | HP total al inicio del encuentro; MVP = 60 |
| Transición ya activada | `fase_2_ya_activa` | bool | {true, false} | Bandera de un único disparo; previene re-activación |

**Rango de salida:** Booleano. La transición es un evento de disparo único — una vez que `fase_2_ya_activa = true`, la condición no se re-evalúa.

**Ejemplo:** Jefe en HP=34, Fase 1. Jugador inflige 6 de daño. `hp_current = 28`. `28 ≤ 30 AND NOT false` → transición activada. La intención "¡Esto Requiere Expediente Especial!" se ejecuta; el script de Fase 2 comienza el próximo turno.

---

### Fórmula 5: Recorrido de peso acumulativo (algoritmo de selección)

`roll = random_int(0, total_weight - 1)`

```
cumulative = 0
para i = 1 hasta n:
    cumulative += w_i
    si roll < cumulative:
        seleccionar intención i
        terminar
```

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|----------|---------|------|-------|-------------|
| Tirada aleatoria | `roll` | int | 0–(`total_weight` − 1) | Número pseudoaleatorio para este turno |
| Peso de la intención i | `w_i` | int | 1–10 | Peso de la i-ésima intención en el pool elegible |
| Peso total elegible | `total_weight` | int | 1–40 | Suma de todos los pesos en el pool elegible |
| Peso acumulativo | `cumulative` | int | 1–`total_weight` | Suma parcial tras procesar i intenciones |

**Rango de salida:** Una intención del pool elegible. Siempre termina — en la última intención `cumulative = total_weight > roll` siempre.

**Ejemplo:** Pool de 3 intenciones, pesos [3, 2, 2], `total_weight = 7`. `roll = 4`. Recorrido: i=1, `cumulative=3`, `4 < 3` → falso. i=2, `cumulative=5`, `4 < 5` → **intención 2 seleccionada**. Probabilidades efectivas: i1 = 3/7 ≈ 43%, i2 = 2/7 ≈ 29%, i3 = 2/7 ≈ 29%.

> **Nota de schema:** La Fórmula 3 introduce `hit_count` como campo requerido en `IntentionData` para intenciones `multi_hit`. Se considera una aclaración del schema definido en §Detailed Design, no un conflicto.

## Edge Cases

- **Si un enemigo tiene Vergüenza y Confianza Excesiva activas simultáneamente**: La fórmula aplica en orden fijo: `max(0, damage - stacks_vergüenza) + stacks_confianza`. La Confianza siempre suma después del `max(0,…)`. Con `damage=3`, Vergüenza=3, Confianza=2: `max(0, 3-3) + 2 = 2`. Un enemigo avergonzado pero sobreconfiado no llega necesariamente a daño cero — la Confianza Excesiva puede rescatar daño que la Vergüenza hubiera anulado.

- **Si el daño declarado del enemigo es exactamente igual a los stacks de Vergüenza**: `max(0, damage - stacks) = 0`. El ataque resuelve con daño 0 sin dañar el escudo ni el HP. La intención se ejecutó normalmente — la animación ocurre, el tipo sigue siendo `direct_attack` para Situaciones que lo observen, y el decay de Vergüenza ocurre al final del turno. Esto no es un pase de turno.

- **Si un enemigo ejecuta una intención `multi_hit` con Vergüenza activa**: Cada instancia ve el mismo valor de `stacks_vergüenza_enemigo` al momento de la ejecución. Los stacks son un modificador de duración, no de cantidad — no se decrementan entre instancias. El decay ocurre exactamente una vez al final del turno del enemigo. Si Vergüenza es suficiente para cubrir `damage_per_instance`, todas las instancias del multi-hit resultan en 0 daño.

- **Si el `hp_current` del enemigo llega a 0 durante una instancia intermedia de un multi-hit** (por efecto de una Situación `on_damage_received` con efecto letal): Las instancias restantes no se ejecutan. La transición a estado `Defeated` es inmediata en el frame en que `hp_current == 0` — el CombatSystem aborta la cola de instancias restantes al detectar el estado Defeated. En el caso ordinario (el jugador daña al enemigo en su propio turno), no hay conflicto — los eventos pertenecen a turnos distintos.

- **Si el jugador aplica Sospechoso al enemigo entre el telegráfico (Paso 1) y la ejecución de la intención (Paso 7)**: La intención cacheada en `current_intention` NO se reevalúa. El enemigo ejecuta la intención `direct_attack` telegrafada aunque Sospechoso ya esté activo. Sospechoso activo en el turno siguiente sí bloqueará la selección en el próximo Paso 1 — el bloqueo aplica a la selección, no a la ejecución de una intención ya seleccionada.

- **Si el jefe recibe un golpe que lleva su `hp_current` a 0 en Phase 1 (cruzando simultáneamente el umbral de fase y el 0)**: El check de Defeated (`hp == 0`) tiene prioridad absoluta sobre el check de umbral de fase. Un jefe que llega a 0 HP activa estado Defeated y emite `enemy_defeated` — la transición de Phase 2 no se evalúa. Un jefe muerto no transiciona de fase.

- **Si el jefe está en `hp_current = 34` (Phase 1) y recibe exactamente 5 de daño (→ 29 HP)**: La transición se activa. El jefe interrumpe su script de Phase 1 y ejecuta la intención de transición "¡Esto Requiere Expediente Especial!" como su turno actual. `fase_2_ya_activa = true`. El script de Phase 2 comienza siempre desde su turno 1 ("Acusación Formal") — no continúa desde el punto del script de Phase 1 en que estaba.

- **Si el turno scripted del jefe en Phase 2 es "Sello de Condena" (`multi_hit`, tag `[direct_attack]`) y Sospechoso está activo**: El jefe ejecuta el `sospechoso_override` en lugar de "Sello de Condena". El tipo `multi_hit` lleva el tag `[direct_attack]` (§3 Taxonomy), por lo que está incluido en Boss Design Rule #5. El jugador evita el daño; el jefe gana 1 stack de Confianza Excesiva.

- **Si el jefe ejecuta el `sospechoso_override` con Confianza Excesiva ya en cap (4 stacks)**: `apply_status("confianza_excesiva", 1)` resuelve como `min(4+1, 4) = 4` — sin cambio. En este estado el override es puro beneficio para el jugador: evita el daño sin consecuencia adicional.

- **Si el turno 4 de Phase 2 ("Fallo Final", status_attack, damage=8, aplica sospechoso 2) tiene Sospechoso activo en el jefe**: "Fallo Final" tiene `damage > 0`, por lo que lleva el tag `[direct_attack]` (status_attack con damage > 0, §3 Taxonomy). El `sospechoso_override` reemplaza "Fallo Final" completo — el jugador no recibe los 2 stacks de Sospechoso. Tanto el daño como la aplicación de estado se anulan. Este es el turno de mayor valor estratégico para aplicar Sospechoso al jefe.

- **Si la Confianza Excesiva acumulada en Phase 1 no es removida antes de la transición**: El stack persiste durante Phase 2 (no hay limpieza de estados en la transición). La intención de transición aplica además confianza_excesiva 2. Con 1 stack previo + 2 de la transición = 3 stacks al inicio de Phase 2. "Sello de Condena" con 3 stacks: 2 × (4+3) = 14 daño en lugar de 8. La presión por remover Confianza Excesiva del jefe antes de la transición es cuantificable y estratégicamente real.

- **Si todas las intenciones del pool de un enemigo son `direct_attack` y Sospechoso está activo**: El algoritmo construye `eligible_pool = []` y retorna `PASS_TURN` (damage=0, type="posture"). Este caso es imposible para todos los enemigos MVP (todos tienen al menos una intención sin tag `[direct_attack]`), pero la regla garantiza comportamiento correcto para contenido futuro con pools puramente ofensivos.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| **Data Configuration System** | Este sistema depende | Lee `EnemyData` vía `DataLoader.load_enemy(id)`. Sin DataLoader no puede instanciar ningún enemigo. Dependencia upstream dura. |
| **Status Effect System** | Este sistema depende | Llama `get_stack_count(enemy_id, status_id)` al evaluar intenciones; `apply_status(target_id, status_id, stacks)` al ejecutar intenciones; `tick_end_of_turn(enemy_id)` al finalizar el turno del enemigo. |
| **Combat System** | Depende de este | Llama `take_damage(amount)` en el enemigo cuando el jugador o aliados infligen daño; escucha `signal enemy_defeated()` para gestionar el fin del encuentro y la pantalla de recompensa. |
| **Situation System** | Depende de este | Lee la interfaz `EnemyState` (get_hp, get_current_intention, etc.) para evaluar alt-victories y trigger effects. Escribe `damage_received_multiplier` y `status_immunity` en la instancia activa del encuentro. |
| **Scene Management System** | Evento | Enemy System escucha `SceneManager.transition_completed(ActiveEncounter)` para instanciar el enemigo del encuentro y resetear su estado. |
| **Player Character System** | Indirecta | Enemy System aplica estados al jugador vía StatusEffectSystem (`apply_status(player_id, …)`) — la señal `negative_status_applied_to_player` llega al Player Character System de forma indirecta. No hay interfaz directa entre Enemy y Player Character. |

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| HP de enemigo Easy | 16–18 | 10–25 | Encuentros Easy duran más — puede sentirse lento al inicio del run | Enemigos Easy mueren en 2 turnos — sin espacio para aprender el sistema |
| HP de enemigo Medium | 24–26 | 18–35 | Encuentros más largos, más exposición al daño acumulado | Encuentros Medium tan cortos como Easy — difuminan la curva de dificultad |
| HP de enemigo Hard | 40 | 30–55 | El Ogro puede durar 8+ turnos — agota recursos antes del jefe | Encuentro Hard similar a Medium — curva sin pico visible |
| HP del jefe (`hp_max`) | 60 | 50–90 | Jefe más largo — el jugador llega con menos HP al Phase 2 | Jefe muy corto — Phase 2 puede no activarse antes de la victoria |
| Umbral de Fase 2 del jefe (`phase_threshold`) | 30 | 20–40 | Phase 2 activa antes, con el jugador con más recursos | Phase 2 activa muy tarde, el jefe muere sin que Phase 2 sea significativa |
| Confianza Excesiva de transición de jefe | 2 stacks | 1–3 | Phase 2 mucho más peligrosa si Phase 1 dejó stacks adicionales | Transición sin amenaza adicional — Phase 2 no siente escalada |
| Peso de `discurso_heroico` (Caballero, posture) | 3 | 1–5 | El Caballero telegrafía más su discurso — más turnos gratis para el jugador | El Caballero ataca más seguido — pierde la identidad del bit narrativo |
| Peso de `catarata_de_pelotas` (Juglar, multi_hit) | 2 | 1–4 | Multi-hit más frecuente — pico de daño 12 ocurre más | Multi-hit demasiado raro — la amenaza del Juglar se siente solo como riesgo teórico |
| Daño de `negociacion_agresiva` (Ogro Hard) | 10 | 7–14 | Más difícil de absorber con maná — presión extrema | Por debajo de 9 el Ogro empieza a sentirse Medium, no Hard |
| Daño de "Castigo Protocolar" (jefe Phase 2) | 10 | 7–14 | Phase 2 más letal — el jugador tiene menos turnos para terminar al jefe | Phase 2 demasiado cómoda — pierde la sensación de "procedimiento de emergencia" |

## Visual/Audio Requirements

### Estándares visuales generales (todos los enemigos)

**Barra de HP**

| Propiedad | Especificación |
|---|---|
| Posición | Sobre el sprite del enemigo, centrada horizontalmente. Offset vertical: 8px sobre el pixel más alto del bounding box. |
| Estilo | Segmentada, dibujada a mano, per art bible §3.4 "Indicadores de HP" — celdas en fila como marcas de tiza en pergamino, no una barra de gradiente. |
| Color HP alto | Dorado Caos `#F2B71F` — regla de HP del art bible (lleno = oro cálido). |
| Color HP ≤ 30% | Rojo Urgente `#D93826` — la barra cambia al rojo al deplecionar. |
| Celdas | Enemigos regulares: 5 celdas. Jefe: 10 celdas. El umbral de Fase 2 del jefe cae en celda 5 (50%) — la visual coincide con el threshold mecánico. |
| Daño visible | Al recibir `take_damage()`, celdas se vacían de izquierda a derecha con 1-frame flash en la celda recién vaciada. |

**Hit Flash:** Rojo Urgente `#D93826` — modulate completo del sprite, 1 frame encendido, snap apagado. Sin fade.

**Íconos de estado sobre enemigo:** Igual que los del jugador en tamaño (16×16px en game resolution, source 32×32px). Posicionados sobre la HP bar. Forma distinguible sin depender solo del color (Vergüenza = forma caída/abajo; Confianza = forma inflada/arriba; Sospechoso = forma angular/puntiaguda; Inspirado = forma radiante/estrella-boceto). MVP: íconos estáticos flotando per art bible §5.4.

**Regla universal de derrota:** Cuando `hp_current` llega a 0, el enemigo snappea instantáneamente a su **pose de derrota** (1 frame estático) y la mantiene hasta la transición de escena. Sin caída, sin fade, sin dissolve. El corte abrupto ES el remate del chiste — el bit termina, a mitad de gesto, como si el director de escena cortara. Las variaciones de personalidad están en el arte de la pose, no en el sistema de animación.

**Footprint en pantalla:**

| Tier | Footprint | Source art |
|---|---|---|
| Easy (Caballero, Burócrata) | ~64×80px | 128×160px |
| Medium (Bruja, Guardia, Juglar) | ~64×80px | 128×160px |
| Hard (Ogro) | ~80×96px | 160×192px |
| Boss (Inquisidor) | ~160×180px | 320×360px |

---

### Telegráfico de intención

El telegráfico se activa al inicio del turno (Paso 1 — antes de que el jugador robe o tire maná). Es la primera línea del chiste. Debe ser legible en menos de 2 segundos.

**Panel de telegráfico:** Pergamino clavado adyacente al sprite del enemigo (per art bible §3.4). Contenido: `display_name` de la intención en lettering irregular estilo tinta + ícono de tipo + valor de daño en Rojo Urgente si `damage > 0` (si damage=0, el número no se muestra). Persiste desde Paso 1 hasta Paso 7 — no cambia mid-turno aunque el jugador aplique Sospechoso después del telegráfico.

**Íconos de tipo para el panel (12×12px en panel):**

| Tipo | Forma del ícono | Color |
|---|---|---|
| `direct_attack` | Forma angular — espada/puño, puntiaguda | Rojo Urgente |
| `status_attack` | Forma de espada combinada con arco/splash | Rojo Urgente base + acento Verde/Azul según estado |
| `buff_self` | Flecha hacia arriba, boceto rústico | Dorado Caos |
| `posture` | Burbuja de diálogo o ícono de pergamino, forma redonda | Tinta sobre Pergamino — sin color semántico de amenaza |
| `multi_hit` | Múltiples marcas de golpe en cluster | Rojo Urgente, marcas dispersas |
| PASS_TURN | Panel vacío con signo de interrogación en tinta | Sin color semántico |

**Pose de anticipación del sprite:** Cuando la intención es cacheada, el sprite del enemigo cambia a una pose de anticipación estática que corresponde al tipo. Es un swap de pose estático, no una animación.

| Tipo de intención | Pose de anticipación |
|---|---|
| `direct_attack` | Wind-up: arma/extremidad hacia atrás, cuerpo inclinado adelante. Hold 0.5s (ventana de decisión del jugador). |
| `status_attack` | Prop levantado (sello, varita, pergamino) en posición de entrega. |
| `buff_self` | Pecho inflado, cabeza hacia atrás — auto-engrandecimiento. |
| `posture` | Pose de bit única del enemigo — cada enemigo tiene su pose de posture. |
| `multi_hit` | Brazos/objetos extendidos, preparación de impacto múltiple. |

---

### Animaciones y VFX por tipo de intención

**`posture`:** Enemigo mantiene su pose de bit durante el turno. El `flavor_text` de la intención aparece como tooltip en papel-rasgado cerca del enemigo (~1.5s). Sin VFX hacia el jugador. El over-design de efectos aquí socava la comedia.

**`direct_attack`:** Wind-up estático 0.5s → 1-frame pose de impacto → VFX de impacto (3–4 speed-lines en estilo boceto desde el punto de contacto; Dorado Caos si el escudo absorbe todo, Rojo Urgente si daña HP) → snap de vuelta al idle. El jugador recibe feedback de daño (squash + wobble por art bible §5.1, depleción de HP bar).

**`status_attack`:** Wind-up si `damage > 0` (idéntico a direct_attack). El ícono de estado viaja en arco desde el enemigo al objetivo, aterriza y pulsa (scale 1.0→1.2→1.0 en 2 frames), luego se ancla sobre el sprite. El daño VFX (si aplica) se dispara simultáneamente.

**`buff_self`:** Enemigo estira verticalmente (squash-stretch suave). Ícono del estado aparece sobre el enemigo con pop (0→1.15→1.0). Glow de 2 círculos concéntricos en boceto en Dorado Caos, fade en 2 frames. Ningún efecto visual hacia el jugador — la auto-satisfacción es completamente interna, lo que lo hace ridículo.

**`multi_hit`:** Cada instancia dispara como un mini `direct_attack` (wind-up 1 frame → hit VFX → recovery 1 frame), con 0.2s entre instancias. El panel de telegráfico muestra "×N" junto al valor de daño. Si Vergüenza reduce una instancia a 0, el VFX de ese golpe usa una versión desvaída ("puff" de aire en lugar de speed-lines).

---

### Notas visuales por enemigo (poses de bit y derrota)

**El Caballero Confiado:** `discurso_heroico` posture = brazo levantado, mentón arriba, boca abierta mid-discurso, espada apuntando inexplicablemente al suelo. Derrota = en la misma pose pero con la boca cerrada, brazo cayendo, ojos mirando de lado — el discurso fue cortado sin audiencia.

**El Burócrata:** `formulario_47_b` posture = encorvado sobre un pergamino enorme, sello en el aire sin aplicar. Derrota = papeles dispersos, boca abajo sobre ellos. El sello fue aplicado en su propia frente.

**La Bruja Indignada:** `correccion_protocolar` posture = brazos cruzados, varita tamborileando, expresión de hastío profundo. Derrota = de pie pero varita rota en dos. Una ceja permanentemente levantada. Sigue decepcionada.

**El Guardia Tímido:** `esto_no_esta_en_mi_contrato` posture = lanza apoyada en él (no sostenida), brazos ligeramente levantados en gesto de "no sé", mirando al costado. Derrota = armadura deslizada hacia abajo, yelmo sobre los ojos. No resistió particularmente.

**El Juglar Perturbado:** `se_distrae` posture = pelotas congeladas a diferentes alturas (implícito en la pose estática), cabeza inclinada 25° en dirección confundida. Derrota = todas las pelotas aterrizadas sobre y alrededor de él. El número terminó.

**El Ogro Diplomático:** `impasse` posture = maletín en el suelo, dos manos enormes levantadas en "calmemos la situación", sonrisa de nueve dientes. Derrota = sentado en el piso, maletín en el regazo, manos entrelazadas. Todavía parece creer que esto puede negociarse. No puede.

---

### Visual específico del jefe — El Gran Inquisidor del Formulario Correcto

**Fase 1 ("Procedimiento Estándar"):** Sentado en el trono de papeleo. Postura perfectamente erguida. Sello en el regazo. Expresión de serenidad burocrática absoluta. `CanvasModulate (0.78, 0.85, 1.0)` per art bible §6.2 — los azules y grises del Inquisidor se intensifican correctamente. `PointLight2D` desde abajo (energy 1.5, `Color(1.0, 0.7, 0.4)`) — iluminación dramática desde abajo, única al estado de jefe.

**Transición de fase — "¡Esto Requiere Expediente Especial!":** El evento visual más importante del MVP. Disparo único.

| Evento | Visual | Prioridad |
|---|---|---|
| Trigger | HP del jefe cruza 30 por primera vez | HIGH |
| Beat visual | Snap a pose de pie (1-frame pop, anticipación sentado → extremo de pie → hold) | HIGH |
| Banner de texto | "¡Esto Requiere Expediente Especial!" en lettering Rojo Urgente sobre banner Pergamino — como una proclamación. Duración: ≤2s (Boss Design Rule #8). | HIGH |
| VFX de buff | 2 pulsos de ícono Dorado Caos separados 0.15s — el jugador ve cada stack llegar individualmente | HIGH |
| Cambio de color | `CanvasModulate` a `Color(0.85, 0.80, 1.0)` — ligeramente más cálido, más urgente. Tween 0.5s. | MEDIUM |
| Turno libre del jugador | El jugador tiene un turno completo sin acción del jefe. Sin prompting visual adicional — el turno mecánico procede normalmente. | HIGH |

**Fase 2 ("Procedimiento de Emergencia"):** De pie. Sello a altura de hombro, listo para aplicar. La serenidad persiste — no está en pánico, ha elevado el procedimiento. "Sello de Condena" (multi_hit): el gráfico del sello dispara dos veces; cada impacto es una marca rectangular y angular (diferente de los speed-lines de golpe con arma — más oficial, más geométrico).

**Derrota del jefe:** El Inquisidor permanece en su pose. Cada papel del encuentro cae lentamente (sprites separados de papel disperso, loop de 1-2 frames). El sprite del personaje es estático — la excepción de ambiente. El sello sostenido al ángulo correcto — el último acto oficial de un proceso que ha concluido. Expresión sin cambios.

> **📌 Asset Spec** — Visual/Audio requirements defined. Ejecutar `/asset-spec system:enemy-system` para producir specs de assets, resoluciones y prompts de generación de cada sprite de enemigo.

---

### Requerimientos de audio

| Evento | Trigger | Prioridad |
|---|---|---|
| `sfx_enemy_hit` | Enemigo recibe `take_damage()`, hit flash activa | HIGH |
| `sfx_enemy_defeat` | HP del enemigo llega a 0, pose de derrota snappea | HIGH |
| `sfx_intention_telegraph` | Panel de intención aparece al inicio del turno | HIGH |
| `sfx_direct_attack_execute` | Intención `direct_attack` resuelve. Variante suave si el escudo absorbe todo; variante dura si daña HP | HIGH |
| `sfx_status_apply_to_player` | Ícono de estado aterriza y se ancla sobre el jugador | HIGH |
| `sfx_status_apply_to_enemy` | Ícono de estado aterriza y se ancla sobre el enemigo | HIGH |
| `sfx_buff_self_execute` | Intención `buff_self` dispara, VFX de auto-buff reproduce | MEDIUM |
| `sfx_multi_hit_instance` | Cada instancia individual de `multi_hit` impacta. Reproduce N veces por intención. El ritmo es el audio. | HIGH |
| `sfx_posture_activate` | Turno `posture` comienza, pose snappea | MEDIUM |
| `sfx_boss_phase_transition` | Banner "¡Esto Requiere Expediente Especial!" aparece | HIGH |
| `sfx_boss_sello_condena` | "Sello de Condena" multi_hit impacta — variante de jefe de `sfx_multi_hit_instance` | HIGH |
| `sfx_sospechoso_block` | Intención direct_attack bloqueada por Sospechoso, PASS_TURN ejecuta | HIGH |
| `sfx_vergüenza_zero_hit` | `direct_attack` resuelve con 0 daño por Vergüenza — fizzle, no impacto | MEDIUM |
| `sfx_encounter_start` | Enemigo aparece, flavor text del encuentro se muestra | MEDIUM |
| `sfx_boss_encounter_start` | Encuentro de jefe comienza — distinto del inicio de encuentro regular | HIGH |

**Nota de plataforma:** Web export objetivo <5MB total. Todos los SFX: 44.1kHz mono, formato OGG, recortados a la duración del evento con <10ms de silencio en cabeza/cola.

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| Panel de telegráfico de intención | Pergamino clavado adyacente al sprite del enemigo. Muestra display_name + ícono de tipo de intención + valor de daño (si > 0). Visible desde Paso 1 hasta Paso 7 del turno. Siempre presente durante el encuentro. | Art bible §3.4, este GDD §Visual/Audio |
| Barra de HP del enemigo | Barra segmentada sobre el sprite del enemigo. Siempre visible. El umbral de Fase 2 del jefe (30 HP) coincide visualmente con la celda 5 de la barra de 10 celdas. | Art bible §3.4, este GDD §Visual/Audio |
| Íconos de estado sobre el enemigo | Máximo 4 íconos simultáneos (1 por estado). Posicionados sobre la HP bar. Incluye contador de stacks. Mismo sistema y renderizado que los íconos del jugador. | Status Effect System GDD §UI Requirements |
| Nombre del enemigo / flavor text | 1-línea de `flavor_text` del `EnemyData` mostrada al inicio del encuentro (presenta el bit del enemigo). Estilo Tinta sobre Pergamino, tipografía irregular. Duración: ~2s o hasta primera acción del jugador. | Art bible §7 |

> **📌 UX Flag — Enemy System:** Este sistema tiene UI requirements en el HUD del encuentro (panel de telegráfico, barra de HP, íconos de estado). En Phase 4, ejecutar `/ux-design encounter-screen` para definir el layout exacto del área de enemigo. Las historias que referencien UI de enemigo deben citar `design/ux/encounter-screen.md`.

## Acceptance Criteria

Tests unitarios en `tests/unit/enemy-system/` (BLOCKING — Logic). Tests de integración en `tests/integration/enemy-system/` (BLOCKING). Criterios visuales corresponden a historias tipo Visual/Feel con evidencia de screenshot en `production/qa/evidence/`.

- **AC-01 (Carga de datos):** DADO un archivo JSON válido en `assets/data/enemies/caballero_confiado.json`, CUANDO `DataLoader.load_enemy("caballero_confiado")` es llamado, ENTONCES se retorna `EnemyData` con `id == "caballero_confiado"`, `hp == 18`, e `intention_pool` con exactamente 4 intenciones — sin errores de parsing, sin campos nulos. `[UNIT — BLOCKING]`

- **AC-02 (Selección ponderada — distribución estadística):** DADO El Juglar Perturbado sin estados activos con pool de pesos `[2, 2, 2, 1]` (total=7), CUANDO `select_intention()` es llamado 700 veces con semilla aleatoria fija, ENTONCES cada intención aparece en proporción que se desvía menos del 5% de su probabilidad teórica (`lanzamiento_preciso`: ≈28.6%, `catarata_de_pelotas`: ≈28.6%, `el_numero_especial`: ≈28.6%, `se_distrae`: ≈14.3%). `[UNIT — BLOCKING]`

- **AC-03 (Sospechoso deshabilita `disabled_when`):** DADO El Caballero Confiado con 1 stack de Sospechoso activo, CUANDO `select_intention()` es llamado 200 veces, ENTONCES el resultado nunca es `espadazo_confiado` ni `embate_del_heroe` — el pool elegible contiene únicamente `discurso_heroico` (w=3) y `pecho_afuera` (w=2), respetando esa distribución. `[UNIT — BLOCKING]`

- **AC-04 (PASS_TURN cuando todo está deshabilitado):** DADO un enemigo cuyo pool tiene solo dos intenciones `direct_attack` con `disabled_when: ["sospechoso"]` y tiene 1 stack de Sospechoso activo, CUANDO `select_intention()` es llamado, ENTONCES el resultado es la intención sintética con `type == "posture"`, `damage == 0`, `display_name == "(Pasa el turno)"`. `[UNIT — BLOCKING]`

- **AC-05 (Fórmula de daño — sin estados):** DADO El Ogro ejecuta "Propuesta Razonable" (`damage=8`) sin estados activos, con jugador con 3 de maná, CUANDO la intención resuelve (Fórmula 2), ENTONCES `daño_modificado == 8` y `daño_a_hp == max(0, 8-3) == 5` — el HP del jugador se reduce en exactamente 5. `[UNIT — BLOCKING]`

- **AC-06 (Vergüenza y Confianza Excesiva simultáneos — Confianza rescata):** DADO enemigo con `damage=3`, Vergüenza=3 stacks, Confianza=2 stacks, jugador con maná=0, CUANDO la intención `direct_attack` resuelve, ENTONCES `daño_modificado == max(0, 3-3) + 2 == 2` y `daño_a_hp == 2`. El daño no puede ser 0 (sin Confianza) ni 5 (sin Vergüenza). `[UNIT — BLOCKING]`

- **AC-07 (Multi-hit — Vergüenza por instancia, stacks no se consumen entre golpes):** DADO La Bruja ejecuta "Conjuro con Queja Adjunta" (`damage=4`, `hit_count=2`, `damage_per_instance=2`) con 2 stacks de Vergüenza, CUANDO la intención resuelve (Fórmula 3), ENTONCES cada instancia calcula `max(0, 2-2) + 0 == 0` independientemente — ambas resultan en 0 — y los stacks de Vergüenza permanecen en 2 entre instancias, decayendo a 1 solo al final del turno del enemigo. `[UNIT — BLOCKING]`

- **AC-08 (Multi-hit escalado por buff propio — El Juglar):** DADO El Juglar con 2 stacks de Confianza Excesiva (de "El Número Especial" previo) ejecuta "Catarata de Pelotas" (`damage=6`, `hit_count=3`, `damage_per_instance=2`) sin Vergüenza, jugador sin escudo, CUANDO la intención resuelve, ENTONCES cada instancia = `max(0, 2-0) + 2 == 4` → 3 instancias × 4 == **12 daño total al HP del jugador**. `[UNIT — BLOCKING]`

- **AC-09 (Umbral de fase del jefe — activación única):** DADO El Inquisidor con `hp_current=34` en Phase 1, `fase_2_ya_activa=false`, CUANDO recibe `take_damage(6)` (→ `hp_current=28`), ENTONCES `activar_fase_2=true` (Fórmula 4: `28 ≤ 30 AND NOT false`), la intención de transición se establece como la actual, y `fase_2_ya_activa=true` (flag permanece; no re-trigger). `[UNIT — BLOCKING]`

- **AC-10 (Defeated tiene prioridad sobre transición de fase):** DADO El Inquisidor con `hp_current=31` en Phase 1, CUANDO recibe `take_damage(31)`, ENTONCES `hp_current=0`, estado `Defeated`, `signal enemy_defeated()` emitida — la intención de transición NO se ejecuta, el script de Phase 2 NO comienza, `fase_2_ya_activa=false`. `[UNIT — BLOCKING]`

- **AC-11 (Secuencia scripted del jefe — orden exacto, sin aleatoriedad):** DADO El Inquisidor en Phase 1 con `hp_current=60`, CUANDO `select_intention()` es llamado 6 veces consecutivas sin cruzar el umbral, ENTONCES las intenciones retornan en orden: "Formulario de Apertura" → "Primer Sello" → "Advertencia Formal" → "Doble Sello" → "Consultar Superior" → "Resolución Administrativa". Ninguna llamada a `random_int()` ocurre durante la selección del jefe. `[UNIT — BLOCKING]`

- **AC-12 (Boss Sospechoso override — solo reemplaza `direct_attack`):** DADO El Inquisidor en Phase 1 con Sospechoso activo en el turno scripted "Advertencia Formal" (type `direct_attack`, damage=7), CUANDO `select_intention()` resuelve, ENTONCES retorna `sospechoso_override` ("El expediente valida el proceso", type=`buff_self`, damage=0, aplica confianza_excesiva 1 a sí mismo). DADO el turno siguiente "Doble Sello" (type `status_attack`) con Sospechoso activo, ENTONCES "Doble Sello" ejecuta sin override — `status_attack` no se reemplaza. `[UNIT — BLOCKING]`

- **AC-13 (Phase 2 siempre comienza desde turno 1):** DADO El Inquisidor que completó el turno 4 de Phase 1 justo antes de ser reducido a `hp_current ≤ 30`, CUANDO la transición de fase dispara y Phase 2 comienza, ENTONCES la primera intención de Phase 2 es "Acusación Formal" (turno 1 del script de Phase 2) — no una continuación desde el turno 5 de Phase 1. `[INTEGRATION — BLOCKING]`

- **AC-14 (El Guardia se auto-aplica Vergüenza; próximo hit reducido):** DADO El Guardia sin estados ejecuta "¡A las Armas! (Casi)" (buff_self, aplica vergüenza 1 a sí mismo), CUANDO la intención resuelve, ENTONCES `StatusEffectSystem.get_stack_count("guardia_timido", "vergüenza") == 1` — el stack está en el enemigo, no en el jugador. Si a continuación ejecuta "Lanzada Más Bien" (`damage=9`) antes del decay, el daño resuelve en `max(0, 9-1) == 8`, no 9. `[UNIT — BLOCKING]`

- **AC-15 (`tick_end_of_turn` del enemigo — exactamente una vez por turno):** DADO El Caballero con 2 stacks de Vergüenza al inicio de su turno, CUANDO el turno del enemigo se completa (intención ejecutada, turno finalizado), ENTONCES `StatusEffectSystem.tick_end_of_turn("caballero_confiado")` fue llamado exactamente 1 vez — Vergüenza decae de 2 a 1. `tick_end_of_turn` no ocurre antes de la ejecución de la intención ni más de una vez por turno. `[INTEGRATION — BLOCKING]`

- **AC-16 (Señal `enemy_defeated` — una vez, en HP=0):** DADO El Caballero con `hp_current=3` en estado `Active`, CUANDO `take_damage(3)` (o mayor) es llamado, ENTONCES `hp_current=0`, estado transiciona a `Defeated`, y `signal enemy_defeated()` es emitida exactamente 1 vez en el mismo frame. `take_damage()` en estado `Defeated` no emite la señal nuevamente. `[UNIT — BLOCKING]`

## Open Questions

| Pregunta | Estado | Resolución propuesta |
|---|---|---|
| Retrofit al Card System GDD: la variable `daño_enemigo` se documenta como "resultado de la tirada 2d6 del enemigo" en §Formulas | Pendiente — retrofit | Enemy System GDD supersede esa interpretación: `daño_enemigo` es el valor fijo de `IntentionData.damage`. Actualizar el label en el Card System GDD en la próxima sesión de retrofit. |
| Retrofit al Data Config GDD: el campo `hit_count` en `IntentionData` no está documentado en el schema de `registries.json` | Pendiente — retrofit | Agregar `hit_count: int` al vocabulario de campos de `IntentionData` antes de la historia de implementación del Enemy System. |
| ¿Las 10 cartas del mazo inicial de El Improvisador incluyen alguna que aplique estados a los enemigos? | Pendiente — content work | Definir durante la autoría del set de 20 cartas MVP. No es una regla de sistema — es decisión de contenido. |
| ¿Cuántos encuentros hay en una run antes del jefe? | Pendiente — Node Map GDD (#11) | El modelo de balance asume 5 nodos (1 Easy + 2 Medium + 1 Hard + 1 Rest). Confirmar contra el Node Map GDD cuando se diseñe. El balance de HP_BASE=60 depende de esta estructura. |
| ¿Los pesos de intención podrían ser rangos en JSON (`weight_range: [1, 3]`) para generar variedad entre runs? | Diferido post-MVP | En MVP: pesos fijos. Si el playtest muestra que los enemigos se sienten predecibles, evaluar pesos variables como primer ajuste de contenido. |
