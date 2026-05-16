# Godot Engine — Version Reference

| Field | Value |
|-------|-------|
| **Engine Version** | Godot 4.6 |
| **Release Date** | January 2026 |
| **Project Pinned** | 2026-05-13 |
| **Last Docs Verified** | 2026-05-13 |
| **LLM Knowledge Cutoff** | May 2025 |
| **Risk Level** | HIGH — versiones 4.4, 4.5, 4.6 están más allá del training data |

## Knowledge Gap Warning

El training data del LLM cubre Godot hasta ~4.3. Las versiones 4.4, 4.5 y 4.6
introdujeron cambios significativos que el modelo NO conoce por entrenamiento.
Siempre cruzar con este directorio antes de sugerir llamadas a la API de Godot.

## Post-Cutoff Version Timeline

| Version | Release | Risk Level | Key Theme |
|---------|---------|------------|-----------|
| 4.4 | ~Feb 2025 | MEDIUM | FileAccess return types, typed dicts, shader texture type changes, CSG rewrite |
| 4.5 | ~Mid 2025 | HIGH | Variadic args, @abstract, AccessKit (screen readers), Shader Baker, SMAA, physics interpolation in SceneTree |
| 4.6 | Jan 2026 | HIGH | Jolt default para nuevos proyectos, glow rework, D3D12 default en Windows, AnimationPlayer StringName changes |

## Verified Sources

- Migración 4.3→4.4: https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.4.html
- Migración 4.4→4.5: https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.5.html
- Migración 4.5→4.6: https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.6.html
- Jolt Physics: https://docs.godotengine.org/en/4.6/tutorials/physics/using_jolt_physics.html
- Changelog: https://github.com/godotengine/godot/blob/master/CHANGELOG.md
- Release notes 4.6: https://godotengine.org/releases/4.6/

## Quick Reference — Cambios Más Importantes para Este Proyecto

Este proyecto usa: **GDScript, 2D, sin física 3D, sin animaciones esqueléticas.**

Cambios relevantes para Caos en Mano:
- **FileAccess** (4.4): `store_*` ahora retorna `bool`, no `void`
- **Typed Dictionaries** (4.4): `var d: Dictionary[String, int]` — ambos tipos requeridos
- **@abstract** (4.5): usar para clases base del sistema de cartas/situaciones
- **Variadic args** (4.5): `func f(...args: Array)` disponible
- **Glow defaults** (4.6): blend mode cambió a Screen, ajustar si se usa glow
- **D3D12 default** (4.6): default en Windows para nuevos proyectos — no afecta 2D en práctica
- **Navigation async** (4.5): si se usa navegación, es async por default
