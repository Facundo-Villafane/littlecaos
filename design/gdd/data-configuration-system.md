---
sidebar_position: 3
title: Sistema de Configuración de Datos
description: Esquema de datos y pipeline de carga para cartas, Situaciones, enemigos, reliquias y aliados. Fundación data-driven del juego.
---

# Data Configuration System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-16
> **Last Verified**: 2026-05-16
> **Implements Pillar**: Caos Ordenado · Rejugabilidad por Combinaciones

## Summary

El Data Configuration System define el esquema y el pipeline de carga para todo el contenido del juego: cartas, Situaciones, enemigos, reliquias y aliados. Es la infraestructura que hace que Caos en Mano sea data-driven — el contenido nuevo se agrega creando archivos de datos, no escribiendo código. Todos los demás sistemas leen su contenido a través de la interfaz de acceso de este sistema.

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `None`

## Overview

El Data Configuration System es la capa de infraestructura que define cómo se almacena y carga en runtime todo el contenido del juego. Establece el esquema de cada tipo de contenido (qué campos tiene una carta, qué campos tiene una Situación), las reglas de validación (qué datos son válidos), y la interfaz de acceso (cómo los demás sistemas consultan contenido en runtime). Ningún dato de contenido está hardcodeado en el código del juego — cada carta, Situación, enemigo y reliquia existe en un archivo de datos que puede modificarse, agregarse o eliminarse sin tocar GDScript.

El sistema existe para prevenir un cuello de botella específico identificado en el concepto: si agregar una Situación nueva requiere escribir código, el ritmo de iteración de contenido colapsa. Al separar la definición de contenido de la implementación de comportamiento, una Situación nueva puede ir del diseño a ser testeable en el tiempo que tarda escribir un archivo de texto — no un commit de código.

## Player Fantasy

Este sistema es infraestructura pura — el jugador nunca lo usa directamente. Lo que siente es el resultado de que funcione bien.

El jugador siente que está jugando dentro de un universo justo y legible: cuando un enemigo anuncia su intención, eso es exactamente lo que pasa; cuando una Situación dicta una regla, esa regla se cumple igual en todas las partidas. Sobre ese piso de confianza se construye la variedad: porque cada carta, Situación y enemigo se define en datos, agregar una pieza nueva multiplica el espacio de combinaciones en vez de sumarlo linealmente. El sistema es invisible para el jugador, pero su ausencia se sentiría como un juego que hace trampa o que se repite.

## Detailed Design

### Core Rules

**1. Estructura de archivos**

```
res://
└── data/
    ├── cards/
    │   └── cards.json          # Array de todas las definiciones de cartas
    ├── situations/
    │   └── situations.json     # Array de todas las Situaciones
    ├── enemies/
    │   └── enemies.json        # Array de todos los enemigos
    ├── relics/
    │   └── relics.json         # Array de todas las reliquias
    ├── allies/
    │   └── allies.json         # Array de todos los aliados invocables
    └── config/
        └── registries.json     # Tipos de carta, status IDs, tags conocidos
```

Cada carpeta contiene un único archivo JSON con un array de todas las definiciones del tipo. Agregar contenido nuevo = agregar un objeto al array y reiniciar el juego (hot-reload es post-MVP).

---

**2. Esquemas de contenido**

**Carta (`CardData`)**

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | snake_case único | Clave primaria — coincide con el `id` en el nombre del asset de arte |
| `name` | string | ✓ | — | Nombre mostrado al jugador |
| `cost` | int | ✓ | 0–3 | Costo en Impulso |
| `type` | string | ✓ | `combate`, `social`, `absurda`, `mental`, `fisica` | Tipo primario — usado por Situaciones como filtro |
| `tags` | array[string] | — | valores del tag registry | Descriptores secundarios |
| `effects` | array[dict] | ✓ | ver vocabulario §4 | Efectos cuando se juega la carta |
| `upgradeable` | bool | ✓ | — | Si puede mejorarse en recompensa |
| `upgraded_effects` | array[dict] | cond | req si `upgradeable: true` | Efectos en versión mejorada |
| `rarity` | string | ✓ | `comun`, `raro`, `especial` | Frecuencia de aparición en recompensas |
| `flavor_text` | string | — | — | Texto narrativo, sin efecto mecánico |
| `art_key` | string | — | — | Referencia al asset sprite |

