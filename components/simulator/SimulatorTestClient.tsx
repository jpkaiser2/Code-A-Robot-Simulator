"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { Button } from "@/components/ui/button";
import F310Gamepad, { type F310State } from "@/components/simulator/F310Gamepad";
import {
  createSimulatorBridge,
  createSimulatorStore,
  type SimulatorBridge,
  type SimulatorState,
} from "@/lib/simulator/mechanismSimulator";

const SimulatorJavaHarness = dynamic(
  () => import("@/components/simulator/SimulatorJavaHarness"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[640px] items-center justify-center border-r border-white/10 bg-black text-sm text-zinc-500">
        Loading editor
      </div>
    ),
  }
);

declare global {
  interface Window {
    codeARobotSimulator?: SimulatorBridge;
  }
}

const GAMEPAD_CONFLICTS: Record<string, string[]> = {
  a: ["y"],
  y: ["a"],
  left_bumper: ["right_bumper"],
  right_bumper: ["left_bumper"],
  dpad_up: ["dpad_down"],
  dpad_down: ["dpad_up"],
  dpad_left: ["dpad_right"],
  dpad_right: ["dpad_left"],
};

function createDefaultGamepadState(): F310State {
  return {
    buttons: {
      a: false,
      b: false,
      x: false,
      y: false,
      dpad_up: false,
      dpad_down: false,
      dpad_left: false,
      dpad_right: false,
      left_bumper: false,
      right_bumper: false,
      left_stick_button: false,
      right_stick_button: false,
      back: false,
      start: false,
      guide: false,
    },
    axes: {
      left_stick_x: 0,
      left_stick_y: 0,
      right_stick_x: 0,
      right_stick_y: 0,
      left_trigger: 0,
      right_trigger: 0,
    },
  };
}

function useSimulatorSnapshot() {
  const storeRef = useRef(createSimulatorStore());
  const bridgeRef = useRef(createSimulatorBridge(storeRef.current));
  const [snapshot, setSnapshot] = useState<SimulatorState>(storeRef.current.getState());

  useEffect(() => {
    return storeRef.current.subscribe(() => {
      setSnapshot(storeRef.current.getState());
    });
  }, []);

  return {
    bridge: bridgeRef.current,
    snapshot,
    store: storeRef.current,
  };
}

