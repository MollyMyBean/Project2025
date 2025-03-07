import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './MessagesPage.css';
import './Sidebar.css';
import { io } from 'socket.io-client';

const defaultAvatar = '/images/default.png';

function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url; // already absolute
  }
  return `http://localhost:5000${url}`;
}

// We'll keep peer connections in module scope (for video calls)
let localPeerConnection = null;
let remotePeerConnection = null;

function MessagesPage() {
  const navigate = useNavigate();

  // Basic user info
  const [user, setUser] = useState(null);

  // All messages => (for admin: all, for normal user: only user’s)
  const [messages, setMessages] = useState([]);

  // “Conversation list”: each => { partnerUser, messages: [] }
  const [conversations, setConversations] = useState([]);
  const [activePartner, setActivePartner] = useState(null);

  // For text input
  const [content, setContent] = useState('');

  // For pinned chats
  const [pinnedChats, setPinnedChats] = useState([]);

  // For repeated fetching
  const pollInterval = useRef(null);

  // Video call states
  const [callInProgress, setCallInProgress] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);

  // Socket reference
  const socketRef = useRef(null);

  // For normal user => followed + subscribed admins
  const [followedUsers, setFollowedUsers] = useState([]);

  // Chat search
  const [chatSearch, setChatSearch] = useState('');

  // Tip modal states
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [showTipSuccess, setShowTipSuccess] = useState(false);
  const [tipSuccessText, setTipSuccessText] = useState('');

  // ---------------
  // INITIAL LOAD
  // ---------------
  useEffect(() => {
    (async () => {
      try {
        // 1) Check session
        const res = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include',
        });
        if (res.status === 401) {
          navigate('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // 2) Load all followed + subscribed
        const followsRes = await fetch('http://localhost:5000/api/auth/my-follows', {
          credentials: 'include',
        });
        const followsData = await followsRes.json();

        const subsRes = await fetch('http://localhost:5000/api/auth/my-subscriptions', {
          credentials: 'include',
        });
        const subsData = await subsRes.json();

        let combined = [];
        if (followsRes.ok && followsData.status === 'success') {
          combined = followsData.follows || [];
        }
        if (subsRes.ok && subsData.status === 'success') {
          const subs = subsData.subscriptions || [];
          subs.forEach((adm) => {
            if (!combined.find((x) => x._id === adm._id)) {
              combined.push(adm);
            }
          });
        }
        setFollowedUsers(combined);

        // 3) fetch messages
        await fetchMessages(true);

        // poll every 5s
        pollInterval.current = setInterval(() => {
          fetchMessages(true);
        }, 5000);

        // 4) set up socket
        setupSocket(data.user.id);
      } catch (err) {
        console.error('Error in initial load:', err);
      }
    })();

    // Cleanup
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [navigate]);

  // ---------------
  // SOCKET IO
  // ---------------
  const setupSocket = (myUserId) => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join-user', myUserId);
    });

    // Incoming call
    socket.on('call-offer', async (data) => {
      console.log('Incoming call from:', data.fromUserId);
      try {
        const previewStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideoRef.current.srcObject = previewStream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play();

        setIncomingCall({
          fromUserId: data.fromUserId,
          offer: data.offer,
        });
      } catch (err) {
        console.error('Error accessing camera/mic for incoming call:', err);
        alert('Could not access camera/mic to receive call.');
      }
    });

    // Remote answered
    socket.on('call-answer', async (data) => {
      if (localPeerConnection && data.answer) {
        await localPeerConnection.setRemoteDescription(data.answer);
        console.log('Caller: setRemoteDescription(answer) done');
      }
    });

    // ICE candidate
    socket.on('ice-candidate', async (data) => {
      try {
        const candidate = new RTCIceCandidate(data.candidate);
        if (localPeerConnection) {
          await localPeerConnection.addIceCandidate(candidate);
        }
        if (remotePeerConnection) {
          await remotePeerConnection.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });
  };

  // ---------------
  // FETCH MESSAGES
  // ---------------
  const fetchMessages = async (silent = false) => {
    try {
      const res = await fetch('http://localhost:5000/api/messages', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.status !== 'success') {
        if (!silent) alert(data.message || 'Error loading messages');
        return;
      }
      setMessages(data.messages || []);
    } catch (err) {
      if (!silent) alert('Could not fetch messages');
      console.error('fetchMessages error:', err);
    }
  };

  // ---------------
  // BUILD CONVERSATIONS
  // ---------------
  useEffect(() => {
    if (!user) return;

    const myUserId = user.id;
    const convoMap = {};

    // Group messages by partner
    messages.forEach((msg) => {
      const partner = msg.sender?._id === myUserId ? msg.receiver : msg.sender;
      if (!partner || !partner._id || partner._id === myUserId) return;

      const partnerCopy = { ...partner };

      // If we have a more up-to-date record in followedUsers, override:
      const found = followedUsers.find((fu) => fu._id === partnerCopy._id);
      if (found && found.profilePic) {
        partnerCopy.profilePic = found.profilePic;
      }

      const partnerId = partnerCopy._id;
      if (!convoMap[partnerId]) {
        convoMap[partnerId] = {
          partnerUser: partnerCopy,
          messages: [],
        };
      }
      convoMap[partnerId].messages.push(msg);
    });

    // Also ensure all “followedUsers” even if no messages
    followedUsers.forEach((adm) => {
      if (!convoMap[adm._id]) {
        const admCopy = { ...adm };
        convoMap[admCopy._id] = {
          partnerUser: admCopy,
          messages: [],
        };
      }
    });

    // Convert to array
    const convoArray = Object.values(convoMap).map((c) => {
      c.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return c;
    });

    // Sort pinned first
    convoArray.sort((a, b) => {
      const aPinned = pinnedChats.includes(a.partnerUser._id);
      const bPinned = pinnedChats.includes(b.partnerUser._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    setConversations(convoArray);

    // If no active partner set, pick the first
    if (!activePartner && convoArray.length > 0) {
      setActivePartner(convoArray[0].partnerUser);
    }
  }, [messages, followedUsers, user, pinnedChats, activePartner]);

  // ---------------
  // SEND MESSAGE
  // ---------------
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activePartner) {
      alert('No conversation selected');
      return;
    }
    if (!content.trim()) {
      alert('Cannot send empty message');
      return;
    }
    try {
      const body = {
        recipientId: activePartner._id,
        content,
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
      if (res.ok && data.status === 'success' && data.newMessage) {
        setMessages((prev) => [...prev, data.newMessage]);
        setContent('');
      } else {
        alert(data.message || 'Error sending message');
      }
    } catch (err) {
      console.error('Send message error:', err);
      alert('Server error sending message');
    }
  };

  // ---------------
  // SEND PHOTO/VIDEO
  // ---------------
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activePartner) {
      e.target.value = null;
      return;
    }
    try {
      // 1) Upload the file
      const formData = new FormData();
      formData.append('file', file);
      const upRes = await fetch('http://localhost:5000/api/messages/upload-file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const upData = await upRes.json();
      if (upRes.ok && upData.status === 'success' && upData.filePath) {
        // 2) Send the message with mediaUrl
        const body = {
          recipientId: activePartner._id,
          content: '',
          mediaUrl: upData.filePath,
          mediaType: upData.mediaType,
        };
        const msgRes = await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const msgData = await msgRes.json();
        if (msgRes.ok && msgData.status === 'success' && msgData.newMessage) {
          setMessages((prev) => [...prev, msgData.newMessage]);
        } else {
          alert(msgData.message || 'Error sending media message');
        }
      } else {
        alert(upData.message || 'File upload error');
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert('Server error uploading file.');
    }
    e.target.value = null;
  };

  // ---------------
  // VIDEO CALLS
  // ---------------
  const handleStartCall = async () => {
    if (!activePartner) {
      alert('No conversation selected');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      await localVideoRef.current.play();

      setCallInProgress(true);

      localPeerConnection = new RTCPeerConnection();
      localPeerConnection.onicecandidate = (e) => {
        if (e.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate', {
            toUserId: activePartner._id,
            candidate: e.candidate,
          });
        }
      };
      stream.getTracks().forEach((track) => localPeerConnection.addTrack(track, stream));
      localPeerConnection.ontrack = (e) => {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      };

      const offer = await localPeerConnection.createOffer();
      await localPeerConnection.setLocalDescription(offer);

      socketRef.current.emit('call-offer', {
        toUserId: activePartner._id,
        offer,
      });
    } catch (err) {
      console.error('Error starting call:', err);
      alert('Could not start call (camera blocked?).');
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    setCallInProgress(true);

    remotePeerConnection = new RTCPeerConnection();
    remotePeerConnection.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          toUserId: incomingCall.fromUserId,
          candidate: e.candidate,
        });
      }
    };
    remotePeerConnection.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
      remoteVideoRef.current.play().catch(() => {});
    };

    const localStream = localVideoRef.current.srcObject;
    if (localStream) {
      localStream.getTracks().forEach((trk) => remotePeerConnection.addTrack(trk, localStream));
    }

    try {
      await remotePeerConnection.setRemoteDescription(incomingCall.offer);
      const answer = await remotePeerConnection.createAnswer();
      await remotePeerConnection.setLocalDescription(answer);

      socketRef.current.emit('call-answer', {
        toUserId: incomingCall.fromUserId,
        answer,
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('Accept call error:', err);
      alert('Error accepting call.');
    }
  };

  const handleDeclineCall = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((trk) => trk.stop());
      localVideoRef.current.srcObject = null;
    }
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    if (localPeerConnection) {
      localPeerConnection.close();
      localPeerConnection = null;
    }
    if (remotePeerConnection) {
      remotePeerConnection.close();
      remotePeerConnection = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((trk) => trk.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach((trk) => trk.stop());
      remoteVideoRef.current.srcObject = null;
    }
    setCallInProgress(false);
  };

  // ---------------
  // LOGOUT
  // ---------------
  const handleLogout = () => {
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => navigate('/'))
      .catch((err) => console.error('Logout error:', err));
  };

  // ---------------
  // PIN CHATS
  // ---------------
  const handlePinChat = (partnerId) => {
    setPinnedChats((prev) => {
      if (prev.includes(partnerId)) {
        return prev.filter((id) => id !== partnerId);
      }
      return [...prev, partnerId];
    });
  };

  // ---------------
  // TIP ADMIN
  // ---------------
  const handleTipButtonClick = () => {
    if (!activePartner) return;
    if (user.role === 'admin') {
      alert('Admins cannot tip other admins.');
      return;
    }
    if (activePartner.role !== 'admin') {
      alert('You can only tip an admin partner.');
      return;
    }
    setShowTipModal(true);
    setTipAmount('');
  };

  const handleConfirmTip = async () => {
    const amt = parseFloat(tipAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid tip amount.');
      return;
    }
    setShowTipModal(false);
    try {
      const body = { adminId: activePartner._id, amount: amt };
      const res = await fetch('http://localhost:5000/api/messages/tip-admin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setTipSuccessText(`You tipped ${activePartner.username} $${amt.toFixed(2)}! 🎉`);
        setShowTipSuccess(true);
        setTimeout(() => setShowTipSuccess(false), 3000);

        // Insert a local "tip sent" bubble
        const newLocalMessage = {
          _id: `local-tip-${Date.now()}`,
          sender: { _id: user.id },
          receiver: { _id: activePartner._id },
          content: `$${amt.toFixed(2)} tip sent!`,
          mediaUrl: '',
          mediaType: 'none',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newLocalMessage]);
      } else {
        alert(data.message || 'Error sending tip.');
      }
    } catch (err) {
      console.error('handleConfirmTip error:', err);
      alert('Server error sending tip.');
    }
  };

  // ---------------
  // RENDER: LEFT CONVO LIST
  // ---------------
  const renderConversationList = () => {
    if (!conversations.length) {
      return <p className="no-convos">No results</p>;
    }
    const lower = chatSearch.toLowerCase();
    const filtered = conversations.filter((c) =>
      c.partnerUser.username.toLowerCase().includes(lower)
    );

    if (!filtered.length) {
      return <p className="no-convos">No results</p>;
    }
    return filtered.map((c) => {
      const partner = c.partnerUser;
      const isActive = activePartner && partner._id === activePartner._id;
      const isPinned = pinnedChats.includes(partner._id);
      const partnerPicFull = partner.profilePic
        ? getFullMediaUrl(partner.profilePic) + `?cb=${Date.now()}`
        : defaultAvatar;

      return (
        <div
          key={partner._id}
          className={`chat-list-item ${isActive ? 'active' : ''}`}
          onClick={() => setActivePartner(partner)}
        >
          <img src={partnerPicFull} alt={partner.username} className="chat-list-avatar" />
          <div className="chat-list-name">
            {partner.username}
            {isPinned && <span className="pin-badge">📌</span>}
          </div>
          <button
            className="pin-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePinChat(partner._id);
            }}
            title={isPinned ? 'Unpin Chat' : 'Pin Chat'}
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        </div>
      );
    });
  };

  // ---------------
  // RENDER: MESSAGES
  // ---------------
  const renderMessages = () => {
    if (!activePartner) {
      return (
        <div className="no-chat-selected">
          <h2>You don't have a chat yet</h2>
          <p>Select a contact from the list and have fun!</p>
        </div>
      );
    }
    const convo = conversations.find((c) => c.partnerUser._id === activePartner._id);
    if (!convo || !convo.messages.length) {
      return (
        <div className="no-chat-selected">
          <h2>No messages yet</h2>
          <p>Start the conversation now!</p>
        </div>
      );
    }
    return convo.messages.map((msg) => {
      const isMe = msg.sender && msg.sender._id === user.id;
      const isMedia = (msg.mediaType === 'image' || msg.mediaType === 'video') && msg.mediaUrl;
      const bubbleClass = `bubble ${isMe ? 'me' : 'them'} ${isMedia ? 'media-bubble' : ''}`;
      let messageContent;

      if (msg.mediaType === 'image' && msg.mediaUrl) {
        messageContent = (
          <img
            src={getFullMediaUrl(msg.mediaUrl)}
            alt="Media"
            style={{ maxWidth: '200px', borderRadius: '6px' }}
          />
        );
      } else if (msg.mediaType === 'video' && msg.mediaUrl) {
        messageContent = (
          <video
            src={getFullMediaUrl(msg.mediaUrl)}
            controls
            style={{ maxWidth: '200px', borderRadius: '6px' }}
          />
        );
      } else {
        messageContent = <span>{msg.content}</span>;
      }

      const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <div key={msg._id} className={bubbleClass}>
          <div className="bubble-content">{messageContent}</div>
          <div className="bubble-time">{timeString}</div>
        </div>
      );
    });
  };

  // ---------------
  // RENDER: MAIN
  // ---------------
  const userPicUrl = user?.profilePic
    ? getFullMediaUrl(user.profilePic) + '?cb=' + Date.now()
    : defaultAvatar;

  return (
    <div className="messages-page">
      {/* LEFT SIDEBAR => EXACTLY LIKE BEFORE */}
      <aside className="left-sidebar bubble-section">
        <div className="user-info-card">
          <img src={userPicUrl} alt="User Avatar" className="user-avatar" />
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

      {/* CHATS COLUMN */}
      <div className="chats-column bubble-section">
        <div className="chats-column-header">
          <h2 className="chats-heading">Chats</h2>
        </div>
        <input
          type="text"
          className="chat-search"
          placeholder="Search chats..."
          value={chatSearch}
          onChange={(e) => setChatSearch(e.target.value)}
        />
        <div className="conversations-wrapper">{renderConversationList()}</div>
      </div>

      {/* CONVERSATION COLUMN */}
      <div className="conversation-column bubble-section">
        <div className="conversation-header">
          {activePartner ? (
            <h2 className="conversation-title">{activePartner.username}</h2>
          ) : (
            <h2 className="conversation-title">MESSAGES</h2>
          )}
        </div>

        {/* If in call */}
        {callInProgress && (
          <div className="video-call-section">
            <video ref={localVideoRef} autoPlay muted className="video-local" />
            <video ref={remoteVideoRef} autoPlay className="video-remote" />
            <button onClick={handleEndCall} className="btn-end-call">
              End Call
            </button>
          </div>
        )}

        {/* Incoming call modal */}
        {incomingCall && (
          <div className="incoming-call-modal">
            <div className="modal-content">
              <h3>
                User <span className="caller-id">{incomingCall.fromUserId}</span> is calling you!
              </h3>
              <p>Preview your camera below:</p>
              <div className="preview-cam">
                <video ref={localVideoRef} autoPlay muted className="video-local" />
              </div>
              <div className="modal-buttons">
                <button onClick={handleAcceptCall} className="accept-call-btn">
                  Accept
                </button>
                <button onClick={handleDeclineCall} className="decline-call-btn">
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message list */}
        <div className="message-display">{renderMessages()}</div>

        {/* Send bar */}
        <div className="send-bar">
          <form className="send-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="input-message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={activePartner ? 'Type a message...' : 'Select a conversation first...'}
              disabled={!activePartner}
            />
            <button type="submit" className="btn-send" disabled={!activePartner} title="Send">
              Send
            </button>
          </form>

          <div className="action-icons">
            {/* hidden file input */}
            <input
              type="file"
              id="fileInput"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* camera icon => for photo/video */}
            <button
              className="icon-btn media-btn"
              title="Send Photo/Video"
              onClick={() => {
                if (activePartner) {
                  document.getElementById('fileInput').click();
                }
              }}
            >
              📷
            </button>

            {/* video call icon */}
            <button
              className="icon-btn video-btn"
              title="Start Video Call"
              onClick={handleStartCall}
              disabled={!activePartner}
            >
              📹
            </button>

            {/* TIP button => only normal user => admin partner */}
            {user?.role !== 'admin' && activePartner?.role === 'admin' && (
              <button className="icon-btn tip-btn" title="Tip Admin" onClick={handleTipButtonClick}>
                💸
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
      <div className="tip-modal-overlay">
        <div className="tip-modal">
          <div className="tip-modal-header">
            <h2>Send a Tip to {activePartner?.username}</h2>
            <button
              className="modal-close-btn"
              onClick={() => setShowTipModal(false)}
              title="Close"
            >
              &times;
            </button>
          </div>
          <p className="tip-modal-description">
            Support your favorite admin by sending a tip!
          </p>

          <div className="tip-presets">
            {[1, 5, 10, 20].map((amt) => (
              <button
                key={amt}
                onClick={() => setTipAmount(amt)}
                className={`tip-preset-btn ${parseFloat(tipAmount) === amt ? "active" : ""}`}
              >
                ${amt}
              </button>
            ))}
          </div>

          <div className="tip-input-group">
            <label htmlFor="tipAmountInput">Enter Tip Amount:</label>
            <input
              id="tipAmountInput"
              type="number"
              className="tip-amount-input"
              placeholder="Enter tip amount"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
            />
          </div>

          <div className="tip-slider-group">
            <input
              type="range"
              min="0"
              max="100"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              className="tip-slider"
            />
            <div className="tip-slider-value">${tipAmount}</div>
          </div>

          <div className="tip-summary">
            <p>
              Your tip: <strong>${parseFloat(tipAmount).toFixed(2)}</strong>
            </p>
            <p>
              Processing fee: <strong>$0.50</strong>
            </p>
            <p>
              Total:{" "}
              <strong>${(parseFloat(tipAmount) + 0.5).toFixed(2)}</strong>
            </p>
          </div>

          <div className="tip-modal-buttons">
            <button className="btn-confirm-tip" onClick={handleConfirmTip}>
              Confirm Tip
            </button>
            <button
              className="btn-cancel-tip"
              onClick={() => setShowTipModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}



      {/* Tip Success Popup */}
      {showTipSuccess && (
        <div className="tip-success-popup">
          <div className="popup-inner">
            <h3>{tipSuccessText}</h3>
            <p className="dopamine-msg">Thank you for your generosity!</p>
            <div className="confetti-shower">🎉🎉🎉</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
