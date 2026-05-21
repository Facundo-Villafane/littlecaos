---
sidebar_position: 13
title: Sistema de Node Map
description: La estructura del run — el mapa lineal con ramificaciones que encadena encuentros en un arco de 10–20 minutos.
---

# Node Map System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-21
> **Implements Pillar**: Rejugabilidad por Combinaciones · Decisiones Rápidas

## Overview

El Node Map System genera, muestra y navega el mapa del run: la cadena de encuentros que define el arco de 10–20 minutos de cada partida. Técnicamente, el sistema construye al inicio de cada run un mapa lineal con ramificaciones — nodos dispuestos en filas, con puntos de bifurcación donde el jugador elige entre 2 caminos — y asigna tipo y contenido (enemy_id, situation_id) a cada nodo. Gestiona la posición actual del jugador en el mapa, presenta los nodos disponibles después de cada encuentro, recibe la selección del jugador, y proporciona al Scene Manager el payload de inicialización `{enemy_id, situation_id, is_boss_encounter}` para activar el próximo encuentro. El Node Map no define los encuentros — llama al Combat System con los datos correctos y sabe cuándo el run terminó (boss derrotado) o cuándo presentar una alternativa no-combate (rest, evento).

Para el jugador, el Node Map es la pantalla de anticipación entre encuentros: la única vez que el arco del run es visible. El jugador ve dónde está, ve cuántos nodos quedan, y cuando hay bifurcación, ve qué tipo de nodo ofrece cada camino — sin ver el contenido exacto. ¿Tomás el combate difícil ahora porque el mazo que armaste está en su pico, o el rest porque llegaste con poco HP? Esa decisión es tan estratégica como cualquier carta jugada en el encuentro anterior. El boss siempre está al final del mapa — el jugador sabe exactamente qué tan lejos está.

## Player Fantasy

El encuentro terminó. Sobreviviste — no porque hayas ejecutado el plan perfecto, sino porque improvisaste algo ridículo en el momento justo. El mapa aparece. No hay música de victoria, no hay épica. Hay un mapa garabateado con flechas y nombres burocráticos, y dos opciones en el próximo paso: "Confrontación Pendiente" o "Incidente Sin Clasificar".

Acá empieza la mejor parte del run: vos elegís el próximo desastre.

No es una elección táctica abstracta. Es una pregunta de gusto: ¿qué tipo de lío querés protagonizar ahora? El combate te da un enemigo que tiene un bit y lo va a defender hasta el final — el material perfecto para el mazo de falso abogado que estás armando. El evento puede ser cualquier cosa: un acuerdo verbal con consecuencias imprevistas, un formulario que resultó tener letra chica, una situación que nadie sabe cómo resolver y vos menos que nadie. Ambas son buenas historias. Solo podés elegir una.

El placer del Node Map no es "elegir la ruta óptima para llegar al boss con más HP" — es el momento en que decidís qué historia querés contar. El boss está siempre visible al final del mapa, esperando. No hay sorpresa ahí. La sorpresa es cómo vas a llegar: si en línea recta o dando el rodeo más innecesario del run. En Caos en Mano, el rodeo casi siempre es la mejor historia.

Si el sistema falla en entregar esto, el mapa se convierte en una pantalla de carga glorificada: clickeás el próximo nodo sin leer el tipo, sin importarte la bifurcación, esperando que el encuentro sea la parte interesante. Cuando eso pasa, el mapa falla en hacer su único trabajo — hacer que el viaje importe tanto como el destino.

## Detailed Design

### Core Rules

**1. Estructura del mapa del run**

El mapa de cada run tiene 8 nodos organizados en 6 filas. El jugador visita exactamente 1 nodo por fila (6 nodos por run). Las filas 2 y 4 tienen bifurcación de 2 opciones — el jugador elige una; la otra no se visita.