**Situación (`SituationData`)**

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | snake_case único | Clave primaria |
| `name` | string | ✓ | — | Nombre mostrado al jugador |
| `tipo` | string | ✓ | `absurda`, `peligrosa` | Governa color grading y tono (art bible §2) |
| `rule_text` | string | ✓ | ≤ 120 chars | Descripción legible de la regla — lo que ve el jugador |
| `effects` | array[dict] | ✓ | ver vocabulario §4 | Efectos mecánicos de la Situación |
| `trigger` | string | ✓ | ver triggers §3 | Cuándo se aplican los efectos |
| `applies_to` | string | ✓ | `player`, `enemy`, `both` | A quién afectan los efectos por defecto |
| `duration` | string | ✓ | `encounter` | MVP: siempre dura un encuentro |
| `flavor_text` | string | — | — | Texto narrativo |
| `art_key` | string | — | — | Asset de fondo o superposición |

**Enemigo (`EnemyData`)**

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | snake_case único | Clave primaria |
| `name` | string | ✓ | — | Nombre mostrado |
| `max_hp` | int | ✓ | 1–999 | HP máximo y HP inicial |
| `is_boss` | bool | ✓ | — | Distingue jefes de enemigos estándar |
| `intention_pool` | array[dict] | ✓ | ver sub-esquema | Lista de intenciones posibles |
| `status_immunities` | array[string] | — | status IDs conocidos | Estados que este enemigo no puede recibir |
| `flavor_text` | string | — | — | Descripción en panel de info |
| `art_key` | string | — | — | Referencia a sprite |

Sub-esquema de intención:

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | único dentro del enemigo | Identifica esta intención |
| `label` | string | ✓ | ≤ 40 chars | Texto visible para el jugador — DEBE describir el efecto exactamente |
| `icon` | string | ✓ | `attack`, `defend`, `buff`, `debuff`, `special` | Categoría de ícono en UI |
| `effects` | array[dict] | ✓ | ver vocabulario §4 | Lo que ocurre al resolver esta intención |
| `weight` | int | ✓ | 1–100 | Peso probabilístico para selección aleatoria |
| `condition` | dict | — | ver condiciones §5 | Si presente, intención solo entra al pool cuando la condición es verdadera |

**Reliquia (`RelicData`)**

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | snake_case único | Clave primaria |
| `name` | string | ✓ | — | Nombre mostrado |
| `trigger` | string | ✓ | ver triggers §3 | Evento que activa la reliquia |
| `effects` | array[dict] | ✓ | ver vocabulario §4 | Efectos cuando se activa |
| `condition` | dict | — | ver condiciones §5 | Si presente, efectos solo se aplican cuando la condición es verdadera |
| `charges` | int | — | -1 o 1–99 | Veces que puede activarse. -1 = ilimitado. Omitido = ilimitado. |
| `rarity` | string | ✓ | `comun`, `raro`, `especial` | Frecuencia en recompensas |
| `flavor_text` | string | — | — | Texto narrativo |
| `art_key` | string | — | — | Referencia a sprite |

---

**Aliado (`AllyData`)** *(agregado en retrofit 2026-05-17 — requerido por Card System GDD)*

Los aliados son entidades persistentes invocadas al campo por cartas de tipo `summon_ally`. Su ciclo de vida es gestionado por el Combat System. El `AllyData` define sus stats base (inmutables).

