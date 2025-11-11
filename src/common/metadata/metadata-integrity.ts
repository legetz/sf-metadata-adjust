import * as path from "path";
import { XmlObject } from "../xml/xml-helpers.js";

export type RemovedMetadataType = "ApexClass" | "CustomField";

export interface RemovedMetadataItem {
  type: RemovedMetadataType;
  name: string;
  referenceKey: string;
  sourceFile: string;
}

export type IntegrityIssueType = "MissingApexClassReference" | "MissingCustomFieldReference";

export interface IntegrityIssue {
  type: IntegrityIssueType;
  missingItem: string;
  referencingFile: string;
  detail: string;
}

type RemovedMetadataIndex = Map<RemovedMetadataType, Map<string, RemovedMetadataItem>>;

/**
 * Identify the metadata type and key for a removed metadata file path.
 */
export function classifyRemovedMetadataFile(filePath: string): RemovedMetadataItem | null {
  const normalized = filePath.split(path.sep).join("/");

  const classMatch = normalized.match(/\/classes\/([^/]+)\.cls(?:-meta\.xml)?$/i);
  if (classMatch) {
    const className = classMatch[1];
    return {
      type: "ApexClass",
      name: className,
      referenceKey: className,
      sourceFile: filePath
    };
  }

  const fieldMatch = normalized.match(/\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/i);
  if (fieldMatch) {
    const objectName = fieldMatch[1];
    const fieldName = fieldMatch[2];
    const referenceKey = `${objectName}.${fieldName}`;
    return {
      type: "CustomField",
      name: referenceKey,
      referenceKey,
      sourceFile: filePath
    };
  }

  return null;
}

/**
 * Build a type-indexed map of removed metadata items for faster lookups.
 */
export function buildRemovedMetadataIndex(removedItems: RemovedMetadataItem[]): RemovedMetadataIndex {
  const index: RemovedMetadataIndex = new Map();

  for (const item of removedItems) {
    if (!index.has(item.type)) {
      index.set(item.type, new Map());
    }
    const typeMap = index.get(item.type)!;
    if (!typeMap.has(item.referenceKey)) {
      typeMap.set(item.referenceKey, item);
    }
  }

  return index;
}

/**
 * Check parsed metadata content for references to removed metadata items.
 */
export function findIntegrityIssuesInMetadata(
  metadata: XmlObject,
  filePath: string,
  removedIndex: RemovedMetadataIndex
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const classIndex = removedIndex.get("ApexClass");
  if (classIndex) {
    const classAccessArray = toArray(metadata.classAccesses);
    for (const access of classAccessArray) {
      const className = firstString(access?.apexClass);
      const enabled = isTrue(access?.enabled);

      if (!className || !enabled) {
        continue;
      }

      if (classIndex.has(className)) {
        issues.push({
          type: "MissingApexClassReference",
          missingItem: className,
          referencingFile: filePath,
          detail: `Class access still enabled for removed Apex class '${className}'`
        });
      }
    }
  }

  const fieldIndex = removedIndex.get("CustomField");
  if (fieldIndex) {
    const fieldPermissionsArray = toArray(metadata.fieldPermissions);
    for (const permission of fieldPermissionsArray) {
      const fieldName = firstString(permission?.field);
      const readable = isTrue(permission?.readable);
      const editable = isTrue(permission?.editable);

      if (!fieldName || (!readable && !editable)) {
        continue;
      }

      if (fieldIndex.has(fieldName)) {
        issues.push({
          type: "MissingCustomFieldReference",
          missingItem: fieldName,
          referencingFile: filePath,
          detail: `Field permission references removed field '${fieldName}'`
        });
      }
    }
  }

  return issues;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function firstString(value: any): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const inner = firstString(item);
      if (inner !== undefined) {
        return inner;
      }
    }
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    if (typeof value._ === "string") {
      return value._;
    }
  }

  return undefined;
}

function isTrue(value: any): boolean {
  if (!value) {
    return false;
  }

  const candidate = firstString(value);
  if (typeof candidate === "string") {
    return candidate.toLowerCase() === "true";
  }

  return Boolean(candidate);
}
