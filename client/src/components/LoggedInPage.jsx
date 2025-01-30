import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LoggedInPage.css';
import './Sidebar.css';
import { io } from 'socket.io-client';

/**
 * Ensures a video/image src is fully qualified:
 * If the DB has "/uploads/foo.mp4", we prepend "http://localhost:5000".
 */
function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url; // Already absolute
  }
  return url;
}

function LoggedInPage() {
  const navigate = useNavigate();

  // Main user & notifications
  const [user, setUser] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifsPanel, setShowNotifsPanel] = useState(false);

  const socketRef = useRef(null);

  // Feed videos
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [filterType, setFilterType] = useState('all');

  // Comments
  const [openCommentsVideo, setOpenCommentsVideo] = useState(null);
  const [videoComments, setVideoComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);
  const [showMoreComments, setShowMoreComments] = useState(false);

  // Container ref + "scroll to top" handling
  const containerRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Suggested creators
  const [suggestedCreators, setSuggestedCreators] = useState([]);

  // Collapsed sidebars
  const [sidebarsCollapsed, setSidebarsCollapsed] = useState(false);

  // DM chats
  const [dmChats, setDmChats] = useState([]); // array of { _id, username, profilePic, unread }
  const [dmActiveChat, setDmActiveChat] = useState(null);
  const [dmReply, setDmReply] = useState('');
  const [showDmPanel, setShowDmPanel] = useState(false);
  const hasNewMessage = dmChats.some((adm) => adm.unread > 0);

  // Follow message (pop-up after following)
  const [followMessage, setFollowMessage] = useState('');

  // On mount => check dark mode
  useEffect(() => {
    const savedDark = localStorage.getItem('darkMode') === 'true';
    if (savedDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, []);

  // Check user session, fetch feed, suggested, DM chats
  useEffect(() => {
    (async () => {
      try {
        // 1) Check user session
        const res = await fetch('/api/protected', {
          credentials: 'include'
        });
        if (res.status === 401) {
          navigate('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // 2) Fetch feed
        await fetchVideos();

        // 3) Fetch suggested
        const sugRes = await fetch('/api/auth/get-suggested');
        const sugData = await sugRes.json();
        if (sugRes.ok && sugData.status === 'success') {
          setSuggestedCreators(sugData.suggested || []);
        }

        // 4) DM chat info
        await loadDmChats();
      } catch (err) {
        console.error('Auth check error:', err);
      }
    })();

    // Auto‐collapse sidebars on iPhone
    const isIphone = /iPhone/i.test(window.navigator.userAgent);
    if (isIphone) {
      setSidebarsCollapsed(true);
    }
  }, [navigate]);

  // After user is known => fetch existing notifications + socket
  useEffect(() => {
    if (!user) return;

    // 1) Fetch existing notifications
    (async () => {
      try {
        const res = await fetch('api/notifications', {
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          setNotifications(data.notifications); // store in state
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    })();

    // 2) Connect socket for real-time notifications
    io('/', { withCredentials: true }); 
    socketRef.current = s;

    // Join the user's room
    s.emit('join-user', user.id);

    // Listen for new notifications
    s.on('new-notification', (data) => {
      console.log('Received new-notification:', data);
      setNotifications((prev) => [data, ...prev]);
    });

    // Cleanup on unmount
    return () => {
      s.disconnect();
    };
  }, [user]);

  // --- Functions ---

  async function fetchVideos() {
    try {
      const res = await fetch('api/videos/feed', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setVideos(data.videos || []);
      } else {
        console.error('Feed error:', data.message);
      }
    } catch (err) {
      console.error('Fetch feed error:', err);
    }
  }

  async function loadDmChats() {
    try {
      const res = await fetch('api/messages/dm-chats', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setDmChats(data.data);
      }
    } catch (err) {
      console.error('Error loading dm-chats:', err);
    }
  }

  const handleFollow = async (creatorId, creatorRole) => {
    try {
      const res = await fetch(
        `api/profile/${creatorId}/follow`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        // Instead of alert()
        if (creatorRole === 'admin') {
          setFollowMessage('You have successfully followed the admin!');
        } else {
          setFollowMessage('Followed successfully!');
        }
        setTimeout(() => setFollowMessage(''), 3000);

        // Refresh feed
        await fetchVideos();
      } else {
        alert(data.message || 'Error following user.');
      }
    } catch (err) {
      console.error('Follow error:', err);
      alert('Server error following user.');
    }
  };

  // Like the main video
  const handleLike = async (videoId) => {
    if (!user) return;
    try {
      const res = await fetch(`api/videos/${videoId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setVideos((prev) =>
          prev.map((vid) => {
            if (vid._id === videoId) {
              let updatedLikes;
              if (data.isLiked) {
                updatedLikes = [...(vid.likes || []), user.id];
              } else {
                updatedLikes = vid.likes.filter((uid) => uid !== user.id);
              }
              return { ...vid, likes: updatedLikes };
            }
            return vid;
          })
        );
      } else {
        alert(data.message || 'Error liking video.');
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  // Like a comment
  const handleCommentLike = async (commentId) => {
    if (!user || !openCommentsVideo) return;
    try {
      const url = `api/videos/${openCommentsVideo}/comment/${commentId}/like`;
      const res = await fetch(url, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setVideoComments((prevComments) =>
          prevComments.map((c) => {
            if (c._id === commentId) {
              let updatedLikes;
              if (data.isLiked) {
                updatedLikes = [...(c.likes || []), user.id];
              } else {
                updatedLikes = c.likes.filter((uid) => uid !== user.id);
              }
              return { ...c, likes: updatedLikes };
            }
            // Check nested replies
            if (c.replies && c.replies.length > 0) {
              const updatedR = c.replies.map((r) => {
                if (r._id === commentId) {
                  let updated2;
                  if (data.isLiked) {
                    updated2 = [...(r.likes || []), user.id];
                  } else {
                    updated2 = r.likes.filter((uid) => uid !== user.id);
                  }
                  return { ...r, likes: updated2 };
                }
                return r;
              });
              return { ...c, replies: updatedR };
            }
            return c;
          })
        );
      } else {
        alert(data.message || 'Error liking comment.');
      }
    } catch (err) {
      console.error('Comment like error:', err);
    }
  };

  // Open/close comments
  const handleOpenComments = async (videoId) => {
    try {
      if (openCommentsVideo === videoId) {
        setOpenCommentsVideo(null);
        setVideoComments([]);
        return;
      }
      const res = await fetch(`api/videos/single/${videoId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data._id) {
        setOpenCommentsVideo(videoId);
        setVideoComments(data.comments || []);
        setShowMoreComments(false);
      } else {
        alert(data.message || 'Error fetching comments.');
      }
    } catch (err) {
      console.error('Open comments error:', err);
    }
  };

  // Submit comment
  const handleCommentSubmit = async (videoId) => {
    if (!commentInput.trim()) return;
    try {
      const endpoint = replyParentId
        ? `api/videos/${videoId}/comment/${replyParentId}/reply`
        : `api/videos/${videoId}/comment`;

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setCommentInput('');
        setReplyParentId(null);
        // Refresh
        const updatedVideo = await fetch(
          `api/videos/single/${videoId}`,
          { credentials: 'include' }
        ).then((r) => r.json());
        if (updatedVideo.status === 'success') {
          setVideoComments(updatedVideo.comments || []);
        }
      } else {
        alert(data.message || 'Error adding comment.');
      }
    } catch (err) {
      console.error('Comment submit error:', err);
    }
  };

  // Start a reply
  const handleReplyClick = (parentId) => {
    if (!parentId) return;
    setReplyParentId(parentId);
    const inputEl = document.querySelector('.add-comment input');
    if (inputEl) inputEl.focus();
  };

  // Cancel reply
  const handleCancelReply = () => {
    setReplyParentId(null);
    setCommentInput('');
  };

  // Show first 5 or all comments
  const displayedComments = showMoreComments
    ? videoComments
    : videoComments.slice(0, 5);

  // Share => copy link
  const handleShare = (videoUrl) => {
    try {
      navigator.clipboard.writeText(videoUrl);
      alert('Link copied!');
    } catch (err) {
      console.error('Share error:', err);
      alert('Could not copy link.');
    }
  };

  // Filter + sort
  function filteredVideos() {
    let temp = [...videos];
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      temp = temp.filter((v) => {
        const uploaderName =
          v.uploaderData?.[0]?.username?.toLowerCase() || '';
        const title = v.title?.toLowerCase() || '';
        return uploaderName.includes(lower) || title.includes(lower);
      });
    }
    if (filterType === 'photos') {
      temp = temp.filter((v) => v.isPhoto);
    } else if (filterType === 'videos') {
      temp = temp.filter((v) => !v.isPhoto);
    }
    if (sortBy === 'newest') {
      temp.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'likes') {
      temp.sort(
        (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)
      );
    }
    return temp;
  }

  // Toggle search bar
  function toggleSearchBar() {
    setShowSearchBar((p) => !p);
  }

  // Mouse wheel => next/prev
  function handleWheel(e) {
    if (e.target.closest('.comments-panel')) return;
    if (e.deltaY > 0) {
      setCurrentVideoIndex((p) =>
        Math.min(p + 1, filteredVideos().length - 1)
      );
      setOpenCommentsVideo(null);
    } else if (e.deltaY < 0) {
      setCurrentVideoIndex((p) => Math.max(p - 1, 0));
      setOpenCommentsVideo(null);
    }
  }

  // Listen for scroll
  function handleScroll() {
    if (!containerRef.current) return;
    setShowScrollTop(containerRef.current.scrollTop > 300);
  }
  function handleScrollToTop() {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Logout
  function handleLogout() {
    fetch('api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  }

  // DM logic
  function handleMessageBubbleClick() {
    setShowDmPanel((prev) => !prev);
  }

  async function handleOpenChat(adminId) {
    setDmActiveChat(adminId);
    try {
      await fetch('api/messages/mark-as-read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAdminId: adminId })
      });
    } catch (err) {
      console.error('mark-as-read error:', err);
    }
    setDmChats((prev) =>
      prev.map((c) => (c._id === adminId ? { ...c, unread: 0 } : c))
    );
  }

  async function handleSendDm(e) {
    e.preventDefault();
    if (!dmReply.trim() || !dmActiveChat) return;
    try {
      const res = await fetch('api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: dmActiveChat,
          content: dmReply,
          mediaUrl: '',
          mediaType: 'none'
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setDmReply('');
        alert('Message sent to ' + dmActiveChat);
      } else {
        alert(data.message || 'Error sending DM');
      }
    } catch (err) {
      console.error('Send DM error:', err);
    }
  }

  // Mark notification as read
  async function markAsRead(notifId) {
    try {
      const res = await fetch(
        `api/notifications/${notifId}/mark-read`,
        {
          method: 'PATCH',
          credentials: 'include'
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notifId ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  }

  // Helper: build descriptive text for each notif
  function formatNotificationText(notif) {
    if (!notif.fromUser) {
      // e.g. system notifications
      return notif.text || 'Notification';
    }

    const fromName = notif.fromUser.username;

    switch (notif.type) {
      case 'comment': {
        // e.g. "Robert commented on your video 'MyTitle'"
        const vidTitle = notif.video?.title || '(untitled video)';
        return `${fromName} commented on your video "${vidTitle}"`;
      }
      case 'like': {
        const vidTitle = notif.video?.title || '(untitled video)';
        return `${fromName} liked your video "${vidTitle}"`;
      }
      case 'message':
        // e.g. "Robert sent you a message"
        return `${fromName} sent you a message`;
      default:
        return notif.text || 'New notification!';
    }
  }

  /**
   * When user clicks the notification => navigate them to the relevant place
   */
  function handleNotificationClick(notif) {
    // 1) Mark as read
    if (!notif.read) {
      markAsRead(notif._id);
    }

    // 2) If it's about a video => find the video in the feed
    if (notif.video) {
      const videoId = typeof notif.video === 'object'
        ? notif.video._id
        : notif.video; // if only stored as ID
      const idx = videos.findIndex((v) => v._id === videoId);
      if (idx >= 0) {
        // Move feed to that video
        setCurrentVideoIndex(idx);

        // If it’s a comment => open comments
        if (notif.type === 'comment') {
          // The handleOpenComments function loads the comments for that video
          handleOpenComments(videoId);
        }

        // Hide the panel
        setShowNotifsPanel(false);
      } else {
        alert('Video not found in your feed. Maybe it’s older or not in the feed.');
      }
    }
    else if (notif.type === 'message' && notif.fromUser) {
      // 3) If it’s a message => open DM panel, select that user
      setShowDmPanel(true);
      setDmActiveChat(notif.fromUser._id);
      setShowNotifsPanel(false);
    }
  }

  // If user not loaded
  if (!user) {
    return <p style={{ padding: '1rem' }}>Loading user...</p>;
  }

  // Fallback onError => force a default avatar
  function onImgError(e) {
    e.target.onerror = null;
    e.target.src = '/default-avatar.png'; // Ensure this file is in your public folder
  }

  const userPicUrl = user.profilePic
    ? `${getFullMediaUrl(user.profilePic)}?cb=${Date.now()}`
    : '';

  // Filter final videos
  const videosToDisplay = filteredVideos();

  // If no videos in feed
  if (videosToDisplay.length === 0) {
    return (
      <div
        className={`logged-in-page ${
          sidebarsCollapsed ? 'sidebars-collapsed' : ''
        }`}
        ref={containerRef}
      >
        {/* LEFT SIDEBAR */}
        <aside
          className={`left-sidebar bubble-section ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <div className="user-info-card">
            <img
              src={userPicUrl}
              alt=""
              className="user-avatar"
              style={{ display: userPicUrl ? 'block' : 'none' }}
              onError={onImgError}
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
              <Link to="/messages" className={hasNewMessage ? 'has-new' : ''}>
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
            {user?.role === 'admin' && (
              <li>
                <Link to="/master">
                  <span className="menu-icon">🛠</span> Master
                </Link>
              </li>
            )}
          </ul>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </aside>

        {/* MIDDLE COLUMN */}
        <main
          className={`middle-column bubble-section ${
            sidebarsCollapsed ? 'expanded' : ''
          }`}
        >
          <div
            className="top-bar"
            style={{ marginBottom: '0.8rem', borderBottom: '1px solid #ccc' }}
          >
            <h1 className="home-title">HOME</h1>
            <div className="top-bar-right">
              <button className="icon-btn" onClick={toggleSearchBar} title="Search">
                <span className="icon icon-search"></span>
              </button>
              <button
                className="icon-btn"
                title={sidebarsCollapsed ? 'Expand sidebars' : 'Collapse sidebars'}
                onClick={() => setSidebarsCollapsed((prev) => !prev)}
              >
                {sidebarsCollapsed ? (
                  <span className="icon icon-menu"></span>
                ) : (
                  <span className="icon icon-close"></span>
                )}
              </button>
            </div>
          </div>

          {showSearchBar && (
            <div className="search-row">
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <div className="no-videos-yet">
            <p>No videos yet. Check back later!</p>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside
          className={`right-sidebar bubble-section suggested-bar ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <h3 className="suggested-heading simpler-suggested-title">
            Suggested Creators
          </h3>
          <div className="suggested-list">
            {suggestedCreators.map((sc) => {
              let bgStyle = {};
              if (sc.bannerPic) {
                bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.bannerPic)})`;
              } else if (sc.recentMedia?.length) {
                bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.bannerPic)})`;
              }
              bgStyle.backgroundSize = 'cover';
              bgStyle.backgroundPosition = 'center';

              const creatorPic = sc.profilePic
                ? `${getFullMediaUrl(sc.profilePic)}?cb=${Date.now()}`
                : '';

              return (
                <div key={sc._id} className="suggested-card" style={bgStyle}>
                  <div className="card-inner">
                    <img
                      src={creatorPic}
                      alt=""
                      className="suggested-avatar"
                      style={{ display: creatorPic ? 'block' : 'none' }}
                      onError={onImgError}
                    />
                    <div className="suggested-info">
                      <div className="suggested-name">{sc.username}</div>
                      <div className="suggested-handle">
                        @{sc.username.toLowerCase()}
                      </div>
                    </div>
                    <button
                      className="suggested-follow-btn"
                      onClick={() => handleFollow(sc._id, sc.role)}
                    >
                      Follow
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* The bubble => open DM panel */}
        <div className="message-bubble" onClick={handleMessageBubbleClick}>
          <div className="message-bubble-icon">💬</div>
          {hasNewMessage && <div className="message-bubble-badge">1</div>}
        </div>

        {/* DM panel */}
        {showDmPanel && (
          <div className="direct-message-panel">
            <h4>Direct Messages</h4>
            <div style={{ marginBottom: '0.8rem' }}>
              {dmChats.map((chat) => {
                const avatarUrl = chat.profilePic
                  ? getFullMediaUrl(chat.profilePic)
                  : '/default-avatar.png';
                return (
                  <div
                    key={chat._id}
                    className="dm-chat-row"
                    onClick={() => handleOpenChat(chat._id)}
                  >
                    <div className="dm-avatar-wrap">
                      <img
                        src={avatarUrl}
                        alt={chat.username}
                        className="dm-avatar-img"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      {chat.unread > 0 && (
                        <div className="dm-unread-badge">{chat.unread}</div>
                      )}
                    </div>
                    <span className="dm-username">{chat.username}</span>
                  </div>
                );
              })}
            </div>
            {dmActiveChat && (
              <form onSubmit={handleSendDm}>
                <input
                  type="text"
                  placeholder={
                    'Message ' +
                    (dmChats.find((c) => c._id === dmActiveChat)?.username || '')
                  }
                  value={dmReply}
                  onChange={(e) => setDmReply(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                />
                <button type="submit">Send Reply</button>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  // If there ARE videos
  const currentVideo = videosToDisplay[currentVideoIndex];
  const isVideoLiked = currentVideo.likes?.some(
    (likeId) => likeId.toString() === user.id
  );
  const finalMediaUrl = getFullMediaUrl(currentVideo.videoUrl);

  const userPicForSidebar = user.profilePic
    ? `${getFullMediaUrl(user.profilePic)}?cb=${Date.now()}`
    : '';

  return (
    <div
      className={`logged-in-page ${sidebarsCollapsed ? 'sidebars-collapsed' : ''}`}
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* LEFT SIDEBAR */}
      <aside
        className={`left-sidebar bubble-section ${
          sidebarsCollapsed ? 'collapsed' : ''
        }`}
      >
        <div className="user-info-card">
          <img
            src={userPicForSidebar}
            alt=""
            className="user-avatar"
            style={{ display: userPicForSidebar ? 'block' : 'none' }}
            onError={onImgError}
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
            <Link to="/messages" className={hasNewMessage ? 'has-new' : ''}>
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
          {user?.role === 'admin' && (
            <li>
              <Link to="/master">
                <span className="menu-icon">🛠</span> Master
              </Link>
            </li>
          )}
        </ul>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </aside>

      {/* MIDDLE COLUMN => the feed */}
      <main
        className={`middle-column bubble-section ${
          sidebarsCollapsed ? 'expanded' : ''
        }`}
      >
        <div
          className="top-bar"
          style={{ marginBottom: '0.8rem', borderBottom: '1px solid #ccc' }}
        >
          <h1 className="home-title">HOME</h1>
          <div className="top-bar-right">
            {/* Refresh feed */}
            <button className="icon-btn" onClick={fetchVideos} title="Refresh Feed">
              <span className="icon icon-refresh"></span>
            </button>

            <button className="icon-btn" onClick={toggleSearchBar} title="Search">
              <span className="icon icon-search"></span>
            </button>
            <button
              className="icon-btn"
              onClick={() => navigate('/settings')}
              title="Wallet"
            >
              <span className="icon icon-wallet"></span>
            </button>

            {/* The Notification Bell */}
            <button
              className="icon-btn"
              onClick={() => setShowNotifsPanel(!showNotifsPanel)}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <span className="icon icon-bell"></span>
              {/* If any unread notifications, show a small badge */}
              {(() => {
                const unreadCount = notifications.filter(n => !n.read).length;
                return unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: 'red',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '12px',
                      lineHeight: '18px',
                      textAlign: 'center',
                    }}
                  >
                    {unreadCount}
                  </span>
                );
              })()}
            </button>

            {/* Collapsible sidebars */}
            <button
              className="icon-btn"
              title={sidebarsCollapsed ? 'Expand sidebars' : 'Collapse sidebars'}
              onClick={() => setSidebarsCollapsed((prev) => !prev)}
            >
              {sidebarsCollapsed ? (
                <span className="icon icon-menu"></span>
              ) : (
                <span className="icon icon-close"></span>
              )}
            </button>
          </div>
        </div>

        {/* ========== Notifications panel ========== */}
        {showNotifsPanel && (
          <div className="notifications-panel">
            <h4>Notifications</h4>
            {notifications.length === 0 && <p>No notifications yet.</p>}

            {notifications.map((notif) => {
              const notifText = formatNotificationText(notif);
              const dateStr = new Date(notif.createdAt).toLocaleString();

              return (
                <div
                  key={notif._id}
                  className={`notif-item ${notif.read ? 'read' : 'unread'}`}
                  // Clickable => go to relevant content
                  onClick={() => handleNotificationClick(notif)}
                  style={{ cursor: 'pointer' }}
                >
                  <p style={{ margin: '0' }}>{notifText}</p>
                  <small style={{ color: '#666' }}>{dateStr}</small>
                  {!notif.read && (
                    <button
                      style={{ marginTop: '0.3rem' }}
                      onClick={(e) => {
                        e.stopPropagation(); // prevent bubble to the item-level onClick
                        markAsRead(notif._id);
                      }}
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* ======================================== */}

        {showSearchBar && (
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search title or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="likes">Most Liked</option>
            </select>
            <div className="filter-container">
              <button
                className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filterType === 'photos' ? 'active' : ''}`}
                onClick={() => setFilterType('photos')}
              >
                Photos
              </button>
              <button
                className={`filter-btn ${filterType === 'videos' ? 'active' : ''}`}
                onClick={() => setFilterType('videos')}
              >
                Videos
              </button>
            </div>
          </div>
        )}

        <div className="single-video-full" onWheel={handleWheel}>
          <div className="video-container" key={currentVideo._id}>
            <div className="video-frame">
              {currentVideo.isPhoto ? (
                <img
                  src={finalMediaUrl}
                  alt={currentVideo.title}
                  className="video-player"
                />
              ) : (
                <video
                  src={finalMediaUrl}
                  controls
                  className="video-player"
                />
              )}

              {/* Action icons */}
              <div className="video-actions">
                <button
                  className={`icon-btn ${isVideoLiked ? 'liked' : ''}`}
                  onClick={() => handleLike(currentVideo._id)}
                  title="Like"
                >
                  <span className="icon icon-heart"></span>
                  {currentVideo.likes?.length > 0 && (
                    <span className="like-count">{currentVideo.likes.length}</span>
                  )}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => handleOpenComments(currentVideo._id)}
                  title="Comments"
                >
                  <span className="icon icon-comment"></span>
                </button>
                <button
                  className="icon-btn"
                  onClick={() => handleShare(finalMediaUrl)}
                  title="Share"
                >
                  <span className="icon icon-share"></span>
                  {currentVideo.shareCount > 0 && (
                    <span className="share-count">{currentVideo.shareCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Uploader info => top-left */}
            <div className="uploader-row">
              <Link
                to={`/profile/${currentVideo.uploaderData?.[0]?._id}`}
                className="uploader-link"
              >
                <img
                  src={
                    currentVideo.uploaderData?.[0]?.profilePic
                      ? getFullMediaUrl(
                          currentVideo.uploaderData[0].profilePic
                        ) + `?cb=${Date.now()}`
                      : ''
                  }
                  alt=""
                  className="uploader-pic"
                  style={{
                    display: currentVideo.uploaderData?.[0]?.profilePic
                      ? 'block'
                      : 'none'
                  }}
                  onError={onImgError}
                />
                <span className="uploader-name">
                  {currentVideo.uploaderData?.[0]?.username || 'Unknown'}
                </span>
              </Link>
            </div>

            {/* Show caption if comments are closed */}
            {openCommentsVideo === currentVideo._id ? null : (
              <div className="video-caption">{currentVideo.title}</div>
            )}

            {/* Comments panel */}
            {openCommentsVideo === currentVideo._id && (
              <div className="comments-panel">
                <div className="comments-header">
                  <span>Comments</span>
                  <span className="comment-count">({videoComments.length})</span>
                </div>
                <div className="comment-list">
                  {displayedComments.map((c) => {
                    const commenter = c.user || {};
                    const commenterPic = commenter.profilePic
                      ? getFullMediaUrl(commenter.profilePic) + `?cb=${Date.now()}`
                      : '';
                    const isCreator = commenter.role === 'admin';
                    const userAlreadyLiked = c.likes?.some(
                      (uid) => uid.toString() === user.id
                    );

                    return (
                      <div key={c._id} className="single-comment-bubble">
                        <div className="bubble-top-row">
                          <img
                            src={commenterPic}
                            alt=""
                            className="comment-user-pic"
                            style={{ display: commenterPic ? 'block' : 'none' }}
                            onError={onImgError}
                          />
                          <div className="bubble-username">
                            {commenter.username || 'Anon'}
                            {isCreator && (
                              <span className="creator-badge">Creator</span>
                            )}
                          </div>
                        </div>
                        <div className="bubble-content">{c.content}</div>
                        <div className="bubble-actions">
                          <button
                            className={`bubble-like-btn ${userAlreadyLiked ? 'liked' : ''}`}
                            onClick={() => handleCommentLike(c._id)}
                          >
                            <span className="icon icon-heart"></span>
                            {c.likes?.length > 0 && (
                              <span className="comment-like-count">
                                {c.likes.length}
                              </span>
                            )}
                          </button>
                          <button
                            className="bubble-reply-btn"
                            onClick={() => handleReplyClick(c._id)}
                          >
                            Reply
                          </button>
                        </div>

                        {/* Nested replies */}
                        {c.replies && c.replies.length > 0 && (
                          <div className="nested-replies">
                            {c.replies.map((r) => {
                              const rUserPic = r.user?.profilePic
                                ? getFullMediaUrl(r.user.profilePic) +
                                  `?cb=${Date.now()}`
                                : '';
                              const userAlreadyLiked2 = r.likes?.some(
                                (uid) => uid.toString() === user.id
                              );

                              return (
                                <div
                                  key={r._id}
                                  className="single-comment-bubble nested-reply"
                                >
                                  <div className="bubble-top-row">
                                    <img
                                      src={rUserPic}
                                      alt=""
                                      className="comment-user-pic"
                                      style={{ display: rUserPic ? 'block' : 'none' }}
                                      onError={onImgError}
                                    />
                                    <div className="bubble-username">
                                      {r.user?.username || 'Anon'}
                                      {r.user?.role === 'admin' && (
                                        <span className="creator-badge">Creator</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bubble-content">{r.content}</div>
                                  <div className="bubble-actions">
                                    <button
                                      className={`bubble-like-btn ${
                                        userAlreadyLiked2 ? 'liked' : ''
                                      }`}
                                      onClick={() => handleCommentLike(r._id)}
                                    >
                                      <span className="icon icon-heart"></span>
                                      {r.likes?.length > 0 && (
                                        <span className="comment-like-count">
                                          {r.likes.length}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      className="bubble-reply-btn"
                                      onClick={() => handleReplyClick(r._id)}
                                    >
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {videoComments.length > 5 && (
                  <button
                    className="show-more-comments-btn"
                    onClick={() => setShowMoreComments(!showMoreComments)}
                  >
                    {showMoreComments ? 'Show Less' : 'Show More'}
                  </button>
                )}

                {/* Add comment */}
                <div className="add-comment">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {replyParentId && (
                      <div className="replying-to">
                        Replying to a comment
                        <button
                          className="cancel-reply-btn"
                          onClick={handleCancelReply}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add a public comment..."
                    />
                  </div>
                  <button onClick={() => handleCommentSubmit(currentVideo._id)}>
                    {replyParentId ? 'Reply' : 'Post'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR => suggested creators */}
      <aside
        className={`right-sidebar bubble-section suggested-bar ${
          sidebarsCollapsed ? 'collapsed' : ''
        }`}
      >
        <h3 className="suggested-heading simpler-suggested-title">
          Suggested Creators
        </h3>
        <div className="suggested-list">
          {suggestedCreators.map((sc) => {
            let bgStyle = {};
            if (sc.bannerPic) {
              bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.bannerPic)})`;
            } else if (sc.recentMedia?.length > 0) {
              bgStyle.backgroundImage = `url(${getFullMediaUrl(sc.bannerPic)})`;
            }
            bgStyle.backgroundSize = 'cover';
            bgStyle.backgroundPosition = 'center';

            const scPic = sc.profilePic
              ? `${getFullMediaUrl(sc.profilePic)}?cb=${Date.now()}`
              : '';

            return (
              <div className="suggested-card" key={sc._id} style={bgStyle}>
                <div className="card-inner">
                  <img
                    src={scPic}
                    alt=""
                    className="suggested-avatar"
                    style={{ display: scPic ? 'block' : 'none' }}
                    onError={onImgError}
                  />
                  <div className="suggested-info">
                    <div className="suggested-name">{sc.username}</div>
                    <div className="suggested-handle">
                      @{sc.username.toLowerCase()}
                    </div>
                  </div>
                  <button
                    className="suggested-follow-btn"
                    onClick={() => handleFollow(sc._id, sc.role)}
                  >
                    Follow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {showScrollTop && (
        <button className="scroll-to-top-btn" onClick={handleScrollToTop}>
          ↑
        </button>
      )}

      {/* Bottom-right bubble => open DM panel */}
      <div className="message-bubble" onClick={handleMessageBubbleClick}>
        <div className="message-bubble-icon">💬</div>
        {hasNewMessage && <div className="message-bubble-badge">1</div>}
      </div>

      {showDmPanel && (
        <div className="direct-message-panel">
          <h4>Direct Messages</h4>
          <div style={{ marginBottom: '0.8rem' }}>
            {dmChats.map((chat) => {
              const avatarUrl = chat.profilePic
                ? getFullMediaUrl(chat.profilePic)
                : '/default-avatar.png';
              return (
                <div
                  key={chat._id}
                  className="dm-chat-row"
                  onClick={() => handleOpenChat(chat._id)}
                >
                  <div className="dm-avatar-wrap">
                    <img
                      src={avatarUrl}
                      alt={chat.username}
                      className="dm-avatar-img"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                    {chat.unread > 0 && (
                      <div className="dm-unread-badge">{chat.unread}</div>
                    )}
                  </div>
                  <span className="dm-username">{chat.username}</span>
                </div>
              );
            })}
          </div>
          {dmActiveChat && (
            <form onSubmit={handleSendDm}>
              <input
                type="text"
                placeholder={
                  'Message ' +
                  (dmChats.find((c) => c._id === dmActiveChat)?.username || '')
                }
                value={dmReply}
                onChange={(e) => setDmReply(e.target.value)}
                style={{ width: '100%', marginBottom: '0.5rem' }}
              />
              <button type="submit">Send Reply</button>
            </form>
          )}
        </div>
      )}

      {/* Show the follow message popup */}
      {followMessage && (
        <div className="follow-message-popup">
          {followMessage}
        </div>
      )}
    </div>
  );
}

export default LoggedInPage;