| Campo | Tipo | Req | Valores válidos | Descripción |
|---|---|---|---|---|
| `id` | string | ✓ | snake_case único | Clave primaria — referenciada por el efecto `summon_ally` en cartas |
| `name` | string | ✓ | — | Nombre mostrado en el campo |
| `hp` | int | ✓ | 1–999 | HP base del aliado. El Combat System crea una instancia de runtime con este valor |
| `attack_per_turn` | int | ✓ | 0–99 | Daño fijo que inflige al enemigo automáticamente cada turno |
| `flavor_text` | string | — | — | Texto narrativo |
| `art_key` | string | — | — | Referencia al sprite del aliado |

*Nota: los aliados no tienen `defense` ni reducción de daño. Reciben el daño completo directamente a su HP. Ver Card System GDD §4 para las reglas de campo.*

---

**3. Triggers (eventos que activan efectos)**

| Trigger | Cuándo dispara |
|---|---|
| `passive` | Al inicio del encuentro; el efecto persiste mientras la Situación esté activa |
| `on_encounter_start` | Una vez al comienzo del encuentro |
| `on_card_played` | Cada vez que el jugador juega una carta |
| `on_turn_start` | Al inicio de cada turno del jugador |
| `on_turn_end` | Al finalizar cada turno del jugador |
| `on_damage_dealt` | Cuando el jugador inflige daño al enemigo |
| `on_damage_received` | Cuando el jugador recibe daño |
| `on_status_applied` | Cuando se aplica cualquier estado alterado |
| `on_enemy_defeated` | Cuando el enemigo llega a 0 HP |
| `on_run_start` | Una vez al inicio del run — solo reliquias |

---

**4. Vocabulario de efectos (sistema tagueado)**

Cada efecto es un dict con un campo `type` obligatorio y parámetros específicos del tipo. El dispatcher en GDScript es un `match effect.type` — no se parsean strings de expresión.

| Tipo de efecto | Parámetros | Descripción |
|---|---|---|
| `card_cost_modifier` | `filter: string, delta: int` | Modifica el costo de maná de cartas que pasen el filtro. Delta signed (-3 a +3). |
| `lock_card_type` | `filter: string` | Impide jugar cartas que pasen el filtro durante el encuentro. |
| `bonus_damage_multiplier` | `filter: string, multiplier: float` | Multiplica el daño de cartas que pasen el filtro (1.5 = 50% más, 0.5 = 50% menos). |
| `deal_damage` | `target: string, amount: int` | Inflige daño directo. |
| `heal` | `target: string, amount: int` | Restaura HP. |
| `apply_block` | `target: string, amount: int` | Aplica bloqueo (absorbe el próximo daño). |
| `apply_status` | `target: string, status_id: string, stacks: int` | Aplica stacks del estado. |
| `remove_status` | `target: string, status_id: string` | Elimina todos los stacks del estado. |
| `draw_cards` | `target: string, count: int` | El target roba `count` cartas adicionales. |
| `modify_mana` | `target: string, delta: int` | Modifica el maná disponible del target este turno. *(renombrado de `modify_impulso` — el recurso se llama "maná" en la mecánica de dados)* |
| `summon_ally` | `ally_id: string` | Invoca al aliado con el ID indicado al campo. Card System emite `ally_summoned(AllyData)` al Combat System. El aliado debe existir en `allies.json`. Respeta el FIELD_LIMIT (3). *(agregado en retrofit 2026-05-17)* |

Valores válidos para `target`: `player`, `enemy`, `self`, `both`.

Valores válidos para `filter`: `type:<card_type>`, `tag:<tag_name>`, `all`.

**Ejemplo completo de Situación:**
```json
{
  "id": "audiencia_real",
  "name": "Audiencia Real",
  "tipo": "absurda",
  "rule_text": "Las cartas Sociales cuestan 1 menos. Las de Combate cuestan 1 más.",
  "effects": [
    { "type": "card_cost_modifier", "filter": "type:social", "delta": -1 },
    { "type": "card_cost_modifier", "filter": "type:combate", "delta": 1 }
  ],
  "trigger": "passive",
  "applies_to": "player",
  "duration": "encounter",
  "flavor_text": "La corte te observa. La reina bosteza. El bufón toma notas."
}
```

