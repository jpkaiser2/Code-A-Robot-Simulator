"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import type {
  JointDefinition,
  PrimitiveKind,
  RobotDefinition,
  RobotPart,
  TransformMode,
  Vec3,
} from "@/lib/simulator/builder/robotSchema";

interface RobotBuilderViewportProps {
  robot: RobotDefinition;
  selectedPartId: string | null;
  transformMode: TransformMode;
  jointPreviewValues: Record<string, number>;
  onSelectPart: (partId: string | null) => void;
  onPartTransform: (partId: string, transform: Pick<RobotPart, "position" | "rotation" | "scale">) => void;
}

interface ViewportPartObject {
  previewGroup: THREE.Group;
  authoredGroup: THREE.Group;
}

function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function createGeometry(kind: PrimitiveKind) {
  if (kind === "cylinder") {
    return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
  }
  if (kind === "sphere") {
    return new THREE.SphereGeometry(0.5, 32, 18);
  }
  if (kind === "capsule") {
    return new THREE.CapsuleGeometry(0.35, 0.8, 8, 18);
  }
  return new THREE.BoxGeometry(1, 1, 1);
}

function toRadians(rotation: Vec3): Vec3 {
  return rotation.map((axis) => THREE.MathUtils.degToRad(axis)) as Vec3;
}

function toAxis(axis: Vec3 | undefined, fallback: Vec3) {
  const value = axis ?? fallback;
  const vector = new THREE.Vector3(...value);
  return vector.lengthSq() > 0 ? vector.normalize() : new THREE.Vector3(...fallback).normalize();
}

function fromObjectTransform(object: THREE.Object3D): Pick<RobotPart, "position" | "rotation" | "scale"> {
  return {
    position: [
      Number(object.position.x.toFixed(3)),
      Number(object.position.y.toFixed(3)),
      Number(object.position.z.toFixed(3)),
    ],
    rotation: [
      Number(THREE.MathUtils.radToDeg(object.rotation.x).toFixed(2)),
      Number(THREE.MathUtils.radToDeg(object.rotation.y).toFixed(2)),
      Number(THREE.MathUtils.radToDeg(object.rotation.z).toFixed(2)),
    ],
    scale: [
      Number(object.scale.x.toFixed(3)),
      Number(object.scale.y.toFixed(3)),
      Number(object.scale.z.toFixed(3)),
    ],
  };
}

function applyJointPreview(previewGroup: THREE.Group, joint: JointDefinition, value: number) {
  if (joint.type === "fixed") {
    return;
  }

  if (joint.type === "prismatic") {
    const axis = toAxis(joint.axis, [1, 0, 0]);
    previewGroup.position.copy(axis.multiplyScalar(value));
    return;
  }

  const axis = toAxis(joint.axis, [0, 0, 1]);
  const pivot = new THREE.Vector3(...(joint.pivot ?? [0, 0, 0]));
  const angle = THREE.MathUtils.degToRad(value);
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const rotatedPivot = pivot.clone().applyQuaternion(rotation);
  previewGroup.quaternion.copy(rotation);
  previewGroup.position.copy(pivot.sub(rotatedPivot));
}

function addMountPointHelpers(authoredGroup: THREE.Group, part: RobotPart) {
  part.mountPoints.forEach((mountPoint) => {
    const helper = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 8),
      new THREE.MeshBasicMaterial({ color: "#38bdf8", depthTest: false })
    );
    helper.position.set(...mountPoint.position);
    helper.rotation.set(...toRadians(mountPoint.rotation));
    helper.renderOrder = 4;
    helper.userData.partId = part.id;

    const axes = new THREE.AxesHelper(0.28);
    axes.userData.partId = part.id;
    helper.add(axes);
    authoredGroup.add(helper);
  });
}

