---
sidebar_position: 4
title: Sistema de Gestión de Escenas
description: Máquina de estados del flujo de juego, orquestación de transiciones visuales y gestión del ciclo de pantallas.
---

# Scene Management System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-16
> **Last Verified**: 2026-05-16
> **Implements Pillar**: Decisiones Rápidas · Situaciones como Escenario Narrativo

## Summary

El Scene Management System es el director de escena del juego: orquesta cuál pantalla está activa, cuándo y cómo ocurre cada transición, y aplica el color grading correcto a cada estado de juego. Es invisible como sistema, pero cada cambio de estado que el jugador experimenta — la caída dramática del color al llegar a la derrota, el flash dorado de la victoria — pasa por él.

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `None`

## Overview

El Scene Management System gestiona el flujo completo del juego como una máquina de estados con 8 estados: Menú Principal, Mapa de Nodos, Encuentro Activo, Situación Especial, Recompensa, Jefe, Derrota y Victoria. Determina qué pantalla está visible, qué transición ejecutar entre estados, y aplica el `CanvasModulate` correspondiente a cada estado. Las transiciones no son fades genéricos — son cambios de escena teatrales: cortes a negro solo donde el arte los permite (dos en todo el juego), y transiciones vía color grading para el resto.

El sistema es el segundo autoload del proyecto (después de `DataLoader`) y actúa como el punto único de control del flujo de juego. Ninguna pantalla se activa ni desactiva sin pasar por este sistema. Esto garantiza que toda transición respete las reglas visuales del art bible y que ningún estado de gameplay sea alcanzable si `DataLoader` no completó su carga.

## Player Fantasy

Este sistema es infraestructura — el jugador nunca lo invoca directamente. Lo que siente es el resultado de que funcione bien.

Cada transición es un cambio de escena en su propio teatro de improvisación: las luces caen sobre el Mapa, suben doradas en la Victoria, se enfrían y desaturan cuando la Derrota se apodera del escenario. El jugador nunca ve un loading screen — siente que está atravesando los actos de su run absurda como el protagonista de una obra que se reescribe sola. El caos se siente *coreografiado*: cada Situación, cada Boss, cada Recompensa llega con su propia iluminación dramática que dice "esto importa". Al mismo tiempo, la iluminación comunica el estado emocional antes que cualquier texto — el jugador sabe dónde está y qué siente antes de leer la UI. El juego respira con él.

Cuando el sistema falla, en cambio, el juego se siente como menús pegados con cinta, y la micro-historia absurda de la run se rompe.

## Detailed Design

### Core Rules

**1. Propiedad del CanvasModulate**

El nodo `CanvasModulate` que afecta todas las escenas del juego pertenece al autoload `SceneManager`. Ninguna escena de juego (`.tscn`) contiene su propio `CanvasModulate`. Las escenas individuales asumen que un `CanvasModulate` activo existe sobre ellas en el árbol y no intentan crear ni modificar uno.

**2. Punto único de control**

Ninguna pantalla se activa ni desactiva sin pasar por `SceneManager.request_transition()`. No hay llamadas directas a `SceneTree.change_scene_to_*()` en ningún otro sistema.

**3. Mapa de transiciones válidas**

SceneManager mantiene un diccionario inmutable `VALID_TRANSITIONS` con todos los pares `(origen, destino)` legales. Una transición se ejecuta solo si el par está en este mapa:

```
VALID_TRANSITIONS:
  MainMenu          → [NodeMap]
  NodeMap           → [ActiveEncounter, Boss]
  ActiveEncounter   → [SpecialSituation, Reward, Boss, Defeat, Victory]
  SpecialSituation  → [ActiveEncounter]
  Reward            → [NodeMap]
  Boss              → [Defeat, Victory]
  Defeat            → [MainMenu]
  Victory           → [MainMenu]
```

Pares inválidos relevantes: `MainMenu→Boss`, `MainMenu→ActiveEncounter`, `ActiveEncounter→NodeMap`, `Reward→ActiveEncounter`, `Boss→Reward`. Cualquier request con un par no listado se rechaza con error en el log.

**4. SpecialSituation como sub-estado**

`SpecialSituation` no es un swap de escena — es un cambio de `CanvasModulate` sobre la escena de `ActiveEncounter` que permanece cargada. Todo el estado del encuentro (mano de cartas, HP, turno) se preserva. Las SpecialSituations no pueden anidarse: si se recibe un `request_transition(SpecialSituation)` mientras `current_state == SpecialSituation`, la request se rechaza con warning en el log.

