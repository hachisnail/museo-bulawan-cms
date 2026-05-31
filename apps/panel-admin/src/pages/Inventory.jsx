import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import Modal from '../components/Modal';

import InventoryList from '../components/Inventory/InventoryList';
import InventoryDetail from '../components/Inventory/InventoryDetail';

export default function Inventory() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('inventory');
    
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archived'
    
    // Action State
    const [actionLoading, setActionLoading] = useState(false);
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
    
    // Detail Data
    const [movementTrails, setMovementTrails] = useState([]);
    const [healthLogs, setHealthLogs] = useState([]);
    const [valuations, setValuations] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [conservationLogs, setConservationLogs] = useState([]);
    const [exhibitionHistory, setExhibitionHistory] = useState([]);

    const fetchInventory = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/inventory?expand=accession_id.intake_id');
            const json = await res.json();
            if (json.status === 'success') {
                setInventory(json.data.items);
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

    useEffect(() => {
        if (events.length > 0) fetchInventory(true);
    }, [events, fetchInventory]);

    // Stabilized details fetcher
    const fetchDetails = useCallback(async (item, updateUrl = false) => {
        setSelected(item);
        if (updateUrl) {
            setSearchParams({ id: item.id, tab: activeTab });
        }
        try {
            const [mRes, hRes, vRes, aRes, cRes, eRes] = await Promise.all([
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/movement`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/condition-reports`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/valuations`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/audits`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/conservation`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/exhibitions`)
            ]);
            
            const mData = await mRes.json();
            const hData = await hRes.json();
            const vData = await vRes.json();
            const aData = await aRes.json();
            const cData = await cRes.json();
            const eData = await eRes.json();

            if (mData.status === 'success') setMovementTrails(mData.data.items || []);
            if (hData.status === 'success') setHealthLogs(hData.data.items || []);
            if (vData.status === 'success') setValuations(vData.data.items || []);
            if (aData.status === 'success') setAuditLogs(aData.data.items || []);
            if (cData.status === 'success') setConservationLogs(cData.data.items || []);
            if (eData.status === 'success') setExhibitionHistory(eData.data.items || []);
        } catch (err) {
            console.error("Failed to fetch detail data", err);
        }
    }, [apiFetch, activeTab, setSearchParams]);

    // Fetch locations for physical transfers
    useEffect(() => {
        apiFetch('/api/v1/acquisitions/locations')
            .then(res => res.json())
            .then(json => {
                if (json.status === 'success') setLocations(json.data);
            })
            .catch(() => {});
    }, [apiFetch]);

    // Handle initial selection from URL params robustly
    useEffect(() => {
        const id = searchParams.get('id');
        const tab = searchParams.get('tab');
        
        if (id && inventory.length > 0) {
            const item = inventory.find(i => i.id === id);
            if (item) {
                const targetTab = item.status === 'deaccessioned' ? 'archived' : 'active';
                if (activeTab !== targetTab) {
                    setActiveTab(targetTab);
                } else if (selected?.id !== id) {
                    fetchDetails(item, false);
                }
            }
        } else if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, inventory, activeTab, selected, fetchDetails]);

    const handleDeaccession = (id) => {
        setModal({
            isOpen: true,
            title: 'Deaccession Artifact',
            message: 'Provide a reason for removing this artifact from the permanent collection:',
            type: 'prompt',
            variant: 'warning',
            promptValue: '',
            onConfirm: async (reason) => {
                if (!reason) return;
                setActionLoading(true);
                try {
                    const res = await apiFetch(`/api/v1/acquisitions/inventory/${id}/deaccession`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason })
                    });
                    const json = await res.json();
                    
                    if (res.ok) {
                        setModal({ isOpen: true, title: 'Success', message: 'Artifact deaccessioned.', type: 'alert', variant: 'success' });
                        setSelected(null);
                        fetchInventory();
                    } else {
                        if (res.status === 409) {
                            handleConflict(json);
                        } else {
                            setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Operation failed.', type: 'alert', variant: 'error' });
                        }
                    }
                } catch (err) {
                    setModal({ isOpen: true, title: 'Error', message: 'Deaccession failed.', type: 'alert', variant: 'error' });
                } finally { 
                    setActionLoading(false); 
                }
            }
        });
    };
 
    const handleValuation = () => {
        setModal({
            isOpen: true,
            title: 'Add Market Valuation',
            message: 'Enter appraised value (PHP):',
            type: 'prompt',
            promptValue: '',
            onConfirm: (amount) => {
                if (!amount) return;
                setModal({
                    isOpen: true,
                    title: 'Appraisal Reason',
                    message: 'Enter valuation reason (e.g. Insurance):',
                    type: 'prompt',
                    promptValue: '',
                    onConfirm: async (reason) => {
                        if (!reason) return;
                        setActionLoading(true);
                        try {
                            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/valuations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ amount: parseFloat(amount), reason })
                            });
                            const json = await res.json();

                            if (res.ok) {
                                setModal({ isOpen: true, title: 'Success', message: 'Valuation added.', type: 'alert', variant: 'success' });
                                fetchDetails(selected, false);
                            } else {
                                if (res.status === 409) {
                                    handleConflict(json);
                                } else {
                                    setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Valuation failed.', type: 'alert', variant: 'error' });
                                }
                            }
                        } catch (err) {
                            setModal({ isOpen: true, title: 'Error', message: 'Appraisal request failed.', type: 'alert', variant: 'error' });
                        } finally { 
                            setActionLoading(false); 
                        }
                    }
                });
            }
        });
    };

    const handleMovementSubmit = async (movementData) => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movementData)
            });
            const json = await res.json();

            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Movement registered successfully.', type: 'alert', variant: 'success' });
                fetchDetails(selected, false);
                fetchInventory(true);
            } else {
                if (res.status === 409) {
                    handleConflict(json);
                } else {
                    setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Transfer failed.', type: 'alert', variant: 'error' });
                }
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Location transfer request failed.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleConflict = (json) => {
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
                    fetchDetails(json.currentRecord, true);
                    fetchInventory(true);
                } else {
                    fetchInventory();
                    setSelected(null);
                }
            }
        });
    };

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = 
            item.catalog_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.expand?.accession_id?.expand?.intake_id?.proposed_item_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'active' ? item.status !== 'deaccessioned' : item.status === 'deaccessioned';
        return matchesSearch && matchesTab;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-300 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Master Inventory</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light italic">Permanent collection registry and archival tracking.</p>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <InventoryList 
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filteredInventory={filteredInventory}
                    selected={selected}
                    fetchDetails={fetchDetails}
                    loading={loading}
                    setSearchParams={setSearchParams}
                />

                <div className="w-full lg:w-2/3">
                    <InventoryDetail 
                        selected={selected}
                        activeTab={activeTab}
                        locations={locations}
                        apiFetch={apiFetch}
                        setSelected={setSelected}
                        actionLoading={actionLoading}
                        setSearchParams={setSearchParams}
                        movementTrails={movementTrails}
                        healthLogs={healthLogs}
                        valuations={valuations}
                        auditLogs={auditLogs}
                        conservationLogs={conservationLogs}
                        exhibitionHistory={exhibitionHistory}
                        fetchDetails={fetchDetails}
                        handleDeaccession={handleDeaccession}
                        handleValuation={handleValuation}
                        handleMovementSubmit={handleMovementSubmit}
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