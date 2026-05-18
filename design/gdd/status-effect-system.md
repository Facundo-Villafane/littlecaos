---
sidebar_position: 6
title: Sistema de Estados Alterados
description: Los cuatro estados temáticos del juego (Vergüenza, Confianza Excesiva, Sospechoso, Inspirado) — sus mecánicas, duración, stacks y resolución.
---

# Status Effect System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-17
> **Last Verified**: 2026-05-17
> **Implements Pillar**: Caos Ordenado · Situaciones como Escenario Narrativo · Caos como Oportunidad

## Summary

El Status Effect System define los cuatro estados alterados del juego — Vergüenza, Confianza Excesiva, Sospechoso, Inspirado — y las reglas que gobiernan cómo se acumulan, resuelven, y afectan a jugador y enemigos. Son la gramática emocional del juego: dan nombre al caos en lugar de solo cuantificarlo.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Card System`

## Overview

El Status Effect System gestiona cuatro estados con personalidad temática que pueden afectar tanto al jugador como a los enemigos. Cada estado tiene un nombre que comunica una situación social o emocional absurda antes que una estadística de combate: Vergüenza no dice "–1 al ataque", dice que el personaje está avergonzado y eso tiene consecuencias mecánicas coherentes con esa condición. Los estados se acumulan en stacks, cada uno con una duración definida, y se resuelven (reducen o eliminan) al final del turno o mediante efectos de carta.

El sistema es la capa de contexto que hace que dos encuentros con el mismo enemigo se sientan distintos: un Guardia Tímido con 3 stacks de Vergüenza se comporta diferente a uno con Confianza Excesiva, incluso con el mismo HP y las mismas intenciones base.

## Player Fantasy

Los estados no son buffs ni debuffs: son situaciones. Cuando un enemigo aplica Vergüenza al jugador, no le quita vida — le quita la posibilidad de hacer la jugada obvia. Entonces el jugador improvisa, acumula Idea Brillante, y gana el combate que técnicamente ya estaba perdiendo. El fantasy no es "soy fuerte a pesar del caos" — es "soy fuerte **gracias** al caos". Cada estado negativo que el jugador acepta es combustible para una improvisación más absurda; los enemigos lo alimentan sin querer.

Lo mismo vale al revés: un enemigo con Confianza Excesiva se cree invencible justo cuando el jugador tiene la jugada que lo hace papelón. Los estados son el idioma emocional del encuentro — quien los lee y los aprovecha gana, sin importar los números.

Si el sistema falla en entregar esto, los estados se vuelven texto flotante sobre los sprites. Vergüenza deja de ser una escena y se convierte en un modificador de porcentaje sin historia.

## Detailed Design

### Core Rules

**1. Reglas generales del sistema**

**Stacking aditivo:** Cuando `apply_status(target_id, status_id, stacks)` se llama sobre un estado ya activo, los stacks se suman al contador actual y se clampean al `stack_cap`:
`new_stack_count = min(current_stacks + incoming_stacks, stack_cap)`
El exceso se descarta silenciosamente.

**Escalado por stacks:** El efecto de un estado es proporcional a sus stacks actuales. Excepciones: Confianza Excesiva (mana shield = 0 es binario — ocurre con ≥ 1 stack) y Sospechoso (bloqueo es binario — ocurre con ≥ 1 stack).

**Decay:** Al final del turno de la entidad portadora, cada estado reduce en 1 stack:
`stacks_post_decay = max(0, current_stacks - 1)`
Los estados del jugador decaen en el paso 8 del turno del jugador (tras efectos de cartas → reliquias → estados). Los estados del enemigo decaen al final del turno del enemigo.

**Resolución en 0:** Cuando los stacks llegan a 0, el estado se desactiva inmediatamente. Sus efectos cesan en el mismo frame. La instancia permanece con `stacks = 0` y `active = false`, lista para ser reaplicada.

**Duración MVP:** Todos los estados tienen duración "por encuentro". Al finalizar el encuentro se limpian de todas las entidades.

**Múltiples aplicaciones por turno:** El mismo estado puede aplicarse múltiples veces en un turno. Cada llamada suma stacks aditivamente hasta el cap. Sin ventana de inmunidad.

---

**2. Los cuatro estados**

---

**VERGÜENZA** (`vergüenza`)

*El personaje está flustered, se equivoca en lo que debería ser fácil. La vergüenza tiene un costo.*

| Atributo | Valor |
|---|---|
| **Efecto** | +1 al `costo_efectivo` de TODAS las cartas en mano, por stack |
| **Stack cap** | 3 |
| **Canal** | `get_card_cost_modifiers()` devuelve `[+stacks]` para cualquier tipo de carta |
| **Para enemigos** | `get_damage_modifier(entity_id)` devuelve `-(stacks)` — el enemigo inflige menos daño |
| **Es negativo (Idea Brillante)** | SÍ |
| **Aplicado a** | Jugador y enemigos |

*Ejemplo:* Jugador con 3 stacks de Vergüenza tiene una carta `costo_base=1`. `costo_efectivo = max(0, 1+3) = 4`.

---

**CONFIANZA EXCESIVA** (`confianza_excesiva`)

*El personaje se cree invencible y ataca sin considerar las consecuencias.*

| Atributo | Valor |
|---|---|
| **Efecto ofensivo** | +1 daño por efecto de carta de daño, por stack. Aplica a cada instancia de daño individualmente. |
| **Efecto defensivo (binario)** | Con ≥ 1 stack, al final de la fase de acción del jugador (antes del ataque enemigo), `mana_current` se fuerza a 0. El escudo de maná no funciona ese turno. |
| **Stack cap** | 4 |
| **Para enemigos** | Solo aplica el efecto ofensivo (+1 daño por stack). Los enemigos no tienen escudo de maná. |
| **Es negativo (Idea Brillante)** | NO (tiene upside ofensivo deliberado) |
| **Aplicado a** | Jugador y enemigos |

*Ejemplo:* Jugador con 2 stacks juega carta que hace 4 de daño → 6 de daño. Pero al final de su fase de acción, su maná queda en 0.

---

**SOSPECHOSO** (`sospechoso`)

*Alguien está observando. Un ataque directo bajo tanta vigilancia es impensable.*

| Atributo | Valor |
|---|---|
| **Efecto (binario)** | Con ≥ 1 stack, todas las cartas con tag `[direct_attack]` son injugables (grisadas). |
| **No escala con stacks** | El bloqueo es igual con 1 o 3 stacks. Los stacks controlan la **duración**: 3 stacks = bloqueo dura 3 turnos de decay natural. |
| **Stack cap** | 3 |
| **Para enemigos** | El Enemy System verifica `get_stack_count() > 0` antes de seleccionar intención con `[direct_attack]`. Si todas sus intenciones son `[direct_attack]`, el enemigo pasa su turno (daño 0). |
| **Es negativo (Idea Brillante)** | SÍ |
| **Aplicado a** | Jugador y enemigos |

> **⚠️ Retrofit pendiente al Data Config GDD:** Agregar el tag `direct_attack` al vocabulario de tags de cartas en `registries.json`.

---

**INSPIRADO** (`inspirado`)

*Un momento de claridad. Todo fluye.*

| Atributo | Valor |
|---|---|
| **Efecto de costo** | -1 al `costo_efectivo` de TODAS las cartas en mano, por stack. El `max(0,…)` previene costos negativos. |
| **Efecto de robo** | Al inicio del robo de mano: +1 carta extra a 2 stacks, +2 cartas extra a 4 stacks. Sin bonus a 1 o 3 stacks. |
| **Stack cap** | 4 |
| **Para enemigos** | Solo el efecto de costo (reducción de costo en acciones). Sin bonus de robo. |
| **Es negativo (Idea Brillante)** | NO |
| **Aplicado a** | Jugador (principalmente) |

| Stacks de Inspirado | Cartas extra al robar |
|---|---|
| 1 | 0 |
| 2 | +1 |
| 3 | +1 |
| 4 | +2 |

---

**3. Tabla resumen**

| Estado | Efecto principal | Escala | Cap | Negativo |
|---|---|---|---|---|
| Vergüenza | +1 costo de carta por stack | Lineal | 3 | SÍ |
| Confianza Excesiva | +1 daño/stack; escudo=0 (binario ≥1 stack) | Parcial | 4 | NO |
| Sospechoso | Bloqueo `[direct_attack]` (binario ≥1 stack) | Duración | 3 | SÍ |
| Inspirado | -1 costo/stack; cartas extra en umbrales 2/4 | Lineal + umbrales | 4 | NO |

---

### States and Transitions

**Ciclo de vida de una StatusInstance:**

```
[ Inactive ] (stacks=0, active=false)
     │
     │ apply_status(stacks > 0)
     ▼
