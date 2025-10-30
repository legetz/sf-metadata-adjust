/**
 * XML Sorting utilities for Salesforce metadata files
 */

interface XmlObject {
    [key: string]: any;
}

/**
 * Sort classAccesses elements by apexClass name (case-sensitive)
 */
export function sortClassAccesses(classAccesses: any[]): any[] {
    return classAccesses.sort((a, b) => {
        const classA = a.apexClass?.[0] || '';
        const classB = b.apexClass?.[0] || '';
        // Case-sensitive comparison: uppercase before lowercase
        if (classA < classB) return -1;
        if (classA > classB) return 1;
        return 0;
    });
}

/**
 * Sort other array elements by their first key or content (case-sensitive)
 */
export function sortArrayElements(arr: any[], arrayKey: string): any[] {
    return arr.sort((a, b) => {
        let valueA = '';
        let valueB = '';

        // For fieldPermissions, sort by field name
        if (arrayKey === 'fieldPermissions') {
            valueA = a.field?.[0] || '';
            valueB = b.field?.[0] || '';
        }
        // For other common Salesforce metadata arrays
        else if (arrayKey === 'customPermissions' ||
                 arrayKey === 'customMetadataTypeAccesses' || 
                 arrayKey === 'externalCredentialPrincipalAccesses' ||
                 arrayKey === 'objectPermissions' ||
                 arrayKey === 'recordTypeVisibilities' ||
                 arrayKey === 'tabVisibilities' || 
                 arrayKey === 'states') {
            valueA = a.name?.[0] || a.object?.[0] || a.recordType?.[0] || a.tab?.[0] || a.isoCode?.[0] || '';
            valueB = b.name?.[0] || b.object?.[0] || b.recordType?.[0] || b.tab?.[0] || b.isoCode?.[0] || '';
        }
        // For other arrays, try to find a suitable sorting key
        else {
            const keys = Object.keys(a);
            if (keys.length > 0) {
                const sortKey = keys.find(k => 
                    k === 'name' || 
                    k === 'fullName' || 
                    k === 'field' || 
                    k.includes('Name')
                ) || keys[0];
                valueA = a[sortKey]?.[0] || '';
                valueB = b[sortKey]?.[0] || '';
            }
        }

        // Case-sensitive comparison: uppercase before lowercase
        if (valueA < valueB) return -1;
        if (valueA > valueB) return 1;
        return 0;
    });
}

/**
 * Recursively sort XML object elements alphabetically with special handling for SF metadata
 * Uses case-sensitive sorting where uppercase letters sort before lowercase
 */
export function sortXmlElements(obj: any, parentKey?: string): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        // Special handling for classAccesses - sort by apexClass
        if (parentKey === 'classAccesses') {
            const sorted = sortClassAccesses(obj);
            return sorted.map(item => sortXmlElements(item));
        }
        
        // Handle other arrays with appropriate sorting
        if (parentKey && obj.length > 0 && typeof obj[0] === 'object') {
            const sorted = sortArrayElements(obj, parentKey);
            return sorted.map(item => sortXmlElements(item));
        }

        // For other arrays, just recursively sort elements
        return obj.map(item => sortXmlElements(item));
    }

    if (typeof obj === 'object') {
        const sortedObj: XmlObject = {};
        
        // Get all keys and sort them case-sensitive (uppercase before lowercase)
        const sortedKeys = Object.keys(obj).sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });

        // Rebuild object with sorted keys
        for (const key of sortedKeys) {
            sortedObj[key] = sortXmlElements(obj[key], key);
        }

        return sortedObj;
    }

    return obj;
}