**5. Política de transición en progreso: drop (sin cola)**

SceneManager mantiene un flag `_transition_in_progress: bool`. Si llega un `request_transition()` mientras el flag es `true`, la request se descarta silenciosamente. En un juego de cartas por turnos, las requests simultáneas son siempre un error de código, no navegación intencional rápida.

**6. Bloqueo de input durante transiciones**

SceneManager consume todos los `InputEvent` a nivel de Autoload durante la transición — antes de que lleguen a cualquier escena. Las animaciones, el audio y los sistemas de física siguen procesándose normalmente. El bloqueo comienza cuando se inicia la transición y termina cuando el nuevo estado está activo y la transición completa.

**7. Gating de DataLoader**

Antes de ejecutar cualquier transición hacia un estado de gameplay (`NodeMap`, `ActiveEncounter`, `SpecialSituation`, `Reward`, `Boss`), SceneManager verifica `DataLoader.is_loaded()`. Los estados `MainMenu`, `Defeat` y `Victory` están exentos. Si `DataLoader` no está listo: la transición no se ejecuta, se guarda el destino en `_pending_transition`, y SceneManager se conecta one-shot a `DataLoader.load_completed` para reintentar automáticamente.

**8. Estado inicial**

Al arrancar, `current_state = GameState.MainMenu` se establece sincrónicamente antes del primer frame. Nunca es `null`.

---

### States and Transitions

**Estados y sus valores de CanvasModulate:**

| Estado | CanvasModulate | Descripción |
|---|---|---|
| `MainMenu` | `Color(0.98, 0.88, 0.72)` | Menú principal — ámbar de taberna |
| `NodeMap` | `Color(1.0, 0.93, 0.78)` | Mapa de nodos — luz de vela sobre pergamino |
| `ActiveEncounter` | `Color(1.0, 0.97, 0.9)` | Encuentro activo — casi blanco de día |
| `SpecialSituation` (absurda) | `Color(0.85, 1.0, 0.7)` | Sub-estado — verde ácido |
| `SpecialSituation` (peligrosa) | `Color(1.0, 0.75, 0.6)` | Sub-estado — rojo-naranja oscuro |
| `Reward` | `Color(1.0, 1.0, 0.95)` | Recompensa — el estado más claro y cálido |
| `Boss` | `Color(0.78, 0.85, 1.0)` | Jefe — azul-pizarra |
| `Defeat` | `Color(0.7, 0.75, 0.85)` | Derrota — frío y desaturado |
| `Victory` | `Color(1.0, 0.95, 0.7)` | Victoria — dorado total |

**Tabla completa de transiciones:**

| Origen | Destino | Tipo | Duración | Detalles |
|---|---|---|---|---|
| `MainMenu` | `NodeMap` | CanvasModulate tween | 0.6s | Sin corte a negro |
| `NodeMap` | `ActiveEncounter` | **Corte a negro** | 0.4s total | 0.1s fade negro → swap → 0.3s fade-out |
| `ActiveEncounter` | `SpecialSituation` | CanvasModulate tween | 0.5s | Sin swap de escena — solo color |
| `ActiveEncounter` | `Reward` | CanvasModulate tween | 0.4s | Sin negro |
| `Reward` | `NodeMap` | CanvasModulate tween | 0.5s | Sin negro |
| `ActiveEncounter` | `Boss` | **Corte a negro** | 0.8s total | 0.2s fade negro → swap → 0.6s fade-out (beat dramático) |
| `ActiveEncounter` | `Defeat` | CanvasModulate tween | 0.8s | Drain lento — el más lento del juego |
| `ActiveEncounter` | `Victory` | CanvasModulate tween | 0.5s | Flash dorado — el más rápido |
| `SpecialSituation` | `ActiveEncounter` | CanvasModulate tween | 0.5s | Sin swap de escena |
| `Boss` | `Defeat` | CanvasModulate tween | 0.8s | Idéntico a `ActiveEncounter → Defeat` |
| `Boss` | `Victory` | CanvasModulate tween | 0.5s | Idéntico a `ActiveEncounter → Victory` |
| `Defeat` | `MainMenu` | Corte a negro | 1.0s | 0.5s negro → swap → fade-in |
| `Victory` | `MainMenu` | Corte a negro | 2.0s+ | Con beats de celebración antes del negro |

