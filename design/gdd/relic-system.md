---
sidebar_position: 10
title: Sistema de Reliquias
description: Objetos pasivos que el jugador acumula durante el run y que disparan efectos en respuesta a eventos de juego.
---

# Relic System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-18
> **Implements Pillar**: Rejugabilidad por Combinaciones · Caos como Oportunidad

## Overview

El Relic System gestiona los objetos pasivos que el jugador acumula durante el run. Cada reliquia se suscribe a eventos de juego nombrados — carta jugada, estado aplicado, turno finalizado, encuentro iniciado — y dispara su efecto automáticamente cuando ocurre el evento correcto. El jugador nunca activa una reliquia manualmente: las reliquias observan y esperan. La capa de datos es un sistema de hooks a eventos: cada reliquia define un trigger (qué evento observa) y un efecto (qué hace al disparar). Sin código por reliquia — cada reliquia es datos. La capa que experimenta el jugador es de anticipación y payoff: al elegir una reliquia post-encuentro, el jugador ya está leyendo el resto del run a través de ese lente. La reliquia que convierte cada carta de costo 3+ en un robo extra no es un bono pasivo — es una promesa sobre cómo van a jugar los próximos tres encuentros. Sin el Relic System, cada run tiene la misma estructura de poder; con él, cada run tiene una forma y una narrativa propia.

## Player Fantasy

Agarrar una reliquia es sentarse a la mesa después de que alguien cambió las reglas sin avisarle a los demás. De repente cada carta en mano significa algo distinto a lo que significaba hace diez segundos — y la Situación activa en el campo no tiene idea de lo que está pasando. La reliquia no es un bono: es una premisa. Una hipótesis sobre cómo va a jugar el resto del run. El run deja de ser una pregunta de supervivencia y se convierte en una demostración.

El pleasure del sistema es el placer conspirativo de saber el truco. El jugador que tiene "cada vez que sufro un estado negativo, robe una carta" no teme a Vergüenza — la *espera*. No está sobreviviendo el caos: lo está usando de argumentación. Dos encuentros después, lee el mapa de nodos no preguntando "¿qué me espera ahí?" sino "¿qué evento en ese nodo activa mi reliquia?". El run toma una forma que no tenía antes de la elección.

Si el sistema falla en entregar esto, las reliquias se convierten en porcentajes flotantes sin historia. El jugador las lee, piensa "bien, +10% daño", y las olvida. La diferencia entre una reliquia que fracasa y una que funciona no está en el número — está en si el jugador *cambia de estrategia* por haberla recibido. Una reliquia que no reorganiza los próximos cinco encuentros no fue suficientemente interesante.

## Detailed Design

### Core Rules

**1. Qué es una reliquia**

Una reliquia es un objeto pasivo representado por `RelicData` cargado desde `res://data/relics/relics.json` via `DataLoader`. Cada `RelicData` define un trigger (qué evento de juego activa la reliquia), un conjunto de efectos atómicos (qué hace al activarse), y condiciones opcionales (cuándo aplica y cuántos usos tiene). El jugador nunca activa una reliquia manualmente — las reliquias escuchan, esperan, y se disparan solas.

Schema de `RelicData`:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | String | Clave única snake_case |
| `name` | String | Nombre de pantalla |
| `flavor_text` | String | 1 línea de texto de sabor (pantalla de recompensa) |
| `trigger` | String | Evento de juego que activa la reliquia (vocabulario §triggers) |
| `trigger_filter` | String? | Filtro sobre el payload del evento: `"all"` / `"type:<x>"` / `"tag:<x>"` / `"amount_gte:<n>"` / `"amount_lte:<n>"` / `"outcome:<x>"`. Si se omite, equivale a `"all"`. |
| `effects` | Array[EffectData] | Efectos atómicos a ejecutar al activarse |
| `condition` | ConditionData? | Condición sobre el estado del juego evaluada al dispararse |
| `charges` | int | Usos disponibles. `-1` = ilimitado |
| `charges_reset` | String? | `"never"` (default) o `"encounter"` — cuándo se recargan los cargos |
| `rarity` | String | `"comun"` / `"raro"` / `"especial"` — usado solo para pool logic; no se muestra al jugador en MVP |
| `art_key` | String | Referencia al asset de arte |

> **⚠️ Retrofit pendiente al Data Config GDD:** Agregar `trigger_filter` y `charges_reset` al schema `RelicData` en §2, y agregar los 5 triggers nuevos al vocabulario de triggers en §3.

---

**2. Vocabulario de triggers (extensión al Data Config GDD)**

El Relic System usa el vocabulario de triggers del Data Configuration System (§3) y agrega los siguientes:

| Evento (nuevo) | Cuándo dispara | Payload |
|---|---|---|
| `on_turn_start` | Inicio del turno del jugador, antes del robo de mano | `{}` |
| `on_hand_drawn` | Tras completar el robo de la mano al inicio de turno | `{ cards: Array[String] }` |
| `on_mana_rolled` | Tras resolver la tirada 2d6 | `{ value: int }` |
| `on_card_discarded_unused` | Por cada carta descartada al fin de turno sin haber sido jugada | `{ card_id: String, card_type: String }` |
| `on_encounter_ended` | Tras resolver el encuentro, antes de la pantalla de recompensa | `{ outcome: "victory" \| "defeat" }` |

---

**3. Adquisición de reliquias**

Las reliquias se ofrecen como la opción 4 del reward screen post-encuentro (ver Deck Building System). Al elegir una reliquia:
- El jugador ve 2 opciones del pool de reliquias no adquiridas, elegidas al azar.
- `RelicManager.add_relic(relic_id)` agrega la reliquia a `_active_relics`.
- **Excepción on_run_start:** Si el trigger de la reliquia es `on_run_start`, el efecto se dispara inmediatamente en la adquisición (el run ya comenzó). No se pierde.
- **Sin límite de reliquias en MVP.** El jugador puede acumular todas las reliquias que obtenga en el run.

