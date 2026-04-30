/**
 * DTO Mapper Utility
 * 
 * Responsible for transforming raw PocketBase records into clean, 
 * decoupled API responses by removing internal metadata and 
 * flattening expanded relations.
 */

const INTERNAL_FIELDS = ['collectionId', 'collectionName', '@collectionId', '@collectionName'];

/**
 * Standard mapper that handles single records or lists
 */
export const mapDTO = (data, options = {}) => {
    if (!data) return null;

    // Handle lists (PocketBase ListResult)
    if (data.items && Array.isArray(data.items)) {
        return {
            ...data,
            items: data.items.map(item => transformRecord(item, options))
        };
    }

    // Handle single records
    return transformRecord(data, options);
};

/**
 * Transforms a single PocketBase record
 */
function transformRecord(record, options) {
    if (!record || typeof record !== 'object') return record;

    const clean = { ...record };

    // 1. Remove internal PocketBase system fields
    INTERNAL_FIELDS.forEach(field => delete clean[field]);

    // 2. Handle expanded relations recursively
    if (clean.expand && typeof clean.expand === 'object') {
        const expanded = {};
        for (const [key, value] of Object.entries(clean.expand)) {
            // Flatten the 'expand' object by moving its contents to the root or keeping them namespaced
            expanded[key] = Array.isArray(value) 
                ? value.map(v => transformRecord(v, options)) 
                : transformRecord(value, options);
        }
        
        // Merge expanded data into the main object if 'flatten' option is true
        if (options.flattenExpand) {
            delete clean.expand;
            return { ...clean, ...expanded };
        }
        
        clean.expand = expanded;
    }

    return clean;
}

/**
 * Specific mappers for domain entities (if custom logic is needed)
 */
export const mappers = {
    intake: (r) => mapDTO(r, { flattenExpand: false }),
    accession: (r) => mapDTO(r, { flattenExpand: false }),
    inventory: (r) => mapDTO(r, { flattenExpand: false }),
    generic: (r) => mapDTO(r)
};
