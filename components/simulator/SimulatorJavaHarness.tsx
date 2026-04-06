"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

import { Button } from "@/components/ui/button";
import type { StudioOpModeOption } from "@/components/simulator/SimulatorStudioDriverStation";
import type { F310State } from "@/components/simulator/F310Gamepad";
import type { SimulatorBridge } from "@/lib/simulator/mechanismSimulator";

export interface SimulatorDriverStationModel {
  status: HarnessStatus;
  awaitingStart: boolean;
  isCompiling: boolean;
  opModes: StudioOpModeOption[];
  selectedOpModeId: string | null;
  onSelectOpModeId: (opModeId: string) => void;
  onInitialize: () => void;
  onStart: () => void;
  onStop: () => void;
}

interface SimulatorJavaHarnessProps {
  bridge: SimulatorBridge;
  editorHeight: number;
  onEditorResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  gamepadState: F310State;
  onDriverStationModelChange?: (model: SimulatorDriverStationModel) => void;
}

type HarnessStatus = "loading" | "ready" | "running" | "error";

interface HarnessLogEntry {
  id: number;
  tone: "default" | "error" | "success";
  message: string;
}

interface HarnessFile {
  id: string;
  name: string;
  content: string;
}

type UserOpModeType = "teleop" | "autonomous";

interface DetectedOpMode {
  fileId: string;
  className: string;
  type: UserOpModeType;
  fileName: string;
}

