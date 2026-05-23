/**
 * Shared Domain Constants
 * 
 * Single source of truth for mappings and enums used across
 * the acquisition pipeline services.
 */

// ==========================================
// CONTRACT TYPE MAPPING
// Maps acquisition methods to their legal contract types.
// Used by intakeService (MOA generation) and accessionService (formal record creation).
// ==========================================
export const CONTRACT_TYPE_MAP = {
    'gift':     'deed_of_gift',
    'loan':     'loan_agreement',
    'purchase': 'bill_of_sale',
    'existing': 'internal_memo'
};

// ==========================================
// LEGAL STATUS MAPPING
// Derives the legal custody status from the acquisition method.
// ==========================================
export const LEGAL_STATUS_MAP = {
    'loan': 'Temporary Custody'
};
export const DEFAULT_LEGAL_STATUS = 'Museum Property';

export function getLegalStatus(method) {
    return LEGAL_STATUS_MAP[method] || DEFAULT_LEGAL_STATUS;
}

export function getContractType(method) {
    const type = CONTRACT_TYPE_MAP[method];
    if (!type) throw new Error(`Unknown acquisition method: '${method}'`);
    return type;
}

// ==========================================
// TABLE WHITELIST
// Prevents SQL injection via table name interpolation.
// Every table accessed through baseService MUST be listed here.
// ==========================================
export const ALLOWED_TABLES = new Set([
    'intakes',
    'accessions',
    'inventory',
    'inventory_audits',
    'donation_items',
    'condition_reports',
    'conservation_logs',
    'location_history',
    'media_links',
    'media_metadata',
    'audit_logs',
    'constituents',
    'valuations',
    'exhibitions',
    'exhibition_artifacts',
    'form_submissions',
    'form_definitions',
    'locations',
    'loans',
    'loan_artifacts',
    'accession_approvals',
    'notifications',
    'users',
    'sequences'
]);
