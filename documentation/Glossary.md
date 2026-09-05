---
title: Glossary
tags:
  - code-a-robot
  - glossary
status: living-document
last-reviewed: 2026-09-05
---

# Glossary

**BuilderEditorState** — React state containing the active `RobotDefinition`, selection, transform
mode, and temporary joint poses.

**CheerpJ** — The browser Java runtime used by the prototype to run `javac` and execute compiled
Java 8 classes inside an iframe.

**Driver station** — The FTC-inspired interface used to select, initialize, start, and stop an
OpMode and view status/telemetry.

**FTC** — FIRST Tech Challenge, the robotics program whose programming workflow and terminology
inspire this simulator.

**Hardware binding** — A proposed explicit mapping between a named FTC device such as `armMotor`
and a runtime behavior, joint, sensor, or drivetrain role.

**Joint preview** — A temporary, non-destructive pose or animation applied to a builder part's
preview group.

**LinearOpMode** — The sequential FTC programming style represented by one `runOpMode` method and a
`waitForStart` boundary.

**Mount point** — A named local transform on a builder part that can be copied to a child when it is
attached.

**OpMode** — A student program selectable from the driver station. The harness supports a simplified
linear style and iterative `init`/`start`/`loop`/`stop` style.

**RobotDefinition** — The builder's versioned JSON source of truth for primitive parts, hierarchy,
mount points, and joints. See [[06 - RobotDefinition Schema]].

**SimulatorBridge** — The TypeScript imperative API between Java/browser consumers and the
simulator state store.

**SimulatorStore** — The framework-independent state container that reduces commands and advances
continuous simulated motion.

**Telemetry** — Caption/value data emitted by student code or derived from runtime state for
display and logs.

**Three.js** — The WebGL library used to render the builder, the fixed runtime robot, and the 3D
gamepad.
