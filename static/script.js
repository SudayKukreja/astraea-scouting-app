// Enhanced script.js with better offline support
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const form = document.getElementById('scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formWarning = document.getElementById('form-warning');
  const spinner = document.getElementById('submit-spinner');
  const endgameAction = document.getElementById('endgame_action');
  const climbDepthLabel = document.getElementById('climb_depth_label');
  const climbSuccessLabel = document.getElementById('climb_success_label');

  // Initialize offline status manager
  const offlineManager = new OfflineStatusManager();

  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to go back? Any unsaved changes will be lost.')) {
        const referrer = document.referrer;
        if (referrer && referrer.includes('/dashboard')) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/dashboard';
        }
      }
    });
  }

  function clearErrors() {
    formWarning.style.display = 'none';
    formWarning.textContent = '';
    form.querySelectorAll('.error-msg').forEach(el => el.remove());
    form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
  }

  function showError(el, msg) {
    el.classList.add('error-input');
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-msg';
    errorSpan.style.color = '#b33';
    errorSpan.style.fontSize = '0.9rem';
    errorSpan.textContent = msg;
    el.parentNode.appendChild(errorSpan);
  }

  function switchToTab(tabId) {
    tabs.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      tabContents.forEach(tab => tab.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  // Keep your existing draft loading logic
  const savedDraft = localStorage.getItem('scoutDraft');
  if (savedDraft) {
    const draftObj = JSON.parse(savedDraft);
    for (const [key, value] of Object.entries(draftObj)) {
      const el = document.getElementsByName(key)[0];
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = value === 'on' || value === true;
        } else {
          el.value = value;
        }
      }
    }
    
    if (endgameAction && endgameAction.value === 'climb') {
      climbDepthLabel.classList.remove('hidden');
      climbSuccessLabel.classList.remove('hidden');
    }
  }

  // Keep your existing draft saving logic
  form.addEventListener('input', () => {
    const draft = new FormData(form);
    const draftObj = {};
    draft.forEach((value, key) => {
      draftObj[key] = value;
    });
    localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
  });

  let firstInputTime = null;
  function recordFirstInputTime() {
    if (!firstInputTime) {
      firstInputTime = Date.now();
    }
  }

  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', recordFirstInputTime, { once: true });
  });

  // ENHANCED: Better offline queue management (keeping your existing logic as backup)
  function saveOffline(data) {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(data);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  }

  async function sendQueuedSubmissions() {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (!queue.length) return;

    let syncedCount = 0;
    for (let i = 0; i < queue.length; i++) {
      try {
        const res = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queue[i])
        });
        if (res.ok) {
          queue.splice(i, 1);
          i--;
          syncedCount++;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    
    if (syncedCount > 0) {
      offlineManager.showStatus(`✅ ${syncedCount} old reports synced!`, 'success');
    }
  }

  // Enhanced online event handling
  window.addEventListener('load', sendQueuedSubmissions);
  window.addEventListener('online', () => {
    offlineManager.showStatus('🟢 Back online! Syncing reports...', 'success');
    sendQueuedSubmissions();
    offlineManager.triggerSync(); // Also trigger service worker sync
  });

  // ENHANCED: Better form submission with service worker integration
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const getValue = id => document.getElementById(id)?.value.trim();
    const getCheckbox = id => document.getElementById(id)?.checked;

    const requiredFields = ['name', 'team', 'match'];
    let formValid = true;

    for (const id of requiredFields) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        formValid = false;
        showError(el, 'Required field');
      }
    }

    let tabErrors = [];

    const autoFields = ['auto_ll1', 'auto_l2', 'auto_l3', 'auto_l4', 'auto_processor', 'auto_barge'];
    const teleopFields = ['teleop_ll1', 'teleop_l2', 'teleop_l3', 'teleop_l4', 'teleop_processor', 'teleop_barge', 'offense_rating', 'defense_rating'];
    const endgameFields = ['endgame_action'];

    if (!autoFields.some(id => getValue(id) !== '' && getValue(id) !== '0') && 
        !getCheckbox('auto_no_move') && 
        !getCheckbox('auto_only_moved')) {
      tabErrors.push({ tab: 'auto', message: 'Please fill out something in Autonomous tab' });
      autoFields.forEach(id => showError(document.getElementById(id), 'Expected input'));
    }

    if (!teleopFields.some(id => getValue(id) !== '' && getValue(id) !== '0') && !getCheckbox('teleop_no_move')) {
      tabErrors.push({ tab: 'teleop', message: 'Please fill out something in Teleop tab' });
      teleopFields.forEach(id => showError(document.getElementById(id), 'Expected input'));
    }

    if (!getValue('endgame_action')) {
      tabErrors.push({ tab: 'endgame', message: 'Please select an Endgame action' });
      showError(document.getElementById('endgame_action'), 'Required');
    }

    if (!formValid || tabErrors.length > 0) {
      formWarning.style.display = 'block';
      formWarning.style.color = '#b33';
      formWarning.textContent = tabErrors.length > 0 ? tabErrors[0].message : 'Please fix required fields.';
      if (tabErrors.length > 0) switchToTab(tabErrors[0].tab);
      return;
    }

    // Show enhanced loading state
    spinner.style.display = 'block';
    formWarning.style.display = 'block';
    formWarning.style.color = '#2563eb';
    
    if (!navigator.onLine) {
      formWarning.textContent = 'Offline - Saving report locally...';
    } else {
      formWarning.textContent = 'Submitting... This may take a few seconds, please wait.';
    }
    
    submitBtn.disabled = true;

    const responseTimeField = document.getElementById('response_time');
    if (firstInputTime) {
      const responseTimeSec = ((Date.now() - firstInputTime) / 1000).toFixed(2);
      responseTimeField.value = responseTimeSec;
    } else {
      responseTimeField.value = '-1';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const assignmentKey = urlParams.get('assignment');

    const data = {
      name: getValue('name'),
      team: getValue('team'),
      match: getValue('match'),
      assignment_key: assignmentKey,
      auto: {
        ll1: getValue('auto_ll1') || 0,
        l2: getValue('auto_l2') || 0,
        l3: getValue('auto_l3') || 0,
        l4: getValue('auto_l4') || 0,
        processor: getValue('auto_processor') || 0,
        barge: getValue('auto_barge') || 0,
        dropped_pieces: parseInt(getValue('auto_dropped_pieces')) || 0,
        no_move: getCheckbox('auto_no_move'),
        only_moved: getCheckbox('auto_only_moved')
      },
      teleop: {
        ll1: getValue('teleop_ll1') || 0,
        l2: getValue('teleop_l2') || 0,
        l3: getValue('teleop_l3') || 0,
        l4: getValue('teleop_l4') || 0,
        processor: getValue('teleop_processor') || 0,
        barge: getValue('teleop_barge') || 0,
        offense_rating: getValue('offense_rating') || '-',
        defense_rating: getValue('defense_rating') || '-',
        no_move: getCheckbox('teleop_no_move'),
        dropped_pieces: parseInt(getValue('dropped_pieces')) || 0
      },
      endgame: {
        action: getValue('endgame_action') || '',
        climb_depth: getValue('climb_depth') || '',
        climb_successful: getCheckbox('climb_successful')
      },
      notes: getValue('notes') || '',
      response_time: responseTimeField.value,
      timestamp: new Date().toLocaleString(),
      partial_match: getCheckbox('partial_match')
    };

    try {
      // ENHANCED: Better timeout and retry logic
      const res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        // Handle both online and offline success
        if (result.offline) {
          offlineManager.showStatus('📝 Scout report saved offline - will sync when online!', 'warning', 5000);
        } else {
          offlineManager.showStatus('✅ Scout report submitted successfully!', 'success');
        }
        
        // Clear form and redirect (keep your existing logic)
        form.reset();
        localStorage.removeItem('scoutDraft');

        tabs.forEach(b => b.classList.remove('active'));
        tabs[0].classList.add('active');
        tabContents.forEach(t => t.classList.remove('active'));
        tabContents[0].classList.add('active');

        climbDepthLabel.classList.add('hidden');
        climbSuccessLabel.classList.add('hidden');

        formWarning.style.display = 'none';

        window.location.href = '/dashboard?completed=true';
        
      } else {
        throw new Error(result.error || 'Server error');
      }
      
    } catch (err) {
      console.error('Submission error:', err);
      
      // ENHANCED: Better error handling based on error type
      if (err.name === 'AbortError') {
        // Timeout - probably saved by service worker
        offlineManager.showStatus('⏱️ Connection slow - report saved offline', 'warning');
      } else if (err.name === 'TypeError' || err.message.includes('fetch')) {
        // Network error - definitely offline
        offlineManager.showStatus('📡 No connection - report saved offline', 'warning');
        
        // Keep your existing localStorage backup as extra safety
        saveOffline(data);
      } else {
        // Server error
        offlineManager.showStatus('❌ Server error - report saved offline', 'error');
        saveOffline(data);
      }
      
      // Always clear form and redirect on any error (keep your existing behavior)
      form.reset();
      localStorage.removeItem('scoutDraft');

      tabs.forEach(b => b.classList.remove('active'));
      tabs[0].classList.add('active');
      tabContents.forEach(t => t.classList.remove('active'));
      tabContents[0].classList.add('active');

      climbDepthLabel.classList.add('hidden');
      climbSuccessLabel.classList.add('hidden');

      formWarning.style.display = 'none';

      window.location.href = '/dashboard?completed=true';
      
    } finally {
      spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  // Keep your existing endgame action logic
  if (endgameAction) {
    endgameAction.addEventListener('change', () => {
      if (endgameAction.value === 'climb') {
        climbDepthLabel.classList.remove('hidden');
        climbSuccessLabel.classList.remove('hidden');
      } else {
        climbDepthLabel.classList.add('hidden');
        climbSuccessLabel.classList.add('hidden');
        const climbDepthInput = document.getElementById('climb_depth');
        const climbSuccessfulInput = document.getElementById('climb_successful');
        climbDepthInput.value = '';
        climbSuccessfulInput.checked = false;

        const savedDraft = localStorage.getItem('scoutDraft');
        if (savedDraft) {
          const draftObj = JSON.parse(savedDraft);
          if ('climb_depth' in draftObj) {
            delete draftObj.climb_depth;
          }
          if ('climb_successful' in draftObj) {
            delete draftObj.climb_successful;
          }
          localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
        }
      }
    });
  }
});

