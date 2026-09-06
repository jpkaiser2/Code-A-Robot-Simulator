import type { CatalogPartDefinition, PartCatalog } from "./types.ts";

export const REV_CONTROL_HUB_PART_ID = "rev:REV-31-1595";

const REV_CONTROL_HUB: CatalogPartDefinition = {
  id: REV_CONTROL_HUB_PART_ID,
  vendor: "REV Robotics",
  sku: "REV-31-1595",
  name: "Control Hub",
  category: "controller",
  lifecycle: "active",
  source: {
    productUrl: "https://www.revrobotics.com/rev-31-1595/",
    retrievedAt: "2026-09-05",
    licenseStatus: "approved",
    attribution: "Product identity and published dimensions © REV Robotics.",
    notes:
      "The distributed GLB is an original simplified Code-A-Robot model made from published dimensions; it is not vendor CAD.",
  },
  visual: {
    kind: "glb",
    uri: "/robot-parts/rev/rev-31-1595.glb",
    boundsM: [0.143, 0.0295, 0.13],
    origin: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    },
  },
  physical: {
    // A verified mass has not yet been added; the validator keeps this visible as a warning.
    colliders: [
      {
        kind: "box",
        center: [0, 0, 0],
        halfExtents: [0.0715, 0.01475, 0.065],
      },
    ],
  },
  connectors: [
    {
      id: "bottom-mount-pattern",
      name: "Bottom REV mounting pattern",
      kind: "mountPattern",
      profile: "revPattern",
      frame: {
        position: [0, -0.01475, 0],
        rotation: [0, 0, 0, 1],
      },
      gender: "neutral",
      accepts: ["revPattern", "profile:revPattern"],
      rotationSteps: 4,
    },
  ],
  device: {
    kind: "controlHub",
    ports: [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `motor:${index}`,
        accepts: ["dcMotor" as const],
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `servo:${index}`,
        accepts: ["servo" as const, "crServo" as const],
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `digital:${index}`,
        accepts: ["touch" as const],
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `i2c:${index}`,
        accepts: ["distance" as const, "color" as const, "imu" as const],
      })),
      {
        id: "internal:imu",
        accepts: ["imu"],
      },
    ],
  },
  tags: ["FTC", "REV DUO", "hub", "controller", "electronics"],
};

export const BUILT_IN_PART_CATALOG: PartCatalog = {
  version: "2026.09.1",
  generatedAt: "2026-09-05T00:00:00.000Z",
  parts: [REV_CONTROL_HUB],
};
