export type BuilderComponentCategory =
  | "drive"
  | "mechanism"
  | "structure"
  | "sensor"
  | "control";

export type SimulatorComponentRole =
  | "chassis"
  | "driveMotor"
  | "wheel"
  | "armMotor"
  | "armSegment"
  | "servo"
  | "claw"
  | "sensor"
  | "decorative";

export interface BuilderComponentDefinition {
  id: string;
  displayName: string;
  category: BuilderComponentCategory;
  simulatorRole: SimulatorComponentRole;
  description: string;
  color: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  attachmentPoints: string[];
  defaultDeviceName?: string;
  assetSource: "builtin" | "custom";
  tags: string[];
}

export interface BuilderAssemblyInstance {
  instanceId: string;
  componentId: string;
  displayName: string;
  deviceName: string;
  attachmentTargetId: string | null;
  attachmentPoint: string | null;
  notes: string;
  colorOverride?: string;
}

export interface TeacherLessonDraft {
  id: string;
  title: string;
  objective: string;
  starterCode: string;
  componentLibrary: BuilderComponentDefinition[];
  robotAssembly: BuilderAssemblyInstance[];
  simulation: {
    showGamepad: boolean;
    showTelemetry: boolean;
    showBridgeLog: boolean;
  };
}
