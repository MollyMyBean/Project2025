import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import MyProfilePage from './components/MyProfilePage';
import LandingPage from './components/LandingPage';
import RegisterPage from './components/RegisterPage';
import LoggedInPage from './components/LoggedInPage';
import MessagesPage from './components/MessagesPage';
import AdminVideoUpload from './components/AdminVideoUpload';
import ProfilePage from './components/ProfilePage';
import SettingsPage from './components/SettingsPage'; // NEW
import DiscoverPage from './components/DiscoverPage';
import MasterPage from './components/MasterPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import UserDetailsForMaster from './components/UserDetailsForMaster';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<LoggedInPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/admin/upload" element={<AdminVideoUpload />} />
        <Route path="/profile/:adminId" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} /> {/* NEW */}
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route path="/master" element={<MasterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/master/user/:userId" element={<UserDetailsForMaster />} />

      </Routes>
    </Router>
  );
}

export default App;
