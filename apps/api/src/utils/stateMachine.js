/**
 * Museum CMS State Machine
 * 
 * Centralized transition rules for all pipeline entities.
 * Every status change in the system MUST go through this module.
 */

// ==========================================
// INTAKE STATUS TRANSITIONS
// ==========================================
const INTAKE_TRANSITIONS = {
    'under_review':       ['approved', 'rejected'],
    'approved':           ['awaiting_delivery', 'rejected'],
    'rejected':           ['under_review'],              // reopen
    'awaiting_delivery':  ['in_custody', 'under_review'], // rollback allowed
    'in_custody':         ['accessioned'],
    'accessioned':        []                              // terminal
};

// ==========================================
// ACCESSION STATUS TRANSITIONS
// ==========================================
const ACCESSION_TRANSITIONS = {
    'pending_approval': ['in_research', 'rejected'],
    'in_research':      ['finalized'],
    'finalized':        [],                               // terminal
    'rejected':         ['pending_approval']              // re-submit
};

// ==========================================
// INVENTORY STATUS TRANSITIONS
// ==========================================
const INVENTORY_TRANSITIONS = {
    'active':           ['on_loan', 'in_conservation', 'deaccessioned'],
    'on_loan':          ['active'],
    'in_conservation':  ['active'],
    'deaccessioned':    []                                // terminal
};

// ==========================================
// SUBMISSION STATUS TRANSITIONS
// ==========================================
const SUBMISSION_TRANSITIONS = {
    'pending':    ['processed', 'archived'],
    'processed':  ['archived'],
    'archived':   []                                      // terminal
};

// ==========================================
// REGISTRY: Maps entity types to their transition tables
// ==========================================
const TRANSITION_REGISTRY = {
    'intake':     INTAKE_TRANSITIONS,
    'accession':  ACCESSION_TRANSITIONS,
    'inventory':  INVENTORY_TRANSITIONS,
    'submission': SUBMISSION_TRANSITIONS
};

/**
 * Validates whether a status transition is legal.
 * 
 * @param {string} entityType - One of: 'intake', 'accession', 'inventory', 'submission'
 * @param {string} currentStatus - The record's current status
 * @param {string} targetStatus - The desired next status
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTransition(entityType, currentStatus, targetStatus) {
    const transitions = TRANSITION_REGISTRY[entityType];

    if (!transitions) {
        return { valid: false, error: `Unknown entity type: '${entityType}'` };
    }

    const allowed = transitions[currentStatus];

    if (!allowed) {
        return { valid: false, error: `Unknown status '${currentStatus}' for entity '${entityType}'` };
    }

    if (!allowed.includes(targetStatus)) {
        return {
            valid: false,
            error: `Invalid transition: '${entityType}' cannot move from '${currentStatus}' → '${targetStatus}'. Allowed: [${allowed.join(', ')}]`
        };
    }

    return { valid: true };
}

/**
 * Asserts a valid transition — throws on failure.
 * Use this inside service methods for clean guard logic.
 */
export function assertTransition(entityType, currentStatus, targetStatus) {
    const result = validateTransition(entityType, currentStatus, targetStatus);
    if (!result.valid) {
        throw new Error(result.error);
    }
}

/**
 * Returns all valid next states for a given entity and status.
 * Useful for frontend UIs to show available actions.
 */
export function getValidTransitions(entityType, currentStatus) {
    const transitions = TRANSITION_REGISTRY[entityType];
    if (!transitions) return [];
    return transitions[currentStatus] || [];
}

/**
 * Returns the full transition map for an entity type.
 * Useful for documentation and admin tools.
 */
export function getTransitionMap(entityType) {
    return TRANSITION_REGISTRY[entityType] || {};
}

/**
 * Returns all defined statuses for an entity type.
 */
export function getStatuses(entityType) {
    const transitions = TRANSITION_REGISTRY[entityType];
    if (!transitions) return [];
    return Object.keys(transitions);
}

// Export raw maps for direct access if needed
export {
    INTAKE_TRANSITIONS,
    ACCESSION_TRANSITIONS,
    INVENTORY_TRANSITIONS,
    SUBMISSION_TRANSITIONS
};
