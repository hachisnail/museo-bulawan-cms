import { STATUS_STYLES } from '../../../components/Intakes/IntakeDetail';

// Column definitions for the Offers / Submissions tab
export const offersColumns = [
    { key: 'date', label: 'Date Received' },
    { key: 'title', label: 'Proposed Item Name', isBold: true },
    { key: 'donor', label: 'Donor Name' },
    { key: 'form_type', label: 'Form Title' },
    { 
        key: 'status', 
        label: 'Status',
        render: (val) => (
            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[val] || STATUS_STYLES.pending}`}>
                {val.replace(/_/g, ' ')}
            </span>
        )
    }
];

// Column definitions for the Active Intakes tab
export const intakesColumns = [
    { key: 'date', label: 'Date Logged' },
    { key: 'title', label: 'Proposed Item Name', isBold: true },
    { key: 'donor', label: 'Donor / Source' },
    { key: 'location', label: 'Current Location' },
    { 
        key: 'status', 
        label: 'Status',
        render: (val) => (
            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[val] || STATUS_STYLES.pending}`}>
                {val.replace(/_/g, ' ')}
            </span>
        )
    }
];

// Column definitions for the Archive tab
export const archiveColumns = [
    { key: 'date', label: 'Date Logged' },
    { key: 'title', label: 'Proposed Item Name', isBold: true },
    { key: 'donor', label: 'Donor / Source' },
    { 
        key: 'record_type', 
        label: 'Record Type',
        render: (val) => (
            <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${
                val === 'Offer'
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-500'
                    : 'bg-[#D4AF37]/5 border-[#D4AF37]/20 text-[#A68A27]'
            }`}>
                {val}
            </span>
        )
    },
    { 
        key: 'status', 
        label: 'Status',
        render: (val) => (
            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[val] || STATUS_STYLES.pending}`}>
                {val.replace(/_/g, ' ')}
            </span>
        )
    }
];
