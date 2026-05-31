// apps/panel-admin/src/pages/accessions/pages/AccessionsIndex.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import Modal from '../../../components/Modal';
import { DataTable, SidebarDashboard } from '../../../components';

// ─────────────────────────────────────────────────────────────────────────────
//  Badge & Theme Styles
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    pending_approval: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    in_research: 'text-blue-700 bg-blue-50 border-blue-200',
    finalized: 'text-black bg-zinc-200 border-black',
    archived: 'text-zinc-500 bg-white border-zinc-200'
};

// ─────────────────────────────────────────────────────────────────────────────
//  Columns definitions
// ─────────────────────────────────────────────────────────────────────────────
const activeColumns = [
    { key: 'accession_number', label: 'Accession Number', isBold: true },
    { key: 'title', label: 'Proposed Item Name' },
    { key: 'contract_type', label: 'Contract Type', render: (val) => val ? val.replace(/_/g, ' ').toUpperCase() : 'N/A' },
    { key: 'date', label: 'Date Logged' },
    { 
        key: 'status', 
        label: 'Status',
        render: (val) => (
            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[val] || STATUS_STYLES.pending_approval}`}>
                {val ? val.replace(/_/g, ' ') : 'Pending'}
            </span>
        )
    }
];

const archiveColumns = [
    { key: 'catalog_number', label: 'Catalog Number', isBold: true },
    { key: 'title', label: 'Artifact Name' },
    { key: 'deaccession_reason', label: 'Reason for Deaccession' },
    { key: 'date', label: 'Date Archived' }
];

// ─────────────────────────────────────────────────────────────────────────────
//  Sidebar Stats Calculations
// ─────────────────────────────────────────────────────────────────────────────
function getAccessionSidebarStats({ activeTab, accessions, archived }) {
    if (activeTab === 'active') {
        const pending = accessions.filter(a => a.status === 'pending_approval').length;
        const research = accessions.filter(a => a.status === 'in_research').length;
        const finalized = accessions.filter(a => a.status === 'finalized').length;
        return [
            { label: 'Pending Approval', count: pending, bgClass: 'bg-amber-50/50', badgeClass: 'bg-amber-100 text-amber-800' },
            { label: 'In Research', count: research, bgClass: 'bg-blue-50/50', badgeClass: 'bg-blue-100 text-blue-800' },
            { label: 'Finalized', count: finalized, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-200 text-zinc-900' }
        ];
    }
    // archive tab
    return [
        { label: 'Archived Inventory', count: archived.length, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-100 text-zinc-600' }
    ];
}

function getAccessionSidebarTitle(activeTab) {
    if (activeTab === 'active') return 'Total Active';
    return 'Total Archived';
}

function getAccessionSidebarCount({ activeTab, accessions, archived }) {
    if (activeTab === 'active') return accessions.length;
    return archived.length;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AccessionsIndex() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('accessions');

    // --- Tab — initialised from URL so page refreshes restore context ---
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get('tab');
        return ['active', 'archive'].includes(tab) ? tab : 'active';
    });

    // --- Modal ---
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert', variant: 'info',
        onConfirm: null, promptValue: ''
    });

    // --- Data ---
    const [accessions, setAccessions] = useState([]);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);

    // --- Table state ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [tableFilters, setTableFilters] = useState({ search: '', date: '' });

    // ------------------------------------------------------------------ //
    //  Data fetching
    // ------------------------------------------------------------------ //
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [accRes, archRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/accessions?expand=intake_id'),
                apiFetch('/api/v1/acquisitions/inventory/archive?expand=accession_id.intake_id')
            ]);
            const accData = await accRes.json();
            const archData = await archRes.json();

            if (accData.status === 'success') {
                setAccessions(accData.data.items);
            }

            if (archData.status === 'success') {
                setArchived(archData.data.items);
            }
        } catch (err) {
            console.error('Failed to fetch accession data', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (events.length > 0) fetchData(true);
    }, [events, fetchData]);

    // Tab shimmer — masks column layout shift when switching tabs
    useEffect(() => {
        setTabLoading(true);
        const t = setTimeout(() => setTabLoading(false), 300);
        return () => clearTimeout(t);
    }, [activeTab]);

    // Reset page on filter/sort/tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, sortConfig, tableFilters]);

    // ------------------------------------------------------------------ //
    //  Table data mapping
    // ------------------------------------------------------------------ //
    const tableData = useMemo(() => {
        if (activeTab === 'active') {
            return accessions.map(item => {
                const dateVal = item.created || item.created_at;
                return {
                    id: item.id,
                    type: 'active',
                    accession_number: item.accession_number,
                    title: item.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact',
                    contract_type: item.contract_type || 'N/A',
                    date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                    rawDate: dateVal,
                    status: item.status,
                    rawItem: item
                };
            });
        }

        // activeTab === 'archive'
        return archived.map(item => {
            const dateVal = item.created || item.created_at;
            return {
                id: item.id,
                type: 'archive',
                catalog_number: item.catalog_number,
                title: item.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Archived Artifact',
                deaccession_reason: item.deaccession_reason || 'No specific reason provided.',
                date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                rawDate: dateVal,
                status: 'archived',
                rawItem: item
            };
        });
    }, [activeTab, accessions, archived]);

    // ------------------------------------------------------------------ //
    //  Filter → Sort → Paginate
    // ------------------------------------------------------------------ //
    const filteredData = useMemo(() => {
        let result = [...tableData];
        if (tableFilters.search) {
            const q = tableFilters.search.toLowerCase();
            result = result.filter(item =>
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.accession_number && item.accession_number.toLowerCase().includes(q)) ||
                (item.catalog_number && item.catalog_number.toLowerCase().includes(q))
            );
        }
        if (tableFilters.date) {
            const target = new Date(tableFilters.date).toDateString();
            result = result.filter(item =>
                item.rawDate && new Date(item.rawDate).toDateString() === target
            );
        }
        return result;
    }, [tableData, tableFilters]);

    const sortedData = useMemo(() => {
        const items = [...filteredData];
        if (sortConfig?.key) {
            items.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (sortConfig.key === 'date') {
                    valA = a.rawDate ? new Date(a.rawDate) : new Date(0);
                    valB = b.rawDate ? new Date(b.rawDate) : new Date(0);
                } else {
                    valA = valA ? String(valA).toLowerCase() : '';
                    valB = valB ? String(valB).toLowerCase() : '';
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            items.sort((a, b) => {
                const da = a.rawDate ? new Date(a.rawDate) : new Date(0);
                const db = b.rawDate ? new Date(b.rawDate) : new Date(0);
                return db - da;
            });
        }
        return items;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage]);

    // ------------------------------------------------------------------ //
    //  Handlers
    // ------------------------------------------------------------------ //
    const handleQueryChange = useCallback((filters) => {
        setTableFilters(prev =>
            prev.search === filters.search && prev.date === filters.date ? prev : filters
        );
    }, []);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        else if (sortConfig.key === key && sortConfig.direction === 'desc') { direction = null; key = null; }
        setSortConfig({ key, direction });
    };

    const handleTabChange = (label) => {
        const value = label === 'Active Registry' ? 'active' : 'archive';
        setActiveTab(value);
        setSearchParams({ tab: value });
    };

    const handleRowClick = useCallback((row) => {
        navigate(`/accessions/${row.id}?tab=${activeTab}`);
    }, [navigate, activeTab]);

    // ------------------------------------------------------------------ //
    //  Derived display values
    // ------------------------------------------------------------------ //
    const myTabs = ['Active Registry', 'Archive'];
    const currentTabLabel = activeTab === 'active' ? 'Active Registry' : 'Archive';
    const activeColumnsHeader = activeTab === 'active' ? activeColumns : archiveColumns;

    const sidebarStats = getAccessionSidebarStats({ activeTab, accessions, archived });
    const sidebarTitle = getAccessionSidebarTitle(activeTab);
    const sidebarCount = getAccessionSidebarCount({ activeTab, accessions, archived });

    // ------------------------------------------------------------------ //
    //  Render
    // ------------------------------------------------------------------ //
    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <section className="flex justify-between items-end border-b border-gray-100 pb-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Accessions</h1>
                    <p className="text-sm text-gray-500 mt-1">Formal legal registration and artifact research.</p>
                </div>
            </section>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-2 items-start">
                <SidebarDashboard
                    tabs={myTabs}
                    activeTab={currentTabLabel}
                    onTabChange={handleTabChange}
                    showAddButton={false}
                    statsTitle={sidebarTitle}
                    statsCount={sidebarCount}
                    stats={sidebarStats}
                    isLoading={tabLoading}
                />

                <div className="flex-1 w-full min-w-0 animate-in fade-in duration-300">
                    <DataTable
                        columns={activeColumnsHeader}
                        data={paginatedData}
                        onQueryChange={handleQueryChange}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        showExtraActions={false}
                        sortConfig={sortConfig}
                        onSort={requestSort}
                        isExpandable={false}
                        isLoading={loading || tabLoading}
                        onRowClick={handleRowClick}
                    />
                </div>
            </div>

            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
                onInputChange={(val) => setModal({ ...modal, promptValue: val })}
                inputValue={modal.promptValue}
            />
        </div>
    );
}
