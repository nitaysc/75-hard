/* ============================================================
   75 HARD — app logic
   Rule engine, localStorage persistence, reminders, gallery.
   ============================================================ */
'use strict';

/* ---------------- Constants ---------------- */
const STORAGE_KEY = 'seventyfivehard.v1';
const DAYS_TOTAL = 75;
const GALLON_ML = 3785;   // 1 US gallon
const CUP_ML = 250;       // standard cup
const QUOTE = 'Learn how to deal with discomfort and it opens the door to everything. What can stop you if you willingly seek out all the things nobody else is willing to do?';

/* Random motivation shown on task completion */
const MOTIV_QUOTES = [
  'You got this. Keep going!',
  'One more task down. Stay hard.',
  'Discipline is doing it anyway. Nice.',
  'Small steps. Big results. Keep pushing.',
  'You are tougher than you think.',
  'Future you is proud of you right now.',
  'Nothing can stop you today.',
  'Earned it. Now go get the next one.',
  'Consistency beats intensity. Keep showing up.',
  'Almost there. Do not slow down.',
  'That is what winners do. Show up again.',
  'Pain is temporary. Quitting is forever.',
];
const MOTIV_VIDEOS = [
  'videos/motivation-1.mp4',
  'videos/motivation-2.mp4',
  'videos/motivation-3.mp4',
  'videos/motivation-4.mp4',
  'videos/motivation-5.mp4',
  'videos/motivation-6.mp4',
];

const TASKS = [
  { id: 'workout1', label: '45 Minute Workout',        icon: 'dumbbell' },
  { id: 'workout2', label: '45 Minute Outdoor Workout', icon: 'mountain' },
  { id: 'photo',    label: 'Take Progress Picture',      icon: 'camera' },
  { id: 'reading',  label: '10 Pages of Reading',        icon: 'book' },
  { id: 'water',    label: 'Drink 1 Gallon of Water',    icon: 'droplet', tracker: true },
  { id: 'diet',     label: 'Follow a Diet',              icon: 'salad' },
  { id: 'nocheat',  label: 'No Cheat Meals or Alcohol',  icon: 'ban' },
];
const taskById = Object.fromEntries(TASKS.map(t => [t.id, t]));

/* ---------------- SVG icon library ---------------- */
const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5 17.5 17.5"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/><path d="M3 10l7-7"/><path d="M14 21l7-7"/></svg>',
  mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  droplet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7 6.5 8.2a7 7 0 1 0 11 0L12 2.7z"/></svg>',
  salad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/><path d="M11.4 3.6a3 3 0 0 1 4.2 4.2"/><path d="M7.5 6.5a2.5 2.5 0 0 1 5 0"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>',
};

/* ---------------- State ---------------- */
let state = load();
let lastFired = {};   // reminder fire dedupe for the current minute
let waterOpen = false; // whether the water intake tracker is expanded

function defaultState() {
  return {
    startDate: null,      // 'YYYY-MM-DD' of Day 1
    dayEndsHour: 1,       // hour the challenge day rolls over (1 => 1:00 AM)
    days: {},             // 'YYYY-MM-DD' -> { tasks, water, notes, photo, completedAt }
    reminders: [],
    notifAllowed: false,
    motivation: true,     // motivation popups on task completion
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return Object.assign(defaultState(), s);
  } catch (e) {
    return defaultState();
  }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full */ }
}

/* ---------------- Date helpers ---------------- */
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

/** The "challenge day" runs from dayEndsHour to dayEndsHour (default 1:00 AM). */
function effectiveToday() {
  const now = new Date();
  if (now.getHours() < state.dayEndsHour) {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return prev;
  }
  return now;
}

function challengeDay() {
  if (!state.startDate) return 1;
  const diff = Math.floor((effectiveToday() - parseDate(state.startDate)) / 86400000);
  return Math.max(1, Math.min(diff + 1, DAYS_TOTAL + 1));
}