Agregar un tipo de efecto nuevo requiere: (1) una entrada en esta tabla, (2) un branch en el dispatcher de GDScript. No requiere cambios en el formato de datos.

---

**5. Condiciones (para reliquias e intenciones de enemigo)**

| Tipo de condición | Parámetros | Descripción |
|---|---|---|
| `hp_below` | `target: string, threshold: float` | True si HP del target < threshold × HP_max (ej: 0.3 = menos de 30%) |
| `hp_above` | `target: string, threshold: float` | True si HP del target > threshold × HP_max |
| `status_active` | `target: string, status_id: string` | True si el target tiene ≥ 1 stack del estado |
| `cards_played_gte` | `count: int` | True si el jugador jugó ≥ `count` cartas en el turno anterior |
| `card_type_last_played` | `type: string` | True si la última carta jugada fue del tipo indicado |

---

**6. Reglas de carga y acceso**

1. Al iniciar el juego, `DataLoader` carga todos los archivos JSON en memoria antes de mostrar cualquier pantalla.
2. Los datos cargados son **inmutables en runtime** — ningún sistema modifica los objetos `CardData`, `SituationData`, `EnemyData`, o `RelicData`. Los sistemas que necesitan estado mutable crean su propia instancia de runtime a partir del dato base.
3. Patrón: **dato base (inmutable, de `DataLoader`) → instancia de runtime (mutable, del sistema propietario)**.

**Interfaz de acceso — singleton `DataLoader`:**

| Método | Retorna | Notas |
|---|---|---|
| `get_card(id: String)` | `CardData\|null` | Null si ID desconocido; caller debe verificar |
| `get_all_cards()` | `Array[CardData]` | Pool completo |
| `get_cards_by_type(type: String)` | `Array[CardData]` | Filtrado por campo `type` |
| `get_cards_by_tag(tag: String)` | `Array[CardData]` | Cartas cuyo array `tags` contiene `tag` |
| `get_situation(id: String)` | `SituationData\|null` | |
| `get_all_situations()` | `Array[SituationData]` | |
| `get_situations_by_tipo(tipo: String)` | `Array[SituationData]` | Filtra por `absurda` o `peligrosa` |
| `get_enemy(id: String)` | `EnemyData\|null` | |
| `get_all_enemies()` | `Array[EnemyData]` | Solo `is_boss: false` |
| `get_all_bosses()` | `Array[EnemyData]` | Solo `is_boss: true` |
| `get_relic(id: String)` | `RelicData\|null` | |
| `get_all_relics()` | `Array[RelicData]` | |
| `get_relics_by_rarity(rarity: String)` | `Array[RelicData]` | |
| `get_ally(id: String)` | `AllyData\|null` | *(agregado retrofit 2026-05-17)* |
| `get_all_allies()` | `Array[AllyData]` | Pool completo de aliados invocables *(agregado retrofit 2026-05-17)* |
| `is_loaded()` | `bool` | True si startup completó sin errores fatales |
| `get_load_errors()` | `Array[String]` | Warnings y errores no-fatales |
| `get_known_tags()` | `Array[String]` | Tags registrados |
| `get_known_statuses()` | `Array[String]` | IDs de estado registrados |

**Contrato de errores:** `get_*()` con ID desconocido → `null` + `push_warning()`. Si `is_loaded()` es false al llamar cualquier accessor → `null` + `push_error()`. Error fatal durante carga → pantalla de error en dev builds; log en release.

---

**7. Registros conocidos (semilla MVP)**

Definidos en `res://data/config/registries.json`. Se cargan antes de la validación de contenido.

- **Tipos de carta:** `combate`, `social`, `absurda`, `mental`, `fisica`
- **IDs de estado:** `vergüenza`, `confianza_excesiva`, `sospechoso`, `inspirado`
- **Tags (semilla):** `mentira`, `discurso`, `golpe`, `defensa`, `trampa`, `distraccion`, `magia`, `objeto`

---

### States and Transitions

