---
title: Developer Guide
aliases:
  - Development
tags:
  - code-a-robot
  - development
status: living-document
last-reviewed: 2026-09-05
---

# Developer guide

## Prerequisites

- A supported Node.js/npm environment for Next.js 15
- A modern browser with WebGL and the features required by CheerpJ
- Network access when testing Java execution, because the CheerpJ loader is remote

No environment variables are currently required.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```

The repository currently defines no lint, format, unit-test, or end-to-end-test scripts.

## Local routes

| URL | Purpose |
|---|---|
| `http://localhost:3000/` | Workspace landing page |
| `http://localhost:3000/simulator-builder` | Robot definition builder |
| `http://localhost:3000/simulator-test` | Integrated Java simulator |
| `http://localhost:3000/driver-station-test` | Isolated driver station sandbox |

## Repository map

```text
app/
  layout.tsx                         global shell and navigation
  page.tsx                           landing page
  simulator-builder/page.tsx        builder route
  simulator-test/page.tsx           integrated simulator route
  driver-station-test/page.tsx      driver-station sandbox route
components/
  simulator-builder/                builder UI and Three.js viewport
  simulator/                        Java harness, runtime scene, DS, gamepad
  ui/                               local UI primitives
lib/
  simulator/mechanismSimulator.ts   simulator state, reducer, step, bridge
  simulator/builder/                schema, editor state, preview, old library scaffold
public/
  Models/GamepadAssembly.glb         interactive gamepad asset
  tools.jar                         Java compiler runtime candidate
  app/tools.jar                     alternate Java compiler runtime candidate
documentation/                      this Obsidian-compatible documentation set
```

## Technology stack

| Technology | Role |
|---|---|
| Next.js 15 / React 18 / TypeScript | Application, routes, stateful UI |
| Tailwind CSS 3 | Styling |
| Three.js | Builder viewport, runtime scene, gamepad rendering |
| Ace / React Ace | Java source editor |
| CheerpJ 4.2 | Java 8 compilation and execution in the browser |
| Radix Slot + CVA | Reusable UI component composition |

`@dnd-kit` is installed but not referenced by the current source tree.

## Development boundaries

### Builder changes

Keep persistent robot data in `RobotDefinition`, transient selection/preview data in
`BuilderEditorState`, and rendering details inside `RobotBuilderViewport`. Any imported value must
pass through schema normalization. Update [[06 - RobotDefinition Schema]] when the contract changes.

### Runtime changes

Keep world/device state in `mechanismSimulator.ts`; use bridge methods as the external imperative
API. Rendering should consume state rather than become the source of truth. If adding an FTC Java
method, follow the end-to-end checklist in [[05 - Java Harness and FTC API]].

### Driver-station changes

Make reusable presentation changes in `DriverStationSurface`. Keep simulator-specific status
translation in `SimulatorStudioDriverStation`, and use `/driver-station-test` for isolated UI work.

## Verification checklist

Until automated coverage exists, changes should be checked proportionally:

- Run `npm run build` for TypeScript and production-build validation.
- Open all three interactive routes and check browser console errors.
- Builder: add/reparent/transform a part, configure each joint type, preview, export, and re-import.
- Java: compile both templates, exercise INIT/START/STOP, motors, servo, telemetry, and gamepad.
- Resize horizontal/vertical panes and browser width.
- Confirm the gamepad model and CheerpJ loader are reachable in the intended deployment.

## Documentation convention

Each note uses YAML frontmatter and Obsidian wikilinks. When changing behavior:

1. update the closest feature note;
2. update architecture or constraints if a boundary changed;
3. update the schema note for serialized-data changes;
4. move roadmap items to an implemented section rather than silently deleting their history;
5. refresh the `last-reviewed` date on materially reviewed notes.

## Known maintenance hotspots

Several client files are large because proof-of-concept rendering, state wiring, and presentation
are colocated. Before broad feature expansion, consider extracting focused hooks/modules from
`SimulatorJavaHarness`, `SimulatorTestClient`, `SimulatorBuilderClient`, `RobotBuilderViewport`,
`F310Gamepad`, and `DriverStationSurface` while preserving current boundaries.

## Related notes

- [[02 - System Architecture]]
- [[09 - Current Constraints and Decisions]]