[ Active ] (stacks=1 a stack_cap, active=true)
     │◄─── apply_status(stacks adicionales, hasta cap)
     │
     │ end of entity turn → decay: stacks-1
     │   stacks > 0: permanece Active
     │   stacks = 0: → Inactive
     │
     │ remove_status() explícito → Inactive (mismo frame)
     │
     │ encounter ends (SceneManager.transition_completed)
     ▼
[ Cleared ] → reset a Inactive para próximo encuentro
```

**Invariante:** `active == (stacks >= 1)`. No existe "Active con 0 stacks".

---

### Interactions with Other Systems

**API pública del singleton StatusEffectSystem:**

| Método / Signal | Descripción |
|---|---|
| `apply_status(target_id: int, status_id: String, stacks: int)` | Aplica stacks al target. Aditivo, capado. |
| `remove_status(target_id: int, status_id: String)` | Remueve todos los stacks del estado inmediatamente. |
| `remove_all_status(target_id: int)` | Remueve todos los estados activos de la entidad. |
| `get_stack_count(target_id: int, status_id: String) → int` | Devuelve stacks actuales (0 si inactivo). |
| `get_card_cost_modifiers(card_type: String) → Array[int]` | Llamado por Card System al cachear `costo_efectivo`. Devuelve deltas de estados activos del jugador. |
| `get_damage_multiplier(entity_id: int) → float` | Llamado por Combat System. Confianza Excesiva eleva el multiplicador. |
| `get_damage_modifier(entity_id: int) → int` | Llamado por Combat System para enemigos. Vergüenza en enemigo devuelve `-(stacks)`. |
| `tick_end_of_turn(entity_id: int)` | Llamado por Combat System al final del turno de cada entidad — dispara el decay. |
| `signal status_changed(entity_id: int, status_id: String, new_stack_count: int)` | Emitida al cambiar cualquier stack count. |
| `signal negative_status_applied_to_player(status_id: String, stack_delta: int)` | Solo emitida cuando se aplican stacks negativos al jugador Y `stack_delta > 0`. Suprimida si el cap estaba lleno. Player Character System escucha esto para Idea Brillante. |

**Qué consulta cada sistema:**

| Sistema | Interface | Cuándo |
|---|---|---|
| Card System | `get_card_cost_modifiers(card_type)` | Paso 4 de cada turno (cache de `costo_efectivo`) |
| Combat System | `get_damage_multiplier()`, `get_damage_modifier()`, `tick_end_of_turn()` | Al calcular daño y al finalizar turno de cada entidad |
| Situation System | `apply_status()`, `remove_status()` | Al disparar efectos de la Situación activa |
| Enemy System | `get_stack_count()`, `apply_status()` | Al seleccionar intención y al ejecutar efectos |
| Player Character System | `signal negative_status_applied_to_player` | Para acumular Idea Brillante |
| Scene Management | *(escucha)* | Status Effect System limpia todos los estados al recibir `SceneManager.transition_completed` |

## Formulas

### Fórmula 1: Stacking (adición de stacks)

`new_stacks = min(current_stacks + incoming_stacks, stack_cap)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `current_stacks` | int | 0–`stack_cap` | Stacks actuales del estado en la entidad |
| `incoming_stacks` | int | 1–`stack_cap` | Stacks a aplicar |
| `stack_cap` | int | definido por estado | Cap máximo (Vergüenza=3, Confianza=4, Sospechoso=3, Inspirado=4) |