function dayRecord() {
  const key = dateKey(effectiveToday());
  if (!state.days[key]) {
    state.days[key] = { tasks: {}, water: 0, notes: '', photo: null, completedAt: null };
  }
  return state.days[key];
}

function isDayComplete(rec) {
  return TASKS.every(t => rec.tasks[t.id] === true);
}

/* ---------------- Haptics & toast ---------------- */
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
let toastTimer = null;
function toast(msg, red = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (red ? ' red' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* ---------------- The Reset Rule ---------------- */
/** If the previous challenge day was left incomplete, the counter resets to Day 1. */
function checkFailReset() {
  if (!state.startDate) return;
  const today = effectiveToday();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const prev = state.days[dateKey(yest)];
  if (prev && !isDayComplete(prev)) {
    state.startDate = dateKey(effectiveToday());
    state.days = {};
    save();
    toast('You missed a task \u2014 counter reset to Day 1.', true);
    vibrate([30, 40, 30]);
  }
}

function startChallenge() {
  state.startDate = dateKey(effectiveToday());
  state.days = {};
  save();
}

/* ---------------- Render: today ---------------- */
function renderToday() {
  const day = challengeDay();
  const done = challengeDay() > DAYS_TOTAL;
  document.getElementById('app').classList.toggle('hidden', done);
  document.getElementById('complete').classList.toggle('hidden', !done);
  if (done) return;

  const rec = dayRecord();
  const doneCount = TASKS.filter(t => rec.tasks[t.id]).length;

  document.getElementById('day-num').textContent = day;
  document.getElementById('day-date').textContent = dateKey(effectiveToday());
  document.getElementById('ring-center').textContent = `${doneCount}/${TASKS.length}`;

  const C = 2 * Math.PI * 52;
  const fg = document.getElementById('ring-fg');
  fg.style.strokeDashoffset = String(C - (C * doneCount) / TASKS.length);

  // Tasks
  const list = document.getElementById('task-list');
  list.innerHTML = TASKS.map(t => {
    const doneTask = rec.tasks[t.id] === true;
    const remind = state.reminders.find(r => r.taskId === t.id);
    let tracker = '';
    if (t.tracker) {
      const pct = Math.min(100, Math.round((rec.water / GALLON_ML) * 100));
      tracker = `
        <div class="water-track">
          <div class="water-bar"><div class="water-fill" style="width:${pct}%"></div></div>
          <div class="water-meta">
            <span><span class="water-cup-label">${(rec.water / 1000).toFixed(2)}</span> / 3.79 L</span>
            <span>${pct}%</span>
          </div>
          <div class="water-actions">
            <button class="water-btn" data-water="-${CUP_ML}" data-task="${t.id}">${ICONS.minus} &minus; cup</button>
            <button class="water-btn" data-water="+${CUP_ML}" data-task="${t.id}">${ICONS.plus} + cup</button>
          </div>
        </div>`;
    }
    let cam = '';
    let thumb = '';
    if (t.id === 'photo') {
      cam = `<button class="cam-btn" data-cam title="Open camera" aria-label="Take photo with camera">${ICONS.camera}</button>`;
    }
    if (t.id === 'photo' && rec.photo) {
      thumb = `<img class="photo-thumb" src="${rec.photo}" alt="Today's progress photo" />`;
    }
    return `
      <div class="task ${doneTask ? 'done' : ''} ${t.tracker && waterOpen ? 'open' : ''}" data-task="${t.id}">
        <div class="check">${ICONS.check}</div>
        <div class="task-icon">${ICONS[t.icon]}</div>
        <div class="task-main">
          <div class="task-label">${t.label}</div>
          <div class="task-sub">
            <button class="remind-btn" data-remind="${t.id}">
              ${remind && remind.enabled ? `${ICONS.bell} ${formatTime(remind.time)}` : 'Add reminder'}
            </button>
          </div>
        </div>
        ${cam}${thumb}
        ${tracker}
      </div>`;
  }).join('');

  // Notes (only replace value if user isn't actively typing)
  const notes = document.getElementById('notes-input');
  if (document.activeElement !== notes) notes.value = rec.notes || '';
}

/* ---------------- Render: grid ---------------- */
function renderGrid() {
  const day = challengeDay();
  const todayKey = dateKey(effectiveToday());
  let doneCount = 0;
  const cells = [];
  for (let i = 1; i <= DAYS_TOTAL; i++) {
    const dayDate = new Date(parseDate(state.startDate || todayKey));
    dayDate.setDate(dayDate.getDate() + i - 1);
    const key = dateKey(dayDate);
    const rec = state.days[key];
    const isDone = rec && isDayComplete(rec);
    if (isDone) doneCount++;
    let cls = 'gcell future';
    if (isDone) cls = 'gcell done';
    else if (i < day) cls = 'gcell failed';
    else if (i === day) cls = 'gcell today';
    const clickable = isDone || i < day;
    cells.push(`<button class="${cls}" data-gday="${i}" ${clickable ? '' : 'disabled'}>${i}</button>`);
  }
  document.getElementById('grid-75').innerHTML = cells.join('');
  document.getElementById('stat-done').textContent = doneCount;
  document.getElementById('stat-cur').textContent = Math.min(day, DAYS_TOTAL);
}

/** Opens the detail modal for a specific challenge day number. */
function openDayDetail(dayNum) {
  const dayDate = new Date(parseDate(state.startDate));
  dayDate.setDate(dayDate.getDate() + dayNum - 1);
  const key = dateKey(dayDate);
  const rec = state.days[key] || { tasks: {}, notes: '', photo: null };
  document.getElementById('mday-day').textContent = `DAY ${dayNum} \u2014 ${key}`;
  document.getElementById('mday-photo').innerHTML = rec.photo
    ? `<img src="${rec.photo}" alt="Progress photo" />`
    : `<div class="no-photo">No photo taken</div>`;
  document.getElementById('mday-tasks').innerHTML = TASKS.map(t =>
    `<div class="mday-task ${rec.tasks[t.id] ? 'done' : ''}">
       <div class="mday-check">${rec.tasks[t.id] ? ICONS.check : ''}</div>
       <span>${t.label}</span>
     </div>`).join('');
  document.getElementById('mday-notes').textContent = rec.notes || '';
  document.getElementById('mday-notes').style.display = rec.notes ? '' : 'none';
  showModal('modal-day');
}

/* ---------------- Render: gallery ---------------- */
function renderGallery() {
  const el = document.getElementById('gallery-list');
  const entries = Object.entries(state.days)
    .filter(([, r]) => r.photo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rec]) => {
      const dayNum = Math.floor((parseDate(key) - parseDate(state.startDate)) / 86400000) + 1;
      return { key, rec, dayNum };
    });
  if (!entries.length) {
    el.innerHTML = `<div class="gallery-empty"><span class="big">\u{1F4F7}</span>No progress photos yet.<br/>Take your daily photo from the Today tab.</div>`;
    return;
  }
  el.innerHTML = entries.map(e =>
    `<button class="gcard" data-photo="${e.key}">
       <img src="${e.rec.photo}" alt="Day ${e.dayNum}" />
       <div class="gcard-mini-stamp">COMPLETED</div>
       <div class="gcard-overlay"><span class="gcard-day">DAY ${e.dayNum}</span></div>
     </button>`).join('');
}

