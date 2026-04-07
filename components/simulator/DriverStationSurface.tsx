"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import driverStationBatteryPanel from "@/app/driver-station-test/driver-station-battery-panel.svg";
import driverStationRobotIcon from "@/app/driver-station-test/driver-station-robot-icon.png";
import topBarGraphic from "@/app/driver-station-test/TopBar.svg";

export type DriverStationModeType = "autonomous" | "teleop";
export type DriverStationRunState = "stopped" | "initialized" | "running";

export interface DriverStationOpModeOption {
  id: string;
  label: string;
  type: DriverStationModeType;
}

interface HardwareDevice {
  name: string;
  kind: string;
  port: string;
}

interface DriverStationSurfaceProps {
  opModes: DriverStationOpModeOption[];
  selectedOpModeId: string | null;
  driverStationState: DriverStationRunState;
  statusText: string;
  centerButtonLabel: string;
  centerButtonDisabled: boolean;
  onCenterButton: () => void;
  onSelectOpModeId: (opModeId: string, type: DriverStationModeType) => void;
  onSelectionCommitted?: () => void;
  responsiveScale?: boolean;
  responsiveScaleAdjustment?: number;
  showOuterFrame?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  startDisabled?: boolean;
  stopDisabled?: boolean;
}

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

const DRIVER_STATION_DESIGN_WIDTH = 1044;
const DRIVER_STATION_MIN_SCALE = 0.45;

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

