import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import Modal from '../../../components/Modal';
import { DataTable, SidebarDashboard } from '../../../components';
import MoaDialog from '../../../components/Intakes/MoaDialog';

import { offersColumns, intakesColumns, archiveColumns } from '../components/IntakeColumns';
import { getSidebarStats, getSidebarTitle, getSidebarCount } from '../components/IntakeStats';

export default function IntakesIndex() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('intakes');

    // --- Tab — initialised from URL so page refreshes restore context ---
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get('tab');
        return ['submissions', 'intakes', 'archive'].includes(tab) ? tab : 'submissions';
    });

    // --- Modal ---
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert', variant: 'info',
        onConfirm: null, promptValue: ''
    });

    // --- Data ---
    const [intakes,     setIntakes]     = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [tabLoading,  setTabLoading]  = useState(false);

    // Verify-delivery dialog (only remaining MoaDialog use on the index page)
    const [moaDraft, setMoaDraft] = useState(null);

    // --- Table state ---
    const [currentPage,  setCurrentPage]  = useState(1);
    const itemsPerPage = 5;
    const [sortConfig,   setSortConfig]   = useState({ key: null, direction: null });
    const [tableFilters, setTableFilters] = useState({ search: '', date: '' });

    // ------------------------------------------------------------------ //
    //  Data fetching
    // ------------------------------------------------------------------ //
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [iRes, sRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/intakes?expand=donation_item_id'),
                apiFetch('/api/v1/forms/admin/submissions?status=pending&expand=form_id')
            ]);
            const iJson = await iRes.json();
            const sJson = await sRes.json();

            if (iJson.status === 'success') setIntakes(iJson.data.items);

            if (sJson.status === 'success') {
                const enriched = sJson.data.items.map(s => {
                    let parsedData = {};
                    if (s.data && typeof s.data === 'string') {
                        try { parsedData = JSON.parse(s.data); } catch (e) {}
                    } else if (s.data && typeof s.data === 'object') {
                        parsedData = s.data;
                    }
                    return { ...s, parsedData };
                });
                setSubmissions(
                    enriched.filter(s =>
                        s.form_slug === 'donation-form' || s.expand?.form_id?.type === 'donation'
                    )
                );
            }
        } catch (err) {
            console.error('Failed to fetch intake data', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (events.length > 0) fetchData(true); }, [events, fetchData]);

    // Tab shimmer — masks column layout shift when switching tabs
    useEffect(() => {
        setTabLoading(true);
        const t = setTimeout(() => setTabLoading(false), 300);
        return () => clearTimeout(t);
    }, [activeTab]);

    // Reset page on filter/sort/tab change
    useEffect(() => { setCurrentPage(1); }, [activeTab, sortConfig, tableFilters]);

    // ------------------------------------------------------------------ //
    //  Table data mapping
    // ------------------------------------------------------------------ //
    const tableData = useMemo(() => {
        if (activeTab === 'submissions') {
            return submissions
                .filter(s => s.status !== 'archived')
                .map(s => {
                    const pd = s.parsedData || {};
                    const isAnon = pd.is_anonymous === true;
                    const fullName = `${pd.donor_first_name || ''} ${pd.donor_last_name || ''}`.trim();
                    const title = pd.artifact_name || (isAnon ? 'Anonymous Offer' : fullName) || s.submitted_by || 'Anonymous Offer';
                    const donor = isAnon ? 'Anonymous' : fullName || s.submitted_by || 'Anonymous';
                    const dateVal = s.created || s.created_at;
                    return {
                        id: s.id, type: 'submission', title, donor,
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        form_type: s.form_title || s.expand?.form_id?.title || 'Standard Submission',
                        status: s.status, rawItem: s
                    };
                });
        }

        if (activeTab === 'intakes') {
            return intakes
                .filter(i => i.status !== 'rejected')
                .map(i => {
                    const dateVal = i.created || i.created_at;
                    return {
                        id: i.id, type: 'intake',
                        title: i.proposed_item_name,
                        donor: i.donor_info || i.source_info || 'Unknown',
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        location: i.current_location || 'Not Specified',
                        status: i.status, rawItem: i
                    };
                });
        }

        // archive — mix of rejected intakes + archived submissions
        const subArchived = submissions.filter(s => s.status === 'archived').map(s => {
            const pd = s.parsedData || {};
            const isAnon = pd.is_anonymous === true;
            const fullName = `${pd.donor_first_name || ''} ${pd.donor_last_name || ''}`.trim();
            const title = pd.artifact_name || (isAnon ? 'Anonymous Offer' : fullName) || s.submitted_by || 'Anonymous Offer';
            const donor = isAnon ? 'Anonymous' : fullName || s.submitted_by || 'Anonymous';
            const dateVal = s.created || s.created_at;
            return {
                id: s.id, type: 'submission', title, donor,
                date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                rawDate: dateVal, record_type: 'Offer', status: s.status, rawItem: s
            };
        });

        const intakeArchived = intakes.filter(i => i.status === 'rejected').map(i => {
            const dateVal = i.created || i.created_at;
            return {
                id: i.id, type: 'intake',
                title: i.proposed_item_name,
                donor: i.donor_info || i.source_info || 'Unknown',
                date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                rawDate: dateVal, record_type: 'Intake', status: i.status, rawItem: i
            };
        });

        return [...subArchived, ...intakeArchived];
    }, [activeTab, submissions, intakes]);

    // ------------------------------------------------------------------ //
    //  Filter → Sort → Paginate
    // ------------------------------------------------------------------ //
    const filteredData = useMemo(() => {
        let result = [...tableData];
        if (tableFilters.search) {
            const q = tableFilters.search.toLowerCase();
            result = result.filter(item =>
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.donor && item.donor.toLowerCase().includes(q))
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

    const totalPages   = Math.ceil(sortedData.length / itemsPerPage);
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
        const value = label === 'Offers' ? 'submissions' : (label === 'Intakes' ? 'intakes' : 'archive');
        setActiveTab(value);
        setSearchParams({ tab: value });
    };

    // Row click — submissions (offers) get their own dedicated route
    const handleRowClick = useCallback((row) => {
        if (row.type === 'submission') {
            navigate(`/intakes/offers/${row.id}?tab=${activeTab}`);
        } else {
            navigate(`/intakes/${row.id}?tab=${activeTab}`);
        }
    }, [navigate, activeTab]);

    // ------------------------------------------------------------------ //
    //  Derived display values
    // ------------------------------------------------------------------ //
    const myTabs       = ['Offers', 'Intakes', 'Archive'];
    const currentTabLabel = activeTab === 'submissions' ? 'Offers' : (activeTab === 'intakes' ? 'Intakes' : 'Archive');
    const activeColumns   = activeTab === 'submissions' ? offersColumns : (activeTab === 'intakes' ? intakesColumns : archiveColumns);

    const sidebarStats = getSidebarStats({ activeTab, submissions, intakes });
    const sidebarTitle = getSidebarTitle(activeTab);
    const sidebarCount = getSidebarCount({ activeTab, submissions, intakes });

    // ------------------------------------------------------------------ //
    //  Render
    // ------------------------------------------------------------------ //
    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <section className="flex justify-between items-end border-b border-gray-100 pb-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Intakes</h1>
                    <p className="text-sm text-gray-500 mt-1">Evaluate, review, and process artifact intake.</p>
                </div>
                <button
                    onClick={() => setMoaDraft({ isVerifyModal: true })}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify Delivery
                </button>
            </section>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-2 items-start">
                <SidebarDashboard
                    tabs={myTabs}
                    activeTab={currentTabLabel}
                    onTabChange={handleTabChange}
                    showAddButton={activeTab === 'intakes'}
                    addButtonText="Add Manual Intake"
                    onAddClick={() => navigate('/intakes/new')}
                    statsTitle={sidebarTitle}
                    statsCount={sidebarCount}
                    stats={sidebarStats}
                    isLoading={tabLoading}
                />

                <div className="flex-1 w-full min-w-0">
                    <DataTable
                        columns={activeColumns}
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

            {/* Verify-delivery dialog — triggered by header button only */}
            {moaDraft && (
                <MoaDialog
                    moaDraft={moaDraft}
                    onClose={() => setMoaDraft(null)}
                    apiFetch={apiFetch}
                    setModal={setModal}
                    fetchData={fetchData}
                    setSelected={() => {}}
                />
            )}

            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
                onInputChange={(val) => setModal({ ...modal, promptValue: val })}
                inputValue={modal.promptValue}
            />
        </div>
    );
}
