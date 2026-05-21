---
sidebar_position: 12
title: Sistema de Deck Building
description: La pantalla de recompensa post-encuentro — oferta de cartas, mejoras, eliminaciones y reliquias que evolucionan el mazo del jugador a lo largo del run.
---

# Deck Building System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Rejugabilidad por Combinaciones · Decisiones Rápidas

## Overview

El Deck Building System gestiona la fase de recompensa post-encuentro: genera la pantalla de reward tras cada victoria regular, presenta al jugador cuatro opciones de evolución del mazo (añadir carta / mejorar carta / eliminar carta / ganar reliquia), ejecuta la elección via las APIs del Card System y del Relic System, y entrega el control al Scene Manager para avanzar en el mapa. Técnicamente, el sistema posee el pool de cartas disponibles para el run (qué cartas pueden ofrecerse a lo largo de la run), la lógica de generación de oferta (cuántas opciones se presentan por categoría y con qué criterios), y las reglas de mutación del mazo (qué constituye una mejora, cuál es el tamaño máximo del mazo, qué restricciones aplican a la eliminación). No define lo que las cartas hacen ni cómo las reliquias funcionan — llama a los sistemas que sí lo definen y les entrega el resultado de la decisión del jugador.

Para el jugador, el Deck Building System es el único momento del run sin timer, sin enemigo, y sin urgencia — la decisión que moldea los próximos tres encuentros. Cada victoria no solo termina el encuentro: abre una ventana en la que el jugador puede añadir poder, añadir eficiencia, reducir ruido, o cambiar completamente la premisa de cómo va a jugar. La carta que se suma hoy puede ser la que cierre la Situación de la run siguiente. La reliquia que se elige puede hacer que todo el mazo existente juegue diferente. El sistema no recompensa al jugador con números: lo recompensa con posibilidades.

## Player Fantasy

El combate terminó. El enemigo está derrotado de la manera más ridícula que pudiste improvisar — convenciste al Caballero Confiado de que firmara un contrato verbal, o algo así. Por primera vez en este run, nada te apura. No hay Situación gritándote sus reglas, no hay intención enemiga contando los turnos, no hay Impulso que gastar. Solo vos, tu mazo en la cabeza, y cuatro opciones sobre la mesa.

Y acá viene lo bueno: cada opción es una pequeña promesa de cómo va a ser el resto de tu historia. ¿Sumás "Discurso Motivacional Innecesario" porque ya te imaginás la cara del próximo enemigo cuando lo vea venir? ¿Mejorás esa carta que casi te salvó dos encuentros atrás pero siempre faltaba un Impulso? ¿Tirás una carta del mazo inicial que ya no sentís tuya, que la arrastrás porque "capaz sirve en algún momento" — y ahora sabés que ese momento no llega? ¿O agarrás la reliquia que dice "tus mentiras pesan el doble en juzgados" sin saber todavía si va a haber un juzgado?

El placer no está en optimizar. Está en notar el patrón de tus propias decisiones tres recompensas más tarde: "ah, claro, estoy armando el mazo del falso abogado". Cada recompensa es una pincelada de intención sobre el caos del run. Y en el próximo encuentro, cuando esa carta nueva aparezca en la mano y encaje exactamente en la Situación activa, ya no parece suerte — parece que lo planeaste todo. Aunque no lo hayas planeado. Ese es el chiste, y el jugador está adentro.

Si el sistema falla en entregar esto, el reward screen se convierte en una transacción anónima: "¿qué carta tiene el número más alto?" El jugador no construye identidad de run — solo acumula poder. Sin eliminación que se sienta como edición, sin mejora que cambie la promesa de una carta, sin reliquia que reestructure el mazo entero, el sistema no tiene textura. La decisión más deliberada del run tiene que sentirse más personal que cualquier turno de combate — el combate improvisa; el reward screen elige con intención.

El run te pasaba. Ahora vos le pasás al run.

## Detailed Design

### Core Rules

**1. El Deck Building System como gestor de la pantalla de recompensa**

El Deck Building System es el único sistema dueño del estado del reward screen. Recibe el control del SceneManager al completar la transición `Reward`, genera las ofertas de cada categoría, presenta las opciones al jugador, ejecuta la acción elegida llamando a Card System o Relic System, y entrega el control de vuelta al SceneManager para avanzar al mapa. No ocurre en el encuentro — es la capa de progresión del run.

---

**2. Las cuatro opciones del reward screen**

| Opción | Descripción | Bloqueada si... |
|---|---|---|
| **Añadir carta** | Se presentan 3 cartas del pool. El jugador elige 1 → entra al mazo inmediatamente. | `deck_size >= 20` (cap alcanzado) |
| **Mejorar carta** | El jugador elige 1 carta mejorable de su mazo → sus efectos se actualizan a `upgraded_effects`. | No hay cartas con `upgradeable=true AND NOT mejorada` |
| **Eliminar carta** | El jugador elige 1 carta de su mazo → se elimina permanentemente del run. | `deck_size <= 4` (mínimo funcional) |
| **Ganar reliquia** | Se presentan 2 reliquias del pool. El jugador elige 1 → se activa inmediatamente. | `RelicManager.get_available_relics(2)` retorna array vacío |