function createSupportFiles(): Array<{ name: string; content: string }> {
  return [
    {
      name: "SimulatorNative.java",
      content: `package simulator.bridge;

public class SimulatorNative {
  public static native void setMotorPower(String deviceName, double power);
  public static native int getMotorCurrentPosition(String deviceName);
  public static native void setMotorTargetPosition(String deviceName, int targetTicks);
  public static native void setMotorMode(String deviceName, String mode);
  public static native boolean isMotorBusy(String deviceName);
  public static native boolean getGamepadBoolean(int gamepadId, String controlName);
  public static native float getGamepadFloat(int gamepadId, String controlName);
  public static native boolean isOpModeActive();
  public static native void setServoPosition(String deviceName, double position);
  public static native void addTelemetry(String caption, String value);
  public static native void waitForStart();
}
`,
    },
    {
      name: "DcMotor.java",
      content: `package com.qualcomm.robotcore.hardware;

import simulator.bridge.SimulatorNative;

public class DcMotor {
  public enum RunMode {
    RUN_WITHOUT_ENCODER,
    RUN_TO_POSITION,
    STOP_AND_RESET_ENCODER
  }

  private final String deviceName;
  private RunMode runMode = RunMode.RUN_WITHOUT_ENCODER;

  public DcMotor(String deviceName) {
    this.deviceName = deviceName;
  }

  public void setPower(double power) {
    SimulatorNative.setMotorPower(deviceName, power);
  }

  public int getCurrentPosition() {
    return SimulatorNative.getMotorCurrentPosition(deviceName);
  }

  public void setTargetPosition(int targetTicks) {
    SimulatorNative.setMotorTargetPosition(deviceName, targetTicks);
  }

  public void setMode(RunMode runMode) {
    this.runMode = runMode;
    SimulatorNative.setMotorMode(deviceName, runMode.name());
  }

  public RunMode getMode() {
    return runMode;
  }

  public boolean isBusy() {
    return SimulatorNative.isMotorBusy(deviceName);
  }
}
`,
    },
    {
      name: "Gamepad.java",
      content: `package com.qualcomm.robotcore.hardware;

import simulator.bridge.SimulatorNative;

public class Gamepad {
  public boolean a;
  public boolean b;
  public boolean x;
  public boolean y;
  public boolean dpad_up;
  public boolean dpad_down;
  public boolean dpad_left;
  public boolean dpad_right;
  public boolean left_bumper;
  public boolean right_bumper;
  public boolean left_stick_button;
  public boolean right_stick_button;
  public boolean back;
  public boolean start;
  public boolean guide;
  public float left_stick_x;
  public float left_stick_y;
  public float right_stick_x;
  public float right_stick_y;
  public float left_trigger;
  public float right_trigger;

  private final int gamepadId;

  public Gamepad(int gamepadId) {
    this.gamepadId = gamepadId;
  }

  public void __syncFromSimulator() {
    a = SimulatorNative.getGamepadBoolean(gamepadId, "a");
    b = SimulatorNative.getGamepadBoolean(gamepadId, "b");
    x = SimulatorNative.getGamepadBoolean(gamepadId, "x");
    y = SimulatorNative.getGamepadBoolean(gamepadId, "y");
    dpad_up = SimulatorNative.getGamepadBoolean(gamepadId, "dpad_up");
    dpad_down = SimulatorNative.getGamepadBoolean(gamepadId, "dpad_down");
    dpad_left = SimulatorNative.getGamepadBoolean(gamepadId, "dpad_left");
    dpad_right = SimulatorNative.getGamepadBoolean(gamepadId, "dpad_right");
    left_bumper = SimulatorNative.getGamepadBoolean(gamepadId, "left_bumper");
    right_bumper = SimulatorNative.getGamepadBoolean(gamepadId, "right_bumper");
    left_stick_button = SimulatorNative.getGamepadBoolean(gamepadId, "left_stick_button");
    right_stick_button = SimulatorNative.getGamepadBoolean(gamepadId, "right_stick_button");
    back = SimulatorNative.getGamepadBoolean(gamepadId, "back");
    start = SimulatorNative.getGamepadBoolean(gamepadId, "start");
    guide = SimulatorNative.getGamepadBoolean(gamepadId, "guide");
    left_stick_x = SimulatorNative.getGamepadFloat(gamepadId, "left_stick_x");
    left_stick_y = SimulatorNative.getGamepadFloat(gamepadId, "left_stick_y");
    right_stick_x = SimulatorNative.getGamepadFloat(gamepadId, "right_stick_x");
    right_stick_y = SimulatorNative.getGamepadFloat(gamepadId, "right_stick_y");
    left_trigger = SimulatorNative.getGamepadFloat(gamepadId, "left_trigger");
    right_trigger = SimulatorNative.getGamepadFloat(gamepadId, "right_trigger");
  }
}
`,
    },
    {
      name: "ElapsedTime.java",
      content: `package com.qualcomm.robotcore.util;

public class ElapsedTime {
  private long startTimeNanos;

  public ElapsedTime() {
    reset();
  }

  public void reset() {
    startTimeNanos = System.nanoTime();
  }

  public double seconds() {
    return (System.nanoTime() - startTimeNanos) / 1_000_000_000.0;
  }
}
`,
    },
    {
      name: "Servo.java",
      content: `package com.qualcomm.robotcore.hardware;

import simulator.bridge.SimulatorNative;

public class Servo {
  private final String deviceName;

  public Servo(String deviceName) {
    this.deviceName = deviceName;
  }

  public void setPosition(double position) {
    SimulatorNative.setServoPosition(deviceName, position);
  }
}
`,
    },
    {
      name: "Autonomous.java",
      content: `package com.qualcomm.robotcore.eventloop.opmode;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Autonomous {
  String name() default "";
}
`,
    },
    {
      name: "TeleOp.java",
      content: `package com.qualcomm.robotcore.eventloop.opmode;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface TeleOp {
  String name() default "";
}
`,
    },
    {
      name: "Telemetry.java",
      content: `package com.qualcomm.robotcore.eventloop.opmode;

import simulator.bridge.SimulatorNative;

public class Telemetry {
  public void addData(String caption, Object value) {
    SimulatorNative.addTelemetry(caption, String.valueOf(value));
  }
}
`,
    },
    {
      name: "HardwareMap.java",
      content: `package com.qualcomm.robotcore.hardware;

public class HardwareMap {
  public <T> T get(Class<T> deviceClass, String deviceName) {
    if (deviceClass == DcMotor.class) {
      return deviceClass.cast(new DcMotor(deviceName));
    }

    if (deviceClass == Servo.class) {
      return deviceClass.cast(new Servo(deviceName));
    }

    throw new IllegalArgumentException(
      "Unsupported mock hardware device: " + deviceClass.getSimpleName() + " named " + deviceName
    );
  }
}
`,
    },
    {
      name: "OpMode.java",
      content: `package com.qualcomm.robotcore.eventloop.opmode;

import com.qualcomm.robotcore.hardware.Gamepad;
import com.qualcomm.robotcore.hardware.HardwareMap;

public abstract class OpMode {
  public final HardwareMap hardwareMap = new HardwareMap();
  public final Telemetry telemetry = new Telemetry();
  public final Gamepad gamepad1 = new Gamepad(1);
  public final Gamepad gamepad2 = new Gamepad(2);

  public void init() {}

  public void start() {}

  public abstract void loop();

  public void stop() {}
}
`,
    },
    {
      name: "LinearOpMode.java",
      content: `package com.qualcomm.robotcore.eventloop.opmode;

import simulator.bridge.SimulatorNative;

public abstract class LinearOpMode extends OpMode {
  private boolean started = false;

  public abstract void runOpMode() throws Exception;

  public void sleep(long milliseconds) throws InterruptedException {
    Thread.sleep(milliseconds);
  }

  public void waitForStart() {
    telemetry.addData("opMode", "waiting for start");
    SimulatorNative.waitForStart();
    started = true;
    gamepad1.__syncFromSimulator();
    gamepad2.__syncFromSimulator();
    telemetry.addData("opMode", "started");
  }

  public boolean opModeIsActive() {
    gamepad1.__syncFromSimulator();
    gamepad2.__syncFromSimulator();
    return started && SimulatorNative.isOpModeActive();
  }

  @Override
  public final void loop() {}
}
`,
    },
    {
      name: "Main.java",
      content: `package simulator.launcher;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;

public class Main {
  public static void main(String[] args) throws Exception {
    String opModeClassName = args.length > 0
      ? args[0]
      : "org.firstinspires.ftc.teamcode.MechanismTestOpMode";
    Class<?> opModeClass = Class.forName(opModeClassName);
    Object instance = opModeClass.getDeclaredConstructor().newInstance();

    if (instance instanceof LinearOpMode) {
      ((LinearOpMode) instance).runOpMode();
      return;
    }

    if (instance instanceof OpMode) {
      OpMode opMode = (OpMode) instance;
      opMode.init();
      simulator.bridge.SimulatorNative.addTelemetry("opMode", "waiting for start");
      simulator.bridge.SimulatorNative.waitForStart();
      opMode.start();

      while (simulator.bridge.SimulatorNative.isOpModeActive()) {
        opMode.gamepad1.__syncFromSimulator();
        opMode.gamepad2.__syncFromSimulator();
        opMode.loop();
        Thread.sleep(50);
      }

      opMode.stop();
      return;
    }

    throw new IllegalArgumentException("Unsupported op mode class: " + opModeClassName);
  }
}
`,
    },
  ];
}