**Rango:** 0 a `stack_cap`. El exceso se descarta.

**Ejemplo:** Vergüenza en 2 stacks, se aplican 2 más. `min(2+2, 3) = 3`. Solo 1 stack real fue agregado.

---

### Fórmula 2: Decay (reducción al fin de turno)

`stacks_post_decay = max(0, current_stacks - DECAY_PER_TURN)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `current_stacks` | int | 0–`stack_cap` | Stacks antes del decay |
| `DECAY_PER_TURN` | int | 1 (MVP fijo) | Tuning knob |

**Rango:** 0 a `stack_cap`.

**Ejemplo:** Sospechoso en 2 stacks, fin de turno. `max(0, 2-1) = 1`.

---

### Fórmula 3: Contribución al costo efectivo (estados del jugador)

Este sistema provee el componente `mod_estado` de la fórmula `costo_efectivo` del Card System GDD:

`mod_estado_total = (stacks_vergüenza × +1) + (stacks_inspirado × -1)`

Combinado en la fórmula del Card System:
`costo_efectivo = max(0, costo_base + Σmod_situación + mod_estado_total)`

**Rango de `mod_estado_total`:** -4 (solo Inspirado cap) a +3 (solo Vergüenza cap). Con ambos activos se anulan parcialmente.

*Ver fórmula completa en Card System GDD §Formulas.*

---

### Fórmula 4: Modificador de daño del enemigo (Vergüenza en enemigo)

`daño_modificado = max(0, daño_base - stacks_vergüenza_enemigo)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `daño_base` | int | 2–12 | Resultado 2d6 del enemigo |
| `stacks_vergüenza_enemigo` | int | 0–3 | Stacks de Vergüenza en el enemigo |