| Fila | Nodos | Tipo fijo | Lógica de bifurcación |
|---|---|---|---|
| 1 | 1 | COMBAT | Siempre primer encuentro — enemigo Easy |
| 2 | 2 | COMBAT ó MARKET | Exactamente una opción de cada tipo; lado aleatorio |
| 3 | 1 | EVENT | Evento narrativo siempre presente |
| 4 | 2 | COMBAT ó COMBAT | Un enemigo Medium, un enemigo Hard (Ogro); lado aleatorio |
| 5 | 1 | MARKET | Siempre, antes del boss |
| 6 | 1 | BOSS | Siempre el encuentro final |

El mapa completo se genera una sola vez al inicio del run usando una seed determinística. Mismo seed → mismo mapa (necesario para el Save System).

---

**2. Navegación**

- El jugador siempre avanza hacia la siguiente fila — no puede volver a un nodo anterior.
- Cuando el nodo de la fila N tiene un único nodo siguiente (filas 1, 3, 5 → 6): el jugador lo selecciona directamente.
- Cuando el nodo de la fila N lleva a una bifurcación (filas 2 y 4): el jugador ve dos opciones con tipo visible pero contenido oculto (no sabe qué enemigo específico ni qué situación le espera). Elige una.
- La navegación se activa cuando el jugador llega al mapa después de un encuentro (`transition_completed(NodeMap)`).

---

**3. Nodo COMBAT — reglas de contenido**

| Fila | Tier del enemigo | Pool | Situación activa |
|---|---|---|---|
| 1 | Easy | [el_caballero_confiado, el_burocrata] — 50/50 aleatorio | Aleatoria del pool MVP, sin repetición en el run |
| 2 (si COMBAT) | Medium | [la_bruja_indignada, el_guardia_timido, el_juglar_perturbado] | Aleatoria sin repetición |
| 4 COMBAT-A | Medium | Enemigo Medium no usado en fila 2 | Aleatoria sin repetición |
| 4 COMBAT-B | Hard | el_ogro_diplomatico (fijo — único Hard en MVP) | Aleatoria sin repetición |

**Restricciones de asignación:**
- No hay repetición de enemigo en el mismo run (pool sampleado sin reposición por tier).
- El Ogro Diplomático aparece únicamente en el slot Combat-B de fila 4.
- El boss no tiene Situación activa — la complejidad de sus dos fases es suficiente.
- Las situaciones se samplea sin reposición al inicio del run; las asignadas a nodos no visitados no se usan.

---

**4. Nodo MARKET — reglas**

El Market es una tienda de run donde el jugador gasta oro acumulado en encuentros. No hay límite de compras por visita — el jugador puede comprar tantos ítems como su oro le permita.

**Sistema de oro:**
- El oro es un entero acumulado durante el run. Se gana derrotando enemigos en nodos COMBAT.
- Drop base por tier (tuning knob): Easy ≈ 20 oro, Medium ≈ 30–35 oro, Hard ≈ 50 oro.
- El oro no persiste entre runs.
- **Pendiente:** El Combat System GDD debe registrar el drop de oro de cada enemigo. Ver Open Questions.

**Inventario del Market:**

| Ítem | Cantidad ofrecida | Precio base |
|---|---|---|
| HP pequeño (15 HP) | 1 | 20 oro (cappado en HP_MAX=60) |
| HP grande (30 HP) | 1 | 35 oro (cappado en HP_MAX=60) |
| Carta (del pool MVP) | 3 | 60 oro c/u |
| Reliquia | 1–2 | 100 oro c/u |

**Reglas del inventario:**
- El inventario se genera una sola vez en la generación del run (determinístico con la seed).
- Las cartas ofrecidas aplican el filtro de duplicados del Deck Building System (`copies_in_deck < DUPLICATE_CAP`).
- Si el jugador no tiene oro suficiente para ningún ítem, el Market muestra la oferta sin acción disponible y el jugador sale sin comprar.
- El jugador puede salir del Market sin comprar nada.

---

**5. Nodo EVENT — reglas**

Los eventos son encuentros narrativos: texto de setup + 2 opciones + consecuencia revelada después de elegir.