export default function SimulatorTestClient() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLElement | null>(null);
  const { bridge, snapshot, store } = useSimulatorSnapshot();
  const [leftPaneWidth, setLeftPaneWidth] = useState(40);
  const [middlePaneWidth, setMiddlePaneWidth] = useState(24);
  const [editorHeight, setEditorHeight] = useState(520);
  const [simulatorHeight, setSimulatorHeight] = useState(520);
  const [gamepadState, setGamepadState] = useState<F310State>(() => createDefaultGamepadState());

  const startLeftResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!layoutRef.current) {
      return;
    }

    event.preventDefault();
    const bounds = layoutRef.current.getBoundingClientRect();

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setLeftPaneWidth(Math.min(58, Math.max(22, nextWidth)));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, []);

  const startMiddleResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!layoutRef.current) {
      return;
    }

    event.preventDefault();
    const bounds = layoutRef.current.getBoundingClientRect();

    const handleMove = (moveEvent: PointerEvent) => {
      const pointerWidth = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      const minBoundary = leftPaneWidth + 16;
      const maxBoundary = 78;
      const clampedBoundary = Math.min(maxBoundary, Math.max(minBoundary, pointerWidth));
      setMiddlePaneWidth(clampedBoundary - leftPaneWidth);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [leftPaneWidth]);

  const startEditorResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = editorHeight;

    const handleMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY);
      setEditorHeight(Math.min(900, Math.max(280, nextHeight)));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [editorHeight]);

  const startSimulatorResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = simulatorHeight;
    const maxHeight = rightPaneRef.current
      ? Math.max(320, rightPaneRef.current.getBoundingClientRect().height - 110)
      : 900;

    const handleMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY);
      setSimulatorHeight(Math.min(maxHeight, Math.max(280, nextHeight)));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [simulatorHeight]);

  const setGamepadButtonState = useCallback((controlName: string, nextValue: boolean) => {
    setGamepadState((previousState) => {
      const nextState = {
        ...previousState,
        buttons: {
          ...previousState.buttons,
          [controlName]: nextValue,
        },
      };

      if (nextValue) {
        for (const conflictingControl of GAMEPAD_CONFLICTS[controlName] ?? []) {
          nextState.buttons[conflictingControl as keyof typeof nextState.buttons] = false;
        }
      }

      return nextState;
    });
  }, []);

  const setGamepadAxisState = useCallback(
    (
      axisName:
        | "left_stick_x"
        | "left_stick_y"
        | "right_stick_x"
        | "right_stick_y"
        | "left_trigger"
        | "right_trigger",
      nextValue: number
    ) => {
      setGamepadState((previousState) => ({
        ...previousState,
        axes: {
          ...previousState.axes,
          [axisName]: nextValue,
        },
      }));
    },
    []
  );

  const clearGamepad = useCallback(() => {
    setGamepadState(createDefaultGamepadState());
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 12, 48);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(7.5, 6.2, 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 4;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.48;

    const hemiLight = new THREE.HemisphereLight("#f5f5f5", "#111111", 1.2);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight("#ffffff", 1.35);
    sunLight.position.set(6, 10, 4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.25, 10.5),
      new THREE.MeshStandardMaterial({
        color: "#111111",
        metalness: 0.08,
        roughness: 0.92,
      })
    );
    floor.receiveShadow = true;
    floor.position.y = -0.125;
    scene.add(floor);

    const grid = new THREE.GridHelper(10, 10, "#2f2f2f", "#1a1a1a");
    grid.position.y = 0.01;
    scene.add(grid);

    const fieldBorder = new THREE.Mesh(
      new THREE.BoxGeometry(10.7, 0.18, 10.7),
      new THREE.MeshStandardMaterial({
        color: "#090909",
        metalness: 0.14,
        roughness: 0.88,
      })
    );
    fieldBorder.receiveShadow = true;
    fieldBorder.position.y = -0.24;
    scene.add(fieldBorder);

    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.32, 1.55),
      new THREE.MeshStandardMaterial({
        color: "#3a3a3a",
        metalness: 0.18,
        roughness: 0.78,
      })
    );
    chassis.position.y = 0.36;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    robotRoot.add(chassis);

    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(1.84, 0.18, 1.69),
      new THREE.MeshStandardMaterial({
        color: "#191919",
        metalness: 0.08,
        roughness: 0.92,
      })
    );
    bumper.position.y = 0.28;
    bumper.castShadow = true;
    bumper.receiveShadow = true;
    robotRoot.add(bumper);

    const wheelGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 24);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: "#020617",
      metalness: 0.12,
      roughness: 0.84,
    });
    const wheelOffsets: Array<[number, number]> = [
      [-0.92, 0.62],
      [0.92, 0.62],
      [-0.92, -0.62],
      [0.92, -0.62],
    ];
    wheelOffsets.forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      wheel.castShadow = true;
      robotRoot.add(wheel);
    });

    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(0, 0.52, 0);
    robotRoot.add(shoulderPivot);

    const shoulderJoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 1.1, 20),
      new THREE.MeshStandardMaterial({ color: "#bdbdbd", metalness: 0.35, roughness: 0.45 })
    );
    shoulderJoint.rotation.z = Math.PI / 2;
    shoulderJoint.castShadow = true;
    shoulderPivot.add(shoulderJoint);

    const armRoot = new THREE.Group();
    shoulderPivot.add(armRoot);

    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 2.4, 0.45),
      new THREE.MeshStandardMaterial({ color: "#d4d4d4", metalness: 0.18, roughness: 0.5 })
    );
    upperArm.position.y = 1.2;
    upperArm.castShadow = true;
    armRoot.add(upperArm);

    const wristMount = new THREE.Group();
    wristMount.position.y = 2.38;
    armRoot.add(wristMount);

    const wristBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.32, 0.55),
      new THREE.MeshStandardMaterial({ color: "#8a8a8a", metalness: 0.18, roughness: 0.45 })
    );
    wristBlock.castShadow = true;
    wristMount.add(wristBlock);

    const leftFinger = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.62, 0.18),
      new THREE.MeshStandardMaterial({ color: "#efefef", metalness: 0.08, roughness: 0.45 })
    );
    leftFinger.position.set(-0.16, 0.48, 0);
    leftFinger.castShadow = true;
    wristMount.add(leftFinger);

    const rightFinger = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.62, 0.18),
      new THREE.MeshStandardMaterial({ color: "#efefef", metalness: 0.08, roughness: 0.45 })
    );
    rightFinger.position.set(0.16, 0.48, 0);
    rightFinger.castShadow = true;
    wristMount.add(rightFinger);

    let frameId = 0;
    let previousTime = performance.now();

    const applyStateToMeshes = (state: SimulatorState) => {
      robotRoot.position.set(state.robotX, 0, state.robotY);
      robotRoot.rotation.y = THREE.MathUtils.degToRad(state.robotHeadingDeg);
      armRoot.rotation.z = THREE.MathUtils.degToRad(state.armAngleDeg);
      const clawSpread = 0.12 + state.clawOpenAmount * 0.28;
      leftFinger.position.x = -clawSpread;
      rightFinger.position.x = clawSpread;
      controls.target.lerp(
        new THREE.Vector3(state.robotX, 0.9, state.robotY),
        0.12
      );
    };

    const handleResize = () => {
      if (!mountRef.current) {
        return;
      }

      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    const tick = (time: number) => {
      const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      store.step(deltaSeconds);
      applyStateToMeshes(store.getState());
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };

    applyStateToMeshes(store.getState());
    handleResize();
    window.addEventListener("resize", handleResize);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [store]);

  useEffect(() => {
    window.codeARobotSimulator = bridge;
    window.dispatchEvent(
      new CustomEvent("codearobot:simulator-ready", {
        detail: { bridge },
      })
    );

    const unsubscribe = store.subscribe(() => {
      window.dispatchEvent(
        new CustomEvent("codearobot:simulator-state-changed", {
          detail: { state: store.getState() },
        })
      );
    });

    return () => {
      unsubscribe();
      if (window.codeARobotSimulator === bridge) {
        delete window.codeARobotSimulator;
      }
    };
  }, [bridge, store]);

  return (
    <div className="bg-black text-white">
      <div
        ref={layoutRef}
        className="flex min-h-[calc(100vh-4rem)] flex-col xl:flex-row"
      >
        <section
          className="flex min-h-[50vh] w-full min-w-0 flex-col border-b border-white/10 bg-black xl:min-h-[calc(100vh-4rem)] xl:w-auto xl:border-b-0 xl:shrink-0"
          style={{ flexBasis: `${leftPaneWidth}%` }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Simulator Test
              </p>
            </div>
            <div
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                snapshot.status === "running"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-zinc-300"
              }`}
            >
              {snapshot.status === "running" ? "Running" : "Ready"}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <SimulatorJavaHarness
              bridge={bridge}
              editorHeight={editorHeight}
              onEditorResizeStart={startEditorResize}
              gamepadState={gamepadState}
            />
          </div>
        </section>

        <div
          onPointerDown={startLeftResize}
          className="group hidden w-4 cursor-col-resize items-center justify-center border-x border-white/10 bg-black xl:flex"
          role="separator"
          aria-orientation="vertical"
        >
          <div className="h-14 w-1 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-600" />
        </div>

        <section
          className="flex min-h-[40vh] w-full min-w-0 flex-col border-b border-white/10 bg-[#030303] xl:min-h-[calc(100vh-4rem)] xl:w-auto xl:shrink-0 xl:border-b-0"
          style={{ flexBasis: `${middlePaneWidth}%` }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <p className="mb-0 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Controller
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 bg-transparent text-zinc-100 hover:bg-zinc-900"
              onClick={clearGamepad}
            >
              Clear
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
            <F310Gamepad
              state={gamepadState}
              onAxisChange={setGamepadAxisState}
              onButtonChange={setGamepadButtonState}
            />
          </div>
        </section>

        <div
          onPointerDown={startMiddleResize}
          className="group hidden w-4 cursor-col-resize items-center justify-center border-x border-white/10 bg-black xl:flex"
          role="separator"
          aria-orientation="vertical"
        >
          <div className="h-14 w-1 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-600" />
        </div>

        <section
          ref={rightPaneRef}
          className="flex min-h-[50vh] min-w-0 flex-1 flex-col bg-[#050505] xl:min-h-[calc(100vh-4rem)]"
        >
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Simulator
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                Arm {snapshot.armAngleDeg.toFixed(0)} deg
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                Claw {snapshot.clawOpenAmount.toFixed(2)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                {snapshot.elapsedSeconds.toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="min-h-0">
            <div className="relative min-h-[320px]" style={{ height: `${simulatorHeight}px` }}>
              <div ref={mountRef} className="h-full w-full" />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-2 p-4 text-xs text-zinc-300">
                <div className="rounded-full border border-white/10 bg-black/70 px-3 py-1 backdrop-blur">
                  X {snapshot.robotX.toFixed(2)}
                </div>
                <div className="rounded-full border border-white/10 bg-black/70 px-3 py-1 backdrop-blur">
                  Y {snapshot.robotY.toFixed(2)}
                </div>
                <div className="rounded-full border border-white/10 bg-black/70 px-3 py-1 backdrop-blur">
                  Heading {snapshot.robotHeadingDeg.toFixed(0)} deg
                </div>
              </div>
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              onPointerDown={startSimulatorResize}
              className="group flex h-4 cursor-row-resize items-center justify-center border-y border-white/10 bg-black"
            >
              <div className="h-1 w-14 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-600" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
