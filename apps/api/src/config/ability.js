import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// 1. The Multi-Department Hierarchy (Guide Removed)
const HIERARCHY = {
    admin: ['registrar', 'conservator', 'content_editor', 'appointment_coordinator'], 
    
    registrar: ['inventory_staff'],
    conservator: ['guest'],
    inventory_staff: ['guest'],
    
    content_editor: ['content_writer'],
    content_writer: ['guest'],

    appointment_coordinator: ['guest'], 

    visitor: ['guest'], 
    guest: []
};

const ROLE_RULES = {
    admin: (can) => {
        can('manage', 'all'); 
    },
    
    registrar: (can) => {
        can('manage', 'Intake');
        can('manage', 'Accession');
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

    visitor: (can, user) => {
        // Visitors can ONLY read records where their user.id matches the donor_account_id
        can('read', 'Intake', { donor_account_id: user.id });
        
        // (Optional) If you want them to see their signed contracts later:
        can('read', 'Accession', { 'intake.donor_account_id': user.id }); 
    },

    guest: (can) => {
        can('read', 'Article', { status: 'published' });
        can('create', 'Appointment');
        // Let guests submit the initial unauthenticated donation form
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
    const primaryRole = user?.role || 'guest';
    
    getEffectiveRoles(primaryRole).forEach(role => {
        if (ROLE_RULES[role]) ROLE_RULES[role](can, user);
    });

    return build();
};