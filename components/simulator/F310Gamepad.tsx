"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type GamepadButtonKey =
  | "a"
  | "b"
  | "x"
  | "y"
  | "dpad_up"
  | "dpad_down"
  | "dpad_left"
  | "dpad_right"
  | "left_bumper"
  | "right_bumper"
  | "left_stick_button"
  | "right_stick_button"
  | "back"
  | "start"
  | "guide";

type GamepadAxisKey =
  | "left_stick_x"
  | "left_stick_y"
  | "right_stick_x"
  | "right_stick_y"
  | "left_trigger"
  | "right_trigger";

export interface F310State {
  buttons: Record<GamepadButtonKey, boolean>;
  axes: Record<GamepadAxisKey, number>;
}

interface F310GamepadProps {
  onAxisChange: (axis: GamepadAxisKey, value: number) => void;
  onButtonChange: (button: GamepadButtonKey, value: boolean) => void;
  state: F310State;
}

type InteractiveTarget =
  | { kind: "button"; button: GamepadButtonKey }
  | { kind: "trigger"; axis: "left_trigger" | "right_trigger" }
  | { kind: "stick"; stick: "left" | "right" }
  | { kind: "dpad" };

type DragState =
  | { kind: "button"; button: GamepadButtonKey; pointerId: number }
  | { kind: "trigger"; axis: "left_trigger" | "right_trigger"; pointerId: number }
  | {
      kind: "stick";
      pointerId: number;
      startX: number;
      startY: number;
      stick: "left" | "right";
    }
  | { kind: "dpad"; pointerId: number };

type MeshStateRecord = {
  mesh: THREE.Mesh;
  target: InteractiveTarget;
};