/* ---------------- Render: settings ---------------- */
function renderSettings() {
  document.getElementById('set-day-end').value = String(state.dayEndsHour);
  document.getElementById('about-day-end').textContent =
    `${formatHour(state.dayEndsHour)} ${state.dayEndsHour >= 12 ? 'PM' : 'AM'}`;
  document.getElementById('switch-notif').checked = state.notifAllowed;
  document.getElementById('switch-motivation').checked = state.motivation !== false;

  const list = document.getElementById('reminder-list');
  list.innerHTML = state.reminders.length
    ? state.reminders.map(r => `
      <div class="r-item" data-rid="${r.id}">
        <div class="r-item-main">
          <span class="r-item-label">${taskById[r.taskId] ? taskById[r.taskId].label : r.taskId}</span>
          <span class="r-item-time">${r.enabled ? formatTime(r.time) : ''}</span>
        </div>
        ${r.enabled ? '' : '<span class="r-item-off">OFF</span>'}
        <label class="switch"><input type="checkbox" data-rtoggle="${r.id}" ${r.enabled ? 'checked' : ''}><span class="slider"></span></label>
      </div>`).join('')
    : '<p class="set-hint" style="margin:0">No reminders yet. Add one below.</p>';

  const sel = document.getElementById('rm-task');
  sel.innerHTML = TASKS.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
}