function createAutonomousTemplate(): HarnessFile[] {
  return [
    {
      id: "1",
      name: "MechanismTestOpMode.java",
      content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.util.ElapsedTime;

@Autonomous(name = "Mechanism Test Auto")
public class MechanismTestOpMode extends LinearOpMode {
  @Override
  public void runOpMode() throws Exception {
    DcMotor armMotor = hardwareMap.get(DcMotor.class, "armMotor");
    Servo clawServo = hardwareMap.get(Servo.class, "clawServo");
    ElapsedTime timer = new ElapsedTime();

    telemetry.addData("status", "initialized");
    waitForStart();

    if (!opModeIsActive()) {
      return;
    }

    timer.reset();
    armMotor.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    armMotor.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    telemetry.addData("status", "starting mechanism test");
    clawServo.setPosition(1.0);
    sleep(500);

    armMotor.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    armMotor.setTargetPosition(780);
    armMotor.setPower(1.0);
    while (opModeIsActive() && armMotor.isBusy()) {
      telemetry.addData("phase", "raising to target");
      telemetry.addData("armTicks", armMotor.getCurrentPosition());
      telemetry.addData("elapsed", String.format("%.2f", timer.seconds()));
      sleep(120);
    }

    clawServo.setPosition(0.1);
    telemetry.addData("claw", "closing");
    sleep(450);

    armMotor.setTargetPosition(220);
    armMotor.setPower(0.85);
    while (opModeIsActive() && armMotor.isBusy()) {
      telemetry.addData("phase", "lowering to target");
      telemetry.addData("armTicks", armMotor.getCurrentPosition());
      telemetry.addData("elapsed", String.format("%.2f", timer.seconds()));
      sleep(120);
    }

    telemetry.addData("finalTicks", armMotor.getCurrentPosition());
    telemetry.addData("totalTime", String.format("%.2f", timer.seconds()));
    telemetry.addData("status", "mechanism test complete");
  }
}
`,
    },
  ];
}

function createTeleOpTemplate(): HarnessFile[] {
  return [
    {
      id: "1",
      name: "MechanismTeleOp.java",
      content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "Mechanism TeleOp")
public class MechanismTeleOp extends LinearOpMode {
  @Override
  public void runOpMode() throws Exception {
    DcMotor leftFront = hardwareMap.get(DcMotor.class, "leftFront");
    DcMotor rightFront = hardwareMap.get(DcMotor.class, "rightFront");
    DcMotor armMotor = hardwareMap.get(DcMotor.class, "armMotor");
    Servo clawServo = hardwareMap.get(Servo.class, "clawServo");

    leftFront.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
    rightFront.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
    armMotor.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    armMotor.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
    telemetry.addData("status", "teleop ready");
    waitForStart();

    while (opModeIsActive()) {
      double drive = -gamepad1.left_stick_y;
      double turn = gamepad1.right_stick_x;
      double leftPower = Math.max(-1.0, Math.min(1.0, drive + turn));
      double rightPower = Math.max(-1.0, Math.min(1.0, drive - turn));

      leftFront.setPower(leftPower);
      rightFront.setPower(rightPower);

      if (gamepad1.y) {
        armMotor.setPower(0.8);
      } else if (gamepad1.a) {
        armMotor.setPower(-0.55);
      } else {
        armMotor.setPower(0.0);
      }

      if (gamepad1.right_bumper) {
        clawServo.setPosition(1.0);
      } else if (gamepad1.left_bumper) {
        clawServo.setPosition(0.1);
      }

      telemetry.addData("mode", "teleop");
      telemetry.addData("drive", String.format("L %.2f / R %.2f", leftPower, rightPower));
      telemetry.addData("armTicks", armMotor.getCurrentPosition());
      telemetry.addData("controls", "Left stick drive, right stick turn, Y/A arm, RB/LB claw");
      sleep(50);
    }
  }
}
`,
    },
  ];
}

function detectUserOpModeType(files: HarnessFile[]): UserOpModeType {
  const source = files.map((file) => file.content).join("\n");
  if (source.includes("@TeleOp")) {
    return "teleop";
  }
  if (source.includes("@Autonomous")) {
    return "autonomous";
  }
  if (source.includes("extends OpMode")) {
    return "teleop";
  }
  return "autonomous";
}

function detectOpModes(files: HarnessFile[]): DetectedOpMode[] {
  return files.reduce<DetectedOpMode[]>((opModes, file) => {
    const packageMatch = file.content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
    const classMatch = file.content.match(/public\s+class\s+([A-Za-z0-9_]+)/);
    const packageName = packageMatch?.[1] ?? "org.firstinspires.ftc.teamcode";
    const className = classMatch?.[1];

    if (!className) {
      return opModes;
    }

    if (file.content.includes("@TeleOp")) {
      opModes.push({
        fileId: file.id,
        fileName: file.name,
        className: `${packageName}.${className}`,
        type: "teleop" as const,
      });
      return opModes;
    }

    if (file.content.includes("@Autonomous")) {
      opModes.push({
        fileId: file.id,
        fileName: file.name,
        className: `${packageName}.${className}`,
        type: "autonomous" as const,
      });
      return opModes;
    }

    if (file.content.includes("extends OpMode")) {
      opModes.push({
        fileId: file.id,
        fileName: file.name,
        className: `${packageName}.${className}`,
        type: "teleop" as const,
      });
      return opModes;
    }

    if (file.content.includes("extends LinearOpMode")) {
      opModes.push({
        fileId: file.id,
        fileName: file.name,
        className: `${packageName}.${className}`,
        type: "autonomous" as const,
      });
      return opModes;
    }

    return opModes;
  }, []);
}

function addFilesWithoutReplacing(
  currentFiles: HarnessFile[],
  nextFiles: HarnessFile[]
): { files: HarnessFile[]; addedFile: HarnessFile | null } {
  const existingNames = new Set(currentFiles.map((file) => file.name));
  const filesToAdd: HarnessFile[] = [];

  for (let index = 0; index < nextFiles.length; index += 1) {
    const file = nextFiles[index];
    if (existingNames.has(file.name)) {
      continue;
    }

    filesToAdd.push({
      ...file,
      id: `file-${Date.now()}-${index}-${file.name}`,
    });
    existingNames.add(file.name);
  }

  return {
    files: [...currentFiles, ...filesToAdd],
    addedFile: filesToAdd[0] ?? null,
  };
}

