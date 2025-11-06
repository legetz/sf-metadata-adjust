/**
 * Sorting rules for different Salesforce metadata types
 */

export interface SortingRule {
    /** Metadata file pattern to match (e.g., 'field-meta.xml') */
    filePattern: string;
    /** Keys that should be sorted to the top in order */
    priorityKeys?: string[];
    /** Array keys that should NOT be sorted (preserve original order) */
    unsortedArrays?: string[];
}

/**
 * Default sorting rules for Salesforce metadata files
 */
export const DEFAULT_SORTING_RULES: SortingRule[] = [
    {
        filePattern: 'field-meta.xml',
        priorityKeys: ['fullName']
    },
    {
        filePattern: 'FileUploadAndDownloadSecurity.settings-meta.xml',
        unsortedArrays: ['dispositions']
    },
    {
        filePattern: 'validationRule-meta.xml',
        priorityKeys: ['fullName']
    },
    {
        filePattern: 'listView-meta.xml',
        priorityKeys: ['fullName']
    },
    {
        filePattern: 'labels-meta.xml',
        priorityKeys: ['fullName']
    },
];

/**
 * Get sorting rule for a given file path
 */
export function getSortingRule(filePath?: string): SortingRule | undefined {
    if (!filePath) {
        return undefined;
    }

    return DEFAULT_SORTING_RULES.find(rule => filePath.endsWith(rule.filePattern));
}

/**
 * Sort object keys according to priority rules
 * Priority keys come first in order, then remaining keys are sorted alphabetically
 */
export function sortKeysWithPriority(keys: string[], priorityKeys?: string[]): string[] {
    if (!priorityKeys || priorityKeys.length === 0) {
        // No priority keys, just sort alphabetically (case-sensitive)
        return keys.sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
    }

    const prioritySet = new Set(priorityKeys);
    const priorityFound: string[] = [];
    const remaining: string[] = [];

    // Separate priority keys from remaining keys
    for (const key of keys) {
        if (prioritySet.has(key)) {
            priorityFound.push(key);
        } else {
            remaining.push(key);
        }
    }

    // Sort priority keys according to their order in priorityKeys array
    priorityFound.sort((a, b) => {
        const indexA = priorityKeys.indexOf(a);
        const indexB = priorityKeys.indexOf(b);
        return indexA - indexB;
    });

    // Sort remaining keys alphabetically (case-sensitive)
    remaining.sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    // Combine: priority keys first, then sorted remaining keys
    return [...priorityFound, ...remaining];
}
