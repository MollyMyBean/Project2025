import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './MasterPage.css';

const defaultAvatar = '/images/default.png';

function MasterPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // For uploading videos/photos
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isPhoto, setIsPhoto] = useState(false);
  const [locked, setLocked] = useState(false);
  const [price, setPrice] = useState(5);

  // All normal users
  const [normalUsers, setNormalUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // For suggested creators
  const [allAdmins, setAllAdmins] = useState([]);
  const [suggestedAdmin, setSuggestedAdmin] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('add'); // 'add' or 'remove'

  // "Push to All"
  const [pushTitle, setPushTitle] = useState('');
  const [pushFile, setPushFile] = useState(null);
  const [pushIsPhoto, setPushIsPhoto] = useState(false);

  // DISCOVER ADMIN states
  const [discoverAdmin, setDiscoverAdmin] = useState('');
  const [discoverAction, setDiscoverAction] = useState('add');
  const [discoverFile, setDiscoverFile] = useState(null);

  // For simulate traffic
  const [allVideos, setAllVideos] = useState([]);
  const [simulateVideoId, setSimulateVideoId] = useState('');
  const [simulateUserIds, setSimulateUserIds] = useState([]);

  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Check if admin
        const res = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include'
        });
        if (res.status === 401) {
          navigate('/');
          return;
        }
        const data = await res.json();
        if (data.user.role !== 'admin') {
          alert('You are not an admin!');
          navigate('/home');
        } else {
          setUser(data.user);

          // fetch normal users
          await loadAllUsers();

          // If admin1 => fetch entire admin list + all videos
          if (data.user.email.toLowerCase() === 'admin1@example.com') {
            const adminRes = await fetch('http://localhost:5000/api/auth/all-admins', {
              credentials: 'include'
            });
            const adminData = await adminRes.json();
            if (adminRes.ok && adminData.status === 'success') {
              setAllAdmins(adminData.admins || []);
            }
            await loadAllVideos();
          }
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        navigate('/home');
      }
    })();
  }, [navigate]);

  async function loadAllUsers() {
    try {
      setLoadingUsers(true);
      const res = await fetch('http://localhost:5000/api/auth/all-users', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const onlyNormal = data.users.filter((u) => u.role === 'user');
        setNormalUsers(onlyNormal);
      } else {
        alert(data.message || 'Failed to load users.');
      }
    } catch (err) {
      console.error('loadAllUsers error:', err);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadAllVideos() {
    try {
      const res = await fetch('http://localhost:5000/api/videos/all', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAllVideos(data.videos || []);
      }
    } catch (err) {
      console.error('loadAllVideos error:', err);
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('isPhoto', isPhoto);
      formData.append('locked', locked);
      formData.append('price', price);
      formData.append('mediaFile', file);

      const res = await fetch('http://localhost:5000/api/videos/upload-file', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert('Content uploaded successfully!');
        setTitle('');
        setFile(null);
        setIsPhoto(false);
        setLocked(false);
        setPrice(5);
      } else {
        alert(data.message || 'Upload failed.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Something went wrong uploading content.');
    }
  };

  // Admin => message a normal user
  const handleMessageUser = async (userId) => {
    try {
      const body = {
        recipientId: userId,
        content: '',
        mediaUrl: '',
        mediaType: 'none'
      };
      const res = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.newMessage) {
        setMessage(`Conversation with user: ${userId} created/opened. Go to "Messages" tab.`);
      } else {
        alert(data.message || 'Error messaging user.');
      }
    } catch (err) {
      console.error('Message user error:', err);
      alert('Server error messaging user.');
    }
  };

  // Admin => delete all comments by a user
  const handleDeleteComments = async (userId) => {
    try {
      const res = await fetch('http://localhost:5000/api/videos/delete-user-comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(`Deleted all comments from user: ${userId}`);
      } else {
        alert(data.message || 'Error deleting comments.');
      }
    } catch (err) {
      console.error('Delete comments error:', err);
      alert('Server error deleting comments.');
    }
  };

  // Admin => fully delete user account
  const handleDeleteUserAccount = async (userId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this user account?')) {
        return;
      }
      const res = await fetch('http://localhost:5000/api/auth/delete-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert('User account deleted.');
        setNormalUsers((prev) => prev.filter((u) => u._id !== userId));
      } else {
        alert(data.message || 'Error deleting user account.');
      }
    } catch (err) {
      console.error('Delete user account error:', err);
      alert('Server error deleting user account.');
    }
  };

  // handle suggested creators
  const handleSuggestedChange = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!suggestedAdmin) {
      alert('Pick an admin to add/remove from suggested');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/update-suggested', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: suggestedAction, adminId: suggestedAdmin })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
      } else {
        alert(data.message || 'Error updating suggested');
      }
    } catch (err) {
      console.error('Suggested update error:', err);
      alert('Server error updating suggested');
    }
  };

  // "Push to All"
  const handlePushAll = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!pushTitle.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!pushFile) {
      alert('Please select a file to upload.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('title', pushTitle);
      formData.append('isPhoto', pushIsPhoto);
      formData.append('mediaFile', pushFile);

      const res = await fetch('http://localhost:5000/api/videos/push-all', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert('Successfully pushed to everyone’s feed!');
        setPushTitle('');
        setPushFile(null);
        setPushIsPhoto(false);
      } else {
        alert(data.message || 'Push to feed failed.');
      }
    } catch (err) {
      console.error('Push All error:', err);
      alert('Something went wrong pushing content to feed.');
    }
  };

  // Simulate traffic
  const handleSimulateTraffic = async () => {
    if (!simulateVideoId) {
      alert('Select a video first');
      return;
    }
    if (simulateUserIds.length < 1) {
      alert('Pick some normal users!');
      return;
    }
    try {
      const body = { videoId: simulateVideoId, userIds: simulateUserIds };
      const res = await fetch('http://localhost:5000/api/master/simulate-traffic', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
        console.log('Updated video =>', data.video);
        await loadAllVideos();
        // navigate home so feed refreshes
        navigate('/home');
      } else {
        alert(data.message || 'Simulate traffic error.');
      }
    } catch (err) {
      console.error('Simulate traffic error:', err);
      alert('Server error simulating traffic.');
    }
  };

  // handle discover admin add/remove
  const handleUpdateDiscoverAdmin = async (e) => {
    e.preventDefault();
    if (!discoverAdmin) {
      alert('Pick an admin to add/remove from Discover');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/update-discover', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: discoverAction, adminId: discoverAdmin })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
        window.location.reload();
      } else {
        alert(data.message || 'Error updating discover admin');
      }
    } catch (err) {
      console.error('Update discover admin error:', err);
      alert('Server error updating discover admin');
    }
  };

  // upload a new photo for discover admin
  const handleUploadDiscoverPhoto = async (e) => {
    e.preventDefault();
    if (!discoverAdmin) {
      alert('Select an admin first');
      return;
    }
    if (!discoverFile) {
      alert('Choose a photo file first');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('photo', discoverFile);

      const res = await fetch(
        `http://localhost:5000/api/auth/upload-discover-photo/${discoverAdmin}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(`Photo uploaded. Total: ${data.photos?.length} now.`);
        setDiscoverFile(null);
        window.location.reload();
      } else {
        alert(data.message || 'Error uploading discover photo');
      }
    } catch (err) {
      console.error('upload discover photo error:', err);
      alert('Server error uploading discover photo');
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div className="master-page">
      {/* LEFT SIDEBAR */}
      <aside className="left-sidebar bubble-section" style={{ margin: 0 }}>
        <div className="user-info-card">
          <img
            src={user?.profilePic || defaultAvatar}
            alt="User Avatar"
            className="user-avatar"
          />
          <h3 className="greeting">{user?.username}</h3>
        </div>
        <ul className="menu-list grow-space">
          <li>
            <Link to="/home">🏠 Home</Link>
          </li>
          <li>
            <Link to="/discover">🔎 Discover</Link>
          </li>
          <li>
            <Link to="/messages">💬 Messages</Link>
          </li>
          <li>
            <Link to="/my-profile">👤 Profile</Link>
          </li>
          <li>
            <Link to="/settings">⚙️ Settings</Link>
          </li>
          <li>
            <Link to="/master">🛠 Master</Link>
          </li>
        </ul>
        <button onClick={() => navigate('/')} className="logout-btn">
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="master-main-column bubble-section">
        <h1>Master Admin Page</h1>
        {message && <p style={{ color: 'green' }}>{message}</p>}

        {/* Only admin1 => manage "Suggested Creators" */}
        {user?.email.toLowerCase() === 'admin1@example.com' && (
          <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
            <h3>Manage Suggested Creators (Only admin1@example.com)</h3>
            <form onSubmit={handleSuggestedChange}>
              <label>Admin:</label>
              <select
                value={suggestedAdmin}
                onChange={(e) => setSuggestedAdmin(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="">-- Select Admin --</option>
                {allAdmins.map((adm) => (
                  <option key={adm._id} value={adm._id}>
                    {adm.username} ({adm.email})
                  </option>
                ))}
              </select>

              <label style={{ marginLeft: '1rem' }}>Action:</label>
              <select
                value={suggestedAction}
                onChange={(e) => setSuggestedAction(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </select>

              <button type="submit" style={{ marginLeft: '1rem' }}>
                Update
              </button>
            </form>
          </div>
        )}

        {/* Manage Discover Admins (admin1@example.com) */}
        {user?.email.toLowerCase() === 'admin1@example.com' && (
          <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
            <h3>Manage Discover Admins</h3>

            {/* 1) add/remove from discover */}
            <form onSubmit={handleUpdateDiscoverAdmin}>
              <label>Admin:</label>
              <select
                value={discoverAdmin}
                onChange={(e) => setDiscoverAdmin(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="">-- Select Admin --</option>
                {allAdmins.map((adm) => (
                  <option key={adm._id} value={adm._id}>
                    {adm.username} ({adm.email})
                  </option>
                ))}
              </select>

              <label style={{ marginLeft: '1rem' }}>Action:</label>
              <select
                value={discoverAction}
                onChange={(e) => setDiscoverAction(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </select>

              <button type="submit" style={{ marginLeft: '1rem' }}>
                Update
              </button>
            </form>

            {/* 2) upload a new photo for discover admin */}
            <div style={{ marginTop: '1rem' }}>
              <h4>Upload a Discover Photo for Admin</h4>
              <form onSubmit={handleUploadDiscoverPhoto}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDiscoverFile(e.target.files[0])}
                />
                <button type="submit">Upload Photo</button>
              </form>
            </div>
          </div>
        )}

        {/* SECTION: Admin Upload => direct file upload */}
        <div className="upload-section-container">
          <h2>Upload New Content</h2>
          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label>Title:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
              />
            </div>
            <div className="form-group">
              <label>File (image or video):</label>
              <input
                type="file"
                accept="image/*, video/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isPhoto}
                  onChange={() => setIsPhoto(!isPhoto)}
                />
                This is a Photo?
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={() => setLocked(!locked)}
                />
                Locked?
              </label>
              {locked && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label>Price: </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ width: '80px' }}
                  />
                </div>
              )}
            </div>
            <button type="submit" className="btn-upload">
              Upload
            </button>
          </form>
        </div>

        {/* If admin1 => "Push to All" */}
        {user?.email.toLowerCase() === 'admin1@example.com' && (
          <div className="push-all-container" style={{ marginTop: '2rem' }}>
            <h2>Push a File to Everyone’s Feed</h2>
            <form onSubmit={handlePushAll} className="upload-form">
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="Enter title"
                />
              </div>
              <div className="form-group">
                <label>File (image or video):</label>
                <input
                  type="file"
                  accept="image/*, video/*"
                  onChange={(e) => setPushFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={pushIsPhoto}
                    onChange={() => setPushIsPhoto(!pushIsPhoto)}
                  />
                  This is a Photo?
                </label>
              </div>
              <button type="submit" className="btn-upload">
                Push to Everyone’s Feed
              </button>
            </form>
          </div>
        )}

        {/* Simulate Traffic (admin1) */}
        {user?.email.toLowerCase() === 'admin1@example.com' && (
          <div
            className="simulate-traffic-section"
            style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}
          >
            <h2>Simulate Traffic</h2>
            <p>Pick a video and some normal users to add random likes/shares/comments.</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>Video:</label>
              <select
                value={simulateVideoId}
                onChange={(e) => setSimulateVideoId(e.target.value)}
              >
                <option value="">-- Select a Video --</option>
                {allVideos.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.title} (by {v.uploaderData?.[0]?.username || 'unknown'})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Users:</label>
              <select
                multiple
                style={{ width: '220px', height: '100px', marginLeft: '0.5rem' }}
                onChange={(e) => {
                  const arr = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setSimulateUserIds(arr);
                }}
              >
                {normalUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.username} (ID:{u._id.slice(-4)})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>
                (Hold Ctrl or Shift to select multiple)
              </p>
            </div>
            <button onClick={handleSimulateTraffic}>Simulate Traffic</button>
          </div>
        )}

        {/* List all normal users */}
        <div className="users-section">
          <h2>All Normal Users</h2>
          {loadingUsers ? (
            <p>Loading users...</p>
          ) : (
            <div className="users-list">
              {normalUsers.map((u) => (
                <div key={u._id} className="user-card">
                  <img
                    src={u.profilePic || defaultAvatar}
                    alt={u.username}
                    className="user-card-avatar"
                  />
                  <div className="user-card-info">
                    <p>
                      <strong>{u.username}</strong>
                    </p>
                    <p>Email: {u.email}</p>
                  </div>
                  <div className="user-card-actions">
                    <button onClick={() => handleMessageUser(u._id)}>
                      Message
                    </button>
                    <button onClick={() => handleDeleteComments(u._id)}>
                      Delete Comments
                    </button>
                    <button
                      onClick={() => handleDeleteUserAccount(u._id)}
                      style={{ backgroundColor: '#af4448' }}
                    >
                      Delete Account
                    </button>
                    <button
                      onClick={() => navigate(`/master/user/${u._id}`)}
                      style={{ backgroundColor: '#777', marginTop: '0.3rem' }}
                    >
                      View Full Info
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MasterPage;