---

**4. Cómo se activa una reliquia — el RelicManager**

El `RelicManager` es un Autoload que escucha todos los eventos de juego via `GameEvents` (Autoload central de event bus). Todos los sistemas emiten sus eventos a `GameEvents` con una clave y un payload.

Secuencia de activación al recibir `GameEvents.event_fired(event_name, payload)`:

1. Iterar `_active_relics` en orden de adquisición (primera adquirida = primera procesada).
2. Para cada reliquia en estado `READY`: verificar `trigger == event_name`.
3. Si coincide y existe `trigger_filter`: aplicar el filtro al payload. Si no pasa, saltar.
4. Evaluar `condition` (si existe). Si no se cumple, saltar.
5. Ejecutar `effects` via `EffectDispatcher.dispatch(effect, payload)`. Decrementar `charges_remaining` si no es −1.
6. Si `charges_remaining == 0`: estado → `EXHAUSTED`.

**Re-entrancy guard (crítico):** Si RelicManager ya está procesando un evento, cualquier nuevo evento disparado por los efectos de una reliquia se encola. Los eventos en cola se procesan una vez al finalizar el evento actual, con profundidad máxima 1. Ningún efecto de reliquia puede disparar reliquias en cascada. Sin este guard, una reliquia que aplica un estado puede crear un loop infinito si otra reliquia escucha ese mismo evento.

---

**5. Las 6 reliquias MVP**

| ID | Nombre | Trigger | Trigger Filter | Effect | Charges |
|---|---|---|---|---|---|
| `sello_autenticidad` | El Sello de Autenticidad Dudosa | `on_card_played` | `amount_gte:3` (costo pagado ≥ 3) | `gain_mana: 1` | −1 |
| `diario_martir` | El Diario del Mártir Entusiasta | `on_status_applied` | `tag:negative, target:player` | `restore_hp: 2` (por stack recibido en ese evento) | −1 |
| `campana_vergüenza` | La Campana de la Vergüenza Productiva | `on_mana_rolled` | `amount_lte:4` | `draw_cards: 1` | −1 |
| `contabilidad_ogro` | La Contabilidad del Ogro | `on_encounter_ended` | `outcome:victory` | Marca flag interno `ogro_pending: true`. Al siguiente `on_encounter_start`: `deal_damage: 5` al enemigo y limpia el flag. | −1 |
| `amuleto_fallido` | El Amuleto del Turno Fallido | `on_card_discarded_unused` | `all` | `grant_next_turn_mana: 1` (acumulativo por cartas no jugadas en el turno, máximo +3) | −1 |
| `formulario_exencion` | El Formulario de Exención de Daño (Denegado) | `on_damage_received` | `amount_gte:8` | `apply_status: confianza_excesiva, stacks: 2, target: player` | −1 |

> **Nota de implementación — La Contabilidad del Ogro:** El patrón "efecto diferido al próximo encuentro" requiere que RelicManager mantenga un flag `ogro_pending: bool` en su estado interno. En `on_encounter_start`: si `ogro_pending == true`, RelicManager ejecuta `deal_damage: 5` al enemigo y limpia el flag antes de que el turno comience. Este es el único efecto diferido en MVP. Si reliquias futuras requieren este patrón, generalizar a `pending_effects: Array` en RelicManager.

---

**6. Resolución de fin de turno**

El Card System fija el orden de resolución al final del turno: `cartas → reliquias → estados`. Las reliquias con trigger `on_turn_end` reciben `GameEvents.event_fired("on_turn_end", {})` en ese punto — después de que todas las cartas resolvieron sus efectos de fin de turno, y antes del decay de estados del Status Effect System.

---

### States and Transitions

```
[ INACTIVE ] (no adquirida — no forma parte de _active_relics)
     │
     │ add_relic()
     ▼
[ READY ] (charges_remaining > 0 o -1; esperando evento)
     │
     │ trigger coincide + trigger_filter pasa + condition cumplida
     ▼
[ TRIGGERING ] (transitorio — dura el frame de resolución de efectos)
     │
     │ efectos resueltos
     ├─── charges == -1 o charges_remaining > 0 → READY
     └─── charges_remaining == 0 → EXHAUSTED

[ EXHAUSTED ] (cargos agotados; la reliquia sigue visible pero no actúa)
     │
     │ charges_reset: "encounter" + evento on_encounter_start recibido
     └─── charges_remaining restaurado → READY
          (charges_reset: "never": permanece EXHAUSTED por el resto del run)

Al fin del run (on_run_end): RelicManager limpia _active_relics → todas a INACTIVE
```

**Invariante:** `TRIGGERING` es invisible fuera del frame de resolución. Nunca serializar este estado. La UI solo consulta `READY` vs `EXHAUSTED` para mostrar reliquias activas o agotadas.

---

### Interactions with Other Systems

| Sistema | Qué hace el Relic System | Interface |
|---|---|---|
| **GameEvents** (event bus) | Escucha todos los eventos del juego para trigger matching | `GameEvents.event_fired(event_name: String, payload: Dictionary)` — señal central |
| **DataLoader** | Lee `RelicData` de `res://data/relics/relics.json` al inicio del run | `DataLoader.get_relic(id) → RelicData` · `DataLoader.get_all_relics() → Array[RelicData]` |
| **EffectDispatcher** | Ejecuta los efectos atómicos de cada reliquia | `EffectDispatcher.dispatch(effect: EffectData, payload: Dictionary)` — compartido con Card System y Situation System |
| **StatusEffectSystem** | Las reliquias pueden aplicar estados via `apply_status` | `StatusEffectSystem.apply_status(target_id, status_id, stacks)` — llamado por EffectDispatcher |
| **Player Character System** | Las reliquias pueden restaurar HP via `restore_hp` | `PlayerCharacter.heal(amount)` — llamado por EffectDispatcher |
| **Card System** | Las reliquias pueden disparar `draw_cards`, `gain_mana`, `card_cost_modifier` | Llamados via EffectDispatcher |
| **Deck Building System** | Ofrece reliquias como opción 4 del reward screen | `RelicManager.get_available_relics(count: 2) → Array[RelicData]` · `RelicManager.add_relic(id)` |
| **Combat System** | La Contabilidad del Ogro necesita `deal_damage` al inicio del encuentro | `deal_damage: 5` via EffectDispatcher en `on_encounter_start` |
| **Scene Management** | RelicManager escucha fin de run para limpiar estado | Escucha `SceneManager.transition_completed(GameOver \| Victory)` → `RelicManager.on_run_end()` |