**Rango de salida:** 0 a 12.

**Ejemplo:** Enemigo tira 7, tiene 2 stacks de Vergüenza. `max(0, 7-2) = 5` de daño.

---

### Fórmula 5: Daño con Confianza Excesiva

`daño_con_confianza = daño_base + stacks_confianza`

Aplica a cada instancia de daño de carta individualmente, no al total del turno.

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `daño_base` | int | varía | Daño base del efecto de carta |
| `stacks_confianza` | int | 0–4 | Stacks de Confianza Excesiva en el jugador |

**Rango de salida:** `daño_base` a `daño_base + 4`.

**Ejemplo:** Carta hace 3 de daño, jugador con 3 stacks de Confianza. `3 + 3 = 6` de daño.

## Edge Cases

- **Si Vergüenza (3 stacks) e Inspirado (3 stacks) están activos simultáneamente**: `mod_estado_total = +3 + (-3) = 0`. Sin modificación neta. Ambos decaen independientemente — puede haber asimetría al turno siguiente. El cache de `costo_efectivo` debe invalidarse en cada cambio de stack, no solo cuando el neto cambia.

- **Si el jugador tiene Confianza Excesiva Y saca snake eyes en la misma tirada**: El paso 3 aplica 1 stack de Vergüenza (+1 a costos). Al final de la fase de acción, Confianza fuerza el maná a 0. Ambos efectos se combinan — el peor turno defensivo posible. No hay supresión: los dos efectos son independientes.

- **Si el jugador tiene Sospechoso activo Y todas las cartas en mano tienen `[direct_attack]`**: El jugador tiene 0 cartas jugables ese turno. Los aliados siguen atacando. El enemigo sigue atacando. Esta es una situación de "stall" intencional, no un soft-lock. No hay escape valve en MVP.

