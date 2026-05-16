---
sidebar_position: 1
title: Concepto del Juego
description: Documento de concepto completo de Caos en Mano — género, pilares, core loop, MVP.
---

# Game Concept: Caos en Mano

*Created: 2026-05-13*
*Status: Draft*

---

## Elevator Pitch

> Un roguelike deckbuilder táctico donde las cartas son "decisiones de escena": improvisás soluciones absurdas a situaciones ridículas con una mini-mano limitada. Sos un aventurero incompetente que convierte cada desastre en una victoria caótica pero estratégica.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Roguelike deckbuilder táctico |
| **Platform** | PC (Steam) + Web (itch.io) |
| **Target Audience** | Jugadores de roguelikes indie itch.io, 18–35 años |
| **Player Count** | Single-player |
| **Session Length** | 10–20 minutos por run |
| **Monetization** | Premium |
| **Estimated Scope** | Small–Medium (2–3 semanas MVP; 8–12 meses versión completa, solo dev) |
| **Comparable Titles** | Slay the Spire, Dicey Dungeons, Inscryption |

---

## Core Fantasy

Sos el héroe caótico que convierte cada desastre en una victoria ridícula pero estratégica. Las cosas salen mal — y eso es exactamente el plan. Cada run cuenta una mini-historia absurda propia: la vez que ganaste al dragón con un pato y un discurso motivacional innecesario, o la vez que derrotaste al ogro convenciéndolo de que eras su abogado. Nadie más va a tener tu historia.

---

## Unique Hook

Como Slay the Spire, PERO ADEMÁS cada encuentro tiene una Situación activa que cambia las reglas de juego para todos — las cartas no son herramientas genéricas de combate sino acciones narrativas cuyo significado cambia según el escenario. Una "Mentira Convincente" es poderosa en una "Audiencia Real" e inútil contra un "Monstruo Tímido". El humor emerge del contraste situación-acción, no de las cartas en aislamiento.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 4 | Feedback visual expresivo, impactos con squash/stretch, texto humorístico |
| **Fantasy** (make-believe, role-playing) | 2 | Personaje incompetente pero ingenioso, mundo medieval absurdo |
| **Narrative** (drama, story arc) | 3 | Micronarrativas emergentes por run; misiones con nombres y reglas propias |
| **Challenge** (obstacle course, mastery) | 5 | Curva de aprendizaje de Situaciones y sinergias de cartas |
| **Fellowship** (social connection) | N/A | Single-player |
| **Discovery** (exploration, secrets) | 1 | Nuevas Situaciones, cartas, reliquias y sinergias en cada run |
| **Expression** (self-expression, creativity) | 6 | Construcción de mazo y elección de estrategia |
| **Submission** (relaxation, comfort zone) | N/A | No es un juego relajante |

### Key Dynamics (Emergent player behaviors)

- Los jugadores experimentarán con cartas "absurdas" para descubrir que tienen patrones aprendibles en contexto de Situación.
- Los jugadores comenzarán a leer la Situación activa antes de leer su mano — aprendiendo a priorizar el escenario sobre las cartas.
- Los jugadores compartirán historias de runs específicas ("le gané al ogro con solo una silla plegable y Mentira Convincente").
- Los jugadores buscarán deliberadamente ciertas reliquias para habilitar combos absurdos específicos.

### Core Mechanics (Systems we build)

1. **Sistema de Cartas con Impulso** — Mano de 4 cartas, 3 Impulsos por turno; cartas cuestan 0–3; jugar cartas resuelve la escena
2. **Sistema de Situaciones** — Cada encuentro tiene una Situación activa que actúa como regla de campo narrativa, afectando el significado y efectividad de las cartas
3. **Construcción de Mazo por Run** — Mazo inicial de 10 cartas; tras cada encuentro se elige entre añadir, mejorar, eliminar carta o ganar reliquia
4. **Sistema de Estados Alterados** — Estados con personalidad temática (Vergüenza, Confianza Excesiva, Sospechoso, Inspirado) para jugador y enemigos
5. **Mapa de Nodos** — 6 nodos con elecciones de ruta: combate, evento, tienda, descanso, misión rara, jefe

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | Cada turno ofrece múltiples líneas de juego válidas; elección de ruta, mazo y estrategia | Core |
| **Competence** (mastery, skill growth) | Aprender los patrones de Situaciones y sinergias de cartas; el sistema es profundo pero legible | Core |
| **Relatedness** (connection, belonging) | El humor y la personalidad del mundo crean relación con el juego; las micronarrativas emergentes son "tuyas" | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — Cómo: completar runs, encontrar todas las reliquias, desbloquear personajes
- [x] **Explorers** (discovery, understanding systems, finding secrets) — Cómo: descubrir Situaciones nuevas, sinergias de cartas, interacciones inesperadas *(tipo de jugador primario)*
- [ ] **Socializers** — N/A (single-player)
- [ ] **Killers/Competitors** — N/A

