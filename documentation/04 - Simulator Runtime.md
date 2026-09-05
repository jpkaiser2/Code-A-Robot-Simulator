---
title: Simulator Runtime
tags:
  - code-a-robot
  - simulator
  - runtime
  - threejs
status: living-document
last-reviewed: 2026-09-05
---

# Simulator runtime

The integrated simulator at `/simulator-test` is a resizable three-pane workspace containing the
Java editor/console, an FTC-style driver station and gamepad, and a live Three.js scene.

## Composition

`SimulatorTestClient` creates the store and bridge, owns the gamepad state, constructs the runtime
scene, and connects the Java harness to the driver-station controls. The component is also the
browser integration boundary: while mounted it exposes the bridge as `window.codeARobotSimulator`.

## Simulator state

`SimulatorState` currently models:

- planar robot pose (`robotX`, `robotY`, heading) and rectangular field limits;
- drivetrain track width, maximum speed, and maximum turn rate;
- arm angle/target/range/speed and encoder ticks;
- claw current/target/range/speed;
- idle/running status, elapsed time, demo phase, and loop count;
- named motor and servo records;
- summary telemetry, runtime telemetry, and bounded logs.

The default hardware map is fixed:

| Device name | Type | Runtime role |
|---|---|---|
| `leftFront` | motor | Left drivetrain power |
| `rightFront` | motor | Right drivetrain power |
| `armMotor` | motor | Arm motion and encoder |
| `clawServo` | servo | Claw opening amount |

Unknown device names can be constructed by the Java mock `HardwareMap`, but bridge calls only take
effect when the named device exists in the TypeScript store.

## Store and update loop

`createSimulatorStore` returns `dispatch`, `getState`, `reset`, `step`, and `subscribe`. Discrete
commands go through a reducer; continuous motion happens in `step(deltaSeconds)`.

The Three.js animation loop clamps each frame delta to 50 ms, steps the store, applies the latest
state to scene objects, updates orbit controls, and renders. The main behaviors are intentionally
simple:

- differential drive is calculated from left/right motor power;
- pose is clamped inside a square field;
- the arm moves toward a target at a limited rate;
- `RUN_TO_POSITION` converts encoder target ticks to arm degrees using 11.08 ticks/degree;
- `RUN_WITHOUT_ENCODER` treats motor power as incremental arm control;
- the claw interpolates toward the commanded servo position;
- motor encoder counts advance from commanded power;
- no collision or rigid-body solver is involved.

## Bridge API

`createSimulatorBridge` is the imperative boundary used by Java and optional browser consumers.

| Method | Effect |
|---|---|
| `run`, `reset` | Start the built-in demo state or restore defaults |
| `armUp`, `armDown` | Adjust the arm target by 12 degrees |
| `openClaw`, `closeClaw` | Set claw target to its configured extremes |
| `setMotorPower` | Clamp and set a known motor to `[-1, 1]` |
| `getMotorCurrentPosition` | Return rounded encoder ticks |
| `setMotorTargetPosition` | Set a known motor target (currently updates the arm target path) |
| `setMotorMode`, `getMotorMode` | Update/read supported encoder mode |
| `isMotorBusy` | Compare current and target ticks in `RUN_TO_POSITION` |
| `setServoPosition` | Clamp and set a known servo to `[0, 1]` |
| `addTelemetry` | Upsert current runtime telemetry and append history |
| `dispatchAction`, `getSnapshot` | Lower-level state access |

> [!note] Current coupling
> `setMotorTargetPosition` dispatches the arm-specific target action for any known motor. A more
> general device model should make target positions independent per motor before arbitrary robots
> are loaded.

## Runtime scene

The runtime robot is built directly in `SimulatorTestClient` from Three.js boxes and cylinders. It
has a fixed chassis, four wheels, a shoulder/arm group, wrist, and two claw fingers. Store state
changes only the robot root pose, arm rotation, and finger spread. This scene does not consume a
builder export.

## Gamepad

`F310Gamepad` loads `public/Models/GamepadAssembly.glb`, maps named meshes to FTC-style controls,
and uses raycasting for interaction. Click/drag gestures update:

- A/B/X/Y, bumpers, stick buttons, back/start/guide;
- directional pad buttons;
- left/right stick X and Y axes;
- left/right triggers.

Buttons and triggers release on pointer-up; sticks return to zero. The parent prevents a small set
of contradictory simultaneous inputs, such as A+Y and opposite D-pad directions. The Java harness
answers native gamepad reads from this React state. `gamepad2` exists in the Java mock, but both IDs
currently resolve against the single UI gamepad state.

## Driver station and telemetry

`DriverStationSurface` is reused in two modes:

- live in the simulator through `SimulatorStudioDriverStation`;
- mocked on `/driver-station-test` for isolated visual development.

The live adapter maps Java harness states to stopped/initialized/running and binds INIT, START, STOP,
and OpMode selection callbacks. Telemetry comes from the simulator store; Java `addData` calls
replace the latest value for a caption while retaining a short history.

## Browser events

While the simulator is mounted it publishes:

- `window.codeARobotSimulator`: the current `SimulatorBridge`;
- `codearobot:simulator-ready`: a `CustomEvent` whose detail contains the bridge;
- `codearobot:simulator-state-changed`: emitted on every store update with the current state.

These are useful integration seams, but they are not yet documented as a stable public API and can
fire at animation-frame frequency while motion is active.

## Related notes

- [[05 - Java Harness and FTC API]]
- [[02 - System Architecture]]
- [[09 - Current Constraints and Decisions]]
