import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';

// ─────────────────────────────────────────────────────────────────────────────
//  Status Pill Styles
// ─────────────────────────────────────────────────────────────────────────────
const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
        case 'maintenance':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'loaned':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'active':
            return 'bg-zinc-800 text-white border-zinc-900';
        case 'deaccessioned':
            return 'bg-red-100 text-red-800 border-red-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

export default function InventoryIndex() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('inventory');

    const [activeItems, setActiveItems] = useState([]);
    const [archivedItems, setArchivedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter, Sort, Pagination States
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get('tab');
        return ['Artifact', 'Acquired', 'Borrowing', 'Deaccessioned'].includes(tab) ? tab : 'Artifact';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // ── Fetch Inventory ──
    const fetchInventory = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [activeRes, archRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/inventory?expand=accession_id.intake_id'),
                apiFetch('/api/v1/acquisitions/inventory/archive?expand=accession_id.intake_id')
            ]);
            const activeJson = await activeRes.json();
            const archJson = await archRes.json();

            if (activeJson.status === 'success') {
                setActiveItems(activeJson.data.items || []);
            }
            if (archJson.status === 'success') {
                setArchivedItems(archJson.data.items || []);
            }
        } catch (err) {
            console.error("Failed to fetch inventory", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    // Live real-time updates via SSE
    useEffect(() => {
        if (events.length > 0) fetchInventory(true);
    }, [events, fetchInventory]);

    // Update Search Params on Tab Change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        setCurrentPage(1);
    };

    // ── Dynamic Statistics calculations ──
    const stats = useMemo(() => {
        const totalActive = activeItems.length;
        const acquired = activeItems.filter(i => i.expand?.accession_id?.contract_type !== 'loan').length;
        const borrowing = activeItems.filter(i => i.expand?.accession_id?.contract_type === 'loan').length;
        const maintenance = activeItems.filter(i => i.status === 'maintenance').length;
        const onDisplay = activeItems.filter(i => i.status === 'loaned' || i.current_location?.toLowerCase().includes('display') || i.current_location?.toLowerCase().includes('gallery')).length;
        const inStorage = activeItems.filter(i => i.current_location?.toLowerCase().includes('storage') || (!i.current_location && i.status === 'active')).length;

        return [
            { label: 'Total Artifacts', value: String(totalActive) },
            { label: 'Acquired', value: String(acquired) },
            { label: 'Borrowing', value: String(borrowing) },
            { label: 'Under Maintenance', value: String(maintenance) },
            { label: 'On Display', value: String(onDisplay) },
            { label: 'In Storage', value: String(inStorage) },
        ];
    }, [activeItems]);

    // ── Map raw items to table row structure ──
    const tableData = useMemo(() => {
        let list = [];
        if (activeTab === 'Artifact') {
            list = activeItems;
        } else if (activeTab === 'Acquired') {
            list = activeItems.filter(i => i.expand?.accession_id?.contract_type !== 'loan');
        } else if (activeTab === 'Borrowing') {
            list = activeItems.filter(i => i.expand?.accession_id?.contract_type === 'loan');
        } else if (activeTab === 'Deaccessioned') {
            list = archivedItems;
        }

        return list.map(item => {
            const dateVal = item.created || item.created_at;
            const accession = item.expand?.accession_id || {};
            const intake = accession.expand?.intake_id || {};
            
            // Resolve donator name correctly
            const isAnon = intake.is_anonymous === true;
            const fullName = `${intake.donor_first_name || ''} ${intake.donor_last_name || ''}`.trim();
            const donorName = isAnon ? 'Anonymous Donor' : (fullName || accession.submitted_by || '—');

            return {
                id: item.catalog_number || '—',
                rawId: item.id,
                title: intake.proposed_item_name || accession.historical_significance?.substring(0, 30) || 'Unnamed Artifact',
                donator: donorName,
                origin: intake.origin || '—',
                date: dateVal ? new Date(dateVal).toLocaleDateString() : '—',
                rawDate: dateVal,
                type: accession.contract_type ? accession.contract_type.replace(/_/g, ' ') : 'Donation',
                status: item.status === 'deaccessioned' ? 'Deaccessioned' : (item.status === 'loaned' ? 'On Display' : (item.status === 'maintenance' ? 'Under Maintenance' : 'In Storage')),
                rawStatus: item.status,
                maintenance: item.last_checked ? new Date(item.last_checked).toLocaleDateString() : (dateVal ? new Date(dateVal).toLocaleDateString() : '—'),
                expiration: accession.contract_type?.toLowerCase() === 'loan' 
                    ? (intake.loan_end_date ? new Date(intake.loan_end_date).toLocaleDateString() : '—') 
                    : 'Permanent',
            };
        });
    }, [activeTab, activeItems, archivedItems]);

    // ── Search & Filter ──
    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return tableData;
        const q = searchTerm.toLowerCase();
        return tableData.filter(row => 
            row.id.toLowerCase().includes(q) ||
            row.title.toLowerCase().includes(q) ||
            row.donator.toLowerCase().includes(q) ||
            row.origin.toLowerCase().includes(q)
        );
    }, [tableData, searchTerm]);

    // ── Sorting ──
    const sortedData = useMemo(() => {
        const items = [...filteredData];
        if (sortConfig.key) {
            items.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                if (sortConfig.key === 'date') {
                    valA = a.rawDate ? new Date(a.rawDate) : new Date(0);
                    valB = b.rawDate ? new Date(b.rawDate) : new Date(0);
                } else {
                    valA = String(valA || '').toLowerCase();
                    valB = String(valB || '').toLowerCase();
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [filteredData, sortConfig]);

    // ── Pagination ──
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
            key = null;
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    return (
        <div className="flex flex-col gap-y-8 bg-white min-h-screen pb-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Inventory</h1>
                    <p className="text-sm text-zinc-500 mt-1">Master catalog list, display statuses, and collection tracking.</p>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-[#242424] rounded-md flex flex-col items-center justify-center py-6 px-4 shadow-sm border border-zinc-800">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 text-center">
                            {stat.label}
                        </span>
                        <span className="text-3xl font-bold text-white tracking-tight">
                            {loading ? '...' : stat.value}
                        </span>
                    </div>
                ))}
            </div>

            {/* ── Filters & Search ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Tabs */}
                    <div className="flex items-center gap-2">
                        {['Artifact', 'Acquired', 'Borrowing', 'Deaccessioned'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors ${
                                    activeTab === tab 
                                        ? 'bg-black text-white border-black shadow-sm' 
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {tab === 'Deaccessioned' ? 'Deaccessioned' : (tab === 'Artifact' ? 'All Active' : tab)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input 
                            type="text" 
                            placeholder="Search catalog..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                        />
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                {[
                                    { key: 'id', label: 'Catalog ID' },
                                    { key: 'title', label: 'Title' },
                                    { key: 'donator', label: 'Donor / Source' },
                                    { key: 'origin', label: 'Origin' },
                                    { key: 'date', label: 'Acquisition Date' },
                                    { key: 'type', label: 'Type' },
                                    { key: 'status', label: 'Status' },
                                    { key: 'maintenance', label: 'Last Checked' },
                                    { key: 'expiration', label: 'Contract Expiration' }
                                ].map(h => (
                                    <th 
                                        key={h.key} 
                                        onClick={() => requestSort(h.key)}
                                        className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {h.label}
                                            {sortConfig.key === h.key && (
                                                <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-3">
                                            <div className="w-5 h-5 border-2 border-zinc-200 border-t-black rounded-full animate-spin"></div>
                                            <span>Loading collection...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-gray-400 italic">
                                        No items found in this section.
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row, idx) => (
                                    <tr 
                                        key={idx} 
                                        className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                                    >
                                        <td className="py-4 px-4 text-gray-500 font-mono text-xs">{row.id}</td>
                                        <td className="py-4 px-4 font-semibold text-gray-900">
                                            <Link to={`/inventory/${row.rawId}?tab=${activeTab}`} className="hover:underline text-black group-hover:text-blue-600">
                                                {row.title}
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4 text-gray-700">{row.donator}</td>
                                        <td className="py-4 px-4 text-gray-700">{row.origin}</td>
                                        <td className="py-4 px-4 text-gray-500">{row.date}</td>
                                        <td className="py-4 px-4 text-gray-600 capitalize">{row.type}</td>
                                        <td className="py-4 px-4">
                                            <span className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${getStatusStyles(row.rawStatus)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-gray-500">{row.maintenance}</td>
                                        <td className="py-4 px-4 text-gray-600 capitalize">{row.expiration}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination Footer ── */}
                {!loading && totalPages > 1 && (
                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                            Showing page {currentPage} of {totalPages} ({sortedData.length} total items)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}