**Regla de oro (art bible §2)**: Solo 2 cortes a negro en todo el juego — `NodeMap→ActiveEncounter` y `NodeMap→Boss`. Toda otra transición usa CanvasModulate sin negro.

**Ejecución de un corte a negro (3 fases):**
1. CanvasModulate hace tween a `Color(0,0,0)` en el tiempo de fade-in.
2. Con la pantalla 100% negra: descarga escena vieja, carga escena nueva, establece instantáneamente el CanvasModulate al color del estado destino.
3. CanvasModulate hace tween de `Color(0,0,0)` al color del estado destino en el tiempo de fade-out.

El swap de escena ocurre exclusivamente en la Fase 2. El jugador nunca ve una escena en estado descargado ni cargando.

---

### Interactions with Other Systems

**API pública del singleton SceneManager:**

| Método / Signal | Descripción |
|---|---|
| `request_transition(target: GameState, variant: String = "")` | Solicita transición. Valida el par `(current, target)`. Descarta si hay transición en progreso. `variant` solo aplica a `SpecialSituation` (`"absurda"` o `"peligrosa"`). |
| `get_current_state() -> GameState` | Retorna el estado actual. Read-only. |
| `is_transitioning() -> bool` | True si hay una transición en progreso. |
| `signal transition_completed(new_state: GameState)` | Emitida cuando la transición completa y el nuevo estado está activo. |
| `signal cut_to_black_reached()` | Emitida al llegar al negro completo (solo en cortes). El Audio System puede swapear música aquí. |
| `signal data_not_ready(requested_state: GameState)` | Emitida si DataLoader bloquea la transición. |

**Qué sistema llama qué transición:**

| Sistema | Transición que solicita | Cuándo |
|---|---|---|
| Combat System | `Reward` / `Defeat` / `Victory` | Al resolver el encuentro |
| Situation System | `SpecialSituation` con variant / `ActiveEncounter` | Al activar/resolver una Situación especial |
| Node Map System | `ActiveEncounter` / `Boss` | Al seleccionar un nodo de combate |
| Deck Building System | `NodeMap` | Al completar la selección de recompensa |
| Main Menu UI | `NodeMap` | Al presionar "Nueva Partida" |
| Defeat/Victory screens | `MainMenu` | Al finalizar sus animaciones |

**Regla estructural:** Todos los `Control` interactivos de cada escena deben ser hijos de un único nodo `Control` raíz. Esto permite a SceneManager bloquear el input con un único punto de intercepción de Autoload.

## Formulas

Este sistema no contiene fórmulas matemáticas. Las duraciones de transición y los valores de `CanvasModulate` son constantes de diseño listadas en Tuning Knobs. Las curvas de easing son parámetros del Tween de Godot, no fórmulas de diseño.

## Edge Cases

- **Si `DataLoader.load_completed` se emite mientras hay una transición distinta ya en progreso**: el auto-retry en `_pending_transition` verifica que `_transition_in_progress` sea `false` y que el par `(current_state, _pending_transition)` siga siendo válido antes de reintentar. Si alguna falla, descarta `_pending_transition` y loguea un warning.

- **Si `Defeat→MainMenu` o `Victory→MainMenu` es solicitado mientras DataLoader no está listo**: estas transiciones están exentas del gating. Para que la exención sea válida, `MainMenu.tscn` debe ser completamente estática — ningún nodo de MainMenu puede depender de datos cargados por DataLoader. Si MainMenu alguna vez necesita datos del juego, pierde su estatus de exento.

- **Si la escena nueva llama `request_transition()` en su `_ready()`**: `_transition_in_progress` sigue siendo `true` durante la carga — la request se descarta silenciosamente. Regla: ninguna escena llama `request_transition()` en `_ready()`. Las redirecciones al inicializar se hacen via `call_deferred("request_transition", target)` para ejecutarse en el frame siguiente, después de que `_transition_in_progress` vuelva a `false`.

- **Si `SpecialSituation` está activa cuando el Combat System resuelve el encuentro**: el par `(SpecialSituation, Reward)` no existe en `VALID_TRANSITIONS` — la request se rechaza y el jugador queda atascado. Combat System es responsable de salir de `SpecialSituation` primero: llama `request_transition(ActiveEncounter)`, espera `transition_completed(ActiveEncounter)`, y recién entonces solicita la transición de resultado. Combat System verifica `SceneManager.get_current_state()` antes de emitir — no asume que está en `ActiveEncounter`.