### Flow State Design

- **Onboarding curve**: Los primeros 3 minutos enseñan solo Impulso + cartas básicas. La primera Situación aparece en el encuentro 2. El sistema se revela progresivamente.
- **Difficulty scaling**: Las Situaciones se vuelven más complejas por acto. Los enemigos ganan mecánicas especiales. El jugador enfrenta decisiones más difíciles con mazos más desarrollados.
- **Feedback clarity**: Cada carta jugada muestra su efecto inmediatamente. Los estados alterados tienen iconos claros. Las Situaciones explican sus reglas en una línea.
- **Recovery from failure**: La run dura 10–20 minutos; la muerte es rápida de volver a intentar. Sin metaprogresión que perder — el conocimiento ganado es el progreso real.

---

## Core Loop

### Momento a Momento (30 segundos)

Robás 4 cartas. Leés la Situación activa y la intención del enemigo. Gastás Impulso jugando 1–3 cartas que resuelven la escena. La satisfacción viene de sobrevivir lo impredecible — el caos es algo que se juega, no algo que te pasa.

### Corto Plazo (5–15 minutos)

Completás un encuentro → elegís recompensa (carta/reliquia/mejora/eliminación) → avanzás en el mapa → el siguiente encuentro tiene una Situación diferente. El "una más" vive en cada elección de recompensa y en cada nodo de mapa.

### Nivel Sesión (10–20 minutos)

Un run completo termina en victoria sobre el jefe o en muerte. El hook fuera de sesión: "¿qué hubiera pasado si jugaba Botón Rojo en el encuentro 5?" La microhistoria de la run se queda en la cabeza.

### Progresión a Largo Plazo

En MVP: solo progresión por conocimiento — el jugador aprende los patrones de Situaciones, sinergias de cartas, qué reliquias priorizar. En versión completa: desbloqueo de personajes adicionales, reliquias permanentes, misiones especiales.

### Retention Hooks

- **Curiosidad**: "¿Qué hace la Situación X que aún no encontré?" / "¿Qué combinación activa este estado especial?"
- **Inversión**: La microhistoria de la run actual. El mazo que estás construyendo.
- **Maestría**: Aprender a leer Situaciones + mano en 5 segundos. Desbloquear el potencial de cartas que parecían débiles.

---

## Game Pillars

### Pilar 1: Caos Ordenado

Todo parece impredecible, pero el jugador puede aprender el sistema. El azar está en la *situación*, no en la *decisión*.

*Test de diseño*: Si debatimos entre un efecto con probabilidad oculta vs. uno con rango visible → elegimos rango visible.

### Pilar 2: Decisiones Rápidas

Mano pequeña, reglas claras, resolución inmediata. Cero análisis paralizante.

*Test de diseño*: Si una mecánica requiere más de 10 segundos para entender → cortarla o simplificarla antes de incluirla.

### Pilar 3: Situaciones como Escenario Narrativo

Las Situaciones son el *contexto* que da significado a cada carta. El humor emerge del contraste situación-acción, no de las cartas en aislamiento.

*Test de diseño*: Si una carta es graciosa sola pero no interactúa de ninguna manera con la Situación activa → no es suficiente para el juego.

### Pilar 4: Caos como Oportunidad

Los errores y efectos negativos tienen potencial de convertirse en ventajas. El jugador puede perder por mala decisión; nunca debe perder solo por mala suerte.

*Test de diseño*: Si una mecánica puede causar derrota sin que el jugador haya tenido ninguna decisión con agency → rediseñarla.

### Pilar 5: Rejugabilidad por Combinaciones, no por Volumen

La variedad viene de combinar elementos existentes (Situaciones × cartas × reliquias × personajes), no de tener centenas de cada uno.

*Test de diseño*: Antes de agregar contenido nuevo → ¿el contenido existente ya genera suficientes combinaciones interesantes? Si no, agregar; si sí, optimizar primero.

### Anti-Pilares (Lo que este juego NO es)