**Estructura de un evento:**
1. Texto de setup (2–4 oraciones en tono burocrático-absurdo)
2. Opción A: acción (4–8 palabras, sin revelar consecuencia)
3. Opción B: acción alternativa (4–8 palabras, sin revelar consecuencia)
4. Jugador elige
5. Consecuencia revelada: texto narrativo + efecto mecánico

**Consecuencias posibles:** ganar/perder HP (5–15), ganar carta, ganar reliquia, aplicar estado (Vergüenza 1-2, Sospechoso 1). Nunca ambas opciones tienen consecuencias exclusivamente negativas — siempre hay al menos una opción segura.

**Mini-combate (cuando aplica):** Si una opción incluye mini-combate, se telegrafía antes de elegir. El mini-combate usa el Combat System completo contra un enemigo Easy único, sin Situación activa, sin reward screen. Victoria → consecuencia de éxito del evento. Derrota → consecuencia de fallo (si existe) o –10 HP fijo.

---

**6. Generación del mapa (algoritmo)**

Al inicio del run, el mapa se genera en 4 fases con `RandomNumberGenerator` seeded con la seed del run:

1. **Grafo de conectividad**: construir los 8 nodos con `node_id`, `row`, `col`, y `next_node_ids`. La topología es fija.
2. **Tipos de nodo**: filas 1/3/5/6 tienen tipos fijos. Para las bifurcaciones (filas 2 y 4): el lado izquierdo/derecho de cada tipo se asigna aleatoriamente.
3. **Contenido**: asignar `enemy_id`, `situation_id`, e inventario de Market a cada nodo según su tipo.
4. **Estado inicial**: todos los nodos en `LOCKED` excepto fila 1 (`AVAILABLE`).

---

### States and Transitions

| Estado | Activado por | Jugador puede | Termina cuando |
|---|---|---|---|
| `INACTIVE` | — | Nada | `SceneManager.transition_completed(NodeMap)` |
| `MAP_DISPLAY` | `transition_completed(NodeMap)` | Ver mapa completo, leer tipos de nodos disponibles, seleccionar próximo nodo | Clic en nodo AVAILABLE → `TRANSITION_OUT` (si único) o `NODE_SELECTION` (si bifurcación) |
| `NODE_SELECTION` | Nodo actual lleva a 2 opciones | Comparar 2 opciones (tipo visible, contenido oculto), confirmar o volver | Confirmación → `TRANSITION_OUT`; cancelar → `MAP_DISPLAY` |
| `TRANSITION_OUT` | Confirmación de nodo | Nada (input bloqueado) | `SceneManager.request_transition()` enviado; nodo → `SELECTED` |

**Ciclo del estado de cada nodo** (independiente del MapScreenState):
`LOCKED → AVAILABLE → SELECTED (en vuelo) → VISITED`

**Diagrama:**
```
INACTIVE
  ↓ transition_completed(NodeMap)
MAP_DISPLAY ──── [nodo único AVAILABLE] ───────────────────────────────── TRANSITION_OUT → INACTIVE
     │                                                                              ↑
     └── [bifurcación AVAILABLE] ── NODE_SELECTION ─── [confirmar] ────────────────┘
                                         │
                                         └── [cancelar] ── MAP_DISPLAY
```

---

### Interactions with Other Systems

| Sistema | Recibe del Node Map | Provee al Node Map |
|---|---|---|
| **Scene Management System** | `request_transition()` con payload `{enemy_id, situation_id, is_boss_encounter}` | `transition_completed(NodeMap)` para activar pantalla del mapa |
| **Combat System** | Payload de inicialización del encuentro | Gold drop al finalizar encuentro (`gold_earned: int`) |
| **Player Character System** | — | HP actual (para display y cálculo de poción cappeada) |
| **Card System** | `add_card(CardData)` al comprar carta en Market | `get_deck()` para filtro de duplicados en inventario |
| **Relic System** | `RelicManager.add_relic(id)` al comprar reliquia en Market | `get_available_relics(N)` para inventario de reliquias |
| **Save System** | Seed del run + estado de nodos (VISITED/AVAILABLE) | — |
| **UI layer** | Señales: `map_generated`, `node_selected`, `map_updated` | Input del jugador |

