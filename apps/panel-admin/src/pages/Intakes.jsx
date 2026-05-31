import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import Modal from '../components/Modal';

import IntakeList from '../components/Intakes/IntakeList';
import IntakeDetail from '../components/Intakes/IntakeDetail';
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
            if (tab && tab !== activeTab) {
                setActiveTab(tab);
                return;
            }
            
            let item = null;
            let type = 'intake';
            
            if (activeTab === 'submissions') {
                item = submissions.find(s => s.id === id);
                type = 'submission';
            } else if (activeTab === 'intakes') {
                item = intakes.find(i => i.id === id);
                type = 'intake';
            } else if (activeTab === 'archive') {
                item = intakes.find(i => i.id === id) || submissions.find(s => s.id === id);
                type = item?.proposed_item_name ? 'intake' : 'submission';
            }
            
            if (item && selected?.data?.id !== id) {
                handleSelectRecord(type, item, false); 
            }
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

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-200 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Acquisitions</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light">Evaluate, review, and process artifact intake.</p>
                </div>
                <button 
                    onClick={() => { setMoaDraft({ isVerifyModal: true }); }}
                    className="bg-black hover:bg-zinc-800 text-white px-5 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Verify Delivery
                </button>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <IntakeList 
                    submissions={submissions}
                    intakes={intakes}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selected={selected}
                    handleSelectRecord={handleSelectRecord}
                    loading={loading}
                    setSearchParams={setSearchParams}
                    isRegistering={isRegistering}
                    setIsRegistering={setIsRegistering}
                    setSelected={setSelected}
                />

                <div className="w-full lg:w-2/3">
                    {isRegistering ? (
                        <ManualIntakeForm 
                            actionLoading={actionLoading}
                            onSubmit={handleManualRegisterSubmit}
                            onCancel={() => setIsRegistering(false)}
                        />
                    ) : (
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