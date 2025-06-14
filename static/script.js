const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tabContents.forEach(c => {
      c.classList.toggle('active', c.id === btn.dataset.tab);
    });
  });
});

const endgameAction = document.getElementById('endgame_action');
const climbDepthLabel = document.getElementById('climb_depth_label');
const climbDepthSelect = document.getElementById('climb_depth');

endgameAction.addEventListener('change', () => {
  const isClimb = endgameAction.value === 'climb';
  climbDepthLabel.classList.toggle('hidden', !isClimb);
  climbDepthSelect.classList.toggle('hidden', !isClimb);
  if (!isClimb) climbDepthSelect.value = '';
});

document.getElementById('scout-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const team = document.getElementById('team').value.trim();
  const match = document.getElementById('match').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!name || !team || !match) {
    alert('Please fill out all required fields!');
    return;
  }

  const endgameVal = endgameAction.value;

  const data = {
    name: name,
    team: Number(team),
    match_number: Number(match),
    notes: notes,
    auto: {
      ll1: Number(document.getElementById('auto_ll1').value),
      l2: Number(document.getElementById('auto_l2').value),
      l3: Number(document.getElementById('auto_l3').value),
      l4: Number(document.getElementById('auto_l4').value),
      processor: Number(document.getElementById('auto_processor').value),
      barge: Number(document.getElementById('auto_barge').value),
    },
    teleop: {
      ll1: Number(document.getElementById('teleop_ll1').value),
      l2: Number(document.getElementById('teleop_l2').value),
      l3: Number(document.getElementById('teleop_l3').value),
      l4: Number(document.getElementById('teleop_l4').value),
      processor: Number(document.getElementById('teleop_processor').value),
      barge: Number(document.getElementById('teleop_barge').value),
      offense_rating: Number(document.getElementById('offense_rating').value),
      defense_rating: Number(document.getElementById('defense_rating').value),
    },
    endgame: {
      parked: endgameVal === 'park' ? 'Yes' : 'No',
      climbed: endgameVal === 'climb' ? 'Yes' : 'No',
      climb_type: climbDepthSelect.value,
    }
  };

  try {
    const res = await fetch('http://localhost:5000/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert('Data submitted successfully!');
      e.target.reset();
      climbDepthLabel.classList.add('hidden');
      climbDepthSelect.classList.add('hidden');
      tabs[0].click();
    } else {
      alert('Submission failed. Try again.');
    }
  } catch (error) {
    alert('Error submitting data: ' + error.message);
  }
});