## Formulas

### Fórmula 1: Sello de Autenticidad Dudosa — Maná recuperado por carta costosa

`bonus_mana = SELLO_MANA_REWARD`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Maná recuperado por activación | `SELLO_MANA_REWARD` | int (tuning knob) | 1 | Fijo en 1. Disponible en el mismo turno. |

**Condición de trigger:** `mana_spent_on_card ≥ 3` en el evento `on_card_played`.

**Rango de salida:** 1 maná por activación. Puede activarse múltiples veces en el mismo turno si el jugador juega varias cartas de costo ≥ 3.

**Ejemplo:** El jugador tiene 8 de maná y juega dos cartas de costo 3. El Sello se activa dos veces → +2 maná ganados durante el turno, compensando parcialmente el gasto de 6.

**Valor esperado por encuentro:** 1–2 activaciones × 1 maná = 1–2 maná por encuentro.

---

### Fórmula 2: Diario del Mártir Entusiasta — HP recuperado por estados negativos

`hp_recovered = stack_delta × DIARIO_HP_PER_STACK`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Stacks negativos recibidos en el evento | `stack_delta` | int | 1–3 | Stacks de Vergüenza o Sospechoso aplicados al jugador en un solo evento `on_status_applied` |
| HP por stack | `DIARIO_HP_PER_STACK` | int (tuning knob) | 2 | HP restaurados por cada stack recibido |

**Rango de salida:** 2 (stack_delta=1) a 6 (stack_delta=3, cap de Vergüenza y Sospechoso). El HP no supera `HP_BASE = 60`.

**Nota:** La fórmula se aplica por evento, no por turno. Si dos aplicaciones de Vergüenza ocurren en el mismo turno (dos cartas enemigas distintas), cada evento activa el Diario por separado.

**Ejemplo:** Enemigo aplica 2 stacks de Vergüenza. `hp_recovered = 2 × 2 = 4 HP`. Si el jugador tiene 40 HP, recupera hasta 44 HP.

**Valor esperado por encuentro:** 2–3 aplicaciones de estado negativo × 1.5 stacks promedio × 2 HP = 6–9 HP por encuentro contra enemigos que aplican estados negativos. 0 HP contra enemigos sin estados negativos.

---

### Fórmula 3: Campana de la Vergüenza Productiva — Cartas robadas en tirada baja

`cards_drawn = CAMPANA_DRAW_COUNT`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Cartas a robar | `CAMPANA_DRAW_COUNT` | int (tuning knob) | 1 | Fijo en 1. Sigue las reglas del ciclo de mazo del Card System. |

**Condición de trigger:** `mana_rolled ≤ 4` en el evento `on_mana_rolled`. Probabilidad de activación: 6/36 ≈ 16.7% por turno.

**Rango de salida:** 0 (tirada > 4) o 1 carta extra.

**Ejemplo:** El jugador tira 3. La Campana activa → roba 1 carta extra. Si la tirada fue snake eyes (2), el Card System además aplica estado Vergüenza — ambos efectos son independientes. La Campana no conoce ni suprime la penalidad de Vergüenza.

**Valor esperado por encuentro:** ~1 activación por cada 6 turnos. En un encuentro de 4–5 turnos: 0.65–0.83 cartas extra esperadas.

---

### Fórmula 4: Contabilidad del Ogro — Daño al inicio del siguiente encuentro

`bonus_damage = OGRO_PENDING_DAMAGE`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Daño al inicio de encuentro | `OGRO_PENDING_DAMAGE` | int (tuning knob) | 5 | Daño fijo infligido al enemigo al inicio del primer turno del siguiente encuentro |

**Condición de trigger:** `outcome == "victory"` en `on_encounter_ended`. El daño se ejecuta en el `on_encounter_start` del siguiente encuentro si `ogro_pending == true`.

**Rango de salida:** 5 daño fijo. Aplica una vez por par de encuentros. Si el jugador muere, el flag se descarta.

**Ejemplo:** El jugador gana el encuentro 2 (La Bruja Indignada, HP=26). Ogro marca el flag. Inicio del encuentro 3 (El Ogro Diplomático, HP=40): recibe 5 de daño → empieza en 35 HP efectivos. Equivale a aproximadamente 1 turno de ventaja de DPT.

**Valor esperado en el run:** Si la reliquia se obtiene en encuentro 2 y el jugador gana todos los siguientes: 4 activaciones × 5 daño = 20 daño acumulado.

---

### Fórmula 5: Amuleto del Turno Fallido — Maná bonus por cartas no jugadas

`bonus_mana_next_turn = min(unplayed_cards × AMULETO_MANA_PER_CARD, AMULETO_MAX_BONUS)`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Cartas no jugadas al fin de turno | `unplayed_cards` | int | 0–4 | Cartas descartadas al fin de turno sin haber sido jugadas ese turno |
| Maná por carta no jugada | `AMULETO_MANA_PER_CARD` | int (tuning knob) | 1 | Maná bonus por cada carta descartada sin jugar |
| Maná bonus máximo | `AMULETO_MAX_BONUS` | int (tuning knob) | 3 | Cap del bonus acumulable por turno |

**Rango de salida:** 0 (todas las cartas jugadas) a 3 (3 o más cartas sin jugar, cap activo). El bonus se almacena como `amuleto_pending_mana` en RelicManager y se entrega como `gain_mana` al inicio del siguiente turno (`on_turn_start`), antes del robo de mano.