type StickTransformRecord = {
  mesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DPAD_BUTTONS: GamepadButtonKey[] = ["dpad_up", "dpad_down", "dpad_left", "dpad_right"];

const INTERACTIVE_MESH_MAP: Record<string, InteractiveTarget> = {
  empty_2: { kind: "trigger", axis: "left_trigger" },
  empty_3: { kind: "button", button: "right_bumper" },
  empty_4: { kind: "button", button: "left_bumper" },
  empty_5: { kind: "button", button: "y" },
  empty_6: { kind: "button", button: "b" },
  empty_8: { kind: "button", button: "guide" },
  empty_9: { kind: "stick", stick: "left" },
  empty_10: { kind: "button", button: "x" },
  empty_11: { kind: "stick", stick: "right" },
  empty_12: { kind: "button", button: "back" },
  empty_13: { kind: "button", button: "a" },
  empty_15: { kind: "trigger", axis: "right_trigger" },
  empty_16: { kind: "button", button: "start" },
  empty_17: { kind: "dpad" },
};

function clearDpad(onButtonChange: F310GamepadProps["onButtonChange"]) {
  DPAD_BUTTONS.forEach((button) => onButtonChange(button, false));
}

function setDpadFromLocalPoint(
  mesh: THREE.Mesh,
  point: THREE.Vector3,
  onButtonChange: F310GamepadProps["onButtonChange"]
) {
  clearDpad(onButtonChange);

  mesh.geometry.computeBoundingBox();
  const boundsCenter = mesh.geometry.boundingBox?.getCenter(new THREE.Vector3());
  const horizontal = point.x - (boundsCenter?.x ?? 0);
  const vertical = point.y - (boundsCenter?.y ?? 0);

  if (Math.abs(horizontal) > Math.abs(vertical)) {
    onButtonChange(horizontal > 0 ? "dpad_right" : "dpad_left", true);
    return;
  }

  onButtonChange(vertical > 0 ? "dpad_up" : "dpad_down", true);
}

function getStickAxesFromPointerDelta(deltaX: number, deltaY: number) {
  const radius = 34;
  const rawX = clamp(deltaX / radius, -1, 1);
  const rawY = clamp(deltaY / radius, -1, 1);
  const magnitude = Math.hypot(rawX, rawY);

  if (magnitude <= 1) {
    return { x: rawX, y: rawY };
  }

  return {
    x: rawX / magnitude,
    y: rawY / magnitude,
  };
}

function isMeshStandardMaterial(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return "emissive" in material && "emissiveIntensity" in material;
}

function anchorStickMeshAtSocket(mesh: THREE.Mesh) {
  const nextGeometry = mesh.geometry.clone();
  nextGeometry.computeBoundingBox();

  if (!nextGeometry.boundingBox) {
    mesh.geometry = nextGeometry;
    return;
  }

  const bounds = nextGeometry.boundingBox;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const pivot = new THREE.Vector3(center.x, center.y, bounds.min.z + size.z * 0.18);

  nextGeometry.translate(-pivot.x, -pivot.y, -pivot.z);
  mesh.geometry.dispose();
  mesh.geometry = nextGeometry;
  mesh.position.copy(pivot);
}

function applyStickPose(
  stickRecord: StickTransformRecord | undefined,
  stickX: number,
  stickY: number,
  _pressed: boolean
) {
  if (!stickRecord) {
    return;
  }

  const maxTilt = THREE.MathUtils.degToRad(8);

  stickRecord.mesh.position.copy(stickRecord.basePosition);
  stickRecord.mesh.rotation.set(
    stickRecord.baseRotation.x + stickY * maxTilt,
    stickRecord.baseRotation.y + stickX * maxTilt,
    stickRecord.baseRotation.z
  );
}

export default function F310Gamepad({ onAxisChange, onButtonChange, state }: F310GamepadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const interactiveMeshesRef = useRef<MeshStateRecord[]>([]);
  const stickMeshMapRef = useRef<
    Partial<Record<"left" | "right", StickTransformRecord>>
  >({});
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let animationFrameId = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.4;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.006).texture;
    scene.environment = environmentMap;

    const camera = new THREE.OrthographicCamera(-3.6, 3.6, 2.8, -2.8, 0.1, 100);
    camera.position.set(0, 0, -8);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd7d7d2, 0.18));

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.78);
    frontLight.position.set(0.1, 1.35, 7.2);
    frontLight.castShadow = true;
    frontLight.shadow.mapSize.set(2048, 2048);
    frontLight.shadow.camera.near = 0.5;
    frontLight.shadow.camera.far = 20;
    frontLight.shadow.camera.left = -4;
    frontLight.shadow.camera.right = 4;
    frontLight.shadow.camera.top = 4;
    frontLight.shadow.camera.bottom = -4;
    frontLight.shadow.bias = -0.0002;
    scene.add(frontLight);

    const letteringLight = new THREE.DirectionalLight(0xfff7e8, 0.52);
    letteringLight.position.set(2.8, 2.2, 3.6);
    letteringLight.castShadow = true;
    letteringLight.shadow.mapSize.set(2048, 2048);
    letteringLight.shadow.camera.near = 0.5;
    letteringLight.shadow.camera.far = 12;
    letteringLight.shadow.camera.left = -3;
    letteringLight.shadow.camera.right = 3;
    letteringLight.shadow.camera.top = 3;
    letteringLight.shadow.camera.bottom = -3;
    letteringLight.shadow.bias = -0.00015;
    scene.add(letteringLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.28);
    keyLight.position.set(4.25, 2.8, 5.4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.06);
    fillLight.position.set(-4.5, 2.1, 4.2);
    scene.add(fillLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.05);
    topLight.position.set(0, 6.5, 1.5);
    scene.add(topLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.05);
    rimLight.position.set(0, -1.2, -4.5);
    scene.add(rimLight);

    const loader = new GLTFLoader();
    let mounted = true;
    let loadedObject: THREE.Object3D | null = null;

    const getInteractiveHit = (event: PointerEvent) => {
      if (!cameraRef.current || !rendererRef.current) {
        return null;
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, cameraRef.current);

      const intersections = raycasterRef.current.intersectObjects(
        interactiveMeshesRef.current.map((entry) => entry.mesh),
        false
      );

      if (intersections.length === 0) {
        return null;
      }

      const hit = intersections[0];
      const record = interactiveMeshesRef.current.find((entry) => entry.mesh === hit.object);

      if (!record) {
        return null;
      }

      return { hit, record };
    };

    const releaseDragState = () => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.kind === "button") {
        onButtonChange(dragState.button, false);
      } else if (dragState.kind === "trigger") {
        onAxisChange(dragState.axis, 0);
      } else if (dragState.kind === "stick") {
        const prefix = dragState.stick === "left" ? "left_stick" : "right_stick";
        onAxisChange(`${prefix}_x` as GamepadAxisKey, 0);
        onAxisChange(`${prefix}_y` as GamepadAxisKey, 0);
      } else if (dragState.kind === "dpad") {
        clearDpad(onButtonChange);
      }

      dragStateRef.current = null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const result = getInteractiveHit(event);

      if (!result) {
        releaseDragState();
        return;
      }

      const { hit, record } = result;
      renderer.domElement.setPointerCapture(event.pointerId);

      if (record.target.kind === "button") {
        onButtonChange(record.target.button, true);
        dragStateRef.current = {
          kind: "button",
          button: record.target.button,
          pointerId: event.pointerId,
        };
        return;
      }

      if (record.target.kind === "trigger") {
        onAxisChange(record.target.axis, 1);
        dragStateRef.current = {
          kind: "trigger",
          axis: record.target.axis,
          pointerId: event.pointerId,
        };
        return;
      }

      if (record.target.kind === "dpad") {
        const localPoint = record.mesh.worldToLocal(hit.point.clone());
        setDpadFromLocalPoint(record.mesh, localPoint, onButtonChange);
        dragStateRef.current = { kind: "dpad", pointerId: event.pointerId };
        return;
      }

      dragStateRef.current = {
        kind: "stick",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        stick: record.target.stick,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (dragState) {
        if (dragState.pointerId !== event.pointerId) {
          return;
        }

        if (dragState.kind === "stick") {
          const axes = getStickAxesFromPointerDelta(
            event.clientX - dragState.startX,
            event.clientY - dragState.startY
          );
          const prefix = dragState.stick === "left" ? "left_stick" : "right_stick";
          onAxisChange(`${prefix}_x` as GamepadAxisKey, axes.x);
          onAxisChange(`${prefix}_y` as GamepadAxisKey, axes.y);
          renderer.domElement.style.cursor = "grabbing";
          return;
        }

        if (dragState.kind === "dpad") {
          const result = getInteractiveHit(event);
          if (result?.record.target.kind === "dpad") {
            const localPoint = result.record.mesh.worldToLocal(result.hit.point.clone());
            setDpadFromLocalPoint(result.record.mesh, localPoint, onButtonChange);
          }
          renderer.domElement.style.cursor = "pointer";
          return;
        }

        renderer.domElement.style.cursor = "pointer";
        return;
      }

      renderer.domElement.style.cursor = getInteractiveHit(event) ? "pointer" : "default";
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      releaseDragState();
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      renderer.domElement.style.cursor = "default";
    };

    loader.load(
      "/Models/GamepadAssembly.glb",
      (gltf) => {
        if (!mounted) {
          return;
        }

        const object = gltf.scene;
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z) || 1;
        const scale = 4.6 / largestDimension;
        const outlineGroup = new THREE.Group();

        object.position.sub(center);
        object.scale.setScalar(scale);
        interactiveMeshesRef.current = [];
        stickMeshMapRef.current = {};

        object.traverse((child) => {
          const mesh = child as THREE.Mesh;

          if (!("isMesh" in mesh) || !mesh.isMesh) {
            return;
          }

          const target = INTERACTIVE_MESH_MAP[mesh.name];
          if (target?.kind === "stick") {
            anchorStickMeshAtSocket(mesh);
          }

          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const material = mesh.material;
          const meshBounds = new THREE.Box3().setFromObject(mesh);
          const meshSize = meshBounds.getSize(new THREE.Vector3());
          const meshLargestDimension = Math.max(meshSize.x, meshSize.y, meshSize.z);
          let skipOutline = false;

          const tuneMaterial = (item: THREE.Material) => {
            item.side = THREE.FrontSide;

            if ("envMapIntensity" in item) {
              item.envMapIntensity = 0.08;
            }

            if ("flatShading" in item) {
              item.flatShading = false;
            }

            if ("color" in item && item.color instanceof THREE.Color) {
              const hsl = { h: 0, s: 0, l: 0 };
              item.color.getHSL(hsl);
              if (hsl.s > 0.4 && hsl.l > 0.2) {
                skipOutline = true;
              }
            }

            if (isMeshStandardMaterial(item)) {
              item.userData.baseEmissive = item.emissive.clone();
              item.userData.baseEmissiveIntensity = item.emissiveIntensity;
            }

            item.needsUpdate = true;
          };

          if (Array.isArray(material)) {
            material.forEach((item) => {
              tuneMaterial(item);
            });
          } else if (material) {
            tuneMaterial(material);
          }

          if (target) {
            interactiveMeshesRef.current.push({ mesh, target });

            if (target.kind === "stick") {
              stickMeshMapRef.current[target.stick] = {
                mesh,
                basePosition: mesh.position.clone(),
                baseRotation: mesh.rotation.clone(),
              };
            }
          }

          if (!skipOutline) {
            const edgeThreshold = meshLargestDimension > largestDimension * 0.08 ? 22 : 30;
            const edges = new THREE.EdgesGeometry(mesh.geometry, edgeThreshold);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({
                color: 0x1f2937,
                transparent: true,
                opacity: meshLargestDimension > largestDimension * 0.18 ? 0.35 : 0.22,
              })
            );
            line.position.copy(mesh.position);
            line.quaternion.copy(mesh.quaternion);
            line.scale.copy(mesh.scale).multiplyScalar(1.0015);
            outlineGroup.add(line);
          }
        });

        scene.add(object);
        object.add(outlineGroup);
        loadedObject = object;
        frameObject();
        setLoadError(null);
      },
      undefined,
      (error) => {
        console.error("Failed to load simulator controller model", error);
        setLoadError("The controller model could not be loaded.");
      }
    );

    function applyInteractiveVisuals() {
      const currentState = stateRef.current;
      applyStickPose(
        stickMeshMapRef.current.left,
        currentState.axes.left_stick_x,
        currentState.axes.left_stick_y,
        currentState.buttons.left_stick_button
      );
      applyStickPose(
        stickMeshMapRef.current.right,
        currentState.axes.right_stick_x,
        currentState.axes.right_stick_y,
        currentState.buttons.right_stick_button
      );

      interactiveMeshesRef.current.forEach(({ mesh, target }) => {
        let active = false;

        if (target.kind === "button") {
          active = currentState.buttons[target.button];
        } else if (target.kind === "trigger") {
          active = currentState.axes[target.axis] > 0.05;
        } else if (target.kind === "stick") {
          const xAxis = target.stick === "left" ? "left_stick_x" : "right_stick_x";
          const yAxis = target.stick === "left" ? "left_stick_y" : "right_stick_y";
          const button = target.stick === "left" ? "left_stick_button" : "right_stick_button";
          active =
            Math.abs(currentState.axes[xAxis]) > 0.05 ||
            Math.abs(currentState.axes[yAxis]) > 0.05 ||
            currentState.buttons[button];
        } else {
          active = DPAD_BUTTONS.some((button) => currentState.buttons[button]);
        }

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (!material || !isMeshStandardMaterial(material)) {
            return;
          }

          const baseEmissive = material.userData.baseEmissive as THREE.Color | undefined;
          const baseIntensity = material.userData.baseEmissiveIntensity as number | undefined;

          if (!baseEmissive || baseIntensity === undefined) {
            return;
          }

          material.emissive.copy(baseEmissive);
          material.emissiveIntensity = baseIntensity;

          if (active) {
            material.emissive.set(target.kind === "trigger" ? "#d4d4d8" : "#ffffff");
            material.emissiveIntensity = 0.6;
          }
        });
      });
    }

    function renderScene() {
      applyInteractiveVisuals();
      renderer.render(scene, camera);
    }

    function frameObject() {
      if (!loadedObject || !container) {
        return;
      }

      const bounds = new THREE.Box3().setFromObject(loadedObject);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const width = Math.max(size.x, size.z);
      const height = size.y || 1;
      const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      const padding = 1.2;
      const halfHeight = Math.max((height * padding) / 2, (width * padding) / (2 * aspect));

      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.position.set(center.x, center.y, center.z + Math.max(size.z * 3, 8));
      camera.lookAt(center.x, center.y, center.z);
      camera.updateProjectionMatrix();
    }

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      frameObject();
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);
      renderScene();
    };

    animate();

    return () => {
      mounted = false;
      releaseDragState();
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.style.cursor = "default";
      interactiveMeshesRef.current = [];
      stickMeshMapRef.current = {};
      environmentMap.dispose();
      pmremGenerator.dispose();

      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material?.dispose();
        }
      });

      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onAxisChange, onButtonChange]);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#050505] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="mb-1 text-sm font-medium text-white">3D Controller</p>
        <p className="mb-0 text-xs text-zinc-500">
          Click or drag directly on the controller to drive `gamepad1`.
        </p>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[320px] w-full sm:h-[380px] lg:h-[440px]"
          aria-label="Interactive 3D gamepad model"
        />
        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-zinc-300">
            {loadError}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 border-t border-white/10 px-5 py-4 text-xs text-zinc-400 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/60 p-3 font-mono">
          Active buttons:{" "}
          {Object.entries(state.buttons)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(", ") || "none"}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/60 p-3 font-mono">
          LS({state.axes.left_stick_x.toFixed(2)}, {state.axes.left_stick_y.toFixed(2)}) | RS(
          {state.axes.right_stick_x.toFixed(2)}, {state.axes.right_stick_y.toFixed(2)}) | LT{" "}
          {state.axes.left_trigger.toFixed(2)} | RT {state.axes.right_trigger.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
