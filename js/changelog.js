const CHANGELOG = [
  {
    version: '1.8',
    date: 'Apr 2025',
    changes: {
      New: [
        'Dual-layer grade chart — individual assignment scores and running weighted average shown simultaneously',
        'Assignment score points — each scored item plotted at the exact time it was graded; circles for assignments, diamonds for tests',
        'Running average line — shows the cumulative weighted grade you held at every moment, recalculated after each entry',
        'Layer toggles — "Scores" and "Average" buttons above the chart let you hide either layer independently',
        'Inline assessment editing — click ✎ on any row to edit name, score, max, weight, due date, status, or type without opening a modal',
        'Weight multiplier — set a weight on any assessment so it counts proportionally more in the course grade',
      ],
      Improved: [
        'Grade chart X-axis is true time-proportional — entries logged weeks apart have real visual distance',
        'Sparkline and GPA spark now derive from the running average instead of manual grade snapshots',
        'Grade history chart shows Y-axis gridlines and adapts axis labels to the data range (days / weeks / months)',
        'Save confirmation on edited rows pulses a brief highlight so you can see the change landed',
        'Weight chip (×N) appears next to the assessment name when a non-default weight is set',
      ],
      Fixed: [
        'Cancelling an inline edit correctly restores any weight changes made during the live preview',
        'Type toggle (Assignment / Test) is locked once a score is logged to prevent accidental reclassification',
      ],
    },
  },
  {
    version: '1.7',
    date: 'Apr 2025',
    changes: {
      New: [
        'Pomodoro session logging — every focus session is saved with duration, task, and notes',
        'Post-session card — after each session, optionally tag it to a task or course with a note',
        'Custom timer durations — set any focus/break length or pick a preset (25/5, 50/10, 90/20)',
        'Daily session goal — set a target number of pomodoros; progress dots reset at midnight',
        'Password reset flow — "Forgot password?" sends a reset link; new password form with strength indicator',
        'Dynamic weather location — auto-detects your location via GPS; falls back to profile city',
      ],
      Improved: [
        'Profile now includes a Location field for weather when GPS is unavailable',
        'Home deadline list shows a "+ N more" link instead of silently truncating at 6 items',
        'Profile name is fully configurable — no longer hardcoded anywhere in the app',
        'Sign-up form collects your name so the dashboard personalises immediately',
        'Weather widget is clickable — opens your profile to update the location field',
      ],
      Fixed: [
        'App title and Pomodoro tab title now reflect your profile name instead of a hardcoded name',
      ],
    },
  },
  {
    version: '1.6',
    date: 'Apr 2025',
    changes: {
      New: [
        'Budget limits per category — set a monthly cap and warning threshold in ⚙ Categories',
        'Budget progress bars — colour-coded green/amber/red as you approach and exceed limits',
        'Budget summary card — total budgeted, spent, and remaining across all capped categories',
        'Spending trends — monthly history chart with 3m/6m/12m range and category filter',
        'Month-over-month table — see last month vs this month with directional change indicators',
        'Auto budget reset — budget resets automatically each month; past data archived in Trends',
        'Custom transaction categories — add, rename, and delete categories from ⚙ Categories',
        'Savings contribution log — track every deposit and withdrawal with date and note',
        'Savings sparkline — balance growth chart inside each goal\'s history view',
      ],
      Improved: [
        'Budget breakdown shows colour-coded category dots and inline budget warnings',
        'Transaction list filtered to current month only; full history available in Spending trends',
        'Home page Monthly income and Budget left tiles show current month only',
        'Savings goal cards show contribution history inline with running balance',
      ],
      Fixed: [
        'Savings goal balance now derived from contribution history, not a manually edited field',
      ],
    },
  },
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

const CL_VERSION = '1.8';

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