**Tabla de situaciones:**

| Cartas jugadas | Cartas descartadas | `bonus_mana_next_turn` |
|---|---|---|
| 4 | 0 | 0 |
| 3 | 1 | 1 |
| 2 | 2 | 2 |
| 1 | 3 | 3 (cap) |
| 0 | 4 | 3 (cap) |

**Ejemplo:** El jugador tiene 7 de maná. Juega 1 carta de costo 3 y descarta 3 (injugables o elegidas). Amuleto: `min(3×1, 3) = 3` maná bonus al próximo turno. El siguiente turno empieza con tirada 2d6 + 3 maná garantizados.

**Nota de balance:** El cap de 3 previene que "no jugar ninguna carta para obtener +3 mana" sea la estrategia dominante. El costo del turno sacrificado (daño no hecho, escudo no construido) equilibra el bonus.

---

### Fórmula 6: Formulario de Exención de Daño (Denegado) — Confianza Excesiva por golpe duro

`stacks_applied = FORMULARIO_STACKS`

**Variables:**

| Variable | Símbolo | Tipo | Rango | Descripción |
|---|---|---|---|---|
| Stacks de Confianza Excesiva aplicados | `FORMULARIO_STACKS` | int (tuning knob) | 2 | Stacks aplicados al jugador cuando el trigger se cumple |
| Umbral de daño recibido | `FORMULARIO_DAMAGE_THRESHOLD` | int (tuning knob) | 8 | Daño mínimo al HP del jugador (post-escudo de maná) para activar la reliquia |

**Condición de trigger:** `damage_received ≥ FORMULARIO_DAMAGE_THRESHOLD` en `on_damage_received`. El payload `damage_received` es el daño que llegó al HP (no el daño bruto del enemigo — el maná ya fue aplicado como escudo).

**Rango de salida:** 0 stacks (golpe absorbido por maná o daño < 8) o 2 stacks de Confianza Excesiva. El stacking respeta el cap de 4: si el jugador ya tiene 3 stacks, solo se agregan 1.

**Ejemplo:** El jugador tiene 2 de maná. El enemigo inflige 10. `daño_a_hp = 10 − 2 = 8`. Umbral exacto. Formulario activa → 2 stacks de Confianza Excesiva. Próximo turno: +2 daño por instancia de carta, pero el maná se vacía al final de la fase de acción (efecto binario de Confianza Excesiva).

**Nota de diseño:** El umbral evalúa el daño al HP, no el daño bruto. Un ataque de 10 absorbido por 6 de maná (4 HP netos) no activa el Formulario. Esto incentiva al jugador a gestionar su maná estratégicamente — quien conserva escudo no sufre el trigger, pero tampoco recibe el upside ofensivo.

## Edge Cases

- **Si una reliquia con `trigger: "on_status_applied"` tiene como efecto `apply_status` (loop potencial):** RelicManager mantiene un flag `_processing_event: bool`. Mientras una reliquia está en estado `TRIGGERING`, los eventos disparados por sus efectos se encolan en `_pending_events`. Al finalizar el procesamiento del evento actual, `_pending_events` se procesa exactamente una vez más (profundidad máxima 1). Los eventos de esa segunda pasada no pueden encolar más eventos. Un loop directo (reliquia A → aplica estado → reliquia A vuelve a activarse) nunca ocurre.

- **Si el jugador adquiere una reliquia con `trigger: "on_run_start"` en medio del run (post-encuentro):** `RelicManager.add_relic()` detecta que `trigger == "on_run_start"` y dispara el efecto inmediatamente al momento de adquisición. El efecto no se pierde ni se difiere al próximo run.

- **Si `on_status_applied` se evalúa antes de que el stack count sea readable:** El Status Effect System emite el evento `on_status_applied` (via GameEvents) *después* de haber actualizado el stack count en su estado interno. Invariante: cualquier condición que consulte `get_stack_count()` en el handler de `on_status_applied` obtendrá el valor ya actualizado. Este contrato debe documentarse también en el Status Effect System GDD.

- **Si la Contabilidad del Ogro está en `ogro_pending = true` y el jugador muere antes del siguiente encuentro:** El flag se descarta junto con el estado del run en `RelicManager.on_run_end()`. El daño diferido no persiste entre runs ni aparece en pantallas de game over.

- **Si el Amuleto del Turno Fallido acumula `amuleto_pending_mana` y el jugador entra a un nuevo encuentro sin haberlo gastado:** El bonus persiste hasta el primer `on_turn_start` del encuentro siguiente — se entrega como maná al inicio del primer turno del nuevo encuentro. No se descarta al cambiar de encuentro. La reliquia no distingue entre turnos del mismo encuentro y del siguiente.

- **Si el Formulario de Exención se activa cuando el jugador ya tiene el cap de Confianza Excesiva (4 stacks):** Se intenta aplicar 2 stacks. El Status Effect System resuelve `min(4+2, 4) = 4` — ningún stack nuevo se agrega. La señal `negative_status_applied_to_player` no se emite (stack delta efectivo = 0). El silencio es el comportamiento correcto; no hay error.

- **Si dos reliquias tienen efectos contradictorios en el mismo evento (una aplica Vergüenza, otra elimina Vergüenza, ambas con `on_damage_received`):** Se procesan en orden de adquisición. La primera aplica Vergüenza → el Status Effect System emite `negative_status_applied_to_player` → Idea Brillante puede acumularse. Luego la segunda elimina Vergüenza. Estado neto: sin Vergüenza, pero Idea Brillante ya se acumuló. Este es el comportamiento correcto: los efectos son secuenciales y cada uno resuelve completamente antes del siguiente.