- **Si un efecto de carta aplica Vergüenza al jugador a mitad de turno** (paso 5, fase de acción): el `costo_efectivo` cacheado en el paso 4 NO se actualiza. Los nuevos stacks de Vergüenza aplican recién al próximo turno (para costos). **Excepción:** Sospechoso sí toma efecto inmediatamente — sus cartas bloqueadas se marcan en el mismo frame en que se aplica el estado.

- **Si un efecto limpia el Sospechoso del enemigo durante su propio turno, después del telegráfico del paso 1**: La intención fue evaluada con Sospechoso activo (eligió acción sin `[direct_attack]`). Aunque Sospechoso se limpie después, la intención ya revelada NO se reevalúa. El Enemy System no recalcula la intención dentro del mismo ciclo de turno.

- **Si Inspirado está en 3 stacks al inicio del robo (paso 2)**: El bonus de robo es +1. Si un efecto posterior en el paso 5 agrega 1 stack más (llegando a 4), el bonus de +2 cartas se pierde para este turno — el robo ya ocurrió. **El bonus de robo se evalúa exactamente una vez al momento del robo y no se retroactúa.**

- **Si un enemigo con Confianza Excesiva tiene un efecto de múltiples instancias de daño**: cada instancia recibe `+stacks` individualmente (Fórmula 5). Con 4 stacks y 3 golpes de 2 daño: 3 × (2+4) = 18 daño en vez de 6. Puede eliminar aliados que sobrevivirían el daño nominal. Este es el pico de daño máximo del sistema — considerar un cap de daño por instancia en Tuning Knobs post-MVP.

- **Si `remove_all_status()` limpia Confianza Excesiva antes del límite de fin-de-fase-de-acción**: los stacks llegan a 0 y el efecto cesa en el mismo frame. El drain de maná de Confianza Excesiva es un efecto diferido — si los stacks son limpiados antes del límite de fin de fase, **el drain se cancela para ese turno**.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| Card System | Este sistema depende | Implementa `get_card_cost_modifiers(card_type) → Array[int]` — interfaz upstream crítica para cachear `costo_efectivo`. |
| Combat System | Depende de este | Lee `get_damage_multiplier()`, `get_damage_modifier()`. Llama `tick_end_of_turn(entity_id)` al finalizar el turno de cada entidad. |
| Situation System | Depende de este | Llama `apply_status()` y `remove_status()` al ejecutar efectos de Situación activa. |
| Enemy System | Depende de este | Lee `get_stack_count()` para evaluar intenciones. Llama `apply_status()` al ejecutar efectos de enemigo. |
| Player Character System | Depende de este | Escucha `signal negative_status_applied_to_player` para acumular Idea Brillante. |
| Scene Management System | Evento | Status Effect System escucha `SceneManager.transition_completed` para limpiar todos los estados al fin del encuentro. |
| Data Config System | Referencia | Usa el vocabulario de `status_ids` de `registries.json` para validación de IDs al cargar datos. |

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `stack_cap` Vergüenza | 3 | 2–5 | Más cartas bloqueadas, situaciones de stall más largas | Vergüenza expira antes, menos impacto |
| `stack_cap` Confianza Excesiva | 4 | 3–6 | Más potencia pero más turnos de apertura defensiva | Menos riesgo/recompensa |
| `stack_cap` Sospechoso | 3 | 2–5 | Mayor duración del bloqueo duro | Bloqueo duro más corto |
| `stack_cap` Inspirado | 4 | 3–6 | Más cartas gratuitas y más robo | Inspirado menos impactante |
| `DECAY_PER_TURN` | 1 | 1–2 | 2 = estados duran la mitad, más presión temporal | 0 = estados permanentes (no viable en MVP) |
| Threshold draw Inspirado | 2 stacks / 4 stacks | Modificable | Umbrales más bajos = robo extra más frecuente | Inspirado menos útil como draw engine |
| Vergüenza en enemigo (daño) | `-(stacks)` | Modificable | Mayor penalización de daño al enemigo avergonzado | Menos impactante como debuff |
| Cap de daño por instancia (Confianza) | Sin cap (MVP) | Post-MVP: 1–5 | Spikes de daño controlados | — |