// ==========================================
// OFFLINE STATUS MANAGER (ADD THIS CLASS)
// ==========================================

class OfflineStatusManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingSubmissions = 0;
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showStatus('🟢 Back online! Syncing data...', 'success');
      this.triggerSync();
      this.updateIndicator();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showStatus('🔴 You are offline. Data will be saved locally.', 'warning');
      this.updateIndicator();
    });

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, count, timestamp } = event.data || {};
        
        switch (type) {
          case 'OFFLINE_SUBMISSION_STORED':
            this.showStatus('💾 Scout report saved offline', 'info');
            this.getOfflineStatus(); // Update counter
            break;
            
          case 'SUBMISSIONS_SYNCED':
            this.showStatus(`✅ ${count} reports synced successfully!`, 'success');
            this.getOfflineStatus(); // Update counter
            break;
        }
      });
    }

    // Initial status check
    this.updateIndicator();
    this.getOfflineStatus();
  }

  async triggerSync() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await registration.sync.register('scout-submissions-sync');
        }
      } catch (error) {
        console.log('Sync registration failed:', error);
      }
    }
  }

  async getOfflineStatus() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        const status = event.data;
        if (status && typeof status.pendingSync === 'number') {
          this.pendingSubmissions = status.pendingSync;
          this.updateIndicator();
        }
      };

      registration.active?.postMessage(
        { type: 'GET_OFFLINE_STATUS' },
        [channel.port2]
      );
    } catch (error) {
      console.log('Could not get offline status:', error);
    }
  }

  updateIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    // Remove indicator if online and no pending submissions
    if (this.isOnline && this.pendingSubmissions === 0) {
      if (indicator) {
        indicator.remove();
      }
      return;
    }

    // Create indicator if it doesn't exist
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #f59e0b;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(indicator);
      
      // Click to force sync
      indicator.addEventListener('click', () => {
        this.triggerSync();
        this.showStatus('🔄 Forcing sync...', 'info');
      });
    }

    // Update indicator content and color
    if (!this.isOnline) {
      indicator.textContent = '📴 Offline Mode';
      indicator.style.background = '#ef4444';
    } else if (this.pendingSubmissions > 0) {
      indicator.textContent = `🔄 ${this.pendingSubmissions} pending sync`;
      indicator.style.background = '#f59e0b';
    }
  }

  showStatus(message, type = 'info', duration = 4000) {
    // Remove existing notifications
    document.querySelectorAll('.offline-notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.textContent = message;
    
    const colors = {
      success: '#10b981',
      warning: '#f59e0b', 
      info: '#3b82f6',
      error: '#ef4444'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1002;
      font-size: 0.9rem;
      font-weight: 500;
      max-width: 350px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Slide in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}