- **Si un `variant` desconocido es pasado a `request_transition(SpecialSituation, variant)`**: SceneManager loguea un warning con el valor recibido y usa `"absurda"` como fallback. La transición se ejecuta con el color verde ácido. No se rechaza — el variant incorrecto es un error del caller, no un error de estado.

- **Si el dispositivo suspende o el tab web queda en background durante una transición activa**: al reanudar, `_transition_in_progress` puede quedar `true` permanentemente. Resolución: SceneManager registra el timestamp de inicio de cada transición. Si al procesar cualquier frame detecta `_transition_in_progress == true` por más de 3 segundos, cancela la transición, resetea el flag, fuerza `current_state = GameState.MainMenu`, y emite `transition_completed(MainMenu)`. Tres segundos cubre la transición más larga (Victory→MainMenu, 2s+) con margen.

- **Si el Audio System no completa su swap de música dentro de la ventana de Phase 2** (0.1s para el corte más corto): SceneManager no espera confirmación — emite `cut_to_black_reached()` y procede al Phase 3. Un swap más lento produce un artifact de audio (crossfade audible): defecto cosmético aceptable. El GDD del Audio System debe especificar que su swap debe completarse en ≤ 0.1s.

- **Si llegan dos requests válidas en rápida sucesión**: la primera se ejecuta, la segunda se descarta por drop. Al completar la primera (`transition_completed`), el sistema que emitió la segunda es responsable de reemitirla. SceneManager no reintenta — drop es drop, el caller reintenta en `transition_completed`.

## Dependencies

| Sistema | Dirección | Naturaleza |
|---|---|---|
| DataLoader | Este sistema depende de DataLoader | Lee `DataLoader.is_loaded()` antes de ejecutar transiciones a estados de gameplay. Única dependencia upstream. |
| Combat System | Depende de este | Solicita `Reward`, `Defeat`, `Victory`. Escucha `transition_completed` para saber cuándo el estado cambió. |
| Situation System | Depende de este | Solicita `SpecialSituation` (con variant) y `ActiveEncounter`. |
| Node Map System | Depende de este | Solicita `ActiveEncounter` o `Boss` al seleccionar un nodo de combate. |
| Deck Building System | Depende de este | Solicita `NodeMap` al completar la selección de recompensa. |
| Main Menu UI | Depende de este | Solicita `NodeMap` al arrancar una nueva partida. |
| Defeat / Victory screens | Dependen de este | Solicitan `MainMenu` al finalizar sus animaciones. |
| Audio System | Depende de este | Escucha `cut_to_black_reached` para swapear música mid-corte sin solapamiento audible. |
| Todos los sistemas | Escuchan `transition_completed` | Para reaccionar al nuevo estado sin polling de `get_current_state()`. |

## Tuning Knobs

| Parámetro | Valor actual | Rango seguro | Efecto si aumenta | Efecto si disminuye |
|---|---|---|---|---|
| `MainMenu → NodeMap` duration | 0.6s | 0.3–1.0s | Transición más contemplativa | Más brusca |
| `NodeMap → ActiveEncounter` fade-in negro | 0.1s | 0.05–0.3s | Negro más gradual | Negro casi instantáneo |
| `NodeMap → ActiveEncounter` fade-out | 0.3s | 0.2–0.6s | Reveal más lento | Reveal más brusco |
| `ActiveEncounter → SpecialSituation` duration | 0.5s | 0.2–0.8s | Flash más lento, menos urgente | Flash más rápido, más alarmante |
| `ActiveEncounter → Reward` duration | 0.4s | 0.2–0.6s | Transición más suave | Más abrupta |
| `Reward → NodeMap` duration | 0.5s | 0.3–0.8s | — | — |
| `NodeMap → Boss` fade-in negro | 0.2s | 0.1–0.4s | Beat dramático más largo | Beat más corto |
| `NodeMap → Boss` fade-out | 0.6s | 0.4–1.0s | Reveal más tenso | Reveal más rápido |
| `ActiveEncounter → Defeat` duration | 0.8s | 0.5–1.2s | Caída más lenta y dramática | Menos impacto emocional |
| `ActiveEncounter → Victory` duration | 0.5s | 0.3–0.8s | Flash más largo | Flash más corto |
| `Defeat → MainMenu` duration | 1.0s | 0.7–1.5s | — | — |
| `Victory → MainMenu` duration | 2.0s+ | 1.5–3.0s | Más tiempo de celebración | Menos celebración |
| Watchdog timeout | 3.0s | 2.5–5.0s | Más tolerancia ante suspensiones | Riesgo de resetear transiciones legítimas largas |
| Valores de CanvasModulate por estado | (tabla Sección C) | **No modificar sin revisar art bible** | Rompe la identidad visual de los estados | Ídem |

