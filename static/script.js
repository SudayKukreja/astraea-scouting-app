// Wait for the DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const form = document.getElementById('scout-form');

  // Create spinner and status message elements and add next to submit button
  const submitBtn = form.querySelector('.submit-btn');
  const spinner = document.createElement('span');
  spinner.classList.add('spinner');
  spinner.style.display = 'none';

  const statusMsg = document.createElement('span');
  statusMsg.classList.add('submit-status');
  statusMsg.style.display = 'none';
  statusMsg.textContent = 'Submitting... Please wait';

  submitBtn.insertAdjacentElement('afterend', spinner);
  submitBtn.insertAdjacentElement('afterend', statusMsg);

  // Tab switching
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      tabContents.forEach(tab => {
        tab.classList.remove('active');
      });
      document.getElementById(target).classList.add('active');
    });
  });

  // Restore draft from localStorage
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
  }

  // Autosave draft to localStorage
  form.addEventListener('input', () => {
    const draft = new FormData(form);
    const draftObj = {};
    draft.forEach((value, key) => {
      draftObj[key] = value;
    });
    localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear existing error messages (optional, implement if you have error spans)
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    // Grab all form values
    const getValue = id => document.getElementById(id)?.value.trim();
    const getCheckbox = id => document.getElementById(id)?.checked;

    const requiredFields = ['name', 'team', 'match', 'play_style'];
    let formValid = true;

    // Validate required fields and show error (if you want, add error UI)
    requiredFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        formValid = false;
      }
    });

    if (!formValid) {
      alert('Please fill out all required fields: Name, Team, Match, and Play Style.');
      return;
    }

    // Show spinner and status message
    spinner.style.display = 'inline-block';
    statusMsg.style.display = 'inline-block';
    submitBtn.disabled = true;

    // Build data object
    const data = {
      name: getValue('name'),
      team: getValue('team'),
      match: getValue('match'),
      auto: {
        ll1: getValue('auto_ll1') || 0,
        l2: getValue('auto_l2') || 0,
        l3: getValue('auto_l3') || 0,
        l4: getValue('auto_l4') || 0,
        processor: getValue('auto_processor') || 0,
        barge: getValue('auto_barge') || 0,
        no_move: getCheckbox('auto_no_move')
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
        no_move: getCheckbox('teleop_no_move')
      },
      endgame: {
        action: getValue('endgame_action') || '',
        climb_depth: getValue('climb_depth') || ''
      },
      notes: getValue('notes') || '',
      timestamp: new Date().toLocaleString(),

      mainly_play_style: getValue('play_style')
    };

    try {
      const res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      spinner.style.display = 'none';
      statusMsg.style.display = 'none';
      submitBtn.disabled = false;

      if (res.ok) {
        alert('Scout report submitted successfully!');
        form.reset();
        localStorage.removeItem('scoutDraft');
        // Return to first tab
        tabs.forEach(b => b.classList.remove('active'));
        tabs[0].classList.add('active');
        tabContents.forEach(t => t.classList.remove('active'));
        tabContents[0].classList.add('active');

        // Hide all rating groups
        offenseRatingGroup.style.display = 'none';
        defenseRatingGroup.style.display = 'none';
      } else {
        alert('Error submitting report. Try again.');
      }
    } catch (err) {
      spinner.style.display = 'none';
      statusMsg.style.display = 'none';
      submitBtn.disabled = false;

      console.error('Submission error:', err);
      alert('Submission failed. Check your connection.');
    }
  });

  // Show climb depth only when climb is selected
  const endgameAction = document.getElementById('endgame_action');
  const climbDepthLabel = document.getElementById('climb_depth_label');

  if (endgameAction) {
    endgameAction.addEventListener('change', () => {
      if (endgameAction.value === 'climb') {
        climbDepthLabel.classList.remove('hidden');
      } else {
        climbDepthLabel.classList.add('hidden');
        document.getElementById('climb_depth').value = '';
      }
    });
  }

  // Handle Play Style dynamic rating visibility
  const playStyleSelect = document.getElementById('play_style');
  const offenseRatingGroup = document.getElementById('offense_rating_group');
  const defenseRatingGroup = document.getElementById('defense_rating_group');

  if (playStyleSelect) {
    const updateRatingVisibility = () => {
      const style = playStyleSelect.value;
      offenseRatingGroup.style.display = 'none';
      defenseRatingGroup.style.display = 'none';

      if (style === 'offense') {
        offenseRatingGroup.style.display = 'block';
      } else if (style === 'defense') {
        defenseRatingGroup.style.display = 'block';
      } else if (style === 'both') {
        offenseRatingGroup.style.display = 'block';
        defenseRatingGroup.style.display = 'block';
      }
    };

    updateRatingVisibility();

    playStyleSelect.addEventListener('change', updateRatingVisibility);
  }
});
