import { useState } from 'react';
import { useInstall } from '../install.js';
import { BrandMark } from '../ui.jsx';

// iOS share icon (square with up arrow) and plus-square, drawn to match Safari.
const ShareGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const AddGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);

export default function InstallCard() {
  const inst = useInstall();
  const [showSteps, setShowSteps] = useState(false);
  const [result, setResult] = useState(null);

  if (inst.standalone) {
    return (
      <div className="card set">
        <div className="set-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BrandMark size={28} /><div><div className="lbl">App installed</div><div className="hint">You're using Alliance Tracker from your home screen.</div></div></div>
          <span className="val">✓</span>
        </div>
      </div>
    );
  }

  const onInstall = async () => {
    if (inst.canPrompt) setResult(await inst.prompt());
    else setShowSteps(true);
  };

  return (
    <div className="card set">
      <div className="set-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <BrandMark size={28} />
          <div><div className="lbl">Add to home screen</div><div className="hint">Opens full-screen like an app, one tap away.</div></div>
        </div>
        <button className="add-btn" onClick={onInstall}>Install</button>
      </div>

      {result === 'accepted' && <p className="fine">Installed. Look for the Alliance icon on your home screen.</p>}

      {showSteps && (
        <div className="set-row" style={{ display: 'block' }}>
          {inst.iOS ? (
            <>
              {!inst.iOSSafari && <p className="hint" style={{ marginTop: 0 }}>On iPhone this works best in <b>Safari</b>. Open this page in Safari, then:</p>}
              <ol className="steps">
                <li>Tap <b>Share</b> <ShareGlyph /> at the bottom of Safari{inst.iOSSafari ? '' : ' (or the ⋯ menu)'}.</li>
                <li>Scroll down and tap <b>Add to Home Screen</b> <AddGlyph />.</li>
                <li>Tap <b>Add</b> in the top-right corner.</li>
              </ol>
            </>
          ) : (
            <ol className="steps">
              <li>Open your browser menu (<b>⋮</b> in Chrome, <b>≡</b> in Samsung Internet).</li>
              <li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li>
              <li>Confirm with <b>Install</b> / <b>Add</b>.</li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
