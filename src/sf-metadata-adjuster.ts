import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { sortXmlElements } from './common/xml/sorter.js';
import { createFileBackup } from './common/helper/backup.js';
import { hashString } from './common/helper/string.js';

interface XmlObject {
    [key: string]: any;
}

interface ProcessingStats {
    processed: number;
    unchanged: number;
    modified: number;
    skipped: number;
    errors: number;
    files: string[];
    unchangedFiles: string[];
}

export class SfMetadataAdjuster {
    private folderPath: string;
    private includeTypes: string[];
    private excludeTypes: string[];
    private allowAll: boolean;
    private stats: ProcessingStats = {
        processed: 0,
        unchanged: 0,
        modified: 0,
        skipped: 0,
        errors: 0,
        files: [],
        unchangedFiles: []
    };
    
    // Whitelist of allowed metadata file types for safe processing
    // Only these types will be processed unless --all flag is used
    private readonly allowedMetadataTypes: string[] = [
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
    
    // Default exclusions (used when --exclude is not specified)
    private readonly defaultExclusions: string[] = [
        'reportType-meta.xml',
        'flexipage-meta.xml',
        'layout-meta.xml'
    ];

    // Always excluded types that cannot be included (due to special handling requirements)
    private readonly alwaysExcluded: string[] = [
        'flow-meta.xml'
    ];

    constructor(folderPath: string, includeTypes: string[] = [], excludeTypes: string[] = [], allowAll: boolean = false) {
        this.folderPath = folderPath;
        this.allowAll = allowAll;
        
        this.includeTypes = includeTypes.map(t => {
            // Normalize type names - ensure they end with -meta.xml
            if (!t.endsWith('-meta.xml')) {
                return `${t}-meta.xml`;
            }
            return t;
        });
        
        // If no exclude types specified, use defaults; otherwise use the provided exclusions
        if (excludeTypes.length === 0) {
            this.excludeTypes = [...this.defaultExclusions];
        } else {
            this.excludeTypes = excludeTypes.map(t => {
                // Normalize type names - ensure they end with -meta.xml
                if (!t.endsWith('-meta.xml')) {
                    return `${t}-meta.xml`;
                }
                return t;
            });
        }

        // Validate that include types don't conflict with always-excluded types
        this.validateIncludeTypes();
        
        // Validate that include types are whitelisted (unless --all is specified)
        this.validateWhitelistedTypes();
    }

    /**
     * Validate that include types are whitelisted when --all is not specified
     */
    private validateWhitelistedTypes(): void {
        // Skip validation if --all flag is used or no include types specified
        if (this.allowAll || this.includeTypes.length === 0) {
            return;
        }

        const nonWhitelistedTypes: string[] = [];
        
        for (const includeType of this.includeTypes) {
            const isWhitelisted = this.allowedMetadataTypes.some(allowedType => 
                includeType.endsWith(allowedType)
            );
            
            if (!isWhitelisted) {
                nonWhitelistedTypes.push(includeType);
            }
        }

        if (nonWhitelistedTypes.length > 0) {
            const nonWhitelistedList = nonWhitelistedTypes.join(', ');
            const allowedList = this.allowedMetadataTypes.join(', ');
            throw new Error(
                `Invalid configuration: The following types are not in the allowed whitelist: ${nonWhitelistedList}.\n` +
                `Allowed types: ${allowedList}\n` +
                `Use --all flag to process all metadata types without whitelist restrictions.`
            );
        }
    }

    /**
     * Validate that include types don't conflict with always-excluded types
     */
    private validateIncludeTypes(): void {
        if (this.includeTypes.length === 0) {
            return; // No include types specified, nothing to validate
        }

        const conflictingTypes: string[] = [];
        
        for (const includeType of this.includeTypes) {
            for (const alwaysExcludedType of this.alwaysExcluded) {
                if (includeType.endsWith(alwaysExcludedType)) {
                    conflictingTypes.push(includeType);
                    break;
                }
            }
        }

        if (conflictingTypes.length > 0) {
            const conflictList = conflictingTypes.join(', ');
            const alwaysExcludedList = this.alwaysExcluded.join(', ');
            throw new Error(
                `Invalid configuration: The following types cannot be included as they require special handling: ${conflictList}. ` +
                `Always excluded types: ${alwaysExcludedList}`
            );
        }
    }
    
    /**
     * Check if a file should be excluded based on the exclude list
     */
    private shouldExcludeFile(filePath: string): boolean {
        const fileName = path.basename(filePath);
        
        // Always exclude types that require special handling
        const isAlwaysExcluded = this.alwaysExcluded.some(excludePattern => fileName.endsWith(excludePattern));
        if (isAlwaysExcluded) {
            return true;
        }
        
        // Check regular exclusion list
        return this.excludeTypes.some(excludePattern => fileName.endsWith(excludePattern));
    }
    
    /**
     * Check if a file matches the include list (if specified)
     */
    private shouldIncludeFile(filePath: string): boolean {
        const fileName = path.basename(filePath);
        
        // If include types are specified, check against them
        if (this.includeTypes.length > 0) {
            return this.includeTypes.some(includePattern => fileName.endsWith(includePattern));
        }
        
        // If no include types specified and --all is NOT used, check against whitelist
        if (!this.allowAll) {
            return this.allowedMetadataTypes.some(allowedType => fileName.endsWith(allowedType));
        }
        
        // If --all is used and no specific includes, accept all files (except excludes)
        return true;
    }

    /**
     * Find all *-meta.xml files recursively in the folder
     */
    private findMetadataFiles(dir: string): string[] {
        const files: string[] = [];
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules and .git directories for performance
                    if (entry.name === 'node_modules' || entry.name === '.git') {
                        continue;
                    }
                    // Recursively search subdirectories
                    files.push(...this.findMetadataFiles(fullPath));
                } else if (entry.isFile() && entry.name.endsWith('-meta.xml')) {
                    // Check if file should be excluded
                    if (this.shouldExcludeFile(fullPath)) {
                        this.stats.skipped++;
                        continue;
                    }
                    // Check if file matches include list
                    if (!this.shouldIncludeFile(fullPath)) {
                        this.stats.skipped++;
                        continue;
                    }
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`❌ Error reading directory ${dir}: ${error}`);
        }
        