function createNewJavaFile(fileIndex: number): HarnessFile {
  const className = `Helper${fileIndex}`;

  return {
    id: `file-${Date.now()}-${fileIndex}`,
    name: `${className}.java`,
    content: `package org.firstinspires.ftc.teamcode;

public class ${className} {
}
`,
  };
}

function getJavaBaseName(fileName: string): string {
  return fileName.replace(/\.java$/i, "");
}

function normalizeJavaFileName(fileName: string): string {
  const trimmedName = fileName.trim();
  const withoutExtension = trimmedName.replace(/\.java$/i, "");
  const sanitizedBaseName =
    withoutExtension.replace(/[^A-Za-z0-9_]/g, "") || "Untitled";

  return `${sanitizedBaseName}.java`;
}

function renameJavaClassIfNeeded(content: string, previousFileName: string, nextFileName: string) {
  const previousClassName = getJavaBaseName(previousFileName);
  const nextClassName = getJavaBaseName(nextFileName);
  const classPattern = new RegExp(`(public\\s+class\\s+)${previousClassName}(\\b)`);

  if (!classPattern.test(content)) {
    return content;
  }

  return content.replace(classPattern, `$1${nextClassName}$2`);
}

const HARNESS_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #000000;
        color: #f4f4f5;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      #status {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #71717a;
      }
    </style>
    <script src="https://cjrtnc.leaningtech.com/4.2/loader.js"></script>
  </head>
  <body>
    <div id="status">Loading runtime…</div>
    <script>
      const statusEl = document.getElementById("status");

      function setStatus(label) {
        statusEl.textContent = label;
      }

      function notifyParent(type, payload) {
        parent.postMessage({ type, ...payload }, "*");
      }

      async function detectToolsJarPath() {
        const candidates = ["/app/tools.jar", "/tools.jar"];

        for (const candidate of candidates) {
          try {
            const response = await fetch(candidate, { method: "HEAD" });
            if (response.ok) {
              return candidate;
            }
          } catch (error) {
            console.warn("Unable to probe tools.jar candidate", candidate, error);
          }
        }

        return null;
      }

      async function Java_simulator_bridge_SimulatorNative_setMotorPower(lib, deviceName, power) {
        notifyParent("sim-java-motor-power", {
          deviceName: String(deviceName),
          power: Number(power),
        });
      }

      async function Java_simulator_bridge_SimulatorNative_getMotorCurrentPosition(lib, deviceName) {
        return await new Promise((resolve) => {
          const requestId = "motor-pos-" + Math.random().toString(36).slice(2);
          function handleMessage(event) {
            if (
              event.source !== parent ||
              !event.data ||
              event.data.type !== "sim-java-motor-position-response" ||
              event.data.requestId !== requestId
            ) {
              return;
            }

            window.removeEventListener("message", handleMessage);
            resolve(Number(event.data.position));
          }

          window.addEventListener("message", handleMessage);
          notifyParent("sim-java-motor-position-request", {
            requestId,
            deviceName: String(deviceName),
          });
        });
      }

      async function Java_simulator_bridge_SimulatorNative_setMotorTargetPosition(
        lib,
        deviceName,
        targetTicks
      ) {
        notifyParent("sim-java-set-motor-target-position", {
          deviceName: String(deviceName),
          targetTicks: Number(targetTicks),
        });
      }

      async function Java_simulator_bridge_SimulatorNative_setMotorMode(lib, deviceName, mode) {
        notifyParent("sim-java-set-motor-mode", {
          deviceName: String(deviceName),
          mode: String(mode),
        });
      }

      async function Java_simulator_bridge_SimulatorNative_isMotorBusy(lib, deviceName) {
        return await new Promise((resolve) => {
          const requestId = "motor-busy-" + Math.random().toString(36).slice(2);
          function handleMessage(event) {
            if (
              event.source !== parent ||
              !event.data ||
              event.data.type !== "sim-java-motor-busy-response" ||
              event.data.requestId !== requestId
            ) {
              return;
            }

            window.removeEventListener("message", handleMessage);
            resolve(Boolean(event.data.busy));
          }

          window.addEventListener("message", handleMessage);
          notifyParent("sim-java-motor-busy-request", {
            requestId,
            deviceName: String(deviceName),
          });
        });
      }

      async function Java_simulator_bridge_SimulatorNative_getGamepadBoolean(
        lib,
        gamepadId,
        controlName
      ) {
        return await new Promise((resolve) => {
          const requestId = "gamepad-" + Math.random().toString(36).slice(2);
          function handleMessage(event) {
            if (
              event.source !== parent ||
              !event.data ||
              event.data.type !== "sim-java-gamepad-response" ||
              event.data.requestId !== requestId
            ) {
              return;
            }

            window.removeEventListener("message", handleMessage);
            resolve(Boolean(event.data.value));
          }

          window.addEventListener("message", handleMessage);
          notifyParent("sim-java-gamepad-request", {
            requestId,
            gamepadId: Number(gamepadId),
            controlName: String(controlName),
          });
        });
      }

      async function Java_simulator_bridge_SimulatorNative_getGamepadFloat(
        lib,
        gamepadId,
        controlName
      ) {
        return await new Promise((resolve) => {
          const requestId = "gamepad-float-" + Math.random().toString(36).slice(2);
          function handleMessage(event) {
            if (
              event.source !== parent ||
              !event.data ||
              event.data.type !== "sim-java-gamepad-float-response" ||
              event.data.requestId !== requestId
            ) {
              return;
            }

            window.removeEventListener("message", handleMessage);
            resolve(Number(event.data.value));
          }

          window.addEventListener("message", handleMessage);
          notifyParent("sim-java-gamepad-float-request", {
            requestId,
            gamepadId: Number(gamepadId),
            controlName: String(controlName),
          });
        });
      }

      let opModeActive = false;

      async function Java_simulator_bridge_SimulatorNative_isOpModeActive() {
        return opModeActive;
      }

      async function Java_simulator_bridge_SimulatorNative_setServoPosition(lib, deviceName, position) {
        notifyParent("sim-java-servo-position", {
          deviceName: String(deviceName),
          position: Number(position),
        });
      }

      async function Java_simulator_bridge_SimulatorNative_addTelemetry(lib, caption, value) {
        notifyParent("sim-java-telemetry", {
          caption: String(caption),
          value: String(value),
        });
      }

      let startResolver = null;
      let hasPendingStart = false;

      async function Java_simulator_bridge_SimulatorNative_waitForStart() {
        notifyParent("sim-java-waiting-for-start", {});
        setStatus("Waiting for start signal…");

        if (hasPendingStart) {
          hasPendingStart = false;
          opModeActive = true;
          notifyParent("sim-java-started", {});
          setStatus("Java demo running…");
          return;
        }

        await new Promise((resolve) => {
          startResolver = () => {
            startResolver = null;
            opModeActive = true;
            notifyParent("sim-java-started", {});
            setStatus("Java demo running…");
            resolve();
          };
        });
      }

      async function init() {
        try {
          await cheerpjInit({
            version: 8,
            natives: {
              Java_simulator_bridge_SimulatorNative_setMotorPower,
              Java_simulator_bridge_SimulatorNative_getMotorCurrentPosition,
              Java_simulator_bridge_SimulatorNative_setMotorTargetPosition,
              Java_simulator_bridge_SimulatorNative_setMotorMode,
              Java_simulator_bridge_SimulatorNative_isMotorBusy,
              Java_simulator_bridge_SimulatorNative_getGamepadBoolean,
              Java_simulator_bridge_SimulatorNative_getGamepadFloat,
              Java_simulator_bridge_SimulatorNative_isOpModeActive,
              Java_simulator_bridge_SimulatorNative_setServoPosition,
              Java_simulator_bridge_SimulatorNative_addTelemetry,
              Java_simulator_bridge_SimulatorNative_waitForStart,
            },
            status: "none",
          });
          setStatus("CheerpJ harness ready");
          notifyParent("sim-java-ready", {});
        } catch (error) {
          setStatus("CheerpJ harness failed");
          notifyParent("sim-java-error", {
            message: error && error.message ? error.message : String(error),
          });
        }
      }

      window.addEventListener("message", async (event) => {
        if (!event.data) {
          return;
        }

        if (event.data.type === "sim-java-start-opmode") {
          if (startResolver) {
            startResolver();
          } else {
            hasPendingStart = true;
          }
          return;
        }

        if (event.data.type === "sim-java-stop-opmode") {
          opModeActive = false;
          hasPendingStart = false;
          startResolver = null;
          setStatus("OpMode stopped");
          return;
        }

        if (
          event.data.type === "sim-java-motor-position-response" ||
          event.data.type === "sim-java-motor-busy-response" ||
          event.data.type === "sim-java-gamepad-response" ||
          event.data.type === "sim-java-gamepad-float-response"
        ) {
          return;
        }

        if (event.data.type !== "sim-java-run-demo") {
          return;
        }

        const files = event.data.files || [];
        const mainClassName = event.data.mainClassName;
        opModeActive = false;
        hasPendingStart = false;
        startResolver = null;
        setStatus("Compiling Java demo…");
        notifyParent("sim-java-log", { message: "Compiling Java bridge demo..." });

        try {
          const encoder = new TextEncoder();
          for (const file of files) {
            cheerpOSAddStringFile("/str/" + file.name, encoder.encode(file.content));
          }

          const toolsJarPath = await detectToolsJarPath();
          if (!toolsJarPath) {
            setStatus("Compiler runtime missing");
            notifyParent("sim-java-error", {
              message:
                "CheerpJ compiler runtime tools.jar could not be found at /app/tools.jar or /tools.jar.",
            });
            return;
          }

          notifyParent("sim-java-log", {
            message: "Using compiler runtime: " + toolsJarPath,
          });

          const classPath = toolsJarPath + ":/files/";
          const javaFiles = files.map((file) => "/str/" + file.name);
          const compileResult = await cheerpjRunMain(
            "com.sun.tools.javac.Main",
            classPath,
            ...javaFiles,
            "-d",
            "/files/",
            "-Xlint"
          );

          if (compileResult !== 0) {
            setStatus("Compilation failed");
            notifyParent("sim-java-error", {
              message:
                "Java demo compilation failed inside CheerpJ. javac exit code: " +
                String(compileResult),
            });
            return;
          }

          setStatus("Running Java demo…");
          notifyParent("sim-java-log", { message: "Running Java bridge demo..." });
          await cheerpjRunMain("simulator.launcher.Main", classPath, mainClassName);
          opModeActive = false;
          setStatus("Java demo complete");
          notifyParent("sim-java-complete", {});
        } catch (error) {
          opModeActive = false;
          setStatus("Java demo failed");
          notifyParent("sim-java-error", {
            message: error && error.message ? error.message : String(error),
          });
        }
      });

      init();
    </script>
  </body>
