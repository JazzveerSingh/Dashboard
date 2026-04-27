const CHANGELOG = [
  {
    version: '1.5',
    date: 'Apr 2025',
    changes: {
      New: [
        'Assignment vs Test type — tests show score inputs immediately, skip status tracking',
        'Task editing — click ✎ on any task to edit name, priority, tag, or due date',
        'Subtasks — expandable checklists per task with progress tracking',
        'Custom tags — add, rename, or delete tags in the ⚙ Tags manager',
        'Auto-archive — completed tasks auto-archive after 5 days; restore anytime',
        'Clock format toggle — click the clock to switch between 12h and 24h',
        "What's New popup — see changelogs automatically on first login after an update",
      ],
      Improved: [
        'Quick-add now parses natural-language dates (e.g. "buy milk friday", "homework apr 30")',
        'Home page: Average grade and Monthly income tiles swapped for better layout',
        'Upcoming deadlines now correctly exclude logically-done tests and assignments',
        'Grade calculator always uses total-points mode — simpler and more accurate',
      ],
      Fixed: [
        'Tag filter pills now correctly apply when clicked',
        'Tag renaming and deletion in the manager now work properly',
        'Tests no longer incorrectly appear as overdue when un-scored',
      ],
    },
  },
  {
    version: '1.4',
    date: 'Mar 2025',
    changes: {
      New: [
        'Pomodoro timer with work/break sessions and desktop notifications',
        'Savings goals with progress bars in the Money tab',
        'Habit streak tracking with heatmap visualization',
      ],
      Improved: [
        'Grade calculator redesigned with course colour coding',
        'Home page deadline list now shows course dots and TEST labels',
      ],
      Fixed: [
        'Pomodoro button icons no longer render as raw HTML entities',
        'Clock flip animation no longer stutters on tab switch',
      ],
    },
  },
];

const CL_VERSION = CHANGELOG[0].version;

function clCheckOnLoad() {
  const seen = localStorage.getItem('cl_seen');
  if (seen === CL_VERSION) return;
  setTimeout(() => openChangelog(true), 1500);
}

function openChangelog(isAuto) {
  renderChangelog();
  if (isAuto) {
    localStorage.setItem('cl_seen', CL_VERSION);
    const dot = document.getElementById('cl-dot');
    if (dot) dot.style.display = 'none';
  }
  openM('m-changelog');
}

function closeChangelog() {
  localStorage.setItem('cl_seen', CL_VERSION);
  const dot = document.getElementById('cl-dot');
  if (dot) dot.style.display = 'none';
  closeM('m-changelog');
}

function renderChangelog() {
  const el = document.getElementById('cl-body'); if (!el) return;
  el.innerHTML = CHANGELOG.map((entry, i) => {
    const cats = Object.entries(entry.changes).filter(([, items]) => items.length);
    const inner = cats.map(([cat, items]) => `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-bottom:5px">${cat}</div>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px">
          ${items.map(it => `<li style="font-size:13px;color:var(--tx1)">${it}</li>`).join('')}
        </ul>
      </div>`).join('');

    if (i === 0) {
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
            <span style="font-size:15px;font-weight:700">v${entry.version}</span>
            <span style="font-size:12px;color:var(--tx3)">${entry.date}</span>
            <span style="font-size:10px;font-weight:700;background:var(--acc);color:#fff;border-radius:4px;padding:1px 6px;letter-spacing:.3px">LATEST</span>
          </div>
          ${inner}
        </div>`;
    }
    return `
      <details style="margin-bottom:10px">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--tx2);list-style:none;display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:var(--tx3)">▶</span> v${entry.version} <span style="font-size:11px;font-weight:400;color:var(--tx3)">${entry.date}</span>
        </summary>
        <div style="padding-top:10px">${inner}</div>
      </details>`;
  }).join('');
}

function clUpdateDot() {
  const seen = localStorage.getItem('cl_seen');
  const dot = document.getElementById('cl-dot');
  if (dot) dot.style.display = (seen !== CL_VERSION) ? 'inline-block' : 'none';
}