- **NO mazos de 40+ cartas**: Rompería Decisiones Rápidas y la claridad de la mano pequeña.
- **NO azar puro**: Ningún efecto determina victoria/derrota sin agency del jugador — viola Caos como Oportunidad.
- **NO encuentros sin Situación**: Cada combate necesita contexto narrativo; sin él, el juego es un deckbuilder genérico.
- **NO metaprogresión en MVP**: Agrega scope y distrae del core loop a validar.
- **NO tiempo real**: Rompe el espacio de improvisación táctica del jugador.

---

## Visual Identity Anchor

**Dirección**: Garabato Medieval Expresivo

**Regla visual central**: Cada elemento debe parecer sacado de un cuaderno de aventuras mal dibujado pero con mucha personalidad.

**Principios de soporte**:

1. **Siluetas claras > detalles finos** — Los personajes son reconocibles por su forma, no por su textura. *Test*: Si el personaje no se lee en 2 colores planos → la silueta necesita trabajo.
2. **Expresividad > precisión** — Animaciones squash/stretch exageradas, poses dramáticas, impactos grandes. *Test*: Si la animación se puede describir como "suave y naturalista" → agregarle más exageración.
3. **UI como objeto físico** — La interfaz parece hecha de papel, madera y garabatos, no de pixels flotantes. *Test*: Si un elemento de UI no tiene "peso" físico en el mundo → integrarlo visualmente al escenario.

**Filosofía de color**: Colores saturados y cálidos para el caos y el humor. Tonos más desaturados cuando hay amenaza real. El humor tiene color vivo; la tensión lo pierde.

---

## Inspiración y Referencias

| Referencia | Qué tomamos | Qué hacemos diferente | Por qué importa |
| ---- | ---- | ---- | ---- |
| Slay the Spire | Loop de deckbuilding roguelike; mazo compacto y progresión por run | Las Situaciones añaden una capa narrativa/contextual que STS no tiene | Valida que el loop base puede ser adictivo |
| Dicey Dungeons | Humor emergente, mecánicas absurdas con reglas claras, sesiones cortas | Más agencia del jugador; el azar está en el contexto, no en la resolución | Valida que humor y estrategia son compatibles |
| Inscryption | Micronarrativas emergentes por run; cada run cuenta una historia | Nuestro humor es slapstick, no horror; scope mucho más pequeño | Valida que los jugadores de roguelikes valoran las historias emergentes |

**Inspiraciones no-videojuego**: Comedias de improvisación teatral (las Situaciones como "escenas" de improv); cómics de aventura caótica; burocracia medieval absurda al estilo Terry Pratchett.

---

## Perfil del Jugador Objetivo

| Atributo | Detalle |
| ---- | ---- |
| **Rango de edad** | 18–35 |
| **Experiencia de juego** | Mid-core — jugador frecuente de roguelikes indie |
| **Disponibilidad de tiempo** | Sesiones de 20–40 minutos en cualquier momento |
| **Plataforma preferida** | PC / Web (itch.io) |
| **Juegos actuales** | Slay the Spire, Brotato, Vampire Survivors, roguelikes de itch.io |
| **Lo que buscan** | Un roguelike con personalidad y mecánicas novedosas, no otro clon |
| **Lo que los alejaría** | Aleatoriedad pura sin agency; humor que interrumpe el ritmo; mazos de 50 cartas |

---

## Consideraciones Técnicas

| Consideración | Evaluación |
| ---- | ---- |
| **Engine** | Godot 4.6 — scope pequeño, export limpio a HTML5, ideal para dev solo |
| **Desafíos técnicos clave** | Sistema de Situaciones modular y data-driven; balanceo de interacciones carta × situación × estado |
| **Estilo de arte** | 2D dibujado a mano, estilo cuaderno/garabato expresivo |
| **Complejidad del pipeline de arte** | Baja-Media — sprites 2D, animaciones simples con squash/stretch, sin 3D |
| **Necesidades de audio** | Moderadas — SFX de cartas y situaciones con personalidad; música de fondo temática |
| **Networking** | Ninguno |
| **Volumen de contenido** | MVP: 20 cartas, 8 Situaciones, 6 enemigos, 6 reliquias, 1 jefe; Full: 60+ cartas, 25+ Situaciones, 3 actos |
| **Sistemas procedurales** | Mapa de nodos semi-aleatorio; orden de encuentros aleatorio dentro de actos |

---

## Riesgos y Preguntas Abiertas

### Riesgos de Diseño