## Visual/Audio Requirements

Los estados son visualmente la "gramática emocional" del juego — deben leerse en un vistazo durante una ventana de decisión de 10 segundos.

| Evento | Visual | Color (art bible §4) | Audio | Prioridad |
|---|---|---|---|---|
| Estado aplicado al jugador | Ícono del estado aparece sobre el Improvisador: Scale `0→1.3→1.0` Snap. Forma del ícono distinguible por forma + color (daltonismo). | Vergüenza/Inspirado: Verde Absurdo (forma onda). Sospechoso: Azul Gravedad (forma angular). Confianza Excesiva: Dorado Caos (forma flecha arriba). | Sonido de estado aplicado — corto, diferenciado por estado | HIGH |
| Stack count cambia | El número de stacks sobre el ícono actualiza por corte directo. No hay tween — el número es información crítica que debe leerse instantáneamente. | Igual que el estado base | Clic seco muy breve | HIGH |
| Estado decae (stack -1) | El número reduce por corte. A 0 stacks: el ícono desaparece con Scale `1→0` en 0.1s Spring. | — | Pequeño "whoosh" descendente al expirar | MEDIUM |
| Sospechoso bloquea una carta | La carta bloqueada mantiene el mismo X grisado de "no costeable" (art bible §7.4) | Rojo Urgente en la X | Sin sonido extra (X ya es el indicador establecido) | HIGH |
| Confianza Excesiva drena maná | La banda de Impulso se vacía por Directo al llegar al límite de fin-de-fase. Igual que gastar maná en cartas, pero automático. | — | Sonido diferente al "gastar maná voluntariamente" — algo que comunica "se te escapó" | HIGH |
| Estado en enemigo | Ícono flotante sobre el sprite del enemigo. Más pequeño que el ícono del jugador (~60% del tamaño). Stack count visible. | Mismo sistema de colores | Sin audio (la información relevante es visual) | HIGH |

**Color de Inspirado:** No asignado en el art bible §4. Este GDD lo define como **Dorado Caos** (`#F2B71F`) — el color de "algo que salió bien contra todo pronóstico". Icono: forma de estrella/chispa (distinto de la ola de Verde Absurdo y la forma angular de Azul Gravedad).

## UI Requirements

| Elemento | Descripción | Referencia |
|---|---|---|
| Ícono de estado sobre el Improvisador | Ícono dibujado a mano + número de stacks. Máximo 4 íconos simultáneos (1 por estado). Siempre visible durante el encuentro. | Art bible §7.3 (íconos), §7.5 (HUD layout) |
| Ícono de estado sobre enemigo | Versión reducida (~60%) del mismo sistema. Múltiples estados simultáneos deben caber sin obstruir el sprite del enemigo. | Art bible §7.5 |
| Carta bloqueada por Sospechoso | Usa el mismo tratamiento visual de carta no-jugable (X de tinta) — ya definido en art bible §7.4 y Card System GDD | Art bible §7.4 |
| Notificación de decay | El número de stacks reduce visiblemente — cambio de número es información suficiente, sin panel adicional | — |

> **📌 UX Flag — Status Effect System**: Este sistema tiene UI requirements en el HUD del encuentro (íconos de estado sobre jugador y enemigo). En Phase 4, ejecutar `/ux-design encounter-screen` para definir el layout exacto de los íconos de estado. Las historias que referencien UI de estados deben citar `design/ux/encounter-screen.md`.

## Cross-References

