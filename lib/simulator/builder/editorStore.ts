import { useMemo, useState } from "react";

import {
  createDefaultRobotDefinition,
  createRobotPart,
  normalizeRobotDefinition,
  type BuilderEditorState,
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

export function useRobotBuilderEditor(initialRobot = createDefaultRobotDefinition()) {
  const [state, setState] = useState<BuilderEditorState>({
    robot: initialRobot,
    selectedPartId: initialRobot.parts[0]?.id ?? null,
    transformMode: "translate",
  });

  const actions = useMemo(
    () => ({
      setRobot(robot: RobotDefinition) {
        const normalizedRobot = normalizeRobotDefinition(robot);
        setState({
          robot: normalizedRobot,
          selectedPartId: normalizedRobot.parts[0]?.id ?? null,
          transformMode: "translate",
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

          return {
            ...previous,
            selectedPartId: previous.selectedPartId === partId ? normalizedId : previous.selectedPartId,
            robot: updateRobotParts(previous.robot, parts),
          };
        });
      },
      removePart(partId: string) {
        setState((previous) => {
          const parts = previous.robot.parts
            .filter((part) => part.id !== partId)
            .map((part) => (part.parentId === partId ? { ...part, parentId: null } : part));
          return {
            ...previous,
            selectedPartId:
              previous.selectedPartId === partId ? parts[0]?.id ?? null : previous.selectedPartId,
            robot: updateRobotParts(previous.robot, parts),
          };
        });
      },
    }),
    []
  );

  return { state, actions };
}