El jugador DEBE elegir una de las opciones disponibles. No existe opción de "saltar el reward". Si una opción está bloqueada, las restantes siguen disponibles. En el caso extremo de que todas estén bloqueadas (teóricamente imposible en MVP), el sistema avanza automáticamente al mapa.

---

**3. Reglas de "Añadir carta"**

- El pool de cartas es el set completo de 20 cartas MVP. No varía entre rewards ni entre runs.
- Cada oferta genera 3 cartas del pool con los siguientes filtros aplicados en orden:
  1. Las 3 cartas de la oferta son distintas entre sí (no hay repetidos dentro de la misma oferta).
  2. Se excluyen cartas de las que el jugador ya tiene 2 copias en el mazo (cap de duplicados).
- Las cartas no elegidas regresan al pool para la próxima oferta — no hay pool consumptivo.
- **Duplicados permitidos, cap 2 copias:** el jugador puede tener máximo 2 copias de cualquier carta individual en su mazo. Tener 2 copias es estrategia válida; la tercera copia nunca se ofrece.
- Al confirmar la elección, `CardSystem.add_card(CardData)` es llamado inmediatamente. La carta pasa al `_discard_pile` del run activo y está disponible desde el turno 1 del próximo encuentro. El contador del mazo se actualiza en pantalla antes de salir del reward screen.

---

**4. Reglas de "Mejorar carta"**

- El jugador ve la lista completa de cartas en su mazo, filtrada a las elegibles: `upgradeable == true AND NOT ya_mejorada`.
- Las cartas ya mejoradas aparecen en la lista con indicador visual pero no son seleccionables.
- Si ninguna carta es elegible, la opción aparece bloqueada.
- El jugador selecciona una carta y ve un panel comparativo (efectos actuales vs. `upgraded_effects`) antes de confirmar.
- Al confirmar, `CardSystem.upgrade_card(card_id)` es llamado. La carta muta in-place: sus efectos se reemplazan por `upgraded_effects` y se marca como mejorada. El slot del mazo no cambia.
- **No hay "mejora doble":** una carta mejorada no puede mejorarse de nuevo. El modelo de datos tiene exactamente dos estados: base y mejorada.
- Todas las cartas MVP tienen `upgradeable: true`. Si en el futuro una carta específica no tiene upgrade path, se la marca `upgradeable: false`.

---

**5. Reglas de "Eliminar carta"**

- El jugador ve la lista completa de su mazo. Puede seleccionar cualquier carta — sin restricción por tipo, rareza, o si fue carta inicial o adquirida.
- Si `deck_size <= 4` (igual al `HAND_SIZE`), la opción aparece bloqueada. El mazo nunca puede bajar de 4 cartas — el mínimo funcional del Card System.
- Al seleccionar una carta, se muestra un diálogo de confirmación explícita antes de ejecutar. La eliminación es la única operación destructiva del run — un click adicional previene misclicks con consecuencias irreversibles.
- Al confirmar, `CardSystem.remove_card(card_id)` es llamado. La carta se elimina de `_draw_pile` o `_discard_pile` (donde esté en ese momento) y no vuelve a aparecer en el run.
- **El jugador no puede eliminar y añadir en la misma recompensa.** Son categorías mutuamente excluyentes — solo se elige una acción por reward. Si el jugador quiere hacer espacio para añadir, debe haber eliminado en un reward anterior.

---

**6. Reglas de "Ganar reliquia"**

- El sistema llama `RelicManager.get_available_relics(2)` al inicializar el reward. Si retorna array vacío, la opción queda bloqueada.
- Se presentan 2 placas de reliquia. El jugador elige 1.
- Al confirmar, `RelicManager.add_relic(relic_id)` es llamado. La reliquia pasa a estado `READY` en `RelicManager._active_relics`.
- Si `trigger == "on_run_start"`, el efecto se dispara inmediatamente al momento de adquisición. Ver Relic System GDD §3.

---

**7. Reglas del cap de mazo (20 cartas)**

- Si `deck_size >= 20`, la opción "Añadir carta" se muestra bloqueada con indicador "Mazo lleno (20/20)".
- Las otras tres opciones (mejorar, eliminar, reliquia) siguen disponibles.
- No existe acción de "intercambiar carta" (añadir + eliminar en un paso). La restricción es intencional: llegar al cap tiene un costo estratégico — en cada reward con el mazo lleno, el jugador pierde la opción de añadir.

---

**8. Inicialización del reward screen**

