/**
 * Configuration rules and constants for metadata file processing
 */

/**
 * Whitelist of allowed metadata file types for safe processing
 * Only these types will be processed unless --all flag is used
 */
export const ALLOWED_METADATA_TYPES: string[] = [
    'cls-meta.xml',
    'field-meta.xml',
    'labels-meta.xml',
    'object-meta.xml',
    'permissionset-meta.xml',
    'profile-meta.xml',
    'settings-meta.xml',
    'trigger-meta.xml',
    'validationRule-meta.xml',
];

/**
 * Default exclusions (used when --exclude is not specified)
 */
export const DEFAULT_EXCLUSIONS: string[] = [
    'reportType-meta.xml',
    'flexipage-meta.xml',
    'layout-meta.xml'
];

/**
 * Always excluded types that cannot be included (due to special handling requirements)
 */
export const ALWAYS_EXCLUDED: string[] = [
    'flow-meta.xml'
];

/**
 * Element cleanup rule configuration
 */
export interface ElementCleanupRule {
    elementName: string;
    removeValues: string[];
    conditions?: {
        elementName: string;
        values: string[];
    }[];
}

/**
 * Configuration for cleaning up metadata elements
 * Defines which elements should be removed based on their values and conditions for each metadata type
 */
export const ELEMENT_CLEANUP_RULES: {
    [metadataType: string]: ElementCleanupRule[];
} = {
    'field-meta.xml': [
        {
            elementName: 'externalId',
            removeValues: ['false'],
            conditions: [
                {
                    elementName: 'type',
                    values: ['Picklist']
                }
            ]
        },
        {
            elementName: 'description',
            removeValues: ['']
        }
    ]
};
