"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import driverStationBatteryPanel from "@/app/driver-station-test/driver-station-battery-panel.svg";
import driverStationRobotIcon from "@/app/driver-station-test/driver-station-robot-icon.png";
import topBarGraphic from "@/app/driver-station-test/TopBar.svg";

type OpModeType = "autonomous" | "teleop";
type DriverStationState = "stopped" | "initialized" | "running";

interface OpModeFile {
  id: string;
  name: string;
  type: OpModeType;
}

interface HardwareDevice {
  name: string;
  kind: string;
  port: string;
}

const OP_MODE_FILES: OpModeFile[] = [
  { id: "auto-sample", name: "BlueBackdropAuto", type: "autonomous" },
  { id: "auto-parking", name: "ParkingOnlyAuto", type: "autonomous" },
  { id: "tele-sample", name: "SampleBot", type: "teleop" },
  { id: "tele-drive", name: "FieldCentricTeleOp", type: "teleop" },
];

const HARDWARE_CONFIG: HardwareDevice[] = [
  { name: "leftFront", kind: "DcMotorEx", port: "Control Hub M0" },
  { name: "rightFront", kind: "DcMotorEx", port: "Control Hub M1" },
  { name: "leftRear", kind: "DcMotorEx", port: "Control Hub M2" },
  { name: "rightRear", kind: "DcMotorEx", port: "Control Hub M3" },
  { name: "armLift", kind: "DcMotorEx", port: "Expansion Hub M0" },
  { name: "clawServo", kind: "Servo", port: "Control Hub S0" },
  { name: "imu", kind: "BHI260IMU", port: "Control Hub I2C" },
  { name: "webcam", kind: "WebcamName", port: "USB 0" },
];

function SignalIcon() {
  return (
    <div className="flex h-5 items-end gap-[2px]">
      <span className="block h-1.5 w-[2px] bg-white" />
      <span className="block h-2.5 w-[2px] bg-white" />
      <span className="block h-3.5 w-[2px] bg-white" />
      <span className="block h-5 w-[2px] bg-white" />
    </div>
  );
}

function MenuDots() {
  return (
    <div className="flex h-5 w-5 flex-col items-center justify-center gap-[2px]">
      <span className="h-[3px] w-[3px] rounded-full bg-white" />
      <span className="h-[3px] w-[3px] rounded-full bg-white" />
      <span className="h-[3px] w-[3px] rounded-full bg-white" />
    </div>
  );
}