export default function DriverStationSurface({
  opModes,
  selectedOpModeId,
  driverStationState,
  statusText,
  centerButtonLabel,
  centerButtonDisabled,
  onCenterButton,
  onSelectOpModeId,
  onSelectionCommitted,
  responsiveScale = false,
  responsiveScaleAdjustment = 1,
  showOuterFrame = true,
  onStart,
  onStop,
  startDisabled = false,
  stopDisabled = false,
}: DriverStationSurfaceProps) {
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeType, setActiveType] = useState<DriverStationModeType>("teleop");
  const [showOpModePicker, setShowOpModePicker] = useState(false);
  const [showHardwareConfig, setShowHardwareConfig] = useState(false);
  const [containerWidth, setContainerWidth] = useState(DRIVER_STATION_DESIGN_WIDTH);

  const selectedOpMode =
    opModes.find((file) => file.id === selectedOpModeId) ?? opModes[0] ?? null;

  const visibleOpModes = useMemo(
    () => opModes.filter((file) => file.type === activeType),
    [activeType, opModes]
  );

  const selectedTeleOp =
    opModes.find((file) => file.id === selectedOpModeId && file.type === "teleop") ??
    opModes.find((file) => file.type === "teleop") ??
    null;
  const scale = responsiveScale
    ? Math.min(
        1,
        Math.max(
          DRIVER_STATION_MIN_SCALE,
          (containerWidth / DRIVER_STATION_DESIGN_WIDTH) * responsiveScaleAdjustment
        )
      )
    : 1;
  const scaled = (px: number) => `calc(var(--ds-scale) * ${px}px)`;
  useEffect(() => {
    if (selectedOpMode && !showOpModePicker) {
      setActiveType(selectedOpMode.type);
    }
  }, [selectedOpModeId, selectedOpMode?.type, showOpModePicker]);

  useEffect(() => {
    const container = scaleContainerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth || DRIVER_STATION_DESIGN_WIDTH);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  const innerSurface = (
    <div
      className="relative mx-auto w-full max-w-[980px] bg-[#2f2c30] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      style={{
        ["--ds-scale" as string]: String(scale),
        clipPath:
          "polygon(3.5% 0, 96.5% 0, 100% 3.5%, 100% 14%, 97.5% 18%, 97.5% 82%, 100% 86%, 100% 96.5%, 96.5% 100%, 3.5% 100%, 0 96.5%, 0 86%, 2.5% 82%, 2.5% 18%, 0 14%, 0 3.5%)",
        padding: scaled(24),
      }}
    >
      <div
        className="absolute left-[6%] right-[6%] top-[4.5%] rounded-full bg-white/4"
        style={{ height: scaled(5) }}
      />

      <div
        className="border border-black/25 bg-[#373236] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
        style={{ borderRadius: scaled(12), padding: scaled(16) }}
      >
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

              <div
                className="flex h-full flex-1 items-center justify-between"
                style={{ gap: scaled(16), paddingInline: scaled(16), fontSize: scaled(14) }}
              >
                <div className="leading-tight text-white">
                  <div className="font-semibold">Network: 24213-RC</div>
                  <div className="font-semibold">Ping: 3ms - ch 1</div>
                </div>

                <div className="flex items-center" style={{ gap: scaled(16) }}>
                  <div className="flex items-end" style={{ gap: scaled(12) }}>
                    <SignalIcon />
                    <div className="flex items-center" style={{ gap: scaled(12) }}>
                      <div className="font-semibold text-white" style={{ fontSize: scaled(12) }}>User 1</div>
                      <div className="font-semibold text-white" style={{ fontSize: scaled(12) }}>User 2</div>
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

            <div
              className="flex flex-col items-center justify-center border-r-2 border-b-2 border-[#ff1a1a] text-center"
              style={{ paddingInline: scaled(24), paddingBlock: scaled(8) }}
            >
              <div className="font-semibold" style={{ fontSize: scaled(14) }}>Practice Timer</div>
              <div className="mt-2 flex items-center justify-center" style={{ gap: scaled(12) }}>
                <div className="leading-none" style={{ fontSize: scaled(44) }}>2:30</div>
                <div
                  className="flex items-center justify-center rounded-full bg-white text-[#5c0007] shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                  style={{ width: scaled(32), height: scaled(32) }}
                >
                  <span className="ml-[1px] text-sm leading-none">▶</span>
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-center border-r-2 border-b-2 border-[#ff1a1a]"
              style={{ paddingInline: scaled(24), paddingBlock: scaled(8) }}
            >
              <div className="flex items-center text-center" style={{ gap: scaled(12) }}>
                <div className="relative overflow-hidden" style={{ width: scaled(36), height: scaled(36) }}>
                  <Image
                    src={driverStationRobotIcon}
                    alt="Driver station robot icon"
                    fill
                    className="object-contain"
                    draggable={false}
                  />
                </div>
                <div className="font-semibold" style={{ fontSize: scaled(15) }}>
                  {selectedTeleOp?.label ?? "SampleBot"}
                </div>
              </div>
            </div>

            <div className="col-span-2 overflow-hidden border-b-2 border-[#ff1a1a] bg-[#ef1015]">
              <div className="flex h-full w-full items-center justify-end" style={{ paddingLeft: scaled(8) }}>
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

            <div
              className="col-span-2 grid items-center border-r-2 border-b-2 border-[#ff1a1a] bg-[#ef1015] px-0"
              style={{
                gridTemplateColumns: `${scaled(56)} 1fr ${scaled(56)}`,
                fontSize: scaled(21),
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveType("autonomous");
                  setShowOpModePicker(true);
                }}
                className="flex h-full items-center justify-center text-center leading-none text-white transition hover:bg-[#f7181d]"
                style={{ fontSize: scaled(30) }}
                aria-label="Select autonomous mode"
              >
                ▼
              </button>
              <div className="h-full text-center leading-tight text-white/95">
                <div>Select Op Mode</div>
                <div style={{ fontSize: scaled(15) }}>← Autonomous | TeleOp →</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveType("teleop");
                  setShowOpModePicker(true);
                }}
                className="flex h-full items-center justify-center text-center leading-none text-white transition hover:bg-[#f7181d]"
                style={{ fontSize: scaled(30) }}
                aria-label="Select teleop mode"
              >
                ▼
              </button>
            </div>

            <div
              className="col-span-2 row-span-2 flex items-start border-b-2 border-[#ff1a1a] bg-[#5a0006] text-white"
              style={{ paddingInline: scaled(20), paddingBlock: scaled(12) }}
            >
              <div className="max-w-[13ch] leading-[1.35]" style={{ fontSize: scaled(24) }}>{statusText}</div>
            </div>

            <div className="col-span-2 row-span-2 flex items-center justify-center border-r-2 border-[#ff1a1a] bg-[radial-gradient(circle_at_center,rgba(92,0,7,0.98)_0%,rgba(92,0,7,0.98)_26%,rgba(82,0,6,0.98)_27%,rgba(82,0,6,0.98)_57%,rgba(107,0,8,0.95)_58%,rgba(107,0,8,0.95)_100%)]">
              <button
                type="button"
                onClick={onCenterButton}
                disabled={centerButtonDisabled}
                className={`flex h-[39%] aspect-square items-center justify-center rounded-full border font-bold tracking-wide shadow-[0_10px_28px_rgba(42,0,3,0.28),inset_0_10px_30px_rgba(255,255,255,0.08)] transition disabled:opacity-60 ${
                  driverStationState === "running"
                    ? "border-[#f1e7e7] bg-white text-[#7d0007] hover:bg-[#f5eeee]"
                    : driverStationState === "initialized"
                      ? "border-[#66c907] bg-[#39b100] text-white hover:bg-[#45c400]"
                      : "border-[#916970] bg-[#b28d93] text-[#7d0007] hover:bg-[#bc979d]"
                }`}
                style={{ minWidth: scaled(126), minHeight: scaled(126) }}
                aria-label={centerButtonLabel}
              >
                <div
                  className={`flex items-center justify-center ${driverStationState === "stopped" ? "" : "h-full w-full"}`}
                  style={driverStationState === "stopped" ? { fontSize: scaled(40) } : undefined}
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
                  {(["autonomous", "teleop"] as DriverStationModeType[]).map((type) => (
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
                    const isSelected = selectedOpMode?.id === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          onSelectOpModeId(file.id, file.type);
                          onSelectionCommitted?.();
                          setShowOpModePicker(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-white bg-white/12"
                            : "border-white/15 bg-black/15 hover:bg-white/8"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{file.label}</div>
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
  );

  const surface = (
    <div>
      {showOuterFrame ? (
        <section
          className="rounded-[42px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
          style={{ padding: scaled(16) }}
        >
          {innerSurface}
        </section>
      ) : (
        innerSurface
      )}

      {onStart || onStop ? (
        <div className="flex items-center gap-2 px-2 pb-2">
          {onStart ? (
            <Button
              variant="secondary"
              onClick={onStart}
              disabled={startDisabled}
              className="bg-zinc-800 text-white hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
            >
              Start
            </Button>
          ) : null}
          {onStop ? (
            <Button
              variant="outline"
              onClick={onStop}
              disabled={stopDisabled}
              className="border-gray-700 bg-transparent text-zinc-100 hover:bg-zinc-800 disabled:text-zinc-600"
            >
              Stop
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div ref={scaleContainerRef} className="grid gap-6 border-b border-gray-700 bg-black p-4">
      <div className="mx-auto w-full max-w-[1044px]">{surface}</div>
    </div>
  );
}
