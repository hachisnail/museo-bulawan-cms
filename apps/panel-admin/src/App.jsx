import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/authContext';
import { useSSE } from './hooks/useSSE';
import { Navigate } from 'react-router-dom';
import { useUmami } from './hooks/useUmami';

import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Onboard from './pages/Onboard';
import SetupAccount from './pages/SetupAccount';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/MainLayout';
import { ManagementPage, ManagementUserPage } from './pages/management/index.js';
import Profile from './pages/Profile';
import { IntakesPage, IntakePage, OfferPage, IntakeManualNewPage } from './pages/intakes/index.js';
import { AccessionsPage, AccessionPage } from './pages/accessions';
import { InventoryPage, InventoryItemPage } from './pages/inventory';
import Home from './pages/Home';
import Analytics from './pages/Analytics';
import SubmissionViewer from './pages/SubmissionViewer';
import Constituents from './pages/Constituents';
import Exhibitions from './pages/Exhibitions';
import ArticlesCMS from './pages/ArticlesCMS';
import { SettingsPage } from './pages/settings/index.js';
import { AuditLogsPage } from './pages/audit-logs/index.js';
import Locations from './pages/Locations';

import { AcquisitionsPage } from './pages/acquisitions';
import { FormsPage } from './pages/forms';
import PublicFormViewer from './pages/PublicFormViewer';

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const { track } = useUmami();

    const { user, localLogout } = useAuth();

    // Log route changes; Umami also auto-tracks page views via its script.
    useEffect(() => {
        console.log('[Umami] Page view:', location.pathname);
        track('admin_page_visit', { path: location.pathname });
    }, [location.pathname]);

    useSSE(user ? {
        'force_logout': (data) => {
            alert(data.message); 
            
            // FIX: Only wipe the local UI state. 
            // Do NOT send a /logout request to the backend!
            localLogout(); 
            navigate('/login');
        },
        'connected': (data) => {
            console.log("Joined realtime channels:", data.channels);
        }
    } : {});

    return (
<Routes>
            {/* Public Routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboard" element={<Onboard />} />
            <Route path="/setup" element={<SetupAccount />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forms/display/:slug" element={<PublicFormViewer />} />

            {/* Protected Shell */}
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    {/* <Route path="/dashboard" element={<AcquisitionsPage />} /> */}

                    <Route path="/intakes" element={<IntakesPage />} />
                    <Route path="/intakes/new" element={<IntakeManualNewPage />} />
                    <Route path="/intakes/offers/:id" element={<OfferPage />} />
                    <Route path="/intakes/:id" element={<IntakePage />} />
                    <Route path="/accessions" element={<AccessionsPage />} />
                    <Route path="/accessions/:id" element={<AccessionPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/inventory/:id" element={<InventoryItemPage />} />
                    <Route path="/management" element={<ManagementPage />} />
                    <Route path="/management/:id" element={<ManagementUserPage />} />
                    <Route path="/constituents" element={<Constituents />} />
                    <Route path="/exhibitions" element={<Exhibitions />} />
                    <Route path="/locations" element={<Locations />} />
                    <Route path="/articles" element={<ArticlesCMS />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/forms" element={<FormsPage />} />
                    <Route path="/admin/forms/submissions/:id" element={<SubmissionViewer />} />
                    <Route path="/forms/proof/:id" element={<SubmissionViewer />} />
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default App;