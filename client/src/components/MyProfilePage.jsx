import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './MyProfilePage.css';
import './Sidebar.css'; // unchanged aside styling

function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

const defaultAvatar = '';

function MyProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Tab => 'edit' or 'preview'
  const [activeTab, setActiveTab] = useState('edit');

  // Basic info
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [achievements, setAchievements] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);

  // For user’s uploaded items
  const [uploads, setUploads] = useState([]);

  // Upload fields
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadIsPhoto, setUploadIsPhoto] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');

  // For profile pic / banner
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profileBannerFile, setProfileBannerFile] = useState(null);
  const [suggestedBannerFile, setSuggestedBannerFile] = useState(null);

  // If user is admin => possible price, discount
  const [adminPrice, setAdminPrice] = useState('');
  const [adminDiscount, setAdminDiscount] = useState('');

  // Bundles
  const [adminBundles, setAdminBundles] = useState([]);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [bundleCoverFile, setBundleCoverFile] = useState(null);

  // NEW: story upload for admins
  const [storyFile, setStoryFile] = useState(null);

  // Status messages
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // 1) Check session => /api/protected
        const authRes = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include',
        });
        if (authRes.status === 401) {
          navigate('/');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // 2) Load extended user profile => /api/auth/me
        await loadMyProfile();

        // 3) Load user’s personal uploads => /api/profile/:id
        if (authData.user?.id) {
          await loadMyUploads(authData.user.id);
        }
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
          if (data.user.adminBundles) {
            setAdminBundles(data.user.adminBundles);
          }
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
      console.error('Fetching my uploads error:', err);
    }
  }

  const handleSaveProfile = async () => {
    setMessage('');
    setError('');
    try {
      const body = {
        bio,
        interests,
        achievements,
        socialLinks,
      };
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
        if (data.user) {
          setUser(data.user);
        }
      } else {
        setError(data.message || 'Error updating profile info.');
      }
    } catch (err) {
      console.error('handleSaveProfile error:', err);
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
        if (user?.id) {
          await loadMyUploads(user.id);
        }
      } else {
        setError(data.message || 'Error uploading media.');
      }
    } catch (err) {
      console.error('handleUploadMedia error:', err);
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
      console.error('handleProfilePicSubmit error:', err);
      setError('Server error uploading profile pic.');
    }
  };

  const handleProfileBannerSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!profileBannerFile) {
      setError('Please choose a banner first.');
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
        setMessage('Profile feed banner updated!');
        setUser(data.user);
      } else {
        if (res.ok && data.status === 'success') {
          setMessage('Profile feed banner updated!');
        } else {
          setError(data.message || 'Error uploading feed banner.');
        }
      }
    } catch (err) {
      console.error('handleProfileBannerSubmit error:', err);
      setError('Server error uploading feed banner.');
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
        setMessage('Suggested creators banner updated!');
        setUser(data.user);
      } else {
        if (res.ok && data.status === 'success') {
          setMessage('Suggested creators banner updated!');
        } else {
          setError(data.message || 'Error uploading suggested banner.');
        }
      }
    } catch (err) {
      console.error('handleSuggestedBannerSubmit error:', err);
      setError('Server error uploading suggested banner.');
    }
  };

  const handleDeleteMedia = async (videoId) => {
    if (!window.confirm('Delete this media?')) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/profile/me/delete-media/${videoId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Media deleted.');
        setUploads((prev) => prev.filter((u) => u._id !== videoId));
      } else {
        setError(data.message || 'Error deleting media.');
      }
    } catch (err) {
      console.error('handleDeleteMedia error:', err);
      setError('Server error deleting media.');
    }
  };

  // ================ NEW: Admin story upload ================
  async function handleUploadStory(e) {
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

      // Calls the new route => /api/auth/me/upload-story
      const res = await fetch('http://localhost:5000/api/auth/me/upload-story', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Story uploaded!');
        setStoryFile(null);
        // If desired, re-fetch user data to show .storyUrl updated
        // await loadMyProfile();
      } else {
        setError(data.message || 'Error uploading story.');
      }
    } catch (err) {
      console.error('handleUploadStory error:', err);
      setError('Server error uploading story.');
    }
  }
  // =========================================================

  const handleLogout = () => {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  };

  // Bundles
  const handleCreateBundle = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!bundleTitle.trim() || !bundlePrice.trim()) {
      setError('Bundle title and price are required.');
      return;
    }
    try {
      // 1) create the bundle
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

      // 2) if we have a cover file, upload it
      if (bundleCoverFile) {
        const updatedBundles = data.adminBundles || [];
        const newOne = updatedBundles[updatedBundles.length - 1];
        if (newOne && newOne._id) {
          const formData = new FormData();
          formData.append('bundleCover', bundleCoverFile);
          const coverRes = await fetch(
            `http://localhost:5000/api/profile/me/upload-bundle-cover/${newOne._id}`,
            {
              method: 'POST',
              credentials: 'include',
              body: formData,
            }
          );
          const coverData = await coverRes.json();
          if (!coverRes.ok || coverData.status !== 'success') {
            setError(coverData.message || 'Error uploading bundle cover.');
            return;
          }
          setAdminBundles(coverData.adminBundles || []);
        }
      } else {
        // just update from the creation response
        setAdminBundles(data.adminBundles || []);
      }

      // reset fields
      setMessage('Bundle created!');
      setBundleTitle('');
      setBundlePrice('');
      setBundleDesc('');
      setBundleCoverFile(null);
    } catch (err) {
      console.error('handleCreateBundle error:', err);
      setError('Server error creating bundle.');
    }
  };

  const handleDeleteBundle = async (bundleId) => {
    if (!window.confirm('Delete this bundle?')) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/profile/me/delete-bundle/${bundleId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Bundle deleted.');
        setAdminBundles(data.adminBundles || []);
      } else {
        setError(data.message || 'Error deleting bundle.');
      }
    } catch (err) {
      console.error('handleDeleteBundle error:', err);
      setError('Server error deleting bundle.');
    }
  };

  const handleEditBundle = async (bundle) => {
    const newTitle = window.prompt('Enter new title:', bundle.title);
    if (newTitle === null) return; // user cancelled
    const newPriceStr = window.prompt('Enter new price:', bundle.price);
    if (newPriceStr === null) return;
    const newDesc = window.prompt('Enter new description:', bundle.description || '');
    if (newDesc === null) return;

    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice)) {
      alert('Invalid price.');
      return;
    }

    try {
      const body = {
        title: newTitle.trim(),
        price: newPrice,
        description: newDesc.trim(),
      };
      const res = await fetch(
        `http://localhost:5000/api/profile/me/update-bundle/${bundle._id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMessage('Bundle updated!');
        setAdminBundles(data.adminBundles || []);
      } else {
        setError(data.message || 'Error updating bundle.');
      }
    } catch (err) {
      console.error('handleEditBundle error:', err);
      setError('Server error updating bundle.');
    }
  };

  // ====================== RENDER ======================
  const renderPreviewTab = () => (
    <div className="preview-tab-content">
      <div className="preview-section">
        <img
          src={user?.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar}
          alt="Me"
          className="preview-profile-pic"
        />
        <h3 className="preview-username">{user?.username}</h3>
        <p className="preview-bio">{bio || 'No bio yet—tell us something!'}</p>
        <p className="preview-interests">
          <strong>Interests:</strong> {interests || 'Not specified'}
        </p>
        <p className="preview-achievements">
          <strong>Achievements:</strong> {achievements || 'N/A'}
        </p>
        {socialLinks.length > 0 && (
          <p className="preview-links">
            <strong>Links:</strong> {socialLinks.join(', ')}
          </p>
        )}
        {user?.role === 'admin' && (
          <div style={{ marginTop: '1rem', textAlign: 'left' }}>
            <p>
              <strong>My Price:</strong> {adminPrice || '(none)'}
            </p>
            <p>
              <strong>Discount:</strong> {adminDiscount || '(no discount)'}
            </p>
            {adminBundles.length > 0 && (
              <div>
                <h4>My Bundles</h4>
                <ul>
                  {adminBundles.map((b) => (
                    <li key={b._id}>
                      <strong>{b.title}</strong> - ${b.price}
                      <br />
                      <em>{b.description}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="preview-gallery">
        <h4 className="gallery-title">Your Uploaded Media</h4>
        {uploads.length === 0 ? (
          <p className="no-uploads-text">No uploads yet.</p>
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
  );

  const renderEditTabUser = () => (
    <div className="edit-tab-content">
      <div className="profile-pic-section">
        <h3 className="section-heading">Profile Picture</h3>
        <div className="pic-upload-row">
          <img
            src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar}
            alt="Current"
            className="current-profile-pic"
          />
          <form onSubmit={handleProfilePicSubmit} className="pic-upload-form">
            <label className="pic-upload-label">
              Select new photo:
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfilePicFile(e.target.files[0])}
              />
            </label>
            <button type="submit" className="btn-submit-pic">
              Upload
            </button>
          </form>
        </div>
      </div>

      <div className="info-fields-section">
        <h3 className="section-heading">Profile Info</h3>
        <div className="form-group">
          <label>Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Interests</label>
          <textarea
            rows={2}
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Achievements</label>
          <textarea
            rows={2}
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Social Links (comma-separated)</label>
          <input
            type="text"
            value={socialLinks.join(', ')}
            onChange={(e) => {
              const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              setSocialLinks(arr);
            }}
          />
        </div>
        <button onClick={handleSaveProfile} className="btn-save-profile">
          Save Profile Info
        </button>
      </div>

      <div className="upload-media-section">
        <h3 className="section-heading">Upload Media</h3>
        <form onSubmit={handleUploadMedia} className="media-upload-form">
          <div className="form-group">
            <label>Title (optional):</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Media File:</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
          </div>
          <div className="form-group is-photo-group">
            <label>
              <input
                type="checkbox"
                checked={uploadIsPhoto}
                onChange={() => setUploadIsPhoto(!uploadIsPhoto)}
              />
              Photo?
            </label>
          </div>
          <button type="submit" className="btn-upload-media">
            Upload
          </button>
        </form>
      </div>

      <div className="my-uploads-list">
        <h3 className="section-heading">My Uploaded Media</h3>
        {uploads.length === 0 ? (
          <p>No uploads yet—start above!</p>
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
                  <button
                    className="delete-media-btn"
                    onClick={() => handleDeleteMedia(item._id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderEditTabAdmin = () => (
    <div className="edit-tab-content">
      <div className="profile-pic-section">
        <h3 className="section-heading">Profile Picture</h3>
        <div className="pic-upload-row">
          <img
            src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar}
            alt="Current"
            className="current-profile-pic"
          />
          <form onSubmit={handleProfilePicSubmit} className="pic-upload-form">
            <label className="pic-upload-label">
              Select new photo:
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfilePicFile(e.target.files[0])}
              />
            </label>
            <button type="submit" className="btn-submit-pic">
              Upload
            </button>
          </form>
        </div>
      </div>

      <div className="profile-pic-section">
        <h3 className="section-heading">Profile Banner (feed top banner)</h3>
        <div className="pic-upload-row">
          {user.profileBanner && (
            <img
              src={getFullMediaUrl(user.profileBanner)}
              alt="Current Profile Banner"
              style={{
                width: '120px',
                height: '60px',
                objectFit: 'cover',
                border: '2px solid #4a90e2',
              }}
            />
          )}
          <form onSubmit={handleProfileBannerSubmit} className="pic-upload-form">
            <label className="pic-upload-label">
              Select Profile Banner:
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfileBannerFile(e.target.files[0])}
              />
            </label>
            <button type="submit" className="btn-submit-pic">Upload</button>
          </form>
        </div>
      </div>

      <div className="profile-pic-section">
        <h3 className="section-heading">Suggested Creators Banner</h3>
        <div className="pic-upload-row">
          {user.bannerPic && (
            <img
              src={getFullMediaUrl(user.bannerPic)}
              alt="Current Suggested Banner"
              style={{
                width: '120px',
                height: '60px',
                objectFit: 'cover',
                border: '2px solid #4a90e2',
              }}
            />
          )}
          <form onSubmit={handleSuggestedBannerSubmit} className="pic-upload-form">
            <label className="pic-upload-label">
              Select suggested banner:
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSuggestedBannerFile(e.target.files[0])}
              />
            </label>
            <button type="submit" className="btn-submit-pic">Upload</button>
          </form>
        </div>
      </div>

      <div className="info-fields-section">
        <h3 className="section-heading">Profile Info</h3>
        <div className="form-group">
          <label>Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Interests</label>
          <textarea
            rows={2}
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Achievements</label>
          <textarea
            rows={2}
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Social Links (comma-separated)</label>
          <input
            type="text"
            value={socialLinks.join(', ')}
            onChange={(e) => {
              const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              setSocialLinks(arr);
            }}
          />
        </div>
        <div className="form-group">
          <label>Subscription Price ($)</label>
          <input
            type="text"
            value={adminPrice}
            onChange={(e) => setAdminPrice(e.target.value)}
            placeholder="e.g. 12.99"
          />
        </div>
        <div className="form-group">
          <label>Discount Info</label>
          <input
            type="text"
            value={adminDiscount}
            onChange={(e) => setAdminDiscount(e.target.value)}
            placeholder="e.g. 50% off for first 10 subs"
          />
        </div>
        <button onClick={handleSaveProfile} className="btn-save-profile">
          Save Profile Info
        </button>
      </div>

      <div className="upload-media-section">
        <h3 className="section-heading">Upload Media</h3>
        <form onSubmit={handleUploadMedia} className="media-upload-form">
          <div className="form-group">
            <label>Title (optional):</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Media File:</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
          </div>
          <div className="form-group is-photo-group">
            <label>
              <input
                type="checkbox"
                checked={uploadIsPhoto}
                onChange={() => setUploadIsPhoto(!uploadIsPhoto)}
              />
              Photo?
            </label>
          </div>
          <button type="submit" className="btn-upload-media">Upload</button>
        </form>
      </div>

      <div className="my-uploads-list">
        <h3 className="section-heading">My Uploaded Media</h3>
        {uploads.length === 0 ? (
          <p>No uploads yet—start above!</p>
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
                  <button
                    className="delete-media-btn"
                    onClick={() => handleDeleteMedia(item._id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STORY UPLOAD SECTION (NEW) */}
      <div className="upload-story-section" style={{ marginTop: '1rem' }}>
        <h3 className="section-heading">Upload Story</h3>
        <form onSubmit={handleUploadStory} className="story-upload-form">
          <div className="form-group">
            <label>Story File (image/video):</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setStoryFile(e.target.files[0])}
            />
          </div>
          <button type="submit" className="btn-upload-story">
            Upload Story
          </button>
        </form>
      </div>
      {/* End story section */}

      {/* Bundles => create / edit / delete */}
      <div className="bundles-section">
        <h3 className="section-heading">Create a New Bundle</h3>
        <div className="form-group">
          <label>Bundle Title</label>
          <input
            type="text"
            value={bundleTitle}
            onChange={(e) => setBundleTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Bundle Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={bundlePrice}
            onChange={(e) => setBundlePrice(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            rows={2}
            value={bundleDesc}
            onChange={(e) => setBundleDesc(e.target.value)}
          />
        </div>
        {/* optional cover */}
        <div className="form-group">
          <label>Bundle Cover (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setBundleCoverFile(e.target.files[0])}
          />
        </div>
        <button onClick={handleCreateBundle} className="btn-save-profile">
          Create Bundle
        </button>

        {adminBundles.length > 0 && (
          <div className="existing-bundles-list" style={{ marginTop: '1rem' }}>
            <h4>Your Existing Bundles</h4>
            <ul>
              {adminBundles.map((b) => (
                <li key={b._id} style={{ marginBottom: '0.6rem' }}>
                  <strong>{b.title}</strong> - ${b.price}
                  <br />
                  <em>{b.description}</em>
                  <br />
                  {/* Buttons for edit/delete */}
                  <button
                    onClick={() => handleEditBundle(b)}
                    style={{ marginRight: '0.6rem', background: '#ccc' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBundle(b._id)}
                    style={{ background: '#e05050', color: '#fff' }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  if (!user) {
    return <p style={{ padding: '1rem' }}>Loading user...</p>;
  }

  const renderEditTab = () => {
    if (user?.role === 'admin') return renderEditTabAdmin();
    return renderEditTabUser();
  };

  return (
    <div className="my-profile-page">
      <aside className="left-sidebar">
        <div className="user-info-card">
          <img
            src={user.profilePic ? getFullMediaUrl(user.profilePic) : defaultAvatar}
            alt="User"
            className="user-avatar"
          />
          <h3 className="greeting">{user.username}</h3>
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

      <main className="profile-main-column">
        <div className="top-bar">
          <h2 className="profile-page-title">My Profile</h2>
        </div>

        {message && <p className="profile-message">{message}</p>}
        {error && <p className="profile-error">{error}</p>}

        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit Profile
          </button>
          <button
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Profile Preview
          </button>
        </div>

        {activeTab === 'edit' ? renderEditTab() : renderPreviewTab()}
      </main>
    </div>
  );
}

export default MyProfilePage;
