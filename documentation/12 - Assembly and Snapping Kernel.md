---
title: Assembly and Snapping Kernel
aliases:
  - Connector Snapping
  - Rigid Assembly Commands
tags:
  - code-a-robot
  - builder
  - assembly
  - architecture
status: implemented
last-reviewed: 2026-09-05
---

# Assembly and snapping kernel

`lib/robot/assembly` is the UI-independent edit layer for v3 robot assemblies. React panels issue
commands to this layer; they must not calculate connection transforms or mutate the document
directly. The same validation can be applied to imported documents before the simulator compiles
them.

## Coordinate convention

Every part instance has a world transform. Every catalog connector has a transform in its part's
local coordinates. Connector frames are authored so matching frames should coincide; any physical
face reversal belongs in the connector's authored quaternion rather than an implicit UI rule.

For stationary instance `A` and moving instance `B`, snapping calculates:

```text
worldConnectorA = worldA × localConnectorA
desiredConnectorB = worldConnectorA × authoredOffset
worldB = desiredConnectorB × inverse(localConnectorB)
```

`translationOffsetM` is expressed in the stationary connector frame. `rotationOffsetRad` rotates
around connector-local positive Z. When connectors declare `rotationSteps`, the requested angle is
quantized. If both sides declare steps, their shared orientations use the greatest common divisor;
four-step and six-step connectors therefore share two valid orientations.

## Rigid groups

Structural connections form an undirected graph. All instances reachable through those connections
are a rigid component and move together. A connect operation keeps endpoint A stationary and applies
one delta transform to the entire component containing endpoint B, preserving every internal pose.

Mechanical joints are not graph edges for this purpose. They remain boundaries between rigid bodies
so moving or snapping one side cannot accidentally collapse a mechanism into one assembly.

The current model rejects structural cycles and permits one structural connection per connector.
Catalog authors should represent a multi-hole mounting pattern as one pattern connector when it is
intended to be one logical attachment.

## Commands and history

Implemented operations are:

- connect two compatible connector endpoints;
- disconnect a structural connection without moving either resulting component;
- move a complete rigid component using one anchor instance;
- undo and redo any of those commands.

Operations return new document objects and reuse unchanged arrays and instances. History entries
hold before/after document roots, so undo is constant-time and unchanged data is structurally shared.
The default history capacity is 100 successful edits. A failed command adds no history entry, and a
new successful command clears the redo branch.

## Import validation

`validateAssemblyAgainstCatalog` adds checks that the structural schema cannot perform alone:

- document/catalog version agreement;
- known part and connector IDs;
- bidirectional connector compatibility;
- connector occupancy and rigid cycles;
- allowed discrete rotation offsets;
- actual world-frame alignment after offsets.

Import should first run the structural v3 validator and then this catalog-aware validator. Neither
validator silently repairs a document; editor commands perform deliberate snapping before export.

## Test coverage

The automated suite verifies transform inversion, rotated connector alignment, offset
quantization, whole-group motion, joint boundaries, relative-pose preservation, incompatibility,
occupancy, cycles, tampered imports, and deterministic connect/disconnect/move undo-redo sequences.

## Next integration

The next domain layer is a deterministic joint/transmission evaluator shared by builder preview and
simulator compilation. After that evaluator is tested, the new catalog and assembly commands can be
wired into a minimal v3 builder route without embedding domain logic in React.
