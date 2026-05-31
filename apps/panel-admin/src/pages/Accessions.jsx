import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import Modal from '../components/Modal';

import AccessionList from '../components/Accessions/AccessionList';
import AccessionDetail from '../components/Accessions/AccessionDetail';
import FinalizeModal from '../components/Accessions/FinalizeModal';

export default function Accessions() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('accessions');
    
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'
    const [accessions, setAccessions] = useState([]);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [locations, setLocations] = useState([]);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);

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
                const enrichedItems = await Promise.all(accData.data.items.map(async (item) => {
                    try {
                        const mRes = await apiFetch(`/api/v1/media/accession/${item.id}`);
                        const mData = await mRes.json();
                        return { ...item, expand: { ...item.expand, media_attachments_via_entity_id: mData.data?.items || [] } };
                    } catch (e) { return item; }
                }));
                setAccessions(enrichedItems);
            }

            if (archData.status === 'success') {
                setArchived(archData.data.items);
            }

            const lRes = await apiFetch('/api/v1/acquisitions/locations');
            const lJson = await lRes.json();
            if (lJson.status === 'success') setLocations(lJson.data);
        } catch (err) {
            console.error("Failed to fetch accession data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    // Stabilized fetcher
    const fetchArchiveMedia = useCallback(async (item) => {
        if (!item || item.mediaFetched) return;
        try {
            const accId = item.expand?.accession_id?.id;
            if (!accId) return;
            const mRes = await apiFetch(`/api/v1/media/accession/${accId}`);
            const mData = await mRes.json();
            setSelected(prev => ({
                ...prev, mediaFetched: true,
                expand: {
                    ...prev.expand,
                    accession_id: {
                        ...prev.expand.accession_id,
                        expand: { ...prev.expand.accession_id.expand, media_attachments_via_entity_id: mData.data?.items || [] }
                    }
                }
            }));
        } catch (e) { console.error("Failed to fetch archive media"); }
    }, [apiFetch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (events.length > 0) fetchData(true);
    }, [events, fetchData]);

    // Handle initial selection from URL params robustly
    useEffect(() => {
        const id = searchParams.get('id');
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
            return;
        }
        if (id) {
            const list = activeTab === 'active' ? accessions : archived;
            const item = list.find(i => i.id === id);
            if (item && selected?.id !== id) {
                setSelected(item);
                if (activeTab === 'archive') fetchArchiveMedia(item);
            }
        }
    }, [searchParams, accessions, archived, activeTab, selected, fetchArchiveMedia]);

    const handleAction = async (accessionId, action, body = {}) => {
        setActionLoading(true);
        try {
            const endpoint = action === 'approve' 
                ? `/api/v1/acquisitions/accessions/${accessionId}/approve`
                : (action === 'rollback' 
                    ? `/api/v1/acquisitions/accessions/${accessionId}/rollback`
                    : `/api/v1/acquisitions/inventory/from-accession/${accessionId}`);

            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });

            const json = await res.json();

            if (res.ok) {
                fetchData();
                setSelected(null);
                setShowFinalizeModal(false);
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
                                setSelected(json.currentRecord);
                                fetchData(true);
                            } else {
                                fetchData();
                                setSelected(null);
                            }
                            setShowFinalizeModal(false);
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
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'System request failed.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalizeSubmit = (finalizeData) => {
        handleAction(selected.id, 'finalize', finalizeData);
    };

    // Safely extract media array based on the active tab context
    const currentMedia = activeTab === 'active' 
        ? (selected?.expand?.media_attachments_via_entity_id || []) 
        : (selected?.expand?.accession_id?.expand?.media_attachments_via_entity_id || []);

    const hasPhotos = currentMedia.filter(m => m.context !== 'Signed MOA Document').length > 0;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            
            {/* --- Header --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-200 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Accessions</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light">Formal legal registration and artifact research.</p>
                </div>
            </header>

            {/* --- Main Workspace --- */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <AccessionList 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    accessions={accessions}
                    archived={archived}
                    selected={selected}
                    setSelected={setSelected}
                    loading={loading}
                    setSearchParams={setSearchParams}
                    fetchArchiveMedia={fetchArchiveMedia}
                />

                <div className="w-full lg:w-2/3">
                    <AccessionDetail 
                        selected={selected}
                        activeTab={activeTab}
                        apiFetch={apiFetch}
                        setSelected={setSelected}
                        handleAction={handleAction}
                        actionLoading={actionLoading}
                        setModal={setModal}
                        fetchData={fetchData}
                        locations={locations}
                        setShowFinalizeModal={setShowFinalizeModal}
                    />
                </div>
            </div>

            <FinalizeModal 
                isOpen={showFinalizeModal}
                onClose={() => setShowFinalizeModal(false)}
                locations={locations}
                hasPhotos={hasPhotos}
                onSubmit={handleFinalizeSubmit}
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