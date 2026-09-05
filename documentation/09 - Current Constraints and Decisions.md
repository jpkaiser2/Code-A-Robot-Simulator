---
title: Current Constraints and Decisions
aliases:
  - Architecture Decisions
  - Known Limitations
tags:
  - code-a-robot
  - architecture
  - decisions
  - limitations
status: living-document
last-reviewed: 2026-09-05
---

# Current constraints and decisions

This note records facts visible in the current implementation and the consequences they create.
It is not a claim that every prototype decision should become permanent.

## Decision summary

| Area            | Current choice                                  | Consequence                                                                         |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Application     | Next.js App Router with client-heavy workspaces | Simple web deployment; large browser bundle/runtime responsibility                  |
| Robot authoring | Versioned primitive `RobotDefinition` JSON      | Portable and editable, but no mesh assets or runtime binding yet                    |
| 3D              | Three.js constructed directly in components     | Full control; rendering code is tightly coupled to UI lifecycle                     |
| Java            | CheerpJ Java 8 in a `srcDoc` iframe             | Real Java compile/run in browser; external loader and large compiler asset required |
| FTC API         | Generated minimal Java stand-ins                | Lesson-focused surface; not complete FTC SDK compatibility                          |
| Runtime         | Custom TypeScript state machine and kinematics  | Deterministic and approachable; no true physics/collisions                          |
| Persistence     | React memory only                               | Refresh loses builder and editor work                                               |
| Builder/runtime | Separate robot models                           | Builder output cannot yet drive simulation                                          |
| Hardware        | Four hard-coded device names                    | Examples work; arbitrary robot configuration does not                               |

## Architectural decisions worth preserving

### Serialized robot source of truth

Keeping authored robot state in a plain, versioned structure makes import/export, migrations,
testing, storage, and future Code-A-Robot transport practical. Transient preview and selection state
appropriately remain outside it.

### Simulation state outside the scene graph

The runtime store is authoritative and the Three.js scene consumes it. This supports telemetry,
headless testing, replay, and alternate renderers better than treating mesh transforms as state.

### Narrow Java bridge

Generated FTC-like Java classes call a small native interface, keeping lesson code familiar while
allowing the simulator implementation to remain TypeScript. New APIs should continue to cross an
explicit, typed boundary.

### Reusable driver-station surface

Separating the driver-station presentation from its mock and live adapters enables isolated UI
development without duplicating the final surface.

## Current technical constraints

### No backend

There are no API routes, server actions, database clients, authentication hooks, or storage
services. Any persistence or Code-A-Robot integration requires a new boundary and data contract.

### External Java runtime dependency

The iframe loads CheerpJ from a CDN at runtime. Network blocking, CSP restrictions, upstream
availability, or incompatible browsers can prevent Java from starting even when the Next.js app
loads successfully.

### Checked-in Java compiler archives

`tools.jar` is stored twice under `public/`, creating deployment size, provenance, licensing, and
duplication questions. The harness probes both URLs but selects the first available one.

### In-memory source files

Java files, dirty flags, selected file, and builder data disappear on refresh. The editor does not
read a local directory or save to Code-A-Robot.

### Simplified device semantics

The Java `HardwareMap` constructs motor or servo wrappers for any string, but the TypeScript bridge
silently ignores names absent from its fixed device maps. Target-position behavior is arm-specific,
two gamepad IDs share one UI state, and many FTC behaviors are absent.

### Simplified time and physics

The animation frame owns simulation stepping. Background-tab throttling and device performance can
affect execution cadence. Pose and mechanisms use hand-written interpolation/kinematics without
mass, force, wheel slip, collisions, contact, battery behavior, or sensor noise.

### Large client modules

Several files combine view markup, Three.js setup, state coordination, and event protocols. This
accelerates prototyping but raises regression risk and makes isolated tests harder.

### Heuristic source and hardware classification

OpModes are detected with string/regex checks, and builder preview roles are inferred from names and
tags. Both approaches can misclassify valid input. Explicit parsed metadata should replace them in
stable contracts.

## Security and trust boundary notes

The Java iframe verifies the sending window on the React side, but messaging uses wildcard target
origins and the iframe is created from HTML source. The application must still define and test its
iframe sandbox, origin, CSP, runtime limits, cancellation, and message-rate strategy before running
untrusted classroom code at scale.

Imported builder JSON is structurally normalized, but no maximum part/mount count or string size is
enforced. Treat resource constraints as part of input validation, not only correctness validation.

## Decisions still needed

- Formal linear units, coordinate conventions, and joint semantics shared by builder and runtime.
- Schema compatibility and migration policy.
- Hardware-binding and missing-device error behavior.
- Physics fidelity tiers and deterministic stepping model.
- Java runtime hosting, version pinning, licensing, and offline behavior.
- Code-A-Robot integration, authentication, storage, and permissions.
- Supported browsers/devices and accessibility baseline.
- Public stability status of the global bridge and DOM events.

## Related notes

- [[02 - System Architecture]]
- [[06 - RobotDefinition Schema]]
- [[08 - Roadmap]]
