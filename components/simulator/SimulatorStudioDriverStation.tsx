"use client";

import DriverStationSurface, {
  type DriverStationRunState,
} from "@/components/simulator/DriverStationSurface";

export type StudioOpModeType = "teleop" | "autonomous";
export interface StudioOpModeOption {
  id: string;
  fileName: string;
  type: StudioOpModeType;
}

interface SimulatorStudioDriverStationProps {
  status: "loading" | "ready" | "running" | "error";
  awaitingStart: boolean;
  isCompiling?: boolean;
  opModes: StudioOpModeOption[];
  selectedOpModeId: string | null;
  onSelectOpModeId: (opModeId: string) => void;
  onInitialize: () => void;
  onStart: () => void;
  onStop: () => void;
}


export default function SimulatorStudioDriverStation({
  status,
  awaitingStart,
  isCompiling = false,
  opModes,
  selectedOpModeId,
  onSelectOpModeId,
  onInitialize,
  onStart,
  onStop,
}: SimulatorStudioDriverStationProps) {
  const driverStationState: DriverStationRunState =
    status === "running" ? "running" : awaitingStart ? "initialized" : "stopped";
  const selectedOpMode =
    opModes.find((file) => file.id === selectedOpModeId) ?? opModes[0] ?? null;

  const statusText =
      driverStationState === "running"
        ? `Status : ${selectedOpMode?.fileName ?? "Robot"} is running`
      : driverStationState === "initialized"
        ? `Status : ${selectedOpMode?.fileName ?? "Robot"} is initialized`
        : "Status : Robot is stopped";

  return (
    <DriverStationSurface
      opModes={opModes.map((opMode) => ({
        id: opMode.id,
        label: opMode.fileName,
        type: opMode.type,
      }))}
      selectedOpModeId={selectedOpModeId}
      driverStationState={driverStationState}
      statusText={statusText}
      centerButtonLabel={driverStationState === "running" ? "STOP" : "INIT"}
      centerButtonDisabled={!selectedOpMode || status === "loading" || isCompiling}
      onCenterButton={() => {
        if (!selectedOpMode) {
          return;
        }

        if (driverStationState === "running") {
          onStop();
          return;
        }

        if (driverStationState === "initialized") {
          onStart();
          return;
        }

        onInitialize();
      }}
      onSelectOpModeId={(opModeId) => onSelectOpModeId(opModeId)}
      onSelectionCommitted={onStop}
      responsiveScale
      responsiveScaleAdjustment={0.88}
      showOuterFrame={false}
    />
  );
}
