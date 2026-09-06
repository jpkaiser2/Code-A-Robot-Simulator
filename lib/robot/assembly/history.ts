import type { PartCatalog } from "../catalog/types.ts";
import type { RigidTransform, RobotDocumentV3 } from "../schema/types.ts";
import {
  connectInstances,
  disconnectInstances,
  transformRigidComponent,
  type ConnectInstancesInput,
} from "./operations.ts";

export interface AssemblyCommand {
  label: string;
  apply(document: RobotDocumentV3): RobotDocumentV3;
}

interface HistoryEntry {
  label: string;
  before: RobotDocumentV3;
  after: RobotDocumentV3;
}

export class AssemblyHistory {
  private undoEntries: HistoryEntry[] = [];
  private redoEntries: HistoryEntry[] = [];

  constructor(
    private currentDocument: RobotDocumentV3,
    private readonly capacity = 100
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Assembly history capacity must be a positive integer.");
    }
  }

  get document() {
    return this.currentDocument;
  }

  get canUndo() {
    return this.undoEntries.length > 0;
  }

  get canRedo() {
    return this.redoEntries.length > 0;
  }

  execute(command: AssemblyCommand) {
    const before = this.currentDocument;
    const after = command.apply(before);
    if (after === before) return before;
    this.undoEntries.push({ label: command.label, before, after });
    if (this.undoEntries.length > this.capacity) this.undoEntries.shift();
    this.redoEntries = [];
    this.currentDocument = after;
    return after;
  }

  undo() {
    const entry = this.undoEntries.pop();
    if (!entry) return this.currentDocument;
    this.redoEntries.push(entry);
    this.currentDocument = entry.before;
    return this.currentDocument;
  }

  redo() {
    const entry = this.redoEntries.pop();
    if (!entry) return this.currentDocument;
    this.undoEntries.push(entry);
    this.currentDocument = entry.after;
    return this.currentDocument;
  }
}

export function createConnectCommand(
  catalog: PartCatalog,
  input: ConnectInstancesInput
): AssemblyCommand {
  return {
    label: `Connect ${input.stationary.instanceId} to ${input.moving.instanceId}`,
    apply: (document) => connectInstances(document, catalog, input).document,
  };
}

export function createDisconnectCommand(connectionId: string): AssemblyCommand {
  return {
    label: `Disconnect ${connectionId}`,
    apply: (document) => disconnectInstances(document, connectionId).document,
  };
}

export function createMoveRigidComponentCommand(
  anchorInstanceId: string,
  targetTransform: RigidTransform
): AssemblyCommand {
  return {
    label: `Move ${anchorInstanceId}`,
    apply: (document) => transformRigidComponent(document, anchorInstanceId, targetTransform).document,
  };
}
