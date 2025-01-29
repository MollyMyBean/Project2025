import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './DiscoverPage.css';

function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

const defaultAvatar = '';

function DiscoverPage() {
  const navigate = useNavigate();

  // Basic user info
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState('');
  const [activeTab, setActiveTab] = useState('swipe');

  // Swiping deck
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Card exit animations
  const [cardExit, setCardExit] = useState(false);
  const [exitDirection, setExitDirection] = useState('');
  const cardRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Matches
  const [matches, setMatches] = useState([]);
  const [likedMe, setLikedMe] = useState([]);

  // Force the first 5 swipes to be auto matches => for testing
  // (We skip the “12h check” so you can verify the alerts always appear.)
  const [swipeCount, setSwipeCount] = useState(0);
  // For demonstration, let's say after the first 5, we'll do an auto match every 5 or 6 swipes
  const [nextAutoMatchAt, setNextAutoMatchAt] = useState(0);

  // For the "Instant Match" alert pop-up
  const [matchAlert, setMatchAlert] = useState('');

  useEffect(() => {
    (async () => {
      // 1) Check session user
      const authRes = await fetch('http://localhost:5000/api/protected', {
        credentials: 'include'
      });
      if (authRes.status === 401) {
        navigate('/');
        return;
      }
      const authData = await authRes.json();
      setUser(authData.user);

      // 2) Load discoverable admins
      await loadDiscoverAdmins();

      // 3) Load persistent matches => so the Matches tab is always up to date
      await loadPersistentMatches();

      setLoading(false);
    })();

    // 4) “Who Liked Me?” once a day
    fetchRandomAdminOnceADay();

    // 5) Grab user location
    (async () => {
      try {
        const locRes = await fetch('https://ipapi.co/json/');
        const locData = await locRes.json();
        if (locData) {
          setLocation(`${locData.city}, ${locData.region}, ${locData.country_name}`);
        }
      } catch (err) {
        console.error('Could not fetch location:', err);
      }
    })();

    // Let’s start nextAutoMatchAt at e.g. 6
    setNextAutoMatchAt(6);
  }, [navigate]);

  async function loadDiscoverAdmins() {
    try {
      const discoverRes = await fetch('http://localhost:5000/api/auth/get-discover', {
        credentials: 'include'
      });
      const discoverData = await discoverRes.json();
      if (discoverRes.ok && discoverData.status === 'success') {
        let list = discoverData.discover || [];
        // Filter out self, just in case
        if (user?.id) {
          list = list.filter((adm) => adm._id !== user.id);
        }
        // Shuffle them so each refresh => random order
        shuffleArray(list);

        // Add distance & mock bio
        const withExtras = list.map((adm) => ({
          ...adm,
          distance: Math.floor(Math.random() * 50 + 1),
          bio: "A short bio about me, let's connect!"
        }));
        setAdmins(withExtras);
      }
    } catch (err) {
      console.error('Error loading discover admins:', err);
    }
  }

  async function loadPersistentMatches() {
    try {
      // 1) get fresh user => see which admins they liked
      const meRes = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include'
      });
      const meData = await meRes.json();
      if (meRes.ok && meData.status === 'success') {
        const likedIds = meData.user.likedAdmins || [];

        // 2) get all admins => cross-check who is liked
        const allRes = await fetch('http://localhost:5000/api/auth/all-admins', {
          credentials: 'include'
        });
        const allData = await allRes.json();
        if (allRes.ok && allData.status === 'success') {
          const allAdmins = allData.admins || [];
          const matched = allAdmins.filter((adm) => likedIds.includes(adm._id));
          setMatches(matched);
        }
      }
    } catch (err) {
      console.error('Error loading persistent matches:', err);
    }
  }

  // “Who Liked Me?” => random admin once/day
  async function fetchRandomAdminOnceADay() {
    try {
      const prevData = localStorage.getItem('whoLikedMe24h');
      const now = Date.now();

      if (prevData) {
        const parsed = JSON.parse(prevData);
        if (now - parsed.timestamp > 24 * 60 * 60 * 1000) {
          await pickAndStoreRandomAdmin(now);
        } else {
          setLikedMe([parsed.admin]);
        }
      } else {
        await pickAndStoreRandomAdmin(now);
      }
    } catch (err) {
      console.error('fetchRandomAdminOnceADay error:', err);
    }
  }

  async function pickAndStoreRandomAdmin(timestamp) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/all-admins', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const all = data.admins || [];
        if (!all.length) {
          setLikedMe([]);
          return;
        }
        // pick random
        const randIndex = Math.floor(Math.random() * all.length);
        const chosen = all[randIndex];
        setLikedMe([chosen]);
        localStorage.setItem(
          'whoLikedMe24h',
          JSON.stringify({ timestamp, admin: chosen })
        );
      } else {
        setLikedMe([]);
      }
    } catch (err) {
      console.error('pickAndStoreRandomAdmin error:', err);
    }
  }

  // Shuffle array in-place
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Random 5 or 6
  function random5or6() {
    return Math.random() < 0.5 ? 5 : 6;
  }

  // Logout
  function handleLogout() {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  }

  // Current top card
  const currentAdmin = admins[0] || null;

  async function handleLike() {
    if (!currentAdmin) return;

    // Decide if auto match
    if (shouldAutoMatch()) {
      // We'll still call the backend so it's stored in likedAdmins
      await doLikeAndPersist(currentAdmin, true /* isAutoMatch */);
    } else {
      await doLikeAndPersist(currentAdmin, false);
    }
    triggerSwipeAnimation('right');
  }

  function handleDislike() {
    if (!currentAdmin) return;
    setMessage(`You disliked ${currentAdmin.username}.`);
    triggerSwipeAnimation('left');
  }

  // Actually call the /like-admin route so it persists in DB
  async function doLikeAndPersist(admin, isAutoMatch) {
    try {
      const res = await fetch(
        `http://localhost:5000/api/messages/like-admin/${admin._id}`,
        { method: 'POST', credentials: 'include' }
      );
      const data = await res.json();
      if (res.ok) {
        if (isAutoMatch) {
          // Show "Instant match" alert
          setMatchAlert(`You got an instant match with ${admin.username}!`);
          setTimeout(() => setMatchAlert(''), 2500);
        } else {
          setMessage(`You liked ${admin.username}, check your Messages!`);
        }
        // Add them to "matches" if not already in
        setMatches((prev) => {
          if (!prev.find((m) => m._id === admin._id)) {
            return [...prev, admin];
          }
          return prev;
        });
      } else {
        setMessage(data.message || 'Error liking admin.');
      }
    } catch (err) {
      console.error('Like admin error:', err);
      setMessage('Server error liking admin.');
    }
  }

  function triggerSwipeAnimation(direction) {
    setCardExit(true);
    setExitDirection(direction);

    setTimeout(() => {
      // remove from the "admins" deck
      setAdmins((prev) => prev.slice(1));
      setCardExit(false);
      setExitDirection('');
      setPhotoIndex(0);

      // increment total swipes
      setSwipeCount((prev) => prev + 1);
    }, 400);
  }

  // Force first 5 swipes => auto match
  // afterwards => if swipeCount+1 === nextAutoMatchAt => also auto
  function shouldAutoMatch() {
    if (swipeCount < 5) {
      console.log('Auto‐match because first 5 swipes');
      return true;
    }
    if (swipeCount + 1 === nextAutoMatchAt) {
      console.log(`Auto‐match because swipeCount+1=${swipeCount + 1} equals nextAutoMatchAt`);
      // pick a new threshold => 5 or 6 from NOW
      setNextAutoMatchAt((swipeCount + 1) + random5or6());
      return true;
    }
    console.log('No auto match => normal like');
    return false;
  }

  function handlePrevPhoto() {
    if (!currentAdmin) return;
    setPhotoIndex((p) => Math.max(p - 1, 0));
  }
  function handleNextPhoto() {
    if (!currentAdmin) return;
    const totalPhotos = currentAdmin.photos ? currentAdmin.photos.length : 0;
    setPhotoIndex((p) => Math.min(p + 1, totalPhotos - 1));
  }

  // For "Matches" => user can message the admin
  async function handleMessageUser(adminId) {
    try {
      const body = {
        recipientId: adminId,
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
      if (res.ok && data.status === 'success') {
        window.location.href = `/messages?partnerId=${adminId}`;
      } else {
        alert(data.message || 'Error messaging user.');
      }
    } catch (err) {
      console.error('Message user error:', err);
      alert('Server error messaging user.');
    }
  }

  function renderTabContent() {
    if (activeTab === 'swipe') {
      if (loading) {
        return <p>Loading potential creators...</p>;
      }
      if (admins.length === 0) {
        return (
          <div className="no-admins-box">
            <p className="no-admins">No more creators to discover!</p>
          </div>
        );
      }

      const admin = admins[0];
      const totalPhotos = admin.photos ? admin.photos.length : 0;
      const currentPhoto =
        totalPhotos > 0 ? admin.photos[photoIndex] : admin.profilePic;
      const photoUrl = currentPhoto ? getFullMediaUrl(currentPhoto) : defaultAvatar;

      return (
        <div
          className={`tinder-card-outer ${cardExit ? `exit-${exitDirection}` : ''}`}
          ref={cardRef}
        >
          <div className="iphone-card">
            <div className="photo-container">
              <img src={photoUrl} alt={admin.username} className="main-photo" />
              <div className="photo-nav">
                <button
                  className="arrow-btn"
                  onClick={handlePrevPhoto}
                  disabled={photoIndex <= 0}
                  title="Previous"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button
                  className="arrow-btn"
                  onClick={handleNextPhoto}
                  disabled={photoIndex >= totalPhotos - 1}
                  title="Next"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            <div className="admin-info">
              <h3 className="admin-name">
                {admin.username} <span className="admin-age">25</span>
              </h3>
              <p className="admin-distance">{admin.distance} km away</p>
              <p className="admin-bio">{admin.bio}</p>
            </div>
            <div className="action-buttons">
              <button
                className="action-btn no-bg-icon"
                onClick={handleDislike}
                title="Nope"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <button
                className="action-btn no-bg-icon"
                onClick={handleLike}
                title="Like"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d="M20.84 4.61c-1.54-1.34-3.77-1.34-5.31 
                       0L12 8.09l-3.53-3.48c-1.54-1.34-3.77-1.34-5.31 
                       0-1.57 1.36-1.57 3.57 
                       0 4.93l8.1 7.92 8.1-7.92c1.57-1.36 
                       1.57-3.57 0-4.93z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'matches') {
      if (!matches.length) {
        return <p style={{ color: '#999', marginTop: '1rem' }}>No matches yet!</p>;
      }
      return (
        <div className="matches-grid">
          {matches.map((m) => (
            <div className="match-card" key={m._id}>
              <img
                src={m.profilePic ? getFullMediaUrl(m.profilePic) : defaultAvatar}
                alt={m.username}
                className="match-avatar"
                onClick={() => window.open(`/profile/${m._id}`, '_blank')}
                style={{ cursor: 'pointer' }}
              />
              <div className="match-info">
                <div className="match-name">{m.username}</div>
                <div className="match-tagline">Creator you liked!</div>
              </div>
              <button
                className="match-msg-btn"
                onClick={() => handleMessageUser(m._id)}
              >
                Message
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'likes') {
      if (!likedMe.length) {
        return (
          <p style={{ color: '#999', marginTop: '1rem' }}>
            No one has liked you... yet!
          </p>
        );
      }
      return (
        <div className="matches-grid">
          {likedMe.map((adm) => (
            <div className="match-card" key={adm._id}>
              <img
                src={adm.profilePic ? getFullMediaUrl(adm.profilePic) : defaultAvatar}
                alt={adm.username}
                className="match-avatar"
                onClick={() => window.open(`/profile/${adm._id}`, '_blank')}
                style={{ cursor: 'pointer' }}
              />
              <div className="match-info">
                <div className="match-name">{adm.username}</div>
                <div className="match-tagline">Random admin who liked you!</div>
              </div>
              <button
                className="match-msg-btn"
                onClick={() => handleMessageUser(adm._id)}
              >
                Message
              </button>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="discover-page">
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

      {/* MAIN BUBBLE => "tinder card" & new tabs */}
      <main className="right-bubble bubble-section discover-right">
        <div style={{ paddingTop: '1.2rem' }}>
          <h2 className="discover-heading">Discover Creators Near You</h2>
          <p className="location-note">
            Your exact location: {location || 'Unknown'}
          </p>
        </div>

        {message && <p className="discover-message">{message}</p>}

        {/* TABS */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'swipe' ? 'active' : ''}`}
            onClick={() => setActiveTab('swipe')}
          >
            Swiping
          </button>
          <button
            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            Matches
          </button>
          <button
            className={`tab-btn ${activeTab === 'likes' ? 'active' : ''}`}
            onClick={() => setActiveTab('likes')}
          >
            Who Liked Me
          </button>
        </div>

        <div className="tab-content">{renderTabContent()}</div>
      </main>

      {/* Show the "Instant Match" alert if triggered */}
      {matchAlert && (
        <div className="match-alert-popup">
          <div className="match-alert-content">
            <h3>Instant Match!</h3>
            <p>{matchAlert}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscoverPage;
