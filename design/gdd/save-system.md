---
sidebar_position: 14
title: Sistema de Guardado
description: Persistencia del estado del run entre sesiones — serialización, carga y manejo de guardados parciales.
---

# Save System

> **Status**: In Design
> **Author**: Facundo Villafane + Claude Code
> **Last Updated**: 2026-05-21
> **Implements Pillar**: Rejugabilidad por Combinaciones (el run persiste entre sesiones)

## Overview

El Save System serializa y deserializa el estado del run activo a `user://save.json` usando la API de archivos de Godot 4. El estado guardado es el mínimo necesario para reconstruir fielmente la sesión del jugador: HP actual, oro, mazo completo (con estado de mejora por instancia), reliquias activas, estado de los nodos del mapa (VISITED/AVAILABLE), y la seed del run (que permite regenerar determinísticamente la topología). El sistema guarda automáticamente al completar cada nodo del mapa (post-reward, post-market, post-event) y al generar la oferta del reward screen (para que si el jugador cierra la app durante el reward, vuelva a la misma oferta). Un solo slot activo. Si no hay guardado válido, el menú ofrece solo "Nuevo run"; si hay uno, ofrece "Continuar" o "Nuevo run" (que sobreescribe el anterior).

Para el jugador, el Save System es invisible cuando funciona correctamente: abrir el juego y estar donde lo dejaste es lo que se espera. Solo se vuelve visible en sus fallos. El diseño minimiza los casos en que el estado recargado difiere del esperado — especialmente en web, donde el tab puede cerrarse en cualquier momento.

## Player Fantasy

El Save System no tiene Player Fantasy propia. Su contribución al juego es la ausencia de frustración: el jugador vuelve al punto exacto donde lo dejó sin perder progreso. La fantasía pertenece al sistema que lo usa (el Node Map, el Deck Building, el run completo) — el Save System la preserva sin añadir ni restar.

Si el sistema falla en entregar esto, el jugador pierde progreso y confianza. En web, donde los tabs se cierran accidentalmente, la tolerancia a pérdida de progreso es cero.

## Detailed Design

### Core Rules

**1. Archivo de guardado**

El estado del run se persiste en un único archivo JSON en `user://save.json` (Godot resuelve el path por plataforma: AppData en Windows, LocalStorage en web). Un solo slot activo. Si no existe el archivo o está corrupto, se trata como "sin run activo".

---

**2. Schema del guardado**

```json
{
  "version": 1,
  "saved_at": "2026-05-21T14:30:00Z",
  "run_state": "NODE_MAP",
  "run_seed": 12345,
  "player": {
    "hp_current": 45,
    "gold": 32
  },
  "deck": [
    { "instance_id": "uuid-1", "card_id": "discurso_motivacional", "upgraded": false }
  ],
  "active_relics": ["sello_autenticidad", "diario_martir"],
  "map": {
    "node_states": {
      "r1_0": "VISITED",
      "r2_0": "AVAILABLE",
      "r2_1": "LOCKED"
    }
  },
  "reward_offer": null
}
```

`reward_offer` es `null` cuando `run_state == "NODE_MAP"`. Cuando `run_state == "REWARD_SCREEN"`, contiene `{"offer_cards": [...], "offer_relics": [...]}`. `version` permite migraciones de schema futuras.

---

**3. Cuándo guardar**

| Evento | Qué guarda | `run_state` |
|---|---|---|
| `map_generated` (inicio del run) | Estado inicial — mazo de inicio, hp=HP_BASE, gold=0, r1_0=AVAILABLE | `NODE_MAP` |
| `reward_screen_ready()` (REWARD_INIT) | Estado del jugador + mapa actualizado + oferta generada | `REWARD_SCREEN` |
| `transition_completed(NodeMap)` (post-reward/market/event) | Estado actualizado del jugador, mazo, reliquias, nodos | `NODE_MAP` |
| `_notification(NOTIFICATION_WM_CLOSE_REQUEST)` | Intento de guardado de emergencia con estado actual | Estado actual |

**Nota sobre la oferta del reward:** El guardado en REWARD_INIT preserva la oferta generada. Si el jugador cierra la app durante el reward screen, al recargar verá la misma oferta con el mazo en estado pre-reward. La elección se hace de nuevo — el mazo no se guarda hasta que `transition_completed(NodeMap)` dispara el guardado final.

**El estado `SELECTED` del Node Map** nunca se guarda. Al guardar en REWARD_INIT, el nodo completado ya está `VISITED` y el siguiente ya está `AVAILABLE`.

---

**4. Ciclo de vida del run**

