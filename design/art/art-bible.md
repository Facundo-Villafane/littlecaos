# Art Bible — Caos en Mano

*Created: 2026-05-14*
*Status: In Progress*
*Engine: Godot 4.6 | Platform: PC (Steam) + Web (itch.io)*

> **Technical Constraint (editor-first)**: Todo el arte debe ser visible y editable en el editor de Godot sin ejecutar el juego. No efectos que solo aparezcan en runtime. Sprites, tilemaps, materiales 2D y luces son editables en editor — ese es el límite del pipeline.

---

## 1. Visual Identity Statement

**Regla visual central**:
> *"Every element looks like a medieval adventurer drew it in their travel journal during an emergency — recognizable, expressive, and slightly wrong on purpose."*

Esta regla resuelve ambigüedad en la práctica:
- Un caballero con proporciones correctas y anatomía precisa → **RECHAZAR** (demasiado preciso)
- Un caballero con casco demasiado grande y espada que se dobla bajo su peso → **APROBAR**
- Una barra de vida con gradiente suave y bordes redondeados → **RECHAZAR** (sin peso físico, sin calidad de "journal")
- Una barra de vida que parece marcas de tiza en pergamino → **APROBAR**
- Un efecto de partículas que lee como VFX de producción profesional → **RECHAZAR**
- Un efecto de partículas que lee como "alguien dibujó líneas de velocidad muy rápido" → **APROBAR**

### Principios de soporte

**Principio 1: The Silhouette Test**
Cualquier personaje, enemigo, carta o elemento de UI debe ser identificable desde su silueta sola, rellena en dos colores planos, al tamaño mínimo en que aparece en juego.

*Test de diseño*: Cuando dos diseños de enemigo compiten, gana el que tenga la silueta más distinta de todos los demás enemigos del juego — independientemente de cuál tenga mejor detalle interno.

*Pilar*: Decisiones Rápidas — si el jugador necesita 3 segundos para identificar qué está mirando, la ventana de decisión de 10 segundos ya está comprometida.

---

**Principio 2: Squash, Stretch, and Exaggerate Everything**
Ninguna animación, pose o impacto lee como "naturalista". Todo el movimiento está exagerado más allá del realismo hacia la expresión de cartoon. La anticipación es grande; el follow-through es más grande aún.

*Test de diseño*: Cuando una animación se siente completa, agregarle 20% más exageración. Si ahora lee como slapstick, es correcta. Si todavía lee como "suave y anclada", agregar otro 20%.

*Pilar*: Caos como Oportunidad — el lenguaje visual del slapstick (el impacto exagerado, la física incorrecta, la consecuencia absurda) le enseña al jugador que el caos es performativo y sobrevivible, no amenazante.

---

**Principio 3: UI Has Mass**
Cada elemento de interfaz tiene un referente físico. Los botones son letreros de madera o notas de papel. Los paneles son tablones de anuncios, pergaminos o corcheras. Los indicadores de salud son marcas de conteo. Nada flota en espacio digital neutro.

*Test de diseño*: Al diseñar cualquier elemento de UI, preguntarse "¿de qué estaría hecho esto si existiera en este diario de aventuras?" Si la respuesta es "píxeles en una pantalla", rediseñar. El referente físico no necesita ser literal — una textura de papel está bien; un toggle estilo iOS no lo está.

*Pilar*: Situaciones como Escenario Narrativo — cuando la barra de salud parece marcas a lápiz y la mano de cartas parece fichas de índice sostenidas en un puño, cada decisión se siente embebida en la escena.

### Estilo confirmado

**Hand-drawn estilizado (no pixel art)**. La identidad del juego está construida sobre "garabato" — una marca hecha bajo presión. El pixel art destruye esa lectura porque siempre comunica craftsmanship deliberado. La tolerancia del estilo garabato a la imperfección es también una ventaja de producción para dev solo: un asset al 80% de polish sigue siendo on-brand.

*Fallback si se prueba pixel art*: fills de color pixelados + linework dibujado a mano como capa separada. Evitar "pixel art con texturas mano alzada encima" (peor de los dos mundos).

### La identidad visual sirve la core fantasy

El core fantasy es "convertir el desastre en victoria ridícula" — lo que es una performance, no solo un resultado mecánico. El estilo garabato comunica que el mundo mismo es improvisado: la armadura del enemigo está sostenida con cuerda dibujada por alguien que claramente estaba adivinando, y la UI parece ensamblada con materiales encontrados en pánico. Cuando cada elemento visual transmite "esto fue inventado sobre la marcha", las soluciones absurdas del jugador se sienten nativas a ese mundo en lugar de en contraste con él.

---

## 2. Mood & Atmosphere

*Principio rector*: Cada estado de juego es una "escena de improvisación teatral" distinta. Las transiciones no son fades — son cambios de escena: la iluminación cae, el decorado se mueve, sube la iluminación nueva.

*Implementación*: Todo usa `CanvasModulate` para color grading global, `PointLight2D` / `DirectionalLight2D` para iluminación dramática. Cero efectos runtime-only. Todo editable en editor.

### Estados

**Mapa de Nodos**
- Emoción: Anticipación curiosa — hojear el siguiente capítulo antes de leerlo
- Temperatura: Ámbar cálido (~3200K), `CanvasModulate: Color(1.0, 0.93, 0.78)` — luz de vela sobre pergamino
- Contraste: Bajo. `DirectionalLight2D` desde arriba-izquierda a 25°, energy 0.4
- Energía: Contemplativo — el único estado donde el jugador se detiene con calma
- Elemento clave: `PointLight2D` central con textura de halo irregular (dibujada a mano) sobre el nodo actual. Los nodos no visitados quedan en la zona más oscura del gradiente.

**Encuentro Activo**
- Emoción: Urgencia juguetona — presión de improvisar en 10 segundos, pero disfrutándolo
- Temperatura: Neutra-cálida, `CanvasModulate: Color(1.0, 0.97, 0.9)` — casi blanco de día
- Contraste: Medio-alto. `DirectionalLight2D` frontal 90°, energy 0.6
- Energía: Medido con picos — deliberado entre cartas, pico en cada carta jugada
- Elemento clave: `PointLight2D` amarillo sobre la Situación activa (energy 1.2) — literalmente "bajo el spotlight". Segundo `PointLight2D` más tenue (energy 0.6) sobre la mano del jugador.

**Situación Especial**
- Emoción: Disonancia cómica escalada — algo salió mal de una manera simultáneamente alarmante y ridícula
- Variante absurda/cómica: `CanvasModulate: Color(0.85, 1.0, 0.7)` — verde ácido. Lenguaje de horror, tono de comedia.
- Variante peligrosa: `CanvasModulate: Color(1.0, 0.75, 0.6)` — rojo-naranja oscuro
- Contraste: Alto. `DirectionalLight2D` lateral (180°), energy 0.8 — sombras en caras, drama teatral
- Energía: Frenético. Animaciones empujan squash/stretch al límite.
- Elemento clave: Sprite de contorno dibujado a mano sobre la Situación activa con animación de scale entre 0.98–1.02 en loop. Color según variante.
- *Implicación de datos*: Cada `SituationData` tiene campo `tipo: absurda | peligrosa`.

**Recompensa**
- Emoción: Placer de coleccionista satisfecho — alivio post-combate + curiosidad por las nuevas opciones
- Temperatura: Cálida brillante, `CanvasModulate: Color(1.0, 1.0, 0.95)` — el estado más claro y cálido
- Contraste: Bajo. Iluminación plana y generosa.
- Energía: Contemplativo con chispa
- Elemento clave: Cada opción de recompensa tiene su propio `PointLight2D` con halo dibujado a mano (energy 0.9). En hover: energy → 1.4 via Tween.

**Jefe**
- Emoción: Gravedad absurda — esto importa de verdad, pero el jefe mismo es ridículo
- Temperatura: Frío con acento caliente. `CanvasModulate: Color(0.78, 0.85, 1.0)` — azul-pizarra, cielo antes de tormenta
- Contraste: Máximo. El fondo más oscuro del juego. El jefe iluminado por `PointLight2D` desde abajo (energy 1.5, `Color(1.0, 0.7, 0.4)`) — único estado con iluminación inferior.
- Energía: Medido y grave con picos de urgencia. Ritmo más lento entre cartas.
- Elemento clave: Contraste térmico caliente/frío. `PointLight2D` inferior cálido + acento azul-frío desde arriba (energy 0.4) para separación de borde. Exclusivo del estado Jefe.

**Derrota**
- Emoción: Decepción dramáticamente exagerada — no desesperación, sino el equivalente del personaje de cartoon que cae y levanta una banderita de "rendido"
- Temperatura: Muy frío y desaturado. `CanvasModulate: Color(0.7, 0.75, 0.85)` — todo pierde color
- Contraste: Bajo. Sin `PointLight2D`. La escena "se apaga".
- Energía: Caída total. Un beat de pausa.
- Elemento clave: `CanvasModulate` transita via Tween en 0.8s (el más lento del juego — la caída se siente). Animación de derrota del personaje: squash/stretch máxima, caída de cartoon.

**Victoria de Run**
- Emoción: Euforia de "lo logré de alguna manera" — el grito de alguien que no esperaba que su plan funcionara
- Temperatura: Muy cálida, muy saturada. `CanvasModulate: Color(1.0, 0.95, 0.7)` — dorado total
- Contraste: Ninguno. Sin sombras. El mundo no puede contenerse.
- Energía: Máxima del juego.
- Elemento clave: Transición más rápida (0.5s). Múltiples `PointLight2D` de confeti con stagger via Tween. Animación de victoria: la más exagerada del juego, bounce final.

**Menú Principal**
- Emoción: Invitación cálida — ver el título de un libro que ya querés leer
- Temperatura: Ámbar de taberna, `CanvasModulate: Color(0.98, 0.88, 0.72)` — más festivo que el Mapa de Nodos
- Contraste: Medio. Fondo oscuro, título bajo halo de luz cálida.
- Energía: Bajo y estable. Sin urgencia.
- Elemento clave: `PointLight2D` centrado sobre el título (energy 1.0, halo dibujado a mano). El título es el elemento más iluminado de toda la pantalla.

### Mapa de Transiciones

| De | A | Tipo | Duración |
|---|---|---|---|
| Menú → Mapa de Nodos | "Se abre el cuaderno" — `CanvasModulate` cambia | 0.6s |
| Mapa → Encuentro Activo | Corte a negro (0.1s) + fade-in (0.3s) | 0.4s |
| Encuentro → Situación Especial | Flash del color de la situación → `CanvasModulate` cambia | 0.5s |
| Encuentro → Recompensa | `CanvasModulate` se ilumina sin negro | 0.4s |
| Recompensa → Mapa | `CanvasModulate` transita a pergamino | 0.5s |
| Encuentro → Jefe | Corte a negro (0.2s) + fade-in lento (0.6s) — beat de pausa | 0.8s |
| Encuentro → Derrota | Drain de color en 0.8s (el más lento) | 0.8s |
| Encuentro → Victoria | Flash dorado en 0.5s (el más rápido) | 0.5s |
| Derrota → Menú | Negro en 0.5s, luego Menú | 1.0s |
| Victoria → Menú | Idem con beats de celebración antes | 2.0s+ |

**Regla de transición**: Solo 2 cortes a negro permitidos (Mapa→Encuentro y Pre-Jefe). Todos los demás estados transitan via `CanvasModulate` sin negro. Esto refuerza "escenas de improv encadenadas", no loading screens.

---

## 3. Shape Language

*Principio rector*: La "regla del diario bajo presión" produce tres realidades geométricas: (1) las líneas rectas nunca son perfectamente rectas — se arquean levemente, (2) las formas cerradas nunca cierran perfectamente — hay gaps, sobrepases y dobles trazos, (3) las proporciones se distorsionan hacia el rasgo expresivo del objeto, no hacia la precisión anatómica.

### 3.1 Siluetas de Personajes

**Regla del rasgo dominante único**: Cada arquetipo de personaje debe ser identificable por UN elemento geométrico que no se puede confundir con otro arquetipo.

| Arquetipo | Rasgo dominante | Geometría |
|-----------|----------------|-----------|
| **Héroe (El Improvisador)** | Asimetría vertical + centro de masa bajo | Forma de pera — piernas ligeramente anchas, torso estrecho, cabeza grande. Un brazo siempre haciendo algo ligeramente incorrecto (gesto, objeto en ángulo raro). Comunica "en medio de improvisar". |
| **Enemigo estándar** | Una parte del cuerpo exageradamente grande que define toda la lectura | El rasgo dominante ES el personaje: casco 30% más grande que la cabeza, orejas más anchas que el torso, dobladillo de capa más ancho que los hombros. Sin esa parte, son figuras humanas genéricas. |
| **Enemigo élite** | Masa horizontal baja | Más anchos que altos, o cargan algo que los hace anchos. Centro de gravedad más bajo que los estándar. "Anchos y sólidos" vs. "altos y raros". |
| **Jefe** | Incoherencia geométrica deliberada | Combina formas que anatómicamente no pertenecen juntas — redondo en algunas partes, angular en otras. Requiere dos miradas incluso a tamaño completo. Único arquetipo donde violar la claridad de silueta es intencional. |

