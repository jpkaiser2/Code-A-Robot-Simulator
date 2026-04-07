import { useMemo, useState } from "react";

import {
  createDefaultRobotDefinition,
  createMountPoint,
  createRobotPart,
  normalizeRobotDefinition,
  normalizeVec3Axis,
  type BuilderEditorState,
  type JointDefinition,
  type MountPoint,
  type PrimitiveKind,
  type RobotDefinition,
  type RobotPart,
  type TransformMode,
} from "@/lib/simulator/builder/robotSchema";

function withRootPartIds(parts: RobotPart[]): string[] {
  const ids = new Set(parts.map((part) => part.id));
  return parts
    .filter((part) => part.parentId === null || !ids.has(part.parentId))
    .map((part) => part.id);
}

function updateRobotParts(robot: RobotDefinition, parts: RobotPart[]): RobotDefinition {
  return {
    ...robot,
    rootPartIds: withRootPartIds(parts),
    parts,
  };
}

function getDescendantPartIds(parts: RobotPart[], partId: string) {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    parts
      .filter((part) => part.parentId === parentId)
      .forEach((part) => {
        descendants.add(part.id);
        visit(part.id);
      });
  };

  visit(partId);
  return descendants;
}

function canReparent(parts: RobotPart[], partId: string, parentId: string | null) {
  if (!parentId) {
    return true;
  }
  if (partId === parentId) {
    return false;
  }
  return !getDescendantPartIds(parts, partId).has(parentId);
}

function normalizeJointForStore(joint: JointDefinition): JointDefinition {
  if (joint.type === "fixed") {
    return { type: "fixed" };
  }

  const limits = joint.limits ?? (joint.type === "revolute" ? { min: -90, max: 90 } : { min: 0, max: 1 });
  const normalizedLimits = {
    min: Math.min(limits.min, limits.max),
    max: Math.max(limits.min, limits.max),
  };
  const initialValue = Math.min(
    normalizedLimits.max,
    Math.max(normalizedLimits.min, joint.initialValue ?? 0)
  );

  if (joint.type === "revolute") {
    return {
      type: "revolute",
      pivot: joint.pivot ?? [0, 0, 0],
      axis: normalizeVec3Axis(joint.axis, [0, 0, 1]),
      limits: normalizedLimits,
      initialValue,
    };
  }

  return {
    type: "prismatic",
    axis: normalizeVec3Axis(joint.axis, [1, 0, 0]),
    limits: normalizedLimits,
    initialValue,
  };
}

function getInitialPreviewValues(robot: RobotDefinition) {
  return Object.fromEntries(
    robot.parts
      .filter((part) => part.joint.type !== "fixed")
      .map((part) => [part.id, part.joint.initialValue ?? 0])
  );
}

