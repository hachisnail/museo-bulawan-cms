import React from 'react';
import InternalForm from './InternalForm';
import ExternalForm from './ExternalForm';

/**
 * FormRenderer Dispatcher
 * 
 * Automatically chooses between Internal (Staff/System) and External (Public/Visitor) 
 * implementations based on the 'variant' prop or 'compact' flag.
 */
const FormRenderer = (props) => {
    const { variant, compact } = props;

    // Default to 'internal' if compact is true, otherwise 'external'
    const finalVariant = variant || (compact ? 'internal' : 'external');

    if (finalVariant === 'internal') {
        return <InternalForm {...props} />;
    }

    return <ExternalForm {...props} />;
};

export default FormRenderer;
