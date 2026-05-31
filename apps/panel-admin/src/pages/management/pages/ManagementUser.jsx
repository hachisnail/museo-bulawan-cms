// apps/panel-admin/src/pages/management/pages/ManagementUser.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { DataTable } from '../../../components';
import Modal from '../../../components/Modal';
import EditModal from '../components/EditModal';
import { ArrowLeft, Shield, Mail, LogOut, UserMinus, RefreshCw } from 'lucide-react';

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

export default function ManagementUser() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, apiFetch } = useAuth();

    // --- State ---
    const [targetUser, setTargetUser] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // --- Pagination & Search ---
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Modals ---
    const [showEditModal, setShowEditModal] = useState(false);
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert', variant: 'info',
        onConfirm: null
    });

    const returnTab = searchParams.get('tab') || 'personnel';

    // ─────────────────────────────────────────────────────────────────────────────
    //  Data Loading
    // ─────────────────────────────────────────────────────────────────────────────
    const fetchTargetUser = useCallback(async () => {
        setLoadingUser(true);
        try {
            const res = await apiFetch('/api/v1/user');
            const data = await res.json();
            if (data.status === 'success') {
                const list = data.data.items || data.data || [];
                const found = list.find(u => u.id === id);
                if (found) {
                    setTargetUser(found);
                } else {
                    setModal({ isOpen: true, title: 'Not Found', message: 'User record was not found in the directory.', type: 'alert', variant: 'error' });
                }
            }
        } catch (err) {
            console.error('Failed to load user profile details', err);
        } finally {
            setLoadingUser(false);
        }
    }, [apiFetch, id]);

    const fetchUserLogs = useCallback(async (silent = false) => {
        if (!silent) setLoadingLogs(true);
        try {
            const res = await apiFetch(
                `/api/v1/audit-logs?userId=${id}&page=${currentPage}&limit=10&search=${searchTerm}`
            );
            const data = await res.json();
            if (data.status === 'success') {
                setLogs(data.data.items || []);
                setTotalPages(data.data.totalPages || 1);
            }
        } catch (err) {
            console.error('Failed to load user logs', err);
        } finally {
            setLoadingLogs(false);
        }
    }, [apiFetch, id, currentPage, searchTerm]);

    useEffect(() => {
        fetchTargetUser();
    }, [fetchTargetUser]);

    useEffect(() => {
        fetchUserLogs();
    }, [fetchUserLogs]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Action Handlers
    // ─────────────────────────────────────────────────────────────────────────────
    const handleUpdateUser = async (userId, editForm) => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/user/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (res.ok) {
                setShowEditModal(false);
                fetchTargetUser();
                fetchUserLogs(true);
                setModal({ isOpen: true, title: 'Success', message: 'User detail credentials updated.', type: 'alert', variant: 'success' });
            } else {
                setModal({ isOpen: true, title: 'Update Failed', message: data.error || 'Check fields.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Communication issue.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeactivate = () => {
        setModal({
            isOpen: true,
            title: 'Deactivate Account',
            message: `Are you sure? This will suspend all system access for ${targetUser.fname} ${targetUser.lname} immediately.`,
            type: 'confirm',
            variant: 'error',
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/v1/user/${id}/deactivate`, { method: 'POST' });
                    if (res.ok) {
                        setModal({ isOpen: true, title: 'Suspended', message: 'User has been deactivated.', type: 'alert', variant: 'success' });
                        fetchTargetUser();
                        fetchUserLogs(true);
                    } else {
                        const data = await res.json();
                        setModal({ isOpen: true, title: 'Action Failed', message: data.error || 'Could not deactivate user.', type: 'alert', variant: 'error' });
                    }
                } catch (err) {
                    setModal({ isOpen: true, title: 'Error', message: 'Action request failed.', type: 'alert', variant: 'error' });
                }
            }
        });
    };

    const handleResendInvite = async () => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/user/${id}/resend-invite`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Invitation email resent.', type: 'alert', variant: 'success' });
                fetchTargetUser();
                fetchUserLogs(true);
            } else {
                setModal({ isOpen: true, title: 'Error', message: data.error || 'Failed to resend token.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Internal system fault.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleForceLogout = () => {
        setModal({
            isOpen: true,
            title: 'Force Session Termination',
            message: 'Are you sure you want to terminate all active sessions for this user? They will be signed out immediately.',
            type: 'confirm',
            variant: 'error',
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/v1/user/${id}/force-logout`, { method: 'POST' });
                    if (res.ok) {
                        setModal({ isOpen: true, title: 'Session Terminated', message: 'User session has been forcefully terminated.', type: 'alert', variant: 'success' });
                        fetchTargetUser();
                        fetchUserLogs(true);
                    } else {
                        const data = await res.json();
                        setModal({ isOpen: true, title: 'Action Failed', message: data.error || 'Failed to terminate session.', type: 'alert', variant: 'error' });
                    }
                } catch (err) {
                    setModal({ isOpen: true, title: 'Error', message: 'System communication fault.', type: 'alert', variant: 'error' });
                }
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────────
    //  Columns definitions
    // ─────────────────────────────────────────────────────────────────────────────
    const columns = useMemo(() => [
        {
            key: 'created_at',
            label: 'Timestamp',
            isBold: true,
            render: (val) => (
                <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-black">{new Date(val).toLocaleDateString()}</span>
                    <span className="text-[9px] font-mono text-zinc-400">{new Date(val).toLocaleTimeString()}</span>
                </div>
            )
        },
        {
            key: 'action',
            label: 'Action Type',
            render: (val) => (
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-zinc-200 bg-zinc-50 text-zinc-700`}>
                    {val ? val.replace(/_/g, ' ') : 'SYSTEM'}
                </span>
            )
        },
        {
            key: 'resource',
            label: 'Resource',
            render: (val) => <span className="font-mono text-xs text-zinc-600">{val || 'system'}</span>
        },
        {
            key: 'details',
            label: 'Summary',
            render: (val) => {
                let parsed = {};
                try { parsed = typeof val === 'string' ? JSON.parse(val) : val; } catch (e) {}
                return (
                    <p className="text-[11px] text-zinc-500 font-light italic max-w-xs truncate">
                        "{parsed?.message || parsed?.description || 'Action captured by system trail.'}"
                    </p>
                );
            }
        }
    ], []);

    const isSelf = user?.id === id;

    if (loadingUser && !targetUser) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
                <div className="text-xs uppercase tracking-widest text-zinc-400">Loading User Profile...</div>
            </div>
        );
    }

    if (!targetUser) {
        return (
            <div className="max-w-4xl mx-auto py-20 text-center space-y-6">
                <h1 className="text-2xl font-serif text-black uppercase">User Not Found</h1>
                <button onClick={() => navigate('/management')} className="text-sm text-[#D4AF37] hover:underline flex items-center justify-center gap-2 mx-auto">
                    <ArrowLeft className="w-4 h-4" /> Return to Directory
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6 lg:px-8">
            {/* Header Action bar */}
            <div>
                <button 
                    onClick={() => navigate(`/management?tab=${returnTab}`)}
                    className="text-xs text-zinc-500 hover:text-black transition-colors flex items-center gap-2 mb-4 font-bold uppercase tracking-widest"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Directory
                </button>
                <div className="flex justify-between items-start border-b border-gray-150 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-black tracking-tight">{targetUser.fname} {targetUser.lname}</h1>
                        <p className="text-sm text-zinc-500 font-mono mt-1">{targetUser.email}</p>
                    </div>
                    <div className="flex gap-3">
                        <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${ROLE_STYLES[targetUser.role] || ROLE_STYLES.visitor}`}>
                            {targetUser.role.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${STATUS_STYLES[targetUser.status] || STATUS_STYLES.pending}`}>
                            {targetUser.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Overrides Card */}
            <div className="bg-white border border-gray-150 rounded-xl p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-2 text-[#D4AF37] border-b border-gray-100 pb-3">
                    <Shield className="w-5 h-5" />
                    <h2 className="text-lg font-serif uppercase tracking-widest text-black">Security Overrides</h2>
                </div>

                <div className="flex flex-wrap gap-4">
                    <button 
                        onClick={() => setShowEditModal(true)}
                        className="px-5 py-3 border border-zinc-300 text-black rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                        <RefreshCw className="w-4 h-4 text-zinc-500" /> Modify permissions
                    </button>

                    {targetUser.status === 'invited' && (
                        <button 
                            onClick={handleResendInvite}
                            disabled={actionLoading}
                            className="px-5 py-3 border border-zinc-300 text-black rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Mail className="w-4 h-4 text-[#D4AF37]" /> Resend access invite
                        </button>
                    )}

                    {!isSelf && targetUser.status === 'active' && (
                        <button 
                            onClick={handleForceLogout}
                            className="px-5 py-3 border border-zinc-300 text-black rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors shadow-sm"
                        >
                            <LogOut className="w-4 h-4 text-amber-500" /> Force terminate sessions
                        </button>
                    )}

                    {!isSelf && targetUser.status !== 'deactivated' && (
                        <button 
                            onClick={handleDeactivate}
                            className="px-5 py-3 border border-rose-200 text-rose-600 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 hover:text-rose-700 transition-colors shadow-sm"
                        >
                            <UserMinus className="w-4 h-4 text-rose-500" /> Deactivate account
                        </button>
                    )}
                </div>
            </div>

            {/* Audit Logs Table for user */}
            <div className="space-y-4">
                <h3 className="text-sm font-serif font-bold uppercase tracking-widest text-black">
                    Action activity ledger
                </h3>

                <div className="w-full min-w-0">
                    <DataTable
                        columns={columns}
                        data={logs}
                        onQueryChange={(f) => setSearchTerm(f.search || '')}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        showExtraActions={false}
                        isExpandable={false}
                        isLoading={loadingLogs}
                    />
                </div>
            </div>

            <EditModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                user={user}
                targetUser={targetUser}
                onUpdate={handleUpdateUser}
                actionLoading={actionLoading}
            />

            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