**Test de thumbnail**: Al tamaño mínimo en juego (~48×48px equivalente), rellenar en dos colores planos. Debe identificarse el arquetipo sin detalle interno. Si falla, revisar silueta antes de agregar detalle.

### 3.2 Geometría de Entornos

**Lenguaje dominante: Orgánico con esqueleto angular estructural**

- **Elementos estructurales** (paredes, pisos, soportes): rectilíneos por naturaleza, dibujados con imprecisión orgánica. Cada línea se arquea 2–5% hacia adentro, bordes superiores irregulares, bloques de piedra con tamaños ligeramente distintos. La arquitectura es lógicamente recta pero dibujada de memoria sin regla.
- **Elementos orgánicos** (vegetación, agua, tela, humo): curvas libres, sin componente de línea recta. Son los únicos elementos del juego con curvas limpias — el contraste es intencional.

**Diagonales amigables**: Los props usan ángulos entre 30° y 60° exclusivamente. Evitar 45° exacto (demasiado preciso), 15° (parece accidente), 80° (demasiado cercano a vertical estructural). El rango 30–60° comunica "fue dejado/apoyado apresuradamente".

**Regla de solapamiento**: Ningún elemento del entorno comparte un borde limpio con su vecino. Las líneas se extienden más allá de las esquinas en vez de detenerse en ellas — como alguien dibujando una escena rápidamente.

### 3.3 Gramática de las Cartas

**Forma base**: Rectángulo redondeado estándar. La identidad de garabato se logra via arte interior, tipografía irregular y trazos de esquinas superpuestos — no via una forma irregular de base. *(Nota de pipeline: un CartoonShader para efecto de línea dibujada a mano queda diferido a la fase de Technical Art.)*

**Jerarquía visual dentro de la carta** (de mayor a menor peso visual):

1. **Costo (Impulso)** — esquina superior izquierda. Círculo pequeño con peso de trazo dibujado a mano. Primera cosa que lee el ojo en orden occidental. El círculo contrasta con el perímetro angular de la carta — lo hace destacar como elemento distinto.
2. **Nombre de la carta** — banner superior, ancho completo. El texto más grande. Tipografía irregular, ligeramente inclinada, peso de letra variable — como letrado a mano. El nombre es una declaración narrativa, no una etiqueta.
3. **Zona de arte** — centro. Más del 40% de la superficie de la carta. Borde irregular (no un recorte rectangular limpio) — como papel pegado con cinta a la carta.
4. **Texto de efecto** — mitad inferior, debajo del arte. Texto más pequeño pero sin aglomeración. Subordinado al arte — la carta es primero una imagen, luego una regla.
5. **Tag de tipo** (opcional) — borde inferior, centrado. El texto más pequeño. Solo en cartas con keyword mecánico.

**Estados visuales de carta:**
- **En mano**: inclinación leve (±5°), cada carta a un ángulo distinto — sostenidas en un puño, no en una grilla
- **Hover/Seleccionada**: sube ~10px Y se endereza a 0° — el cambio de forma señala "activa" sin depender solo del color
- **Jugada**: sale con arco de movimiento siguiendo el ángulo de inclinación que tenía — implica trayectoria física
- **No jugable**: trazo en X encima (como si alguien lo tachó con lápiz). No se decolora — se marca.

### 3.4 Gramática de UI

**La regla de material** (Principio 3: UI Has Mass):

| Elemento UI | Material físico | Consecuencia de forma |
|-------------|-----------------|----------------------|
| Botones | Tablón de madera (letrero) | Rectangular, uno de los extremos con ángulo diferente al otro, líneas de veta visibles |
| Paneles (Situación, info enemigo) | Pergamino clavado | Rectángulo irregular, una esquina ligeramente levantada (sombra implica levantamiento), marca de chinche arriba |
| Indicadores de HP | Barra segmentada dibujada a mano | Celdas tipo regla en fila, rellenas según HP actual — NO una barra suavizada. Borde exterior dibujado a mano irregular. |
| Indicador de Impulso | Círculos en fila en una tira de cuero | N círculos por fila, rellenos según Impulso disponible |
| Tooltip / popup | Papel rasgado | Borde corto irregular (el desgarre), bordes largos relativamente rectos, leve rotación off-axis |
| Nodos del mapa | Impresión de sello de cera | Círculo con borde irregular, marca interior identifica tipo — nunca un círculo plano con etiqueta |

**Hover de botón**: el tablón desarrolla una leve inclinación de 3° (levantado de un extremo) — cambio de forma, no solo de color.

**Pressed de botón**: compresión vertical leve (squash, 0.05s in, 0.15s out).

**Regla dura**: ningún elemento UI puede usar una forma sin referente físico en el mundo del diario de aventuras. No pills suaves estilo toggle, no círculos perfectos como contenedores, no rectángulos con 4px de border-radius uniforme.

### 3.5 Jerarquía Visual en Combate

**Contrato primer plano / fondo**:

| Plano | Características | Qué contiene |
|-------|----------------|--------------|
| **Primer plano** | Muchos vértices en silueta, al menos una proporción exagerada, ángulos irregulares, contraste interior vs. borde | Héroe, enemigo activo, Situación activa, carta activa en mano |
| **Plano medio** | Contorno moderadamente irregular | Enemigos inactivos, cartas en mano no seleccionadas |
| **Fondo** | Pocos vértices, proporciones cercanas a correctas, líneas principalmente verticales/horizontales | Entorno, decoración, paneles de UI no activos |

**El ojo del jugador sigue la irregularidad** — formas más complejas e irregulares = más importante ahora mismo.

**Regla de zona vacía**: el área central entre la mano de cartas y el enemigo queda intencionalmente despejada. Sin props ni UI superpuesta en esa región. El eje de decisión carta→enemigo tiene espacio visual para respirar.

**Lenguaje angular vs. curvo como jerarquía de categoría**: siluetas angulares = entidades del juego (personajes, objetos, peligros). Trazos curvos = elementos de interfaz (cartas, paneles, botones). Dos categorías, dos lenguajes visuales, cero ambigüedad sobre "¿esto es algo que controlo o algo que leo?"

---

## 4. Color System

*Filosofía*: La paleta es la "verdad antes del grading" — los colores del diario de aventuras bajo la CanvasModulate de cada estado. Los colores deben estar suficientemente saturados para sobrevivir las multiplicaciones de canal más extremas (Derrota: `Color(0.7, 0.75, 0.85)`, Jefe: `Color(0.78, 0.85, 1.0)`).

### Paleta Principal (7 colores)

| Nombre | Godot Color() | Hex | Significado semántico |
|--------|---------------|-----|-----------------------|
| **Tinta** | `Color(0.18, 0.12, 0.08)` | #2E1F14 | La tinta del diario. Todos los contornos, texto, sombras. Marrón-negro cálido — nunca negro puro, porque nada en un diario dibujado a mano es negro puro. |
| **Pergamino** | `Color(0.96, 0.88, 0.72)` | #F5E0B8 | La página misma. Tono base de todos los materiales de UI, cartas y paneles. Calma, familiar, pertenece. |
| **Rojo Urgente** | `Color(0.85, 0.22, 0.15)` | #D93826 | El color con el que el aventurero dibujó cuando tenía miedo. Daño, ataques entrantes, Situaciones peligrosas, cartas que cuestan algo real. Nunca decorativo. |
| **Dorado Caos** | `Color(0.95, 0.72, 0.12)` | #F2B71F | El color de cosas que salieron bien contra todo pronóstico. Impulso, poder de cartas, recompensas, victoria. También el color de la luz de vela — el aventurero escribía bajo ella. |
| **Verde Absurdo** | `Color(0.28, 0.72, 0.35)` | #47B859 | El color de cosas que no tienen sentido pero están pasando de todas formas. Situaciones cómicas, estados de status como Vergüenza y Confianza Excesiva. El aventurero usó tinta verde solo cuando escribía algo que no podía creer. **Verde ≠ salud en este juego.** |
| **Azul Gravedad** | `Color(0.25, 0.42, 0.78)` | #406BC7 | El color que el aventurero usó para cosas que genuinamente le daban miedo. Jefe, estados debilitantes serios (Sospechoso), los momentos cuando el caos deja de ser gracioso. Escaso por diseño — su rareza le da peso. |
| **Madera Cálida** | `Color(0.58, 0.35, 0.18)` | #945A2E | El color de los muebles del campamento. Solo para elementos estructurales de UI (botones, marcos). No aparece en personajes ni entornos excepto como madera literal. |

### Neutrales (construcción y sombreado únicamente)

| Nombre | Color() | Hex | Uso |
|--------|---------|-----|-----|
| Sombra Pergamino | `Color(0.72, 0.60, 0.45)` | #B89972 | Sombra sobre superficies de pergamino |
| Luz Pergamino | `Color(1.0, 0.97, 0.90)` | #FFF7E6 | Highlight en pergamino y elementos casi-blancos |

### Acentos (máximo 3)

| Nombre | Color() | Hex | Uso |
|--------|---------|-----|-----|
| Rojo Oscuro | `Color(0.55, 0.10, 0.08)` | #8C1A14 | Estado pressed/activo de elementos de peligro; lado sombra de Rojo Urgente |
| Dorado Oscuro | `Color(0.72, 0.50, 0.05)` | #B8800D | Lado sombra de Dorado Caos; Impulso gastado |
| Verde Oscuro | `Color(0.15, 0.45, 0.20)` | #267333 | Lado sombra de Verde Absurdo; estados cómicos resueltos |

### Vocabulario Semántico

- **Rojo**: el aventurero tenía miedo al dibujarlo. Solo aparece en daño, costos y amenazas.
- **Dorado**: algo vale algo. Impulso, recompensa, victoria. También la luz bajo la que el aventurero escribe.
- **Verde**: esto desafía toda explicación, pero está pasando. Solo en comedia y absurdo.
- **Azul**: el aventurero paró de reír. Casi exclusivo del Jefe y amenazas serias. Su escasez es lo que le da peso. Bajo la CanvasModulate del Jefe `(0.78, 0.85, 1.0)` el canal azul se amplifica — los elementos azules se intensifican exactamente en el estado para el que fueron diseñados.
- **Blanco/claro (Luz Pergamino)**: espacio vacío y posibilidad. La página en blanco, algo nuevo está por ocurrir.
- **Negro/oscuro (Tinta)**: decisión ya tomada. La tinta ya está en la página. Siempre marrón cálido, nunca negro puro.

### HP y barra de salud

**HP usa progresión Rojo Urgente → Dorado Caos** (no verde). HP lleno = barra cálida dorada. HP bajo = barra predominantemente Rojo Urgente. La barra es segmentada y dibujada a mano (ver Sección 3.4).

### Reglas por Acto

La paleta NO cambia entre actos. Lo que cambia es la *proporción* de uso cálido/frío en entornos y enemigos:

| Acto | Temperatura base de assets | Notas |
|------|---------------------------|-------|
| **Acto 1 — Pueblo** | Cálida | Pergamino, Madera, ocres. Enemigos coloridos y un poco tontos. Verde Absurdo y Dorado Caos frecuentes. |
| **Acto 2 — Regional** | Mixta | Piedra, tonos neutros, algo de cielo nublado. Rojo Urgente más frecuente. Verde Absurdo aparece en situaciones que se sienten cada vez más fuera de control. |
| **Acto 3 — Jefe** | Neutra-fría de base | Máxima oscuridad. Acentos de Azul Gravedad en arquitectura. La CanvasModulate del Jefe sobre entorno ya frío produce el contraste máximo. |

*Regla de continuidad*: Es el mismo cuaderno, la misma tinta. Lo que cambia es que el aventurero está dibujando cosas cada vez más inquietantes.

### Paleta de UI — Materiales Físicos

| Material | Color base | Highlight | Sombra | Dónde se usa |
|----------|-----------|-----------|--------|--------------|
| Pergamino | `Color(0.96, 0.88, 0.72)` | `Color(1.0, 0.97, 0.90)` | `Color(0.72, 0.60, 0.45)` | Cuerpos de cartas, paneles de Situación, tooltips |
| Madera clara | `Color(0.72, 0.50, 0.28)` | `Color(0.85, 0.65, 0.40)` | `Color(0.45, 0.28, 0.12)` | Caras de botón, marcos de mapa, estado inactivo |
| Madera oscura | `Color(0.45, 0.28, 0.12)` | `Color(0.65, 0.45, 0.22)` | `Color(0.25, 0.15, 0.05)` | Botón pressed, bordes de panel |
| Cuero | `Color(0.48, 0.30, 0.18)` | `Color(0.65, 0.45, 0.28)` | `Color(0.30, 0.18, 0.08)` | Banda de Impulso, contenedor de barra de HP |
| Tinta sobre pergamino | Tinta `Color(0.18, 0.12, 0.08)` | N/A | N/A | Texto, trazos, marcas dibujadas en UI |

**Regla de divergencia UI**: Los colores semánticos (Rojo, Dorado, Verde, Azul) aparecen *sobre* los materiales de UI como tinta, no *como* el material mismo. Un número de daño es Rojo Urgente escrito sobre Pergamino — el pergamino es neutro, el color de la tinta porta el significado.

### Seguridad para Daltonismo