Al recibir `SceneManager.transition_completed(RewardScreen)`:

| Paso | Acción |
|---|---|
| 1 | `CardSystem.get_deck()` — estado actual del mazo (para filtros y display) |
| 2 | `DataLoader.get_all_cards()` → genera oferta de 3 cartas (filtros de duplicados aplicados) |
| 3 | Filtra mejorables: `upgradeable=true AND NOT ya_mejorada` |
| 4 | `RelicManager.get_available_relics(2)` → genera oferta de 2 reliquias (o vacío) |
| 5 | Evalúa bloqueadas: cap de mazo, mejorables disponibles, mínimo de mazo, pool de reliquias |
| 6 | Emite `reward_screen_ready()` — la UI renderiza las 4 categorías con sus estados |

---

### States and Transitions

| Estado | Descripción | Entra desde | Sale hacia |
|---|---|---|---|
| `REWARD_INIT` | Genera las 4 ofertas y evalúa opciones bloqueadas | `transition_completed(RewardScreen)` | `OPTION_SELECTION` al completar |
| `OPTION_SELECTION` | El jugador ve las 4 categorías y elige una | `REWARD_INIT` | `CARD_ADD_SELECTION`, `CARD_UPGRADE_SELECTION`, `CARD_REMOVE_SELECTION`, `RELIC_SELECTION` |
| `CARD_ADD_SELECTION` | Muestra las 3 cartas de la oferta | `OPTION_SELECTION` | `REWARD_EXECUTING` al hacer click en una carta |
| `CARD_UPGRADE_SELECTION` | Muestra las cartas mejorables del mazo con panel comparativo | `OPTION_SELECTION` | `REWARD_EXECUTING` al hacer click en una carta |
| `CARD_REMOVE_SELECTION` | Muestra el mazo completo; espera selección + confirmación explícita | `OPTION_SELECTION` | `REWARD_EXECUTING` al confirmar |
| `RELIC_SELECTION` | Muestra las 2 placas de reliquia | `OPTION_SELECTION` | `REWARD_EXECUTING` al hacer click en una reliquia |
| `REWARD_EXECUTING` | Ejecuta la mutación del mazo o reliquia y reproduce feedback visual (~0.4s) | Cualquier `_SELECTION` | `REWARD_COMPLETE` |
| `REWARD_COMPLETE` | Persiste brevemente para mostrar confirmación visual, luego llama SceneManager | `REWARD_EXECUTING` | `SceneManager.request_transition(NodeMap)` |

**Diagrama:**
```
REWARD_INIT → OPTION_SELECTION ─┬─ [añadir]  → CARD_ADD_SELECTION     ┐
                                 ├─ [mejorar] → CARD_UPGRADE_SELECTION  │→ REWARD_EXECUTING → REWARD_COMPLETE → NodeMap
                                 ├─ [eliminar]→ CARD_REMOVE_SELECTION   │
                                 └─ [reliquia]→ RELIC_SELECTION          ┘
```

**Invariante:** el estado `REWARD_EXECUTING` no puede ser interrumpido por input del jugador. Una vez que la mutación comienza, el sistema la completa en ese frame.

---

### Interactions with Other Systems

| Sistema | Recibe del Deck Building System | Provee al Deck Building System |
|---|---|---|
| **Card System** | Llamadas: `get_deck()`, `add_card(CardData)`, `upgrade_card(id)`, `remove_card(id)` | `Array[CardData]` del mazo actual; responde a las mutaciones |
| **Relic System** | Llamadas: `RelicManager.get_available_relics(2)`, `RelicManager.add_relic(id)` | `Array[RelicData]` disponibles (0 o 2 elementos) |
| **DataLoader** | Llamada: `get_all_cards() → Array[CardData]` | Pool completo de cartas del run |
| **Scene Management System** | Llamada: `request_transition(NodeMap)` al completar. Emite: `reward_screen_ready()`. | Señal: `transition_completed(RewardScreen)` para inicializar |
| **GameEvents** | Emite: `on_card_added_to_deck`, `on_relic_acquired` (extensibilidad futura — ninguna reliquia MVP escucha estos eventos) | — |
| **UI layer** | Señales: `reward_screen_ready()`, `option_blocked(category)`, `reward_completed(action_type)` | Input del jugador vía señales de la UI |

## Formulas

### Fórmula 1: Generación de oferta de cartas

`offer = sample_without_replacement(eligible_pool, OFFER_SIZE)`

donde `eligible_pool = { c ∈ card_pool | copies_in_deck(c) < DUPLICATE_CAP }`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `card_pool` | `Array[CardData]` | 20 elementos | Pool completo del run — las 20 cartas MVP, fijo entre rewards y entre runs |
| `copies_in_deck(c)` | int | 0–2 | Copias de la carta `c` en el mazo actual del jugador |
| `DUPLICATE_CAP` | int const | 2 | Cap de copias por carta individual en el mazo |
| `eligible_pool` | `Array[CardData]` | 0–20 | Subconjunto del pool tras excluir cartas con `DUPLICATE_CAP` copias |
| `OFFER_SIZE` | int const | 3 | Número de cartas a presentar en cada oferta de "Añadir carta" |
| `offer` | `Array[CardData]` | 0–3 | Cartas presentadas al jugador; las no elegidas regresan al pool para la próxima oferta |