| Estado | Condición de entrada | Comportamiento |
|---|---|---|
| `Unloaded` | Estado inicial | Ningún accessor disponible |
| `Loading` | `_ready()` del singleton ejecutado | Bloquea inicio del juego; pantalla de carga si supera 0.5s |
| `Loaded` | Carga sin errores fatales | Todos los accessors disponibles; juego continúa |
| `LoadedWithErrors` | Carga completada con warnings | Accessors disponibles; warnings logueados; solo en builds de release |
| `LoadFailed` | Error fatal durante carga | Pantalla de error en dev; crash limpio en release |

---

### Interactions with Other Systems

`DataLoader` es un repositorio de lectura unidireccional. Todos los sistemas consumen de él; `DataLoader` no conoce a ningún sistema downstream.

| Sistema | Qué consulta | Cuándo |
|---|---|---|
| Card System | `get_card(id)`, `get_all_cards()`, `get_cards_by_type()` | Al construir mazos, al robar cartas |
| Situation System | `get_all_situations()`, `get_situation(id)` | Al iniciar un encuentro |
| Enemy System | `get_enemy(id)`, `get_all_enemies()`, `get_all_bosses()` | Al iniciar un encuentro |
| Relic System | `get_relic(id)`, `get_all_relics()` | Al ofrecer reliquias como recompensa y al instanciarlas |
| Deck Building System | `get_all_cards()`, `get_relics_by_rarity()` | Al generar ofertas de recompensa |
| Combat System | Lee datos ya instanciados por Card System y Enemy System | — |

**Nota — costo efectivo de carta:** El costo efectivo (base + modificadores de Situación + modificadores de estado) es un valor computado que se recalcula una vez por turno. No se consulta `DataLoader` por frame para este valor.

## Formulas

Este sistema no contiene fórmulas matemáticas. Es un repositorio de datos que carga, valida y expone contenido — no realiza cálculos. Las fórmulas relevantes para el juego (costo de carta modificado por Situación, daño, HP) son propiedad de los sistemas que consumen estos datos: Card System, Combat System, y Status Effect System.

Las reglas de validación con rangos numéricos (`cost: 0–3`, `weight: 1–100`, etc.) están documentadas en los esquemas de la Sección C y no constituyen fórmulas de diseño.

## Edge Cases

- **Si el `cost` de una carta es 0 y un efecto `card_cost_modifier` aplica `delta: -1`**: el costo efectivo resuelve a -1. El clampeo (mínimo 0) es responsabilidad del Card System, no de DataLoader. DataLoader almacena el delta como está.

- **Si `registries.json` está ausente al inicio de la carga**: error fatal, independientemente de si los archivos de contenido son válidos. Los registros deben cargarse primero — son el prerequisito de toda validación cruzada (`status_id`, `type`, `tags`).

- **Si la `intention_pool` de un enemigo contiene solo intenciones con `condition`, y todas las condiciones evalúan a false en el momento de selección**: el pool queda vacío y el enemigo no tiene intención válida. DataLoader no puede detectar esto (las condiciones son evaluadas en runtime). El Enemy System debe garantizar al menos una intención sin `condition` por enemigo, o un comportamiento de fallback cuando el pool está vacío.

- **Si `DataLoader.get_card(id)` es llamado mientras el estado es `Loading`** (ej: el `_ready()` de un sistema downstream corre antes de que el singleton complete): retorna `null` + `push_error()`. DataLoader debe ser el primer autoload en la lista del proyecto. Esto es un requisito de configuración — se verifica en los Acceptance Criteria.

- **Si un campo opcional tipo string (como `flavor_text`) está ausente en el JSON**: DataLoader coerciona los campos opcionales ausentes a `""` en el momento del parse. Los callers no verifican `.has("flavor_text")` — el campo siempre existe en el objeto parseado.

- **Si el mismo `id` aparece en archivos de distinto tipo** (ej: una carta y una reliquia comparten `"id": "espada_del_rey"`): no hay conflicto en runtime porque los accessors son type-scoped. Sin embargo, cualquier sistema externo que referencie IDs sin prefijo de tipo (save files, pipeline de arte) debe incluir el tipo como campo separado. Principio: los IDs son únicos dentro de su tipo, no globalmente.