- **Si `on_card_discarded_unused` dispara por cada carta individualmente y el jugador descarta 4 (turno con 0 jugadas):** El Amuleto recibe 4 eventos separados. RelicManager acumula `amuleto_pending_mana += 1` por cada evento, aplicando el cap en cada acumulación: `amuleto_pending_mana = min(amuleto_pending_mana + 1, AMULETO_MAX_BONUS)`. Resultado: 3 (capado), no 4. El cap se evalúa por evento, no al final del turno.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| **Card System** | Este sistema depende (upstream) | El Relic System hooks al Card System via GameEvents: escucha `on_card_played`, `on_mana_rolled`, `on_hand_drawn`, `on_card_discarded_unused`, `on_turn_start`, `on_turn_end`. Los efectos de reliquia pueden disparar `draw_cards`, `gain_mana`, y `card_cost_modifier` — ejecutados por EffectDispatcher. |
| **Status Effect System** | Este sistema depende (upstream) | Las reliquias pueden aplicar/remover estados via `apply_status()` y `remove_status()`. El Relic System escucha `on_status_applied` via GameEvents. Invariante de ordenamiento: el Status Effect System emite el evento DESPUÉS de actualizar el stack count — las condiciones que consulten `get_stack_count()` en el handler ven el valor ya actualizado. |
| **Data Configuration System** | Este sistema depende (datos) | Lee `RelicData` de `res://data/relics/relics.json` al inicio del run. ⚠️ **Retrofit pendiente:** agregar `trigger_filter` y `charges_reset` al schema `RelicData` en §2; agregar los 5 triggers nuevos al vocabulario en §3. |
| **GameEvents** (event bus) | Este sistema depende (infraestructura) | RelicManager escucha `GameEvents.event_fired(event_name, payload)` como punto único de entrada de todos los triggers. GameEvents es un Autoload nuevo que debe definirse como ADR de arquitectura. |
| **EffectDispatcher** | Este sistema depende (infraestructura compartida) | RelicManager delega la ejecución de efectos atómicos a EffectDispatcher — el mismo dispatcher compartido con Situation System y Card System. La propiedad de EffectDispatcher debe definirse en arquitectura, no en este GDD. |
| **Player Character System** | Depende de este | Puede recibir `heal()` calls via efectos de reliquias (El Diario del Mártir Entusiasta). Ningún cambio de interfaz requerido — la API de curación ya existe en el Player Character System. |
| **Combat System** | Depende de este (lectura) | La Contabilidad del Ogro dispara `deal_damage: 5` al inicio de encuentro via EffectDispatcher. El Combat System debe poder recibir daño al enemigo en `on_encounter_start`, antes del primer turno. Confirmar con el Combat System GDD al diseñarlo. |
| **Deck Building System** | Depende de este | Ofrece reliquias como opción 4 del reward screen. Llama `RelicManager.get_available_relics(count: 2) → Array[RelicData]` y `RelicManager.add_relic(id)`. El pool de reliquias disponibles (no adquiridas aún) es responsabilidad del RelicManager. |
| **Scene Management System** | Evento | RelicManager escucha `SceneManager.transition_completed` para detectar fin de run (transición a GameOver o Victory) y limpiar `_active_relics` via `on_run_end()`. |

**Bidireccionalidad pendiente:** El Card System GDD (§Dependencies) y el Status Effect System GDD (§Dependencies) deben agregar al Relic System en sus listas de dependientes. Resoluble con la próxima pasada de `/consistency-check`.

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `SELLO_MANA_REWARD` | 1 | 1–3 | Más maná por carta costosa → cadenas de juego más largas y explosivas | 0 = reliquia inútil |
| `DIARIO_HP_PER_STACK` | 2 | 1–4 | Más HP por estado negativo → jugador busca activamente estados negativos | 1 = recuperación negligible, sin cambio de comportamiento |
| `CAMPANA_DRAW_COUNT` | 1 | 1–2 | 2 cartas = ventaja de mano significativa en tiradas bajas; puede romper balance de turnos malos | 0 = reliquia inútil |
| `OGRO_PENDING_DAMAGE` | 5 | 3–8 | Más daño por encuentro → ventaja ofensiva creciente, puede trivializar encuentros fáciles | < 3 = ventaja irrelevante vs. el HP de cualquier enemigo |
| `AMULETO_MANA_PER_CARD` | 1 | 1–2 | 2 = bonus muy alto por turno de setup; puede crear estrategia dominante de "no jugar nada" | No reducir por debajo de 1 — el bonus mínimo debe ser significativo para cambiar el comportamiento |
| `AMULETO_MAX_BONUS` | 3 | 2–4 | 4 = cap más difícil de alcanzar, más expresividad en el rango de elección | 2 = cap con solo 2 cartas sin jugar; menos expresivo |
| `FORMULARIO_STACKS` | 2 | 1–3 | 3 stacks = +3 daño por instancia inmediatamente después del hit más duro; muy fuerte | 1 stack = upside demasiado pequeño para compensar el trigger |
| `FORMULARIO_DAMAGE_THRESHOLD` | 8 | 6–10 | Umbral más alto = activa raramente; solo los peores golpes | Umbral más bajo = más consistente pero pierde el sabor de "reacción ante el peor caso" |
| Pool de reliquias ofrecidas | 2 opciones | 2–3 | 3 = más agency; mayor carga cognitiva post-encuentro | 1 = sin elección real |
| Peso de rarity en pool | No implementado en MVP | — | Reliquias raras más probables en actos avanzados | Flat = todas las reliquias con la misma probabilidad |

**Interacciones entre knobs a monitorear:**
- `AMULETO_MANA_PER_CARD` × `AMULETO_MAX_BONUS`: si ambos se aumentan en paralelo, el jugador alcanza el cap con pocas cartas sin jugar — la fórmula pierde rango expresivo.
- `FORMULARIO_DAMAGE_THRESHOLD` × `FORMULARIO_STACKS`: umbral bajo + stacks altos = fuente casi constante de Confianza Excesiva; puede hacer que el jugador abandone deliberadamente la gestión del escudo de maná.

