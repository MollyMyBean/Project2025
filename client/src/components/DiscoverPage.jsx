import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './DiscoverPage.css';

// Helper to make absolute URLs
function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

const defaultAvatar = '/images/default.png'; // Make sure this exists in public/images

function DiscoverPage() {
  const navigate = useNavigate();

  // Basic user info
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState('');
  const [activeTab, setActiveTab] = useState('swipe');

  // For the distance filter
  const [distanceFilter, setDistanceFilter] = useState(50);

  // Swiping deck
  const [allAdmins, setAllAdmins] = useState([]); // store unfiltered list
  const [admins, setAdmins] = useState([]); // store currently filtered list
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState({ text: '', type: '' }); // { text: '', type: 'success' | 'error' | 'info' }
  const toastTimeoutRef = useRef(null);

  // Card exit animations
  const [cardExit, setCardExit] = useState(false);
  const [exitDirection, setExitDirection] = useState('');
  const cardRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Overlays for “LIKE” / “NOPE”
  const [showLikeOverlay, setShowLikeOverlay] = useState(false);
  const [showNopeOverlay, setShowNopeOverlay] = useState(false);

  // Matches
  const [matches, setMatches] = useState([]);
  const [likedMe, setLikedMe] = useState([]);

  // Keep track of how many swipes the user has done
  const [swipeCount, setSwipeCount] = useState(0);
  // For demonstration: after the first 5 auto-matches, pick a new auto-match threshold
  const [nextAutoMatchAt, setNextAutoMatchAt] = useState(0);

  // For the tutorial (only shown once)
  const [showTutorial, setShowTutorial] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Check session user
      const authRes = await fetch('http://localhost:5000/api/protected', {
        credentials: 'include',
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
          // Show approximate location to avoid over-sharing
          setLocation(`${locData.city}, ${locData.region}`);
        }
      } catch (err) {
        console.error('Could not fetch location:', err);
      }
    })();

    // Let’s start nextAutoMatchAt at e.g. 6
    setNextAutoMatchAt(6);

    // Cleanup for toast
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [navigate]);

  useEffect(() => {
    // Whenever distanceFilter changes, re-filter the admins
    filterAdminsByDistance(allAdmins, distanceFilter);
  }, [distanceFilter, allAdmins]);

  async function loadDiscoverAdmins() {
    try {
      const discoverRes = await fetch('http://localhost:5000/api/auth/get-discover', {
        credentials: 'include',
      });
      const discoverData = await discoverRes.json();
      if (discoverRes.ok && discoverData.status === 'success') {
        let list = discoverData.discover || [];
  
        // Flatten each doc so that admin.username = doc.adminId.username, etc.
        list = list.map(doc => {
          const { _id, adminId, photos } = doc;
          return {
            // For convenient use in your JSX:
            _id: adminId?._id,                // The user’s actual _id
            username: adminId?.username || '',
            profilePic: adminId?.profilePic || '',
            role: adminId?.role || '',
            
            // The discover-admin “photos” array
            photos: photos || [],
  
            // Anything else you want to store:
            docId: _id,       // The DiscoverAdmin doc’s ID if you need it
          };
        });
  
        // Filter out the current user
        if (user?.id) {
          list = list.filter((adm) => adm._id !== user.id);
        }
        // Shuffle them so each refresh => random order
        shuffleArray(list);
  
        // Add mock distance & bio for demonstration
        const withExtras = list.map((adm) => ({
          ...adm,
          distance: Math.floor(Math.random() * 50 + 1),
          bio: "A short bio about me. Let's connect!",
        }));
        setAllAdmins(withExtras);
      }
    } catch (err) {
      console.error('Error loading discover admins:', err);
    }
  }
  

  // Filter by distance (client-side example)
  function filterAdminsByDistance(all, maxDistance) {
    const filtered = all.filter((adm) => adm.distance <= maxDistance);
    setAdmins(filtered);
  }

  async function loadPersistentMatches() {
    try {
      // 1) get fresh user => see which admins they liked
      const meRes = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include',
      });
      const meData = await meRes.json();
      if (meRes.ok && meData.status === 'success') {
        const likedIds = meData.user.likedAdmins || [];

        // 2) get all admins => cross-check who is liked
        const allRes = await fetch('http://localhost:5000/api/auth/all-admins', {
          credentials: 'include',
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
        credentials: 'include',
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
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  }

  // Current top card
  const currentAdmin = admins[0] || null;

  async function handleLike() {
    if (!currentAdmin) return;

    // Show the "LIKE" overlay
    setShowLikeOverlay(true);
    setTimeout(() => setShowLikeOverlay(false), 500);

    // Decide if auto match
    if (shouldAutoMatch()) {
      await doLikeAndPersist(currentAdmin, true /* isAutoMatch */);
    } else {
      await doLikeAndPersist(currentAdmin, false);
    }
    triggerSwipeAnimation('right');
  }

  function handleDislike() {
    if (!currentAdmin) return;

    // Show the "NOPE" overlay
    setShowNopeOverlay(true);
    setTimeout(() => setShowNopeOverlay(false), 500);

    showToast(`You disliked ${currentAdmin.username}.`, 'info');
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
          // Show "Instant match" in a toast
          showToast(`Instant match with ${admin.username}!`, 'success');
        } else {
          showToast(`You liked ${admin.username}, check your Messages!`, 'success');
        }
        // Add them to "matches" if not already in
        setMatches((prev) => {
          if (!prev.find((m) => m._id === admin._id)) {
            return [...prev, admin];
          }
          return prev;
        });
      } else {
        showToast(data.message || 'Error liking admin.', 'error');
      }
    } catch (err) {
      console.error('Like admin error:', err);
      showToast('Server error liking admin.', 'error');
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
      return true;
    }
    if (swipeCount + 1 === nextAutoMatchAt) {
      // pick a new threshold => 5 or 6 from NOW
      setNextAutoMatchAt(swipeCount + 1 + random5or6());
      return true;
    }
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
        mediaType: 'none',
      };
      const res = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  // A basic "badges" system for fun. Customize or remove as you like.
  function getSwipeBadge() {
    if (swipeCount < 5) return 'Newcomer';
    if (swipeCount < 15) return 'Explorer';
    if (swipeCount < 30) return 'Adventurer';
    return 'Swiping Pro';
  }

  // Show toast in top-right corner
  function showToast(text, type = 'info') {
    setToast({ text, type });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ text: '', type: '' });
    }, 2500);
  }

  // RENDER TAB CONTENT
  function renderTabContent() {
    if (activeTab === 'swipe') {
      if (loading) {
        return (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Loading potential creators...</p>
          </div>
        );
      }
      if (admins.length === 0) {
        return (
          <div className="no-admins-box">
            <p className="no-admins">
              <span role="img" aria-label="party">
                🎉
              </span>{' '}
              No more creators to discover!
            </p>
          </div>
        );
      }

      const admin = admins[0];
      const totalPhotos = admin.photos ? admin.photos.length : 0;
      const currentPhoto =
        totalPhotos > 0 ? admin.photos[photoIndex] : admin.profilePic;
      const photoUrl = currentPhoto ? getFullMediaUrl(currentPhoto) : defaultAvatar;

      return (
        <>
          {showTutorial && (
            <div className="tutorial-box">
              <h4>How to Discover Creators</h4>
              <p>
                Swipe left (<strong>X</strong>) to dislike, or swipe right (
                <strong>♥</strong>) to like. You can also tap the icons below.
              </p>
              <button
                className="btn-close-tutorial"
                onClick={() => setShowTutorial(false)}
              >
                Got it!
              </button>
            </div>
          )}

          <div
            className={`tinder-card-outer unified-card ${
              cardExit ? `exit-${exitDirection}` : ''
            }`}
            ref={cardRef}
          >
            {/* Overlays */}
            {showLikeOverlay && <div className="swipe-overlay like">LIKE</div>}
            {showNopeOverlay && <div className="swipe-overlay nope">NOPE</div>}

            <div className="iphone-card">
              <div className="photo-container">
                <img src={photoUrl} alt={admin.username} className="main-photo" />
                {totalPhotos > 1 && (
                  <div className="photo-nav">
                    <button
                      className="arrow-btn"
                      onClick={handlePrevPhoto}
                      disabled={photoIndex <= 0}
                      title="Previous"
                    >
                      &lt;
                    </button>
                    <button
                      className="arrow-btn"
                      onClick={handleNextPhoto}
                      disabled={photoIndex >= totalPhotos - 1}
                      title="Next"
                    >
                      &gt;
                    </button>
                  </div>
                )}
                {totalPhotos > 1 && (
                  <div className="photo-indicators">
                    {admin.photos.map((_, i) => (
                      <div
                        key={i}
                        className={`dot ${i === photoIndex ? 'active' : ''}`}
                      ></div>
                    ))}
                  </div>
                )}
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
                  ✖
                </button>
                <button
                  className="action-btn no-bg-icon"
                  onClick={handleLike}
                  title="Like"
                >
                  ❤
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (activeTab === 'matches') {
      if (!matches.length) {
        return (
          <p style={{ color: '#999', marginTop: '1rem' }}>No matches yet!</p>
        );
      }
      return (
        <div className="matches-grid">
          {matches.map((m) => (
            <div className="match-card unified-card" key={m._id}>
              <img
                src={m.profilePic ? getFullMediaUrl(m.profilePic) : defaultAvatar}
                alt={m.username}
                className="match-avatar"
                onClick={() => window.open(`/profile/${m._id}`, '_blank')}
                style={{ cursor: 'pointer' }}
                /* Simple "preview" with a title tooltip. You could do a fancy modal if you like. */
                title={`Bio: ${m.bio || 'No bio available.'}`}
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
            <div className="match-card unified-card" key={adm._id}>
              <img
                src={adm.profilePic ? getFullMediaUrl(adm.profilePic) : defaultAvatar}
                alt={adm.username}
                className="match-avatar"
                onClick={() => window.open(`/profile/${adm._id}`, '_blank')}
                style={{ cursor: 'pointer' }}
                title={`Bio: ${adm.bio || 'No bio available.'}`}
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

  // Simple stats card: total swipes, matches, etc.
  function renderDiscoveryStats() {
    const totalMatches = matches.length;
    const likedYouCount = likedMe.length;
    const badge = getSwipeBadge();

    return (
      <div className="discover-stats-card unified-card">
        <h3 className="stats-title">Your Discovery Stats</h3>
        <ul className="stats-list">
          <li>
            <strong>Total Swipes:</strong> {swipeCount}
          </li>
          <li>
            <strong>Matches:</strong> {totalMatches}
          </li>
          <li>
            <strong>People Who Liked You:</strong> {likedYouCount}
          </li>
        </ul>
        <p className="badge-info">
          <strong>Badge:</strong> {badge}
        </p>
      </div>
    );
  }

  return (
    <div className="discover-page">
      {/* LEFT SIDEBAR -- DO NOT TOUCH */}
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
      {/* END LEFT SIDEBAR */}

      {/* MAIN BUBBLE => "tinder card" & new tabs */}
      <main className="right-bubble bubble-section discover-right">
        <div className="top-row">
          <div>
            <h2 className="discover-heading">Discover Creators Near You</h2>
            <p className="location-note">
              Your approximate location: {location || 'Unknown'}
            </p>
          </div>

          {/* Distance filter slider */}
          <div className="distance-filter-box">
            <label className="distance-label">
              Max Distance: <strong>{distanceFilter} km</strong>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(Number(e.target.value))}
              className="distance-slider"
            />
          </div>
        </div>

        {/* Discovery Stats Card */}
        {renderDiscoveryStats()}

        {/* TAB BAR */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'swipe' ? 'active' : ''}`}
            onClick={() => setActiveTab('swipe')}
          >
            <span className="tab-icon">🔥</span> Swiping
          </button>
          <button
            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <span className="tab-icon">❤️</span> Matches
          </button>
          <button
            className={`tab-btn ${activeTab === 'likes' ? 'active' : ''}`}
            onClick={() => setActiveTab('likes')}
          >
            <span className="tab-icon">⭐</span> Who Liked Me
          </button>
        </div>

        <div className="tab-content">{renderTabContent()}</div>
      </main>

      {/* Toast Notification */}
      {toast.text && (
        <div className={`toast-container ${toast.type}`}>
          <div className="toast-message">{toast.text}</div>
        </div>
      )}
    </div>
  );
}

export default DiscoverPage;
