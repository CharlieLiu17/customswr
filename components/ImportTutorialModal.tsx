'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'import-tutorial-seen';

/** Opens automatically the first time; afterwards only when `open` is set (e.g. via the info icon). */
export default function ImportTutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setFirstVisit(true);
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setFirstVisit(false);
    onClose();
  };

  const isOpen = open || firstVisit;
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal tutorial-modal" onClick={e => e.stopPropagation()}>
        <h2>How to Import from Screenshot</h2>

        <div className="tutorial-content">
          <p>
            Upload or paste a <strong>post-game lobby screenshot</strong> and we'll automatically detect:
          </p>

          <ul>
            <li>Player names (matched to your player database)</li>
            <li>Champion icons (using image recognition)</li>
            <li>Roles (auto-assigned based on champion data)</li>
          </ul>

          <div className="tutorial-image-container">
            <img
              src="/tutorial-example.png"
              alt="Example post-game screenshot"
              className="tutorial-image"
            />
            <p className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>
              Example: Post-game lobby screenshot
            </p>
          </div>

          <div className="tutorial-tips">
            <strong>Tips:</strong>
            <ul>
              <li>Make sure player names are visible in the screenshot</li>
              <li>Add player IGNs in the Admin panel for better matching</li>
              <li>You can manually correct any detection errors before submitting</li>
              <li><strong>Best results with 1920x1080 or 1600x900 client resolution</strong></li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={handleClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
