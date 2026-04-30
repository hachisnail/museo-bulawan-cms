import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// 1. The Multi-Department Hierarchy (Guide Removed)
const HIERARCHY = {
    admin: ['registrar', 'conservator', 'content_editor', 'appointment_coordinator'], 
    
    registrar: ['inventory_staff'],
    conservator: ['visitor'],
    inventory_staff: ['visitor'],
    
    content_editor: ['content_writer'],
    content_writer: ['visitor'],

    appointment_coordinator: ['visitor'], 

    donor: ['visitor'], 
    visitor: []
};

const ROLE_RULES = {
    admin: (can) => {
        can('manage', 'all'); 
    },
    
    registrar: (can) => {
        can('manage', 'Intake');
        can('manage', 'Accession');
        can('manage', 'Submission');
        can('update', 'Artifact'); 
    },
    conservator: (can, user) => {
        can('read', 'Artifact');
        can('update', 'Artifact'); 
        can('manage', 'ConservationLog'); 
        can('delete', 'ConservationLog', { conservator_id: user.id }); 
    },
    inventory_staff: (can) => {
        can('manage', 'Inventory'); 
        can('read', 'Intake');
        can('read', 'Accession');
        can('read', 'Artifact');
        can('read', 'Submission');
    },

    content_editor: (can) => {
        can('manage', 'Article'); 
    },
    content_writer: (can, user) => {
        can('create', 'Article');
        can('update', 'Article', { author_id: user.id });
        can('delete', 'Article', { author_id: user.id });
    },

    appointment_coordinator: (can) => {
        can('manage', 'Appointment'); 
    },

    donor: (can, user) => {
        // Donors can ONLY read records where their user.id matches the donor_account_id
        can('read', 'Intake', { donor_account_id: user.id });
        
        // (Optional) If you want them to see their signed contracts later:
        can('read', 'Accession', { 'intake.donor_account_id': user.id }); 
    },

    visitor: (can) => {
        can('read', 'Article', { status: 'published' });
        can('create', 'Appointment');
        // Let visitors submit the initial unauthenticated donation form
        can('create', 'FormSubmission'); 
    }
};

const getEffectiveRoles = (role) => {
    let roles = new Set([role]);
    const inherited = HIERARCHY[role] || [];
    inherited.forEach(childRole => {
        getEffectiveRoles(childRole).forEach(r => roles.add(r));
    });
    return Array.from(roles);
};

export const defineAbilityFor = (user) => {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
    const primaryRole = user?.role || 'visitor';
    
    getEffectiveRoles(primaryRole).forEach(role => {
        if (ROLE_RULES[role]) ROLE_RULES[role](can, user);
    });

    return build();
};