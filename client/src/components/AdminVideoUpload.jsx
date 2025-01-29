// client/src/components/AdminVideoUpload.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminVideoUpload() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isPhoto, setIsPhoto] = useState(false);
  const [locked, setLocked] = useState(false);
  const [price, setPrice] = useState(5);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:5000/api/protected', {
          credentials: 'include'
        });
        if (res.status === 401) {
          navigate('/'); // Not logged in
          return;
        }
        const data = await res.json();
        // Check if user is admin
        if (data.user.role !== 'admin') {
          alert('You are not an admin!');
          navigate('/home');
        } else {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    })();
  }, [navigate]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }

    try {
      // We'll build a FormData object containing all fields
      const formData = new FormData();
      formData.append('title', title);
      formData.append('isPhoto', isPhoto);
      formData.append('locked', locked);
      formData.append('price', price);
      formData.append('mediaFile', file);

      const res = await fetch('http://localhost:5000/api/videos/upload-file', {
        method: 'POST',
        credentials: 'include',
        // no "Content-Type" => fetch sets automatically for FormData
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

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin Upload (Direct from Computer)</h1>
      <form onSubmit={handleUpload}>
        <div>
          <label>Title:</label>
          <br />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '300px' }}
          />
        </div>
        <br />
        <div>
          <label>File (image or video):</label>
          <br />
          <input
            type="file"
            accept="image/*, video/*"
            onChange={handleFileChange}
            style={{ width: '300px' }}
          />
        </div>
        <br />
        <div>
          <label>
            <input
              type="checkbox"
              checked={isPhoto}
              onChange={() => setIsPhoto(!isPhoto)}
            />
            &nbsp;This is a Photo?
          </label>
        </div>
        <br />
        <div>
          <label>
            <input
              type="checkbox"
              checked={locked}
              onChange={() => setLocked(!locked)}
            />
            &nbsp;Locked?
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
        <br />
        <button type="submit">Upload</button>
      </form>
    </div>
  );
}

export default AdminVideoUpload;
