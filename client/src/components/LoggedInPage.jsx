import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LoggedInPage.css';
import './Sidebar.css';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import GiphyPicker from 'react-giphy-picker';




function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

function LoggedInPage() {
  const navigate = useNavigate();

  // Main user
  const [user, setUser] = useState(null);

  // Controls the deposit modal visibility
  const [showDepositModal, setShowDepositModal] = useState(false);

  const funnyGifs = [
    'https://media.giphy.com/media/26xBwdIuRJiAIqHwA/giphy.gif',
    'https://media.giphy.com/media/l0HlOvJ7yaacpuSas/giphy.gif',
    'https://media.giphy.com/media/3ov9jNziFTMfzSumAw/giphy.gif',
    'https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif',
    'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif',
    'https://media.giphy.com/media/3oEjHP8ELRNNlnlLGM/giphy.gif',
    'https://media.giphy.com/media/3o7TKr3AU9MZ2kEQGI/giphy.gif',
    'https://media.giphy.com/media/l4Jz3a8jO92crUlWM/giphy.gif'
  ];
  
  

  // Holds the user-entered deposit amount
  const [depositAmount, setDepositAmount] = useState('');

  // Optional: A deposit note for the transaction
  const [depositNote, setDepositNote] = useState('');

  // To simulate an API call processing state
  const [depositProcessing, setDepositProcessing] = useState(false);
  const [tweetMedia, setTweetMedia] = useState(null);


  // For error or success messages
  const [depositError, setDepositError] = useState('');
  const [depositSuccess, setDepositSuccess] = useState('');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifsPanel, setShowNotifsPanel] = useState(false);

  const videoRef = useRef(null);

  // Socket ref
  const socketRef = useRef(null);

  // Video feed state
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Video search / filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [filterType, setFilterType] = useState('all');
  const [admins, setAdmins] = useState([]);

  // Video comments
  const [openCommentsVideo, setOpenCommentsVideo] = useState(null);
  const [videoComments, setVideoComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);
  const [showMoreComments, setShowMoreComments] = useState(false);

  // DM (private messages)
  const [dmChats, setDmChats] = useState([]);
  const [dmActiveChat, setDmActiveChat] = useState(null);
  const [dmReply, setDmReply] = useState('');
  const [showDmPanel, setShowDmPanel] = useState(false);
  const [dmConversation, setDmConversation] = useState([]);
  const dmPreviewRef = useRef(null);
  const hasNewMessage = dmChats.some((adm) => adm.unread > 0);

  // Scroll container + scroll-to-top button
  const containerRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Suggested creators
  const [suggestedCreators, setSuggestedCreators] = useState([]);

  // Collapsed sidebars
  const [sidebarsCollapsed, setSidebarsCollapsed] = useState(false);

  // Follow message
  const [followMessage, setFollowMessage] = useState('');

  // Feed mode: "video" or "twitter"
  const [feedMode, setFeedMode] = useState('twitter');

  // Tweets state
  const [tweetText, setTweetText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [posts, setPosts] = useState([]);

  const [showTweetComments, setShowTweetComments] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Check for dark mode on mount
  useEffect(() => {
    const savedDark = localStorage.getItem('darkMode') === 'true';
    if (savedDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }, []);

  // 1) Check user session, fetch videos, suggested, DM
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

        // Fetch videos
        await fetchVideos();

        // Suggested
        const sugRes = await fetch('http://localhost:5000/api/auth/get-suggested');
        const sugData = await sugRes.json();
        if (sugRes.ok && sugData.status === 'success') {
          setSuggestedCreators(sugData.suggested || []);
        }

        // DM
        await loadDmChats();
      } catch (err) {
        console.error('Auth check error:', err);
      }
    })();

    // If iPhone => auto collapse sidebars
    const isIphone = /iPhone/i.test(window.navigator.userAgent);
    if (isIphone) setSidebarsCollapsed(true);
  }, [navigate]);

  useEffect(() => {
    fetch('http://localhost:5000/api/auth/all-admins', {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          setAdmins(data.admins);
        } else {
          console.error(data.message);
        }
      })
      .catch((err) => console.error('Error fetching admins:', err));
  }, []);
  

  // 2) Once user known => fetch notifications + connect socket => then fetch tweets
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const res = await fetch('http://localhost:5000/api/notifications', {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    })();

    const s = io('http://localhost:5000', { withCredentials: true });
    socketRef.current = s;
    s.emit('join-user', user.id);
    s.on('new-notification', (data) => {
      setNotifications((prev) => [data, ...prev]);
    });
    return () => {
      s.disconnect();
    };
  }, [user]);

  // 3) Fetch tweets once user is known
  useEffect(() => {
    if (user) fetchTweets();
  }, [user]);

  

  // DM scroll to bottom
  useEffect(() => {
    if (dmPreviewRef.current) {
      dmPreviewRef.current.scrollTop = dmPreviewRef.current.scrollHeight;
    }
  }, [dmConversation]);

  // ----------------- TWEETS -----------------
  async function fetchTweets() {
    try {
      const res = await fetch('http://localhost:5000/api/twitter/posts', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPosts(data.tweets);
      } else {
        console.error('Tweet fetch error:', data.message);
      }
    } catch (err) {
      console.error('fetchTweets error:', err);
    }
  }

  function handleDepositSubmit() {
    setDepositError('');
    setDepositSuccess('');
  
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError('Please enter a valid amount.');
      return;
    }
    
    setDepositProcessing(true);
    
    // OPTIONAL: Replace this with your API call.
    setTimeout(() => {
      const updatedBalance = (user.balance || 0) + amount;
      setUser({ ...user, balance: updatedBalance });
      
      setDepositSuccess(`Successfully deposited $${amount.toFixed(2)}!`);
      
      // Clear input fields and disable processing.
      setDepositAmount('');
      setDepositNote('');
      setDepositProcessing(false);
      
      // Auto-close the modal after a short delay.
      setTimeout(() => {
        setDepositSuccess('');
        setShowDepositModal(false);
      }, 1500);
      
    }, 1500);
  }
  
  
  function togglePlayPause() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }
  
  // 3) Rewind or skip a certain # of seconds
  function skipSeconds(amount) {
    if (!videoRef.current) return;
    videoRef.current.currentTime += amount;
  }

  async function handleTweetSubmit() {
    // Only proceed if there is content, a selected file, or a GIF
    if (!tweetText.trim() && !selectedFile && !tweetMedia) {
      return;
    }
    try {
      const formData = new FormData();
      // Ensure content is never empty (for GIF-only tweets, send a single space)
      formData.append('content', tweetText.trim() || ' ');
      
      if (selectedFile) {
        formData.append('mediaFile', selectedFile);
      }
      
      // NEW: Convert the GIF URL into a file if a GIF was selected.
      if (tweetMedia) {
        const response = await fetch(tweetMedia);
        const blob = await response.blob();
        const file = new File([blob], "gif.gif", { type: blob.type });
        formData.append('mediaFile', file);
      }
    
      const res = await fetch('http://localhost:5000/api/twitter/posts', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        // Merge the logged-in user as the author
        const newTweet = { ...data.tweet, author: { ...user } };
        setPosts((prev) => [newTweet, ...prev]);
        // Clear out the fields after submission.
        setTweetText('');
        setSelectedFile(null);
        setTweetMedia(null);
      } else {
        alert(data.message || 'Could not create tweet.');
      }
    } catch (err) {
      console.error('Create tweet error:', err);
      alert('Server error creating tweet.');
    }
  }
  
  async function handleLikeTweet(tweetId) {
    try {
      const res = await fetch(`http://localhost:5000/api/twitter/${tweetId}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        if (res.ok && data.status === 'success') {
          setPosts((prev) =>
            prev.map((p) =>
              p._id === tweetId ? { ...data.tweet, author: p.author } : p
            )
          );
        }
        
      } else {
        alert(data.message || 'Error liking tweet.');
      }
    } catch (err) {
      console.error('Like tweet error:', err);
    }
  }

  function toggleTweetComments(tweetId) {
    if (showTweetComments === tweetId) {
      setShowTweetComments(null);
    } else {
      setShowTweetComments(tweetId);
    }
  }


  function handleAddEmoji() {
    // Toggle the emoji picker modal
    setShowEmojiPicker(true);
  }
  
  function handleAddGif() {
    // Toggle the GIF picker modal
    setShowGifPicker(true);
  }
  
  
  async function handleCommentSubmitTweet(tweetId) {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch(`http://localhost:5000/api/twitter/${tweetId}/comment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPosts((prev) => prev.map((p) => (p._id === tweetId ? data.tweet : p)));
        setNewCommentText('');
      } else {
        alert(data.message || 'Error posting comment.');
      }
    } catch (err) {
      console.error('Comment tweet error:', err);
    }
  }

  function handleShareTweet(tweetId) {
    const url = `https://mysite.com/tweet/${tweetId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert('Tweet link copied to clipboard!');
      })
      .catch((err) => {
        console.error('Error copying link:', err);
      });
  }

  async function handleDeleteTweet(tweetId) {
    if (!window.confirm('Are you sure you want to delete this tweet?')) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/twitter/${tweetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPosts((prev) => prev.filter((p) => p._id !== tweetId));
      } else {
        alert(data.message || 'Error deleting tweet.');
      }
    } catch (err) {
      console.error('Delete tweet error:', err);
    }
  }

  // ---------------- VIDEOS ----------------
  async function fetchVideos() {
    try {
      const res = await fetch('http://localhost:5000/api/videos/feed', {
        credentials: 'include',
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

  const handleLike = async (videoId) => {
    if (!user) return;
    try {
      const res = await fetch(`http://localhost:5000/api/videos/${videoId}/like`, {
        method: 'POST',
        credentials: 'include',
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

  const handleOpenComments = async (videoId) => {
    try {
      if (openCommentsVideo === videoId) {
        setOpenCommentsVideo(null);
        setVideoComments([]);
        return;
      }
      const res = await fetch(`http://localhost:5000/api/videos/single/${videoId}`, {
        credentials: 'include',
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

  const handleCommentSubmit = async (videoId) => {
    if (!commentInput.trim()) return;
    try {
      const endpoint = replyParentId
        ? `http://localhost:5000/api/videos/${videoId}/comment/${replyParentId}/reply`
        : `http://localhost:5000/api/videos/${videoId}/comment`;
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommentInput('');
        setReplyParentId(null);
        const updatedVideo = await fetch(
          `http://localhost:5000/api/videos/single/${videoId}`,
          {
            credentials: 'include',
          }
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

  const handleReplyClick = (parentId) => {
    if (!parentId) return;
    setReplyParentId(parentId);
    // The following focus line was referencing a non-existent class; removing it as unused:
    // const inputEl = document.querySelector('.add-comment input');
    // if (inputEl) inputEl.focus();
  };

  const handleCancelReply = () => {
    setReplyParentId(null);
    setCommentInput('');
  };

  const displayedComments = showMoreComments
    ? videoComments
    : videoComments.slice(0, 5);

  const handleShare = (videoUrl) => {
    try {
      navigator.clipboard.writeText(videoUrl);
      alert('Link copied!');
    } catch (err) {
      console.error('Share error:', err);
      alert('Could not copy link.');
    }
  };

  // ---------------- DM CHATS ----------------
  async function loadDmChats() {
    try {
      const res = await fetch('http://localhost:5000/api/messages/dm-chats', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setDmChats(data.data);
      }
    } catch (err) {
      console.error('Error loading dm-chats:', err);
    }
  }

  async function handleOpenChat(adminId) {
    setDmActiveChat(adminId);
    try {
      const res = await fetch(
        `http://localhost:5000/api/messages/dm-conversation/${adminId}`,
        {
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setDmConversation(data.conversation);
      } else {
        console.error('Error fetching DM conversation:', data.message);
        setDmConversation([]);
      }
    } catch (err) {
      console.error('Error fetching DM conversation:', err);
      setDmConversation([]);
    }
    try {
      await fetch('http://localhost:5000/api/messages/mark-as-read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAdminId: adminId }),
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
      const res = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: dmActiveChat,
          content: dmReply,
          mediaUrl: '',
          mediaType: 'none',
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setDmReply('');
        setDmConversation((prev) => [...prev, data.newMessage]);
      } else {
        alert(data.message || 'Error sending DM');
      }
    } catch (err) {
      console.error('Send DM error:', err);
    }
  }

  // ---------------- FOLLOW ----------------
  const handleFollow = async (creatorId, creatorRole) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/profile/${creatorId}/follow`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setFollowMessage(
          creatorRole === 'admin'
            ? 'You have successfully followed the admin!'
            : 'Followed successfully!'
        );
        setTimeout(() => setFollowMessage(''), 3000);
        await fetchVideos();
      } else {
        alert(data.message || 'Error following user.');
      }
    } catch (err) {
      console.error('Follow error:', err);
      alert('Server error following user.');
    }
  };

  // ---------------- LOGOUT ----------------
  function handleLogout() {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  }

  // ---------------- NOTIFICATIONS ----------------
  async function markAsRead(notifId) {
    try {
      const res = await fetch(
        `http://localhost:5000/api/notifications/${notifId}/mark-read`,
        {
          method: 'PATCH',
          credentials: 'include',
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

  function formatNotificationText(notif) {
    if (!notif.fromUser) {
      return notif.text || 'Notification';
    }
    const fromName = notif.fromUser.username;
    switch (notif.type) {
      case 'comment': {
        const vidTitle = notif.video?.title || '(untitled video)';
        return `${fromName} commented on your video "${vidTitle}"`;
      }
      case 'like': {
        const vidTitle = notif.video?.title || '(untitled video)';
        return `${fromName} liked your video "${vidTitle}"`;
      }
      case 'message':
        return `${fromName} sent you a message`;
      default:
        return notif.text || 'New notification!';
    }
  }

  function handleNotificationClick(notif) {
    if (!notif.read) {
      markAsRead(notif._id);
    }
    if (notif.video) {
      const videoId =
        typeof notif.video === 'object' ? notif.video._id : notif.video;
      const idx = videos.findIndex((v) => v._id === videoId);
      if (idx >= 0) {
        setCurrentVideoIndex(idx);
        if (notif.type === 'comment') {
          handleOpenComments(videoId);
        }
        setShowNotifsPanel(false);
      } else {
        alert('Video not found in your feed.');
      }
    } else if (notif.type === 'message' && notif.fromUser) {
      setShowDmPanel(true);
      setDmActiveChat(notif.fromUser._id);
      setShowNotifsPanel(false);
    }
  }

  function renderNotificationPanel() {
    return (
      <div className="notifications-panel">
        <h4>Notifications</h4>
        {notifications.length === 0 ? (
          <p className="no-notifs">You have no new notifications.</p>
        ) : (
          <div className="notif-list">
            {notifications.map((notif) => {
              const notifText = notif.text || formatNotificationText(notif);
              const dateStr = new Date(notif.createdAt).toLocaleString();
              return (
                <div
                  key={notif._id}
                  className={`notif-card ${notif.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="notif-avatar">
                    {notif.fromUser && notif.fromUser.profilePic ? (
                      <img
                        src={getFullMediaUrl(notif.fromUser.profilePic)}
                        alt={notif.fromUser.username}
                        onError={(e) => {
                          e.target.src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <div className="default-notif-avatar">
                        {notif.type[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="notif-content">
                    <div className="notif-header">
                      <span className="notif-sender">
                        {notif.fromUser ? notif.fromUser.username : 'System'}
                      </span>
                      <span className="notif-type">{notif.type}</span>
                    </div>
                    <div className="notif-message">{notifText}</div>
                    <div className="notif-footer">
                      <small className="notif-timestamp">{dateStr}</small>
                      {!notif.read && (
                        <button
                          className="mark-read-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif._id);
                          }}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function toggleSearchBar() {
    setShowSearchBar((p) => !p);
  }

  function handleMessageBubbleClick() {
    setShowDmPanel((prev) => !prev);
  }

  function handleScroll() {
    if (!containerRef.current) return;
    setShowScrollTop(containerRef.current.scrollTop > 300);
  }

  function handleScrollToTop() {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

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
      temp.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    }
    return temp;
  }

  if (!user) {
    return <p style={{ padding: '1rem' }}>Loading user...</p>;
  }

  const userPicUrl = user.profilePic
    ? `${getFullMediaUrl(user.profilePic)}?cb=${Date.now()}`
    : '';

  // Final rendering logic

  const videosToDisplay = filteredVideos();

  // If feedMode=video and no videos
  if (feedMode === 'video' && videosToDisplay.length === 0) {
    return (
      <div
        className={`logged-in-page ${
          sidebarsCollapsed ? 'sidebars-collapsed' : ''
        }`}
        ref={containerRef}
      >
        <aside
          className={`left-sidebar bubble-section ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <div
            className="sidebar-toggle-btn"
            onClick={() => setSidebarsCollapsed(!sidebarsCollapsed)}
          >
            <span className="icon icon-menu"></span>
          </div>
          <div className="user-info-card">
            {userPicUrl && (
              <img
                src={userPicUrl}
                alt=""
                className="user-avatar"
                onError={(e) => {
                  e.target.src = '/logo.png';
                }}
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

        <main
          className={`middle-column bubble-section ${
            sidebarsCollapsed ? 'expanded' : ''
          }`}
        >
          <div
            className="top-bar"
            style={{ marginBottom: '0.8rem', borderBottom: '1px solid #ccc' }}
          >
            <h1 className="home-title">FanPOV</h1>
            <div className="top-bar-right">
              <div
                className="wallet-balance"
                onClick={() => setShowDepositModal(true)}
                title="Deposit Funds"
              >
                Balance: ${user.balance || 0}
              </div>
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
              const scPic = sc.profilePic
                ? `${getFullMediaUrl(sc.profilePic)}?cb=${Date.now()}`
                : '';
              return (
                <div className="suggested-card" key={sc._id} style={bgStyle}>
                  <div className="card-inner">
                    {scPic && (
                      <img
                        src={scPic}
                        alt=""
                        className="suggested-avatar"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
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
              <>
                <div className="dm-conversation-preview" ref={dmPreviewRef}>
                  {dmConversation.length === 0 ? (
                    <p>No messages yet.</p>
                  ) : (
                    dmConversation.slice(-3).map((msg) => (
                      <div
                        key={msg._id}
                        className={`dm-message ${
                          msg.sender._id === user.id ? 'sent' : 'received'
                        }`}
                      >
                        <span>{msg.content}</span>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendDm}>
                  <input
                    type="text"
                    placeholder={
                      'Message ' +
                      (dmChats.find((c) => c._id === dmActiveChat)?.username ||
                        '')
                    }
                    value={dmReply}
                    onChange={(e) => setDmReply(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <button type="submit">Send Reply</button>
                </form>
              </>
            )}
          </div>
        )}

        {followMessage && (
          <div className="follow-message-popup">{followMessage}</div>
        )}
      </div>
    );
  }

  // If feedMode=video and we do have videos
  if (feedMode === 'video' && videosToDisplay.length > 0) {
    const currentVideo = videosToDisplay[currentVideoIndex];
    const isVideoLiked = currentVideo.likes?.some(
      (id) => id.toString() === user.id
    );
    const finalMediaUrl = getFullMediaUrl(currentVideo.videoUrl);

    return (
      <div
        className={`logged-in-page ${
          sidebarsCollapsed ? 'sidebars-collapsed' : ''
        }`}
        ref={containerRef}
        onScroll={handleScroll}
      >
        <aside
          className={`left-sidebar bubble-section ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <div
            className="sidebar-toggle-btn"
            onClick={() => setSidebarsCollapsed(!sidebarsCollapsed)}
          >
            <span className="icon icon-menu"></span>
          </div>
          <div className="user-info-card">
            {userPicUrl && (
              <img
                src={userPicUrl}
                alt=""
                className="user-avatar"
                onError={(e) => {
                  e.target.src = '/logo.png';
                }}
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

        <main
          className={`middle-column bubble-section ${
            sidebarsCollapsed ? 'expanded' : ''
          }`}
        >
          <div
            className="top-bar"
            style={{ marginBottom: '0.8rem', borderBottom: '1px solid #ccc' }}
          >
            <h1 className="home-title">FanPOV</h1>
            <div className="top-bar-right">
              <button className="icon-btn" onClick={fetchVideos} title="Refresh Feed">
                <span className="icon icon-refresh"></span>
              </button>
              <button className="icon-btn" onClick={toggleSearchBar} title="Search">
                <span className="icon icon-search"></span>
              </button>
              <div
                className="wallet-balance"
                onClick={() => setShowDepositModal(true)}
                title="Go to Wallet/Settings"
              >
                Balance: ${user.balance || 0}
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowNotifsPanel(!showNotifsPanel)}
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <span className="icon icon-bell"></span>
                {(() => {
                  const unreadCount = notifications.filter((n) => !n.read).length;
                  return (
                    unreadCount > 0 && (
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
                    )
                  );
                })()}
              </button>
              <button
                className="icon-btn"
                onClick={() => setFeedMode(feedMode === 'video' ? 'twitter' : 'video')}
                title="Toggle Feed Mode"
              >
                {feedMode === 'video' ? (
                  <span className="icon icon-twitter" />
                ) : (
                  <span className="icon icon-video-camera" />
                )}
              </button>
            </div>
          </div>

          {showNotifsPanel && renderNotificationPanel()}

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

      <div
        className="single-video-full"
        onWheel={(e) => {
          if (!e.target.closest('.video-frame')) return;

          const threshold = 0; // or 10, or 15—adjust to taste

          if (e.deltaY > threshold) {
            setCurrentVideoIndex((prev) => Math.min(prev + 1, videosToDisplay.length - 1));
            setOpenCommentsVideo(null);
          } else if (e.deltaY < -threshold) {
            setCurrentVideoIndex((prev) => Math.max(prev - 1, 0));
            setOpenCommentsVideo(null);
          }
        }}
      >

        {/* This container uses the current video's _id as the key, so it can "fade in" */}
        <div key={currentVideo._id} className="video-container fade-in">
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
                autoPlay
                loop
                muted
                className="video-player"
                onClick={togglePlayPause}
              />
            )}
          </div>

            {/* NEW translucent overlay (caption + action buttons) */}
            <div className="video-footer-overlay">
              <div className="footer-top-row">
                <div className="video-caption">{currentVideo.title}</div>
              </div>

              <div className="footer-bottom-row">
                {/* Left group (like, comment, share) */}
                <div className="footer-left-actions">
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

                {/* Right group (rewind / skip) */}
                <div className="footer-right-actions">
                  <button
                    className="icon-btn"
                    onClick={() => skipSeconds(-10)}
                    title="Rewind 10s"
                  >
                    <span className="icon icon-rewind"></span>
                  </button>

                  <button
                    className="icon-btn"
                    onClick={() => skipSeconds(10)}
                    title="Skip 10s"
                  >
                    <span className="icon icon-forward"></span>
                  </button>
                </div>
              </div>
            </div>


              <div className="uploader-row">
                <Link
                  to={`/profile/${currentVideo.uploaderData?.[0]?._id}`}
                  className="uploader-link"
                >
                  {currentVideo.uploaderData?.[0]?.profilePic && (
                    <img
                      src={
                        getFullMediaUrl(currentVideo.uploaderData[0].profilePic) +
                        `?cb=${Date.now()}`
                      }
                      alt=""
                      className="uploader-pic"
                      onError={(e) => {
                        e.target.src = '/logo.png';
                      }}
                    />
                  )}
                  <span className="uploader-name">
                    {currentVideo.uploaderData?.[0]?.username || 'Unknown'}
                  </span>
                </Link>
              </div>

              

              {openCommentsVideo === currentVideo._id && (
                <div className="comments-panel new-comments-panel">
                  <div className="comments-header">
                    <h3>
                      Comments <span className="comment-count">({videoComments.length})</span>
                    </h3>
                  </div>
                  <div className="comments-content">
                    {displayedComments.map((c) => {
                      const commenter = c.user || {};
                      const commenterPic = commenter.profilePic
                        ? getFullMediaUrl(commenter.profilePic) + `?cb=${Date.now()}`
                        : '/default-avatar.png';
                      return (
                        <div key={c._id} className="comment-card">
                          <div className="comment-avatar">
                            <img
                              src={commenterPic}
                              alt={commenter.username || 'Anon'}
                              onError={(e) => {
                                e.target.src = '/default-avatar.png';
                              }}
                            />
                          </div>
                          <div className="comment-body">
                            <div className="comment-meta">
                              <span className="comment-author">
                                {commenter.username || 'Anon'}
                              </span>
                            </div>
                            <div className="comment-text">{c.content}</div>
                            <div className="comment-actions">
                              <button className="comment-like-btn">
                                <span className="icon icon-heart"></span>
                                {c.likes?.length > 0 && (
                                  <span className="like-count">{c.likes.length}</span>
                                )}
                              </button>
                              <button
                                className="comment-reply-btn"
                                onClick={() => handleReplyClick(c._id)}
                              >
                                Reply
                              </button>
                            </div>
                            {c.replies && c.replies.length > 0 && (
                              <div className="nested-comments">
                                {c.replies.map((r) => {
                                  const rUserPic = r.user?.profilePic
                                    ? getFullMediaUrl(r.user.profilePic) +
                                      `?cb=${Date.now()}`
                                    : '/default-avatar.png';
                                  return (
                                    <div key={r._id} className="comment-card nested">
                                      <div className="comment-avatar">
                                        <img
                                          src={rUserPic}
                                          alt={r.user?.username || 'Anon'}
                                          onError={(e) => {
                                            e.target.src = '/default-avatar.png';
                                          }}
                                        />
                                      </div>
                                      <div className="comment-body">
                                        <div className="comment-meta">
                                          <span className="comment-author">
                                            {r.user?.username || 'Anon'}
                                          </span>
                                        </div>
                                        <div className="comment-text">{r.content}</div>
                                        <div className="comment-actions">
                                          <button className="comment-like-btn">
                                            <span className="icon icon-heart"></span>
                                            {r.likes?.length > 0 && (
                                              <span className="like-count">
                                                {r.likes.length}
                                              </span>
                                            )}
                                          </button>
                                          <button
                                            className="comment-reply-btn"
                                            onClick={() => handleReplyClick(r._id)}
                                          >
                                            Reply
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {videoComments.length > 5 && (
                    <div className="comments-toggle">
                      <button onClick={() => setShowMoreComments(!showMoreComments)}>
                        {showMoreComments ? 'Show Less Comments' : 'Show More Comments'}
                      </button>
                    </div>
                  )}
                  <div className="comment-input-section">
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
                      placeholder="Write your comment here..."
                    />
                    <button
                      className="post-comment-btn"
                      onClick={() => handleCommentSubmit(currentVideo._id)}
                    >
                      {replyParentId ? 'Reply' : 'Post'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

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
              const scPic = sc.profilePic
                ? `${getFullMediaUrl(sc.profilePic)}?cb=${Date.now()}`
                : '';
              return (
                <div className="suggested-card" key={sc._id} style={bgStyle}>
                  <div className="card-inner">
                    {scPic && (
                      <img
                        src={scPic}
                        alt=""
                        className="suggested-avatar"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
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
              <>
                <div className="dm-conversation-preview" ref={dmPreviewRef}>
                  {dmConversation.length === 0 ? (
                    <p>No messages yet.</p>
                  ) : (
                    dmConversation.slice(-3).map((msg) => (
                      <div
                        key={msg._id}
                        className={`dm-message ${
                          msg.sender._id === user.id ? 'sent' : 'received'
                        }`}
                      >
                        <span>{msg.content}</span>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendDm}>
                  <input
                    type="text"
                    placeholder={
                      'Message ' +
                      (dmChats.find((c) => c._id === dmActiveChat)?.username ||
                        '')
                    }
                    value={dmReply}
                    onChange={(e) => setDmReply(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <button type="submit">Send Reply</button>
                </form>
              </>
            )}
          </div>
        )}

        {followMessage && (
          <div className="follow-message-popup">{followMessage}</div>
        )}
      </div>
    );
  }

  // Otherwise, feedMode === 'twitter'
  
    return (
      <div
        className={`logged-in-page ${sidebarsCollapsed ? 'sidebars-collapsed' : ''}`}
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* Left sidebar, same as before */}
        <aside
          className={`left-sidebar bubble-section ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <div
            className="sidebar-toggle-btn"
            onClick={() => setSidebarsCollapsed(!sidebarsCollapsed)}
          >
            <span className="icon icon-menu"></span>
          </div>
          <div className="user-info-card">
            {user.profilePic && (
              <img
                src={getFullMediaUrl(user.profilePic)}
                alt=""
                className="user-avatar"
                onError={(e) => {
                  e.target.src = '/logo.png';
                }}
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

        {/* Middle column: the Twitter feed */}
        <main
          className={`middle-column bubble-section ${
            sidebarsCollapsed ? 'expanded' : ''
          }`}
        >
          <div
            className="top-bar"
            style={{ marginBottom: '0.8rem', borderBottom: '1px solid #ccc' }}
          >
            <h1 className="home-title">FanPOV</h1>
            <div className="top-bar-right">
              <button className="icon-btn" onClick={toggleSearchBar} title="Search">
                <span className="icon icon-search"></span>
              </button>
              <div
                className="wallet-balance"
                onClick={() => setShowDepositModal(true)}
                title="Deposit Funds"
              >
                Balance: ${user.balance || 0}
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowNotifsPanel(!showNotifsPanel)}
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <span className="icon icon-bell"></span>
                {(() => {
                  const unreadCount = notifications.filter((n) => !n.read).length;
                  return (
                    unreadCount > 0 && (
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
                    )
                  );
                })()}
              </button>
              <button
                className="icon-btn"
                onClick={() => setFeedMode(feedMode === 'video' ? 'twitter' : 'video')}
                title="Toggle Feed Mode"
              >
                {feedMode === 'video' ? (
                  <span className="icon icon-twitter" />
                ) : (
                  <span className="icon icon-video-camera" />
                )}
              </button>
            </div>
          </div>

          {/* Notification panel, same as before */}
          {showNotifsPanel && renderNotificationPanel()}

          {/* Optional search row, same as before */}
          {showSearchBar && (
            <div className="search-row">
              <input
                type="text"
                className="search-input"
                placeholder="Search tweets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* The TWEET BOX (compose) */}
          <div className="twitter-feed">
          <div className="tweet-box">
              <div className="tweet-box-header">
                {user.profilePic && (
                  <img
                    src={getFullMediaUrl(user.profilePic)}
                    alt="Your avatar"
                    className="tweet-user-avatar"
                  />
                )}
                <h2 className="tweet-box-title">What's happening?</h2>
              </div>
              <textarea
                className="tweet-input"
                placeholder="Share your thoughts..."
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                maxLength={280}
              ></textarea>

              {tweetMedia && (
                <div className="tweet-media-preview">
                  <img
                    src={tweetMedia}
                    alt="Selected GIF"
                    className="tweet-media-image"
                  />
                  <button
                    className="remove-media-btn"
                    onClick={() => setTweetMedia(null)}
                  >
                    ×
                  </button>
                </div>
              )}

              {selectedFile && (
                <div className="tweet-media-preview">
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Media preview"
                    className="tweet-media-image"
                  />
                  <button
                    className="remove-media-btn"
                    onClick={() => setSelectedFile(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="tweet-actions-bar">
                <div className="tweet-media-buttons">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    id="tweet-media-input"
                    style={{ display: 'none' }}
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                  <button
                    className="tweet-media-btn"
                    title="Upload Photo/Video"
                    onClick={() =>
                      document.getElementById('tweet-media-input').click()
                    }
                  >
                    <span className="icon icon-photo"></span>
                  </button>
                  <button className="tweet-media-btn" title="Add GIF" onClick={handleAddGif}>
                    <span className="icon icon-gif"></span>
                  </button>
                  <button className="tweet-media-btn" title="Add Emoji" onClick={handleAddEmoji}>
                    <span className="icon icon-emoji"></span>
                  </button>
                </div>
                <div className="tweet-controls">
                  <span className="tweet-char-count">
                    {tweetText.length}/280
                  </span>
                  <button className="tweet-post-btn" onClick={handleTweetSubmit}>
                    Tweet
                  </button>
                </div>
              </div>
            </div>


            {/* The LIST of TWEETS */}
            <div className="posts-feed">
              {posts.length === 0 ? (
                <p>No posts yet. Check back later!</p>
              ) : (
                posts.map((post) => {
                  const isLiked = post.likes?.some((uid) => uid.toString() === user.id);
                  const canDelete = post.author?._id === user.id || user.role === 'admin';

                  return (
                    <div key={post._id} className="post-card">
                      {/* Updated header with nicer styling */}
                      <div className="tweet-header">
                        {post.author?.profilePic && (
                          <img
                            className="tweet-avatar"
                            src={getFullMediaUrl(post.author.profilePic)}
                            alt={post.author?.username || 'Anon'}
                            onError={(e) => (e.target.style.display = 'none')}
                          />
                        )}
                        <div className="tweet-author-info">
                          <span className="tweet-author">
                            {post.author?.username || 'Unknown'}
                          </span>
                          {post.createdAt && (
                            <span className="tweet-time">
                              {new Date(post.createdAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Post content */}
                      <div className="tweet-body">{post.content}</div>
                      {post.mediaUrl && (
                        <div className="tweet-media">
                          <img
                            src={getFullMediaUrl(post.mediaUrl)}
                            alt="post media"
                            style={{
                              width: '50%',        // use a larger percentage or a fixed value
                              height: 'auto',       // maintain aspect ratio
                              margin: '0.5rem auto', // center the image horizontally
                              borderRadius: '6px',
                            }}
                          />
                        </div>
                      )}

                      {/* Action buttons now mimic the video feed buttons */}
                      <div className="tweet-actions">
                        <button
                          className={`icon-btn ${isLiked ? 'liked' : ''}`}
                          onClick={() => handleLikeTweet(post._id)}
                          title="Like"
                        >
                          <span className="icon icon-heart"></span>
                          {post.likes?.length > 0 && (
                            <span className="like-count">{post.likes.length}</span>
                          )}
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => toggleTweetComments(post._id)}
                          title="Comments"
                        >
                          <span className="icon icon-comment"></span>
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleShareTweet(post._id)}
                          title="Share"
                        >
                          <span className="icon icon-share"></span>
                        </button>
                        {canDelete && (
                          <button
                            className="icon-btn delete-btn"
                            onClick={() => handleDeleteTweet(post._id)}
                            title="Delete"
                          >
                            <span className="icon icon-close"></span>
                          </button>
                        )}
                      </div>

                      {/* Optional: comments panel (unchanged aside from spacing) */}
                      {showTweetComments === post._id && (
                        <div className="tweet-comments-panel">

                          <div className="comments-header">
                            <h3>
                              Comments <span className="comment-count">({post.comments.length})</span>
                            </h3>
                          </div>

                          <div className="comments-content">
                            {post.comments.map((comment) => {
                              const commenter = comment.user || {};
                              return (
                                <div key={comment._id} className="comment-card">
                                  <div className="comment-avatar">
                                    <img
                                      src={commenter.profilePic ? getFullMediaUrl(commenter.profilePic) : '/default-avatar.png'}
                                      alt={commenter.username || 'Anon'}
                                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                  </div>
                                  <div className="comment-body">
                                    <div className="comment-meta">
                                      <span className="comment-author">
                                        {commenter.username || 'Anon'}
                                      </span>
                                    </div>
                                    <div className="comment-text">{comment.content}</div>
                                    <div className="comment-actions">
                                      <button className="comment-like-btn">
                                        <span className="icon icon-heart"></span>
                                        {comment.likes?.length > 0 && (
                                          <span className="like-count">{comment.likes.length}</span>
                                        )}
                                      </button>
                                      <button
                                        className="comment-reply-btn"
                                        onClick={() => handleReply(comment._id)}
                                      >
                                        Reply
                                      </button>
                                    </div>
                                    {/* Nested replies go here, if any */}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Comment input */}
                          <div className="comment-input-section">
                            <input
                              type="text"
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              placeholder="Write a comment..."
                            />
                            <button
                              className="post-comment-btn"
                              onClick={() => handleCommentSubmitTweet(post._id)}
                            >
                              Post
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </main>

        {/* Right sidebar + DM bubble, same as before */}
        <aside
          className={`right-sidebar bubble-section suggested-bar ${
            sidebarsCollapsed ? 'collapsed' : ''
          }`}
        >
          <h3 className="suggested-heading simpler-suggested-title">Suggested Creators</h3>
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
              const scPic = sc.profilePic
                ? `${getFullMediaUrl(sc.profilePic)}?cb=${Date.now()}`
                : '';
              return (
                <div className="suggested-card" key={sc._id} style={bgStyle}>
                  <div className="card-inner">
                    {scPic && (
                      <img
                        src={scPic}
                        alt=""
                        className="suggested-avatar"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
                    <div className="suggested-info">
                      <div className="suggested-name">{sc.username}</div>
                      <div className="suggested-handle">@{sc.username.toLowerCase()}</div>
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

        <div className="message-bubble" onClick={handleMessageBubbleClick}>
          <div className="message-bubble-icon">💬</div>
          {hasNewMessage && <div className="message-bubble-badge">1</div>}
        </div>

        {showDmPanel && (
          <div className="direct-message-panel">
            <h4>Direct Messages</h4>
            {/* DM chat list + conversation */}
            {/* unchanged from your existing code */}
          </div>
        )}

        {followMessage && (
          <div className="follow-message-popup">{followMessage}</div>
        )}

        {showDepositModal && (
          <div className="modal-overlay" onClick={() => { if(!depositProcessing) setShowDepositModal(false); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => { if(!depositProcessing) setShowDepositModal(false); }}>
                &times;
              </button>
              <h3>Deposit Funds</h3>
              
              {/* Preset Amount Buttons */}
              <div className="preset-amounts">
                {[5, 10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    className="preset-btn"
                    onClick={() => setDepositAmount(amt.toString())}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              
              {/* Deposit Amount Input */}
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter deposit amount"
                disabled={depositProcessing}
              />
              
              {/* Optional Deposit Note */}
              <textarea
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="Add a note (optional)"
                disabled={depositProcessing}
              />
              
              {/* Display error or success message */}
              {depositError && <p className="deposit-error">{depositError}</p>}
              {depositSuccess && <p className="deposit-success">{depositSuccess}</p>}
              
              <div className="modal-actions">
                <button
                  onClick={() => { if(!depositProcessing) setShowDepositModal(false); }}
                  disabled={depositProcessing}
                >
                  Cancel
                </button>
                <button onClick={handleDepositSubmit} disabled={depositProcessing}>
                  {depositProcessing ? (
                    <span className="spinner"></span>
                  ) : (
                    'Confirm Deposit'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEmojiPicker && (
          <div
            className="modal-overlay"
            onClick={() => setShowEmojiPicker(false)}
          >
            <div
              className="picker-container"
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  // Log it to confirm the shape
                  console.log('Selected Emoji Data:', emojiData);
                  setTweetText((prev) => prev + emojiData.emoji);
                  setShowEmojiPicker(false);
                }}
              />



            </div>
          </div>
        )}

      {showGifPicker && (
        <div className="modal-overlay" onClick={() => setShowGifPicker(false)}>
          <div className="picker-container" onClick={(e) => e.stopPropagation()}>
            <h3>Select a Funny GIF</h3>
            <div className="gif-picker">
              {funnyGifs.map((gifUrl, index) => (
                <img
                  key={index}
                  src={gifUrl}
                  alt="Funny gif"
                  onClick={() => {
                    setTweetMedia(gifUrl);    // store in separate state
                    setShowGifPicker(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}


    




      </div>
    );
  }

export default LoggedInPage;