**Rango de salida:** 0–3 cartas. Si `|eligible_pool| == 0`, la opción "Añadir carta" se bloquea por pool agotado — distinción del bloqueo por `deck_size >= DECK_CAP`. Los 3 elementos de la oferta son necesariamente distintos entre sí (muestreo sin reposición).

**Ejemplo:** El jugador tiene 2 copias de "Discurso Inesperado" y 2 de "Papeleo Urgente" → `eligible_pool` = 18 cartas → `sample_without_replacement(18, 3)` → oferta de 3 cartas distintas entre sí.

---

### Fórmula 2: Disponibilidad de las cuatro opciones

```
available_add     = (deck_size < DECK_CAP) AND (|eligible_pool| >= 1)
available_upgrade = |{ c ∈ deck | c.upgradeable == true AND c.upgraded == false }| >= 1
available_remove  = deck_size > DECK_MIN
available_relic   = |RelicManager.get_available_relics(2)| >= 1
```

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `deck_size` | int | 4–20 | Cartas totales en el mazo al inicio del reward screen |
| `DECK_CAP` | int const | 20 | Tamaño máximo del mazo del jugador |
| `DECK_MIN` | int const | 4 | Mínimo funcional del mazo = `HAND_SIZE` del Card System |
| `eligible_pool` | `Array[CardData]` | 0–20 | Pool filtrado por Fórmula 3 |
| `c.upgradeable` | bool | — | Si la `CardData` tiene un upgrade path definido |
| `c.upgraded` | bool | — | Si la carta ya fue mejorada en este run |

**Rango de salida:** cuatro booleanos independientes. Las cuatro condiciones se evalúan en paralelo en `REWARD_INIT`. En MVP es imposible que las cuatro sean `false` simultáneamente — `available_remove` es `true` siempre que `deck_size > 4`, y el jugador comienza con `starting_deck_size = 10`.

**Ejemplo:** Mazo en 20 cartas, 0 mejorables, 2 reliquias disponibles → `available_add=false`, `available_upgrade=false`, `available_remove=true`, `available_relic=true`. El jugador puede mejorar, eliminar o tomar reliquia.

---

### Fórmula 3: Check de cap de duplicados

`excluded_from_offer(c) = copies_in_deck(c) >= DUPLICATE_CAP`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `c` | `CardData` | — | Carta del `card_pool` siendo evaluada para inclusión en `eligible_pool` |
| `copies_in_deck(c)` | int | 0–2 | Instancias de la carta `c` encontradas en `CardSystem.get_deck()` comparando `card_id` |
| `DUPLICATE_CAP` | int const | 2 | Máximo de copias por carta individual permitidas en el mazo |

**Rango de salida:** bool. La exclusión ocurre durante la construcción de `eligible_pool` en Fórmula 1, antes de que la carta pueda ser ofrecida. La condición nunca evalúa `copies_in_deck > 2` porque el sistema nunca permite añadir una tercera copia.

**Ejemplo:** Mazo = [CartaA, CartaA, CartaB]. `copies_in_deck(CartaA) = 2` → `excluded = 2 >= 2 = true`. `copies_in_deck(CartaB) = 1` → `excluded = 1 >= 2 = false`. `copies_in_deck(CartaC) = 0` → `excluded = 0 >= 2 = false`.

---

### Fórmula 4: Tamaño del mazo post-acción

`deck_size_after = deck_size + Δ(action)`

| Acción | Δ | Condición previa (de Fórmula 2) |
|---|---|---|
| `add_card` | +1 | `available_add == true` |
| `upgrade_card` | 0 | `available_upgrade == true` |
| `remove_card` | −1 | `available_remove == true` |
| `add_relic` | 0 | `available_relic == true` |

**Rango de salida:** int en [4, 20] siempre — las condiciones previas de Fórmula 2 garantizan que los límites nunca se violan si el sistema evalúa `available_*` antes de permitir la acción. `upgrade_card` y `add_relic` son neutros: no cambian el tamaño del mazo.

**Ejemplo (add al límite):** `deck_size = 19` + `add_card` → `deck_size_after = 20`. Siguiente reward: `available_add = (20 < 20) = false`.

**Ejemplo (remove al mínimo):** `deck_size = 5` + `remove_card` → `deck_size_after = 4`. Siguiente reward: `available_remove = (4 > 4) = false`.

## Edge Cases

### Opciones bloqueadas