| Este documento referencia | Fuente | Elemento | Naturaleza |
|---|---|---|---|
| Fórmula `costo_efectivo` (componente `mod_estado`) | `design/gdd/card-system.md` §Formulas | `costo_efectivo = max(0, costo_base + Σmod_situación + mod_estado_total)` | Dependencia de fórmula |
| `get_card_cost_modifiers()` interface | `design/gdd/card-system.md` §Interactions | Firma exacta de la interfaz | Dependencia de regla |
| Snake eyes aplica Vergüenza 1 stack | `design/gdd/card-system.md` §Core Rules §2 | Resultado de tirada 2d6=2 | Dependencia de estado |
| Mano de 4 cartas | `design/gdd/card-system.md` | `HAND_SIZE = 4` (registry) | Dependencia de datos |
| Vocabulario de status_ids | `design/gdd/data-configuration-system.md` §registries | `vergüenza`, `confianza_excesiva`, `sospechoso`, `inspirado` | Dependencia de datos |
| `SceneManager.transition_completed` | `design/gdd/scene-management-system.md` §API | Signal de fin de encuentro | Trigger de estado |
| Color de Inspirado → Dorado Caos | `design/art/art-bible.md` §4 | `#F2B71F` — "algo que salió bien contra todo pronóstico" | Dependencia visual |
| Tag `[direct_attack]` para Sospechoso | `design/gdd/data-configuration-system.md` | **⚠️ RETROFIT PENDIENTE** — agregar tag al vocabulario de tags en `registries.json` | Retrofit requerido |

## Acceptance Criteria

Tests unitarios en `tests/unit/status-effect-system/` (BLOCKING — Logic). Integración en `tests/integration/status-effect-system/` (BLOCKING). Performance ADVISORY.

- **AC-01 (Vergüenza — costo de carta):** DADO jugador con 2 stacks de Vergüenza, CUANDO Card System cachea `costo_efectivo` al inicio de turno, ENTONCES `costo_efectivo = max(0, costo_base + 2)`. Una carta con `costo_base=1` requiere 3 de maná.

- **AC-02 (Vergüenza — daño de enemigo):** DADO enemigo con 2 stacks de Vergüenza y `daño_base=7`, CUANDO Combat System calcula su daño, ENTONCES `max(0, 7-2) = 5`. Con 3 stacks y `daño_base=2`: `max(0, 2-3) = 0`. El daño nunca es negativo.

- **AC-03 (Confianza Excesiva — daño por instancia):** DADO jugador con 3 stacks de Confianza, CUANDO juega carta con 2 instancias de daño de 4 cada una, ENTONCES cada instancia = `4+3 = 7`. Daño total al enemigo: 14.

- **AC-04 (Confianza Excesiva — drain de maná binario):** DADO jugador con ≥ 1 stack de Confianza que termina fase de acción con 5 de maná, CUANDO se alcanza el límite de fin-de-fase, ENTONCES `mana_current` se fuerza a 0. DADO que stacks son limpiados antes de ese límite, ENTONCES el drain no ocurre ese turno.

- **AC-05 (Sospechoso — bloqueo binario):** DADO jugador con 1 stack de Sospechoso y mano con cartas `[direct_attack]` y sin `[direct_attack]`, CUANDO el sistema evalúa jugabilidad, ENTONCES las cartas con `[direct_attack]` son injugables (grisadas) y las sin el tag son jugables. El bloqueo es idéntico con 1, 2 o 3 stacks.

- **AC-06 (Inspirado — reducción de costo y umbrales de robo):** DADO jugador con 4 stacks de Inspirado, CUANDO Card System cachea costos, ENTONCES `mod_estado_total = -4` y carta con `costo_base=1` tiene `costo_efectivo = 0`. DADO robo con exactamente 2 stacks: roba 1 extra (total 5). Con 4 stacks: roba 2 extras (total 6). Con 1 o 3 stacks: sin carta extra.

- **AC-07 (Stacking — exceso descartado, señal suprimida al cap):** DADO Vergüenza en 2 stacks (cap=3) y se aplican 3 stacks adicionales, CUANDO `apply_status()` resuelve, ENTONCES `new_stacks = min(2+3, 3) = 3` y la señal `negative_status_applied_to_player` se emite con `stack_delta=1`. DADO Vergüenza ya en 3 y se aplican 2 más, ENTONCES la señal NO se emite.