## Formulas

### Fórmula 1: Gold acumulado al llegar al Market

`player_gold = Σ(gold_drop(enemy_tier_n)) para cada nodo COMBAT visitado antes de este Market`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `gold_drop(enemy_tier)` | int const por tier | 15–55 | Oro que dropea un enemigo derrotado según su tier. Tuning knob. |
| `player_gold` | int | 0–∞ | Oro total acumulado en el run hasta este punto. Sin techo duro. |

**Valores base por tier (tuning knob):**
- `GOLD_DROP_EASY = 20`
- `GOLD_DROP_MEDIUM = 32`
- `GOLD_DROP_HARD = 50`

**Rango de salida bajo escenarios MVP:**
- 1 combate antes del Market de fila 2 (jugador tomó Market en fila 2, solo fila 1): `20 oro`
- 3 combates antes del Market de fila 5, ruta fácil: `20 + 32 + 32 = 84 oro`
- 3 combates antes del Market de fila 5, ruta difícil: `20 + 32 + 50 = 102 oro`

**Ejemplo:** Jugador que tomó Combat-fila2 (Bruja Indignada, medium) y Combat-B fila4 (Ogro) llega a Market fila5 con `20 + 32 + 50 = 102 oro`.

---

### Fórmula 2: Disponibilidad de ítems en el Market

