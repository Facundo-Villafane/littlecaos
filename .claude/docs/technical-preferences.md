# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Godot 4.6
- **Language**: GDScript
- **Rendering**: Godot Rendering Server (Forward+/Mobile backend)
- **Physics**: Jolt Physics (default en Godot 4.6)

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: PC (Steam), Web (itch.io HTML5)
- **Input Methods**: Keyboard/Mouse (primario), Gamepad (opcional)
- **Primary Input**: Keyboard/Mouse — juego de cartas, click-driven
- **Gamepad Support**: Partial — navegación de menús recomendada, no requerida
- **Touch Support**: Partial — web puede ser accedido desde tablet
- **Platform Notes**: UI debe funcionar sin hover-only interactions. Export web debe apuntar a < 5MB para carga rápida en itch.io. No assumptions de resolución fija.

## Naming Conventions

- **Classes**: PascalCase (e.g. `PlayerController`)
- **Variables**: snake_case (e.g. `move_speed`, `current_health`)
- **Signals/Events**: snake_case pasado (e.g. `health_changed`, `card_played`)
- **Files**: snake_case matching clase (e.g. `player_controller.gd`)
- **Scenes/Prefabs**: PascalCase matching nodo raíz (e.g. `PlayerController.tscn`)
- **Constants**: UPPER_SNAKE_CASE (e.g. `MAX_HEALTH`, `DEFAULT_IMPULSO`)

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms
- **Draw Calls**: ~500 (2D, Godot Forward+/Mobile backend)
- **Memory Ceiling**: 512 MB RAM (objetivo para itch.io web)

## Testing

- **Framework**: GUT (Godot Unit Test) — instalable como addon desde Asset Library
- **Minimum Coverage**: Sistemas de lógica de juego (fórmulas, máquinas de estado, efectos de cartas)
- **Required Tests**: Fórmulas de balance, sistema de Situaciones, lógica de deck building

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here. Only add when actively integrating. -->
- GUT (Godot Unit Test) — testing framework

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: godot-specialist
- **Language/Code Specialist**: godot-gdscript-specialist (todos los archivos .gd)
- **Shader Specialist**: godot-shader-specialist (archivos .gdshader, VisualShader resources)
- **UI Specialist**: godot-specialist (sin especialista dedicado de UI — primary cubre todo)
- **Additional Specialists**: godot-gdextension-specialist (GDExtension / bindings nativos C++ solo cuando se necesiten)
- **Routing Notes**: Invocar primary para decisiones de arquitectura, validación de ADRs y code review cross-cutting. Invocar GDScript specialist para calidad de código, arquitectura de señales, static typing y GDScript idioms. Invocar shader specialist para materiales y shaders. Invocar GDExtension specialist solo cuando haya extensiones nativas.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.gd files) | godot-gdscript-specialist |
| Shader / material files (.gdshader, VisualShader) | godot-shader-specialist |
| UI / screen files (Control nodes, CanvasLayer) | godot-specialist |
| Scene / prefab / level files (.tscn, .tres) | godot-specialist |
| Native extension / plugin files (.gdextension, C++) | godot-gdextension-specialist |
| General architecture review | godot-specialist |
