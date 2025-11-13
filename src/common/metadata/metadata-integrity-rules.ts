export type RemovedMetadataType = "ApexClass" | "CustomField" | "VisualforcePage";

export type IntegrityReferenceSurface =
  | "profile"
  | "permissionSet"
  | "apexSource"
  | "lwc"
  | "aura"
  | "flow"
  | "formulaField"
  | "layout"
  | "flexipage"
  | "validationRule"
  | "fieldSet"
  | "recordType"
  | "compactLayout";

export interface MetadataIntegrityRule {
  removedType: RemovedMetadataType;
  surfaces: IntegrityReferenceSurface[];
}

export const METADATA_INTEGRITY_RULES: MetadataIntegrityRule[] = [
  {
    removedType: "ApexClass",
    surfaces: ["profile", "permissionSet", "lwc", "aura", "flow", "apexSource"]
  },
  {
    removedType: "CustomField",
    surfaces: [
      "profile",
      "permissionSet",
      "flow",
      "formulaField",
      "layout",
      "flexipage",
      "validationRule",
      "fieldSet",
      "recordType",
      "compactLayout"
    ]
  },
  {
    removedType: "VisualforcePage",
    surfaces: ["profile", "permissionSet"]
  }
];

export function getSurfacesForRemovedTypes(types: Set<RemovedMetadataType>): Set<IntegrityReferenceSurface> {
  const surfaces = new Set<IntegrityReferenceSurface>();
  for (const rule of METADATA_INTEGRITY_RULES) {
    if (types.has(rule.removedType)) {
      for (const surface of rule.surfaces) {
        surfaces.add(surface);
      }
    }
  }
  return surfaces;
}