/* ---------------- Reminders ---------------- */
function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${pad(m)} ${ampm}`;
}
function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:00`;
}

function openReminderModal(id, presetTaskId) {
  const r = id ? state.reminders.find(x => x.id === id) : null;
  const taskId = r ? r.taskId : (presetTaskId || TASKS[0].id);
  document.getElementById('rm-id').value = r ? r.id : '';
  document.getElementById('rm-title').textContent = r
    ? `Reminder: ${taskById[taskId].label}`
    : 'Reminder';
  document.getElementById('rm-task').value = taskId;
  document.getElementById('rm-everyday').checked = !r || r.days.length === 7;
  document.getElementById('rm-time').value = r ? r.time : '17:00';
  const days = r ? r.days : [0, 1, 2, 3, 4, 5, 6];
  document.querySelectorAll('#rm-week button').forEach(b => {
    b.classList.toggle('on', days.includes(Number(b.dataset.d)));
  });
  document.getElementById('btn-del-reminder').classList.toggle('hidden', !r);
  showModal('modal-reminder');
}

/** Opens the reminder modal for a specific task (edits an existing one if present). */
function openReminderForTask(taskId) {
  const existing = state.reminders.find(r => r.taskId === taskId);
  openReminderModal(existing ? existing.id : null, taskId);
}

function saveReminder() {
  const id = document.getElementById('rm-id').value;
  const taskId = document.getElementById('rm-task').value;
  const everyday = document.getElementById('rm-everyday').checked;
  const time = document.getElementById('rm-time').value || '17:00';
  const days = everyday
    ? [0, 1, 2, 3, 4, 5, 6]
    : [...document.querySelectorAll('#rm-week button.on')].map(b => Number(b.dataset.d));
  if (!days.length) { toast('Pick at least one day', true); return; }
  if (id) {
    const r = state.reminders.find(x => x.id === id);
    Object.assign(r, { taskId, time, days, enabled: r.enabled });
  } else {
    state.reminders.push({ id: 'r' + Date.now(), taskId, time, days, enabled: true });
  }
  save(); renderSettings(); closeModal('modal-reminder'); toast('Reminder saved');
}

function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const wd = now.getDay();
  const stamp = `${dateKey(now)} ${hm}`;
  state.reminders.forEach(r => {
    if (!r.enabled || r.time !== hm || !r.days.includes(wd)) return;
    const key = r.id + '@' + stamp;
    if (lastFired[key]) return;
    lastFired[key] = true;
    try {
      new Notification('75 HARD \u2014 Reminder', {
        body: `${taskById[r.taskId] ? taskById[r.taskId].label : ''} \u2014 ${formatTime(r.time)}. Stay disciplined.`,
        icon: 'icons/icon-192.png',
        tag: key,
      });
    } catch (e) {}
  });
}

/* ---------------- Photos ---------------- */
const hiddenInput = document.createElement('input');
hiddenInput.type = 'file';
hiddenInput.accept = 'image/*';
hiddenInput.style.display = 'none';
document.body.appendChild(hiddenInput);

// A second input with capture="environment" so phones open the camera directly.
const cameraInput = document.createElement('input');
cameraInput.type = 'file';
cameraInput.accept = 'image/*';
cameraInput.capture = 'environment';
cameraInput.style.display = 'none';
document.body.appendChild(cameraInput);