## Visual/Audio Requirements

*Principio rector: las reliquias son objetos físicos encontrados, no cartas escritas. Todo el lenguaje visual refleja "objeto en un diario de aventuras" — madera, cuero, trazo de tinta. Art bible §3.1, §3.4, §4, §7.3, §7.4, §8.3.*

### Activación de reliquia (HUD tray)

| Evento | Visual | Color semántico (§4) | Audio | Prioridad |
|---|---|---|---|---|
| Reliquia activa — efecto inmediato | Ícono: Scale `1.0→1.35→1.0` Snap 0.12s. Fondo del slot: Directo flash al color semántico y de vuelta. Hold 1 frame (0.05s) al pico — beat de freeze on impact (§5.4). | `gain_mana`/`restore_hp`/`draw_cards`: Dorado Caos `#F2B71F`. `deal_damage`: Rojo Urgente `#D93A3A`. `apply_status` a enemigo: Azul Gravedad `#3A6BBF`. `apply_status` al jugador (doble-filo): Verde Absurdo `#5CBF3A`. | SFX corto (< 1s WAV), sonido de objeto físico brevemente agitado. La Campana usa golpe de campana pequeña. `sfx_relic_[relic_id]_activate.wav` | HIGH |
| Reliquia con efecto diferido — Amuleto | Flash Directo en el slot (sin scale punch). La reliquia registra una promesa, no entrega. | Dorado Caos `#F2B71F` | Sin audio propio — el `gain_mana` al turno siguiente usa el audio del Card System | MEDIUM |
| Efecto `gain_mana` / `draw_cards` en campo | Burst de 3–4 trazos de boceto irradiando desde la banda de Impulso o la carta robada. 3 frames, 0.18s total. Desaparecen Directo. Assets: `vfx_relic_impulso_burst_[01-03].png` | Dorado Caos | Sin audio adicional — el Card System ya cubre el sonido de ganancia de maná/robo | HIGH |
| Efecto `restore_hp` en campo | Float `+N` en Dorado Caos sobre la barra de HP. Scale `0→1.2→1.0` en 0.1s, luego sube y se desvanece. Mismo sistema que números de daño (§7.4), color diferente. | Dorado Caos | Sin audio adicional | HIGH |
| Efecto `deal_damage` en campo — Ogro | Número Rojo Urgente sobre el enemigo, tratamiento idéntico a daño de carta (§7.4). Sin VFX adicional. | Rojo Urgente | Hit de impacto — categoría "golpe al inicio de turno", distinto del hit de carta | HIGH |
| Efecto `apply_status` en campo | Sin VFX de la reliquia — el Status Effect System es dueño del visual del estado aplicado | — | Sin audio adicional | — |

### Reward screen — carta de reliquia

Las cartas de reliquia en el reward screen son **placas de madera**, no cartas de Pergamino — distinción de material inmediata.

- **Material base:** Madera Clara `Color(0.72, 0.50, 0.28)` con frame en Tinta — placa tallada. Sin riesgo de confusión con cartas de juego.
- **Zona de arte (55% superior):** sprite de reliquia (64×64px source, 80×80px en pantalla) sobre panel interior de Pergamino con borde irregular — objeto presionado en el diario.
- **Nombre (banda central):** MedievalSharp 18px, Tinta sobre Madera. Banner irregular — etiqueta grabada en madera. Máximo 4 palabras.
- **Flavor text (30% inferior):** Almendra Regular 12px, Tinta sobre strip de Pergamino. 1 línea. Solo texto de sabor — el efecto mecánico se lee en tooltip Papel Rasgado (§3.4) activado por click.
- **Sin indicador de costo:** la ausencia del círculo de Impulso distingue visualmente que no es una carta.
- **Hover:** placa gira 3°, PointLight2D energy `0.9→1.4` en 0.15s Snap (§7.7).
- **Selección:** Thud `scale.y 1.0→0.92→1.0` (0.05s in, 0.15s out), luego la placa sale de pantalla. La reliquia no elegida: alpha → 0.4 Directo + stroke horizontal de Tinta sobre la placa (tachada en el diario — distinto del ✗ de cartas injugables).

### Relic HUD tray

- **Posición:** franja inferior, a la derecha de la mano de cartas. El eje HP → Impulso → mano permanece intacto.
- **Material:** strap de cuero — mismo material que la banda de Impulso. Anchored al lenguaje físico de la franja inferior.
- **Íconos:** 32×32px. Espaciado: 4px entre slots. Máximo 6 slots en MVP (coincide con pool de 6 reliquias). Sin overflow en MVP.
- **Estado READY:** ícono a opacidad completa, Tinta sobre Pergamino. Fondo del slot: Madera Clara.
- **Estado EXHAUSTED:** alpha 0.35 + stroke horizontal de Tinta sobre el ícono (overlay compartido `ui_icon_relic_exhausted_overlay.png`). Dos señales simultáneas: luminosidad + forma (§4 Regla de daltonismo).
- **Transición EXHAUSTED → READY** (charges_reset: "encounter"): stroke desaparece Directo + alpha restaura a 1.0 Snap 0.12s.

### Asset naming

| Asset | Nombre |
|---|---|
| Ícono de reliquia | `ui_icon_relic_[relic_id]_default.png` (64×64px source art) |
| Overlay de EXHAUSTED | `ui_icon_relic_exhausted_overlay.png` (asset compartido) |
| Reward card backing | `ui_card_relic_backing_default.png` / `_hover.png` |
| Burst VFX de activación | `vfx_relic_impulso_burst_01.png` – `_03.png` |
| SFX de activación por reliquia | `sfx_relic_[relic_id]_activate.wav` |

