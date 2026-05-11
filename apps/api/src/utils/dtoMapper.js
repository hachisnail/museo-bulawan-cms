/**
 * DTO Mapper Utility
 * 
 * Transforms raw database records into clean, decoupled API responses.
 * Handles expanded relations recursively.
 * 
 * Note: After the PocketBase → MariaDB migration, PB-specific fields
 * (collectionId, collectionName) no longer exist on records. The mapper
 * now focuses solely on expand handling and response normalization.
 */

/**
 * Standard mapper that handles single records or lists
 */
export const mapDTO = (data, options = {}) => {
    if (!data) return null;

    // Handle lists (paginated result)
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
 * Transforms a single record
 */
function transformRecord(record, options) {
    if (!record || typeof record !== 'object') return record;

    const clean = { ...record };

    // Handle expanded relations recursively
    if (clean.expand && typeof clean.expand === 'object') {
        const expanded = {};
        for (const [key, value] of Object.entries(clean.expand)) {
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