function handlePhotoFile(file) {
  if (!file) return;
  compressImage(file).then(dataUrl => {
    const rec = dayRecord();
    rec.photo = dataUrl;
    rec.tasks.photo = true;
    save(); renderToday(); renderGallery();
    toast('Progress photo saved');
    vibrate(15);
    showMotivation();
  });
}

hiddenInput.addEventListener('change', () => handlePhotoFile(hiddenInput.files[0]));
cameraInput.addEventListener('change', () => handlePhotoFile(cameraInput.files[0]));

function pickPhoto() { hiddenInput.click(); }          // choose an existing photo
function pickCamera() { cameraInput.click(); }         // open the device camera

/** Resizes & compresses an image to keep localStorage small. */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 720;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------- Share / success card ---------------- */
function openPhotoViewer(key) {
  const rec = state.days[key];
  if (!rec || !rec.photo) return;
  document.getElementById('pv-img').src = rec.photo;
  const dayNum = Math.floor((parseDate(key) - parseDate(state.startDate)) / 86400000) + 1;
  document.getElementById('pv-day').textContent = `DAY ${dayNum}`;
  document.getElementById('pv-img').dataset.day = dayNum;
  showModal('modal-photo');
}

/** Draws a shareable success card to a canvas and shares/downloads it. */
async function sharePhoto() {
  const img = document.getElementById('pv-img');
  const dayNum = img.dataset.day || '1';
  const canvas = document.createElement('canvas');
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Photo (fit cover into top 70%)
  const PH = Math.round(H * 0.72);
  await new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const s = Math.max(W / im.width, PH / im.height);
      const dw = im.width * s, dh = im.height * s;
      ctx.drawImage(im, (W - dw) / 2, (PH - dh) / 2, dw, dh);
      res();
    };
    im.src = img.src;
  });

  // Dark gradient over photo bottom
  const grad = ctx.createLinearGradient(0, PH * 0.55, 0, PH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, PH);

  // COMPLETED stamp
  ctx.save();
  ctx.translate(W / 2, PH * 0.45);
  ctx.rotate(-0.2);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 10;
  ctx.font = '900 120px Arial';
  ctx.textAlign = 'center';
  ctx.strokeText('COMPLETED', 0, 0);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('COMPLETED', 0, 0);
  ctx.restore();

  // DAY x
  ctx.fillStyle = '#fff';
  ctx.font = '900 150px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`DAY ${dayNum}`, 60, PH - 60);

  // Rules list
  ctx.fillStyle = '#d4d4d8';
  ctx.font = '600 34px Arial';
  ctx.textBaseline = 'middle';
  const rules = [
    'Two 45 min workouts', 'One workout must be outdoors', 'Follow a diet',
    'Take a progress pic', '1 gallon of water', 'No alcohol or cheat meals', 'Read 10 pages',
  ];
  let y = PH + 90;
  rules.forEach(r => {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(56, y - 14, 14, 14);
    ctx.fillStyle = '#d4d4d8';
    ctx.fillText(r, 92, y);
    y += 62;
  });

  // Footer badge
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, H - 170, W, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '900 56px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('75 HARD', 56, H - 85);
  ctx.textAlign = 'right';
  ctx.font = '600 30px Arial';
  ctx.fillStyle = '#fecaca';
  ctx.fillText('75HARD.COM', W - 56, H - 85);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));

  // Try native share with the file; fall back to download.
  const shareData = { title: `75 HARD \u2014 Day ${dayNum}`, files: [new File([blob], `75-hard-day-${dayNum}.png`, { type: 'image/png' })] };
  if (navigator.canShare && navigator.canShare(shareData)) {
    try { await navigator.share(shareData); return; } catch (e) { /* cancelled or unsupported */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `75-hard-day-${dayNum}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Success card downloaded');
}

/* ---------------- Modal helpers ---------------- */
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

/* ---------------- Burst animation ---------------- */
function celebrate() {
  const burst = document.createElement('div');
  burst.id = 'burst';
  burst.innerHTML = '<div class="stamp">COMPLETED</div>';
  document.body.appendChild(burst);
  requestAnimationFrame(() => burst.classList.add('show'));
  vibrate([20, 30, 20, 30, 60]);
  setTimeout(() => { burst.classList.remove('show'); setTimeout(() => burst.remove(), 300); }, 1400);
}

/* ---------------- Motivation popup ---------------- */
const MUTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
const UNMUTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

/** Shows a random motivation video or quote in a half-screen sheet. */
function showMotivation() {
  if (state.motivation === false) return;
  const body = document.getElementById('motiv-body');
  const showVideo = Math.random() < 0.6;

  if (showVideo) {
    const src = MOTIV_VIDEOS[Math.floor(Math.random() * MOTIV_VIDEOS.length)];
    body.innerHTML = `
      <div class="motiv-video-frame">
        <video id="motiv-video" src="${src}" autoplay loop playsinline preload="metadata"></video>
        <button class="motiv-mute" id="btn-motiv-mute" aria-label="Toggle sound">${UNMUTE_ICON}</button>
      </div>`;
    const v = document.getElementById('motiv-video');
    const muteBtn = document.getElementById('btn-motiv-mute');
    let muted = false;
    // Sound starts ON. If the browser blocks autoplay-with-sound, fall back to muted.
    const tryPlay = () => v.play().then(() => {
      muted = false;
      v.muted = false;
      muteBtn.innerHTML = UNMUTE_ICON;
    }).catch(() => {
      muted = true;
      v.muted = true;
      muteBtn.innerHTML = MUTE_ICON;
      v.play().catch(() => {});
    });
    tryPlay();
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      v.muted = muted;
      muteBtn.innerHTML = muted ? MUTE_ICON : UNMUTE_ICON;
      if (!muted) tryPlay();
    });
  } else {
    const q = MOTIV_QUOTES[Math.floor(Math.random() * MOTIV_QUOTES.length)];
    body.innerHTML = `<div class="motiv-quote"><span class="motiv-quote-mark">\u201C</span> ${q} <span class="motiv-quote-mark">\u201D</span></div>`;
  }
  showModal('modal-motivation');
}

/* ---------------- View switching (tab bar) ---------------- */
const VIEWS = ['today', 'grid', 'gallery', 'settings'];
function switchView(view) {
  VIEWS.forEach(v => document.getElementById('view-' + v).classList.toggle('hidden', v !== view));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'grid') renderGrid();
  if (view === 'gallery') renderGallery();
  if (view === 'settings') renderSettings();
  document.getElementById('main').scrollTop = 0;
}

/* ---------------- Init ---------------- */
function init() {
  checkFailReset();
  registerSW();

  const hasStarted = !!state.startDate;
  document.getElementById('welcome').classList.toggle('hidden', hasStarted);
  document.getElementById('app').classList.toggle('hidden', !hasStarted);

  if (hasStarted) {
    renderToday();
    renderGrid();
    renderGallery();
    renderSettings();
  }

  // --- Welcome ---
  document.getElementById('btn-start').addEventListener('click', () => {
    startChallenge();
    vibrate(20);
    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderToday(); renderGrid(); renderGallery(); renderSettings();
    toast('Day 1 starts now. No excuses.');
    if (Notification.permission === 'default') Notification.requestPermission();
  });

  // --- Complete screen ---
  document.getElementById('btn-restart-complete').addEventListener('click', () => {
    startChallenge();
    document.getElementById('complete').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderToday(); renderGrid(); renderGallery(); renderSettings();
    toast('Round two. Day 1.');
  });

  // --- Tab bar ---
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => { vibrate(8); switchView(t.dataset.view); }));
  document.getElementById('btn-grid').addEventListener('click', () => switchView('grid'));

  // --- Task list (event delegation) ---
  document.getElementById('task-list').addEventListener('click', e => {
    // Camera button on the photo task -> open the device camera directly.
    const camBtn = e.target.closest('[data-cam]');
    if (camBtn) {
      vibrate(10);
      pickCamera();
      return;
    }
    // Add-reminder pill on any task -> open the reminder modal for that task.
    const remindBtn = e.target.closest('[data-remind]');
    if (remindBtn) {
      vibrate(8);
      openReminderForTask(remindBtn.dataset.remind);
      return;
    }
    const waterBtn = e.target.closest('.water-btn');
    if (waterBtn) {
      const rec = dayRecord();
      const delta = Number(waterBtn.dataset.water);
      const wasFull = rec.water >= GALLON_ML;
      rec.water = Math.max(0, Math.min(GALLON_ML, rec.water + delta));
      rec.tasks.water = rec.water >= GALLON_ML;
      vibrate(10);
      save(); renderToday();
      if (rec.tasks.water && !wasFull) showMotivation();
      if (isDayComplete(rec) && !rec.completedAt) { rec.completedAt = Date.now(); save(); celebrate(); }
      return;
    }
    const task = e.target.closest('.task');
    if (!task) return;
    const id = task.dataset.task;
    const rec = dayRecord();

    // The water task expands the intake tracker instead of toggling directly.
    if (id === 'water') {
      waterOpen = !waterOpen;
      vibrate(8);
      renderToday();
      return;
    }

    // The photo task opens the camera / upload picker.
    if (id === 'photo') {
      pickPhoto();
      return;
    }

    rec.tasks[id] = !rec.tasks[id];
    const nowDone = rec.tasks[id] === true;
    vibrate(nowDone ? 12 : 8);
    save(); renderToday();
    if (nowDone) showMotivation();
    if (isDayComplete(rec) && !rec.completedAt) {
      rec.completedAt = Date.now();
      save();
      celebrate();
      toast('Day complete \u2014 stay hard.', true);
    }
  });

  // --- Notes autosave ---
  const notes = document.getElementById('notes-input');
  notes.addEventListener('input', () => {
    const rec = dayRecord();
    rec.notes = notes.value;
    save();
  });

  // --- Grid day clicks ---
  document.getElementById('grid-75').addEventListener('click', e => {
    const cell = e.target.closest('.gcell[data-gday]');
    if (!cell) return;
    vibrate(8);
    openDayDetail(Number(cell.dataset.gday));
  });

  // --- Gallery clicks ---
  document.getElementById('gallery-list').addEventListener('click', e => {
    const card = e.target.closest('.gcard[data-photo]');
    if (!card) return;
    vibrate(8);
    openPhotoViewer(card.dataset.photo);
  });

  // --- Photo viewer share ---
  document.getElementById('btn-share').addEventListener('click', sharePhoto);

  // --- Settings ---
  document.getElementById('set-day-end').addEventListener('change', e => {
    state.dayEndsHour = Number(e.target.value);
    save(); renderSettings();
    toast('Day end updated');
  });

  document.getElementById('btn-add-reminder').addEventListener('click', () => openReminderModal(null));

  document.getElementById('reminder-list').addEventListener('click', e => {
    const item = e.target.closest('.r-item');
    if (!item) return;
    const toggle = e.target.closest('[data-rtoggle]');
    if (toggle) {
      const r = state.reminders.find(x => x.id === toggle.dataset.rtoggle);
      if (r) {
        r.enabled = toggle.checked;
        if (r.enabled && Notification.permission === 'default') Notification.requestPermission();
        save(); renderSettings();
        toast(r.enabled ? 'Reminder on' : 'Reminder off');
      }
      return;
    }
    vibrate(8);
    openReminderModal(item.dataset.rid);
  });

  document.getElementById('btn-save-reminder').addEventListener('click', saveReminder);
  document.getElementById('btn-del-reminder').addEventListener('click', () => {
    const id = document.getElementById('rm-id').value;
    state.reminders = state.reminders.filter(r => r.id !== id);
    save(); renderSettings(); closeModal('modal-reminder'); toast('Reminder deleted');
  });

  // Weekday multi-select
  document.getElementById('rm-week').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    b.classList.toggle('on');
    document.getElementById('rm-everyday').checked =
      document.querySelectorAll('#rm-week button.on').length === 7;
  });
  document.getElementById('rm-everyday').addEventListener('change', e => {
    document.querySelectorAll('#rm-week button').forEach(b => b.classList.toggle('on', e.target.checked));
  });

  // Notifications master switch
  document.getElementById('switch-notif').addEventListener('change', async e => {
    if (e.target.checked) {
      if (!('Notification' in window)) { toast('Notifications not supported', true); e.target.checked = false; return; }
      const p = await Notification.requestPermission();
      state.notifAllowed = p === 'granted';
      if (!state.notifAllowed) { toast('Notifications blocked in browser settings', true); e.target.checked = false; }
      save();
    } else {
      state.notifAllowed = false;
      save();
      toast('Notifications off');
    }
  });

  // Motivation popups switch
  document.getElementById('switch-motivation').addEventListener('change', e => {
    state.motivation = e.target.checked;
    save();
    toast(e.target.checked ? 'Motivation popups on' : 'Motivation popups off');
  });

  document.getElementById('btn-test-notif').addEventListener('click', () => {
    if (Notification.permission === 'granted') {
      new Notification('75 HARD', { body: 'Notifications are working. Stay hard.', icon: 'icons/icon-192.png' });
    } else {
      Notification.requestPermission().then(p => {
        if (p === 'granted') {
          state.notifAllowed = true; save(); renderSettings();
          new Notification('75 HARD', { body: 'Notifications are working. Stay hard.', icon: 'icons/icon-192.png' });
        }
      });
    }
  });

  // --- Danger zone ---
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('confirm-title').textContent = 'Reset to Day 1?';
    document.getElementById('confirm-text').textContent =
      'This starts a fresh 75-day run. All progress photos, notes and check-ins will be wiped. There is no undo.';
    document.getElementById('btn-confirm-yes').dataset.action = 'reset';
    showModal('modal-confirm');
  });

  document.getElementById('btn-wipe').addEventListener('click', () => {
    document.getElementById('confirm-title').textContent = 'Delete all data?';
    document.getElementById('confirm-text').textContent =
      'Removes the challenge and every trace of data stored on this device.';
    document.getElementById('btn-confirm-yes').dataset.action = 'wipe';
    showModal('modal-confirm');
  });

  document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    const action = document.getElementById('btn-confirm-yes').dataset.action;
    closeModal('modal-confirm');
    if (action === 'reset') {
      startChallenge();
      toast('Reset to Day 1.', true);
      vibrate([30, 40, 30]);
    } else {
      state = defaultState();
      save();
      toast('All data deleted');
    }
    document.getElementById('app').classList.add('hidden');
    document.getElementById('complete').classList.add('hidden');
    document.getElementById('welcome').classList.remove('hidden');
    renderToday();
  });

  // --- Modal close buttons & backdrops ---
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach(m =>
    m.addEventListener('click', e => {
      if (e.target === m && !m.classList.contains('full')) m.classList.add('hidden');
    }));

  // --- Motivation popup: pause the video whenever the sheet closes ---
  const motivModal = document.getElementById('modal-motivation');
  const stopMotivVideo = () => { const v = document.getElementById('motiv-video'); if (v) v.pause(); };
  document.getElementById('btn-motiv-close').addEventListener('click', () => closeModal('modal-motivation'));
  new MutationObserver(() => { if (motivModal.classList.contains('hidden')) stopMotivVideo(); })
    .observe(motivModal, { attributes: true, attributeFilter: ['class'] });

  // --- Reminder watcher (every 20s) ---
  setInterval(checkReminders, 20000);

  // --- Periodic re-render on day rollover ---
  setInterval(() => {
    if (state.startDate && !document.getElementById('app').classList.contains('hidden')) {
      renderToday();
      renderGrid();
    }
  }, 60000);
}

/* ---------------- Service worker (offline PWA) ---------------- */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
