// apps/panel-admin/src/pages/intakes/pages/IntakeManualNew.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import Modal from '../../../components/Modal';
import ManualIntakeForm from '../../../components/Intakes/ManualIntakeForm';

export default function IntakeManualNew() {
    const navigate     = useNavigate();
    const { apiFetch } = useAuth();

    const [actionLoading, setActionLoading] = useState(false);
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert', variant: 'info'
    });

    const handleSubmit = async (formData) => {
        setActionLoading(true);
        try {
            const res  = await apiFetch('/api/v1/acquisitions/intakes/internal', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(formData)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || 'Failed to create intake');
            navigate('/intakes?tab=intakes');
        } catch (error) {
            setModal({
                isOpen: true, title: 'Error', type: 'alert', variant: 'error',
                message: error.message || 'Error creating record.'
            });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <ManualIntakeForm
                actionLoading={actionLoading}
                onSubmit={handleSubmit}
                onCancel={() => navigate('/intakes?tab=intakes')}
            />

            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}