| Par en riesgo | Fallo | Respaldo requerido |
|---------------|-------|-------------------|
| **Rojo Urgente vs. Verde Absurdo** | Deuteranopio/Protanopio: par rojo-verde clásico | **Forma**: daño/peligro = lenguaje angular/roto (grietas, X). Comedia/absurdo = formas redondeadas o en ola. Nunca intercambiables en el mismo tipo de elemento. |
| **Dorado Caos vs. Rojo Urgente** | Tritanopia: amarillo-rojo pueden colapsar | **Luminosidad**: Dorado ~68% relativo, Rojo ~22% — ratio 3:1, distinguible sin hue. Además: los indicadores de Impulso siempre tienen símbolo dedicado (glifo de chispa), no solo un círculo de color. |
| **Azul Gravedad vs. Verde Absurdo** | Tritanopia: azul-verde ambiguo | **Iconos**: indicadores de jefe/amenaza tienen glifo dedicado. Estados cómicos tienen forma de ícono distinta. Ambos legibles a 16×16px mínimo. |
| **Neutrales de Pergamino** | Acromatopsia: toda la UI puede aplanarse en gris | **Trazos de Tinta**: todos los bordes de elementos UI están definidos por linework, no por adyacencia de color. Consecuencia natural del estilo hand-drawn. |

**Regla de daltonismo**: Ninguna distinción de estado del juego puede codificarse solo por color. Toda distinción semántica debe acompañarse de: (a) diferencia de forma, (b) ícono/glifo, (c) contraste de luminosidad >3:1, o (d) etiqueta de texto.

---

## 5. Character Design Direction

### 5.1 El Improvisador — Diseño Visual

**Lo que el sprite default debe comunicar sin texto**: la fantasía de "héroe mediocre que prospera en el caos" se comunica por contradicción — el cuerpo lee urgencia/peligro, la expresión lee "no tengo idea pero vamos".

- **Postura**: inclinación hacia adelante ~10–15° desde vertical, peso en un pie. No es una pose heroica — es "acabo de llegar y ya estoy manejando algo". Centro de masa visiblemente desbalanceado.
- **Equipamiento**: espada o herramienta demasiado pequeña/grande relativa al brazo, o sostenida en la mano equivocada. El equipamiento parece prestado o recién recogido del piso.
- **Expresión**: ojos abiertos leyendo la situación (no amenazando), cejas asimétricas (una más alta que la otra), boca levemente abierta — activo procesando, no confiado.
- **Ropa**: armadura con al menos una pieza claramente incorrecta — hombreras al revés, casco inclinado, bota sin atar. "Vestido apresuradamente tres veces."
- **Manos**: una siempre ocupada. El brazo libre gesticula levemente incluso en idle.

**Test de silueta MVP**: a 48×48px mínimo debe leerse: cabeza relativamente grande, torso angosto, inclinación hacia adelante, un brazo diferente al otro. Dos puntos claros de asimetría.

**Set de expresiones (MVP mínimo)**

| Estado | Trigger | Expresión | Cuerpo |
|--------|---------|-----------|--------|
| **Idle** | Sin cartas jugadas | Ojos semi-cerrados, leve sonrisa, una ceja levantada | Balanceo lento, gesto ocasional con la mano libre |
| **Focus** | Hover sobre una carta | Ojos bien abiertos, cuerpo inclina 5° extra | Pose de contención — squash leve, anticipación |
| **Playing Card** | Carta sale de la mano | Stretch total hacia la dirección de la carta, boca abierta en esfuerzo | Stretch explosivo, follow-through exagerado, snap a idle |
| **Damage** | Golpe llega | Ojos cruzados, estrellas (espirales rough), rodillas ceden | Squash máximo en frame de impacto, wobble recovery |
| **Low HP** | HP < 33% | Permanentemente despeinado, un ojo nerviando | Idle más lento, rango de wobble aumentado |
| **Victory** | Enemigo derrotado | Puñetazo + palmada accidental en su propia cara | Stretch, frame pico overshoots, bounce cartoon al bajar |
| **Defeat** | HP llega a 0 | Mira a cámara, se encoge de hombros, cae como una tabla | Squash en aterrizaje, banderita de "help", quietud total |

**Idea Brillante — Progresión Visual** (acumulación 0→1→2→3 disparada por efectos negativos)

1. **0 cargas**: sin indicador. Estado normal.
2. **1–2 cargas**: bombilla dibujada al estilo garabato (outline Tinta, fill Pergamino) flota sobre la cabeza. Tamaño escala con las cargas — casi invisible en 1, ~15% de la altura de la cabeza en 2. Bombilla apagada.
3. **3 cargas (lleno)**: bombilla cambia a fill Dorado Caos con halo rough en líneas de sketch. Halo en animación de 2 frames (dos posiciones levemente distintas alternando). La postura del personaje se endereza — el único estado donde El Improvisador parece intencionalmente confiado. La bombilla usa Dorado Caos semánticamente correcto: "algo que valió la pena contra todo pronóstico".

La bombilla es parte de la spritesheet, no un particle o efecto de shader. Compatible con editor-first.

### 5.2 Reglas de Distinción por Tipo de Personaje

| Categoría | Forma | Color | Postura |
|-----------|-------|-------|---------|
| **Enemigo** | Geometría agresiva exagerada — algo filoso, algo demasiado grande, algo que bloquea | Acento de Rojo Urgente (armadura, ojos, arma) | Enfrenta al jugador, cuerpo inclinado hacia adelante |
| **NPC** | Geometría redondeada y suave — sin partes peligrosas exageradas | Sin Rojo Urgente. Ocres cálidos, tonos Pergamino | De espaldas o en 3/4, nunca agresivo |
| **Aliado** | Redondeado como NPC pero con un gesto de brazo activo hacia el jugador | Acento de Dorado Caos (ítem, rasgo, halo) | Inclinado hacia el jugador pero hacia atrás — ofreciendo, no amenazando |

**Acto 1 — Pueblo**: exageración en rasgos faciales o accesorios (casco demasiado grande, orejas enormes, arma ridículamente pequeña). Colores dominantes: Verde Absurdo o Dorado Caos. Sin Azul Gravedad. Un elemento de equipamiento visiblemente incorrecto para su propósito.

**Acto 2 — Regional**: exageración se mueve a la silueta corporal (más ancho, más bajo, más horizontal). Equipamiento parece "oficial" aunque absurdo. Verde Absurdo como acento menor, no fill primario. Rojo Urgente más prominente.

**Acto 3 / Jefe**: geometría incoherente (ver Sección 3.1). Azul Gravedad permitido como acento. El jefe usa Azul como tono primario, consistente con la CanvasModulate del estado Jefe. A pesar de la incoherencia, el jefe pasa el test de thumbnail como "el jefe" (grande, llena el frame, más vertical que el jugador).

### 5.3 Expresividad y Estilo de Poses

**Referente de calibración: Cuphead** (no Looney Tunes, no Adventure Time).
- Looney Tunes: metamorfosis corporal total, anticipaciones largas — fuera del scope de MVP.
- Adventure Time: más contenido, squash/stretch sutil. Este juego es MÁS extremo.
- Cuphead: extremos fuertes, poses mantenidas, personalidad por personaje, acción legible desde silueta. Aquí, con menor conteo de frames.

**Cara**: 70% del read emocional. Cinco features exageradas:
1. **Ojos**: tamaño varía por estado (idle normal, sorpresa 150%, impacto = punto o X, feliz = media luna)
2. **Cejas**: móviles y asimétricas. Focus = descienden hacia el centro. Alarma = suben al nacimiento del pelo.
3. **Boca**: va de línea cerrada a abierta con 3–4 dientes dibujados rough
4. **Mejillas**: círculos de rubor (óvalos rough en Rojo Urgente) en vergüenza, esfuerzo y victoria
5. **Gota de sudor**: una gota grande y angular (no mist) en stress y daño

**"A punto de atacar"**: 3 frames mínimo: (1) freeze, (2) wind-up (arma retrocede, cuerpo inclina), (3) hold 0.5s antes del golpe. El hold es la ventana de decisión del jugador. Rojo Urgente aparece durante la animación de ataque — no en idle.

**"Confundido/Distraído"**: cabeza inclina 25–30° (extremo, no natural), ojos se convierten en espirales, cuerpo balancea pero pies fijos, velocidad de animación reduce ~40%.

**"Derrotado"**: pose estática — el frame de squash más extremo del personaje, mantenido hasta que la escena transiciona.

### 5.4 Filosofía de Animación para MVP

**Regla de 3 frames**: Para cualquier acción que no se puede cortar del MVP: Anticipación (1f) → Extremo (1f) → Recuperación (1f). Sin in-betweens en MVP. El pop entre extremos a 10–12 fps lee como energía e impacto.

**Set MVP (no se puede cortar)**

| Animación | Frames | Por qué no se puede cortar |
|-----------|--------|---------------------------|
| Idle del Improvisador | 4–6 loops | Sin animación, el personaje lee como imagen muerta |
| Stretch de jugar carta | 3 (squash→stretch→snap) | Feedback de la acción principal del juego |
| Daño recibido | 3 (hit flash→squash→wobble) | Comunica que algo importante pasó |
| Wind-up de ataque enemigo | 3 + 0.5s hold | El hold es mecánico, no cosmético |
| Pose de derrota enemigo | 1 frame mantenido | Pacing del final del encuentro |
| Victoria del Improvisador | 4–5 (stretch→overshoot→bounce) | El loop de feedback positivo |
| Derrota del Improvisador | 4–5 (inclinación→caída→squash→hold) | El final de run debe sentirse teatral |

**Post-MVP (diferir, no cortar)**
- Idle loop completo de enemigos (MVP: pose estática + respiro de 2 frames)
- Ciclo de caminata del Improvisador (MVP: corte de escena o teleport)
- Animación de robo de cartas (MVP: pop a posición con scale 0.8→1.0)
- Visuales de status effect (MVP: ícono estático flotando)
- Progresión suave de la bombilla Idea Brillante (MVP: pop a cada tamaño)

**Reemplazable con cambio de pose estática (sin costo diferido)**
- Conversaciones con NPCs, nodos del mapa, arte de cartas: todo estático.

### 5.5 LOD en 2D Hand-Drawn

**Resolución de assets**: Todo source art a 2× del footprint en pantalla. Godot 4.6 usa filtrado linear en sprites 2D — preserva textura dibujada a mano sin jaggies.

| Elemento | Footprint en pantalla | Source art |
|----------|-----------------------|------------|
| El Improvisador | ~80×100px | 160×200px |
| Enemigo estándar | ~64×80px | 128×160px |
| Enemigo élite | ~80×96px | 160×192px |
| Jefe | ~160×180px | 320×360px |
| NPC | ~48×64px | 96×128px |
| Arte de carta | ~72×54px | 144×108px |

**Qué debe sobrevivir a distancia de cámara**: lectura de silueta, estado de expresión facial (cambio de forma de ojos mínimo), parte exagerada dominante del enemigo, estado de la bombilla Idea Brillante, gota de sudor y círculos de rubor como marcas discretas.

**Qué no dibujares**: textura de tela (reemplazar con hachuras mínimas), detalle fino en armadura/calzado, tonos múltiples de sombreado (máximo 2 tonos por región: color base + una sombra), más de 3 dientes, detalles de hebillas/botones < 8×8px a escala de juego.

**Regla de 2 tonos**: todos los sprites usan máximo 2 tonos por región de color a tamaño final: color plano base + un valor de sombra. Sin gradientes. El tercer tono es invisible a escala y el trabajo extra tiene retorno visual cero.

---

## 6. Environment Design Language

*Principio rector*: El entorno es un decorado de teatro — la cámara es fija, el jugador nunca lo explora. Cada regla existe para que el lugar se lea en tres segundos y después se quede quieto.

### 6.1 Estilo Arquitectónico — "Románico de Memoria"

**Referente**: arquitectura vernácula Románica y Gótica temprana — muros gruesos, arcos de medio punto, proporciones bajas y sólidas, torres cuadradas, adoquines irregulares. NO castillos de alta fantasía con agujas elegantes. El aventurero nunca estudió arquitectura — dibujó lo que recordaba vagamente.

**Las 5 distorsiones del diario de emergencia**:
1. **Proporciones verticales comprimidas**: puertas más anchas que altas, arcos se aplanan hacia el óvalo, torres más anchas que altas
2. **Arcos que no cierran**: las dos líneas que forman un arco casi se tocan — gap de 2–4px. Nunca cierran limpiamente.
3. **Mampostería con bloques desiguales**: varían entre 60%–140% del tamaño "correcto". Las filas existen; el ancho de bloques dentro de cada fila varía.
4. **Tejados con pendientes asimétricas**: lado izquierdo y derecho difieren ~10–15°
5. **Solapamiento de bordes**: las líneas de paredes/techos/suelos se extienden más allá de las esquinas — nunca se detienen exactamente en ellas (Regla de solapamiento de Sección 3.2)

**Lo que siempre está reconocible**: tipo de superficie dominante, escala relativa de elementos, función del espacio.
**Lo que siempre está incorrectamente dibujado**: medidas exactas, ángulos de arcos, consistencia de bloques, punto de perspectiva.

### 6.2 Filosofía de Textura — Firma de Hachura

Sin PBR, sin mapas de normal, sin texturas fotográficas. La identidad de una superficie viene de su **patrón de hachura** — una firma de trazo consistente en todo el juego.

