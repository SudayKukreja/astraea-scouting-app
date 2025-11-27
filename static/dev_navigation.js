// dev_navigation.js - Add this script to all pages via a script tag

(function() {
  // Check if we're in dev mode
  function isDevMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('dev') === 'true' || 
           sessionStorage.getItem('dev_mode') === 'true' ||
           window.location.pathname === '/dev';
  }

  // Check if we're inside an iframe (preview mode)
  function isInPreview() {
    return window.self !== window.top;
  }

  // Initialize dev navigation if needed
  function initDevNavigation() {
    if (!isDevMode() && !isInPreview()) {
      return; // Not in dev mode, skip
    }

    // Set dev mode flag
    sessionStorage.setItem('dev_mode', 'true');

    // If we're in preview mode (iframe), just add the banner
    if (isInPreview()) {
      addDevPreviewBanner();
      interceptFormSubmits();
      return;
    }

    // Otherwise, add full dev controls
    addDevControls();
  }

  function addDevPreviewBanner() {
    // Add a subtle banner at top
    const banner = document.createElement('div');
    banner.innerHTML = `
      <div style="
        position: fixed; 
        top: 0; 
        left: 0; 
        right: 0; 
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
        color: white; 
        padding: 4px 16px; 
        text-align: center; 
        font-weight: 600; 
        font-size: 11px; 
        z-index: 9999;
        letter-spacing: 0.5px;
      ">
        🔧 PREVIEW MODE
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = '24px';
  }

  function addDevControls() {
    // Hide normal back buttons
    const headerActions = document.getElementById('header-actions');
    if (headerActions) {
      headerActions.style.display = 'none';
    }

    // Add dev banner
    const devBanner = document.createElement('div');
    devBanner.innerHTML = `
      <div style="
        position: fixed; 
        top: 0; 
        left: 0; 
        right: 0; 
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
        color: white; 
        padding: 8px 16px; 
        text-align: center; 
        font-weight: 700; 
        font-size: 12px; 
        z-index: 9998; 
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
      ">
        <span>🚀 DEV MODE - Testing Environment</span>
        <button onclick="window.location.href='/dev'" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
        ">← Back to Dev Dashboard</button>
      </div>
    `;
    document.body.insertBefore(devBanner, document.body.firstChild);
    document.body.style.paddingTop = '40px';

    // Add floating dev button
    const devButton = document.createElement('div');
    devButton.innerHTML = `
      <a href="/dev" style="
        position: fixed; 
        bottom: 20px; 
        right: 20px; 
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
        color: white; 
        padding: 12px 20px; 
        border-radius: 50px; 
        text-decoration: none; 
        font-weight: 700; 
        font-size: 14px; 
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); 
        z-index: 9999; 
        display: flex; 
        align-items: center; 
        gap: 8px;
        transition: transform 0.2s;
      " 
      onmouseover="this.style.transform='translateY(-2px)'" 
      onmouseout="this.style.transform='translateY(0)'">
        <span>🚀</span>
        <span>Back to Dev</span>
      </a>
    `;
    document.body.appendChild(devButton);
  }

  function interceptFormSubmits() {
    // In preview mode, show alerts for form submissions
    document.addEventListener('submit', function(e) {
      if (isInPreview()) {
        e.preventDefault();
        alert('Form submission intercepted in preview mode. In real mode, this would submit to the server.');
      }
    });
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDevNavigation);
  } else {
    initDevNavigation();
  }
})();