`can_purchase(item) = (player_gold >= item.price) AND purchase_preconditions(item)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `player_gold` | int | 0–∞ | Oro disponible actual del jugador |
| `item.price` | int const | 20–100 | Precio del ítem (HP_SMALL=20, HP_LARGE=35, CARD=60, RELIC=100) |
| `purchase_preconditions(item)` | bool | — | Condiciones adicionales según tipo de ítem |

**Precondiciones por tipo:**
| Ítem | Precondición |
|---|---|
| HP pequeño (15 HP) | `player_hp < HP_MAX` |
| HP grande (30 HP) | `player_hp < HP_MAX` |
| Carta | `deck_size < DECK_CAP (20)` AND `copies_in_deck(carta) < DUPLICATE_CAP (2)` |
| Reliquia | `RelicManager.get_available_relics(1).size() >= 1` |

**Rango de salida:** bool. Si `false`, el ítem muestra precio y motivo de bloqueo pero no es seleccionable.

**Ejemplo:** Jugador con 80 oro y HP 60/60. Pociones bloqueadas (HP lleno). Carta: `80 >= 60` → disponible. Tras comprar carta (20 oro restantes), solo la poción pequeña cumple el precio — pero sigue bloqueada por HP lleno.

---

### Fórmula 3: HP post-compra de poción

`hp_after = min(HP_MAX, hp_current + healing_amount)`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `hp_current` | int | 1–59 | HP actual (precondición garantiza `< HP_MAX` al comprar) |
| `healing_amount` | int const | 15 ó 30 | Curación de la poción pequeña o grande |
| `HP_MAX` | int const | 60 | Valor del registro: `hp_base` |

**Rango de salida:** int en [16, 60].

**Ejemplo:** `hp_current=35`, `healing_amount=30` → `min(60, 65) = 60`.

## Edge Cases

### Sistema de Oro y Market

**Si `player_gold = 0` al entrar al Market**: todos los ítems se muestran con precio pero sin acción disponible. El jugador puede leer la oferta y salir. Sin pantalla de error.

**Si el jugador sale del Market de fila 2 sin comprar nada**: el oro acumulado persiste intacto al Market de fila 5. El oro no se descuenta ni resetea por visitar un Market sin comprar.

**Si `player_hp == HP_MAX` al comprar HP_LARGE y el resultado se cappea**: la UI muestra el delta real antes de confirmar (ej. "+10 HP" en lugar de "+30 HP"). La compra no se bloquea aunque sea subóptima — el jugador tiene agencia.

**Si todas las opciones del Market están bloqueadas simultáneamente** (HP_MAX + deck lleno + cartas al cap de duplicados + pool de reliquias vacío): el Market muestra la oferta con todos los ítems en estado "no disponible" y motivo de bloqueo. El jugador sale sin comprar. Sin pantalla especial.

**Si `eligible_pool` para cartas tiene menos de 3 ítems**: la oferta muestra 1 o 2 cartas. El slot vacío no aparece como botón.

**Si hay 1 sola reliquia en el pool disponible**: el Market ofrece 1 placa. Si el jugador la compra, el slot de reliquia se bloquea por pool vacío.

### Mini-combate en Eventos

**Si el HP del jugador llega a 0 durante un mini-combate de Event**: el HP se fuerza a 1 mínimo, el mini-combate termina como derrota, se aplica la consecuencia de fallo del evento (o –10 HP si no hay consecuencia definida, también cappeada a mínimo 1 HP). El run no termina.

**Si un Event no define consecuencia de fallo y el jugador pierde el mini-combate**: se aplica –10 HP (HP mínimo 1). El run continúa.

**Si el jugador tiene reliquias activas durante un mini-combate**: las reliquias se activan normalmente. El mini-combate usa el Combat System completo.

**Si el jugador gana el mini-combate**: la consecuencia de éxito se aplica sobre el estado real del jugador al terminar (HP reducido, estados alterados activos). Sin reset al estado pre-combate.

### Generación del Mapa

**Si el pool de situaciones tiene menos de 4 entradas**: la generación del mapa falla antes de asignar contenido. Log de error crítico.

**Al asignar `situation_id` al nodo BOSS**: siempre se setea `situation_id = ""` explícitamente, independientemente del algoritmo general de asignación.

**Al asignar el enemigo Medium de fila 4-A**: el generador excluye el enemigo Medium asignado en fila 2 (si fila 2 fue COMBAT). Si fila 2 fue MARKET, el pool completo de Medium está disponible.

**Si la situación fue asignada a un nodo no visitado**: se descarta silenciosamente. No vuelve al pool del run.

**Si la seed del run es null**: el generador usa una seed aleatoria como fallback y loggea un warning.

### Navegación y Estados

**Si el jugador hace doble click en un nodo AVAILABLE antes del primer procesamiento**: el segundo click se ignora. Una vez en `TRANSITION_OUT`, el input está bloqueado.

**Si el jugador cancela durante `NODE_SELECTION`**: el sistema vuelve a `MAP_DISPLAY` sin modificar ningún estado de nodo.

**Si el juego se cierra con un nodo en estado `SELECTED`**: al reanudar, el Save System trata `SELECTED` como el nodo activo del próximo encuentro pendiente. Ver Save System GDD para la especificación de serialización.

**Si `transition_completed(NodeMap)` llega sin nodos en `SELECTED`** (inicio del run): el sistema entra a `MAP_DISPLAY` con fila 1 en `AVAILABLE`. No es un error.

## Dependencies

| Sistema | Tipo | Interfaz | Dirección |
|---|---|---|---|
| **Scene Management System** | Hard | Recibe: `request_transition(GameState)` con payload `{enemy_id, situation_id, is_boss_encounter}`; emite: `transition_completed(NodeMap)` | Bidireccional |
| **Combat System** | Hard | Recibe: payload del encuentro; provee: `gold_earned: int` al resolver victoria | Bidireccional |
| **Player Character System** | Hard | Lee: `hp_current`, `HP_MAX` para display y precondiciones del Market | Upstream |
| **Card System** | Hard | `get_deck() → Array[CardData]`; `add_card(CardData)` al comprar carta en Market | Upstream |
| **Relic System** | Hard | `get_available_relics(N) → Array[RelicData]`; `add_relic(id)` al comprar reliquia | Upstream |
| **Save System** | Soft | Provee: seed del run al cargar; recibe: seed + estado de cada nodo para persistir el run | Bidireccional |
| **Data Configuration System** | Hard | `DataLoader.get_all_cards()`, `DataLoader.get_enemy(id)`, `DataLoader.get_situation(id)` para generación del mapa | Upstream |
| **UI layer** | Hard | Señales emitidas: `map_generated`, `node_selected`, `map_updated`; recibe: input del jugador | Bidireccional |

**Nota:** El Deck Building System NO es una dependencia directa. El jugador llega al Node Map después del Deck Building System, pero la comunicación es mediada exclusivamente por SceneManager.

**Actualización pendiente al Combat System GDD:** El Combat System debe registrar los drops de oro (`gold_earned`) en su sección de Detailed Design y documentar la señal de victoria actualizada. Ver Open Questions.

## Tuning Knobs

| Knob | Valor MVP | Rango seguro | Qué rompe si va muy alto | Qué rompe si va muy bajo |
|---|---|---|---|---|
| `GOLD_DROP_EASY` | 20 | 10–30 | El jugador llega al Market con oro excesivo; ítems trivialmente asequibles | El jugador nunca tiene suficiente oro para una carta; el Market es decorativo |
| `GOLD_DROP_MEDIUM` | 32 | 20–45 | — | — |
| `GOLD_DROP_HARD` | 50 | 35–65 | El Ogro se vuelve rentable solo por el oro; tomar la ruta difícil es dominante | Penaliza la ruta difícil sin compensación adecuada |
| `MARKET_PRICE_HP_SMALL` | 20 | 10–35 | HP barata → boss pierde dificultad | Nadie puede permitirse la curación más barata |
| `MARKET_PRICE_HP_LARGE` | 35 | 25–50 | — | Si HP_LARGE ≤ HP_SMALL × 2, el SMALL nunca se elige |
| `MARKET_HEAL_SMALL` | 15 | 10–20 | Si ≥ 20, SMALL y LARGE se fusionan en valor | Curación menor que el daño promedio de un turno de boss; no vale la pena comprarla |
| `MARKET_HEAL_LARGE` | 30 | 20–40 | Si supera 40, casi siempre restaura HP completo | Si ≤ HEAL_SMALL, uno de los dos pierde sentido |
| `MARKET_PRICE_CARD` | 60 | 40–80 | Cartas baratas → identidad del mazo se construye en el Market, no en rewards de combate | A 80+, imposible comprar carta en ruta de Market fila 2 (solo 20 oro disponibles) |
| `MARKET_PRICE_RELIC` | 100 | 70–120 | Reliquias muy baratas — el jugador siempre tiene una adicional | A 120+, solo alcanzable tomando todos los combates difíciles |

**Interacciones entre knobs:**
- `GOLD_DROP_*` y `MARKET_PRICE_*` se balancean mutuamente. Objetivo: ruta típica (3 combates mix) = ~84 oro en Market fila 5, suficiente para elegir una carta o una poción pero no una reliquia sin esfuerzo adicional.
- Ratio eficiencia HP: HP_LARGE (30hp/35o = 0.86 hp/o) debe ser mejor que HP_SMALL (15hp/20o = 0.75 hp/o) para que HP_LARGE sea la opción preferida cuando el jugador tiene el oro.

**Valores estructurales (no ajustar sin redesign del mapa):**
- `MAP_ROW_COUNT = 6` — cambiar requiere rediseñar la topología completa.
- El Ogro Diplomático en fila 4 COMBAT-B es fijo — moverlo requiere re-evaluar la curva de dificultad.

## Visual/Audio Requirements

### Pantalla del mapa

| Elemento | Visual | Audio |
|---|---|---|
| **Nodo AVAILABLE** | Pulsación suave o highlight de disponibilidad | SFX: none — el mapa es el momento de respiro |
| **Nodo VISITED** | Atenuado con marca de completado | — |
| **Nodo LOCKED** | Gris, sin interactividad | — |
| **Hover sobre nodo disponible** | Highlight ligero; tooltip con tipo de nodo | SFX: hover suave |
| **Confirmar selección** | Efecto de "activación" en el nodo seleccionado | SFX: click satisfactorio, distinto por tipo de nodo |
| **Transición al encuentro** | Fade out del mapa | Transición al tema del encounter |

### Pantalla del Market

| Elemento | Visual | Audio |
|---|---|---|
| **Ítem disponible** | Color normal con precio visible | — |
| **Ítem bloqueado** | Atenuado, motivo de bloqueo en texto secundario | — |
| **Compra confirmada** | Animación de adquisición | SFX: monedas o registro de caja (tono burocrático-absurdo) |
| **Oro insuficiente** | Flash breve en el precio | SFX: rechazo suave |

### Tono visual
El mapa comunica "cuaderno de bitácora o agenda con mapas garabateados". El Market usa precios excesivamente formales para transacciones absurdas. Consistente con el art bible: burocrático-cotidiano.

📌 **Asset Spec** — Visual/Audio requirements definidos. Ejecutar `/asset-spec system:node-map-system` después del art bible.

## UI Requirements

### Pantalla del mapa

- **Visualización del grafo**: 6 filas verticales u horizontales. Nodos con iconos por tipo: COMBAT = espadas, MARKET = moneda, EVENT = signo de interrogación, BOSS = indicador de final.
- **Conexiones entre nodos**: líneas que unen filas. Bifurcaciones muestran dos opciones lado a lado.
- **Estado del nodo visible**: indicador superpuesto (AVAILABLE = resaltado; VISITED = marca; LOCKED = gris).
- **Contenido de nodo oculto**: el jugador ve el tipo pero NO el `enemy_id` ni `situation_id` específicos.
- **Contadores**: oro (`player_gold`) y HP del jugador siempre visibles en el mapa.

### Pantalla NODE_SELECTION (bifurcación)

- Dos nodos lado a lado, tipo visible.
- Botón "Volver" — regresa a MAP_DISPLAY sin elegir. El botón desaparece al entrar a TRANSITION_OUT.

### Pantalla Market

- Lista de ítems con precio, descripción o delta real de HP (para pociones: delta real, no nominal).
- Botón de compra por ítem; botón "Salir" siempre visible.
- Contador de oro actualizado en tiempo real post-compra.
- Ítems bloqueados muestran el motivo ("HP máximo", "Mazo lleno", "Sin reliquias disponibles").

### Pantalla Event

- Texto de setup (2–4 oraciones en tono burocrático-absurdo).
- 2 botones de opción (label de acción, sin revelar consecuencia).
- Excepción: si una opción contiene mini-combate, telegrafiar en el label ("Opción que inicia un combate").
- Tras elegir: reveal de consecuencia como texto + efecto aplicado.

📌 **UX Flag — Node Map System**: Este sistema tiene UI requirements para múltiples pantallas. En Pre-Production, ejecutar `/ux-design` para: `design/ux/node-map.md`, `design/ux/market-screen.md`, `design/ux/event-screen.md`.

## Acceptance Criteria

**AC-1**: DADO el inicio de un run, CUANDO el mapa se genera, ENTONCES existen exactamente 6 filas con los tipos correctos: COMBAT (f1), COMBAT-o-MARKET (f2), EVENT (f3), COMBAT×2 (f4), MARKET (f5), BOSS (f6).

**AC-2**: DADO que el mapa se genera, CUANDO el jugador ve la bifurcación de fila 2, ENTONCES exactamente una opción es COMBAT y exactamente una es MARKET.

**AC-3**: DADO que el mapa se genera, CUANDO el jugador entra al encuentro de fila 1, ENTONCES el `enemy_id` es uno de: [el_caballero_confiado, el_burocrata].

**AC-4**: DADO que el mapa se genera, CUANDO el jugador elige el nodo Combat-B de fila 4, ENTONCES `enemy_id == "el_ogro_diplomatico"`.

**AC-5**: DADO que el jugador derrota a un enemigo Hard (Ogro Diplomático) en un combate, CUANDO llega al Node Map, ENTONCES `player_gold` aumentó en exactamente `GOLD_DROP_HARD` (50).

**AC-6**: DADO que el jugador llega al Market con `player_gold = 50` y `player_hp < 60`, CUANDO compra HP_SMALL (precio 20 oro), ENTONCES `player_gold = 30` y `player_hp = min(60, player_hp + 15)`.

**AC-7** *(UI — ADVISORY)*: DADO que el jugador tiene `player_hp = 60 (HP_MAX)`, CUANDO llega al Market, ENTONCES las opciones de poción aparecen bloqueadas con indicador de motivo visible.

**AC-8**: DADO que el jugador selecciona el nodo MARKET de fila 2 en la bifurcación, CUANDO regresa al mapa, ENTONCES el nodo COMBAT de fila 2 tiene `node_state = LOCKED` y no puede seleccionarse.

**AC-9**: DADO que el jugador está en NODE_SELECTION y presiona Cancelar, CUANDO vuelve al mapa, ENTONCES ningún nodo cambió de estado y puede volver a entrar a NODE_SELECTION.

**AC-10a**: DADO que el jugador pierde el mini-combate de un Event, CUANDO el combate termina, ENTONCES `player_hp >= 1` (el run continúa).

**AC-10b**: DADO que el jugador pierde el mini-combate de un Event sin consecuencia de fallo definida, CUANDO el combate termina, ENTONCES `player_hp = max(1, hp_pre_combate - 10)`.

**AC-11**: DADO que el mismo `run_seed` se usa para generar dos mapas, CUANDO los mapas se comparan, ENTONCES todos los `node_type`, `enemy_id` y `situation_id` son idénticos.

**AC-12**: DADO un run completado, CUANDO se inspeccionan los `enemy_id` de los nodos COMBAT visitados, ENTONCES no hay `enemy_id` repetido entre ellos.

**AC-13**: DADO que el jugador hace click en un nodo VISITED, CUANDO el sistema procesa el evento, ENTONCES no ocurre ninguna acción ni cambio de estado.

**AC-14**: DADO que el boss es derrotado, CUANDO el Combat System resuelve la victoria, ENTONCES `SceneManager.request_transition(RunVictory)` es llamado Y `request_transition(Reward)` NO es llamado en ese flujo.

**AC-15** *(no-repetición de situaciones)*: DADO que el mapa se genera, CUANDO se inspeccionan los `situation_id` de todos los nodos COMBAT visitables, ENTONCES no hay `situation_id` repetido entre ellos.

**AC-16** *(persistencia de oro)*: DADO que el jugador visita el Market de fila 2 con `player_gold = 20` y sale sin comprar, CUANDO llega al Market de fila 5 sin combates adicionales, ENTONCES `player_gold = 20`.

**AC-17** *(payload del boss)*: DADO que el mapa se genera, CUANDO se inspecciona el payload del nodo BOSS (fila 6), ENTONCES `situation_id = ""` e `is_boss_encounter = true`.

## Open Questions

| # | Pregunta | Owner | Estado |
|---|---|---|---|
| OQ-1 | El Combat System GDD necesita agregar drops de oro de los enemigos y la señal `gold_earned` a su Detailed Design. | Combat System | Pendiente — actualización cross-system |
| OQ-2 | Filas sin bifurcación (1, 3, 5): ¿el jugador debe hacer click para avanzar o el sistema auto-avanza al único nodo disponible? | UX/Game Design | Pendiente — decisión de UX |
| OQ-3 | ¿El boss encounter puede tener eventualmente una Situación activa especial en versión post-MVP? | Game Design | MVP: ninguna. Post-MVP: a evaluar |
| OQ-4 | ¿El inventario del Market de fila 2 y el de fila 5 son el mismo set de ítems generados una vez, o cada Market genera su propia oferta? | Game Design | Sin resolver — afecta la variedad percibida del run |
| OQ-5 | ¿Cuántos eventos MVP existen en el lanzamiento? La varianza percibida del run depende de la cantidad de eventos distintos. | Narrative/Game Design | Pendiente — depende del backlog de contenido |