| Material | Firma | Color base | Sombra |
|----------|-------|-----------|--------|
| **Piedra** | Cross-hatch 45° ±10°, trazos cortos 8–12px, separación 4–6px. Densidad aumenta en sombra. | `Color(0.72, 0.66, 0.55)` | `Color(0.40, 0.32, 0.24)` |
| **Madera** | Líneas paralelas horizontales largas con quiebres. 1–2 marcas de nudo por tablón. Nunca perfectamente recta. | Madera Cálida `#945A2E` | `Color(0.35, 0.20, 0.08)` |
| **Tierra** | Stipple irregular — puntos y marcas cortas sin dirección fija. Densidad mayor al borde inferior. Sin contorno continuo. | `Color(0.45, 0.32, 0.20)` | N/A |
| **Tela** | Líneas onduladas paralelas siguiendo la caída. Un pliegue grueso por panel (línea curva más oscura). | Variable por escena | Color base × 0.7 |
| **Metal** | Trazos cortos de highlight arriba, un solo trazo largo de sombra abajo. Sin fill denso. | Sombra Pergamino `#B89972` | Tinta `#2E1F14` |
| **Agua** | Líneas horizontales onduladas con gaps e interrupciones. Nunca superficie sólida. | Azul Gravedad diluido `Color(0.55, 0.65, 0.85)` | N/A |

**Regla de firma consistente**: si un asset de piedra usa cross-hatch 45°, todos los assets de piedra en el juego usan cross-hatch 45°. La firma no varía entre actos ni escenas. Lo que varía es la densidad (más hachura = más deteriorado) y el color base (más oscuro por acto).

### 6.3 Reglas de Densidad de Props

**La Regla de Cinco Props**:

| Acto | Máximo de props | Lógica |
|------|-----------------|--------|
| **Acto 1** | 5 | El pueblo es familiar y desordenado |
| **Acto 2** | 3 | Más lejos del hogar, el aventurero dibujó menos |
| **Acto 3 / Jefe** | 1–2 | Casi vacío — la ausencia hace que el jefe llene el espacio |

**Definición de "prop"**: cualquier objeto individual que no es arquitectura estructural. Una barrica = prop. Una grieta en la pared = textura (no cuenta).

**Regla de prop "levemente incorrecto"**: cada prop tiene al menos una característica que un artista descuidado dibujaría mal — una barrica con demasiados aros, un letrero colgado en un ángulo que no tiene sentido físico, una silla con una pata más corta.

### 6.4 Storytelling Ambiental — "Consecuencia, No Causa"

*La Situación es el vehículo narrativo principal. El entorno no narra el mismo evento — lo antecede o continúa.*

**Regla de consecuencia**: el entorno muestra el resultado de algo que ya pasó, o la condición que permite que algo pase. Nunca el evento mismo. El evento lo describe la Situación.

- Correcto: migas en el suelo y cesto vacío volcado (Situación: "El panadero cree que robaste sus rollos")
- Incorrecto: panadero dibujado señalando al personaje

**Regla de un detalle**: exactamente UN detalle de storytelling por escena. Uno es intrigante. Dos compiten y ninguno se lee. El detalle puede ser el estado de un prop existente (volcado, abierto, con marcas de uso).

**Tipos de detalle que funcionan**: objetos en estados inusuales, ausencias (marca de donde estuvo algo), trazas de actividad reciente, cantidades inusuales.

**Regla dura**: el entorno nunca muestra personajes secundarios como escenografía. Los NPCs son activos propios o no están.

### 6.5 Estructura de la Escena de Encuentro

**Separación de profundidad sin 3D** — tres técnicas: (1) oscuridad (fondo = más claro, primer plano = más oscuro), (2) densidad de hachura (fondo = menos, primer plano = más), (3) escala (elementos del fondo más pequeños).

**Capa 1 — Fondo Lejano** (Layer 2, Sprite2D único)
- Establece tipo de lugar en una lectura. 1 sprite de ancho completo.
- 2 elementos visuales máximo. Color desaturado. Sin hachura densa. Sin props.
- Acto 1: cielo cálido + tejados a lo lejos / interior de taberna. Acto 2: cielo nublado / piedra más oscura. Acto 3: casi negro, mínimo detalle.

**Capa 2 — Plano Medio** (Layer 3, Sprite2Ds independientes)
- El "set de teatro" — aquí viven los props y el storytelling ambiental.
- Siempre contiene: elemento de escala + arquitectura base + prop de storytelling en estado de consecuencia.
- Props limitados por Regla de Cinco.

**Capa 3 — Silueta de Primer Plano** (Layer 5)
- Siluetas oscuras en la franja inferior que enmarcan la escena.
- Color: Tinta `#2E1F14`. Sin fill de hachura — solo silueta sólida.
- Altura máxima: 15% de pantalla (20% en Acto 3).
- **Siempre presente** — da a los personajes un suelo visual que los ancla.

**Posiciones de layer en Godot 4.6**:
- Layer 2: Fondo lejano
- Layer 3: Plano medio
- Layer 4: Personajes (El Improvisador, enemigos)
- Layer 5: Silueta de primer plano
- Global: CanvasModulate

**Checklist de escena** — toda escena de encuentro debe tener:
- [ ] Fondo lejano (1 sprite, tipo de lugar claro, desaturado)
- [ ] Plano medio (arquitectura base + props en límite del acto)
- [ ] 1 detalle de storytelling ambiental (consecuencia, no causa)
- [ ] Silueta de primer plano oscura presente
- [ ] Firmas de hachura correctas por material
- [ ] Ninguna línea perfectamente recta, ningún arco que cierre limpiamente
- [ ] Zona central entre mano de cartas y enemigo despejada

### 6.6 Pipeline Solo Dev — Producción MVP

**Template de escena**: un único `encounter_template.tscn` con la estructura de 3 capas pre-configurada. Para cada escena nueva: duplicar y reemplazar sprites.

**Bloques de fondo reutilizables** (resolución 640px de ancho):

| Asset | Uso |
|-------|-----|
| `env_wall_stone_base` | Interiores de piedra — todos los actos |
| `env_wall_wood_base` | Taberna, almacén, hogar |
| `env_sky_village_base` | Exteriores Acto 1 |
| `env_sky_overcast_base` | Exteriores Acto 2 |
| `env_floor_cobble_strip` | Suelo adoquinado de pueblo |
| `env_floor_wood_strip` | Suelo de interiores |
| `env_floor_dirt_strip` | Exteriores rurales, mazmorras |

**Set de 10 props MVP**:
`env_prop_barrel_upright`, `env_prop_barrel_tipped`, `env_prop_crate_closed`, `env_prop_crate_open`, `env_prop_sign_hanging`, `env_prop_table_simple`, `env_prop_chair_side`, `env_prop_candle_tall`, `env_prop_torch_wall`, `env_prop_chest_closed`

*Naming*: `env_[categoría]_[objeto]_[estado].[ext]`. Source art máximo 200px alto para props medianos.

**Tiempo estimado**: fondo reutilizable (0 min) + plano medio (30–45 min) + silueta de primer plano (15–20 min) = ~1 hora por escena nueva. Para 8–12 escenas del MVP: 8–12 horas totales de producción de entorno.

---

## 7. UI/HUD Visual Direction

*Principio rector*: La interfaz no es una capa flotante sobre el juego — es parte del mismo diario de aventuras. El jugador no "consulta una UI"; está leyendo las notas al margen que el aventurero escribió mientras manejaba el desastre.

### 7.1 Diegético vs. Screen-Space — La Filosofía de Capas

**Regla base**: Todo lo que informa sobre el *estado del encuentro* tiene referente físico (diegético). Todo lo que informa sobre *la sesión misma* (pausa, configuración) flota como overlay.

| Capa | Tipo | Qué contiene | Material físico |
|------|------|--------------|-----------------|
| **Diegética** | Vive "en la escena" | HP del Improvisador, Impulso disponible, Situación activa, cartas en mano, turno de enemigo | Pergamino, cuero, madera, tinta |
| **Semi-diegética** | Física pero overlay | Número de daño flotante, tooltip de carta, indicador de timer de 10s | Papel rasgado, tinta urgente |
| **Screen-space pura** | Overlay sin referente físico | Pantalla de pausa, menú de configuración, fade de transición | Solo se permite en pausa — nunca en gameplay activo |

**Consecuencia directa**: Durante un encuentro activo, ningún elemento de UI puede tener forma sin referente físico (ver Sección 3.4). La excepción es el overlay de pausa — porque el aventurero literalmente cerró el diario.

**Regla de densidad diegética**: El HUD del encuentro no supera 5 elementos visuales simultáneos en pantalla. Con mano de 4 cartas, el quinto elemento es la Situación activa. Todo lo demás es contextual.

**CanvasModulate y HUD** *(open item para programación de UI)*: El CanvasModulate global afecta todos los elementos de la escena incluyendo el HUD. El estado Jefe (`Color(0.78, 0.85, 1.0)`) y el estado Derrota (`Color(0.7, 0.75, 0.85)`) reducen la luminosidad del Rojo Urgente y el Dorado Caos en los momentos de mayor presión. Resolver colocando el HUD en un `CanvasLayer` separado que quede fuera del `CanvasModulate` global, o verificar que todos los colores semánticos del HUD superen el ratio de contraste 4.5:1 bajo los dos modulados más extremos antes de cerrar este ítem.

---

### 7.2 Tipografía

#### Font primaria — Cuerpo y UI general

**Font**: **Almendra** (Google Fonts, OFL, libre) — serif de textura medieval con variaciones orgánicas de trazo. Lee como letrada a mano sin sacrificar legibilidad a 14px.

Alternativa si Almendra falla en export de Godot: **Philosopher** (Google Fonts) — menos orgánica pero igualmente serif con personalidad.

**Nunca usar**: fuentes con bordes perfectamente uniformes (Roboto, Open Sans, Montserrat). Nunca usar fuentes script o cursivas decorativas para texto de gameplay — ilegibles al tamaño de tooltip.

#### Font secundaria — Énfasis, nombres de carta, nombres de Situación

**Font**: **MedievalSharp** (Font Squirrel, libre) para títulos cortos únicamente (máximo 4 palabras). Si MedievalSharp no está disponible: Almendra Bold.

#### Jerarquía tipográfica a 1080p

| Nivel | Elemento | Font | Tamaño | Tracking | Color de tinta |
|-------|----------|------|--------|----------|----------------|
| **H1** | Nombre de pantalla (Menú Principal, Game Over) | MedievalSharp | 64px | +2% | Tinta `#2E1F14` |
| **H2** | Nombre de Situación activa | MedievalSharp | 32px | +1% | Tinta `#2E1F14` |
| **H3** | Nombre de carta (en mano) | MedievalSharp | 18px | +0.5% | Tinta `#2E1F14` |
| **Body** | Texto de efecto de carta, descripción de Situación | Almendra Regular | 14px | 0% | Tinta `#2E1F14` |
| **Caption** | Tag de tipo de carta, costo numérico de Impulso, etiquetas de nodo de mapa | Almendra Bold | 12px | +1% | Variable según contexto |
| **Label urgente** | Números de daño flotantes, timer de 10s | Almendra Bold | 20px (daño) / 28px (timer) | 0% | Rojo Urgente `#D93826` |

**Nota de escalado web**: en resoluciones menores a 1280px de ancho, todos los tamaños se escalan con el viewport. Usar `theme_override` de Godot para que los `Label` hereden el escalado del `CanvasLayer`. No usar tamaños fijos en `pixel_size` de fuentes bitmap.

#### Reglas tipográficas

1. **Nunca texto en caja perfectamente centrada con padding uniforme** — viola "UI Has Mass". Todo texto vive sobre un material físico (pergamino, madera).
2. **Inclinación permitida**: nombres de carta pueden tener `rotation` entre -3° y +5° (determinista por nombre via hash, no aleatorio). Texto de body siempre a 0°.
3. **Sombra de texto**: `shadow_color: Color(0.18, 0.12, 0.08, 0.6)`, `shadow_offset: Vector2(1, 2)`. Solo en texto sobre pergamino. Sin sombra sobre madera — el contraste Tinta/Madera ya es suficiente.
4. **Máximo 28 caracteres por línea** en texto de efecto de carta (a 14px / 72px de ancho de carta). Más largo se trunca con elipsis.
5. **Nunca kerning negativo** — el tracking levemente positivo logra la sensación de "letrado apretado", no comprimiendo letras.

---

### 7.3 Iconografía

**Estilo**: un trazo grueso sin relleno interno liso. Los íconos son marcas dibujadas a mano — como si el aventurero dibujó el símbolo en el margen de su diario para recordar algo rápido.

| Característica | Regla |
|---|---|
| **Grosor de trazo** | 3px a tamaño base 32×32px. A 16×16px: 2px. Nunca 1px — desaparece en web. |
| **Estilo de línea** | Terminaciones redondeadas (round cap). Flechas con un extremo más ancho que el otro — nunca precisas. |
| **Relleno interior** | Vacío o con hachura mínima (2–3 líneas diagonales). Sin fill de color sólido, excepto ícono de Impulso (ver abajo). |
| **Bounding box** | 32×32px estándar. La marca puede no usar todo el espacio. |
| **Test mínimo** | Legible a 16×16px en pantalla web. Si no es legible, simplificar hasta que sí lo sea. |

