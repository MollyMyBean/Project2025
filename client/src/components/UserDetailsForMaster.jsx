// client/src/components/UserDetailsForMaster.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

function getFullMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `http://localhost:5000${url}`;
}

const defaultAvatar = '/images/default.png';

export default function UserDetailsForMaster() {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [adminUser, setAdminUser] = useState(null); // The normal user's data
  const [uploads, setUploads] = useState([]);        // All their uploads
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // 1) Check session => must be admin
        const authRes = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include'
        });
        if (authRes.status === 401) {
          navigate('/');
          return;
        }
        const authData = await authRes.json();
        if (authData?.user?.role !== 'admin') {
          alert('You are not an admin!');
          navigate('/home');
          return;
        }

        // 2) Fetch the normal user's full data
        // We'll call GET /api/auth/user-full/:userId (see the new route in authRoutes)
        const res = await fetch(`http://localhost:5000/api/auth/user-full/${userId}`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          setError(data.message || 'Error fetching user info.');
          setLoading(false);
          return;
        }

        setAdminUser(data.user);
        setUploads(data.uploads || []);
      } catch (err) {
        console.error('Error fetching user details:', err);
        setError('Server error.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigate]);

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading user details...</div>;
  }
  if (error) {
    return <div style={{ color: 'red', padding: '1rem' }}>{error}</div>;
  }
  if (!adminUser) {
    return <div style={{ padding: '1rem' }}>No user data found.</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        ← Go Back
      </button>

      <h2>User Full Info (Master Admin View)</h2>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1rem'
        }}
      >
        <img
          src={adminUser.profilePic || defaultAvatar}
          alt="UserAvatar"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #4a90e2'
          }}
        />
        <h3>{adminUser.username}</h3>
        <p>
          <strong>Email:</strong> {adminUser.email}
        </p>
        <p>
          <strong>Bio:</strong> {adminUser.bio || 'N/A'}
        </p>
        <p>
          <strong>Interests:</strong> {adminUser.interests || 'N/A'}
        </p>
        <p>
          <strong>Achievements:</strong> {adminUser.achievements || 'N/A'}
        </p>
        {adminUser.socialLinks?.length > 0 && (
          <p>
            <strong>Social Links:</strong> {adminUser.socialLinks.join(', ')}
          </p>
        )}
        <p>
          <strong>Created At:</strong> {new Date(adminUser.createdAt).toLocaleString()}
        </p>
        <p>
          <strong>Updated At:</strong> {new Date(adminUser.updatedAt).toLocaleString()}
        </p>
      </div>

      <h3>Uploads by {adminUser.username}</h3>
      {uploads.length === 0 ? (
        <p>This user has no existing uploads (they may have deleted them).</p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          {uploads.map((vid) => {
            const url = getFullMediaUrl(vid.videoUrl);
            return (
              <div
                key={vid._id}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  width: '180px'
                }}
              >
                {vid.isPhoto ? (
                  <img
                    src={url}
                    alt={vid.title}
                    style={{
                      width: '180px',
                      height: '110px',
                      objectFit: 'cover',
                      backgroundColor: '#eee'
                    }}
                  />
                ) : (
                  <video
                    src={url}
                    controls
                    style={{
                      width: '180px',
                      height: '110px',
                      objectFit: 'cover',
                      backgroundColor: '#eee'
                    }}
                  />
                )}
                <p style={{ margin: '0.4rem 0', fontSize: '0.9rem' }}>
                  <strong>{vid.title}</strong>
                </p>
                <p style={{ fontSize: '0.7rem' }}>
                  Created: {new Date(vid.createdAt).toLocaleString()}
                </p>
                {vid.locked && <p style={{ color: 'red' }}>Locked Content</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
