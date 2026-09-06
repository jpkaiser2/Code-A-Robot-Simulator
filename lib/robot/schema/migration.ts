import { parseRobotDocumentValue } from "./serialization.ts";
import {
  ROBOT_DOCUMENT_SCHEMA_VERSION,
  type RobotDocumentV3,
} from "./types.ts";
import type { RobotValidationIssue } from "./validation.ts";

export type RobotDocumentImportResult =
  | {
      status: "ready";
      document: RobotDocumentV3;
      issues: RobotValidationIssue[];
    }
  | {
      status: "migration-required";
      fromVersion: number;
      toVersion: typeof ROBOT_DOCUMENT_SCHEMA_VERSION;
      message: string;
    }
  | {
      status: "error";
      issues: RobotValidationIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function detectRobotDocumentVersion(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.schemaVersion === "number" && Number.isInteger(value.schemaVersion)) {
    return value.schemaVersion;
  }
  if (typeof value.version === "number" && Number.isInteger(value.version)) {
    return value.version;
  }
  return null;
}

/**
 * Central import boundary for all builder and simulator entry points.
 *
 * Version 2 is detected but deliberately not guessed into catalog-backed parts. A deterministic
 * v2-to-v3 mapping must be registered here once the legacy primitive policy is approved.
 */
export function importRobotDocumentValue(value: unknown): RobotDocumentImportResult {
  const version = detectRobotDocumentVersion(value);

  if (version !== ROBOT_DOCUMENT_SCHEMA_VERSION) {
    if (version !== null && version > 0 && version < ROBOT_DOCUMENT_SCHEMA_VERSION) {
      return {
        status: "migration-required",
        fromVersion: version,
        toVersion: ROBOT_DOCUMENT_SCHEMA_VERSION,
        message: `Robot schema v${version} requires an explicit migration to v${ROBOT_DOCUMENT_SCHEMA_VERSION}.`,
      };
    }

    return {
      status: "error",
      issues: [
        {
          code: "unsupported-schema-version",
          message:
            version === null
              ? "Robot document does not declare a schema version."
              : `Robot schema v${version} is not supported.`,
          path: "schemaVersion",
          severity: "error",
        },
      ],
    };
  }

  const result = parseRobotDocumentValue(value);
  return result.success
    ? { status: "ready", document: result.document, issues: result.issues }
    : { status: "error", issues: result.issues };
}

export function importRobotDocumentJson(json: string): RobotDocumentImportResult {
  try {
    return importRobotDocumentValue(JSON.parse(json));
  } catch (parseError) {
    return {
      status: "error",
      issues: [
        {
          code: "invalid-json",
          message:
            parseError instanceof Error ? parseError.message : "Robot document is not valid JSON.",
          path: "$",
          severity: "error",
        },
      ],
    };
  }
}