- **Si una Situación tiene múltiples efectos `card_cost_modifier` que aplican al mismo tipo de carta**: los efectos se acumulan aditivamente en orden de aparición en el array `effects`. DataLoader no define el orden de resolución — esa responsabilidad recae en el Situation System.

- **Si una reliquia tiene `charges: 1` y su trigger dispara dos veces en el mismo frame**: DataLoader almacena solo el valor base. El Relic System debe procesar eventos de trigger secuencialmente y verificar las cargas restantes antes de cada activación.

- **Si `rule_text` tiene exactamente 120 caracteres** (el máximo válido según esquema): pasa la validación pero puede hacer overflow en la UI a la resolución mínima de web (768px de ancho). El límite de 120 chars es una restricción de UI — debe verificarse en el target mínimo de resolución, no solo contra el schema.

- **Si `get_all_cards()` es llamado y el caller filtra por tipo en su propio código** en vez de usar `get_cards_by_type()`: el resultado es correcto pero bypasea la superficie canónica de filtrado. Los callers deben usar los métodos de filtrado de DataLoader — no reimplementar filtros localmente.

## Dependencies

| Sistema | Dirección | Naturaleza de la dependencia |
|---|---|---|
| Card System | Depende de este | Lee `CardData` para construir mazos y robar cartas. Interface: `get_card()`, `get_all_cards()`, `get_cards_by_type()`, `get_cards_by_tag()`. |
| Situation System | Depende de este | Lee `SituationData` para seleccionar la Situación activa y ejecutar su vocabulario de efectos. Interface: `get_all_situations()`, `get_situation()`. |
| Status Effect System | Depende de este | Lee los IDs de estado del registry (`get_known_statuses()`) para validar y resolver efectos. |
| Player Character System | Depende de este | Lee las cartas del mazo inicial del personaje por ID. Interface: `get_card()`. |
| Enemy System | Depende de este | Lee `EnemyData` para instanciar enemigos y su intention_pool. Interface: `get_enemy()`, `get_all_enemies()`, `get_all_bosses()`. |
| Relic System | Depende de este | Lee `RelicData` para instanciar reliquias activas y su vocabulario de efectos. Interface: `get_relic()`, `get_all_relics()`, `get_relics_by_rarity()`. |
| Deck Building System | Depende de este | Lee el pool de cartas y reliquias para construir ofertas de recompensa. Interface: `get_all_cards()`, `get_relics_by_rarity()`. |
| Combat System | Depende de este | Lee `AllyData` via `get_ally(id)` cuando el Card System emite `ally_summoned(ally_id)`. El Combat System instancia el aliado a partir del `AllyData` base. *(retrofit 2026-05-17)* |
| Node Map System | Sin dependencia directa | Los tipos de nodo del mapa son constantes de diseño, no datos cargados por DataLoader. |
| Save System | Depende de este | Serializa y deserializa IDs de cartas, reliquias y enemigos. Al cargar un save, los IDs deben existir en DataLoader — IDs inválidos en saves producen datos corruptos. |
| Scene Management System | Sin dependencia | No consume datos de contenido. |

**Nota de consistencia bidireccional**: los GDDs de los sistemas downstream deben listar a `DataLoader` en su sección de Dependencies. Esto no puede verificarse aún — ningún otro GDD está escrito.

## Tuning Knobs

