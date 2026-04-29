import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/authContext';
import { useSSE } from './hooks/useSSE';
import { Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Onboard from './pages/Onboard';
import SetupAccount from './pages/SetupAccount';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/MainLayout';
import Management from './pages/Management';
import Profile from './pages/Profile';
import Intakes from './pages/Intakes';
import Accessions from './pages/Accessions';
import Inventory from './pages/Inventory';
import Home from './pages/Home';

function App() {
    const navigate = useNavigate();
    
    const { user, localLogout } = useAuth();

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

            {/* Protected Shell */}
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/intakes" element={<Intakes />} />
                    <Route path="/accessions" element={<Accessions />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/management" element={<Management />} />
                    <Route path="/settings" element={<Profile />} />
                    {/* <Route path="/audit-logs" element={<AuditLogs />} /> */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default App;