**Si `deck_size <= DECK_MIN (4)`**: la opción "Eliminar carta" se muestra bloqueada. El jugador puede permanecer en este estado por múltiples rewards eligiendo Mejorar o Reliquia sucesivamente. Es un estado válido e intencional — la salida es añadir cartas en un reward siguiente.

**Si ninguna carta del mazo tiene `upgradeable=true AND upgraded=false`**: la opción "Mejorar carta" se muestra bloqueada. En MVP ocurre solo si el jugador mejoró todas sus cartas mejorables.

**Si `|RelicManager.get_available_relics(2)| == 0`**: la opción "Ganar reliquia" se muestra bloqueada.

**Si las cuatro opciones están bloqueadas simultáneamente**: el sistema avanza automáticamente al NodeMap sin acción del jugador. Esta condición es matemáticamente imposible en MVP (pool=20, DECK_CAP=20, DUPLICATE_CAP=2, starting_deck_size=10), pero el fallback debe existir en código. Si ocurre, loggear como error, no crash.

### Pool de cartas con menos de OFFER_SIZE opciones

**Si `0 < |eligible_pool| < OFFER_SIZE (3)`**: presentar `|eligible_pool|` cartas (1 o 2). La opción "Añadir carta" permanece desbloqueada. La UI debe soportar 1, 2 o 3 cartas en el layout. Con los valores MVP actuales, `|eligible_pool| < 3` mientras `available_add=true` es matemáticamente imposible — si los valores de tuning cambian (pool_size, DECK_CAP, DUPLICATE_CAP), esta invariante debe reevaluarse.

### Pool de reliquias con 1 sola disponible

**Si `|RelicManager.get_available_relics(2)| == 1`**: `available_relic=true` y se presenta 1 sola placa de reliquia. La UI en `RELIC_SELECTION` debe soportar 1 o 2 opciones; el segundo slot tiene estado visual "vacío". Con 6 reliquias en el pool MVP, esta condición ocurre cuando el jugador ya adquirió 5 reliquias en rewards anteriores.

### Navegación de regreso

**Si el jugador entra a cualquier sub-pantalla (`CARD_ADD_SELECTION`, `CARD_UPGRADE_SELECTION`, `CARD_REMOVE_SELECTION`, `RELIC_SELECTION`) y decide volver**: regresa a `OPTION_SELECTION` sin ejecutar ninguna acción. El regreso es posible hasta el momento de confirmar. Una vez disparado `REWARD_EXECUTING`, el retorno es imposible.

Para "Eliminar carta": el flujo de `CARD_REMOVE_SELECTION` tiene confirmación explícita interna ("¿Eliminar [carta]?"). Cancelar esa confirmación regresa a `CARD_REMOVE_SELECTION` sin selección activa — desde allí el jugador puede volver a `OPTION_SELECTION`.

### Upgrade con 2 copias de la misma carta

**Si el jugador tiene 2 copias de CartaX (base) en el mazo**: `CARD_UPGRADE_SELECTION` muestra 2 entradas separadas, cada una identificada por su `instance_id` único. Al elegir una entrada, `upgrade_card(instance_id)` muta esa instancia a `upgraded_effects` y la marca `upgraded=true`. La segunda copia permanece en estado base y es mejorable en un reward posterior. La verificación de elegibilidad es siempre por `instance_id`, no por `card_id`.

### Oferta generada una sola vez por reward

**Al inicializar `REWARD_INIT`**: la oferta de cartas (3 del eligible_pool) y la oferta de reliquias (1–2 del pool disponible) se generan por muestreo aleatorio una sola vez y se guardan en el estado del reward. Si el reward se interrumpe y se recarga (ej. reload en web), la oferta persiste — no se re-samplea. El Save System debe incluir la oferta generada al persistir el estado de `OPTION_SELECTION`.

### Atomicidad de REWARD_EXECUTING

**Al entrar a `REWARD_EXECUTING`**: la mutación del estado de juego (llamada a `CardSystem` o `RelicManager`) se ejecuta síncronamente en el frame actual. El feedback visual (~0.4s) es asíncrono. Si el tab del browser se cierra durante el feedback visual, la mutación ya ocurrió y es visible al recargar. El Save System persiste el estado después de `REWARD_COMPLETE`, nunca mid-`REWARD_EXECUTING`.

**Precondición de entrada a `REWARD_INIT`**: el Card System garantiza que `_hand` está vacía y todas las cartas están en `_draw_pile` o `_discard_pile` al recibir `transition_completed(RewardScreen)`.

### Comparación de cartas por card_id

**Al evaluar `copies_in_deck(c)` en las fórmulas 1 y 3**: la comparación siempre usa `c.card_id` (String), nunca referencia de objeto. Dos copias de CartaX tienen `card_id` idéntico pero `instance_id` distintos. Una implementación que compare por referencia contaría siempre 0 o 1 copias, permitiendo que CartaX aparezca en la oferta cuando el jugador ya tiene 2.