## Visual/Audio Requirements

Las transiciones visuales (CanvasModulate, cortes a negro) son la responsabilidad principal de este sistema. Los valores y timings exactos están definidos en el art bible §2 y consolidados en la tabla de Detailed Design. No hay requirements adicionales de VFX — SceneManager orquesta el CanvasModulate global, no efectos individuales de escena.

Audio: SceneManager emite `cut_to_black_reached` para que el Audio System pueda swapear música mid-corte. El budget para ese swap es ≤ 0.1s (duración del fade-in negro más corto). El scheduling exacto de la música es responsabilidad del Audio System GDD.

## UI Requirements

N/A — este sistema no tiene UI propia. La pantalla de loading (si DataLoader supera 0.5s) reacciona a la signal `data_not_ready` — su diseño visual pertenece a SceneManager como dueño del flujo, pero su implementación la define el UI System GDD.

## Cross-References

| Este documento referencia | Fuente | Elemento referenciado | Naturaleza |
|---|---|---|---|
| Valores de CanvasModulate por estado | `design/art/art-bible.md` §2 | Color() exacto por estado | Dependencia de datos |
| Tabla de transiciones (tipo y duración) | `design/art/art-bible.md` §2 | Mapa de Transiciones | Dependencia de datos |
| Regla de 2 cortes a negro | `design/art/art-bible.md` §2 | "Solo 2 cortes a negro: Mapa→Encuentro y Pre-Jefe" | Dependencia de regla |
| `DataLoader.is_loaded()` | `design/gdd/data-configuration-system.md` | Interfaz de accessor y estados | Dependencia de estado |
| `DataLoader.load_completed` | `design/gdd/data-configuration-system.md` | Signal del estado Loaded | Trigger de estado |

## Acceptance Criteria

Tests en `tests/unit/scene_management/` (Logic: CR2, CR3, CR5, CR6, CR8, CR10, CR12, CR14) y tests de integración o playtest documentado (CR1, CR7, CR11, CR13, CR15).

- **CR-1 (Propiedad CanvasModulate):** DADO que el proyecto está cargado, CUANDO se inspecciona el árbol de escenas en Remote Debugger, ENTONCES existe exactamente un `CanvasModulate` en el árbol, su padre es `SceneManager`, y ningún `.tscn` del juego contiene uno propio.

- **CR-2 (Punto único de control):** DADO una búsqueda de `change_scene_to` en todos los `.gd` del proyecto excluyendo `scene_manager.gd`, CUANDO se ejecuta la búsqueda, ENTONCES no aparece ninguna llamada directa — toda activación de pantalla pasa por `SceneManager.request_transition()`.

- **CR-3 (Par inválido rechazado):** DADO que el estado actual es `MainMenu`, CUANDO se llama `request_transition(GameState.ActiveEncounter)`, ENTONCES la transición no se ejecuta, el estado permanece `MainMenu`, y el log contiene un error que identifica el par inválido. No crashea.

- **CR-4 (SpecialSituation sin swap de escena):** DADO estado `ActiveEncounter` con mano de cartas activa y HP del enemigo en 3, CUANDO se llama `request_transition(SpecialSituation, "absurda")`, ENTONCES la escena `ActiveEncounter.tscn` no se descarga ni recarga, los valores de HP y mano son idénticos antes y después, y el `CanvasModulate` cambia a `Color(0.85, 1.0, 0.7)` en exactamente 0.5s.

- **CR-5 (SpecialSituation sin anidamiento):** DADO estado `SpecialSituation`, CUANDO se llama `request_transition(SpecialSituation, "peligrosa")`, ENTONCES la request se rechaza, el estado permanece `SpecialSituation`, y el log contiene un warning de anidamiento no permitido.

- **CR-6 (Drop de transición en progreso):** DADO que la transición `NodeMap→ActiveEncounter` está en ejecución (0.4s), CUANDO durante esos 0.4s se llama `request_transition(Defeat)`, ENTONCES la segunda request se descarta, la transición original completa normalmente, el estado final es `ActiveEncounter`, y no aparece ningún error en el log.

