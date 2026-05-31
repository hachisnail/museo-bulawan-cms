// apps/panel-admin/src/pages/management/pages/ManagementIndex.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import Modal from '../../../components/Modal';
import { DataTable } from '../../../components';
import InviteModal from '../components/InviteModal';
import { UserPlus } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Badge Styles
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_STYLES = {
    admin: 'bg-rose-50 border-rose-100 text-rose-600',
    curator: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    registrar: 'bg-blue-50 border-blue-100 text-blue-600',
    conservator: 'bg-amber-50 border-amber-100 text-amber-600',
    inventory_staff: 'bg-teal-50 border-teal-100 text-teal-600',
    content_editor: 'bg-purple-50 border-purple-100 text-purple-600',
    content_writer: 'bg-pink-50 border-pink-100 text-pink-600',
    appointment_coordinator: 'bg-orange-50 border-orange-100 text-orange-600',
    donor: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    visitor: 'bg-zinc-50 border-zinc-200 text-zinc-600'
};

const STATUS_STYLES = {
    active: 'text-green-700 bg-green-50 border-green-200',
    deactivated: 'text-rose-700 bg-rose-50 border-rose-200',
    invited: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    pending: 'text-blue-700 bg-blue-50 border-blue-200'
};

export default function ManagementIndex() {
    const { user, apiFetch } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('users');

    // --- Tab — initialised from URL ---
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get('tab');
        return ['personnel', 'donors', 'queue'].includes(tab) ? tab : 'personnel';
    });

    // --- Modals ---
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert', variant: 'info',
        onConfirm: null, promptValue: ''
    });

    // --- Data ---
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- Table state ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [tableFilters, setTableFilters] = useState({ search: '', date: '' });

    // ─────────────────────────────────────────────────────────────────────────────
    //  Data Fetching
    // ─────────────────────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user');
            const data = await res.json();
            if (data.status === 'success') {
                const items = data.data.items || data.data || [];
                setUsers(items);
            }
        } catch (err) {
            console.error('Failed to fetch user directory', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (events.length > 0) fetchUsers(true);
    }, [events, fetchUsers]);

    // Reset page on filter/tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, tableFilters]);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Handlers
    // ─────────────────────────────────────────────────────────────────────────────
    const handleInvite = async (inviteForm, onSuccess) => {
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/user/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inviteForm)
            });
            const data = await res.json();
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Invitation dispatched successfully.', type: 'alert', variant: 'success' });
                setShowInviteModal(false);
                fetchUsers();
                if (onSuccess) onSuccess();
            } else {
                setModal({ isOpen: true, title: 'Invitation Failed', message: data.error || 'Check server logs.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Internal system fault.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey });
    };

    const handleRowClick = useCallback((row) => {
        navigate(`/management/${row.id}?tab=${activeTab}`);
    }, [navigate, activeTab]);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Columns definitions
    // ─────────────────────────────────────────────────────────────────────────────
    const columns = useMemo(() => {
        const base = [
            { 
                key: 'name', 
                label: 'Name', 
                isBold: true,
                render: (val, row) => (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 font-bold text-[10px] uppercase">
                            {(row.fname || '?')[0]}{(row.lname || '?')[0]}
                        </div>
                        <div>
                            <div className="font-bold text-black">{row.fname} {row.lname}</div>
                            <div className="text-[10px] text-zinc-400 font-mono tracking-tighter">{row.email}</div>
                        </div>
                    </div>
                )
            }
        ];

        if (activeTab === 'personnel' || activeTab === 'queue') {
            base.push({
                key: 'role',
                label: 'Role / Permissions',
                render: (val) => (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${ROLE_STYLES[val] || ROLE_STYLES.visitor}`}>
                        {val ? val.replace(/_/g, ' ') : 'Visitor'}
                    </span>
                )
            });
        }

        base.push({
            key: 'status',
            label: 'Security Status',
            render: (val) => (
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${STATUS_STYLES[val] || STATUS_STYLES.pending}`}>
                    {val}
                </span>
            )
        });

        base.push({
            key: 'created_at',
            label: activeTab === 'queue' ? 'Invite Sent' : 'Authorized On',
            render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A'
        });

        return base;
    }, [activeTab]);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Filter & Pagination
    // ─────────────────────────────────────────────────────────────────────────────
    const tableData = useMemo(() => {
        return users.filter(item => {
            if (activeTab === 'personnel') {
                return item.status !== 'invited' && item.status !== 'pending' && item.role !== 'donor';
            } else if (activeTab === 'donors') {
                return item.role === 'donor' && item.status !== 'invited' && item.status !== 'pending';
            } else { // queue
                return item.status === 'invited' || item.status === 'pending';
            }
        });
    }, [activeTab, users]);

    const filteredData = useMemo(() => {
        let result = [...tableData];
        if (tableFilters.search) {
            const q = tableFilters.search.toLowerCase();
            result = result.filter(item =>
                (`${item.fname} ${item.lname}`).toLowerCase().includes(q) ||
                (item.email && item.email.toLowerCase().includes(q)) ||
                (item.role && item.role.toLowerCase().includes(q))
            );
        }
        return result;
    }, [tableData, tableFilters]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, currentPage]);

    const handleQueryChange = useCallback((filters) => {
        setTableFilters(prev =>
            prev.search === filters.search ? prev : { ...prev, search: filters.search }
        );
    }, []);

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Block */}
            <section className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-4 mb-2 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Access Directory</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage personnel, donors, and account invites.</p>
                </div>
                {user?.role === 'admin' && (
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="bg-black hover:bg-zinc-900 text-[#D4AF37] px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md"
                    >
                        <UserPlus className="w-4 h-4" /> Invite User
                    </button>
                )}
            </section>

            {/* Horizontal Tabs Navigation */}
            <div className="flex border-b border-gray-150 gap-6">
                {[
                    { key: 'personnel', label: 'Personnel Directory' },
                    { key: 'donors', label: 'Donor Registry' },
                    { key: 'queue', label: 'Provisioning Queue' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`pb-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                            activeTab === tab.key ? 'text-black' : 'text-zinc-400 hover:text-zinc-650'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black animate-in fade-in duration-200" />
                        )}
                    </button>
                ))}
            </div>

            {/* Table Area */}
            <div className="w-full min-w-0 animate-in fade-in duration-300">
                <DataTable
                    columns={columns}
                    data={paginatedData}
                    onQueryChange={handleQueryChange}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    showExtraActions={false}
                    isExpandable={false}
                    isLoading={loading}
                    onRowClick={handleRowClick}
                />
            </div>

            <InviteModal 
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                onInvite={handleInvite}
                actionLoading={actionLoading}
            />

            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
                onInputChange={(val) => setModal({ ...modal, promptValue: val })}
                inputValue={modal.promptValue}
            />
        </div>
    );
}
