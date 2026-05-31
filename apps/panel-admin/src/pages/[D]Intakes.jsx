import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import Modal from '../components/Modal';

import { DataTable, SidebarDashboard } from '../components';
import IntakeDetail, { STATUS_STYLES } from '../components/Intakes/IntakeDetail';
import ManualIntakeForm from '../components/Intakes/ManualIntakeForm';
import MoaDialog from '../components/Intakes/MoaDialog';

export default function Intakes() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('intakes');
    const [activeTab, setActiveTab] = useState('submissions');
    
    // Custom Modal State
    const [modal, setModal] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        type: 'alert', 
        variant: 'info', 
        onConfirm: null, 
        promptValue: '' 
    });
    
    const [locations, setLocations] = useState([]);
    const [showLocationSelect, setShowLocationSelect] = useState(false);
    
    // Lists
    const [intakes, setIntakes] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    
    // States
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [selected, setSelected] = useState(null); 
    const [moaDraft, setMoaDraft] = useState(null);
    const [isRegistering, setIsRegistering] = useState(false);


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
                        try { parsedData = JSON.parse(s.data); } catch(e) {}
                    } else if (s.data && typeof s.data === 'object') {
                        parsedData = s.data;
                    }
                    return { ...s, parsedData };
                });
                const donationOnly = enriched.filter(s => 
                    s.form_slug === 'donation-form' || 
                    s.expand?.form_id?.type === 'donation'
                );
                setSubmissions(donationOnly);
            }

            const lRes = await apiFetch('/api/v1/acquisitions/locations');
            const lJson = await lRes.json();
            if (lJson.status === 'success') setLocations(lJson.data);
        } catch (err) {
            console.error("Failed to fetch acquisition data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    const handleSelectRecord = useCallback(async (type, item, updateUrl = true) => {
        setActionLoading(true);
        setIsRegistering(false); 
        
        if (updateUrl) {
            setSearchParams({ id: item.id, tab: activeTab });
        }
        
        try {
            let endpoint = type === 'submission' 
                ? `/api/v1/forms/admin/submissions/${item.id}` 
                : `/api/v1/acquisitions/intakes/${item.id}?expand=donation_item_id,donor_account_id,submission_id`;
            let mediaType = type === 'submission' ? 'submission' : 'intake';

            const res = await apiFetch(endpoint);
            const json = await res.json();
            
            if (json.status === 'success') {
                try {
                    const mRes = await apiFetch(`/api/v1/media/${mediaType}/${item.id}`);
                    const mData = await mRes.json();
                    
                    if (type === 'submission') {
                        const sub = json.data.submission;
                        if (sub && typeof sub.data === 'string') {
                            try {
                                sub.data = JSON.parse(sub.data);
                            } catch (e) {
                                console.error("Error parsing submission data JSON", e);
                            }
                        }
                        setSelected({ type, data: sub, items: json.data.items, media: mData.data?.items || [] });
                    } else {
                        setSelected({ type, data: json.data, media: mData.data?.items || [] });
                    }
                } catch (e) {
                    let sub = type === 'submission' ? json.data.submission : json.data;
                    if (type === 'submission' && sub && typeof sub.data === 'string') {
                        try {
                            sub.data = JSON.parse(sub.data);
                        } catch (err2) {}
                    }
                    setSelected({ type, data: sub, media: [] });
                }
            }
        } catch (err) {
            console.error("Failed to fetch details", err);
        } finally {
            setActionLoading(false);
        }
    }, [apiFetch, activeTab, setSearchParams]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (events.length > 0) fetchData(true);
    }, [events, fetchData]);

    // Handle initial selection from URL params
    useEffect(() => {
        const id = searchParams.get('id');
        const tab = searchParams.get('tab');
        
        if (id) {
            let item = null;
            let type = 'intake';
            let targetTab = null;

            // 1. Try to find in submissions
            const subItem = submissions.find(s => s.id === id);
            if (subItem) {
                item = subItem;
                type = 'submission';
                targetTab = 'submissions';
            } else {
                // 2. Try to find in intakes
                const intakeItem = intakes.find(i => i.id === id);
                if (intakeItem) {
                    item = intakeItem;
                    type = 'intake';
                    targetTab = (intakeItem.status === 'rejected' || intakeItem.status === 'accessioned') ? 'archive' : 'intakes';
                }
            }

            if (targetTab) {
                if (activeTab !== targetTab) {
                    setActiveTab(targetTab);
                } else if (item && selected?.data?.id !== id) {
                    handleSelectRecord(type, item, false);
                }
            }
        } else if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, intakes, submissions, activeTab, selected, handleSelectRecord]);

    const handleManualRegisterSubmit = async (formData) => {
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/intakes/internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || 'Failed to create intake');
            setIsRegistering(false);
            fetchData();
        } catch (error) {
            setModal({ 
                isOpen: true, 
                title: 'Error', 
                message: error.message || 'Error creating record.', 
                type: 'alert', 
                variant: 'error' 
            });
        } finally {
            setActionLoading(false);
        }
    };

    const executeAction = async (id, action, body = {}) => {
        setModal({ ...modal, isOpen: false });
        setActionLoading(true);
        try {
            if (action === 'approve_and_generate') {
                const appRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/approve`, { method: 'POST' });
                if (!appRes.ok) {
                    const json = await appRes.json();
                    throw new Error(json.message || json.error || 'Failed to approve intake');
                }
                
                const moaRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/generate-moa`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const json = await moaRes.json();
                if (moaRes.ok) setMoaDraft(json);
                else throw new Error(json.message || json.error || 'Failed to generate MOA');
            } else if (action === 'accept_and_issue') {
                const res = await apiFetch(`/api/v1/acquisitions/intakes/external/${id}/accept-and-issue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const json = await res.json();
                if (res.ok) {
                    setMoaDraft(json);
                    fetchData();
                } else {
                    throw new Error(json.message || json.error || 'Failed to accept and issue documents');
                }
            } else {
                let endpoint = '';
                if (selected.type === 'submission') {
                    if (action === 'process') endpoint = `/api/v1/acquisitions/intakes/external/${id}`;
                    else if (action === 'reject') endpoint = `/api/v1/acquisitions/submissions/${id}/reject`;
                    else if (action === 'reopen') endpoint = `/api/v1/acquisitions/submissions/${id}/reopen`;
                } else {
                    endpoint = `/api/v1/acquisitions/intakes/${id}/${action === 'moa' ? 'generate-moa' : (action === 'delivery' ? 'confirm-delivery' : action)}`;
                }
                
                if (action === 'accession') endpoint = `/api/v1/acquisitions/accessions/from-intake/${id}`;

                const res = await apiFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const json = await res.json();
                
                if (res.ok) {
                    if (action === 'moa') setMoaDraft(json);
                    else { fetchData(); setSelected(null); }
                } else {
                    if (res.status === 409) {
                        setModal({
                            isOpen: true,
                            title: 'Conflict Detected',
                            message: `This record was modified by another staff member while you were editing.
                            
Current Database Values:
${json.currentRecord ? JSON.stringify(json.currentRecord, null, 2) : 'Record has been updated.'}

Would you like to reload the latest record and try again?`,
                            type: 'confirm',
                            variant: 'warning',
                            onConfirm: () => {
                                if (json.currentRecord) {
                                    handleSelectRecord(selected.type, json.currentRecord, true);
                                    fetchData(true);
                                } else {
                                    fetchData();
                                    setSelected(null);
                                }
                            }
                        });
                    } else {
                        setModal({
                            isOpen: true,
                            title: 'Action Failed',
                            message: json.error || json.message || 'The requested operation could not be completed.',
                            type: 'alert',
                            variant: 'error'
                        });
                    }
                }
            }
        } catch (err) {
            setModal({ 
                isOpen: true, 
                title: 'Error', 
                message: err.message || 'System request failed.', 
                type: 'alert', 
                variant: 'error' 
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (id, action, body = {}) => {
        const skipConfirm = ['moa', 'approve_and_generate', 'accept_and_issue'];
        if (!skipConfirm.includes(action)) {
            setModal({
                isOpen: true,
                title: 'Confirm Action',
                message: `Are you sure you want to proceed with: ${action.replace(/-/g, ' ')}?`,
                type: 'confirm',
                onConfirm: () => executeAction(id, action, body)
            });
            return;
        }
        executeAction(id, action, body);
    };

    // --- TABLE COLUMNS & MAPPINGS ---
    const offersColumns = [
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

    const intakesColumns = [
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

    const archiveColumns = [
        { key: 'date', label: 'Date Logged' },
        { key: 'title', label: 'Proposed Item Name', isBold: true },
        { key: 'donor', label: 'Donor / Source' },
        { 
            key: 'record_type', 
            label: 'Record Type',
            render: (val) => (
                <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${val === 'Offer' ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-[#D4AF37]/5 border-[#D4AF37]/20 text-[#A68A27]'}`}>
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


    const tableData = useMemo(() => {
        let list = [];
        if (activeTab === 'submissions') {
            list = submissions
                .filter(s => s.status !== 'archived')
                .map(s => {
                    const title = s.parsedData?.artifact_name || 
                        (s.parsedData?.is_anonymous === true ? 'Anonymous Offer' : `${s.parsedData?.donor_first_name || ''} ${s.parsedData?.donor_last_name || ''}`.trim()) || 
                        s.submitted_by || 'Anonymous Offer';
                    const donor = s.parsedData?.is_anonymous === true ? 'Anonymous' : `${s.parsedData?.donor_first_name || ''} ${s.parsedData?.donor_last_name || ''}`.trim() || s.submitted_by || 'Anonymous';
                    const dateVal = s.created || s.created_at;
                    return {
                        id: s.id,
                        type: 'submission',
                        title,
                        donor,
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        form_type: s.form_title || s.expand?.form_id?.title || 'Standard Submission',
                        status: s.status,
                        rawItem: s
                    };
                });
        } else if (activeTab === 'intakes') {
            list = intakes
                .filter(i => i.status !== 'rejected')
                .map(i => {
                    const dateVal = i.created || i.created_at;
                    return {
                        id: i.id,
                        type: 'intake',
                        title: i.proposed_item_name,
                        donor: i.donor_info || i.source_info || 'Unknown',
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        location: i.current_location || 'Not Specified',
                        status: i.status,
                        rawItem: i
                    };
                });
        } else if (activeTab === 'archive') {
            const subArchived = submissions
                .filter(s => s.status === 'archived')
                .map(s => {
                    const title = s.parsedData?.artifact_name || 
                        (s.parsedData?.is_anonymous === true ? 'Anonymous Offer' : `${s.parsedData?.donor_first_name || ''} ${s.parsedData?.donor_last_name || ''}`.trim()) || 
                        s.submitted_by || 'Anonymous Offer';
                    const donor = s.parsedData?.is_anonymous === true ? 'Anonymous' : `${s.parsedData?.donor_first_name || ''} ${s.parsedData?.donor_last_name || ''}`.trim() || s.submitted_by || 'Anonymous';
                    const dateVal = s.created || s.created_at;
                    return {
                        id: s.id,
                        type: 'submission',
                        title,
                        donor,
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        record_type: 'Offer',
                        status: s.status,
                        rawItem: s
                    };
                });
            const intakeArchived = intakes
                .filter(i => i.status === 'rejected')
                .map(i => {
                    const dateVal = i.created || i.created_at;
                    return {
                        id: i.id,
                        type: 'intake',
                        title: i.proposed_item_name,
                        donor: i.donor_info || i.source_info || 'Unknown',
                        date: dateVal ? new Date(dateVal).toLocaleDateString() : '',
                        rawDate: dateVal,
                        record_type: 'Intake',
                        status: i.status,
                        rawItem: i
                    };
                });
            list = [...subArchived, ...intakeArchived];
        }
        return list;
    }, [activeTab, submissions, intakes]);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [tableFilters, setTableFilters] = useState({ search: '', date: '' });

    // Reset page to 1 on tab, sort, or filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, sortConfig, tableFilters]);

    useEffect(() => {
        setTabLoading(true);
        const timer = setTimeout(() => {
            setTabLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [activeTab]);



    const activeColumns = activeTab === 'submissions' ? offersColumns : (activeTab === 'intakes' ? intakesColumns : archiveColumns);

    const filteredData = useMemo(() => {
        let result = [...tableData];

        // Filter by Search Query
        if (tableFilters.search) {
            const lowerSearch = tableFilters.search.toLowerCase();
            result = result.filter(item => 
                (item.title && item.title.toLowerCase().includes(lowerSearch)) || 
                (item.donor && item.donor.toLowerCase().includes(lowerSearch))
            );
        }

        // Filter by Date Selector
        if (tableFilters.date) {
            const targetDateStr = new Date(tableFilters.date).toDateString();
            result = result.filter(item => {
                if (!item.rawDate) return false;
                return new Date(item.rawDate).toDateString() === targetDateStr;
            });
        }

        return result;
    }, [tableData, tableFilters]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig !== null && sortConfig.key) {
            sortableItems.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                if (sortConfig.key === 'date') {
                    valA = a.rawDate ? new Date(a.rawDate) : new Date(0);
                    valB = b.rawDate ? new Date(b.rawDate) : new Date(0);
                } else {
                    valA = valA ? valA.toString().toLowerCase() : '';
                    valB = valB ? valB.toString().toLowerCase() : '';
                }
                
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            sortableItems.sort((a, b) => {
                const dateA = a.rawDate ? new Date(a.rawDate) : new Date(0);
                const dateB = b.rawDate ? new Date(b.rawDate) : new Date(0);
                return dateB - dateA;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage]);

    const handleQueryChange = useCallback((filters) => {
        setTableFilters(prev => {
            if (prev.search === filters.search && prev.date === filters.date) {
                return prev;
            }
            return filters;
        });
    }, []);


    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null; 
            key = null; 
        }
        setSortConfig({ key, direction });
    };

    // Sidebar Stats Calculation
    const offersCount = submissions.filter(s => s.status !== 'archived').length;
    const pendingOffersCount = submissions.filter(s => s.status === 'pending' || s.status === 'under_review').length;

    const activeIntakesList = intakes.filter(i => i.status !== 'rejected');
    const intakesCount = activeIntakesList.length;
    const awaitingDeliveryCount = activeIntakesList.filter(i => i.status === 'awaiting_delivery').length;
    const inCustodyCount = activeIntakesList.filter(i => i.status === 'in_custody').length;
    const approvedIntakesCount = activeIntakesList.filter(i => i.status === 'approved' || i.status === 'processed' || i.status === 'accessioned').length;

    const archivedSubmissionsCount = submissions.filter(s => s.status === 'archived').length;
    const rejectedIntakesCount = intakes.filter(i => i.status === 'rejected').length;
    const archiveCount = archivedSubmissionsCount + rejectedIntakesCount;

    const getSidebarStats = () => {
        if (activeTab === 'submissions') {
            return [
                // { label: 'Pending Review', count: pendingOffersCount, bgClass: 'bg-amber-50/50', badgeClass: 'bg-amber-100 text-amber-800' }
            ];
        } else if (activeTab === 'intakes') {
            return [
                { label: 'Awaiting Delivery', count: awaitingDeliveryCount, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-100 text-zinc-800' },
                { label: 'In Custody', count: inCustodyCount, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-200 text-zinc-900' },
                { label: 'Approved & Accessioned', count: approvedIntakesCount, bgClass: 'bg-green-50/50', badgeClass: 'bg-green-100 text-green-800' }
            ];
        } else {
            return [
                { label: 'Archived Offers', count: archivedSubmissionsCount, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-100 text-zinc-600' },
                { label: 'Rejected Intakes', count: rejectedIntakesCount, bgClass: 'bg-red-50/50', badgeClass: 'bg-red-100 text-red-800' }
            ];
        }
    };

    const sidebarTitle = activeTab === 'submissions' ? 'Total Offers' : (activeTab === 'intakes' ? 'Total Intakes' : 'Archived Items');
    const sidebarCount = activeTab === 'submissions' ? offersCount : (activeTab === 'intakes' ? 'intakesCount' : archiveCount);

    const myTabs = ['Offers', 'Intakes', 'Archive'];
    const currentTabLabel = activeTab === 'submissions' ? 'Offers' : (activeTab === 'intakes' ? 'Intakes' : 'Archive');
    
    const handleTabChange = (label) => {
        const value = label === 'Offers' ? 'submissions' : (label === 'Intakes' ? 'intakes' : 'archive');
        setActiveTab(value);
        setSelected(null);
        setIsRegistering(false);
        setSearchParams({ tab: value });
    };

    const myFilters = ['Filter..', 'By Date', 'By Status'];
    const myActions = ['All Actions', 'Export to CSV'];

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <section className="flex justify-between items-end border-b border-gray-100 pb-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Intakes</h1>
                    <p className="text-sm text-gray-500 mt-1">Evaluate, review, and process artifact intake.</p>
                </div>
                <button 
                    onClick={() => { setMoaDraft({ isVerifyModal: true }); }}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Verify Delivery
                </button>
            </section>      

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-2 items-start">
                <SidebarDashboard 
                    tabs={myTabs}
                    activeTab={currentTabLabel} 
                    onTabChange={handleTabChange} 
                    showAddButton={activeTab === 'intakes' && !isRegistering}
                    addButtonText="Add Manual Intake"
                    onAddClick={() => { setIsRegistering(true); setSelected(null); }}
                    statsTitle={sidebarTitle}
                    statsCount={sidebarCount === 'intakesCount' ? intakesCount : sidebarCount}
                    stats={getSidebarStats()}
                    isLoading={tabLoading}
                />
                
                <div className="flex-1 w-full min-w-0">
                    {isRegistering ? (
                        <ManualIntakeForm 
                            actionLoading={actionLoading}
                            onSubmit={handleManualRegisterSubmit}
                            onCancel={() => setIsRegistering(false)}
                        />
                    ) : selected ? (
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={() => { setSelected(null); setSearchParams({ tab: activeTab }); }}
                                className="self-start text-sm font-semibold text-gray-600 hover:text-black transition-colors flex items-center gap-1 mb-2"
                            >
                                <span>←</span> Back to Registry
                            </button>
                            <IntakeDetail 
                                selected={selected}
                                locations={locations}
                                showLocationSelect={showLocationSelect}
                                setShowLocationSelect={setShowLocationSelect}
                                apiFetch={apiFetch}
                                handleSelectRecord={handleSelectRecord}
                                handleAction={handleAction}
                                actionLoading={actionLoading}
                                setModal={setModal}
                            />
                        </div>
                    ) : (
                        <DataTable 
                            columns={activeColumns} 
                            data={paginatedData} 
                            onQueryChange={handleQueryChange} 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            showExtraActions={true}
                            filterOptions={myFilters}
                            actionOptions={myActions}
                            sortConfig={sortConfig}
                            onSort={requestSort}
                            isExpandable={false} 
                            isLoading={loading || tabLoading}
                            isUpdating={actionLoading}
                            onRowClick={(row) => handleSelectRecord(row.type, row.rawItem, true)}
                        />
                    )}
                </div>
            </div>

            {moaDraft && (
                <MoaDialog 
                    moaDraft={moaDraft}
                    onClose={() => setMoaDraft(null)}
                    apiFetch={apiFetch}
                    setModal={setModal}
                    fetchData={fetchData}
                    setSelected={setSelected}
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