- **CR-7 (Bloqueo de input):** DADO que se inicia la transición `ActiveEncounter→Reward` (0.4s), CUANDO durante la transición el jugador hace clic sobre una carta o presiona cualquier tecla de gameplay, ENTONCES ninguna escena de juego recibe ese InputEvent; las animaciones y el audio siguen ejecutándose; el input vuelve a funcionar en el frame en que `transition_completed(Reward)` se emite.

- **CR-8 (Gating de DataLoader):** DADO que `DataLoader.is_loaded()` retorna `false`, CUANDO se llama `request_transition(NodeMap)`, ENTONCES la transición no se ejecuta, la signal `data_not_ready(NodeMap)` se emite, y cuando `DataLoader.load_completed` se emite posteriormente la transición a `NodeMap` se reintenta automáticamente sin intervención del caller.

- **CR-9 (Exención Defeat/Victory del gating):** DADO que `DataLoader.is_loaded()` retorna `false`, CUANDO se llama `request_transition(MainMenu)` desde `Defeat`, ENTONCES la transición se ejecuta sin verificar DataLoader y el estado cambia a `MainMenu`; `data_not_ready` no se emite.

- **CR-10 (Estado inicial sincrónico):** DADO que el juego acaba de lanzarse, CUANDO cualquier sistema llama `SceneManager.get_current_state()` en su propio `_ready()`, ENTONCES el valor retornado es `GameState.MainMenu` — nunca `null`, nunca un estado de gameplay.

- **CR-11 (Watchdog):** DADO que `_transition_in_progress` quedó en `true` (simulado via test), CUANDO transcurren más de 3 segundos sin que la transición complete, ENTONCES SceneManager cancela la transición, resetea `_transition_in_progress = false`, fuerza `current_state = GameState.MainMenu`, y emite `transition_completed(MainMenu)`; el juego vuelve a aceptar input desde `MainMenu`.

- **CR-12 (Fallback de variant desconocido):** DADO estado `ActiveEncounter`, CUANDO se llama `request_transition(SpecialSituation, "toxica")`, ENTONCES la transición se ejecuta con el color fallback `Color(0.85, 1.0, 0.7)`, el log contiene un warning con el variant desconocido recibido, y el juego no falla.

- **CR-13 (Combat System verifica estado antes de resultado):** DADO que el estado es `SpecialSituation` cuando Combat System resuelve el encuentro, CUANDO el Combat System solicita la transición de resultado, ENTONCES primero verifica `get_current_state()`, detecta que no está en `ActiveEncounter`, solicita `request_transition(ActiveEncounter)`, espera `transition_completed(ActiveEncounter)`, y solo entonces solicita `request_transition(Reward)`. El par inválido `(SpecialSituation, Reward)` nunca llega a SceneManager.

- **CR-14 (call_deferred en _ready()):** DADO que una escena necesita redirigir al inicializarse, CUANDO ese código se ejecuta en `_ready()`, ENTONCES usa `call_deferred("request_transition", target)` — la request no llega a SceneManager durante el frame de carga sino en el siguiente, cuando `_transition_in_progress` ya volvió a `false`.

- **CR-15 (Performance — timing de transiciones):** DADO el juego corriendo en hardware mínimo objetivo, CUANDO se ejecutan las 13 transiciones definidas en la tabla midiendo su duración real, ENTONCES cada transición completa dentro del +10% de su duración diseñada; ningún tween excede 3.0s; el watchdog no se dispara durante ninguna transición legítima.

## Open Questions

| Pregunta | Estado | Resolución |
|---|---|---|
| ¿El HUD debe estar en un `CanvasLayer` separado fuera del `CanvasModulate` global? | Pendiente — arquitectura | Documentado como open item en el art bible §7. Si el HUD no está excluido del CanvasModulate, los colores del HUD se ven afectados por el grading de cada estado (potencial contraste en Defeat y Boss). Resolver antes del primer sprint de UI. |
| ¿SpecialSituation absurda y peligrosa deben ser dos estados separados del enum? | Resuelto por ahora como un estado + variant | Si en el futuro desarrollan transiciones con comportamientos distintos entre sí, promover a estados separados del enum. |
| ¿La música de victoria se gestiona desde el Audio System reaccionando a `transition_completed(Victory)` o desde SceneManager? | Diferido al Audio System GDD | SceneManager no gestiona audio directamente. |