#### Íconos requeridos para MVP

| Ícono | Nombre de asset | Descripción visual | Tamaño canvas |
|-------|----------------|--------------------|---------------|
| **Impulso** | `ui_icon_impulso_filled` / `ui_icon_impulso_empty` | Chispa angular — 4 líneas irradiando de centro, la más larga a 45°. Fill Dorado `#F2B71F` cuando lleno, Pergamino con trazo cuando vacío. | 32×32px |
| **HP segment** | `ui_icon_hp_segment` | Marca de conteo vertical (I) dibujada a mano — las marcas del HP se leen como punteo de cartas. | 16×24px |
| **Ataque** | `ui_icon_attack` | Flecha con punta de hacha — línea diagonal con cuña al extremo. Trazo Tinta. | 32×32px |
| **Defensa** | `ui_icon_defense` | Escudo con forma irregular (un lado más curvado que el otro). Hachura 3 líneas internas. | 32×32px |
| **Timer** | `ui_icon_timer` | Reloj de arena muy rough — los dos triángulos no tienen el mismo tamaño. | 32×32px |
| **Situación** | `ui_icon_situation` | Estrella de 4 puntas irregular — puntas en pares opuestos de largo distinto. | 32×32px |
| **Tipo: Combate** | `ui_icon_type_combat` | Espada diagonal simple — un trazo grueso con travesaño. | 24×24px |
| **Tipo: Social** | `ui_icon_type_social` | Dos bocas en ola enfrentadas. | 24×24px |
| **Tipo: Absurdo** | `ui_icon_type_absurd` | Signo de pregunta terminado en espiral. | 24×24px |
| **Mapa: Encuentro** | `ui_map_node_encounter` | Sello de cera con espada interior. Borde irregular. | 40×40px |
| **Mapa: Tienda** | `ui_map_node_shop` | Sello de cera con moneda interior (círculo y línea). | 40×40px |
| **Mapa: Jefe** | `ui_map_node_boss` | Sello de cera con calavera simple (2 puntos de ojos, línea de boca). Borde más irregular que los demás. | 48×48px |
| **Mapa: Descanso** | `ui_map_node_rest` | Sello de cera con llama interior (1 trazo curvo). | 40×40px |

**Regla de tamaño mínimo en web**: ningún ícono interactivo menor a 40×40px de área tocable en pantalla, incluso si el sprite visual es más pequeño. Aplicar usando `Button` de Godot con `minimum_size` y sprite ícono interior más pequeño.

---

### 7.4 Animación de UI — Lenguaje de Movimiento

*Principio*: La UI no se mueve con curvas suaves de aplicación móvil. La UI se mueve como objetos físicos manipulados por alguien apurado.

#### Curvas de easing permitidas

| Nombre | Godot Tween | Cuándo usar |
|--------|-------------|-------------|
| **Snap** | `TRANS_BACK, EASE_OUT` con overshoot | Pop de carta, aparición de panel, recompensa |
| **Thud** | `TRANS_EXPO, EASE_OUT` | Número de daño cae, ícono de Situación entra |
| **Spring** | `TRANS_ELASTIC, EASE_OUT` | Rebote de botón en hover out, carta vuelve a posición |
| **Corte directo** | Sin tween | HP baja, Impulso se gasta — feedback inmediato |

**Curvas prohibidas**: `TRANS_LINEAR` para movimiento visible (lee como computadora). `TRANS_SINE` para feedback de acción (demasiado suave, no comunica peso). Excepción única: `TRANS_SINE` para el pulse del timer de urgencia (1 ciclo/segundo).

#### Tabla de animaciones de UI

| Evento | Duración | Descripción | Curva |
|--------|----------|-------------|-------|
| **Carta aparece en mano** | 0.15s | Scale `0.0 → 1.1 → 1.0` + posición desde -20px Y. Stagger 0.05s entre cartas. | Snap |
| **Carta seleccionada (PC hover / touch 1er tap)** | 0.08s | `position.y -= 10`, `rotation → 0°`. No se escala. | Snap |
| **Carta deseleccionada** | 0.12s | Vuelve a posición y rotación original. | Spring |
| **Carta jugada** | 0.2s | Vuela en arco hacia el enemigo siguiendo el ángulo de rotación de la carta en mano. Scale `1.0 → 0.6` al llegar. | Thud en destino |
| **Carta no jugable (X aparece)** | 0.1s | Scale de la X `0.0 → 1.3 → 1.0`. La carta misma no se anima. | Snap |
| **Botón hover (solo pointer)** | 0.06s | `rotation: 0° → 3°` via `pivot_offset` en esquina inferior. | Snap |
| **Botón hover out** | 0.1s | `rotation → 0°`. | Spring |
| **Botón pressed** | 0.05s in / 0.15s out | `scale.y: 1.0 → 0.92 → 1.0` (squash vertical). | Snap in, Spring out |
| **Panel Situación entra** | 0.25s | Scale `0.0 → 1.05 → 1.0` + `position.y` desde -30px. Overshoot 5%. | Snap |
| **Tooltip aparece** | 0.1s | Scale `0.8 → 1.0` + `alpha 0 → 1`. Rotación off-axis fija. | Snap |
| **Tooltip desaparece** | 0.06s | `alpha 1 → 0`. Sin scale. | Directo |
| **Número de daño** | 0.4s total | Aparece en posición del receptor. `position.y -= 40` en 0.3s + `alpha 1 → 0` en últimos 0.15s. Scale `0.0 → 1.2 → 1.0` en 0.1s. | Snap aparición, Thud |
| **Impulso consumido** | Sin tween | Círculo: fill Dorado → vacío (cambio de sprite). Inmediato. | Directo |
| **HP baja** | Sin tween + 0.15s | Segmento cambia inmediatamente. Después: `position.x: +3 → -3 → 0` (shake de barra). | Directo + shake |
| **Timer de urgencia (≤3s)** | Loop 1s | `scale: 1.0 → 1.1 → 1.0`. Tinta → Rojo Urgente cuando ≤3s. | TRANS_SINE (excepción única) |

**Regla de duración máxima**: ninguna animación de UI supera 0.4s total.

**Regla de stagger**: múltiples elementos de la misma categoría que entran juntos (cartas al inicio del turno) usan stagger de 0.05s. Sin stagger en feedback de acción única.

---

### 7.5 Interacción con Cartas — Modelo Touch y Pointer

**PC (pointer/mouse)**:
- Hover → carta se selecciona (sube 10px, rotation → 0°)
- Click → carta se juega directamente desde el estado seleccionado

**Web / touch**:
- **Primer tap** → carta se selecciona (misma animación: sube 10px, rotation → 0°). La carta queda en estado "listo para jugar". Un segundo tap en otra carta la deselecciona y selecciona la nueva.
- **Segundo tap en la misma carta seleccionada** → carta se juega.
- Tap fuera de todas las cartas → deselección.

*La distinción seleccionada/no-seleccionada debe leerse sin depender de hover: la carta seleccionada tiene posición Y elevada y rotation 0° — cambio de forma visible, no solo de color.*

**Carta no jugable en touch**: la X de tinta dibujada sobre la carta (Sección 3.3) debe ser un área opaca que bloquea los taps. La X no es solo visual — su `Control.mouse_filter` debe estar en `STOP` para absorber el evento de tap y mostrar un micro-feedback (carta hace un shake de 3px horizontal, 0.1s) en lugar de intentar jugarse.

**Tamaño de target táctil mínimo de carta**: las cartas en mano tienen footprint en pantalla ~72×54px. El área de tap debe ser la tarjeta completa incluyendo bordes irregulares, no un área rectangular interior. Usar `CollisionShape2D` o área de `Control` que cubra el bounding box completo.

---

### 7.6 Layout del HUD — Pantalla de Encuentro

*El HUD del encuentro se organiza en tres franjas horizontales. La información fluye en eje vertical — el jugador no mueve los ojos hacia los costados.*

```
┌──────────────────────────────────────────────────────┐
│  [Situación activa — pergamino 60% ancho, centrado]  │  ← FRANJA SUPERIOR (~20% pantalla)
│  [HP enemigo a la derecha] [Timer extremo derecho]   │
├──────────────────────────────────────────────────────┤
│                                                       │
│            ZONA CENTRAL — DESPEJADA                  │  ← ZONA DE COMBATE (~50% pantalla)
│       (enemigos, Improvisador, VFX, intenciones)     │
│                                                       │
├──────────────────────────────────────────────────────┤
│  [HP — izquierda] [Impulso] [Mano de 4 cartas]       │  ← FRANJA INFERIOR (~30% pantalla)
└──────────────────────────────────────────────────────┘
```

#### Franja superior — Situación activa

- **Panel de Situación**: pergamino clavado, anchura 60% del viewport, centrado horizontalmente. Altura mínima 80px, máxima 120px a 1080p. El `PointLight2D` de la Situación (Sección 2) apunta sobre este panel — es el elemento con mayor luminosidad del HUD. Si el jugador no sabe dónde mirar primero, mira donde está la luz.
- **Nombre de la Situación**: H2, 32px, MedievalSharp.
- **Descripción de la Situación**: Body, 14px, Almendra Regular. Máximo 2 líneas. Si excede: trunca con "..." y click/tap sobre el panel abre tooltip extendido en papel rasgado.
- **HP del enemigo**: a la derecha del panel de Situación. Barra segmentada horizontal en cuero, ancho máximo 180px. Etiqueta de nombre del enemigo en Caption (12px) arriba de la barra.
- **Timer de 10s**: ícono `ui_icon_timer` + número en Label urgente (28px). Extremo derecho de la franja, siempre visible. ≤3s: pulse de scale + color → Rojo Urgente.
- **Intención del enemigo**: flota sobre el sprite del enemigo (zona central) cuando su wind-up se completa. Sin fondo propio — ícono de acción en Tinta + número de daño en Caption directamente sobre el sprite. Aparece en el mismo momento que el hold de la animación de ataque (Sección 5.3). Rojo Urgente para ataques directos; Tinta para efectos de estado.

#### Franja inferior — Recursos y mano

- **HP del Improvisador**: extremo izquierdo. Barra segmentada vertical en tira de cuero (marcas apiladas de arriba a abajo), 32px de ancho.
  - HP ≥ 34%: color dominante Dorado Caos `#F2B71F`
  - HP < 33%: color dominante Rojo Urgente `#D93826` (alineado con trigger de expresión Low HP, Sección 5.1)
  - La barra es segmentada — la cuenta de segmentos es el backup no-color del estado de salud.
- **Banda de Impulso**: a la derecha inmediata del HP. N círculos de 24px horizontales en tira de cuero. Trazo 3px. Filled = Dorado `#F2B71F` + ícono de chispa interior. Empty = Pergamino con trazo de Tinta. El número de Impulso disponible se muestra como Caption (12px) debajo de la banda — siempre visible, no solo el visual de círculos.
- **Mano de 4 cartas**: centro-derecha de la franja. Fan determinista — posición 1: -6°, posición 2: -2°, posición 3: +2°, posición 4: +6°. Solapamiento de 12px (la carta de la derecha tapa el borde izquierdo de su vecina). Inclinaciones fijas por posición de slot, no por carta.

#### Elementos contextuales

- **Tooltip de carta**: click/tap sobre una carta seleccionada. Papel rasgado, rotación off-axis fija +4°. Contiene: nombre (H3), costo (Caption), efecto completo (Body). Desaparece al tap fuera o al jugar la carta.
- **Número de daño**: aparece sobre el receptor. Rojo Urgente para daño; Dorado Caos para curación o bonus. (Ver animaciones, Sección 7.4.)
- **Indicador de turno**: "Tu turno" / "Turno enemigo" en Caption (12px) flotando sobre el fondo del panel de Situación, extremo derecho. Sin panel propio. Cambia por corte directo.
- **Botón "Pasar"**: tablón de madera, extremo derecho de la franja inferior. Una palabra. Disabled visualmente si no se jugó ninguna carta: veta de madera más oscura + texto en Tinta alpha 0.4. La condición de disabled tiene dos señales (color Y textura) — no solo una.

---

### 7.7 Pantallas Críticas

#### Menú Principal

**Composición**: tres elementos en eje Y centrado.
1. **Título "Caos en Mano"**: H1, 64px, MedievalSharp. `PointLight2D` sobre él (energy 0.9–1.1 en loop de 3s, respiración lenta). El elemento más iluminado de la pantalla.
2. **Subtítulo** (opcional): Body 16px, Almendra Regular, cursiva. 24px debajo del título.
3. **Botones de navegación**: apilados verticalmente, separación 16px. Cada botón = tablón de madera 280×48px. MVP: "Nueva Partida", "Continuar" (disabled si no hay save), "Salir" (omitir en build web).

**Fondo**: `CanvasModulate: Color(0.98, 0.88, 0.72)`. Ilustración: diario de aventuras abierto visto desde arriba, título escrito en página izquierda, página derecha en blanco. Layer 2, ancho completo.

#### Pantalla de Encuentro

Descrita en Sección 7.6. Sin elementos animados de fondo — toda la energía visual va al gameplay.

#### Pantalla de Recompensa

**Composición**: 2–3 cartas de recompensa centradas, separación 24px. A tamaño ampliado (~144×108px en pantalla, source art 288×216px). Rotation 0° — "están sobre la mesa esperando ser elegidas."

