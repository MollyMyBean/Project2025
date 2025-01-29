import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './SettingsPage.css';
import './Sidebar.css';

const defaultAvatar = '/images/default.png';

function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `http://localhost:5000${url}`;
}

function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Add a new tab => 'danger'
  // Existing tabs => 'email' | 'password' | 'payment' | 'notifications' | 'appearance'
  const [activeTab, setActiveTab] = useState('payment');

  // Email fields
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail1, setNewEmail1] = useState('');
  const [newEmail2, setNewEmail2] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cryptoAddress, setCryptoAddress] = useState('');

  // Profile Pic
  const [profilePic, setProfilePic] = useState('');

  // Display success/error messages
  const [message, setMessage] = useState('');

  // Notification states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // Appearance states
  const [darkMode, setDarkMode] = useState(false);
  const [compactLayout, setCompactLayout] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include',
        });
        if (res.status === 401) {
          navigate('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // Initialize fields from user
        setCurrentEmail(data.user.email || '');
        setProfilePic(data.user.profilePic || '');
        setPaymentMethod(data.user.paymentMethod || '');
        setCardNumber(data.user.cardNumber || '');
        setCardExp(data.user.cardExp || '');
        setCardCVC(data.user.cardCVC || '');
        setPaypalEmail(data.user.paypalEmail || '');
        setCryptoAddress(data.user.cryptoAddress || '');
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    })();

    // Check if we came back from PayPal with success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('paypalSuccess')) {
      finalizePaypalSetup();
    }
  }, [navigate]);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);

    const savedCompact = localStorage.getItem('compactLayout') === 'true';
    setCompactLayout(savedCompact);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const finalizePaypalSetup = async () => {
    try {
      setPaymentMethod('paypal');

      const res = await fetch('http://localhost:5000/api/auth/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'paypal',
          paypalEmail,
          cardNumber: '',
          cardExp: '',
          cardCVC: '',
          cryptoAddress: '',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('PayPal connected and payment method updated!');
      } else {
        setMessage(data.message || 'Error finalizing PayPal setup.');
      }
    } catch (err) {
      console.error('Finalize PayPal error:', err);
      setMessage('Server error finalizing PayPal setup.');
    }
  };

  const handleLogout = () => {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  };

  const switchTab = (tabName) => {
    setActiveTab(tabName);
    setMessage('');
  };

  // 1) Email
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!currentEmail || !newEmail1 || !newEmail2) {
      setMessage('Please fill out all email fields.');
      return;
    }
    if (newEmail1 !== newEmail2) {
      setMessage('New emails do not match.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/update-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentEmail,
          newEmail: newEmail1,
          profilePic,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Email updated successfully!');
      } else {
        setMessage(data.message || 'Error updating email.');
      }
    } catch (err) {
      console.error('Email update error:', err);
      setMessage('Server error updating email.');
    }
  };

  // 2) Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!currentPassword || !newPassword1 || !newPassword2) {
      setMessage('Please fill out all password fields.');
      return;
    }
    if (newPassword1 !== newPassword2) {
      setMessage('New passwords do not match.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/update-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword1,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Password updated successfully!');
      } else {
        setMessage(data.message || 'Error updating password.');
      }
    } catch (err) {
      console.error('Password update error:', err);
      setMessage('Server error updating password.');
    }
  };

  // 3) Payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // If user selects PayPal => "redirect" them to the flow
    if (paymentMethod === 'paypal') {
      if (!paypalEmail) {
        setMessage('Please enter a PayPal email address first.');
        return;
      }
      const successUrl = `${window.location.origin}/settings?tab=payment&paypalSuccess=1`;
      window.location.href = `https://www.sandbox.paypal.com/signin?country.x=US&locale.x=en_US&redirectUri=${encodeURIComponent(
        successUrl
      )}`;
      return;
    }

    // Otherwise, not PayPal => store data
    try {
      const res = await fetch('http://localhost:5000/api/auth/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          cardNumber,
          cardExp,
          cardCVC,
          paypalEmail: paymentMethod === 'paypal' ? paypalEmail : '',
          cryptoAddress,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Payment method updated!');
      } else {
        setMessage(data.message || 'Error updating payment method.');
      }
    } catch (err) {
      console.error('Payment update error:', err);
      setMessage('Server error updating payment.');
    }
  };

  // 4) Notifications
  const handleNotificationsSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    // For now, just show a local message. You could store in DB if needed.
    setMessage('Notification settings saved!');
  };

  // 5) Appearance => store localStorage
  const handleAppearanceSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // Save to localStorage so it persists across refreshes
    localStorage.setItem('darkMode', darkMode);
    localStorage.setItem('compactLayout', compactLayout);

    setMessage('Appearance settings saved!');
  };

  // 6) **Delete My Account** => calls new /api/auth/delete-self route
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('http://localhost:5000/api/auth/delete-self', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert('Your account has been deleted.');
        // Usually the server logs you out, but we can also redirect:
        navigate('/');
      } else {
        alert(data.message || 'Error deleting account.');
      }
    } catch (err) {
      console.error('Delete account error:', err);
      alert('Server error deleting account.');
    }
  };

  if (!user) {
    return <p style={{ padding: '1rem' }}>Loading user...</p>;
  }

  return (
    <div className="settings-page">
      {/* LEFT SIDEBAR */}
      <aside className="left-sidebar bubble-section">
        <div className="user-info-card">
          <img
            src={user?.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar}
            alt="User Avatar"
            className="user-avatar"
          />
          <h3 className="greeting">{user?.username}</h3>
        </div>
        <ul className="menu-list grow-space">
          <li>
            <Link to="/home">
              <span className="menu-icon">🏠</span> Home
            </Link>
          </li>
          <li>
            <Link to="/discover">
              <span className="menu-icon">🔎</span> Discover
            </Link>
          </li>
          <li>
            <Link to="/messages">
              <span className="menu-icon">💬</span> Messages
            </Link>
          </li>
          <li>
            <Link to="/my-profile">
              <span className="menu-icon">👤</span> Profile
            </Link>
          </li>
          <li>
            <Link to="/settings">
              <span className="menu-icon">⚙️</span> Settings
            </Link>
          </li>
        </ul>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </aside>

      {/* RIGHT => MAIN CONTENT: TABS + FORMS */}
      <div className="settings-right bubble-section">
        <div className="settings-tabs">
          <button
            className={`settings-tab-btn ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => switchTab('email')}
          >
            Email
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => switchTab('password')}
          >
            Password
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => switchTab('payment')}
          >
            Payment
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => switchTab('notifications')}
          >
            Notifications
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => switchTab('appearance')}
          >
            Appearance
          </button>
          {/* NEW Danger Zone tab */}
          <button
            className={`settings-tab-btn ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => switchTab('danger')}
            style={{ color: '#aa0000' }}
          >
            Danger Zone
          </button>
        </div>

        {message && <p className="settings-message">{message}</p>}

        <div className="settings-form-container">
          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="settings-form">
              <div className="form-group">
                <label className="form-label">Profile Picture URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter image URL..."
                  value={profilePic}
                  onChange={(e) => setProfilePic(e.target.value)}
                />
                <div className="profile-pic-preview">
                  <img src={profilePic || defaultAvatar} alt="Preview" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Current Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Current email address"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Enter new email"
                  value={newEmail1}
                  onChange={(e) => setNewEmail1(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Re-enter new email"
                  value={newEmail2}
                  onChange={(e) => setNewEmail2(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-save">Save Email</button>
            </form>
          )}

          {/* PASSWORD TAB */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="settings-form">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password"
                  value={newPassword1}
                  onChange={(e) => setNewPassword1(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-save">Save Password</button>
            </form>
          )}

          {/* PAYMENT TAB */}
          {activeTab === 'payment' && (
            <form onSubmit={handlePaymentSubmit} className="settings-form">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  <option value="creditcard">Credit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>

              {paymentMethod === 'creditcard' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Card Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration (MM/YY)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 07/25"
                      value={cardExp}
                      onChange={(e) => setCardExp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVC</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 123"
                      value={cardCVC}
                      onChange={(e) => setCardCVC(e.target.value)}
                    />
                  </div>
                </>
              )}

              {paymentMethod === 'paypal' && (
                <div className="form-group">
                  <label className="form-label">PayPal Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                  />
                </div>
              )}

              {paymentMethod === 'crypto' && (
                <div className="form-group">
                  <label className="form-label">Crypto Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0x123abc..."
                    value={cryptoAddress}
                    onChange={(e) => setCryptoAddress(e.target.value)}
                  />
                </div>
              )}

              <button type="submit" className="btn-save">
                Save Payment
              </button>
            </form>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <form onSubmit={handleNotificationsSubmit} className="settings-form">
              <h4>Notification Preferences</h4>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={() => setEmailNotifications(!emailNotifications)}
                  />
                  Email Notifications
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={() => setPushNotifications(!pushNotifications)}
                  />
                  Push Notifications
                </label>
              </div>
              <p className="tab-note">
                Choose how you want to receive updates about new content, messages, or offers.
              </p>
              <button type="submit" className="btn-save">
                Save Notifications
              </button>
            </form>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <form onSubmit={handleAppearanceSubmit} className="settings-form">
              <h4>Appearance & Layout</h4>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={() => setDarkMode(!darkMode)}
                  />
                  Enable Dark Mode
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={compactLayout}
                    onChange={() => setCompactLayout(!compactLayout)}
                  />
                  Use Compact Layout
                </label>
              </div>
              <p className="tab-note">
                Dark Mode and compact layout can improve readability or help reduce eye strain.
              </p>
              <button type="submit" className="btn-save">
                Save Appearance
              </button>
            </form>
          )}

          {/* DANGER ZONE TAB => Delete My Account */}
          {activeTab === 'danger' && (
            <div className="settings-form" style={{ backgroundColor: '#fff5f5', borderColor: '#ffcdd2' }}>
              <h4 style={{ color: '#c0392b' }}>Danger Zone</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                Deleting your account is permanent and cannot be undone. All your data will be removed.
              </p>
              <button
                onClick={handleDeleteAccount}
                style={{
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  padding: '0.6rem 1rem',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Delete My Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