| Fase | Acción del Save System |
|---|---|
| **Menú principal** | `FileAccess.file_exists("user://save.json")` → mostrar "Continuar" si existe y es válido |
| **Nuevo run** | Sobreescribe `user://save.json` con estado inicial |
| **Continuar** | Carga `user://save.json`, reconstruye sistemas, navega a la escena correcta |
| **Fin de run (victoria o derrota)** | Elimina `user://save.json` |
| **Durante el run** | Auto-guarda en los puntos definidos en regla 3 |

---

**5. Reconstrucción al cargar**

Al cargar con `run_state == "NODE_MAP"`:
1. Leer seed del run → Node Map regenera el grafo topológico
2. Aplicar `node_states` → restaurar VISITED/AVAILABLE/LOCKED en cada nodo
3. Cargar `player.hp_current` y `player.gold`
4. Reconstituir mazo: crear instancias de `CardData` por `card_id`, asignar `instance_id`, aplicar `upgraded`
5. Activar reliquias: `RelicManager.add_relic(id)` para cada entrada en `active_relics`
6. Navegar a NodeMap

Al cargar con `run_state == "REWARD_SCREEN"`:
1. Pasos 1–5 igual
2. Reconstituir oferta desde `reward_offer`
3. Navegar a Reward screen con la oferta reconstruida

---

**6. Validación del guardado al cargar**

Antes de reconstruir, el Save System valida:
- `version` presente y compatible (actualmente: `version == 1`)
- `run_seed` es int válido
- `deck` es array, cada elemento tiene `instance_id`, `card_id`, `upgraded`
- `active_relics` es array de strings
- `map.node_states` contiene al menos `r1_0`
- `player.hp_current` en [1, HP_MAX]
- `player.gold` en [0, ∞)

Si falla cualquier validación: tratar como corrupto, eliminar el archivo, ofrecer solo "Nuevo run". Loggear el motivo de fallo.

---

### States and Transitions

| Estado | Descripción | Entrada | Salida |
|---|---|---|---|
| `IDLE` | Estado por defecto durante el run | Inicialización / guardado completado / carga completada | Trigger de guardado o carga |
| `SAVING` | Escribiendo `user://save.json` | Trigger de guardado | Escritura completa → `IDLE` |
| `LOADING` | Leyendo y reconstruyendo sistemas | Solicitud de carga (Continuar) | Reconstrucción completa → `IDLE` |

El guardado (`SAVING`) no bloquea el input del jugador — es suficientemente rápido para ejecutarse sin freeze visible. La carga (`LOADING`) muestra pantalla de carga hasta completar.

---

### Interactions with Other Systems

| Sistema | Señales escuchadas | Acción del Save System |
|---|---|---|
| **Node Map System** | `map_generated` | Guarda estado inicial del run |
| **Deck Building System** | `reward_screen_ready()` | Guarda estado + oferta del reward |
| **Scene Management System** | `transition_completed(NodeMap)` | Guarda estado post-encuentro completo |
| **Player Character System** | — | Lee `hp_current` para serializar |
| **Card System** | — | Lee `get_deck()` para serializar |
| **Relic System** | — | Lee `_active_relics` para serializar |
| **Node Map System** | — | Lee `node_states` y `player_gold` para serializar |

## Formulas

El Save System no tiene fórmulas matemáticas propias — es infraestructura de serialización. La única verificación lógica cuantificable:

### Compatibilidad de versión de schema

`is_compatible(save) = save["version"] <= CURRENT_SCHEMA_VERSION`

| Variable | Tipo | Rango | Descripción |
|---|---|---|---|
| `save["version"]` | int | 1–∞ | Versión del schema del archivo guardado |
| `CURRENT_SCHEMA_VERSION` | int const | 1 (MVP) | Versión del schema que el código actual soporta |

**Rango de salida:** bool. Si `false`: save incompatible — tratar como corrupto.

**Ejemplo:** `save["version"] = 2`, `CURRENT_SCHEMA_VERSION = 1` → `2 <= 1 = false` → save ignorado.

## Edge Cases

**Si `user://save.json` no existe al iniciar el menú**: mostrar solo "Nuevo run". Estado normal de la aplicación la primera vez.

**Si `user://save.json` contiene JSON inválido o fields requeridos ausentes**: validación falla → eliminar archivo → loggear motivo → tratar como sin guardado. Sin crash.

**Si el app se cierra durante `SAVING`** (escritura incompleta): al cargar, el JSON estará malformado → corrupto → eliminar → "Nuevo run". Pérdida de 1 auto-save sin crash.

**Si `user://` no es escribible** (permisos, almacenamiento lleno): `FileAccess.open()` retorna error → loggear → el juego continúa sin auto-save hasta que el problema se resuelva. Sin crash.

**Si el save contiene `card_id` no reconocido** (carta deprecada en versión posterior): saltear esa carta y loggear warning. Si el deck resultante tiene menos de `DECK_MIN (4)` cartas: tratar como corrupto.