### Cartas de inicio vs. adquiridas

**Para todas las cuatro opciones del reward screen**: las cartas del `starting_deck` y las adquiridas en rewards anteriores se tratan de forma idéntica. No existe restricción de origen — una carta del starting_deck puede mejorarse, eliminarse, u ofrecerse normalmente.

## Dependencies

| Sistema | Tipo | Interfaz | Dirección |
|---|---|---|---|
| **Card System** | Hard | `get_deck() → Array[CardData]`; `add_card(CardData)`; `upgrade_card(instance_id)`; `remove_card(instance_id)` | Upstream |
| **Relic System** | Hard | `RelicManager.get_available_relics(count: int) → Array[RelicData]`; `RelicManager.add_relic(relic_id)` | Upstream |
| **Data Configuration System** | Hard | `DataLoader.get_all_cards() → Array[CardData]` — pool completo de 20 cartas MVP | Upstream |
| **Scene Management System** | Hard | Recibe: `transition_completed(RewardScreen)` para inicializar; emite: `SceneManager.request_transition(NodeMap)` al completar | Bidireccional |
| **Save System** | Soft | El Save System debe persistir el estado del reward screen (oferta generada + opción elegida) entre `OPTION_SELECTION` y `REWARD_COMPLETE`. El Deck Building System emite señales de inicio/fin de `REWARD_EXECUTING` para que el Save System delimite la zona no-guardable. | Downstream |
| **UI layer** | Hard | El Deck Building System emite: `reward_screen_ready(options_state)`, `option_blocked(category)`, `reward_completed(action_type)`. Recibe input del jugador vía señales de UI. | Bidireccional |

**Dependencias hard vs. soft:**
- **Hard**: el sistema no puede funcionar sin esta dependencia en absoluto.
- **Soft** (Save System): el core del reward screen funciona sin persistencia — el estado se pierde si el tab se cierra antes de `REWARD_COMPLETE`, pero la mecánica funciona correctamente en una sesión continua.

**Nota de consistencia bidireccional:** El Card System GDD debe listar al Deck Building System en su Dependencies como dependiente downstream. El Save System GDD (por diseñar) debe listar al Deck Building System como dependencia upstream.

## Tuning Knobs

| Knob | Valor MVP | Rango seguro | Qué rompe si va muy alto | Qué rompe si va muy bajo |
|---|---|---|---|---|
| `DECK_CAP` | 20 | 15–30 | Runs largas se vuelven inmanejables; el jugador pierde el track de qué hay en el mazo; tiempo de draw cycle se alarga | Si baja a ≤10 el starting_deck llena el cap en las primeras rewards; sin espacio para añadir |
| `DECK_MIN` | 4 | 3–6 | — | Si baja a 1–2 el mazo es trivial de ciclar; si sube a 6+ el jugador pierde opciones de eliminar demasiado pronto. **Advertencia:** debe ser ≤ `HAND_SIZE` del Card System (actualmente 4) — si no, el jugador siempre tendría más cartas en el mazo que puede robar en una mano |
| `DUPLICATE_CAP` | 2 | 1–3 | Con cap=3 el jugador puede construir mazos extremadamente redundantes; los runs degeneran a "repite la mejor carta 3 veces" | Con cap=1 se elimina el clustering estratégico; el juego se vuelve más variado pero menos "combo" |
| `OFFER_SIZE` | 3 | 2–4 | Con 4 la pantalla de reward se llena; más opciones pueden paralizar la decisión | Con 2 la oferta se siente restringida; si las 2 cartas ofrecidas son malas, el jugador siente que no tiene salida |
| `RELIC_OFFER_SIZE` | 2 | 1–3 | Con 3 el reward de reliquia es más pesado de evaluar | Con 1 no hay decisión real — la única reliquia se acepta o se rechaza eligiendo otra categoría |

**Interacciones entre knobs:**
- `DECK_CAP` y `DUPLICATE_CAP` interactúan: si `DECK_CAP=20` y `DUPLICATE_CAP=3`, el jugador puede llenar el mazo con solo ~7 cartas distintas. Con `DUPLICATE_CAP=2` necesita al menos 10 cartas distintas para llegar al cap. Cambiar uno sin revisar el otro altera la diversidad mínima del mazo.
- `DECK_MIN` no puede ser mayor que `HAND_SIZE` del Card System (4). Cambiar `HAND_SIZE` en el Card System exige revisar este knob.

**Valores no controlados por este sistema** (definidos por sus sistemas dueños):
- `starting_deck_size` = 10 — Card System
- `HAND_SIZE` = 4 — Card System

## Visual/Audio Requirements

### Feedback por acción

