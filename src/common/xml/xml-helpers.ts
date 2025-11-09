/**
 * Shared XML helper utilities for metadata processing
 */

import * as xml2js from 'xml2js';

export interface XmlObject {
  [key: string]: any;
}

const ENTITY_MARKER = '___ENTITY_MARKER___';

/**
 * Prefix XML entities with markers before parsing to preserve them
 */
export function prefixXmlEntities(xmlString: string): string {
  return xmlString
    .replace(/&apos;/g, `${ENTITY_MARKER}apos;`)
    .replace(/&quot;/g, `${ENTITY_MARKER}quot;`)
    .replace(/&amp;/g, `${ENTITY_MARKER}amp;`)
    .replace(/&lt;/g, `${ENTITY_MARKER}lt;`)
    .replace(/&gt;/g, `${ENTITY_MARKER}gt;`);
}

/**
 * Restore XML entity encoding for special characters
 */
export function restoreXmlEntities(xmlString: string): string {
  return xmlString
    .replace(new RegExp(`${ENTITY_MARKER}amp;`, 'g'), '&amp;')
    .replace(new RegExp(`${ENTITY_MARKER}lt;`, 'g'), '&lt;')
    .replace(new RegExp(`${ENTITY_MARKER}gt;`, 'g'), '&gt;')
    .replace(new RegExp(`${ENTITY_MARKER}quot;`, 'g'), '&quot;')
    .replace(new RegExp(`${ENTITY_MARKER}apos;`, 'g'), '&apos;');
}

/**
 * Extract the root element name directly from the raw XML string
 */
export function extractRootElementName(xmlString: string): string {
  const rootElementMatch = xmlString.match(/<\s*([a-zA-Z_][\w\-.:]*)/);
  if (rootElementMatch && rootElementMatch[1]) {
    return rootElementMatch[1];
  }
  return 'root';
}

/**
 * Parse XML string into an object with common metadata settings
 */
export async function parseMetadataXml(xmlString: string): Promise<XmlObject> {
  const parser = new xml2js.Parser({
    preserveChildrenOrder: false,
    explicitChildren: false,
    explicitArray: true,
    mergeAttrs: false,
    explicitRoot: false,
    trim: true,
    normalize: false,
    normalizeTags: false,
    attrkey: '$',
    charkey: '_',
    charsAsChildren: false
  });

  return parser.parseStringPromise(xmlString);
}

/**
 * Build XML output for metadata objects using the original structure as reference
 */
export function buildMetadataXml(obj: XmlObject, originalXml: string): string {
  let rootName = extractRootElementName(originalXml);

  if (rootName === 'root') {
    const rootKeys = Object.keys(obj).filter(key => key !== '$' && key !== '_');
    if (rootKeys.length > 0) {
      rootName = rootKeys[0];
    }
  }

  const builder = new xml2js.Builder({
    renderOpts: {
      pretty: true,
      indent: '    '
    },
    xmldec: {
      version: '1.0',
      encoding: 'UTF-8',
      standalone: undefined
    },
    rootName,
    headless: false,
    attrkey: '$',
    charkey: '_',
    cdata: false,
    allowSurrogateChars: false
  });

  let xmlOutput = builder.buildObject(obj);
  xmlOutput = restoreXmlEntities(xmlOutput);
  xmlOutput = xmlOutput.replace(/<(\w+)([^>]*)\/>/g, '<$1$2></$1>');

  if (!xmlOutput.endsWith('\n')) {
    xmlOutput += '\n';
  }

  return xmlOutput;
}