function addJointHelper(previewGroup: THREE.Group, part: RobotPart) {
  if (part.joint.type === "fixed") {
    return;
  }

  const axis = toAxis(part.joint.axis, part.joint.type === "revolute" ? [0, 0, 1] : [1, 0, 0]);
  const pivot = new THREE.Vector3(...(part.joint.pivot ?? [0, 0, 0]));
  const points = [
    pivot.clone().add(axis.clone().multiplyScalar(-0.55)),
    pivot.clone().add(axis.clone().multiplyScalar(0.55)),
  ];
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: part.joint.type === "revolute" ? "#f97316" : "#22c55e",
      depthTest: false,
    })
  );
  axisLine.renderOrder = 5;
  axisLine.userData.partId = part.id;
  previewGroup.add(axisLine);

  if (part.joint.type === "revolute") {
    const pivotMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.01, 8, 32),
      new THREE.MeshBasicMaterial({ color: "#f97316", depthTest: false })
    );
    pivotMarker.position.copy(pivot);
    pivotMarker.renderOrder = 5;
    pivotMarker.userData.partId = part.id;
    previewGroup.add(pivotMarker);
  }
}

function createPartObject(
  part: RobotPart,
  selectedPartId: string | null,
  jointPreviewValues: Record<string, number>
): ViewportPartObject {
  const previewGroup = new THREE.Group();
  previewGroup.name = `${part.name} joint preview`;
  previewGroup.userData.partId = part.id;
  previewGroup.visible = part.visible;
  applyJointPreview(previewGroup, part.joint, jointPreviewValues[part.id] ?? part.joint.initialValue ?? 0);

  const authoredGroup = new THREE.Group();
  authoredGroup.name = part.name;
  authoredGroup.userData.partId = part.id;
  authoredGroup.position.set(...part.position);
  authoredGroup.rotation.set(...toRadians(part.rotation));
  authoredGroup.scale.set(...part.scale);
  authoredGroup.visible = part.visible;
  previewGroup.add(authoredGroup);

  const isSelected = selectedPartId === part.id;
  const geometry = createGeometry(part.kind);
  const material = new THREE.MeshStandardMaterial({
    color: part.color,
    roughness: 0.64,
    metalness: 0.12,
    emissive: isSelected ? "#ffffff" : "#000000",
    emissiveIntensity: isSelected ? 0.18 : 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = part.id;
  authoredGroup.add(mesh);

  if (isSelected) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: "#ffffff" })
    );
    edges.userData.partId = part.id;
    authoredGroup.add(edges);
    addMountPointHelpers(authoredGroup, part);
    addJointHelper(previewGroup, part);
  }

  return { previewGroup, authoredGroup };
}