**Fondo**: `CanvasModulate: Color(1.0, 1.0, 0.95)`. Cada carta tiene `PointLight2D` propio (energy 0.9). En hover/focus: energy → 1.4 en 0.15s.

**Sin HUD de combate** — el encuentro terminó. HP e Impulso no se muestran. La densidad visual baja intencionalmente.

**Texto de instrucción**: "Elegí una." en Body 14px sobre papel rasgado, centrado sobre las cartas.

#### Pantalla del Mapa de Nodos

**Composición**: mapa como hoja del diario, fondo de pergamino. Líneas de camino entre nodos = tinta dibujada a mano (3px, Tinta, curvadas 1–3% — nunca rectas perfectas).

| Estado de nodo | Visual |
|---|---|
| Visitado | Sello cera Tinta, interior marcado, opacity 0.6 |
| Actual | Sello cera con borde Dorado + `PointLight2D` (energy 1.0) |
| Disponible | Sello cera full opacity. Hover/focus: `scale 1.0 → 1.1` en 0.08s |
| Bloqueado | Sello cera con X de tinta encima, opacity 0.4 |

**HP del Improvisador en el mapa**: barra horizontal pequeña, extremo superior izquierdo. Solo la barra segmentada, sin número. El número de HP es información de combate, no de navegación.

**Leyenda del mapa**: panel de pergamino pequeño, extremo inferior izquierdo. Íconos de cada tipo de nodo + etiqueta en Caption. Siempre visible.

---

### 7.8 Reglas de Accesibilidad Visual para UI

| Regla | Implementación |
|-------|----------------|
| **Contraste mínimo texto/fondo** | Tinta `#2E1F14` sobre Pergamino `#F5E0B8` = ratio 8.2:1. No reducible. |
| **Sin hover-only interactions** | Tooltips en click/tap, no hover. El hover es enhancement, no requisito. |
| **Tamaño mínimo de target táctil** | 40×40px para cualquier elemento interactivo. |
| **Timer legible sin color** | El número siempre visible. El cambio de color es refuerzo, no señal primaria. |
| **Estados disabled** | Dos señales simultáneas: texto en Tinta alpha 0.4 + material más oscuro. Nunca solo color. |
| **Sin parpadeo** | Ninguna animación de UI parpadea entre 3 y 50 Hz. El pulse del timer es 1 ciclo/segundo. |
| **Escalado web** | Todos los tamaños de fuente y UI se escalan via el sistema de tema de Godot. Sin elementos con tamaño fijo absoluto. HUD funcional a 768×432px mínimo. |

---

### 7.9 Checklist de UI por Pantalla

Antes de declarar cualquier pantalla lista para review:

- [ ] Todos los elementos de UI tienen referente físico (madera, pergamino, cuero, papel rasgado)
- [ ] Ningún elemento UI usa forma sin referente (sin pills suaves, sin círculos perfectos como contenedores)
- [ ] Contraste Tinta/Pergamino mantenido en todo texto principal
- [ ] Ninguna distinción de estado codificada solo por color — acompañada de forma, ícono, o luminosidad
- [ ] Sin hover-only interactions — todo accesible por click/tap
- [ ] Targets interactivos ≥ 40×40px
- [ ] Fuentes: MedievalSharp para H1–H3, Almendra Regular para Body, Almendra Bold para Caption y urgente
- [ ] Animaciones dentro del límite 0.4s máximo
- [ ] `CanvasModulate` del estado activo aplicado — verificar que el UI sobrevive la multiplicación de color
- [ ] Densidad HUD ≤ 5 elementos simultáneos en encuentro activo
- [ ] Timer siempre visible como número
- [ ] HP threshold: barra en Rojo Urgente cuando < 33%

---

## 8. Asset Standards

*Principio rector*: Los assets no son archivos — son páginas arrancadas del diario de aventuras. Cada decisión de formato, naming y resolución existe para que ese diario pueda reproducirse en cualquier pantalla sin perder la textura del trazo dibujado a mano, y sin exceder el peso de un PDF de viaje. Todo asset que entra al proyecto cumple estas especificaciones antes de importarse a Godot.

---

### 8.1 Formatos de Archivo

#### Formatos aprobados

| Categoría | Formato | Motivo |
|-----------|---------|--------|
| **Sprites de personajes** | PNG-32 (RGBA) | Transparencia por silueta irregular. Sin pérdida — el linework de 1–2px que el JPEG destruye con halos de compresión. |
| **Arte de cartas** | PNG-32 (RGBA) | La zona de arte tiene borde irregular de "papel pegado con cinta" — requiere alpha. |
| **Fondos de escena** | PNG-24 (RGB, sin alpha) | Ocupan el viewport completo. Sin pérdida para preservar firmas de hachura. |
| **Elementos de UI con silueta irregular** | PNG-32 (RGBA) | Tablones de madera, pergaminos, sellos de cera — todos tienen silueta orgánica. |
| **Íconos de UI** | PNG-32 en spritesheet por categoría | Un único bind de textura para todo el HUD. |
| **Partículas VFX** | PNG-32 en spritesheet por efecto | Frames de trazos rough — mismo tratamiento que linework. |
| **Audio — música** | OGG Vorbis | Excelente ratio compresión/calidad. Loop enabled. |
| **Audio — SFX cortos (<1s)** | WAV | Latencia de inicio cero. Crítico para hits de carta con timing exacto de frame. |
| **Audio — SFX largos (>1s)** | OGG Vorbis | WAV a esa duración cuesta demasiada memoria. |
| **Halos de PointLight2D** | PNG-32 (RGBA) | Manchas de luz dibujadas a mano con gradiente suave en los bordes. |

#### Formatos prohibidos

| Formato | Por qué |
|---------|---------|
| **JPEG / WebP con pérdida** | Los bloques de 8×8px de compresión crean halos exactamente alrededor de los trazos de tinta — destruye el estilo. |
| **MP3** | El módulo de MP3 de Godot añade ~150KB al binario WASM del web export. OGG logra lo mismo con mayor calidad. |
| **SVG en runtime** | Rasterizado en CPU — peso de trazo inconsistente según resolución. |
| **Formatos propietarios** (`.procreate`, `.clip`, `.psd`) | Solo como archivos de trabajo. El asset entregado al pipeline es siempre el PNG exportado. Los archivos de trabajo viven fuera del export bundle via `.gdignore`. |

---

### 8.2 Sistema de Naming

**Estructura base**: `[categoría]_[subcategoría]_[nombre]_[estado].[ext]`

#### Prefijos de categoría

| Prefijo | Categoría |
|---------|-----------|
| `char_` | Personajes (spritesheets y frames) |
| `env_` | Entorno (fondos, props, texturas) |
| `card_` | Arte de cartas |
| `ui_` | Interfaz de usuario |
| `vfx_` | Efectos visuales y partículas |
| `sfx_` | Audio — efectos de sonido |
| `bgm_` | Audio — música de fondo |
| `fx_` | Halos de luz para `PointLight2D` |

#### Convenciones por categoría

**Personajes**: `char_[personaje]_[spritesheet].[ext]`
- `[personaje]`: `improvisador`, `enemigo_[tipo]`, `jefe_[nombre]`, `npc_[nombre]`
- `[spritesheet]`: nombre descriptivo del conjunto de animaciones que contiene (ej: `combat`, `reactions`)
- Ejemplos: `char_improvisador_combat.png`, `char_enemigo_guardia_idle.png`

**Entorno**: `env_[subcategoría]_[objeto]_[estado].[ext]`
- Subcategorías: `bg` (fondo completo), `wall`, `floor`, `prop`, `silhouette`, `sky`
- Ejemplos: `env_bg_tavern_day.png`, `env_prop_barrel_tipped.png`

**Cartas**: `card_[nombre_carta]_art.[ext]`
- `[nombre_carta]` en snake_case sin artículos, debe coincidir exactamente con el campo `id` del `CardData`
- Ejemplos: `card_golpe_torpeza_art.png`, `card_escudo_improvisado_art.png`

**UI**: `ui_[componente]_[nombre]_[estado].[ext]`
- Componentes: `btn`, `panel`, `icon`, `bar`, `map`, `card`
- Estados: `default`, `hover`, `pressed`, `disabled`, `filled`, `empty`, `active`
- Ejemplos: `ui_btn_pass_default.png`, `ui_icon_impulso_filled.png`

**VFX**: `vfx_[efecto]_[frame_dos_dígitos].[ext]`
- Ejemplos: `vfx_impact_slash_01.png`, `vfx_idea_halo_01.png`

**Audio**: `sfx_[acción]_[descriptor].[ext]`, `bgm_[estado]_[lugar]_[tipo].[ext]`
- Ejemplos: `sfx_card_play_whoosh.ogg`, `sfx_damage_hit_heavy.wav`, `bgm_encounter_village_loop.ogg`

**Halos de luz**: `fx_halo_[descriptor].[ext]`
- Ejemplos: `fx_halo_candle_rough.png`, `fx_halo_spotlight_large.png`

#### Reglas de naming

1. Todo en minúsculas, separado por guión bajo — sin espacios, sin guiones medios.
2. Sin números en el nombre descriptivo — los números son para frames de VFX.
3. El estado siempre al final, antes de la extensión.
4. `card_[nombre]_art` debe coincidir con el campo `id` del `CardData` — es el contrato entre arte y datos.
5. Frames de VFX empiezan en `01`, nunca en `00`.

---

### 8.3 Tiers de Resolución de Source Art

*Todo source art se produce a 2× del footprint en pantalla* salvo íconos de UI (al tamaño exacto de uso) y fondos de escena (al ancho del viewport).

| Categoría | Footprint en pantalla | Source art | Máximo absoluto |
|-----------|-----------------------|------------|-----------------|
| El Improvisador | 80×100px | 160×200px | 160×200px |
| Enemigo estándar | 64×80px | 128×160px | 128×160px |
| Enemigo élite | 80×96px | 160×192px | 160×192px |
| Jefe | 160×180px | 320×360px | 320×360px |
| NPC | 48×64px | 96×128px | 96×128px |
| Arte de carta (en mano) | 72×54px | 144×108px | 144×108px |
| Arte de carta (recompensa) | 144×108px | 288×216px | 288×216px |
| Fondo de escena | 640px ancho | 640px ancho | 640×360px |
| Props medianos | ~48–80px alto | ~100–160px alto | 200px alto |
| Props pequeños | ~24–40px alto | ~48–80px alto | 80px alto |
| Íconos de UI (estándar) | 32×32px | 32×32px | 32×32px |
| Íconos de mapa de nodos | 40–48px | 40–48px | 48×48px |
| Partículas VFX | 16–48px | 32–96px | 96×96px |
| Halos de PointLight2D | 128–256px | 128–256px | 256×256px |

**Por qué íconos de UI al tamaño exacto (no 2×)**: los íconos son formas simples con trazos gruesos (≥3px) producidos exactamente al tamaño de uso. El upscale 2× y downscale posterior suaviza los trazos — efecto contrario al deseado.

**Por qué fondos no siguen 2×**: la cámara es fija, el jugador nunca se acerca. Un fondo a 2× pesa 4× en memoria sin ninguna ganancia visual.

**Regla de máximo absoluto**: superar el máximo de la tabla requiere justificación explícita en el commit del asset.

---

### 8.4 Configuración del Importer — Godot 4.6

**Configuración base para sprites 2D** (ajustar en el panel Import del editor y guardar en `.import`):

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| **Compress > Mode** | `Lossless` | Sin compresión lossy — el linework de 1–2px es el primero en degradarse. |
| **Filter** | `Linear` | El source art a 2× se downscalea en runtime. Linear preserva las transiciones de tono sin aliasing. |
| **Mipmaps > Generate** | `Off` | Cámara fija — sin zoom out. Los mipmaps añaden 33% de memoria sin beneficio visible. |
| **Repeat** | `Disabled` | Los sprites de este juego nunca se tilan. |
| **HDR Mode** | `Disabled` | Paleta de 7 colores planos — sin rango dinámico extendido. |
| **Fix Alpha Border** | `Enabled` | Previene el halo oscuro en bordes semi-transparentes. Crítico para linework de Tinta sobre alpha. |

**Excepción para halos de PointLight2D**: `Filter: Linear` (ya es el default y apropiado para manchas de luz difusa).

**Compresión VRAM para web**: mantener `Lossless` (sin compresión VRAM). La penalidad es mayor uso de RAM de GPU; la ganancia es que el linework no sufre artefactos de compresión por bloques (ETC2 introduce bloques de 4×4px visibles en trazos de 1–2px). Si los tests de memoria en web muestran que el límite de 512MB se acerca, evaluar ETC2 exclusivamente para fondos (no para personajes) y documentar como ADR.

> **Verificar en 4.6**: Los formatos VRAM disponibles en HTML5 export y cuál selecciona Godot 4.6 automáticamente pueden haber cambiado entre 4.3 y 4.6. Confirmar antes de decidir la estrategia VRAM final.

---

### 8.5 Presupuesto de Memoria de Textura

**Ceiling disponible para texturas**: ~430MB (sobre 512MB total, descontando ~80MB de overhead del motor).