| Acción | Visual | Audio |
|---|---|---|
| **Añadir carta** | La carta elegida vuela desde el panel de oferta hacia un mazo animado en esquina; las no elegidas se atenúan. | SFX: whoosh de carta + flip satisfactorio. |
| **Mejorar carta** | La carta seleccionada pulsa con un glow; antes/después se muestra en el panel comparativo antes de confirmar. Al confirmar, la carta transforma in-place con una animación breve (~0.3s). | SFX: shimmer o "upgrade" tonal — diferente al flip de añadir, más resonante. |
| **Eliminar carta** | La carta se desvanece con una animación de desintegración o quemado (~0.4s). El diálogo de confirmación usa un color acento de advertencia. | SFX: papel rasgado o quema suave — satisfactorio, no angustiante. |
| **Ganar reliquia** | La placa de reliquia elegida cae al inventario con un destello breve. Si `trigger: on_run_start`, el efecto se visualiza inmediatamente. | SFX: tono especial distintivo — más "mágico" o "raro" que las cartas, marca que las reliquias son diferentes. |
| **Bloqueo de opción** | El panel muestra el motivo del bloqueo (ej. "Mazo lleno 20/20") en texto secundario. Color atenuado, sin hover interactivo. | Sin SFX en hover de opciones bloqueadas. |

### Tono visual
Consistente con el art bible: caótico-cotidiano, absurdo burocrático. El reward screen es el momento de "respiro" — el diseño visual debe comunicar pausa y deliberación, no urgencia. Sin timer visible, sin elementos que pulsen o llamen la atención salvo las opciones disponibles.

📌 **Asset Spec** — Visual/Audio requirements definidos. Después de aprobar el art bible, ejecutar `/asset-spec system:deck-building-system` para producir specs de assets individuales.

## UI Requirements

### Layout del reward screen

- **4 paneles de opciones** dispuestos en grid 2×2 o fila horizontal (decisión de UX). Cada panel muestra: título de categoría, contenido (cartas u oferta de reliquias), y estado (disponible / bloqueado + motivo).
- El estado inicial muestra los 4 paneles. El jugador selecciona un panel para entrar a su sub-pantalla.
- En sub-pantallas: botón "Volver" visible que regresa a `OPTION_SELECTION` (excepto durante `REWARD_EXECUTING`).

### Sub-pantalla: Añadir carta
- Presenta 1–3 cartas del eligible_pool (layout adapta si hay menos de 3).
- Cada carta muestra nombre, costo, efectos resumidos. Click → selecciona y ejecuta (sin confirmación adicional).

### Sub-pantalla: Mejorar carta
- Lista scrolleable del mazo completo. Cartas ya mejoradas visibles con indicador pero no seleccionables.
- Al seleccionar una carta elegible: panel comparativo (izquierda = estado actual, derecha = `upgraded_effects`). Botones: "Mejorar" y "Cancelar" (vuelve a la lista).

### Sub-pantalla: Eliminar carta
- Lista scrolleable del mazo completo. Todas las cartas son seleccionables.
- Al seleccionar: diálogo de confirmación explícita ("¿Eliminar [nombre]? Esta acción es permanente."). Botones: "Confirmar eliminación" y "Cancelar" (vuelve a la lista).

### Sub-pantalla: Ganar reliquia
- Presenta 1–2 placas de reliquia. Si solo hay 1 disponible, el segundo slot visual está vacío/ausente.
- Click en una reliquia → ejecuta inmediatamente (sin confirmación adicional).

### Indicadores durante el reward
- Contador de mazo ("X/20 cartas") visible en pantalla durante toda la duración.
- Se actualiza inmediatamente después de ejecutar la acción en `REWARD_EXECUTING`.

📌 **UX Flag — Deck Building System**: Este sistema tiene UI requirements. En Pre-Production, ejecutar `/ux-design` para crear un UX spec de la pantalla de reward antes de escribir epics. Las stories de UI deben citar `design/ux/reward-screen.md`, no este GDD directamente.

## Acceptance Criteria

**AC-1**: DADO un encuentro regular completado con victoria, CUANDO el jugador ingresa al reward screen, ENTONCES se presentan las 4 categorías de opciones con su estado (disponible o bloqueado con indicador textual del motivo).

**AC-2**: DADO un mazo de 20 cartas (DECK_CAP), CUANDO el reward screen inicializa, ENTONCES la opción "Añadir carta" aparece bloqueada con indicador "Mazo lleno (20/20)" y las otras 3 opciones siguen disponibles.

**AC-3**: DADO un mazo de 4 cartas (DECK_MIN), CUANDO el reward screen inicializa, ENTONCES la opción "Eliminar carta" aparece bloqueada con indicador textual del motivo y las otras 3 opciones siguen disponibles.

**AC-4**: DADO que el jugador tiene 2 copias de CartaX en el mazo, CUANDO accede a "Añadir carta", ENTONCES CartaX no aparece en ninguna de las cartas ofrecidas.

