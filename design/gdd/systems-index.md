---
sidebar_position: 2
title: Índice de Sistemas
description: Mapa de los 12 sistemas de Caos en Mano — dependencias, prioridades y orden de diseño.
---

# Systems Index: Caos en Mano

> **Status**: Draft
> **Created**: 2026-05-15
> **Last Updated**: 2026-05-15
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

Caos en Mano is a roguelike deckbuilder where the unique mechanic is the active Situación — a field rule that changes the meaning and effectiveness of every card in play. The game needs systems in three clusters: (1) the **card economy cluster** that defines what a card is and how Impulso flows each turn; (2) the **situation and status cluster** that implements the contextual modifiers that make the same card behave differently across encounters; and (3) the **run structure cluster** that strings encounters into a 10–20 minute arc with meaningful decisions at every step.

All 12 systems are MVP. The design order below reflects dependency structure — designs must be written from the bottom up, starting with the foundational data format and card definitions before tackling the integrated combat system. The highest-risk systems (Situation System, Card System) should be prototyped early, even before all GDDs are complete, to validate the core loop.

Game pillars: **Caos Ordenado** (ordered chaos), **Decisiones Rápidas** (10-second decisions), **Situaciones como Escenario Narrativo**, **Caos como Oportunidad**, **Rejugabilidad por Combinaciones**.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Data Configuration System | Foundation | MVP | Designed | design/gdd/data-configuration-system.md | — |
| 2 | Scene Management System | Foundation | MVP | Designed | design/gdd/scene-management-system.md | — |
| 3 | Card System | Core Gameplay | MVP | Designed | design/gdd/card-system.md | Data Configuration |
| 4 | Status Effect System (inferred) | Core Gameplay | MVP | Designed | design/gdd/status-effect-system.md | Card System |
| 5 | Situation System | Core Gameplay | MVP | Designed | design/gdd/situation-system.md | Card System |
| 6 | Player Character System | Character | MVP | Designed | design/gdd/player-character-system.md | Card System, Status Effect System |
| 7 | Enemy System | Character | MVP | Designed | design/gdd/enemy-system.md | Status Effect System |
| 8 | Relic System | Progression | MVP | Not Started | — | Card System, Status Effect System |
| 9 | Combat System | Core Gameplay | MVP | Not Started | — | Card System, Situation System, Status Effect System, Player Character System, Enemy System |
| 10 | Deck Building System | Progression | MVP | Not Started | — | Card System, Relic System, Combat System |
| 11 | Node Map System | Progression | MVP | Not Started | — | Combat System |
| 12 | Save System (inferred) | Persistence | MVP | Not Started | — | Combat System, Node Map System, Deck Building System, Player Character System |

---

## Categories

| Category | Description | Systems in This Game |
|----------|-------------|----------------------|
| **Foundation** | Infrastructure everything else plugs into | Data Configuration, Scene Management |
| **Core Gameplay** | The systems that define what the player does each turn | Card System, Status Effect System, Situation System, Combat System |
| **Character** | Player and enemy design rules | Player Character System, Enemy System |
| **Progression** | How a run evolves across encounters | Deck Building System, Relic System, Node Map System |
| **Persistence** | Run state continuity | Save System |

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|------------|------------------|----------------|
| **MVP** | Required for the core loop to function. Without these, you can't test "is this fun?" | First playable prototype (2–3 weeks) | Design FIRST |
| **Vertical Slice** | Required for one complete, polished experience (+2 characters, 40 cards, 2 acts) | Weeks 6–8 | Design SECOND |
| **Alpha** | All features present in rough form | 4–5 months | Design THIRD |
| **Full Vision** | Polish, meta, content-complete | 8–12 months | Design as needed |

*Note: All 12 systems are MVP. This is an aggressive scope for 2–3 weeks. Recommended approach: write GDDs 1–5 first, begin coding against them in parallel while writing GDDs 6–9. Save System can be the last MVP item — the core loop is playable without it.*

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **Data Configuration System** — defines the file format and loading pipeline for all card, Situación, enemy, and relic data; everything else is data-driven from this
2. **Scene Management System** — the state machine that governs transitions between Menu, Map, Encounter, Reward, and GameOver screens; no game state can exist without it
3. **Card System** — defines the atomic unit of the game: what a card IS, what Impulso IS, how the hand of 4 works; almost every other system references "a card"

### Core Layer (depends on Foundation)

1. **Status Effect System** — depends on: Card System. Defines status states (Vergüenza, Confianza Excesiva, Sospechoso, Inspirado), their timing, stacking rules, and how they modify card costs and character behavior.
2. **Situation System** — depends on: Card System. Defines Situaciones as active field rules: how they are structured, how they modify the meaning and effectiveness of cards in context, and how they are selected per encounter.

### Feature Layer (depends on Core)