> 📌 **Asset Spec** — Visual/Audio requirements definidos. Después de que el art bible esté aprobado, ejecutar `/asset-spec system:relic-system` para producir specs visuales por asset, dimensiones y prompts de generación.

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| Relic HUD tray | Strap de cuero en la franja inferior, a la derecha de la mano de cartas. Máximo 6 slots de 32×32px con espaciado de 4px. Aparece al adquirir la primera reliquia — no se muestra vacío. | Art bible §7.5 (layout franja inferior) + §7.3 (íconos) |
| Estado visual READY / EXHAUSTED | Opacidad completa (READY) vs. alpha 0.35 + stroke horizontal overlay (EXHAUSTED). Tooltip con nombre + efecto en Papel Rasgado activado por hover/click durante el combate. | Art bible §7.4 (Directo) + §4 (Regla de daltonismo) |
| Reward screen — carta de reliquia | Placa de Madera Clara 144×108px con panel de arte Pergamino, nombre MedievalSharp 18px, flavor text Caption 12px. Sin círculo de costo de Impulso. Tooltip mecánico activado por click/tap. | Art bible §7.7 (reward screen cards) + §3.4 (tooltip Papel Rasgado) |
| Tooltip mecánico de reliquia | Papel Rasgado (§3.4) rotado +4°. Contenido: nombre (H3), efecto en lenguaje claro (Body 14px). Disponible en reward screen Y durante combate al inspeccionar el tray. | Art bible §3.4 |
| Número flotante de curación (+N) | Reutiliza el componente de números flotantes del Card System (§7.4). Color: Dorado Caos `#F2B71F`. Sin sistema nuevo. | Card System GDD §Visual/Audio |

> **📌 UX Flag — Relic System:** Este sistema tiene UI requirements en el HUD del encuentro (relic tray) y en el reward screen. En Phase 4 (Pre-Production), ejecutar `/ux-design encounter-screen` y `/ux-design reward-screen` para definir los layouts exactos antes de escribir epics. Las historias que referencien UI de reliquias deben citar `design/ux/encounter-screen.md` y `design/ux/reward-screen.md`.

## Acceptance Criteria

Tests unitarios en `tests/unit/relic-system/` (BLOCKING — Logic). Tests de integración en `tests/integration/relic-system/` (BLOCKING) para los ACs marcados con `[INTEGRACIÓN]`.

**AC-01 (Trigger + trigger_filter):** DADO una reliquia con `trigger: "on_card_played"` y `trigger_filter: "amount_gte:3"`, CUANDO el jugador juega una carta gastando 3 o más maná, ENTONCES el efecto de la reliquia dispara. CUANDO juega una carta gastando 1 o 2 maná, ENTONCES el efecto NO dispara.

**AC-02 (Orden de adquisición):** DADO dos reliquias con el mismo trigger, adquiridas en ese orden, CUANDO el trigger dispara, ENTONCES la primera adquirida procesa completamente antes de que la segunda inicie.

**AC-03 (Re-entrancy guard):** DADO reliquia A (`trigger: "on_status_applied"`, effect: `apply_status: sospechoso stacks:1`) y reliquia B (`trigger: "on_status_applied"`, effect: `gain_mana: 1`), CUANDO reliquia A dispara y aplica Sospechoso, ENTONCES el evento `on_status_applied` generado por ese efecto se encola y procesa reliquia B exactamente una vez al finalizar A. El evento generado por B (si lo hubiera) NO se encola — profundidad máxima 1. Resultado: jugador ganó 1 maná, tiene Sospechoso activo, sin loop. `[INTEGRACIÓN]`

**AC-04 (Sello — fórmula):** DADO `sello_autenticidad` equipado, CUANDO el jugador juega una carta que costó exactamente 3 maná, ENTONCES gana exactamente 1 maná disponible en el mismo turno. CUANDO juega dos cartas de costo 3 en el mismo turno, ENTONCES gana 2 maná en total (una activación por carta).

**AC-05 (Diario — fórmula, cap HP y señal suprimida):** DADO `diario_martir` equipado y jugador con 50 HP, CUANDO el enemigo aplica 2 stacks de Vergüenza, ENTONCES el jugador recupera 4 HP (`2 × 2`). DADO jugador con 58 HP (`HP_BASE = 60`, del Player Character System GDD §Core Rules), CUANDO aplica 2 stacks, ENTONCES el jugador recupera 2 HP — capeado en 60. DADO Vergüenza ya en su cap (3 stacks) y enemigo intenta aplicar 2 más (stack_delta efectivo = 0), ENTONCES el Diario NO dispara — ninguna curación ocurre. `[INTEGRACIÓN]`

**AC-06 (Campana — fórmula y boundary):** DADO `campana_vergüenza` equipado, CUANDO la tirada 2d6 resulta exactamente 4, ENTONCES el jugador roba 1 carta extra inmediatamente. CUANDO la tirada resulta 5, ENTONCES no roba. CUANDO la tirada resulta 2 (snake eyes), ENTONCES el Card System aplica estado Vergüenza Y la Campana roba 1 carta — efectos independientes que coexisten.

**AC-07 (Contabilidad del Ogro — fórmula, cleanup y run end):** DADO `contabilidad_ogro` equipado, CUANDO el jugador gana el encuentro N, ENTONCES al inicio del encuentro N+1 el enemigo recibe 5 de daño antes de que el primer turno comience, y `ogro_pending` se limpia a false en ese mismo momento. DADO `ogro_pending = true` y el run termina (`RelicManager.on_run_end()` llamado), ENTONCES `ogro_pending` se resetea a false y al iniciar un nuevo run no se aplica daño en el primer `on_encounter_start`. `[INTEGRACIÓN]`

**AC-08 (Amuleto — fórmula, cap per-event y cross-encounter):** DADO `amuleto_fallido` equipado, CUANDO `on_card_discarded_unused` dispara 4 veces en el mismo turno (una por carta), ENTONCES `amuleto_pending_mana` se incrementa en 1 por evento y está capeado en 3 al tercer evento — el cuarto evento no eleva el total. El cap se evalúa por evento, no al final del turno. CUANDO el jugador juega las 4 cartas (0 descartadas sin jugar), ENTONCES `amuleto_pending_mana = 0`. DADO `amuleto_pending_mana = 2` al finalizar el encuentro, CUANDO comienza el siguiente y luego el primer turno, ENTONCES el jugador recibe 2 maná bonus en `on_turn_start` — el bonus no se pierde en la transición. `[INTEGRACIÓN]`