        return files;
    }

    /**
     * Read and parse XML file
     */
    private async readXmlFile(filePath: string): Promise<string> {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read XML file: ${error}`);
        }
    }

    /**
     * Parse XML string to object
     */
    private async parseXml(xmlString: string): Promise<XmlObject> {
        const parser = new xml2js.Parser({
            preserveChildrenOrder: false,
            explicitChildren: false,
            explicitArray: true, // Keep arrays as arrays for consistent handling
            mergeAttrs: false,
            explicitRoot: false,
            trim: true,
            normalize: false, // Don't normalize whitespace
            normalizeTags: false, // Don't normalize tag names
            attrkey: '$', // Use standard attribute key
            charkey: '_', // Use standard character data key
            charsAsChildren: false
        });
        
        try {
            return await parser.parseStringPromise(xmlString);
        } catch (error) {
            throw new Error(`Failed to parse XML: ${error}`);
        }
    }

    /**
     * Fix incorrect xmlns namespace for metadata files
     * Corrects tooling API namespace to standard metadata namespace
     */
    private fixXmlNamespace(xmlObject: XmlObject): XmlObject {
        // Check if object has attributes
        if (xmlObject.$ && typeof xmlObject.$ === 'object') {
            const attrs = xmlObject.$;
            
            // Check if xmlns contains the tooling metadata namespace
            if (attrs.xmlns && typeof attrs.xmlns === 'string' && 
                attrs.xmlns.includes('metadata.tooling')) {
                // Replace with correct metadata namespace
                attrs.xmlns = 'http://soap.sforce.com/2006/04/metadata';
            }
            
            // Remove fqn attribute if it exists (not needed in metadata API)
            if (attrs.fqn) {
                delete attrs.fqn;
            }
        }
        
        return xmlObject;
    }

    /**
     * Clean up CustomField metadata by removing default/false values
     * Removes externalId element when set to false
     */
    private cleanupCustomField(xmlObject: XmlObject, filePath: string): XmlObject {
        // Only process field-meta.xml files
        if (!filePath.endsWith('field-meta.xml')) {
            return xmlObject;
        }

        // Remove externalId if it's false
        if (xmlObject.externalId && 
            xmlObject.externalId[0] === 'false') {
            delete xmlObject.externalId;
        }

        return xmlObject;
    }

    /**
     * Prefix XML entities with markers before parsing to preserve them
     * This prevents the parser from converting entities to literals
     */
    private prefixXmlEntities(xmlString: string): string {
        const entityMarker = '___ENTITY_MARKER___';
        let result = xmlString;
        
        // Mark all XML entities so they survive the parse/build cycle
        result = result.replace(/&apos;/g, `${entityMarker}apos;`);
        result = result.replace(/&quot;/g, `${entityMarker}quot;`);
        result = result.replace(/&amp;/g, `${entityMarker}amp;`);
        result = result.replace(/&lt;/g, `${entityMarker}lt;`);
        result = result.replace(/&gt;/g, `${entityMarker}gt;`);
        
        return result;
    }

    /**
     * Restore XML entity encoding for special characters
     * This fixes the issue where entities become literals during parse/build cycle
     */
    private restoreXmlEntities(xmlString: string): string {
        const entityMarker = '___ENTITY_MARKER___';
        let result = xmlString;
        
        // First, restore the marked entities back to proper XML entities
        result = result.replace(new RegExp(`${entityMarker}amp;`, 'g'), '&amp;');
        result = result.replace(new RegExp(`${entityMarker}lt;`, 'g'), '&lt;');
        result = result.replace(new RegExp(`${entityMarker}gt;`, 'g'), '&gt;');
        result = result.replace(new RegExp(`${entityMarker}quot;`, 'g'), '&quot;');
        result = result.replace(new RegExp(`${entityMarker}apos;`, 'g'), '&apos;');
        
        return result;
    }

    /**
     * Extract the root element name directly from the raw XML string
     * This avoids issues with parser configuration affecting object keys
     */
    private extractRootElementName(xmlString: string): string {
        // Match the first opening tag after XML declaration/comments
        const rootElementMatch = xmlString.match(/<\s*([a-zA-Z_][\w\-.:]*)/);
        if (rootElementMatch && rootElementMatch[1]) {
            return rootElementMatch[1];
        }
        return 'root'; // fallback
    }

    /**
     * Detect root element type and build appropriate XML
     */
    private buildXml(obj: XmlObject, originalFilePath: string, originalXml: string): string {
        // Extract the root element name directly from the original XML
        let rootName = this.extractRootElementName(originalXml);
        
        // Fallback: try to determine from parsed object keys (excluding special keys)
        if (rootName === 'root') {
            const rootKeys = Object.keys(obj).filter(key => key !== '$' && key !== '_');
            if (rootKeys.length > 0) {
                rootName = rootKeys[0];
            }
        }
        
        const builder = new xml2js.Builder({
            renderOpts: {
                pretty: true,
                indent: '    ' // Use 4 spaces for better readability
            },
            xmldec: {
                version: '1.0',
                encoding: 'UTF-8',
                standalone: undefined
            },
            rootName: rootName,
            headless: false,
            attrkey: '$',
            charkey: '_',
            cdata: false,
            allowSurrogateChars: false
        });

        let xmlOutput = builder.buildObject(obj);
        
        // Post-process to restore XML entity encoding for apostrophes
        xmlOutput = this.restoreXmlEntities(xmlOutput);
        
        // Ensure there's an empty line before EOF
        if (!xmlOutput.endsWith('\n')) {
            xmlOutput += '\n';
        }
        
        return xmlOutput;
    }

    /**
     * Process a single XML file
     */
    private async processFile(filePath: string): Promise<boolean> {
        try {
            const relativePath = path.relative(this.folderPath, filePath);
            
            // Read the file
            const originalXml = await this.readXmlFile(filePath);
            
            // Prefix XML entities with markers before parsing to preserve them
            const prefixedXml = this.prefixXmlEntities(originalXml);
            
            // Parse the prefixed XML
            const xmlObject = await this.parseXml(prefixedXml);

            // Fix incorrect xmlns namespace (e.g., tooling API namespace)
            const fixedObject = this.fixXmlNamespace(xmlObject);

            // Clean up CustomField metadata (remove false externalId, etc.)
            const cleanedObject = this.cleanupCustomField(fixedObject, filePath);

            // Sort the elements using imported sorter with file path for rule-based sorting
            const sortedObject = sortXmlElements(cleanedObject, undefined, filePath);

            // Build the XML
            const sortedXml = this.buildXml(sortedObject, filePath, originalXml);

            // Make sha256 hash of original and sorted XML
            const originalHash = hashString(originalXml);
            const sortedHash = hashString(sortedXml);

            // Compare original and sorted to see if changes are needed
            const needsUpdate = originalHash !== sortedHash;

            if (needsUpdate) {
                // Write back to the same file (replace original)
                fs.writeFileSync(filePath, sortedXml, 'utf8');
                console.log(`✏️  Modified: ${relativePath}`);
                this.stats.modified++;
                this.stats.files.push(relativePath);
            } else {
                this.stats.unchanged++;
                this.stats.unchangedFiles.push(relativePath);
            }
            
            this.stats.processed++;
            
            return true;
        } catch (error) {
            console.error(`❌ Error processing ${path.relative(this.folderPath, filePath)}: ${error}`);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Main process: find and adjust all metadata files
     */
    async process(createBackup: boolean = true): Promise<void> {
        try {
            console.log(`🔍 Scanning for *-meta.xml files in: ${this.folderPath}`);
            
            const metadataFiles = this.findMetadataFiles(this.folderPath);
            
            if (metadataFiles.length === 0) {
                console.log('ℹ️  No *-meta.xml files found in the specified directory');
                return;
            }

            console.log(`📋 Found ${metadataFiles.length} metadata files`);

            // Create backup if requested
            if (createBackup) {
                createFileBackup(metadataFiles, this.folderPath);
            }

            console.log('🔤 Processing metadata files...\n');

            // Process each file
            for (const file of metadataFiles) {
                await this.processFile(file);
            }

            // Display summary
            this.displaySummary();

        } catch (error) {
            console.error('❌ Error processing metadata files:', error);
            process.exit(1);
        }
    }

    /**
     * Process specific metadata files (for git-depth functionality)
     */
    async processSpecificFiles(files: string[], createBackup: boolean = true): Promise<void> {
        try {
            // Reset stats for this specific processing
            this.stats = {
                processed: 0,
                unchanged: 0,
                modified: 0,
                skipped: 0,
                errors: 0,
                files: [],
                unchangedFiles: []
            };

            if (files.length === 0) {
                console.log('ℹ️  No files specified for processing');
                return;
            }

            // Filter to only include files that exist and are *-meta.xml files
            const validFiles = files.filter(file => {
                if (!fs.existsSync(file)) {
                    console.log(`⚠️  File not found, skipping: ${path.relative(this.folderPath, file)}`);
                    return false;
                }
                if (!file.endsWith('-meta.xml')) {
                    console.log(`⚠️  Not a metadata file, skipping: ${path.relative(this.folderPath, file)}`);
                    return false;
                }
                // Check exclude list
                if (this.shouldExcludeFile(file)) {
                    this.stats.skipped++;
                    return false;
                }
                // Check include list
                if (!this.shouldIncludeFile(file)) {
                    this.stats.skipped++;
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) {
                console.log('ℹ️  No valid metadata files to process');
                return;
            }

            console.log(`📋 Processing ${validFiles.length} specific metadata files`);

            // Create backup if requested
            if (createBackup) {
                createFileBackup(validFiles, this.folderPath);
            }

            console.log('🔤 Processing specified metadata files...\n');

            // Process each file
            for (const file of validFiles) {
                await this.processFile(file);
            }

            // Display summary
            this.displaySummary();

        } catch (error) {
            console.error('❌ Error processing specific metadata files:', error);
            process.exit(1);
        }
    }

    /**
     * Display processing summary
     */
    private displaySummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ADJUSTMENT SUMMARY');
        console.log('='.repeat(60));
        console.log(`📁 Total files checked: ${this.stats.processed} files`);
        console.log(`✏️ Modified: ${this.stats.modified} files`);
        console.log(`✅ Already good: ${this.stats.unchanged} files`);
        if (this.stats.skipped > 0) {
            console.log(`⏭️ Skipped: ${this.stats.skipped} files`);
        }
        console.log(`⚠️ Errors encountered: ${this.stats.errors} files`);

        if (this.stats.modified > 0) {
            console.log(`\n🎉 Successfully adjusted ${this.stats.modified} metadata file${this.stats.modified !== 1 ? 's' : ''}!`);
        } else if (this.stats.unchanged > 0) {
            console.log(`\n✨ All metadata files are already good!`);
        }
    }
}

/**
 * Command line interface
 */
/*
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: sf-metadata-adjuster <folder-path> [--backup]');
        console.error('');
        console.error('Description:');
        console.error('  Recursively finds and sorts all *-meta.xml files in the specified folder');
        console.error('  Replaces original files with sorted versions');
        console.error('');
        console.error('Examples:');
        console.error('  sf-metadata-adjuster ./force-app/main/default');
        console.error('  sf-metadata-adjuster ./src --backup');
        console.error('  npx ts-node src/sf-metadata-adjuster.ts ./force-app');
        console.error('');
        console.error('Options:');
        console.error('  --backup    Activate backup before processing');
        process.exit(1);
    }

    const folderPath = args[0];
    const backup = args.includes('--backup');

    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
        console.error(`❌ Folder not found: ${folderPath}`);
        process.exit(1);
    }

    // Check if it's a directory
    if (!fs.statSync(folderPath).isDirectory()) {
        console.error(`❌ Path is not a directory: ${folderPath}`);
        process.exit(1);
    }

    const adjuster = new SfMetadataAdjuster(folderPath);
    adjuster.process(backup);
}

// Run if this file is executed directly
if (import.meta.url === new URL('.', import.meta.url).href) {
    main();
}
*/