| Categoría | Presupuesto máximo | Notas |
|-----------|-------------------|-------|
| Personajes (Improvisador + enemigos activos simultáneos) | 32MB | 3 spritesheets activos máximo en pantalla simultáneamente |
| Fondos (3 capas de escena) | 16MB | Cámara fija — una carga por escena |
| Atlas de UI (íconos HUD + materiales) | 24MB | 1–2 atlases de 2048×2048px máximo |
| Arte de cartas (hand de 4 + deck completo del MVP) | 16MB | ~40 cartas × 144×108px × 4 bytes = ~2.5MB real |
| VFX y partículas | 8MB | Frames de trazos son pequeños por naturaleza |
| Fuentes (Almendra + MedievalSharp, cache de rasterización) | 4MB | |
| **Reserva / headroom** | ~330MB | Buffer conservador — en web el crash de tab no es graceful degradation |

**Validación**: antes de cada milestone, correr `Project > Profiler > Memory` en la escena de encuentro activo y verificar que el uso de VRAM no supere los valores por categoría.

---

### 8.6 Animaciones de Personajes — Spritesheets + AnimatedSprite2D

**Formato**: spritesheets por personaje importadas como `SpriteFrames` resource, reproducidas vía `AnimatedSprite2D`. No frames individuales en `AnimationPlayer`.

**Por qué spritesheets**: un solo bind de textura por personaje permite que Godot batchee todos los frames de animación. Frames individuales generan un bind separado por frame, rompiendo el batch. En web export, cada archivo `.import` individual también suma overhead al PCK.

**Organización de la spritesheet**:
- Frames en orden horizontal de izquierda a derecha, por animación.
- Tamaño de celda fijo: el frame más grande del personaje define el tamaño de toda la celda del atlas.
- Máximo 8 frames por fila. Si el personaje tiene más de 8 frames totales, continuar en la siguiente fila.
- El atlas de un personaje completo (todas sus animaciones) debe caber en máximo 512×256px.

**Herramienta de packing**: el editor de `SpriteFrames` de Godot importa spritesheets directamente con `New > Horizontal Strip`. Sin herramienta externa necesaria para el volumen del MVP.

**Nombres de animación en AnimatedSprite2D** (contrato entre arte y código — no cambiar sin propagar al código):

`idle`, `focus`, `play`, `damage`, `lowhp`, `victory`, `defeat`, `windup`, `hold`

**Excepción — íconos de UI y VFX**: los íconos de UI se empacan en un atlas compartido por categoría (`atlas_icons_ui.png`, `atlas_icons_map.png`) accedido vía `AtlasTexture`. Los frames de VFX se empacan en spritesheet por efecto (`vfx_impact_slash.png`, etc.).

> **Verificar en 4.6**: `AnimatedSprite2D` y `SpriteFrames` son los nodos correctos en Godot 4.x. Confirmar que `AnimatedSprite2D.play(StringName)` es la firma correcta en 4.6 — los cambios de StringName en AnimationPlayer de versiones 4.4+ pueden afectar este nodo.

---

### 8.7 Profundidad de Color y Paleta en Assets

Los assets usan la paleta de 7 colores definida en la Sección 4 — no colores custom por asset. Un verde que "le queda mejor" a un enemigo pero no es `#47B859` (Verde Absurdo) comunica sin querer "este elemento es una comedia" o destruye la lectura semántica del color en esa pantalla.

**Restricciones al producir source art**:

1. **Ningún color fuera de la paleta de 7 + neutrales en zonas semánticas** — fills de personajes, fills de materiales de UI, tono base de props. Las variaciones de iluminación deben derivarse de un color de paleta (tono base × 0.65–0.75 de luminosidad), nunca inventadas.
2. **Máximo 2 tonos por región de color**: color base + un valor de sombra. Sin gradientes entre los dos tonos.
3. **Contornos siempre en Tinta `#2E1F14`** — nunca negro puro `#000000`, nunca el color del fill.
4. **Alpha binario**: completamente opaco o completamente transparente. Excepción: halos de `PointLight2D` y efectos de fade en animaciones de UI.
5. **Sin blend modes en el asset exportado**: las capas multiply o screen del software de dibujo se colapsan a colores planos de la paleta antes de exportar. El blending ocurre en Godot, no en Procreate.

---

### 8.8 Export Web — Target <5MB

| Componente | Target de tamaño (comprimido) |
|------------|-------------------------------|
| WASM del motor (Godot runtime) | ≤ 3.5MB |
| Assets (texturas + audio + fuentes + recursos) | ≤ 1.2MB |
| Scripts (bytecode compilado) | ≤ 0.15MB |
| HTML / JS de loader | ≤ 0.15MB |
| **Total** | ≤ 5.0MB |

**Configuración de export requerida**:

| Setting | Valor |
|---------|-------|
| Debug | Off (Release build) |
| GDScript > Bytecode optimization | On |
| Compress Resources | On |
| Export PCK | Embebido en HTML (un solo archivo — evita requests separados en itch.io) |
| Módulos innecesarios | Desactivar física 3D, XR, video si no se usan |

**Reducción de tamaño de assets para web**:
- Fuentes: instalar solo los pesos usados (Almendra Regular + Bold, MedievalSharp Regular). Subsetear al charset Latin + español (á é í ó ú ñ ü ¡ ¿) en el import de Godot — reduce el tamaño del cache de rasterización.
- Audio: OGG exclusivamente (sin MP3). Archivos de fuente `.wav` solo para SFX <1s en el proyecto; Godot los re-empaqueta en el export.
- La compresión ZSTD del PCK es efectiva sobre PNG — PNGs sin comprimir comprimen mejor en el empaquetado que JPGs ya comprimidos.

**Regla de autoplay en web**: el audio no puede iniciarse antes del primer input del usuario (restricción de todos los browsers modernos). La música del menú principal se inicia en el primer evento de input — nunca en `_ready()`.

> **Verificar en 4.6**: Las opciones exactas del export HTML5, el soporte de `SharedArrayBuffer`, y el threading model pueden haber cambiado entre 4.3 y 4.6. El threading model afecta si el audio se reproduce sin interacción previa. Confirmar antes del primer build web.

---

### 8.9 Draw Call Accounting — Pantalla de Encuentro Activo

Estimado de draw calls en la escena más compleja del juego:

| Elemento | Draw calls estimados |
|----------|----------------------|
| Fondo lejano + plano medio + silueta | 3–8 |
| Luces (DirectionalLight2D + 2 PointLight2D) | +3 passes |
| El Improvisador + enemigo activo | 2–4 |
| Panel de Situación + HP enemigo + Timer | 4–6 |
| Atlas de UI / HUD | 2–4 (si mismo atlas, batched) |
| 4 cartas en mano (cuerpo + arte + label) | 8–12 |
| HP del Improvisador + Banda de Impulso + botón Pasar | 3–5 |
| **Total estimado** | **~35–55 draw calls** |

El peor caso realista (shader custom en personajes, 5 props, 3 luces activas) llega a ~80 draw calls — muy por debajo del presupuesto de 500. **No se requieren optimizaciones de draw call para el MVP.**

**Principal amenaza al batch**: los `PointLight2D` fuerzan un render pass adicional sobre todos los nodos en su radio. Mitigación: configurar `Light2D.item_cull_mask` para que cada luz solo afecte los layers que debe iluminar (la luz de la Situación no necesita afectar Layer 5 de silueta).

> **Verificar en 4.6**: El sistema de batching de `CanvasItem` 2D y la interacción con `PointLight2D` pueden tener mejoras en 4.4–4.6. Los números de arriba son estimados conservadores — validar con el profiler de Godot en el build real.

---

### 8.10 Shaders 2D — Restricciones

**Regla editor-first**: todo `ShaderMaterial` asignado a un `Sprite2D` o `AnimatedSprite2D` debe tener todos sus `uniform` con valores default razonables. Un sprite negro o invisible en el editor porque el shader necesita un uniform configurado en código viola el constraint editor-first.

**Shaders compatibles con el estilo garabato**:

| Tipo | Uso | Compatible editor-first |
|------|-----|------------------------|
| Outline / borde dibujado | Reforzar linework sobre fondos complejos | Sí |
| Color modulation / palette swap | Flash de daño, estados de personaje | Sí — editable via Inspector |
| Dissolve con textura de crosshatch | Derrota de enemigo | Sí — si el patrón viene de textura, no de ruido procedural |
| CanvasItem blend custom | Mixing de capas de entorno | Sí |

**Límites para shaders en web** (WebGL2, 60fps en hardware de laptop/tablet medio):

| Operación | Límite recomendado (fragment shader) |
|-----------|--------------------------------------|
| Samples de textura (`texture()`) | ≤ 4 por fragment |
| Operaciones matemáticas | ≤ 32 instrucciones por fragment |
| Branching condicional (`if`) | ≤ 3 niveles de anidamiento |

**Técnica de outline recomendada**: 4 samples (UV en +X, -X, +Y, -Y, comparar alpha). Produce outline de 1–2px compatible con el estilo hand-drawn. No usar técnicas de N samples en loop — el compilador WebGL no unrollea loops de tamaño variable de forma eficiente.

**Nomenclatura de shaders**: `assets/shaders/[efecto]_[target]_2d.gdshader`
- `outline_character_2d.gdshader`, `damage_flash_2d.gdshader`, `palette_swap_2d.gdshader`, `dissolve_crosshatch_2d.gdshader`

> **Verificar en 4.6**: El Shader Baker (introducido en 4.5) pre-compila shaders al exportar. Confirmar si aplica a builds web (WebGL2) o solo a builds nativas.

---

### 8.11 Checklist de Asset — Validación antes de Importar

**Sprites**
- [ ] Formato PNG (PNG-32 con alpha para sprites, PNG-24 sin alpha para fondos)
- [ ] Resolución es exactamente 2× el footprint en pantalla (o tamaño exacto para íconos de UI)
- [ ] Naming: `[categoría]_[subcategoría]_[nombre]_[estado].[ext]` en snake_case
- [ ] Import settings: `Lossless`, `Linear`, `Mipmaps Off`, `Fix Alpha Border On`
- [ ] Solo colores de la paleta de 7 + neutrales en zonas semánticas
- [ ] Máximo 2 tonos por región de color. Sin gradientes.
- [ ] Contornos en Tinta `#2E1F14` exclusivamente
- [ ] Alpha binario (salvo halos y efectos de fade). Capas de blend mode colapsadas.
- [ ] Pasa el test de silueta a footprint de pantalla rellena en dos colores planos

**Spritesheets de personaje**
- [ ] Frames en orden horizontal de izquierda a derecha por animación
- [ ] Tamaño de celda consistente en todo el atlas
- [ ] Atlas completo del personaje (todas las animaciones) cabe en máximo 512×256px
- [ ] Nombres de animación coinciden con el contrato: `idle`, `focus`, `play`, `damage`, `lowhp`, `victory`, `defeat`, `windup`, `hold`

**Audio**
- [ ] Música: OGG Vorbis, quality 0.6–0.7, loop enabled
- [ ] SFX cortos (<1s): WAV, loop disabled
- [ ] SFX largos (>1s): OGG Vorbis, quality 0.7–0.8
- [ ] Ningún archivo MP3

**Fuentes**
- [ ] Solo Almendra (Regular + Bold) y MedievalSharp (Regular) instaladas
- [ ] Subseteadas al charset Latin + español: `a-zA-ZáéíóúñüÁÉÍÓÚÑÜ¡¿ 0-9.,!?-:;()"`

**Validación de tamaño (build web)**
- [ ] Export web release: archivo resultante ≤ 5MB
- [ ] `Project > Tools > Profiler > Memory` en escena de encuentro activo: VRAM por categoría dentro de los presupuestos de Sección 8.5

---

## 9. Reference Direction

*Principio rector*: Las referencias son restricciones, no aspiraciones. Cada una extrae un elemento específico del que el juego se beneficia; cada una tiene una frontera explícita donde el juego deliberadamente diverge. Usarlas como checklist, no como mood board: "¿Este asset aplica el principio X de la referencia Y?" Si la respuesta es "se parece a Y" en lugar de "aplica el principio X de Y", la referencia no está funcionando.

**Las cinco referencias cubren cinco ángulos sin solapamiento:**

| Referencia | Ángulo cubierto |
|---|---|
| Cuphead (Studio MDHR, 2017) | Lenguaje de animación y estructura de poses |
| Paul Kidby — ilustraciones de Discworld (1991–2015) | Diseño de personaje: exageración de rasgo + legibilidad de silueta |
| Les Très Riches Heures du Duc de Berry (Limbourg Brothers, 1412–1416) | Paleta de color, relación luz/sombra, jerarquía plana |
| Legends of Kingdom Rush — cómic (Ironhide Games, 2020–presente) | Diseño de cartas y UI diegética en roguelike medieval |
| Don Hertzfeldt — "It's Such a Beautiful Day" (2011–2012) | Gramática de la imperfección intencional como lenguaje expresivo |

---

### 9.1 Cuphead (Studio MDHR, 2017)

**Ángulo cubierto**: Lenguaje de animación — estructura de poses, extremos, y legibilidad de acción por silueta.

**Qué extraer exactamente:**

