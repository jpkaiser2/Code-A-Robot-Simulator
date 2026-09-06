import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  async readAsArrayBuffer(blob: Blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }

  async readAsDataURL(blob: Blob) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${bytes.toString("base64")}`;
    this.onloadend?.();
  }
}

function addBox(
  parent: THREE.Object3D,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
}

/**
 * Generates an original low-poly teaching representation from published outer dimensions.
 * No vendor CAD, textures, or artwork are included.
 */
export async function generateControlHubAsset(outputPath: string) {
  const previousFileReader = globalThis.FileReader;
  (globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;

  try {
    const scene = new THREE.Scene();
    scene.name = "REV-31-1595 simplified teaching model";

    const root = new THREE.Group();
    root.name = "Control Hub";
    root.userData = {
      generator: "Code-A-Robot procedural catalog pipeline",
      dimensionsM: [0.143, 0.0295, 0.13],
      sourceGeometry: "original-simplified",
    };
    scene.add(root);

    const enclosure = new THREE.MeshStandardMaterial({
      color: "#20242a",
      roughness: 0.72,
      metalness: 0.18,
    });
    const lid = new THREE.MeshStandardMaterial({
      color: "#d5d9de",
      roughness: 0.44,
      metalness: 0.55,
    });
    const port = new THREE.MeshStandardMaterial({
      color: "#111317",
      roughness: 0.8,
      metalness: 0.05,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: "#f05a28",
      roughness: 0.55,
      metalness: 0.05,
    });

    // The complete model remains inside the published 143 x 130 x 29.5 mm envelope.
    addBox(root, "Enclosure", [0.143, 0.0235, 0.13], [0, -0.003, 0], enclosure);
    addBox(root, "Top plate", [0.139, 0.006, 0.126], [0, 0.01175, 0], lid);
    addBox(root, "Identification accent", [0.058, 0.0008, 0.012], [0, 0.0143, -0.034], accent);

    for (let index = 0; index < 4; index += 1) {
      const z = -0.045 + index * 0.03;
      addBox(root, `Motor port ${index}`, [0.008, 0.011, 0.018], [-0.0665, 0.002, z], port);
    }
    for (let index = 0; index < 6; index += 1) {
      const x = -0.0525 + index * 0.021;
      addBox(root, `Servo port ${index}`, [0.014, 0.009, 0.007], [x, 0.002, 0.0605], port);
    }
    for (let index = 0; index < 4; index += 1) {
      const z = -0.045 + index * 0.03;
      addBox(root, `Sensor port ${index}`, [0.008, 0.009, 0.016], [0.0665, 0.002, z], port);
    }

    const screwGeometry = new THREE.CylinderGeometry(0.0022, 0.0022, 0.001, 12);
    const screwMaterial = new THREE.MeshStandardMaterial({ color: "#30343a", metalness: 0.7 });
    for (const [x, z] of [
      [-0.061, -0.052],
      [0.061, -0.052],
      [-0.061, 0.052],
      [0.061, 0.052],
    ] as Array<[number, number]>) {
      const screw = new THREE.Mesh(screwGeometry, screwMaterial);
      screw.name = "Top screw";
      screw.position.set(x, 0.0142, z);
      root.add(screw);
    }

    scene.updateMatrixWorld(true);
    const exporter = new GLTFExporter();
    const data = await exporter.parseAsync(scene, {
      binary: true,
      onlyVisible: true,
      trs: false,
    });
    if (!(data instanceof ArrayBuffer)) {
      throw new Error("GLTFExporter did not return a binary GLB.");
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(data));
  } finally {
    if (previousFileReader) {
      globalThis.FileReader = previousFileReader;
    } else {
      delete (globalThis as { FileReader?: typeof FileReader }).FileReader;
    }
  }
}