**Si el save contiene `relic_id` no reconocido**: saltear esa reliquia y loggear warning. El jugador pierde esa reliquia pero el run continúa.

**Si múltiples auto-saves se disparan en el mismo frame**: el Save System encola y procesa de a una escritura. Sin escrituras concurrentes al mismo archivo.

**Si el jugador elige "Nuevo run" con save activo**: el save se sobreescribe al generar el nuevo mapa, sin confirmación adicional. La elección explícita del menú es confirmación suficiente.

## Dependencies

| Sistema | Tipo | Lo que serializa | Lo que provee al cargar |
|---|---|---|---|
| **Player Character System** | Hard | `hp_current` | Restaura `hp_current` al cargar |
| **Card System** | Hard | `get_deck()` → serializa CardData | Recibe `add_card()` para reconstituir el mazo |
| **Relic System** | Hard | `_active_relics` | Recibe `add_relic(id)` para activar reliquias |
| **Node Map System** | Hard | `run_seed` + `node_states` + `player_gold` | Recibe seed → regenera grafo; recibe node_states para restaurar posiciones |
| **Deck Building System** | Hard | Escucha `reward_screen_ready()` → serializa oferta | Al cargar en REWARD_SCREEN: pasa oferta reconstruida |
| **Scene Management System** | Hard | Escucha `transition_completed(NodeMap)` | Navega a la escena correcta al cargar |
| **Data Configuration System** | Hard | — | `DataLoader.get_card(id)` para reconstituir CardData al cargar |

## Tuning Knobs

| Knob | Valor MVP | Notas |
|---|---|---|
| `SAVE_FILE_PATH` | `"user://save.json"` | Cambiar en tests para no sobreescribir el save real |
| `CURRENT_SCHEMA_VERSION` | 1 | Incrementar al cambiar el schema. Cada versión requiere función de migración. |

El Save System tiene mínimos tuning knobs. La persistencia es binaria (funciona o no) y los parámetros son estructurales, no de balance.

## Acceptance Criteria

**AC-1**: DADO que el jugador completa un encuentro y llega al Node Map, CUANDO el sistema procesa `transition_completed(NodeMap)`, ENTONCES `user://save.json` existe con HP, oro, mazo, reliquias y node_states actualizados y `run_state = "NODE_MAP"`.

**AC-2**: DADO que el jugador llega al Reward Screen y `reward_screen_ready()` dispara, CUANDO el Save System procesa la señal, ENTONCES `user://save.json` tiene `run_state = "REWARD_SCREEN"` con la oferta generada en `reward_offer`.

**AC-3**: DADO que el jugador carga un save con `run_state = "NODE_MAP"`, CUANDO la reconstrucción completa, ENTONCES `hp_current`, `gold`, contenido del mazo (incluyendo `upgraded` por instancia), reliquias activas y `node_states` son idénticos al estado guardado.

**AC-4**: DADO que se carga un save con cierto `run_seed`, CUANDO el Node Map regenera el grafo, ENTONCES la topología de nodos (tipos y `next_node_ids`) es idéntica a la del run original.

**AC-5**: DADO que `user://save.json` contiene JSON inválido, CUANDO el Save System intenta cargar, ENTONCES el archivo es eliminado, el menú muestra solo "Nuevo run", y el juego no crashea.

**AC-6**: DADO que el jugador completa o pierde el run, CUANDO el sistema procesa el fin del run, ENTONCES `user://save.json` no existe.

**AC-7**: DADO que no existe `user://save.json` al abrir el menú, CUANDO el menú se inicializa, ENTONCES solo "Nuevo run" está disponible.

**AC-8**: DADO que existe un `user://save.json` válido al abrir el menú, CUANDO el menú se inicializa, ENTONCES tanto "Continuar" como "Nuevo run" están disponibles.

**AC-9**: DADO que el jugador elige "Continuar" con un save en `run_state = "REWARD_SCREEN"`, CUANDO la reconstrucción completa, ENTONCES el Reward Screen se muestra con la misma oferta de cartas y reliquias que el save registra.

## Open Questions

| # | Pregunta | Owner | Estado |
|---|---|---|---|
| OQ-1 | ¿El Save System hace migración automática de schema (versión 1 → 2) o simplemente rechaza saves de versiones anteriores? | Technical/Game Design | Pendiente — para MVP (solo versión 1) no aplica; necesaria antes de cambiar el schema |
| OQ-2 | ¿Cómo se testa el save en web (LocalStorage)? ¿Hay un modo de test que use un path alternativo? | QA/Engineering | Pendiente — `SAVE_FILE_PATH` como tuning knob resuelve esto parcialmente |

## Open Questions

[To be designed]