| Parámetro | Valor MVP | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| Cartas en el pool | 20 | 10–200 | Más variedad en recompensas; startup load time aumenta linealmente (irrelevante hasta ~500 cartas) | Menos variedad; el jugador ve las mismas cartas en cada recompensa |
| Situaciones en el pool | 8 | 5–50 | Más variedad de encuentros; más pares carta×Situación que testear | Menos de 5 hace que los runs se sientan repetitivos antes del primer jefe |
| Enemigos (sin jefes) | 6 | 3–30 | Más variedad de encuentros | Menos de 3 hace que el jugador anticipe intenciones perfectamente desde el run 2 |
| Reliquias | 6 | 4–60 | Más combinaciones de deck building; más tiempo de diseño y balance | Menos de 4 reduce la variedad de runs significativamente |
| Jefes | 1 | 1–5 | Más variedad de run completo | 0 jefes = sin condición de victoria del run |
| Aliados invocables | 3–5 | 2–20 | Más diversidad de estrategias de campo | Menos de 2 hace que las cartas de invocación sean monótonas |
| Max efectos por ítem | — | 1–8 | Situaciones más complejas; dispatcher hace más iterations | — |
| Max intenciones por enemigo | — | 1–10 | Enemigos más impredecibles | 1 intención = enemigo completamente predecible |
| Longitud máxima de `rule_text` | 120 chars | 60–150 | Reglas más descriptivas pero riesgo de overflow en UI a 768px | Reglas más crípticas |

**Volumen de contenido por scope tier** (de `design/gdd/game-concept.md`):

| Tier | Cartas | Situaciones | Enemigos | Reliquias |
|---|---|---|---|---|
| MVP | 20 | 8 | 6 + 1 jefe | 6 |
| Vertical Slice | 40 | 15 | ~12 + jefes | ~15 |
| Full Vision | 60+ | 25+ | 20+ | 30+ |

## Visual/Audio Requirements

N/A — este sistema es infraestructura pura. No produce outputs visuales ni de audio.

## UI Requirements

N/A — no hay UI asociada a este sistema. La pantalla de carga (si `Loading` supera 0.5s) es responsabilidad del Scene Management System, que usa `DataLoader.is_loaded()` como signal de completitud.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿Hot-reload de archivos JSON en runtime? | Diferido a post-MVP | En MVP, agregar contenido requiere reiniciar el juego. Hot-reload deseable para futura iteración de contenido. |
| ¿Formato JSON con un archivo por tipo, o uno por ítem? | Resuelto | Un archivo por tipo (ej: `cards.json` como array). Escala bien hasta ~200 ítems; si se supera, migrar a un archivo por ítem. |
| ¿Orden de autoloads en Godot Project Settings? | Pendiente configuración | DataLoader debe ser el primer autoload en la lista del proyecto. Verificar antes del primer build. |
| ¿Cómo el Save System serializa IDs que ya no existen en DataLoader? | Diferido al Save System GDD | DataLoader no maneja datos de save. El Save System debe definir su política de IDs obsoletos. |

## Cross-References

Este es el primer GDD del proyecto. No hay GDDs upstream que referenciar. Las interfaces definidas aquí (schemas, vocabulario de efectos, triggers) son el punto de referencia para todos los GDDs futuros.

| Este documento establece | Sistemas que deben referenciar | Elemento específico |
|---|---|---|
| Vocabulario de tipos de carta | Card System, Situation System, Combat System, UI | `combate`, `social`, `absurda`, `mental`, `fisica` |
| IDs de estado alterado | Status Effect System, Enemy System, Relic System | `vergüenza`, `confianza_excesiva`, `sospechoso`, `inspirado` |
| Vocabulario de efectos (tipos tagueados) | Situation System, Enemy System, Relic System | Tabla de tipos en Sección C §4 |
| Vocabulario de triggers | Situation System, Enemy System, Relic System | Tabla en Sección C §3 |
| Interfaz DataLoader (métodos y contratos) | Todos los sistemas downstream | Tabla en Sección C §6 |

## Acceptance Criteria

Tests unitarios en `tests/unit/data_loader/` — BLOQUEANTES antes de marcar la historia como Done. AC-3 es verificación manual de configuración.

- **AC-1 (Carga completa):** DADO que existen archivos JSON válidos en `res://data/[tipo]/` y `res://data/config/`, CUANDO el juego inicia, ENTONCES `DataLoader.is_loaded()` retorna `true` y todos los accessors retornan arrays no vacíos con los ítems definidos en los archivos correspondientes.