1. **Player Character System** — depends on: Card System, Status Effect System. El Improvisador's stats, Idea Brillante accumulation mechanic (triggered by negative effects), and the rules for the player's base character.
2. **Enemy System** — depends on: Status Effect System. Enemy design rules, the intention system (how enemies telegraph their next action), boss design rules, and how enemies apply and receive statuses.
3. **Relic System** — depends on: Card System, Status Effect System. What relics are, how passive effects trigger on game events, acquisition rules, and the 6 MVP relics with their effect definitions.
4. **Combat System** — depends on: Card System, Situation System, Status Effect System, Player Character System, Enemy System. Encounter turn structure, turn phases, win/loss conditions per encounter, and how the encounter outcome flows into the reward screen.

### Progression Layer (depends on Feature)

1. **Deck Building System** — depends on: Card System, Relic System, Combat System. Post-encounter reward rules: the 4 reward options (add card / upgrade card / remove card / gain relic), how card upgrades work, and the rules that govern what the player is offered.
2. **Node Map System** — depends on: Combat System. The 6-node map structure, node types in MVP (combat, basic event, rest, boss — shop and full mission system are post-MVP), routing rules, and how map position determines run arc.

### Persistence Layer (depends on everything)

1. **Save System** — depends on: Combat System, Node Map System, Deck Building System, Player Character System. What run state to persist (current deck, HP, map position, active statuses, relics), when to save (after each encounter resolution), and how to handle incomplete saves on web tab close.

---

## Recommended Design Order

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | Data Configuration System | MVP | Foundation | game-designer + godot-gdscript-specialist | S |
| 2 | Scene Management System | MVP | Foundation | godot-specialist | S |
| 3 | Card System | MVP | Foundation | game-designer + systems-designer | L |
| 4 | Status Effect System | MVP | Core | systems-designer | M |
| 5 | Situation System | MVP | Core | game-designer + systems-designer | L |
| 6 | Player Character System | MVP | Feature | game-designer | S |
| 7 | Enemy System | MVP | Feature | game-designer + ai-programmer | M |
| 8 | Relic System | MVP | Feature | economy-designer | M |
| 9 | Combat System | MVP | Feature | game-designer + systems-designer | L |
| 10 | Deck Building System | MVP | Progression | economy-designer + game-designer | M |
| 11 | Node Map System | MVP | Progression | game-designer | M |
| 12 | Save System | MVP | Persistence | godot-specialist | S |

*Effort: S = 1 session, M = 2–3 sessions, L = 4+ sessions. Systems at the same layer (e.g., Status Effect + Situation) can be designed in parallel.*

---

## Circular Dependencies

- **None found.** The dependency graph is acyclic.

One near-circular relationship to watch: Relic System and Deck Building System. Some relics may trigger on deck building events ("after each encounter, upgrade a random card"). This is resolved by defining Relic System effects as "hooks into named game events" rather than having Relic depend on Deck Building internals. The Deck Building GDD defines the event names; the Relic GDD defines which events relics can hook into.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| **Situation System** | Design | Situaciones may feel random if card × Situación interactions aren't learnable. The concept explicitly flags: "puede sentirse aleatorio si las interacciones con cartas no son suficientemente legibles." | Prototype with 5 Situaciones × 20 cards before finalizing the system design. Each Situación must have a clear mechanical rule the player can internalize in one reading. |
| **Card System** | Design / Scope | Impulso economy (3 Impulso/turn, cards cost 0–3) is the entire turn engine. If this is wrong, everything built on top of it is wrong. Hard to change after other systems reference it. | Prototype the Impulso economy before writing the GDD. Start with one 10-card deck and 5 Situaciones; tune Impulso until turns feel satisfying. |
| **Status Effect System** | Design | Statuses interacting with Situaciones creates a multiplicative interaction space. Balancing cards against multiple possible Situaciones + active statuses is the hardest testing problem in the game. | Limit MVP status effects to simple, non-conditional modifications (e.g., "costs 1 less Impulso," "takes 1 extra damage"). No status effects with complex conditional triggers in MVP. |
| **Data Configuration System** | Technical | "Si requiere código por Situación, el desarrollo se ralentiza" (from concept). The data format must be expressive enough for all Situación effect types without custom code per Situación. | Design the data schema first. Validate with 3 diverse prototype Situaciones (a combat-modifier, a social-modifier, and an absurd wildcard). If all 3 can be expressed in data, the schema works. |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 12 |
| Design docs started | 6 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 7 / 12 |
| Vertical Slice systems designed | 0 / 0 (no VS-exclusive systems) |

---

## Next Steps

- [ ] Run `/design-system data-configuration-system` — first GDD to write
- [ ] Run `/design-system card-system` — highest-priority gameplay GDD after Data Config
- [ ] Prototype Impulso economy before finalizing Card System GDD
- [ ] Prototype 5 Situaciones × 20 cards before finalizing Situation System GDD
- [ ] Run `/design-review design/gdd/[system].md` after each GDD is authored
- [ ] Run `/gate-check pre-production` when all MVP GDDs are complete