- **AC-08 (Decay — no va por debajo de 0, desactiva en 0):** DADO Sospechoso en 1 stack al final del turno de la entidad, CUANDO `tick_end_of_turn()` resuelve, ENTONCES `stacks_post_decay = 0`, el estado pasa a `active=false` en el mismo frame, y las cartas `[direct_attack]` vuelven a ser jugables inmediatamente.

- **AC-09 (Cancelación Vergüenza + Inspirado — cache se invalida por cambio):** DADO jugador con Vergüenza 3 e Inspirado 3 simultáneamente, CUANDO se calcula `mod_estado_total`, ENTONCES `0` (se cancelan). Si en el siguiente turno Inspirado decae a 2 y Vergüenza permanece en 3, ENTONCES `mod_estado_total = +1` y el cache se recalcula — no solo cuando el neto cambia, sino en cada cambio de stack.

- **AC-10 (Limpieza al fin de encuentro):** DADO jugador y enemigo con estados activos, CUANDO `SceneManager.transition_completed` se emite, ENTONCES `get_stack_count()` retorna 0 para todos los estados de todas las entidades.

- **AC-11 (Señal Idea Brillante — solo con delta real positivo):** DADO jugador sin Vergüenza, CUANDO `apply_status(player, "vergüenza", 2)`, ENTONCES la señal se emite con `stack_delta=2`. DADO Vergüenza en cap=3 y se aplican más stacks, ENTONCES la señal NO se emite. DADO aplicación de Confianza o Inspirado al jugador, ENTONCES la señal NUNCA se emite.

- **AC-12 (Integración Card + Status — costo mid-turn no retroactúa; Sospechoso sí es inmediato):** DADO costo efectivo cacheado en paso 4 con Vergüenza=0, CUANDO carta aplica Vergüenza al jugador durante paso 5, ENTONCES `cost_effective` de cartas en mano actual NO cambia. DADO carta aplica Sospechoso en el mismo escenario, ENTONCES las cartas `[direct_attack]` sí se marcan inmediatamente como injugables.

- **AC-13 (Sospechoso en enemigo — stall intencional):** DADO enemigo cuyas únicas intenciones son `[direct_attack]` con Sospechoso activo, CUANDO Enemy System evalúa intención, ENTONCES el enemigo pasa su turno con daño=0. Sin escape valve, sin error.

- **AC-14 (Performance — apply y tick &lt; 1ms por entidad):** DADO encuentro con 5 entidades y los 4 estados activos en todas, CUANDO el sistema ejecuta `apply_status()` y `tick_end_of_turn()` para todas en un mismo frame, ENTONCES el tiempo total de procesamiento del StatusEffectSystem es inferior a 1ms en hardware mínimo objetivo.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿Qué color visual tiene Inspirado? | Resuelto en este GDD | Dorado Caos (`#F2B71F`) — "algo que salió bien". Confirmar con Art Director antes de producir assets. |
| ¿Confianza Excesiva es negativa para Idea Brillante cuando se aplica al jugador? | Diferido al Player Character GDD | Actualmente clasificado como NO negativo. Si la mecánica Idea Brillante evoluciona, reconsiderar. |
| ¿El tag `[direct_attack]` puede tener más de una lectura narrativa? | Pendiente — Data Config retrofit | El tag debe definirse con precisión: ¿qué categoría de cartas lo tiene? ¿Solo golpes físicos o también ataques mágicos directos? Resolver antes de autear el primer set de 20 cartas. |
| ¿Hay cap de daño por instancia para Confianza Excesiva en enemigos multi-hit? | Post-MVP | Sin cap en MVP. Si el spike de daño resulta frustrante en playtest, agregar cap de `+2` máximo por instancia como primer ajuste. |
| ¿Los efectos de estado del enemigo usan la misma interface `get_card_cost_modifiers()` o una nueva? | Resuelto en este GDD | Interface paralela: `get_damage_modifier(entity_id) → int` para Vergüenza en enemigos, `get_damage_multiplier(entity_id) → float` para Confianza en enemigos. Confirmar con Combat System GDD al diseñarlo. |
