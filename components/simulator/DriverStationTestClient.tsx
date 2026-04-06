"use client";

import Link from "next/link";
import { useState } from "react";

import DriverStationSurface, {
  type DriverStationModeType,
  type DriverStationRunState,
} from "@/components/simulator/DriverStationSurface";

interface OpModeFile {
  id: string;
  name: string;
  type: DriverStationModeType;
}

const OP_MODE_FILES: OpModeFile[] = [
  { id: "auto-sample", name: "BlueBackdropAuto", type: "autonomous" },
  { id: "auto-parking", name: "ParkingOnlyAuto", type: "autonomous" },
  { id: "tele-sample", name: "SampleBot", type: "teleop" },
  { id: "tele-drive", name: "FieldCentricTeleOp", type: "teleop" },
];

export default function DriverStationTestClient() {
  const [selectedOpModes, setSelectedOpModes] = useState<Record<DriverStationModeType, string>>({
    autonomous: "auto-sample",
    teleop: "tele-sample",
  });
  const [selectedOpModeId, setSelectedOpModeId] = useState("tele-sample");
  const [driverStationState, setDriverStationState] = useState<DriverStationRunState>("stopped");

  const selectedOpMode =
    OP_MODE_FILES.find((file) => file.id === selectedOpModeId) ??
    OP_MODE_FILES[0];

  const statusText =
    driverStationState === "running"
      ? `Status : ${selectedOpMode?.name ?? "Robot"} is running`
      : driverStationState === "initialized"
        ? `Status : ${selectedOpMode?.name ?? "Robot"} is initialized`
        : "Status : Robot is stopped";

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">
              FTC Driver Station Test UI
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
              REV Driver Station Sandbox
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-[#050505] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-[#090909]"
          >
            Back home
          </Link>
        </div>

        <div className="grid gap-6">
          <DriverStationSurface
            opModes={OP_MODE_FILES.map((file) => ({
              id: file.id,
              label: file.name,
              type: file.type,
            }))}
            selectedOpModeId={selectedOpModeId}
            driverStationState={driverStationState}
            statusText={statusText}
            centerButtonLabel={driverStationState === "running" ? "STOP" : "INIT"}
            centerButtonDisabled={!selectedOpMode}
            onCenterButton={() => {
              if (!selectedOpMode) {
                return;
              }

              if (driverStationState === "running") {
                setDriverStationState("stopped");
                return;
              }

              if (driverStationState === "initialized") {
                setDriverStationState("running");
                return;
              }

              setDriverStationState("initialized");
            }}
            onSelectOpModeId={(opModeId, type) => {
              setSelectedOpModes((current) => ({
                ...current,
                [type]: opModeId,
              }));
              setSelectedOpModeId(opModeId);
            }}
            onSelectionCommitted={() => setDriverStationState("stopped")}
          />
        </div>
      </div>
    </main>
  );
}