</html>`;

export default function SimulatorJavaHarness({
  bridge,
  editorHeight,
  onEditorResizeStart,
  gamepadState,
  onDriverStationModelChange,
}: SimulatorJavaHarnessProps) {
  const editorRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollConsoleRef = useRef(true);
  const [status, setStatus] = useState<HarnessStatus>("loading");
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [files, setFiles] = useState<HarnessFile[]>(() => createAutonomousTemplate());
  const [activeFileId, setActiveFileId] = useState("1");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [selectedRunClassName, setSelectedRunClassName] = useState<string | null>(null);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [editorWidth, setEditorWidth] = useState(500);
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [logEntries, setLogEntries] = useState<HarnessLogEntry[]>([
    { id: 1, tone: "default", message: "Preparing runtime..." },
  ]);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? files[0],
    [activeFileId, files]
  );
  const detectedOpModes = useMemo(() => detectOpModes(files), [files]);
  const detectedOpModeType = useMemo(() => detectUserOpModeType(files), [files]);
  const selectedOpMode = useMemo(
    () =>
      detectedOpModes.find((opMode) => opMode.className === selectedRunClassName) ??
      detectedOpModes[0] ??
      null,
    [detectedOpModes, selectedRunClassName]
  );

  const appendLog = useCallback((message: string, tone: HarnessLogEntry["tone"] = "default") => {
    setLogEntries((previousEntries) => [
      ...previousEntries,
      {
        id: previousEntries.length + 1,
        tone,
        message,
      },
    ].slice(-10));
  }, []);

  const clearConsole = useCallback(() => {
    setLogEntries([]);
  }, []);

  const refreshRuntime = useCallback(() => {
    setStatus("loading");
    setAwaitingStart(false);
    setPendingRun(false);
    setRuntimeKey((previousValue) => previousValue + 1);
    appendLog("Refreshing runtime...");
  }, [appendLog]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !event.data?.type) {
        return;
      }

      switch (event.data.type) {
        case "sim-java-ready":
          setStatus("ready");
          setIsCompiling(false);
          appendLog("Runtime ready.", "success");
          break;
        case "sim-java-log":
          appendLog(String(event.data.message));
          break;
        case "sim-java-waiting-for-start":
          setStatus("ready");
          setAwaitingStart(true);
          setIsCompiling(false);
          appendLog("Code loaded. Waiting for start.", "success");
          break;
        case "sim-java-started":
          setStatus("running");
          setAwaitingStart(false);
          setIsCompiling(false);
          appendLog("Run started.", "success");
          break;
        case "sim-java-motor-power":
          bridge.setMotorPower(String(event.data.deviceName), Number(event.data.power));
          break;
        case "sim-java-motor-position-request":
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "sim-java-motor-position-response",
              requestId: String(event.data.requestId),
              position: bridge.getMotorCurrentPosition(String(event.data.deviceName)),
            },
            "*"
          );
          break;
        case "sim-java-set-motor-target-position":
          bridge.setMotorTargetPosition(
            String(event.data.deviceName),
            Number(event.data.targetTicks)
          );
          break;
        case "sim-java-set-motor-mode":
          bridge.setMotorMode(
            String(event.data.deviceName),
            String(event.data.mode) as
              | "RUN_WITHOUT_ENCODER"
              | "RUN_TO_POSITION"
              | "STOP_AND_RESET_ENCODER"
          );
          break;
        case "sim-java-motor-busy-request":
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "sim-java-motor-busy-response",
              requestId: String(event.data.requestId),
              busy: bridge.isMotorBusy(String(event.data.deviceName)),
            },
            "*"
          );
          break;
        case "sim-java-gamepad-request":
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "sim-java-gamepad-response",
              requestId: String(event.data.requestId),
              value: Boolean(
                gamepadState.buttons[
                  String(event.data.controlName) as keyof typeof gamepadState.buttons
                ]
              ),
            },
            "*"
          );
          break;
        case "sim-java-gamepad-float-request":
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "sim-java-gamepad-float-response",
              requestId: String(event.data.requestId),
              value: Number(
                gamepadState.axes[
                  String(event.data.controlName) as keyof typeof gamepadState.axes
                ] ?? 0
              ),
            },
            "*"
          );
          break;
        case "sim-java-servo-position":
          bridge.setServoPosition(String(event.data.deviceName), Number(event.data.position));
          break;
        case "sim-java-telemetry":
          bridge.addTelemetry(String(event.data.caption), String(event.data.value));
          break;
        case "sim-java-complete":
          setStatus("ready");
          setAwaitingStart(false);
          setPendingRun(false);
          setIsCompiling(false);
          appendLog("Run complete.", "success");
          break;
        case "sim-java-error":
          setStatus("error");
          setAwaitingStart(false);
          setPendingRun(false);
          setIsCompiling(false);
          appendLog(String(event.data.message), "error");
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [appendLog, bridge, gamepadState]);

  useEffect(() => {
    if (detectedOpModes.length === 0) {
      if (selectedRunClassName !== null) {
        setSelectedRunClassName(null);
      }
      return;
    }

    if (
      selectedRunClassName &&
      detectedOpModes.some((opMode) => opMode.className === selectedRunClassName)
    ) {
      return;
    }

    setSelectedRunClassName(detectedOpModes[0].className);
  }, [detectedOpModes, selectedRunClassName]);

  const postRunDemo = useCallback(() => {
    if (!iframeRef.current?.contentWindow) {
      appendLog("Harness iframe is not ready yet.", "error");
      return;
    }

    if (!selectedOpMode) {
      appendLog("No runnable TeleOp or Autonomous class found.", "error");
      return;
    }

    setStatus("running");
    setAwaitingStart(false);
    setPendingRun(false);
    setIsCompiling(true);
    bridge.reset();
    appendLog(`Compiling and starting ${selectedOpMode.fileName}...`);
    iframeRef.current.contentWindow.postMessage(
      {
        type: "sim-java-run-demo",
        files: [
          ...createSupportFiles(),
          ...files.map(({ name, content }) => ({ name, content })),
        ],
        mainClassName: selectedOpMode.className,
      },
      "*"
    );
  }, [appendLog, bridge, files, selectedOpMode]);

  const runDemo = useCallback(() => {
    if (status === "loading") {
      setPendingRun(true);
      appendLog("Runtime is still loading. Your run will start automatically.");
      return;
    }

    if (status === "running") {
      appendLog("A run is already in progress.");
      return;
    }

    postRunDemo();
  }, [appendLog, postRunDemo, status]);

  useEffect(() => {
    if (status === "ready" && pendingRun) {
      postRunDemo();
    }
  }, [pendingRun, postRunDemo, status]);

  const startOpMode = useCallback(() => {
    if (!iframeRef.current?.contentWindow) {
      appendLog("Harness iframe is not ready yet.", "error");
      return;
    }

    appendLog("Starting...");
    iframeRef.current.contentWindow.postMessage(
      {
        type: "sim-java-start-opmode",
      },
      "*"
    );
  }, [appendLog]);

  const stopOpMode = useCallback(() => {
    if (!iframeRef.current?.contentWindow) {
      appendLog("Harness iframe is not ready yet.", "error");
      return;
    }

    setAwaitingStart(false);
    setPendingRun(false);
    setIsCompiling(false);
    appendLog("Stopping...");
    iframeRef.current.contentWindow.postMessage(
      {
        type: "sim-java-stop-opmode",
      },
      "*"
    );
  }, [appendLog]);

  const loadTeleOpTemplate = useCallback(() => {
    const result = addFilesWithoutReplacing(files, createTeleOpTemplate());
    setFiles(result.files);

    if (result.addedFile) {
      setActiveFileId(result.addedFile.id);
      setSelectedRunClassName(detectOpModes([result.addedFile])[0]?.className ?? null);
      appendLog("TeleOp template opened in a new tab.", "success");
      return;
    }

    appendLog("TeleOp template is already open.", "default");
  }, [appendLog, files]);

  const loadAutonomousTemplate = useCallback(() => {
    const result = addFilesWithoutReplacing(files, createAutonomousTemplate());
    setFiles(result.files);

    if (result.addedFile) {
      setActiveFileId(result.addedFile.id);
      setSelectedRunClassName(detectOpModes([result.addedFile])[0]?.className ?? null);
      appendLog("Autonomous template opened in a new tab.", "success");
      return;
    }

    appendLog("Autonomous template is already open.", "default");
  }, [appendLog, files]);

  const handleFileChange = useCallback((nextContent: string) => {
    setIsDirty((previousDirty) => ({
      ...previousDirty,
      [activeFileId]: true,
    }));
    setFiles((previousFiles) =>
      previousFiles.map((file) =>
        file.id === activeFileId ? { ...file, content: nextContent } : file
      )
    );
  }, [activeFileId]);

  const addFile = useCallback(() => {
    const nextFile = createNewJavaFile(files.length + 1);
    setFiles((previousFiles) => [...previousFiles, nextFile]);
    setActiveFileId(nextFile.id);
    setIsDirty((previousDirty) => ({
      ...previousDirty,
      [nextFile.id]: true,
    }));
    appendLog(`Added ${nextFile.name}.`, "success");
  }, [appendLog, files.length]);

  const removeFile = useCallback((fileId: string) => {
    if (files.length <= 1) {
      appendLog("At least one file is required.", "error");
      return;
    }

    const fileToRemove = files.find((file) => file.id === fileId);
    if (!fileToRemove) {
      return;
    }

    const remainingFiles = files.filter((file) => file.id !== fileId);
    setFiles(remainingFiles);
    setIsDirty((previousDirty) => {
      const nextDirty = { ...previousDirty };
      delete nextDirty[fileId];
      return nextDirty;
    });

    if (activeFileId === fileId) {
      setActiveFileId(remainingFiles[0]?.id ?? "");
    }

    appendLog(`Removed ${fileToRemove.name}.`, "success");
  }, [activeFileId, appendLog, files]);

  const startRenamingFile = useCallback((fileId: string) => {
    const fileToRename = files.find((file) => file.id === fileId);
    if (!fileToRename) {
      return;
    }

    setRenamingFileId(fileId);
    setRenameDraft(fileToRename.name);
  }, [files]);

  const cancelRenamingFile = useCallback(() => {
    setRenamingFileId(null);
    setRenameDraft("");
  }, []);

  const commitRenameFile = useCallback((fileId: string) => {
    const fileToRename = files.find((file) => file.id === fileId);
    if (!fileToRename) {
      cancelRenamingFile();
      return;
    }

    const nextFileName = normalizeJavaFileName(renameDraft);
    const nameTaken = files.some(
      (file) => file.id !== fileId && file.name.toLowerCase() === nextFileName.toLowerCase()
    );

    if (nameTaken) {
      appendLog(`${nextFileName} is already open.`, "error");
      return;
    }

    setFiles((previousFiles) =>
      previousFiles.map((file) =>
        file.id === fileId
          ? {
              ...file,
              name: nextFileName,
              content: renameJavaClassIfNeeded(file.content, file.name, nextFileName),
            }
          : file
      )
    );
    setIsDirty((previousDirty) => ({
      ...previousDirty,
      [fileId]: true,
    }));
    setRenamingFileId(null);
    setRenameDraft("");
    appendLog(`Renamed ${fileToRename.name} to ${nextFileName}.`, "success");
  }, [appendLog, cancelRenamingFile, files, renameDraft]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging.current) {
      return;
    }

    const nextWidth = dragStartWidth.current + (event.clientX - dragStartX.current);
    const minWidth = 300;
    const maxWidth = window.innerWidth - 400;
    setEditorWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current = editorWidth;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [editorWidth, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!editorRef.current?.editor) {
      return;
    }

    editorRef.current.editor.setOptions({
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: true,
      showLineNumbers: true,
      showGutter: true,
      fontSize: 14,
      tabSize: 2,
      highlightActiveLine: true,
      highlightGutterLine: true,
      showPrintMargin: false,
      scrollPastEnd: 0.5,
      useSoftTabs: true,
      useWorker: false,
      wrap: true,
      wrapMethod: "text",
      indentedSoftWrap: true,
    });
  }, [activeFileId]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const consoleElement = consoleRef.current;
    if (!consoleElement) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom =
        consoleElement.scrollHeight - consoleElement.scrollTop - consoleElement.clientHeight;
      shouldAutoScrollConsoleRef.current = distanceFromBottom < 24;
    };

    handleScroll();
    consoleElement.addEventListener("scroll", handleScroll);

    return () => {
      consoleElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollConsoleRef.current) {
      return;
    }

    const consoleElement = consoleRef.current;
    if (!consoleElement) {
      return;
    }

    consoleElement.scrollTop = consoleElement.scrollHeight;
  }, [logEntries]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "loading":
        return "Loading";
      case "ready":
        return awaitingStart ? "Waiting to start" : "Ready";
      case "running":
        return "Running";
      case "error":
        return "Error";
    }
  }, [awaitingStart, status]);

  useEffect(() => {
    onDriverStationModelChange?.({
      status,
      awaitingStart,
      isCompiling,
      opModes: detectedOpModes.map((opMode) => ({
        id: opMode.className,
        fileName: opMode.fileName,
        type: opMode.type,
      })),
      selectedOpModeId: selectedOpMode?.className ?? null,
      onSelectOpModeId: setSelectedRunClassName,
      onInitialize: runDemo,
      onStart: startOpMode,
      onStop: stopOpMode,
    });
  }, [
    awaitingStart,
    detectedOpModes,
    isCompiling,
    onDriverStationModelChange,
    runDemo,
    selectedOpMode,
    startOpMode,
    status,
    stopOpMode,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-none bg-[#1E1E1E] text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 bg-[#1e1f1c] px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-gray-400">JAVA</div>
          {isDirty[activeFileId] ? (
            <div className="text-sm text-yellow-400">• Modified</div>
          ) : null}
          <span className="text-sm text-zinc-500">{statusLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadAutonomousTemplate}
            className="bg-zinc-800 text-white hover:bg-zinc-700"
          >
            Autonomous Template
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={loadTeleOpTemplate}
            className="bg-zinc-800 text-white hover:bg-zinc-700"
          >
            TeleOp Template
          </Button>
          <Button
            variant="outline"
            onClick={addFile}
            className="border-gray-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
          >
            New File
          </Button>
          {status !== "ready" ? (
            <Button
              variant="outline"
              onClick={refreshRuntime}
              className="border-gray-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
              title="Refresh the editor runtime"
            >
              Refresh editor
            </Button>
          ) : null}
        </div>
      </div>

      <iframe
        key={runtimeKey}
        ref={iframeRef}
        srcDoc={HARNESS_HTML}
        title="Simulator Runtime"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap border-b border-gray-700 bg-[#1e1f1c]">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center border-r border-gray-700 text-sm ${
                activeFile?.id === file.id
                  ? "bg-[#272822] text-white"
                  : "text-gray-400 hover:bg-[#2d2e28] hover:text-white"
              }`}
            >
              {renamingFileId === file.id ? (
                <input
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={() => commitRenameFile(file.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRenameFile(file.id);
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRenamingFile();
                    }
                  }}
                  autoFocus
                  className="min-w-[180px] bg-transparent px-4 py-2 text-white outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveFileId(file.id)}
                  onDoubleClick={() => startRenamingFile(file.id)}
                  className="flex items-center gap-2 px-4 py-2"
                  title="Double-click to rename"
                >
                  <span>{file.name}</span>
                  {isDirty[file.id] ? <span className="text-yellow-400">•</span> : null}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="px-2 py-2 text-xs text-gray-500 transition-colors hover:text-white"
                aria-label={`Close ${file.name}`}
                title={`Close ${file.name}`}
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFile}
            className="px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-[#2d2e28] hover:text-white"
          >
            + New File
          </button>
        </div>

        <div className="relative min-h-[320px] flex-1" style={{ height: `${editorHeight}px` }}>
          {activeFile ? (
            <AceEditor
              ref={editorRef}
              mode="java"
              theme="monokai"
              name="simulator-java-workbench"
              value={activeFile.content}
              onChange={handleFileChange}
              width="100%"
              height="100%"
              setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                showLineNumbers: true,
                showGutter: true,
                fontSize: 14,
                tabSize: 2,
                highlightActiveLine: true,
                highlightGutterLine: true,
                showPrintMargin: false,
                useSoftTabs: true,
                useWorker: false,
                wrap: true,
                wrapMethod: "text",
                indentedSoftWrap: true,
              }}
            />
          ) : null}
        </div>

        <div className="border-t border-gray-700">
          <div className="flex items-center justify-between border-b border-gray-700 bg-[#1e1f1c] px-4 py-2">
            <div className="text-sm text-gray-300">Console</div>
            <div className="flex items-center gap-2">
              {status === "running" ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500" />
                  <span className="text-sm text-gray-400">Running...</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={clearConsole}
                className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>

          <div
            ref={consoleRef}
            className="h-28 overflow-auto bg-[#272822] p-4 font-mono text-sm whitespace-pre-wrap"
          >
            {logEntries.length === 0 ? (
              <div className="text-zinc-500">Console cleared.</div>
            ) : (
              <div className="space-y-2">
                {logEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.tone === "error"
                        ? "text-rose-300"
                        : entry.tone === "success"
                          ? "text-emerald-300"
                          : "text-green-400"
                    }
                  >
                    {entry.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-700 bg-[#1e1f1c] px-4 py-1 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div>UTF-8</div>
            <div>JAVA</div>
          </div>
          <div>{activeFile?.name ?? "No file selected"}</div>
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={onEditorResizeStart}
          className="group flex h-4 cursor-row-resize items-center justify-center border-t border-white/10 bg-black"
        >
          <div className="h-1 w-14 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-600" />
        </div>
      </div>
    </div>
  );
}