**AC-09 (Formulario — fórmula, threshold, mana shield y cap de Confianza):** DADO `formulario_exencion` equipado, CUANDO el jugador recibe exactamente 8 HP de daño (post-escudo de maná), ENTONCES se aplican 2 stacks de Confianza Excesiva. CUANDO recibe 7 HP de daño, ENTONCES no se aplica ningún stack. DADO jugador con 3 stacks de Confianza Excesiva ya activos (cap=4), CUANDO Formulario dispara, ENTONCES el sistema resuelve `min(3+2, 4) = 4` stacks — sin error ni overflow. DADO jugador con 2 maná y enemigo inflige 10, CUANDO el combate resuelve, ENTONCES `damage_received = 8` y el Formulario dispara. DADO jugador con 6 maná y enemigo inflige 10, ENTONCES `damage_received = 4` y el Formulario NO dispara. `[INTEGRACIÓN]`

**AC-10 (Charges y charges_reset):** DADO una reliquia con `charges: 1`, CUANDO el trigger dispara una vez, ENTONCES la reliquia pasa a estado `EXHAUSTED` y no vuelve a disparar aunque el trigger se repita. DADO `charges_reset: "encounter"`, CUANDO el siguiente encuentro comienza, ENTONCES `charges_remaining` se restaura y la reliquia vuelve a estado `READY`.

**AC-11 (on_run_start mid-run):** DADO una reliquia con `trigger: "on_run_start"` adquirida en encuentro 3 (reward screen post-encuentro), CUANDO `RelicManager.add_relic(id)` se llama, ENTONCES el efecto dispara inmediatamente en ese momento. No se difiere al próximo run.

**AC-12 (Cleanup al fin de run):** DADO jugador con 3 reliquias activas, CUANDO `RelicManager.on_run_end()` se llama, ENTONCES `_active_relics` se vacía y todos los flags internos (incluyendo `ogro_pending` y `amuleto_pending_mana`) se resetean. Al iniciar un nuevo run, el jugador comienza con 0 reliquias.

**AC-13 (Pool de adquisición — sin duplicados):** DADO un pool de 6 reliquias y el jugador sosteniendo 2, CUANDO `RelicManager.get_available_relics(2)` se llama, ENTONCES retorna exactamente 2 reliquias del pool de no-adquiridas y ninguna es una ya sostenida. DADO todas las reliquias ya adquiridas, CUANDO se llama, ENTONCES retorna un array vacío sin error.

**AC-14 (Orden fin-de-turno — reliquias antes de decay de estados):** DADO una reliquia con `trigger: "on_turn_end"` que aplica 1 stack de Vergüenza al jugador, CUANDO el turno termina, ENTONCES la reliquia dispara ANTES de que `StatusEffectSystem.tick_end_of_turn()` se llame — el jugador llega al inicio del próximo turno con 1 stack de Vergüenza activo (no 0). `[INTEGRACIÓN]`

**AC-15 (Ogro — victoria consecutiva no pierde ni duplica):** DADO `contabilidad_ogro` con `ogro_pending = true`, CUANDO `on_encounter_start` dispara (daño aplicado y flag limpiado) y luego el jugador gana ese encuentro (`on_encounter_ended` victory), ENTONCES `ogro_pending` se vuelve a establecer en true. CUANDO el siguiente `on_encounter_start` dispara, ENTONCES el daño se aplica nuevamente. Cada victoria produce exactamente un daño diferido — sin pérdida ni duplicación.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿El `GameEvents` event bus es un Autoload nuevo, o se expande el SceneManager? | Pendiente — arquitectura | RelicManager lo necesita, pero la propiedad del bus debe resolverse en una ADR antes de implementación. Múltiples sistemas (Relics, Situations, Cards) pueden necesitar el mismo bus. Resolver en `/create-architecture`. |
| ¿El EffectDispatcher es una clase standalone o un método de un Autoload existente? | Pendiente — arquitectura | Data Config GDD §4 define el vocabulario de efectos. Quién los ejecuta en runtime es una decisión de arquitectura — no de este GDD. Resolver en ADR. |
| ¿`ogro_pending` se aplica al boss si el jugador gana el encuentro previo? | Resuelto en §Detailed Design | El boss es un encuentro más — `on_encounter_start` del boss recibe los 5 de daño normalmente. El Inquisidor empieza efectivamente en 55 HP. Confirmar en el Combat System GDD. |
| ¿Las reliquias ofrecidas se repiten si el jugador ya adquirió todas? | Resuelto en AC-13 | `get_available_relics()` retorna array vacío. La opción 4 del reward screen no debe mostrarse si está vacío. Confirmar con Deck Building System GDD. |
| ¿Confianza Excesiva aplicada por el Formulario alimenta Idea Brillante? | Resuelto | Confianza Excesiva no es estado negativo — no emite `negative_status_applied_to_player`. El Formulario no alimenta IB. Consistente con Status Effect System GDD. |
| ¿El Diario cura si el estado negativo se aplica pero el cap ya estaba lleno (stack_delta efectivo = 0)? | Pendiente — contrato de payload | Si RelicManager escucha `on_status_applied` via GameEvents en vez de la señal del SES, puede recibir eventos con stack_delta=0. Confirmar que el payload de GameEvents incluya `stack_delta` post-cap antes de implementar el Diario. |
| ¿Los relics se muestran en el reward screen aunque el jugador no elija "ganar reliquia"? | Diferido a Deck Building GDD | El reward screen es responsabilidad del Deck Building System. RelicManager solo provee `get_available_relics()` — no tiene opinión sobre la UI del reward screen. |
