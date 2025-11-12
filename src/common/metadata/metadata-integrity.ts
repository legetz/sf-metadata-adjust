import * as path from "path";
import { XmlObject } from "../xml/xml-helpers.js";
import { RemovedMetadataType } from "./metadata-integrity-rules.js";

export interface RemovedMetadataItem {
  type: RemovedMetadataType;
  name: string;
  referenceKey: string;
  sourceFile: string;
}

export type IntegrityIssueType =
  | "MissingApexClassReference"
  | "MissingCustomFieldReference"
  | "MissingVisualforcePageReference"
  | "DanglingApexClassReference";

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

  const vfPageMatch = normalized.match(/\/pages\/([^/]+)\.page(?:-meta\.xml)?$/i);
  if (vfPageMatch) {
    const pageName = vfPageMatch[1];
    return {
      type: "VisualforcePage",
      name: pageName,
      referenceKey: pageName,
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

  const pageIndex = removedIndex.get("VisualforcePage");
  if (pageIndex) {
    const pageAccessesArray = toArray(metadata.pageAccesses);
    for (const access of pageAccessesArray) {
      const pageName = firstString(access?.apexPage);
      const enabled = isTrue(access?.enabled);

      if (!pageName || !enabled) {
        continue;
      }

      if (pageIndex.has(pageName)) {
        issues.push({
          type: "MissingVisualforcePageReference",
          missingItem: pageName,
          referencingFile: filePath,
          detail: `Page access still enabled for removed Visualforce page '${pageName}'`
        });
      }
    }
  }

  return issues;
}

/**
 * Scan arbitrary source content for references to removed Apex classes.
 */
export function findIntegrityIssuesInSource(
  rawContent: string,
  filePath: string,
  removedIndex: RemovedMetadataIndex
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const classIndex = removedIndex.get("ApexClass");

  if (!classIndex || classIndex.size === 0) {
    return issues;
  }

  const content = rawContent ?? "";

  for (const className of classIndex.keys()) {
    const pattern = buildClassReferencePattern(className);
    if (pattern.test(content)) {
      issues.push({
        type: "DanglingApexClassReference",
        missingItem: className,
        referencingFile: filePath,
        detail: `Source references removed Apex class '${className}'`
      });
    }
  }

  return issues;
}

export type CustomFieldReferenceContext =
  | "Flow"
  | "Layout"
  | "Flexipage"
  | "Validation Rule"
  | "Field Set"
  | "Record Type"
  | "Compact Layout";

export function findCustomFieldIssuesInContent(
  rawContent: string,
  filePath: string,
  removedIndex: RemovedMetadataIndex,
  context: CustomFieldReferenceContext
): IntegrityIssue[] {
  const fieldIndex = removedIndex.get("CustomField");

  if (!fieldIndex || fieldIndex.size === 0) {
    return [];
  }

  const issues: IntegrityIssue[] = [];
  const content = rawContent ?? "";

  for (const fieldName of fieldIndex.keys()) {
    const patterns = buildFieldReferencePatterns(fieldName, context);
    if (patterns.some((pattern) => pattern.test(content))) {
      issues.push({
        type: "MissingCustomFieldReference",
        missingItem: fieldName,
        referencingFile: filePath,
        detail: `${context} references removed field '${fieldName}'`
      });
      continue;
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

function buildClassReferencePattern(className: string): RegExp {
  const escaped = escapeRegExp(className);
  return new RegExp(`\\b${escaped}\\b`, "g");
}

function buildFieldReferencePatterns(fieldName: string, context: CustomFieldReferenceContext): RegExp[] {
  const [objectName, apiName] = splitFieldReference(fieldName);
  const patterns: RegExp[] = [];

  if (context === "Flow") {
    patterns.push(new RegExp(`\\b${escapeRegExp(fieldName)}\\b`, "g"));
    if (apiName) {
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    return patterns;
  }

  if (context === "Layout") {
    if (apiName) {
      patterns.push(new RegExp(`<field>\\s*${escapeRegExp(apiName)}\\s*</field>`, "gi"));
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    return patterns;
  }

  if (context === "Flexipage") {
    patterns.push(new RegExp(`\\b${escapeRegExp(fieldName)}\\b`, "g"));
    if (apiName) {
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    return patterns;
  }

  if (context === "Validation Rule") {
    if (apiName) {
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    if (objectName && apiName) {
      patterns.push(new RegExp(`\\b${escapeRegExp(objectName)}\\.${escapeRegExp(apiName)}\\b`, "g"));
    }
    return patterns;
  }

  if (context === "Field Set") {
    if (apiName) {
      patterns.push(new RegExp(`<field>\\s*${escapeRegExp(apiName)}\\s*</field>`, "gi"));
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    if (objectName && apiName) {
      patterns.push(new RegExp(`<field>\\s*${escapeRegExp(objectName)}\\.${escapeRegExp(apiName)}\\s*</field>`, "gi"));
    }
    return patterns;
  }

  if (context === "Record Type") {
    if (apiName) {
      patterns.push(new RegExp(`<picklist>\\s*${escapeRegExp(apiName)}\\s*</picklist>`, "gi"));
      patterns.push(new RegExp(`<field>\\s*${escapeRegExp(apiName)}\\s*</field>`, "gi"));
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    if (objectName && apiName) {
      patterns.push(new RegExp(`\\b${escapeRegExp(objectName)}\\.${escapeRegExp(apiName)}\\b`, "g"));
    }
    return patterns;
  }

  if (context === "Compact Layout") {
    if (apiName) {
      patterns.push(new RegExp(`<fields>\\s*${escapeRegExp(apiName)}\\s*</fields>`, "gi"));
      patterns.push(new RegExp(`\\b${escapeRegExp(apiName)}\\b`, "g"));
    }
    if (objectName && apiName) {
      patterns.push(
        new RegExp(`<fields>\\s*${escapeRegExp(objectName)}\\.${escapeRegExp(apiName)}\\s*</fields>`, "gi")
      );
    }
    return patterns;
  }

  return patterns;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFieldReference(fieldName: string): [string | undefined, string | undefined] {
  const parts = fieldName.split(".");
  if (parts.length === 2) {
    return [parts[0], parts[1]];
  }

  if (parts.length > 2) {
    const apiName = parts.pop();
    const objectName = parts.join(".");
    return [objectName, apiName];
  }

  return [undefined, parts[0]];
}

function isLikelyApexClassName(candidate: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(candidate);
}

function isLikelyFieldName(candidate: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(candidate);
}

export function createManualRemovedItem(identifier: string | undefined | null): RemovedMetadataItem | null {
  const trimmed = identifier?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(".")) {
    const [objectName, fieldName] = splitFieldReference(trimmed);
    if (!objectName || !fieldName) {
      return null;
    }

    if (!isLikelyFieldName(fieldName)) {
      return null;
    }

    const referenceKey = `${objectName}.${fieldName}`;
    return {
      type: "CustomField",
      name: referenceKey,
      referenceKey,
      sourceFile: `manual:${referenceKey}`
    };
  }

  if (!isLikelyApexClassName(trimmed)) {
    return null;
  }

  return {
    type: "ApexClass",
    name: trimmed,
    referenceKey: trimmed,
    sourceFile: `manual:${trimmed}`
  };
}