**AC-5**: DADO que el jugador está en la oferta de "Añadir carta" y elige CartaX, CUANDO la acción se ejecuta, ENTONCES CartaX aparece en el mazo del jugador, `deck_size` aumenta en 1, y la carta pasa al `_discard_pile` (disponible desde el primer turno del próximo encuentro).

**AC-6**: DADO que el jugador tiene CartaY (base, upgradeable=true, upgraded=false) y elige mejorarla, CUANDO confirma, ENTONCES CartaY muta in-place a `upgraded_effects`, se marca como mejorada, y no aparece más como opción de mejora en rewards posteriores.

**AC-7**: DADO que el jugador tiene 2 copias de CartaY (base) en el mazo, CUANDO accede a la pantalla de mejora, ENTONCES aparecen 2 entradas separadas para CartaY, cada una mejorable independientemente en rewards distintos.

**AC-8**: DADO que el jugador elige "Eliminar carta" y selecciona CartaZ, CUANDO el sistema muestra el diálogo de confirmación y el jugador confirma, ENTONCES CartaZ se elimina permanentemente del mazo y `deck_size` disminuye en 1.

**AC-9**: DADO que el jugador elige "Eliminar carta" y selecciona CartaZ, CUANDO el sistema muestra el diálogo de confirmación y el jugador cancela, ENTONCES CartaZ permanece en el mazo y el sistema vuelve a la lista de selección de cartas.

**AC-10a**: DADO que el jugador está en CARD_ADD_SELECTION, CARD_UPGRADE_SELECTION o RELIC_SELECTION y no ha confirmado ninguna acción, CUANDO presiona "Volver", ENTONCES regresa a OPTION_SELECTION sin ejecutar ninguna acción y el mazo permanece sin cambios.

**AC-10b**: DADO que el jugador está en CARD_REMOVE_SELECTION con el diálogo de confirmación activo, CUANDO presiona "Cancelar" en ese diálogo, ENTONCES el sistema regresa a la lista de selección de cartas (no a OPTION_SELECTION). Desde la lista de cartas sin selección activa, presionar "Volver" regresa a OPTION_SELECTION.

**AC-11** *(test automatizado)*: DADO que el estado entra a REWARD_EXECUTING, CUANDO se intentan emitir input events de UI durante el estado, ENTONCES ningún input event produce cambios de estado de juego hasta que REWARD_EXECUTING concluye. Verificable via unit test en `tests/unit/deck_building/`.

**AC-12**: DADO que el pool de reliquias tiene exactamente 1 reliquia disponible, CUANDO el jugador accede a "Ganar reliquia", ENTONCES se presenta 1 sola placa de reliquia (el segundo slot visual está vacío o ausente).

**AC-13**: DADO un mazo de deck_size=5 donde el jugador elimina una carta en el reward actual, CUANDO el siguiente reward inicializa, ENTONCES la opción "Eliminar carta" aparece bloqueada (deck_size = 4 = DECK_MIN).

**AC-14** *(mutual exclusion)*: DADO que el jugador completó una acción de reward (eligió y confirmó cualquier categoría), CUANDO el sistema entra a REWARD_EXECUTING, ENTONCES no es posible seleccionar una segunda categoría de reward — el sistema avanza directamente a REWARD_COMPLETE sin volver a OPTION_SELECTION.

**AC-15** *(no re-sampleo)*: DADO que el reward screen generó una oferta de cartas y el estado se guarda en OPTION_SELECTION, CUANDO el estado se recarga (ej. recarga de página web), ENTONCES las cartas ofrecidas son idénticas a las generadas antes de la recarga.

**AC-16** *(fallback 4 bloqueadas)*: DADO un estado donde las cuatro opciones de reward están bloqueadas simultáneamente, CUANDO el reward screen inicializa, ENTONCES el sistema avanza automáticamente al NodeMap sin input del jugador Y registra un mensaje de error en el log (no genera crash).

*Nota: La verificación de `copies_in_deck()` por `card_id` vs. referencia de objeto (Fórmula 3) se cubre con unit test en `tests/unit/deck_building/test_duplicate_cap.gd`, no como AC de QA manual.*

## Open Questions

| # | Pregunta | Owner | Estado |
|---|---|---|---|
| OQ-1 | ¿Las 4 opciones siempre visibles (con estado bloqueado) o se ocultan las no disponibles? | UX/Game Design | Pendiente |
| OQ-2 | ¿El jugador puede previsualizar las estadísticas completas de las cartas ofrecidas antes de elegir? | Game Design | Pendiente |
| OQ-3 | ¿El reward después del jefe (si existe) tiene las mismas 4 opciones o un reward especial? | Game Design | Pendiente — depende del Node Map System |
| OQ-4 | ¿Existen eventos de nodo que otorguen rewards de deck building fuera de la secuencia post-combate? | Game Design | Pendiente — depende del Node Map System |
