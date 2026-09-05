---
title: Project Overview
aliases:
  - Product Overview
tags:
  - code-a-robot
  - architecture
  - product
status: living-document
last-reviewed: 2026-09-05
---

# Project overview

## Purpose

Code-A-Robot Simulator is a standalone Next.js prototype intended to become an extension of
codearobot.org. It explores an end-to-end FTC learning workflow in the browser:

1. A teacher or content author describes a lesson robot as structured data.
2. A student writes FTC-style Java in a multi-file editor.
3. The browser compiles and executes the Java against a small mock of the FTC SDK.
4. Native calls update a deterministic simulator state.
5. Three.js renders the robot while a driver-station surface exposes controls and telemetry.

The current repository validates these ideas locally. It is not yet integrated with the main
Code-A-Robot application, user accounts, lessons, or persistent storage.

## Intended audiences

| Audience | Intended use |
|---|---|
| Students | Write and run approachable FTC Java without a physical robot |
| Teachers | Assemble lesson-specific robots and prepare reusable configurations |
| Curriculum authors | Pair starter code, simulated hardware, and expected behaviors |
| Developers | Extend the mock FTC API, simulator model, editor, and Code-A-Robot integration |

## Implemented product surfaces

### Home (`/`)

The landing page links to the three workspaces and frames the product around building robots,
testing code, and shipping lessons.

### Robot builder (`/simulator-builder`)

The builder edits a versioned `RobotDefinition` made from box, cylinder, sphere, and capsule
primitives. It supports part hierarchy, local transforms, mount points, fixed/revolute/prismatic
joints, JSON import/export, manual joint poses, and animated movement previews with basic rig
warnings. See [[03 - Robot Builder]] and [[06 - RobotDefinition Schema]].

### Simulator (`/simulator-test`)

The simulator combines:

- an Ace-based, in-memory multi-file Java editor;
- a CheerpJ iframe that compiles Java 8 source in the browser;
- small Java stand-ins for common FTC SDK classes;
- a TypeScript state store and Java-to-JavaScript bridge;
- a fixed Three.js field robot with drivetrain, arm, and claw;
- an interactive Logitech F310-style gamepad model;
- an FTC-inspired driver station and telemetry display.

See [[04 - Simulator Runtime]] and [[05 - Java Harness and FTC API]].

### Driver station sandbox (`/driver-station-test`)

This page isolates the driver-station presentation for visual and interaction development. It uses
mock OpMode options and a local stopped/initialized/running state. The integrated simulator uses a
thin adapter, `SimulatorStudioDriverStation`, to feed live Java harness state into the same
`DriverStationSurface`.

## What the project does not yet do

> [!warning] Prototype boundary
> The visual builder and runtime simulator are currently separate systems. Exporting a robot from
> the builder does not change the robot, devices, or physics on the simulator page.

The current code also does not provide:

- authentication, cloud persistence, lesson publishing, or collaboration;
- a backend or database;
- real rigid-body physics, collision detection, field objects, or sensors;
- a complete FTC SDK implementation;
- robot configuration derived from `RobotDefinition`;
- file upload/download or autosave for builder JSON and Java files;
- production sandboxing guarantees for user-supplied code;
- automated tests or CI configuration in this repository.

## Product principles suggested by the implementation

- **Browser first.** Editing, compilation, execution, rendering, and controls happen client-side.
- **Structured robot data.** `RobotDefinition` is intended to be the portable builder contract.
- **FTC familiarity.** Java types, lifecycle controls, hardware names, gamepad fields, and the
  driver-station presentation resemble the FTC workflow.
- **Lesson-sized simulation.** The runtime models the concepts needed by a focused activity rather
  than attempting full mechanical fidelity today.
- **Safe evolution through versioning.** Imported robot data is normalized into schema version 2,
  leaving explicit extension points for hardware, sensors, assets, and lesson metadata.

## Related notes

- [[02 - System Architecture]]
- [[08 - Roadmap]]
- [[09 - Current Constraints and Decisions]]
- [[Glossary]]