- El sistema de Situaciones puede sentirse aleatorio si las interacciones con cartas no son suficientemente legibles — el jugador necesita ver el patrón para sentir control.
- La mini-mano puede generar frustración si hay demasiadas situaciones de "no tengo ninguna carta útil aquí".
- El humor puede cansar si las Situaciones son variaciones del mismo chiste en vez de reglas mecánicamente distintas.

### Riesgos Técnicos

- Export HTML5 de Godot 4.6 puede tener issues de performance en dispositivos móviles web.
- El sistema de Situaciones necesita ser data-driven para poder añadir contenido rápido; si requiere código por Situación, el desarrollo se ralentiza.
- Balancear cartas contra múltiples Situaciones posibles aumenta la complejidad de testing.

### Riesgos de Mercado

- El espacio de roguelike deckbuilders en itch.io es competitivo — la personalidad y el diferencial de Situaciones deben ser evidentes en los primeros 30 segundos.
- Timeline de semanas con primer juego es agresivo; el riesgo de no terminar el MVP es real.

### Riesgos de Scope

- El concepto original tiene 6+ sistemas diseñados — el MVP debe cortar agresivamente todo lo que no sea necesario para probar el loop.
- Arte "con identidad" en semanas es difícil sin assets pre-existentes o un estilo muy deliberadamente simple.

### Preguntas Abiertas

- ¿Las Situaciones narrativas generan suficiente variedad con 8 Situaciones iniciales, o se sienten repetitivas antes del jefe? — Respuesta: primer playtest del prototipo.
- ¿El recurso "Impulso" se siente temáticamente diferente a "energía" en la práctica, o es solo renombre cosmético? — Respuesta: testear naming con primeros jugadores.
- ¿Cuántas interacciones carta × situación son necesarias para que el sistema se sienta profundo sin ser abrumador? — Respuesta: prototipo con 5 Situaciones × 20 cartas.

---

## Definición del MVP

**Hipótesis central**: Los jugadores encuentran que resolver Situaciones absurdas con una mini-mano de cartas genera microhistorias divertidas que dan ganas de repetir el run.

**Requerido para MVP**:

1. Sistema de cartas funcional: mano de 4, Impulso, 20 cartas con tipos variados
2. Sistema de Situaciones: 5–8 Situaciones activas con reglas claras que afectan el contexto narrativo
3. Al menos 1 personaje (El Improvisador) con su mecánica especial (Idea Brillante)
4. 5–6 enemigos con intenciones legibles y 1 jefe
5. Mapa de 6 nodos con elección de recompensa post-encuentro
6. Export funcional a Web (itch.io)

**Explícitamente FUERA del MVP**:

- Metaprogresión permanente
- Múltiples personajes jugables
- Arte final (placeholder aceptable)
- 3 actos completos
- Sistema completo de misiones con reglas especiales
- Tienda in-run

### Scope Tiers

| Tier | Contenido | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 1 personaje, 20 cartas, 8 Situaciones, 6 enemigos, 1 jefe, mapa 6 nodos | Core loop, Situaciones, recompensas básicas | 2–3 semanas |
| **Vertical Slice** | +2 personajes, 40 cartas, 15 Situaciones, 2 actos | Construcción de mazo completa, más estados alterados | 6–8 semanas |
| **Alpha** | Contenido completo placeholder | Todas las features rough, 3 actos | 4–5 meses |
| **Versión Completa** | 60+ cartas, 25+ Situaciones, 3 personajes, metaprogresión | Todas las features pulidas, Steam + itch.io | 8–12 meses (solo dev) |

---

## Próximos Pasos

- [ ] `/setup-engine` — configurar Godot 4.6 y poblar docs de referencia de versión
- [ ] `/art-bible` — establecer identidad visual antes de escribir GDDs (usar Visual Identity Anchor de este documento como semilla)
- [ ] `/design-review design/gdd/game-concept.md` — validar completitud del concepto
- [ ] `/map-systems` — descomponer en sistemas individuales con dependencias
- [ ] `/design-system [primer-sistema]` — GDDs por sistema en orden de dependencia
- [ ] `/create-architecture` — blueprint de arquitectura master
- [ ] `/gate-check` — validar antes de comprometerse a producción
- [ ] `/prototype core-loop` — validar si el loop de Situaciones + mini-mano es divertido
- [ ] `/playtest-report` — documentar el playtest del prototipo
- [ ] `/sprint-plan new` — planificar el primer sprint si el prototipo es validado