export default function RobotBuilderViewport({
  robot,
  selectedPartId,
  transformMode,
  jointPreviewValues,
  onSelectPart,
  onPartTransform,
}: RobotBuilderViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const partsRootRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const partObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const selectedPartIdRef = useRef<string | null>(selectedPartId);
  const onPartTransformRef = useRef(onPartTransform);

  useEffect(() => {
    selectedPartIdRef.current = selectedPartId;
  }, [selectedPartId]);

  useEffect(() => {
    onPartTransformRef.current = onPartTransform;
  }, [onPartTransform]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 14, 56);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(5.2, 4.2, 5.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.target.set(0, 0.8, 0);
    orbitControls.minDistance = 2.5;
    orbitControls.maxDistance = 18;
    orbitControls.maxPolarAngle = Math.PI * 0.49;

    scene.add(new THREE.HemisphereLight("#ffffff", "#111827", 1.45));

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.55);
    keyLight.position.set(6, 9, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.9, metalness: 0.04 })
    );
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(12, 24, "#3f3f46", "#18181b");
    grid.position.y = 0.01;
    scene.add(grid);

    const axes = new THREE.AxesHelper(1.4);
    axes.position.set(-5.25, 0.04, -5.25);
    scene.add(axes);

    const partsRoot = new THREE.Group();
    scene.add(partsRoot);
    partsRootRef.current = partsRoot;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(transformMode);
    transformControls.setSpace("local");
    transformControls.setSize(0.82);
    transformControls.setTranslationSnap(0.1);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
    transformControls.setScaleSnap(0.05);
    const transformControlsHelper = transformControls.getHelper();
    scene.add(transformControlsHelper);
    transformControlsRef.current = transformControls;

    const commitSelectedTransform = () => {
      const selectedId = selectedPartIdRef.current;
      const selectedObject = selectedId ? partObjectsRef.current.get(selectedId) : null;
      if (selectedId && selectedObject) {
        onPartTransformRef.current(selectedId, fromObjectTransform(selectedObject));
      }
    };

    transformControls.addEventListener("dragging-changed", (event) => {
      orbitControls.enabled = !event.value;
      if (!event.value) {
        commitSelectedTransform();
      }
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const activeControlAxis = (transformControls as unknown as { axis: string | null }).axis;
      if (activeControlAxis) {
        return;
      }

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(partsRoot.children, true);
      const hit = hits.find((entry) => entry.object.userData.partId);
      onSelectPart(hit?.object.userData.partId ? String(hit.object.userData.partId) : null);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const handleResize = () => {
      if (!mountRef.current) {
        return;
      }
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let frameId = 0;
    const tick = () => {
      orbitControls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };

    handleResize();
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      transformControls.detach();
      scene.remove(transformControlsHelper);
      transformControls.dispose();
      orbitControls.dispose();
      disposeObject3D(partsRoot);
      partObjectsRef.current.clear();
      partsRootRef.current = null;
      transformControlsRef.current = null;
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [onSelectPart]);

  useEffect(() => {
    const partsRoot = partsRootRef.current;
    if (!partsRoot) {
      return;
    }

    while (partsRoot.children.length > 0) {
      const child = partsRoot.children[0];
      partsRoot.remove(child);
      disposeObject3D(child);
    }

    const objectMap = new Map<string, THREE.Object3D>();
    const authoredMap = new Map<string, THREE.Object3D>();
    robot.parts.forEach((part) => {
      const object = createPartObject(part, selectedPartId, jointPreviewValues);
      objectMap.set(part.id, object.previewGroup);
      authoredMap.set(part.id, object.authoredGroup);
    });

    robot.parts.forEach((part) => {
      const object = objectMap.get(part.id);
      const parent = part.parentId ? authoredMap.get(part.parentId) : null;
      if (!object) {
        return;
      }
      if (parent && parent !== object) {
        parent.add(object);
      } else {
        partsRoot.add(object);
      }
    });

    partObjectsRef.current = authoredMap;

    const transformControls = transformControlsRef.current;
    const selectedObject = selectedPartId ? authoredMap.get(selectedPartId) : null;
    if (transformControls && selectedObject) {
      transformControls.attach(selectedObject);
    } else {
      transformControls?.detach();
    }
  }, [jointPreviewValues, robot, selectedPartId]);

  useEffect(() => {
    transformControlsRef.current?.setMode(transformMode);
  }, [transformMode]);

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-black">
      <div ref={mountRef} className="h-[560px] w-full" />
      <div className="pointer-events-none absolute left-4 top-4 max-w-sm rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-xs text-zinc-400 backdrop-blur">
        <div className="font-medium uppercase tracking-[0.22em] text-zinc-200">Robot Assembly</div>
        <div className="mt-1">
          Click primitives to select them. Orbit with the mouse, then drag the gizmo to edit.
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-xs text-zinc-400 backdrop-blur">
        <div className="font-medium text-zinc-200">Mode: {transformMode}</div>
        <div className="mt-1">Move 0.1, rotate 5 deg, scale 0.05</div>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/75 px-3 py-1 text-xs text-zinc-400 backdrop-blur">
        X red, Y green, Z blue
      </div>
    </div>
  );
}
