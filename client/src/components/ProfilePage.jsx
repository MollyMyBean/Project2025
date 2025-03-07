import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import './ProfilePage.css';
import './Sidebar.css';

/** Utility: Convert relative path ("/uploads/foo.mp4") => absolute "http://localhost:5000/uploads/foo.mp4". */
function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

// Use a proper default avatar path (make sure public/images/default.png exists)
const defaultAvatar = '/images/default.png';

function ProfilePage() {
  const { adminId } = useParams();
  const navigate = useNavigate();

  const [cacheBuster] = useState(() => Date.now());
  const [user, setUser] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [adminBundles, setAdminBundles] = useState([]); // Admin’s available bundles
  const [suggestedCreators, setSuggestedCreators] = useState([]);

  // NEW: for story overlay
  const [showStory, setShowStory] = useState(false);

  // On mount => check session, fetch this admin's profile, fetch suggested
  useEffect(() => {
    (async () => {
      try {
        // 1) Check user session
        const authRes = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include',
        });
        if (authRes.status === 401) {
          navigate('/');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // 2) Load the admin’s profile
        await fetchProfile(adminId);

        // 3) Load suggested creators
        const sugRes = await fetch('http://localhost:5000/api/auth/get-suggested');
        const sugData = await sugRes.json();
        if (sugRes.ok && sugData.status === 'success') {
          setSuggestedCreators(sugData.suggested || []);
        }
      } catch (err) {
        console.error('Profile load error:', err);
      }
    })();
  }, [adminId, navigate]);

  async function fetchProfile(id) {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAdminInfo(data.admin);
        setItems(data.items || []);
        if (data.admin.adminBundles) {
          setAdminBundles(data.admin.adminBundles);
        }
      } else {
        alert(data.message || 'Error fetching profile.');
        navigate('/home');
      }
    } catch (err) {
      console.error('fetchProfile error:', err);
    }
  }

  // For logout
  function handleLogout() {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  }

  // Follow an admin
  async function handleFollow(creatorId) {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${creatorId}/follow`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Followed successfully!');
        fetchProfile(adminId);
      } else {
        alert(data.message || 'Follow failed.');
      }
    } catch (err) {
      console.error('Follow error:', err);
      alert('Server error following admin.');
    }
  }

  // Subscribe => paid
  async function handleSubscribe() {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${adminId}/subscribe`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Subscribed successfully (Paid)!');
        fetchProfile(adminId);
      } else {
        if (data.message && data.message.includes('No payment method')) {
          alert(data.message);
          navigate('/settings?tab=payment');
        } else {
          alert(data.message || 'Subscription failed.');
        }
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('Server error subscribing to admin.');
    }
  }

  // Unlock a single locked post
  async function handleUnlock(contentId) {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${adminId}/unlock/${contentId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Unlocked successfully!');
        fetchProfile(adminId);
      } else {
        alert(data.message || 'Error unlocking content.');
      }
    } catch (err) {
      console.error('Unlock error:', err);
    }
  }

  // Buy entire bundle
  async function handleBuyBundle(bundleId, title) {
    if (!window.confirm(`Buy bundle "${title}" now?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${adminId}/buy-bundle/${bundleId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Bundle purchased successfully!');
      } else {
        alert(data.message || 'Error buying bundle.');
      }
    } catch (err) {
      console.error('buy-bundle error:', err);
      alert('Server error buying bundle.');
    }
  }

  // Like a post
  async function handleLike(postId) {
    try {
      const res = await fetch(`http://localhost:5000/api/videos/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Error liking the post.');
        return;
      }
      await fetchProfile(adminId);
    } catch (err) {
      console.error(err);
      alert('Server error liking this post.');
    }
  }

  // Comment on a post
  async function handleComment(postId) {
    const commentText = prompt('Enter your comment:');
    if (!commentText) return;
    try {
      const res = await fetch(`http://localhost:5000/api/videos/${postId}/comment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Error commenting on the post.');
        return;
      }
      alert('Comment added successfully!');
      await fetchProfile(adminId);
    } catch (err) {
      console.error(err);
      alert('Server error commenting on the post.');
    }
  }

  // Share
  async function handleShare(postId) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post!',
          text: 'I found an interesting post on this platform!',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share error:', err);
        alert(`Could not share post ${postId}.`);
      }
    } else {
      alert(`Post ${postId} shared (fallback)`);
    }
  }

  if (!user) {
    return <p style={{ padding: '2rem' }}>Loading user...</p>;
  }
  if (!adminInfo) {
    return <p style={{ padding: '2rem' }}>Loading admin profile...</p>;
  }

  // Count # of posts + total likes:
  const totalPosts = items.length;
  const totalLikes = items.reduce((acc, it) => acc + (it.likes?.length || 0), 0);

  // For the banner + avatar + story
  const userPicUrl = user.profilePic
    ? `${getFullMediaUrl(user.profilePic)}?cb=${cacheBuster}`
    : defaultAvatar;
  const adminPicUrl = adminInfo.profilePic
    ? `${getFullMediaUrl(adminInfo.profilePic)}?cb=${cacheBuster}`
    : defaultAvatar;
  const topBannerUrl = adminInfo.bannerPic
    ? `${getFullMediaUrl(adminInfo.bannerPic)}?cb=${cacheBuster}`
    : '/images/banner.jpg';

  // If admin has story => clicking the avatar triggers
  function handleAvatarClick() {
    if (adminInfo.storyUrl) {
      setShowStory(true);
    }
  }

  return (
    <div className="profile-page">
      {/* LEFT SIDEBAR */}
      <aside className="left-sidebar bubble-section">
        <div className="user-info-card">
          {userPicUrl && (
            <img
              src={userPicUrl}
              alt="User Avatar"
              className="user-avatar"
              style={{ objectFit: 'cover' }}
            />
          )}
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

      {/* MIDDLE COLUMN => Admin feed */}
      <main className="middle-column new-middle-column">
  {/* HERO SECTION */}
      <section
        className="profile-hero"
        style={{ backgroundImage: `url(${topBannerUrl})` }}
      >
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-avatar" onClick={handleAvatarClick}>
            <img src={adminPicUrl} alt={adminInfo.username} />
          </div>
          <div className="hero-info">
            <h1 className="hero-name">
              {adminInfo.username} <span className="verified-check">✔</span>
            </h1>
            <p className="hero-status">● ONLINE</p>
            <p className="hero-location"><span>📍</span> Your dreams</p>
            <p className="hero-bio">
              {adminInfo.bio || 'Some example bio text for the admin.'}
            </p>
            
          </div>
          <div className="hero-cta">
            <div className="offer-banner">
              50% off if you follow me right now!
            </div>
            <button className="subscribe-btn" onClick={handleSubscribe}>
              Subscribe
              <span className="old-price">$12.99</span>
              <span className="new-price">$6.50/month</span>
            </button>
            <div className="limited-offers">🔥 Few offers left!</div>
          </div>
        </div>
      </section>

      {/* BUNDLES SECTION */}
      {adminBundles.length > 0 && (
      <section className="bundles-section">
        <h2 className="bundles-title">Exclusive Bundles</h2>
        <div className="bundles-container">
          {adminBundles.map((bundle) => (
            <div key={bundle._id} className="bundle-card">
              {bundle.coverUrl && (
                <div className="bundle-image">
                  <img
                    src={getFullMediaUrl(bundle.coverUrl)}
                    alt={bundle.title}
                  />
                </div>
              )}
              <div className="bundle-info">
                <h3 className="bundle-title">{bundle.title}</h3>
                {bundle.description && (
                  <p className="bundle-description">{bundle.description}</p>
                )}
                {/* Merge the price into the button text */}
                {user.id !== adminId && (
                  <button
                    className="bundle-buy-btn"
                    onClick={() => handleBuyBundle(bundle._id, bundle.title)}
                  >
                    Buy Now ${bundle.price}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    )}




      {/* FEED POSTS SECTION */}
      {/* FEED POSTS SECTION – VERTICAL LIST with Updated Action Icons */}
      <section className="feed-section">
        <h2 className="section-title">Latest Posts</h2>
        {items.length === 0 ? (
          <p className="no-posts">No posts yet.</p>
        ) : (
          <div className="feed-list">
            {items.map((item) => {
              // Determine if the post is locked
              const locked = !item.videoUrl;
              // Build the media URL if available
              const itemMediaUrl = locked
                ? ''
                : `${getFullMediaUrl(item.videoUrl)}?cb=${cacheBuster}`;
              return (
                <div key={item._id} className="post-card">
                  <div className="post-header">
                    <img
                      src={adminPicUrl}
                      alt={adminInfo.username}
                      className="post-avatar"
                    />
                    <span className="post-author">{adminInfo.username}</span>
                  </div>
                  <h3 className="post-title">{item.title}</h3>
                  <div className="post-media">
                    {locked ? (
                      <div className="locked-post">
                        <div className="locked-overlay">Locked Content</div>
                        <p className="locked-price">Price: ${item.price || 5}</p>
                        {user.id !== adminId && (
                          <button
                            className="unlock-btn"
                            onClick={() => handleUnlock(item._id)}
                          >
                            Unlock for ${item.price || 5}
                          </button>
                        )}
                      </div>
                    ) : item.isPhoto ? (
                      <img
                        src={itemMediaUrl}
                        alt={item.title}
                        className="media-img"
                      />
                    ) : (
                      <video
                        src={itemMediaUrl}
                        controls
                        className="media-video"
                      />
                    )}
                  </div>
                  <div className="post-actions">
                    <button
                      className={`icon-btn ${item.likes && item.likes.includes(user.id) ? 'liked' : ''}`}
                      onClick={() => handleLike(item._id)}
                      title="Like"
                    >
                      <span className="icon icon-heart"></span>
                      {item.likes && item.likes.length > 0 && (
                        <span className="like-count">{item.likes.length}</span>
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleComment(item._id)}
                      title="Comment"
                    >
                      <span className="icon icon-comment"></span>
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleShare(item._id)}
                      title="Share"
                    >
                      <span className="icon icon-share"></span>
                      {item.shareCount > 0 && (
                        <span className="share-count">{item.shareCount}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </main>


      {/* RIGHT SIDEBAR => suggested creators */}
      <aside className="right-sidebar bubble-section">
        <h3 className="suggested-heading simpler-suggested-title">
          Suggested Creators
        </h3>
        <div className="suggested-list">
          {suggestedCreators.map((sc) => {
            const scPicUrl = sc.profilePic
              ? getFullMediaUrl(sc.profilePic) + `?cb=${cacheBuster}`
              : defaultAvatar;
            let bgStyle = { backgroundSize: 'cover', backgroundPosition: 'center' };
            if (sc.bannerPic) {
              bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.bannerPic)}?cb=${cacheBuster})`;
            } else if (sc.recentMedia?.length > 0) {
              bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.recentMedia[0].url)}?cb=${cacheBuster})`;
            }
            return (
              <div className="suggested-card" key={sc._id} style={bgStyle}>
                <div className="card-inner">
                  {scPicUrl && (
                    <img
                      src={scPicUrl}
                      alt={sc.username}
                      className="suggested-avatar"
                    />
                  )}
                  <div className="suggested-info">
                    <div className="suggested-name">{sc.username}</div>
                    <div className="suggested-handle">@{sc.username.toLowerCase()}</div>
                  </div>
                  <button
                    className="suggested-follow-btn"
                    onClick={() => handleFollow(sc._id)}
                  >
                    Follow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        
      </aside>

      {/* The story overlay => if showStory is true & there's a storyUrl */}
      {showStory && adminInfo.storyUrl && (
        <div
          className="story-overlay"
          onClick={() => setShowStory(false)}
        >
          <div className="story-content" onClick={(e) => e.stopPropagation()}>
            {/\.(mp4|mov|webm|ogg)$/i.test(adminInfo.storyUrl)
              ? (
                <video
                  src={getFullMediaUrl(adminInfo.storyUrl)}
                  controls
                  autoPlay
                  className="story-video"
                />
              ) : (
                <img
                  src={getFullMediaUrl(adminInfo.storyUrl)}
                  alt="Admin Story"
                  className="story-image"
                />
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
