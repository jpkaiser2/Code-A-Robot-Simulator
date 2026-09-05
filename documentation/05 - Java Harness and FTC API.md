---
title: Java Harness and FTC API
aliases:
  - Java Runtime
  - Mock FTC SDK
tags:
  - code-a-robot
  - java
  - ftc
  - runtime
status: prototype
last-reviewed: 2026-09-05
---

# Java harness and FTC API

`SimulatorJavaHarness` provides an in-browser Java editing and execution prototype. It is designed
for FTC-shaped lesson code, not binary compatibility with the complete FTC SDK.

## Execution pipeline

1. The student edits one or more in-memory `.java` files in Ace.
2. Source scanning detects classes annotated with `@TeleOp`/`@Autonomous`, or classes extending
   `OpMode`/`LinearOpMode`.
3. INIT resets the simulator and sends the user files, generated support files, launcher, and chosen
   fully qualified class name to a hidden iframe.
4. The iframe writes source to CheerpJ's `/str/` filesystem.
5. Java 8 `com.sun.tools.javac.Main` compiles source into `/files/` using `tools.jar`.
6. `simulator.launcher.Main` reflectively constructs the selected OpMode.
7. Java native declarations in `SimulatorNative` become CheerpJ JavaScript functions.
8. Those functions exchange commands and request/response messages with React through
   `postMessage`.
9. React invokes `SimulatorBridge`, which updates the TypeScript store and rendered robot.

```mermaid
flowchart LR
    Source[User Java files] --> Support[Generated mock FTC sources]
    Support --> Javac[javac in CheerpJ]
    Javac --> Classes[/files compiled classes]
    Classes --> Launcher[simulator.launcher.Main]
    Launcher --> OpMode[Selected user OpMode]
    OpMode --> Native[SimulatorNative]
    Native --> Messages[iframe postMessage]
    Messages --> Bridge[TypeScript SimulatorBridge]
```

## Supported Java surface

| Package/class | Implemented members |
|---|---|
| `DcMotor` | `setPower`, `getCurrentPosition`, `setTargetPosition`, `setMode`, `getMode`, `isBusy`; three run modes |
| `Servo` | `setPosition` |
| `HardwareMap` | `get(DcMotor.class, name)` and `get(Servo.class, name)` |
| `Gamepad` | Common buttons, D-pad, bumpers, stick buttons, sticks, and triggers as public fields |
| `Telemetry` | `addData(caption, value)` |
| `ElapsedTime` | constructor, `reset`, `seconds` |
| `OpMode` | `hardwareMap`, `telemetry`, `gamepad1`, `gamepad2`, and lifecycle methods |
| `LinearOpMode` | `runOpMode`, `sleep`, `waitForStart`, `opModeIsActive` |
| Annotations | Runtime-retained `@TeleOp` and `@Autonomous` with optional name |

`DcMotor` direction, zero-power behavior, velocity control, additional sensors, IMU, color/distance
sensors, CR servos, and most other FTC SDK classes are not implemented.

## OpMode lifecycle

For `LinearOpMode`, the launcher invokes `runOpMode`. `waitForStart` blocks on a JavaScript promise,
then synchronizes gamepad data. Each `opModeIsActive` call refreshes both gamepads and checks a
shared active flag.

For iterative `OpMode`, the launcher calls `init`, waits for START, calls `start`, and then runs
`loop` roughly every 50 ms while active before calling `stop`.

INIT and START are separate driver-station actions. A start signal sent before Java reaches
`waitForStart` is remembered and consumed when the wait begins. STOP clears the active flag.

## Editor behavior

The editor begins with an autonomous mechanism example. Controls can add the TeleOp or Autonomous
templates without replacing files of the same name, add helper Java files, rename files/classes,
select detected OpModes, clear logs, and refresh the iframe runtime. All files and dirty-state
markers live only in React memory.

OpMode discovery is regex/string based, not a Java parser. It expects a `public class`, optionally
reads a `package`, and classifies source by annotations or `extends` text. Complex formatting,
comments containing these strings, nested classes, or unconventional declarations can be
misidentified.

## iframe message boundary

The harness accepts messages only when `event.source` is its own iframe. It currently uses `"*"`
as the target origin because the iframe content is supplied by `srcDoc`. Message families include:

- runtime lifecycle: ready, compile/run log, waiting, started, complete, error;
- motor commands and encoder/busy request-response pairs;
- servo position commands;
- gamepad boolean/float request-response pairs;
- telemetry updates;
- start and stop control messages.

## Runtime requirements

- Client-side JavaScript and WebAssembly-compatible browser features required by CheerpJ.
- Network access to the pinned CheerpJ 4.2 loader CDN.
- A reachable Java 8 `tools.jar` at `/app/tools.jar` or `/tools.jar`.
- Permission for the iframe/runtime behavior under the deployment's Content Security Policy.

> [!warning] Production hardening
> Treat the current Java execution layer as a prototype. Before serving untrusted classroom code,
> define execution quotas, cancellation guarantees, origin/CSP restrictions, resource limits,
> dependency availability, error reporting, and privacy expectations.

## Extension guidance

When adding an FTC API method, update the complete call chain:

1. generated Java class or `SimulatorNative` declaration;
2. CheerpJ native JavaScript implementation;
3. iframe message handling in React, including a response path for getters;
4. `SimulatorBridge` interface/implementation;
5. simulator action/state/step logic;
6. runtime rendering or telemetry, where relevant;
7. documentation and tests.

Avoid placing simulation logic in the iframe. The Java layer should express student-facing API
semantics, while the TypeScript simulator remains the authoritative world state.

## Related notes

- [[04 - Simulator Runtime]]
- [[08 - Roadmap]]
- [[09 - Current Constraints and Decisions]]