- **AC-2 (registries.json es prerequisito):** DADO que `registries.json` está ausente pero los archivos de contenido son válidos, CUANDO el juego intenta iniciar, ENTONCES la carga falla con estado `LoadFailed`, se loguea un error fatal indicando que `registries.json` es requerido, y el juego no continúa a ninguna pantalla de juego.

- **AC-3 (Orden de autoloads — verificación manual):** DADO que el proyecto está configurado en Godot, CUANDO se inspecciona Project Settings → Autoloads, ENTONCES `DataLoader` aparece como el primer autoload de la lista, antes de cualquier otro singleton.

- **AC-4 (Inmutabilidad):** DADO que el juego está en estado `Loaded` y se obtiene un objeto `CardData` via `get_card(id)`, CUANDO el caller modifica un campo del objeto directamente, ENTONCES la siguiente llamada a `get_card(id)` con el mismo ID retorna el valor original sin modificar.

- **AC-5 (Campos opcionales ausentes → string vacío):** DADO una carta en JSON que omite el campo `flavor_text`, CUANDO se llama `get_card(id)`, ENTONCES el objeto retornado tiene `flavor_text == ""` y puede accederse sin verificar `.has("flavor_text")` sin producir error.

- **AC-6 (Efectos tagueados preservados exactamente):** DADO una Situación con múltiples efectos en JSON, CUANDO se llama `get_situation(id)`, ENTONCES el array `effects` del objeto retornado contiene exactamente esos dicts con todos sus campos sin transformación ni parseo adicional.

- **AC-7 (Transición Loading → Loaded):** DADO que todos los archivos JSON son válidos y no contienen errores fatales, CUANDO la carga de startup completa, ENTONCES el estado es `Loaded`, `is_loaded()` retorna `true`, y todos los accessors están disponibles.

- **AC-8 (Transición Loading → LoadFailed — campo requerido ausente):** DADO un `cards.json` con una entrada sin campo `id`, CUANDO el juego intenta iniciar, ENTONCES el estado es `LoadFailed`, `is_loaded()` retorna `false`, y el log de error identifica el archivo y el campo faltante.

- **AC-9 (Accessor retorna null para ID desconocido):** DADO que el juego está en estado `Loaded`, CUANDO se llama `get_card("id_que_no_existe")`, ENTONCES retorna `null`, genera `push_warning()` con el ID en el mensaje, y el proceso no crashea.

- **AC-10 (ID duplicado dentro de un tipo → LoadFailed):** DADO un `enemies.json` con dos entradas con el mismo valor de campo `id`, CUANDO el juego intenta iniciar, ENTONCES la carga falla con `LoadFailed` y el log identifica el ID duplicado y el archivo donde ocurre.

- **AC-11 (Cross-reference status_id inválido):** DADO un efecto `apply_status` con un `status_id` que no existe en `registries.json`, CUANDO el juego carga, ENTONCES en build de desarrollo → `LoadFailed`; en build de release → `LoadedWithErrors` con el error registrado en `get_load_errors()`.

- **AC-12 (Trigger desconocido → LoadFailed):** DADO una reliquia con un valor de `trigger` no incluido en la tabla de triggers válidos, CUANDO el juego carga, ENTONCES el estado es `LoadFailed` y el log identifica la reliquia y el trigger inválido.

- **AC-13 (Rendimiento — startup load time):** DADO el contenido MVP (20 cartas, 8 Situaciones, 7 enemigos, 6 reliquias) en los archivos JSON, CUANDO el juego inicia en PC con un build de release, ENTONCES el tiempo desde inicio de `_ready()` del `DataLoader` hasta la transición a estado `Loaded` es **menor a 500 ms**.

- **AC-14 (Accessor llamado durante Loading):** DADO que el estado de `DataLoader` es `Loading` (carga en progreso), CUANDO cualquier sistema llama `get_card(id)` u otro accessor, ENTONCES el accessor retorna `null`, genera `push_error()` indicando que la carga no completó, y el caller no crashea.

## Open Questions

[To be designed]