export default function DriverStationTestClient() {
  const [activeType, setActiveType] = useState<OpModeType>("teleop");
  const [selectedOpModes, setSelectedOpModes] = useState<Record<OpModeType, string>>({
    autonomous: "auto-sample",
    teleop: "tele-sample",
  });
  const [driverStationState, setDriverStationState] = useState<DriverStationState>("stopped");
  const [showOpModePicker, setShowOpModePicker] = useState(false);
  const [showHardwareConfig, setShowHardwareConfig] = useState(false);

  const visibleOpModes = useMemo(
    () => OP_MODE_FILES.filter((file) => file.type === activeType),
    [activeType]
  );

  const selectedOpMode =
    OP_MODE_FILES.find((file) => file.id === selectedOpModes[activeType]) ?? visibleOpModes[0];
  const selectedTeleOp =
    OP_MODE_FILES.find((file) => file.id === selectedOpModes.teleop) ??
    OP_MODE_FILES.find((file) => file.type === "teleop");

  const statusText =
    driverStationState === "running"
      ? `Status : ${selectedOpMode?.name ?? "Robot"} is running`
      : driverStationState === "initialized"
        ? `Status : ${selectedOpMode?.name ?? "Robot"} is initialized`
        : "Status : Robot is stopped";

  const centerButtonLabel = driverStationState === "running" ? "STOP" : "INIT";
  const centerButtonDisabled = !selectedOpMode;

  const handleCenterButton = () => {
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
  };

  const handleStart = () => {
    if (driverStationState === "initialized") {
      setDriverStationState("running");
    }
  };

  const handleStop = () => {
    setDriverStationState("stopped");
  };

  const centerButtonContent =
    driverStationState === "running" ? (
      <div className="flex h-[42%] w-[42%] items-center justify-center rounded-[6px] bg-[#7d0007]" />
    ) : driverStationState === "initialized" ? (
      <div
        className="h-0 w-0 border-y-[18px] border-l-[30px] border-y-transparent border-l-white"
        style={{ marginLeft: "6px" }}
      />
    ) : (
      <span>INIT</span>
    );

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
          <section className="rounded-[42px] border border-white/10 bg-black p-4 shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:p-6">
            <div
              className="relative mx-auto w-full max-w-[980px] bg-[#2f2c30] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] sm:p-8"
              style={{
                clipPath:
                  "polygon(3.5% 0, 96.5% 0, 100% 3.5%, 100% 14%, 97.5% 18%, 97.5% 82%, 100% 86%, 100% 96.5%, 96.5% 100%, 3.5% 100%, 0 96.5%, 0 86%, 2.5% 82%, 2.5% 18%, 0 14%, 0 3.5%)",
              }}
            >
              <div className="absolute left-[6%] right-[6%] top-[4.5%] h-[5px] rounded-full bg-white/4" />

              <div className="rounded-[12px] border border-black/25 bg-[#373236] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                <div className="relative mx-auto aspect-[16/9.6] w-full max-w-[860px] overflow-hidden border border-[#1f0000] bg-[#660008]">
                  <div className="grid h-full grid-cols-[25.8%_26.8%_14.2%_33.2%] grid-rows-[9.8%_17.6%_10.6%_62%]">
                    <div className="col-span-4 flex items-stretch border-b-2 border-[#ff1a1a] bg-[#712126]">
                      <div className="relative h-full w-[42.8%] border-r-2 border-[#ff1a1a]">
                        <Image
                          src={topBarGraphic}
                          alt="Driver station connection header"
                          fill
                          className="object-fill"
                          draggable={false}
                          priority
                        />
                      </div>

                      <div className="flex h-full flex-1 items-center justify-between gap-4 px-4 text-[clamp(8px,0.95vw,14px)]">
                        <div className="leading-tight text-white">
                          <div className="font-semibold">Network: 9999-A-RC</div>
                          <div className="font-semibold">Ping: 3ms - ch 1</div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-end gap-3">
                            <SignalIcon />
                            <div className="flex items-center gap-3">
                              <div className="text-[10px] font-semibold text-white sm:text-xs">
                                User 1
                              </div>
                              <div className="text-[10px] font-semibold text-white sm:text-xs">
                                User 2
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowHardwareConfig(true)}
                            className="rounded-full p-1 transition hover:bg-white/10"
                            aria-label="Open hardware configuration"
                          >
                            <MenuDots />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center border-r-2 border-b-2 border-[#ff1a1a] px-6 py-2 text-center">
                      <div className="text-[clamp(10px,1vw,14px)] font-semibold">Practice Timer</div>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        <div className="text-[clamp(24px,3.2vw,46px)] leading-none">2:30</div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#5c0007] shadow-[0_0_0_1px_rgba(255,255,255,0.15)]">
                          <span className="ml-[1px] text-sm leading-none">▶</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center border-r-2 border-b-2 border-[#ff1a1a] px-6 py-2">
                      <div className="flex items-center gap-3 text-center">
                        <div className="relative h-9 w-9 overflow-hidden">
                          <Image
                            src={driverStationRobotIcon}
                            alt="Driver station robot icon"
                            fill
                            className="object-contain"
                            draggable={false}
                          />
                        </div>
                        <div className="text-[clamp(11px,1vw,15px)] font-semibold">
                          {selectedTeleOp?.name ?? "SampleBot"}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 overflow-hidden border-b-2 border-[#ff1a1a] bg-[#ef1015]">
                      <div className="flex h-full w-full items-center justify-end pl-2">
                        <div className="relative h-full max-w-full flex-none aspect-[164.03/29.03]">
                          <Image
                            src={driverStationBatteryPanel}
                            alt="Driver station battery status panel"
                            fill
                            className="object-fill"
                            draggable={false}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 grid grid-cols-[56px_1fr_56px] items-center border-r-2 border-b-2 border-[#ff1a1a] bg-[#ef1015] px-0 text-[clamp(12px,1.2vw,18px)]">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveType("autonomous");
                          setShowOpModePicker(true);
                        }}
                        className="flex h-full items-center justify-center text-center text-[clamp(22px,2vw,34px)] leading-none text-white transition hover:bg-[#f7181d]"
                        aria-label="Select autonomous mode"
                      >
                        ▼
                      </button>
                      <div className="h-full text-center leading-tight text-white/95">
                        <div>Select Op Mode</div>
                        <div className="text-[clamp(11px,1vw,15px)]">
                          ← Autonomous | TeleOp →
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveType("teleop");
                          setShowOpModePicker(true);
                        }}
                        className="flex h-full items-center justify-center text-center text-[clamp(22px,2vw,34px)] leading-none text-white transition hover:bg-[#f7181d]"
                        aria-label="Select teleop mode"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="col-span-2 row-span-2 flex items-start border-b-2 border-[#ff1a1a] bg-[#5a0006] px-5 py-3 text-white">
                      <div className="max-w-[13ch] text-[clamp(17px,1.55vw,26px)] leading-[1.35]">
                        {statusText}
                      </div>
                    </div>

                    <div className="col-span-2 row-span-2 flex items-center justify-center border-r-2 border-[#ff1a1a] bg-[radial-gradient(circle_at_center,rgba(92,0,7,0.98)_0%,rgba(92,0,7,0.98)_26%,rgba(82,0,6,0.98)_27%,rgba(82,0,6,0.98)_57%,rgba(107,0,8,0.95)_58%,rgba(107,0,8,0.95)_100%)]">
                      <button
                        type="button"
                        onClick={handleCenterButton}
                        disabled={centerButtonDisabled}
                        className={`flex h-[39%] aspect-square min-h-[126px] min-w-[126px] items-center justify-center rounded-full border font-bold tracking-wide shadow-[0_10px_28px_rgba(42,0,3,0.28),inset_0_10px_30px_rgba(255,255,255,0.08)] transition disabled:opacity-60 ${
                          driverStationState === "running"
                            ? "border-[#f1e7e7] bg-white text-[#7d0007] hover:bg-[#f5eeee]"
                            : driverStationState === "initialized"
                              ? "border-[#66c907] bg-[#39b100] text-white hover:bg-[#45c400]"
                              : "border-[#916970] bg-[#b28d93] text-[#7d0007] hover:bg-[#bc979d]"
                        }`}
                        aria-label={centerButtonLabel}
                      >
                        <div
                          className={`flex items-center justify-center ${
                            driverStationState === "stopped"
                              ? "text-[clamp(26px,3.15vw,46px)]"
                              : "h-full w-full"
                          }`}
                        >
                          {centerButtonContent}
                        </div>
                      </button>
                    </div>

                    <div className="col-span-2 row-span-2 bg-[#5c0007]" />
                  </div>

                  {showOpModePicker ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4">
                      <div className="w-full max-w-[520px] rounded-[18px] border border-[#ff2f2f] bg-[#5e080d] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[#ff2f2f] px-5 py-4">
                          <div>
                            <div className="text-lg font-semibold">Select Op Mode</div>
                            <div className="text-sm text-white/70">
                              Choose which file is armed for the driver station.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowOpModePicker(false)}
                            className="rounded-full border border-white/20 px-3 py-1 text-sm transition hover:bg-white/10"
                          >
                            Close
                          </button>
                        </div>

                        <div className="flex border-b border-[#ff2f2f]">
                          {(["autonomous", "teleop"] as OpModeType[]).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setActiveType(type)}
                              className={`flex-1 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition ${
                                activeType === type
                                  ? "bg-[#d91015] text-white"
                                  : "bg-[#77141a] text-white/70 hover:bg-[#8f171d]"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-3 p-4">
                          {visibleOpModes.map((file) => {
                            const isSelected = selectedOpModes[activeType] === file.id;
                            return (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => {
                                  setSelectedOpModes((current) => ({
                                    ...current,
                                    [activeType]: file.id,
                                  }));
                                  setDriverStationState("stopped");
                                  setShowOpModePicker(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                                  isSelected
                                    ? "border-white bg-white/12"
                                    : "border-white/15 bg-black/15 hover:bg-white/8"
                                }`}
                              >
                                <div>
                                  <div className="font-semibold">{file.name}</div>
                                  <div className="text-xs uppercase tracking-[0.2em] text-white/60">
                                    {file.type}
                                  </div>
                                </div>
                                <div className="rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/75">
                                  {isSelected ? "Selected" : "Choose"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {showHardwareConfig ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4">
                      <div className="w-full max-w-[620px] overflow-hidden rounded-[18px] border border-[#ff2f2f] bg-[#54060b] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[#ff2f2f] px-5 py-4">
                          <div>
                            <div className="text-lg font-semibold">Hardware Configuration</div>
                            <div className="text-sm text-white/70">
                              Mocked config preview for the DS test surface.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowHardwareConfig(false)}
                            className="rounded-full border border-white/20 px-3 py-1 text-sm transition hover:bg-white/10"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-px bg-[#ff2f2f] text-sm">
                          <div className="bg-[#7b161b] px-4 py-3 font-semibold uppercase tracking-[0.18em]">
                            Device
                          </div>
                          <div className="bg-[#7b161b] px-4 py-3 font-semibold uppercase tracking-[0.18em]">
                            Type
                          </div>
                          <div className="bg-[#7b161b] px-4 py-3 font-semibold uppercase tracking-[0.18em]">
                            Port
                          </div>
                          {HARDWARE_CONFIG.flatMap((device) => [
                            <div key={`${device.name}-name`} className="bg-[#5e080d] px-4 py-3">
                              {device.name}
                            </div>,
                            <div key={`${device.name}-kind`} className="bg-[#5e080d] px-4 py-3 text-white/80">
                              {device.kind}
                            </div>,
                            <div key={`${device.name}-port`} className="bg-[#5e080d] px-4 py-3 text-white/80">
                              {device.port}
                            </div>,
                          ])}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
