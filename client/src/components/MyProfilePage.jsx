import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './MyProfilePage.css';
import './Sidebar.css';

// Helper: Convert a relative URL (e.g. "/uploads/foo.jpg") to an absolute URL.
function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

// Default avatar image – make sure public/images/default.png exists.
const defaultAvatar = '/images/default.png';

function MyProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Which tab is active: "edit" or "preview"
  const [activeTab, setActiveTab] = useState('edit');

  // Basic info fields
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [achievements, setAchievements] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);

  // Media uploads
  const [uploads, setUploads] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadIsPhoto, setUploadIsPhoto] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');

  // Profile picture and banners
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profileBannerFile, setProfileBannerFile] = useState(null);
  const [suggestedBannerFile, setSuggestedBannerFile] = useState(null);
  const [previewBannerFile, setPreviewBannerFile] = useState(null); // New field for Preview Banner

  // Admin-only fields
  const [adminPrice, setAdminPrice] = useState('');
  const [adminDiscount, setAdminDiscount] = useState('');
  const [adminBundles, setAdminBundles] = useState([]);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [bundleCoverFile, setBundleCoverFile] = useState(null);

  // Admin story upload
  const [storyFile, setStoryFile] = useState(null);

  // Status messages
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // On mount: Check session, load profile, and uploads.
  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include',
        });
        if (authRes.status === 401) {
          navigate('/');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);
        await loadMyProfile();
        if (authData.user?.id) await loadMyUploads(authData.user.id);
      } catch (err) {
        console.error('Profile load error:', err);
        setError('Server error loading profile.');
      }
    })();
  }, [navigate]);

  async function loadMyProfile() {
    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setBio(data.user.bio || '');
        setInterests(data.user.interests || '');
        setAchievements(data.user.achievements || '');
        setSocialLinks(data.user.socialLinks || []);
        if (data.user.role === 'admin') {
          setAdminPrice(data.user.adminPrice || '');
          setAdminDiscount(data.user.adminDiscount || '');
          if (data.user.adminBundles) setAdminBundles(data.user.adminBundles);
        }
      } else {
        setError(data.message || 'Error fetching your profile.');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Server error loading profile.');
    }
  }

  async function loadMyUploads(myId) {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${myId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setUploads(data.items || []);
      }
    } catch (err) {
      console.error('Fetching uploads error:', err);
    }
  }

  const handleSaveProfile = async () => {
    setMessage('');
    setError('');
    try {
      const body = { bio, interests, achievements, socialLinks };
      if (user?.role === 'admin') {
        body.adminPrice = adminPrice;
        body.adminDiscount = adminDiscount;
      }
      const res = await fetch('http://localhost:5000/api/auth/me/update-bio', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Profile info saved!');
        if (data.user) setUser(data.user);
      } else {
        setError(data.message || 'Error updating profile info.');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setError('Server error updating profile info.');
    }
  };

  const handleUploadMedia = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!uploadFile) {
      setError('Please select a file first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('mediaFile', uploadFile);
      formData.append('isPhoto', uploadIsPhoto);
      formData.append('title', uploadTitle);
      const res = await fetch('http://localhost:5000/api/profile/me/upload-media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Media uploaded!');
        setUploadFile(null);
        setUploadIsPhoto(false);
        setUploadTitle('');
        if (user?.id) await loadMyUploads(user.id);
      } else {
        setError(data.message || 'Error uploading media.');
      }
    } catch (err) {
      console.error('Upload media error:', err);
      setError('Server error uploading media.');
    }
  };

  const handleProfilePicSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!profilePicFile) {
      setError('Please select a profile pic first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('profilePic', profilePicFile);
      const res = await fetch('http://localhost:5000/api/auth/me/update-profile-pic', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Profile picture updated!');
        setUser(data.user);
      } else {
        setError(data.message || 'Error uploading profile pic.');
      }
    } catch (err) {
      console.error('Profile pic error:', err);
      setError('Server error uploading profile pic.');
    }
  };

  const handleProfileBannerSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!profileBannerFile) {
      setError('Please choose a profile banner first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('profileBanner', profileBannerFile);
      const res = await fetch('http://localhost:5000/api/auth/me/update-profile-banner', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.user) {
        setMessage('Profile banner updated!');
        setUser(data.user);
      } else {
        setError(data.message || 'Error uploading profile banner.');
      }
    } catch (err) {
      console.error('Profile banner error:', err);
      setError('Server error uploading profile banner.');
    }
  };

  const handleSuggestedBannerSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!suggestedBannerFile) {
      setError('Please choose a suggested banner first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('bannerPic', suggestedBannerFile);
      const res = await fetch('http://localhost:5000/api/auth/me/update-banner-pic', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.user) {
        setMessage('Suggested banner updated!');
        setUser(data.user);
      } else {
        setError(data.message || 'Error uploading suggested banner.');
      }
    } catch (err) {
      console.error('Suggested banner error:', err);
      setError('Server error uploading suggested banner.');
    }
  };

  // New: Handle update of the preview banner (for both normal and admin users)
  const handlePreviewBannerSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!previewBannerFile) {
      setError('Please choose a preview banner first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('previewBanner', previewBannerFile);
      const res = await fetch('http://localhost:5000/api/auth/me/update-preview-banner', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.user) {
        setMessage('Preview banner updated!');
        setUser(data.user);
      } else {
        setError(data.message || 'Error uploading preview banner.');
      }
    } catch (err) {
      console.error('Preview banner error:', err);
      setError('Server error uploading preview banner.');
    }
  };

  const handleUploadStory = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!storyFile) {
      setError('Please select a story file (image or video) first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('storyFile', storyFile);
      const res = await fetch('http://localhost:5000/api/auth/me/upload-story', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Story uploaded!');
        setStoryFile(null);
      } else {
        setError(data.message || 'Error uploading story.');
      }
    } catch (err) {
      console.error('Upload story error:', err);
      setError('Server error uploading story.');
    }
  };

  const handleCreateBundle = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!bundleTitle.trim() || !bundlePrice.trim()) {
      setError('Bundle title and price are required.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/profile/me/create-bundle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bundleTitle.trim(),
          price: parseFloat(bundlePrice) || 0,
          description: bundleDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'Error creating bundle.');
        return;
      }
      if (bundleCoverFile) {
        const updatedBundles = data.adminBundles || [];
        const newOne = updatedBundles[updatedBundles.length - 1];
        if (newOne && newOne._id) {
          const formData = new FormData();
          formData.append('bundleCover', bundleCoverFile);
          const coverRes = await fetch(
            `http://localhost:5000/api/profile/me/upload-bundle-cover/${newOne._id}`,
            { method: 'POST', credentials: 'include', body: formData }
          );
          const coverData = await coverRes.json();
          if (!coverRes.ok || coverData.status !== 'success') {
            setError(coverData.message || 'Error uploading bundle cover.');
            return;
          }
          setAdminBundles(coverData.adminBundles || []);
        }
      } else {
        setAdminBundles(data.adminBundles || []);
      }
      setMessage('Bundle created!');
      setBundleTitle('');
      setBundlePrice('');
      setBundleDesc('');
      setBundleCoverFile(null);
    } catch (err) {
      console.error('Create bundle error:', err);
      setError('Server error creating bundle.');
    }
  };

  const handleDeleteMedia = async (videoId) => {
    if (!window.confirm('Delete this media?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/profile/me/delete-media/${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Media deleted.');
        setUploads((prev) => prev.filter((u) => u._id !== videoId));
      } else {
        setError(data.message || 'Error deleting media.');
      }
    } catch (err) {
      console.error('Delete media error:', err);
      setError('Server error deleting media.');
    }
  };

  const handleLogout = () => {
    fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  };

  // --- Render functions for the Edit Dashboard ---

  // Banner Settings Card (Admins only)
  const renderBannerSettings = () => {
    if (user.role !== 'admin') return null;
    return (
      <div className="card banner-settings-card">
        <h3 className="card-title">Banner Settings</h3>
        <div className="banner-row">
          <div className="banner-section">
            <label className="form-label">Profile Banner (Feed Top)</label>
            {user.profileBanner ? (
              <img src={getFullMediaUrl(user.profileBanner)} alt="Profile Banner" className="banner-preview" />
            ) : (
              <div className="banner-preview placeholder">No Banner</div>
            )}
            <form onSubmit={handleProfileBannerSubmit} className="pic-upload-form">
              <input type="file" accept="image/*" onChange={(e) => setProfileBannerFile(e.target.files[0])} />
              <button type="submit" className="btn-submit-pic">Upload</button>
            </form>
          </div>
          <div className="banner-section">
            <label className="form-label">Suggested Creators Banner</label>
            {user.bannerPic ? (
              <img src={getFullMediaUrl(user.bannerPic)} alt="Suggested Banner" className="banner-preview" />
            ) : (
              <div className="banner-preview placeholder">No Banner</div>
            )}
            <form onSubmit={handleSuggestedBannerSubmit} className="pic-upload-form">
              <input type="file" accept="image/*" onChange={(e) => setSuggestedBannerFile(e.target.files[0])} />
              <button type="submit" className="btn-submit-pic">Upload</button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // New: Preview Banner Card (available for everyone)
  const renderPreviewBannerCard = () => (
    <div className="card preview-banner-card">
      <h3 className="card-title">Preview Banner</h3>
      <div className="preview-banner-section">
        {user.previewBanner ? (
          <img src={getFullMediaUrl(user.previewBanner)} alt="Preview Banner" className="preview-banner-img" />
        ) : (
          <div className="preview-banner-img placeholder">No Preview Banner</div>
        )}
        <form onSubmit={handlePreviewBannerSubmit} className="pic-upload-form">
          <input type="file" accept="image/*" onChange={(e) => setPreviewBannerFile(e.target.files[0])} />
          <button type="submit" className="btn-submit-pic">Update Preview Banner</button>
        </form>
      </div>
    </div>
  );

  // Dashboard Grid: Basic Info and Media (or Media & Bundles for admins)
  const renderDashboardGrid = () => (
    <div className="edit-grid">
      {/* Basic Info Card */}
      <div className="card basic-info-card">
        <h3 className="card-title">Basic Info</h3>
        <div className="profile-pic-section">
          <img src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar} alt="Profile" className="current-profile-pic" />
          <form onSubmit={handleProfilePicSubmit} className="pic-upload-form">
            <label className="pic-upload-label">
              Change Picture:
              <input type="file" accept="image/*" onChange={(e) => setProfilePicFile(e.target.files[0])} />
            </label>
            <button type="submit" className="btn-submit-pic">Upload</button>
          </form>
        </div>
        <div className="info-fields-section">
          <label className="form-label">Bio</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <label className="form-label">Interests</label>
          <textarea rows={2} value={interests} onChange={(e) => setInterests(e.target.value)} />
          <label className="form-label">Achievements</label>
          <textarea rows={2} value={achievements} onChange={(e) => setAchievements(e.target.value)} />
          <label className="form-label">Social Links (comma-separated)</label>
          <input type="text" value={socialLinks.join(', ')} onChange={(e) => setSocialLinks(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
          <button onClick={handleSaveProfile} className="btn-save-profile">Save Info</button>
        </div>
      </div>

      {/* Media (or Media & Bundles) Card */}
      <div className="card media-bundles-card">
        <h3 className="card-title">{user.role === 'admin' ? "Media & Bundles" : "Media"}</h3>
        <div className="upload-media-section">
          <label className="form-label">Upload Media</label>
          <form onSubmit={handleUploadMedia} className="media-upload-form">
            <input type="text" placeholder="Title (optional)" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
            <input type="file" accept="image/*,video/*" onChange={(e) => setUploadFile(e.target.files[0])} />
            <div className="form-group is-photo-group">
              <label>
                <input type="checkbox" checked={uploadIsPhoto} onChange={() => setUploadIsPhoto(!uploadIsPhoto)} />
                Photo?
              </label>
            </div>
            <button type="submit" className="btn-upload-media">Upload</button>
          </form>
        </div>
        <div className="my-uploads-list">
          <label className="form-label">My Uploaded Media</label>
          {uploads.length === 0 ? (
            <p>No uploads yet.</p>
          ) : (
            <div className="uploads-grid">
              {uploads.map((item) => {
                const mediaUrl = getFullMediaUrl(item.videoUrl);
                return (
                  <div key={item._id} className="upload-item-card">
                    {item.isPhoto ? (
                      <img src={mediaUrl} alt={item.title} className="upload-item-img" />
                    ) : (
                      <video src={mediaUrl} className="upload-item-img" controls />
                    )}
                    <p className="upload-item-title">{item.title}</p>
                    <button className="delete-media-btn" onClick={() => handleDeleteMedia(item._id)}>Delete</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {user.role === 'admin' && (
          <div className="bundles-section">
            <label className="form-label">Create a Bundle</label>
            <form onSubmit={handleCreateBundle} className="bundle-form">
              <input type="text" placeholder="Bundle Title" value={bundleTitle} onChange={(e) => setBundleTitle(e.target.value)} />
              <input type="number" placeholder="Price" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
              <textarea rows={2} placeholder="Description" value={bundleDesc} onChange={(e) => setBundleDesc(e.target.value)} />
              <input type="file" accept="image/*" onChange={(e) => setBundleCoverFile(e.target.files[0])} />
              <button type="submit" className="btn-save-profile">Create Bundle</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  // Story Upload Card (Admins Only)
  const renderStoryUpload = () => {
    if (user.role !== 'admin') return null;
    return (
      <div className="card story-upload-card">
        <h3 className="card-title">Upload Story</h3>
        <form onSubmit={handleUploadStory} className="story-upload-form">
          <input type="file" accept="image/*,video/*" onChange={(e) => setStoryFile(e.target.files[0])} />
          <button type="submit" className="btn-upload-media">Upload Story</button>
        </form>
      </div>
    );
  };

  const renderEditTab = () => (
    <div className="edit-dashboard">
      {user.role === 'admin' && renderBannerSettings()}
      {renderPreviewBannerCard()}
      {renderDashboardGrid()}
      {renderStoryUpload()}
    </div>
  );

  // Improved Profile Preview Tab
  const renderPreviewTab = () => (
    <div className="preview-tab-content preview-dashboard">
      <div
        className="hero-banner"
        style={{
          backgroundImage: user.previewBanner
            ? `url(${getFullMediaUrl(user.previewBanner)})`
            : user.profileBanner
              ? `url(${getFullMediaUrl(user.profileBanner)})`
              : 'linear-gradient(120deg, #4a90e2, #6cb1f5)',
        }}
      >
        <div className="hero-overlay"></div>
        <div className="hero-info">
          <img src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar} alt="Avatar" className="hero-avatar" />
          <h2 className="hero-username">{user.username}</h2>
          <p className="hero-bio">{bio || 'No bio available.'}</p>
        </div>
      </div>
      <div className="preview-details">
        <div className="preview-info">
          <h3>About Me</h3>
          <p><strong>Interests:</strong> {interests || 'Not specified'}</p>
          <p><strong>Achievements:</strong> {achievements || 'N/A'}</p>
          {socialLinks.length > 0 && <p><strong>Links:</strong> {socialLinks.join(', ')}</p>}
        </div>
        <div className="preview-gallery">
          <h3>Your Media</h3>
          {uploads.length === 0 ? (
            <p>No media uploaded yet.</p>
          ) : (
            <div className="preview-uploads-grid">
              {uploads.map((item) => {
                const mediaUrl = getFullMediaUrl(item.videoUrl);
                return (
                  <div key={item._id} className="preview-upload-card">
                    {item.isPhoto ? (
                      <img src={mediaUrl} alt={item.title} className="preview-upload-img" />
                    ) : (
                      <video src={mediaUrl} className="preview-upload-img" controls />
                    )}
                    <p className="preview-upload-title">{item.title}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!user) return <p style={{ padding: '1rem' }}>Loading user...</p>;

  return (
    <div className="my-profile-page">
      <aside className="left-sidebar">
        <div className="user-info-card">
          <img src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar} alt="User" className="user-avatar" />
          <h3 className="greeting">{user.username}</h3>
        </div>
        <ul className="menu-list grow-space">
          <li>
            <Link to="/home"><span className="menu-icon">🏠</span> Home</Link>
          </li>
          <li>
            <Link to="/discover"><span className="menu-icon">🔎</span> Discover</Link>
          </li>
          <li>
            <Link to="/messages"><span className="menu-icon">💬</span> Messages</Link>
          </li>
          <li>
            <Link to="/my-profile"><span className="menu-icon">👤</span> Profile</Link>
          </li>
          <li>
            <Link to="/settings"><span className="menu-icon">⚙️</span> Settings</Link>
          </li>
        </ul>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </aside>
      <main className="profile-main-column">
        <div className="top-bar">
          <h2 className="profile-page-title">My Profile Dashboard</h2>
        </div>
        {message && <p className="profile-message">{message}</p>}
        {error && <p className="profile-error">{error}</p>}
        <div className="profile-tabs">
          <button className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>
            Edit Profile
          </button>
          <button className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
            Profile Preview
          </button>
        </div>
        {activeTab === 'edit' ? renderEditTab() : renderPreviewTab()}
      </main>
    </div>
  );
}

export default MyProfilePage;