export function useRobotBuilderEditor(initialRobot = createDefaultRobotDefinition()) {
  const [state, setState] = useState<BuilderEditorState>({
    robot: initialRobot,
    selectedPartId: initialRobot.parts[0]?.id ?? null,
    transformMode: "translate",
    jointPreviewValues: getInitialPreviewValues(initialRobot),
  });

  const actions = useMemo(
    () => ({
      setRobot(robot: RobotDefinition) {
        const normalizedRobot = normalizeRobotDefinition(robot);
        setState({
          robot: normalizedRobot,
          selectedPartId: normalizedRobot.parts[0]?.id ?? null,
          transformMode: "translate",
          jointPreviewValues: getInitialPreviewValues(normalizedRobot),
        });
      },
      setRobotName(name: string) {
        setState((previous) => ({
          ...previous,
          robot: {
            ...previous.robot,
            name,
          },
        }));
      },
      setTransformMode(transformMode: TransformMode) {
        setState((previous) => ({ ...previous, transformMode }));
      },
      selectPart(partId: string | null) {
        setState((previous) => ({ ...previous, selectedPartId: partId }));
      },
      addPart(kind: PrimitiveKind) {
        setState((previous) => {
          const part = createRobotPart(kind, previous.robot.parts);
          return {
            ...previous,
            selectedPartId: part.id,
            jointPreviewValues: { ...previous.jointPreviewValues },
            robot: updateRobotParts(previous.robot, [...previous.robot.parts, part]),
          };
        });
      },
      updatePart(partId: string, updater: (part: RobotPart) => RobotPart) {
        setState((previous) => ({
          ...previous,
          robot: updateRobotParts(
            previous.robot,
            previous.robot.parts.map((part) => (part.id === partId ? updater(part) : part))
          ),
        }));
      },
      updatePartId(partId: string, nextPartId: string) {
        const normalizedId = nextPartId.trim();
        if (!normalizedId) {
          return;
        }

        setState((previous) => {
          const idExists = previous.robot.parts.some(
            (part) => part.id === normalizedId && part.id !== partId
          );
          if (idExists) {
            return previous;
          }

          const parts = previous.robot.parts.map((part) => {
            if (part.id === partId) {
              return { ...part, id: normalizedId };
            }
            if (part.parentId === partId) {
              return { ...part, parentId: normalizedId };
            }
            return part;
          });

          const { [partId]: previousPreviewValue, ...otherPreviewValues } =
            previous.jointPreviewValues;

          return {
            ...previous,
            selectedPartId: previous.selectedPartId === partId ? normalizedId : previous.selectedPartId,
            jointPreviewValues: {
              ...otherPreviewValues,
              [normalizedId]: previousPreviewValue ?? 0,
            },
            robot: updateRobotParts(previous.robot, parts),
          };
        });
      },
      reparentPart(partId: string, parentId: string | null) {
        setState((previous) => {
          if (!canReparent(previous.robot.parts, partId, parentId)) {
            return previous;
          }

          return {
            ...previous,
            robot: updateRobotParts(
              previous.robot,
              previous.robot.parts.map((part) =>
                part.id === partId ? { ...part, parentId } : part
              )
            ),
          };
        });
      },
      attachPartToMount(partId: string, parentId: string, mountPointId: string) {
        setState((previous) => {
          if (!canReparent(previous.robot.parts, partId, parentId)) {
            return previous;
          }

          const parentPart = previous.robot.parts.find((part) => part.id === parentId);
          const mountPoint = parentPart?.mountPoints.find((point) => point.id === mountPointId);
          if (!mountPoint) {
            return previous;
          }

          return {
            ...previous,
            robot: updateRobotParts(
              previous.robot,
              previous.robot.parts.map((part) =>
                part.id === partId
                  ? {
                      ...part,
                      parentId,
                      position: mountPoint.position,
                      rotation: mountPoint.rotation,
                    }
                  : part
              )
            ),
          };
        });
      },
      addMountPoint(partId: string) {
        setState((previous) => ({
          ...previous,
          robot: updateRobotParts(
            previous.robot,
            previous.robot.parts.map((part) =>
              part.id === partId
                ? {
                    ...part,
                    mountPoints: [...part.mountPoints, createMountPoint(part.mountPoints)],
                  }
                : part
            )
          ),
        }));
      },
      updateMountPoint(
        partId: string,
        mountPointId: string,
        updater: (mountPoint: MountPoint) => MountPoint
      ) {
        setState((previous) => ({
          ...previous,
          robot: updateRobotParts(
            previous.robot,
            previous.robot.parts.map((part) =>
              part.id === partId
                ? {
                    ...part,
                    mountPoints: part.mountPoints.map((mountPoint) =>
                      mountPoint.id === mountPointId ? updater(mountPoint) : mountPoint
                    ),
                  }
                : part
            )
          ),
        }));
      },
      removeMountPoint(partId: string, mountPointId: string) {
        setState((previous) => ({
          ...previous,
          robot: updateRobotParts(
            previous.robot,
            previous.robot.parts.map((part) =>
              part.id === partId
                ? {
                    ...part,
                    mountPoints: part.mountPoints.filter((mountPoint) => mountPoint.id !== mountPointId),
                  }
                : part
            )
          ),
        }));
      },
      updateJoint(partId: string, updater: (joint: JointDefinition) => JointDefinition) {
        setState((previous) => {
          let previewValue = previous.jointPreviewValues[partId];
          const parts = previous.robot.parts.map((part) => {
            if (part.id !== partId) {
              return part;
            }

            const joint = normalizeJointForStore(updater(part.joint));
            previewValue = joint.initialValue ?? 0;
            return { ...part, joint };
          });

          return {
            ...previous,
            jointPreviewValues: {
              ...previous.jointPreviewValues,
              [partId]: previewValue ?? 0,
            },
            robot: updateRobotParts(previous.robot, parts),
          };
        });
      },
      setJointPreviewValue(partId: string, value: number) {
        setState((previous) => {
          const part = previous.robot.parts.find((entry) => entry.id === partId);
          if (!part || part.joint.type === "fixed") {
            return previous;
          }

          const limits = part.joint.limits ?? { min: 0, max: 0 };
          return {
            ...previous,
            jointPreviewValues: {
              ...previous.jointPreviewValues,
              [partId]: Math.min(limits.max, Math.max(limits.min, value)),
            },
          };
        });
      },
      resetJointPreview(partId: string) {
        setState((previous) => {
          const part = previous.robot.parts.find((entry) => entry.id === partId);
          return {
            ...previous,
            jointPreviewValues: {
              ...previous.jointPreviewValues,
              [partId]: part?.joint.initialValue ?? 0,
            },
          };
        });
      },
      removePart(partId: string) {
        setState((previous) => {
          const parts = previous.robot.parts
            .filter((part) => part.id !== partId)
            .map((part) => (part.parentId === partId ? { ...part, parentId: null } : part));
          const { [partId]: _removedPreviewValue, ...jointPreviewValues } =
            previous.jointPreviewValues;
          return {
            ...previous,
            selectedPartId:
              previous.selectedPartId === partId ? parts[0]?.id ?? null : previous.selectedPartId,
            jointPreviewValues,
            robot: updateRobotParts(previous.robot, parts),
          };
        });
      },
    }),
    []
  );

  return { state, actions };
}