- **Poses de extremo como poses de descanso**: en Cuphead, el frame de reposo entre acciones es una pose claramente dibujada con intención, no una posición neutra. Aplicar al set de animación (Sección 5.4): cada frame del set MVP debe poder leerse como ilustración estática — no como transición.
- **Personalidad diferenciada por tipo de enemigo sin cambiar el estilo**: los enemigos de Cuphead son distinguibles en una tira de papel negro. Aplicar: los arquetipos de Sección 3.1 (estándar, élite, jefe) deben ser distinguibles por silueta sin necesitar colores ni detalles internos.
- **La exageración tiene una dirección por personaje, no es aleatoria**: Cuphead estira verticalmente en salto porque su rasgo es ser liviano. Aplicar: El Improvisador tiene una dirección de squash/stretch codificada — elongación en eje de la carta que juega, siguiendo la intención de la acción.
- **El wind-up es tan legible como el impacto**: cada ataque tiene una anticipación que es una imagen propia. Aplicar directamente al lenguaje de ataque enemigo (Sección 5.3): 3 frames + hold de 0.5s.

**Qué NO tomar:**

- **No el framerate**: Cuphead usa 24fps con in-betweens cuidadosos. Este juego usa 3 frames a 10–12fps. Un asset que imita el in-betweening de Cuphead a 3 frames produce movimiento barato, no expresivo.
- **No la estética rubberhose de 1930**: extremidades en manguera de goma, ojos blancos, referencias a Max Fleischer. Este juego tiene personajes medievales con proporciones exageradas — la estructura de las poses se extrae, no la morfología de los cuerpos.
- **No el nivel de detalle interno**: fills de halftone, sombras en dos colores complejas. Este juego usa 2 tonos por región y contorno de Tinta.

**Por qué es aditivo**: cubre *cómo animar* con baja cuenta de frames sin perder legibilidad. Las otras referencias cubren estilo visual estático; esta cubre la dimensión temporal.

---

### 9.2 Paul Kidby — Ilustraciones de Discworld (1991–2015)

**Ángulo cubierto**: Diseño de personaje — cómo la exageración de un rasgo único produce humor Y legibilidad de silueta simultáneamente, en personajes medievales y de fantasía vernácula.

**Obras específicas**: *The Art of Discworld* (HarperCollins, 2004) y las portadas de las ediciones modernas. No las ilustraciones de Josh Kirby — las de Kidby.

**Qué extraer exactamente:**

- **El rasgo exagerado único como definición del personaje**: el Guardia Colon de Kidby se define por su barriga — el resto del cuerpo es casi correcto. Aplicar a la regla de "rasgo dominante único" (Sección 3.1): el enemigo estándar que diseñes debe tener un rasgo que haga el 80% del trabajo de lectura cómica.
- **Caras medievales como formas geométricas, no anatomía**: narices como bulbos, ojos como elementos narrativos. Aplicar al set de expresiones de Sección 5.1: los cinco features exagerados son formas simples con un rango de posiciones, no dibujos anatómicos.
- **Figuras medievales vestidas incorrectamente como norma estética**: la armadura siempre tiene algo que no pertenece. Valida el principio de "al menos una pieza claramente incorrecta" (Sección 5.1) como lenguaje sistemático, no excepción.
- **El color como carácter, no como descripción**: los colores de Kidby revelan personalidad antes que material. Aplicar a los enemigos de Acto 1: el color primario del enemigo debe revelar su categoría emocional (tonto/peligroso/absurdo) antes que su material de armadura.

**Qué NO tomar:**

- **No el detalle de ejecución**: Kidby es un ilustrador profesional con variación de peso de línea fina y valores de sombra complejos. Este juego usa 2 tonos y contorno uniforme.
- **No la iconografía del mundo de Discworld**: la arquitectura de Ankh-Morpork, su fauna, su geopolítica visual son intrasferibes. Lo que se transfiere es el principio de diseño de personaje.
- **No el humor de ilustración de libro**: el chiste de Kidby funciona en una página estática. En este juego debe leerse en 1 segundo a 48×48px equivalente.

**Por qué es aditivo**: el único referente que demuestra cómo diseñar personajes medievales y de fantasía *intencionalmente incorrectos* con humor legible — en el espacio temático exacto de este juego.

---

### 9.3 Les Très Riches Heures du Duc de Berry (Limbourg Brothers, 1412–1416)

**Ángulo cubierto**: Paleta de color y relación entre luz, sombra y jerarquía visual — cómo una paleta medieval produce contraste y foco sin iluminación realista.

**Cómo acceder**: digitalización de alta resolución en dominio público en Wikimedia Commons (buscar "Très Riches Heures"). Las páginas de los meses: enero, abril, mayo, octubre.

**Qué extraer exactamente:**

- **Color plano saturado + sombra como área separada (sin gradiente)**: los Limbourg dibujan sombras como regiones planas de valor más oscuro con borde visible — no como gradiente. Esto especifica la Regla de 2 Tonos (Sección 5.5): la sombra es una región plana de valor más oscuro con borde visible, no una transición de pintura digital.
- **El oro como color de luz, no como decoración**: el pan de oro señala los puntos de mayor iluminación. Aplicar al uso de Dorado Caos (`#F2B71F`) en los `PointLight2D`: el dorado es donde la luz toca, no donde se quiere llamar la atención.
- **Fondo como color de estado, no como espacio**: los fondos son azul profundo o dorado plano — colores que comunican el registro de la escena. Aplicar a los CanvasModulate por estado de juego (Sección 2): el color del CanvasModulate es el "color de estado" medieval, igual que el azul del cielo del folio de mayo es narrativo, no fotográfico.
- **Jerarquía por tamaño relativo, no por perspectiva**: las figuras importantes son más grandes independientemente de la profundidad espacial. Aplicar a Sección 3.5: El Improvisador y el enemigo activo son más grandes que los demás elementos porque son más importantes narrativamente — no por profundidad física.

**Qué NO tomar:**

- **No la densidad de detalle**: cientos de figuras miniaturistas. Este juego tiene máximo 5 elementos en pantalla (Sección 7.1).
- **No la perspectiva aplastada medieval** (planta + alzado mezclados): este juego tiene vista lateral plana y consistente.
- **No el symbolism iconográfico religioso**: los colores medievales de los manuscritos tienen significado teológico específico. Las reglas semánticas de color de este juego (Sección 4) son propias.

**Por qué es aditivo**: el único referente que explica *cómo funciona el color medieval plano*. Justifica por qué la paleta de 7 colores con sombras planas es una decisión histórica y expresiva coherente, no una limitación técnica.

---

### 9.4 Legends of Kingdom Rush — Cómic (Ironhide Games, 2020–presente)

**Ángulo cubierto**: Diseño de cartas y UI diegética en roguelike de fantasía — cómo un elemento de interfaz medieval legible a tamaño pequeño coexiste con un mundo visual de exageración de cartoon.

**Nota**: el referente es el *cómic* (Webtoon / ComiXology), no el juego original Kingdom Rush — el cómic tiene peso de trazo y tratamiento de UI más cercanos a este proyecto.

**Cómo acceder**: Webtoon (búsqueda "Legends of Kingdom Rush") o ComiXology. Volúmenes 1 y 2. Concentrarse en los paneles de batalla y en las pantallas de selección de habilidades.

**Qué extraer exactamente:**

- **Peso de trazo consistente entre personajes y elementos tipo-carta**: en el cómic, los indicadores de habilidad y los sellos del mundo tienen el mismo peso de línea que los personajes. Aplicar: los materiales de UI de Sección 3.4 (tablones de madera, pergaminos, sellos de cera) deben tener el mismo peso de trazo que los contornos de personaje — 3px a escala de juego. Si el personaje tiene contorno de 3px y el tablón tiene 1px, se disocian.
- **Jerarquía de lectura en indicadores medievales pequeños**: los íconos de habilidad son reconocibles a 32×32px porque usan un único elemento interno de alto contraste. Aplicar a los íconos MVP (Sección 7.3): ícono de Impulso (chispa de 4 líneas), ícono de Timer (reloj de arena asimétrico) — un solo elemento interno, sin dos o tres elementos compitiendo.
- **El letrero/cartel como contenedor de información sin panel de UI flotante**: la información de unidad vive en carteles que parecen colgados de algo. Valida "UI Has Mass" (Principio 3) con un caso real del género.
- **La carta como objeto físico con borde imperfecto**: el borde de la carta tiene irregularidad leve — no un rectángulo con border-radius uniforme. Aplicar a la gramática de carta de Sección 3.3: el borde irregular es parte del lenguaje "carta como objeto físico".

**Qué NO tomar:**

- **No el estilo de personaje de Kingdom Rush**: más redondeados y con proporciones chibi. El Improvisador tiene proporciones más estiradas calibradas hacia Cuphead, no Kingdom Rush.
- **No la paleta**: Kingdom Rush usa colores de fantasía épica genérica. La paleta de este juego es un sistema semántico de 7 colores.
- **No la composición de cómic**: múltiples figuras en acción en panel narrativo. Las pantallas de videojuego tienen jerarquía de UI diferente.

**Por qué es aditivo**: el único referente que existe en el mismo género y muestra *cómo materializar la UI diegética* con personajes de proporciones similares, en elementos de pantalla de videojuego reales.

---

### 9.5 Don Hertzfeldt — "It's Such a Beautiful Day" (2011–2012)

**Ángulo cubierto**: La gramática de la imperfección intencional — por qué el trazo tosco y la geometría incorrecta producen emoción y conexión, no distancia. La justificación de "levemente wrong on purpose."

**Cómo acceder**: canal oficial de Don Hertzfeldt en YouTube o Vimeo, y compra digital (iTunes, Google Play). La trilogía completa "Everything Will Be OK" / "I Am So Proud of You" / "It's Such a Beautiful Day". Concentrarse en los primeros 15 minutos y en las escenas de ciudad y de hospital.

**Qué extraer exactamente:**

- **La línea que no cierra como decisión expresiva, no como error**: en Hertzfeldt, los círculos no cierran, las líneas rectas se arquean. Esto produce la sensación de que alguien lo dibujó rápidamente porque le importaba. Aplicar directamente a la gramática de geometría de Sección 3.2: arcos que no cierran (gap de 2–4px), líneas que se extienden más allá de esquinas — operaciones expresivas equivalentes, no descuidos.
- **Simpleza de trazo que permite proyección emocional**: los personajes de Hertzfeldt son figuras de 3 líneas que producen empatía, humor y tristeza. Un personaje con menos detalle interno permite al espectador proyectar emoción en él más fácilmente. Aplicar: los personajes de este juego con 2 tonos y silueta clara permiten la proyección que los personajes hiper-detallados dificultan.
- **El tachado y la línea áspera como marcas de urgencia**: en Hertzfeldt, una línea extra o marca indica "esto cambió". Aplicar a la carta marcada con X (Sección 3.3): la X de tinta es la misma operación visual — "esto ya no está disponible", tachado en un cuaderno con urgencia.
- **La imprecisión consistente como firma, no como defecto**: el trazo impreciso de Hertzfeldt es consistente en todo el film. Aplicar como regla de producción: la imprecisión en este juego debe ser *consistente* en todos los assets para que se lea como estilo. Un asset garabato rodeado de assets prolijos hace que el garabato parezca error.

**Qué NO tomar:**

- **No el minimalismo extremo**: los personajes de Hertzfeldt son más simples que cualquier cosa de este juego. El principio de *por qué funciona la imperfección* se extrae — no el nivel de detalle.
- **No el tono oscuro o existencial**: el film trata sobre la muerte y la pérdida de memoria. El tono de este juego es slapstick y caos performativo. La referencia no transfiere tono — transfiere gramática visual.
- **No la técnica de animación en papel escaneado**: este juego produce sprites digitales. La referencia es sobre la *apariencia* del trazo impreciso, no sobre el proceso que lo produce.

**Por qué es aditivo**: el único referente que responde "¿por qué la imperfección es un lenguaje válido y no mala ejecución?" Las otras cuatro referencias muestran qué producir; esta explica por qué funciona cuando se hace consistentemente. También es útil para defender el estilo frente a feedback de "¿por qué los assets no están más terminados?"

---

### 9.6 Tabla Consolidada de Reglas por Referencia

| Regla de la referencia | Sección del art bible donde aplica |
|---|---|
| Poses de extremo legibles como ilustraciones estáticas (Cuphead) | 5.4 — Filosofía de Animación para MVP |
| Personalidad de enemigo diferenciada por silueta sin detalle interno (Cuphead) | 3.1 — Siluetas de Personajes |
| Rasgo exagerado único como definición del personaje (Kidby) | 3.1 — Siluetas de Personajes |
| Colores de personaje revelan categoría emocional, no material (Kidby) | 4 — Vocabulario Semántico |
| Sombra como región plana separada, sin gradiente (Très Riches Heures) | 5.5 — Regla de 2 Tonos |
| El dorado es donde la luz toca (Très Riches Heures) | 2 — Mood & Atmosphere / PointLight2D |
| Peso de trazo consistente entre personajes y UI (Kingdom Rush cómic) | 3.4 — Gramática de UI |
| Ícono con único elemento interno a 32px (Kingdom Rush cómic) | 7.3 — Iconografía |
| Imprecisión consistente en todos los assets = estilo; variable = error (Hertzfeldt) | 1 — Visual Identity Statement |
| La X de tinta como operación visual de "tachado urgente" (Hertzfeldt) | 3.3 — Gramática de las Cartas |
