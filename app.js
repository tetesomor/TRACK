// ---------- Storage ----------

const STORAGE_KEY = "runlift_data_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("failed to load state", e);
  }
  return {
    runs: [],
    liftSessions: [],
    notes: [],
    exercises: ["squat", "lunge", "deadlift", "calf raise", "bulgarian split squat", "leg press", "hip thrust"],
    runTypes: ["easy", "long", "intervals", "race"],
  };
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("failed to save state", e);
  }
}

// ---------- Date helpers ----------

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function paceMinPerKm(distance, minutes) {
  if (!distance) return "-";
  const pace = minutes / distance;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Progressive overload helpers ----------

function nextLiftTarget(sessions, exercise) {
  const past = sessions
    .flatMap((s) => s.exercises.filter((e) => e.exercise === exercise).map((e) => ({ ...e, date: s.date })))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (past.length === 0) return null;
  const last = past[0];
  const prior = past[1];
  let suggestedReps = last.reps + 1;
  if (prior) {
    const priorTarget = prior.reps + 1;
    if (last.reps < priorTarget) {
      suggestedReps = priorTarget;
    }
  }
  return { exercise, lastReps: last.reps, lastWeight: last.weight, suggestedReps, lastDate: last.date };
}

function nextRunTarget(runs, type) {
  const past = runs
    .filter((r) => r.type === type)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (past.length === 0) return null;
  const last = past[0];
  const prior = past[1];
  let suggestedDistance = Math.round((last.distance + 0.5) * 10) / 10;
  if (prior) {
    const priorTarget = Math.round((prior.distance + 0.5) * 10) / 10;
    if (last.distance < priorTarget) {
      suggestedDistance = priorTarget;
    }
  }
  return { type, lastDistance: last.distance, suggestedDistance, lastDate: last.date };
}

function weekTotals(runs, liftSessions) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const runsThisWeek = runs.filter((r) => new Date(r.date) >= weekAgo);
  const liftsThisWeek = liftSessions.filter((s) => new Date(s.date) >= weekAgo);
  const totalDist = runsThisWeek.reduce((s, r) => s + r.distance, 0);
  return { runsThisWeek, liftsThisWeek, totalDist };
}

// ---------- Small DOM helpers ----------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ---------- Router ----------

let currentPage = "home";

const pageContent = document.getElementById("page-content");
const bottomNav = document.getElementById("bottom-nav");

const NAV_ICONS = {
  home: '<path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />',
  run: '<circle cx="16" cy="5" r="1.5" fill="currentColor" stroke="none" /><path d="M12 8l3 3-2 5 4 4" /><path d="M9 21l3-6-2-3 3-4" /><path d="M6 12l3-1" />',
  lift: '<rect x="2" y="9" width="3" height="6" /><rect x="19" y="9" width="3" height="6" /><line x1="5" y1="12" x2="19" y2="12" /><rect x="6" y="7" width="2" height="10" /><rect x="16" y="7" width="2" height="10" />',
  notes: '<path d="M4 4h16v16H4z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" />',
};

const TABS = [
  { id: "home", label: "home" },
  { id: "run", label: "running" },
  { id: "lift", label: "legs" },
  { id: "notes", label: "notes" },
];

function renderNav() {
  clear(bottomNav);
  TABS.forEach((t) => {
    const btn = el(
      "button",
      {
        class: "nav-btn" + (currentPage === t.id ? " active" : ""),
        onclick: () => goTo(t.id),
      },
      [
        el("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", html: NAV_ICONS[t.id] }),
        t.label,
      ]
    );
    bottomNav.appendChild(btn);
  });
}

function goTo(page) {
  currentPage = page;
  render();
}

function render() {
  clear(pageContent);
  renderNav();
  if (currentPage === "home") renderDashboard(pageContent);
  if (currentPage === "run") renderRunningPage(pageContent);
  if (currentPage === "lift") renderLiftingPage(pageContent);
  if (currentPage === "notes") renderNotesPage(pageContent);
}

// ---------- Dashboard ----------

function renderDashboard(root) {
  const { runsThisWeek, liftsThisWeek, totalDist } = weekTotals(state.runs, state.liftSessions);
  const uniqueRunTypes = [...new Set(state.runs.map((r) => r.type))];
  const nextRun = uniqueRunTypes.length ? nextRunTarget(state.runs, uniqueRunTypes[0]) : null;
  const uniqueExercises = [...new Set(state.liftSessions.flatMap((s) => s.exercises.map((e) => e.exercise)))];
  const nextLift = uniqueExercises.length ? nextLiftTarget(state.liftSessions, uniqueExercises[0]) : null;

  root.appendChild(el("h1", { class: "page-title" }, "this week"));

  // Stats card
  const statsCard = el("div", { class: "card" });
  const statsRow = el("div", { class: "stat-row" }, [
    el("div", {}, [
      el("div", { class: "big-stat-value accent" }, `${totalDist.toFixed(1)} km`),
      el("div", { class: "big-stat-label" }, "total run distance"),
    ]),
    el("div", {}, [
      el("div", { class: "big-stat-value" }, String(runsThisWeek.length)),
      el("div", { class: "big-stat-label" }, "runs logged"),
    ]),
    el("div", {}, [
      el("div", { class: "big-stat-value" }, String(liftsThisWeek.length)),
      el("div", { class: "big-stat-label" }, "lift sessions"),
    ]),
  ]);
  statsCard.appendChild(statsRow);
  root.appendChild(statsCard);

  // Up next card
  root.appendChild(el("div", { class: "section-label" }, "up next"));
  const upNextCard = el("div", { class: "card" });

  const runRow = el("div", { class: "row-between", style: "margin-bottom: 10px;" }, [
    el("div", {}, [
      el("div", { style: "font-size:14px; font-weight:600;" }, `${nextRun ? nextRun.type : "no runs yet"} run`),
      el("div", { style: "font-size:12px; color: var(--text-dim);" }, nextRun ? `last: ${nextRun.lastDistance} km` : "log your first run"),
    ]),
    nextRun ? el("span", { class: "pill" }, `target ${nextRun.suggestedDistance} km`) : null,
  ]);
  upNextCard.appendChild(runRow);
  upNextCard.appendChild(el("div", { class: "divider" }));

  const liftRow = el("div", { class: "row-between" }, [
    el("div", {}, [
      el("div", { style: "font-size:14px; font-weight:600;" }, nextLift ? nextLift.exercise : "no lifts yet"),
      el("div", { style: "font-size:12px; color: var(--text-dim);" }, nextLift ? `last: ${nextLift.lastReps} reps @ ${nextLift.lastWeight}kg` : "-"),
    ]),
    nextLift ? el("span", { class: "pill" }, `target ${nextLift.suggestedReps} reps`) : null,
  ]);
  upNextCard.appendChild(liftRow);
  root.appendChild(upNextCard);

  // Recent numbers
  root.appendChild(el("div", { class: "section-label" }, "recent numbers"));
  const recentCard = el("div", { class: "card" });
  state.runs.slice(0, 3).forEach((r) => {
    recentCard.appendChild(
      el("div", { style: "display:flex; justify-content:space-between; padding:6px 0; font-size:13px;" }, [
        el("span", { style: "color: var(--text-dim);" }, `${formatDate(r.date)} · ${r.type}`),
        el("span", { style: "font-variant-numeric: tabular-nums;" }, `${r.distance} km · ${paceMinPerKm(r.distance, r.minutes)}/km`),
      ])
    );
  });
  if (state.runs.length === 0) {
    recentCard.appendChild(el("div", { style: "font-size:13px; color: var(--text-dim);" }, "no runs logged yet"));
  }
  root.appendChild(recentCard);

  // Quick actions
  const btnRow = el("div", { class: "btn-row" }, [
    el("button", { class: "btn-primary", onclick: () => goTo("run") }, "log a run"),
    el("button", { class: "btn-primary btn-secondary", onclick: () => goTo("lift") }, "log a lift"),
  ]);
  root.appendChild(btnRow);
}

// ---------- Running page ----------

let runFormOpen = false;
let runFormType = null;
let runFormUseSets = false;
let runFormSets = [{ distance: "", minutes: "", restMinutes: "" }];
let runFormDistance = "";
let runFormMinutes = "";
let runFormNotes = "";

function resetRunForm() {
  runFormOpen = false;
  runFormType = state.runTypes[0];
  runFormUseSets = false;
  runFormSets = [{ distance: "", minutes: "", restMinutes: "" }];
  runFormDistance = "";
  runFormMinutes = "";
  runFormNotes = "";
}
resetRunForm();

function renderRunningPage(root) {
  const targets = state.runTypes.map((t) => nextRunTarget(state.runs, t)).filter(Boolean);

  root.appendChild(el("h1", { class: "page-title" }, "running"));

  if (targets.length > 0) {
    root.appendChild(el("div", { class: "section-label" }, "suggested targets"));
    const card = el("div", { class: "card" });
    targets.forEach((t) => {
      card.appendChild(
        el("div", { class: "row-between", style: "padding:6px 0;" }, [
          el("span", { style: "font-size:14px;" }, t.type),
          el("span", { class: "pill" }, `${t.suggestedDistance} km`),
        ])
      );
    });
    root.appendChild(card);
  }

  if (!runFormOpen) {
    root.appendChild(el("button", { class: "btn-primary", onclick: () => { runFormOpen = true; render(); } }, "log a run"));
  } else {
    root.appendChild(buildRunForm());
  }

  root.appendChild(el("div", { class: "section-label" }, "history"));
  state.runs.forEach((r) => {
    const card = el("div", { class: "card history-item" });
    card.appendChild(
      el("div", { class: "row-between" }, [
        el("div", {}, [
          el("div", { class: "history-item-title" }, r.type),
          el("div", { class: "history-item-meta" }, `${formatDate(r.date)}${r.notes ? " · " + r.notes : ""}`),
        ]),
        el("div", { style: "text-align:right;" }, [
          el("div", { class: "history-item-value" }, `${r.distance} km`),
          el("div", { class: "history-item-meta" }, `${paceMinPerKm(r.distance, r.minutes)}/km`),
        ]),
      ])
    );
    if (r.sets && r.sets.length > 0) {
      const block = el("div", { class: "run-sets-block" });
      block.appendChild(el("div", { class: "label" }, `${r.sets.length} sets`));
      r.sets.forEach((s, i) => {
        block.appendChild(
          el("div", { class: "run-set-line" }, [
            el("span", {}, `set ${i + 1}`),
            el("span", { style: "font-variant-numeric: tabular-nums;" }, `${s.distance} km · ${s.minutes} min${s.restMinutes ? ` · rest ${s.restMinutes} min` : ""}`),
          ])
        );
      });
      card.appendChild(block);
    }
    root.appendChild(card);
  });
  if (state.runs.length === 0) {
    root.appendChild(el("div", { style: "font-size:13px; color: var(--text-dim);" }, "no runs logged yet"));
  }
}

function buildRunForm() {
  const card = el("div", { class: "card" });

  card.appendChild(
    buildSelectWithAdd({
      label: "type",
      options: state.runTypes,
      value: runFormType,
      onChange: (v) => { runFormType = v; render(); },
      onAdd: (name) => {
        if (!state.runTypes.includes(name)) state.runTypes.push(name);
        runFormType = name;
        saveState();
        render();
      },
      placeholder: "e.g. tempo, recovery, trail",
    })
  );

  const checkboxRow = el(
    "div",
    { class: "checkbox-row", onclick: () => { runFormUseSets = !runFormUseSets; render(); } },
    [
      el("div", { class: "checkbox-box" + (runFormUseSets ? " checked" : "") }),
      el("span", { class: "checkbox-label" }, "log by sets (intervals, pyramid, ladder)"),
    ]
  );
  card.appendChild(checkboxRow);

  if (runFormUseSets) {
    runFormSets.forEach((s, i) => {
      const row = el("div", { class: "set-row" }, [
        buildField(`set ${i + 1} · km`, el("input", {
          inputmode: "decimal", value: s.distance, placeholder: "0.4",
          oninput: (e) => { runFormSets[i].distance = e.target.value; updateSetsTotalDisplay(); },
        })),
        buildField("time (min)", el("input", {
          inputmode: "decimal", value: s.minutes, placeholder: "1.5",
          oninput: (e) => { runFormSets[i].minutes = e.target.value; updateSetsTotalDisplay(); },
        })),
        buildField("rest (min)", el("input", {
          inputmode: "decimal", value: s.restMinutes, placeholder: "1",
          oninput: (e) => { runFormSets[i].restMinutes = e.target.value; },
        })),
      ]);
      if (runFormSets.length > 1) {
        row.appendChild(el("button", { class: "remove-btn", onclick: () => { runFormSets.splice(i, 1); render(); } }, "×"));
      }
      card.appendChild(row);
    });
    card.appendChild(
      el("button", {
        class: "btn-ghost", style: "margin-bottom:12px;",
        onclick: () => { runFormSets.push({ distance: "", minutes: "", restMinutes: "" }); render(); },
      }, "+ add set")
    );
    const totalRow = el("div", { class: "sets-total-row", id: "sets-total-row" });
    card.appendChild(totalRow);
    updateSetsTotalDisplay(totalRow);
  } else {
    card.appendChild(buildField("distance (km)", el("input", {
      inputmode: "decimal", value: runFormDistance, placeholder: "5.0",
      oninput: (e) => { runFormDistance = e.target.value; },
    })));
    card.appendChild(buildField("time (minutes)", el("input", {
      inputmode: "decimal", value: runFormMinutes, placeholder: "28",
      oninput: (e) => { runFormMinutes = e.target.value; },
    })));
  }

  card.appendChild(buildField("notes", el("input", {
    value: runFormNotes, placeholder: "how did it feel?",
    oninput: (e) => { runFormNotes = e.target.value; },
  })));

  card.appendChild(
    el("div", { class: "btn-row" }, [
      el("button", { class: "btn-primary", onclick: submitRun }, "save run"),
      el("button", { class: "btn-ghost", onclick: () => { resetRunForm(); render(); } }, "cancel"),
    ])
  );

  return card;
}

function updateSetsTotalDisplay(node) {
  const totalDistance = runFormSets.reduce((s, set) => s + (parseFloat(set.distance) || 0), 0);
  const totalMinutes = runFormSets.reduce((s, set) => s + (parseFloat(set.minutes) || 0), 0);
  const target = node || document.getElementById("sets-total-row");
  if (!target) return;
  clear(target);
  target.appendChild(el("span", {}, `total distance: ${totalDistance.toFixed(2)} km`));
  target.appendChild(el("span", {}, `total time: ${totalMinutes.toFixed(1)} min`));
}

function submitRun() {
  const useSets = runFormUseSets;
  const totalDistance = useSets
    ? runFormSets.reduce((s, set) => s + (parseFloat(set.distance) || 0), 0)
    : parseFloat(runFormDistance);
  const totalMinutes = useSets
    ? runFormSets.reduce((s, set) => s + (parseFloat(set.minutes) || 0), 0)
    : parseFloat(runFormMinutes);

  if (!totalDistance || !totalMinutes) return;

  const entry = {
    id: "r" + Date.now(),
    date: todayStr(),
    type: runFormType,
    distance: Math.round(totalDistance * 100) / 100,
    minutes: Math.round(totalMinutes * 100) / 100,
    notes: runFormNotes,
    sets: useSets
      ? runFormSets
          .filter((s) => s.distance || s.minutes)
          .map((s) => ({
            distance: parseFloat(s.distance) || 0,
            minutes: parseFloat(s.minutes) || 0,
            restMinutes: parseFloat(s.restMinutes) || 0,
          }))
      : null,
  };

  state.runs.unshift(entry);
  saveState();
  resetRunForm();
  render();
}

// ---------- Lifting page ----------

let liftFormOpen = false;
let liftDraftExercises = [];
let liftSessionNotes = "";
let liftFormExercise = null;
let liftFormSets = "";
let liftFormReps = "";
let liftFormWeight = "";

function resetLiftForm() {
  liftFormOpen = false;
  liftDraftExercises = [];
  liftSessionNotes = "";
  liftFormExercise = state.exercises[0];
  liftFormSets = "";
  liftFormReps = "";
  liftFormWeight = "";
}
resetLiftForm();

function renderLiftingPage(root) {
  const uniqueExercises = [...new Set(state.liftSessions.flatMap((s) => s.exercises.map((e) => e.exercise)))];
  const targets = uniqueExercises.map((ex) => nextLiftTarget(state.liftSessions, ex)).filter(Boolean);

  root.appendChild(el("h1", { class: "page-title" }, "leg workouts"));

  if (targets.length > 0) {
    root.appendChild(el("div", { class: "section-label" }, "suggested targets"));
    const card = el("div", { class: "card" });
    targets.forEach((t) => {
      card.appendChild(
        el("div", { class: "row-between", style: "padding:6px 0;" }, [
          el("span", { style: "font-size:14px;" }, t.exercise),
          el("span", { class: "pill" }, `${t.suggestedReps} reps`),
        ])
      );
    });
    root.appendChild(card);
  }

  if (!liftFormOpen) {
    root.appendChild(el("button", { class: "btn-primary", onclick: () => { liftFormOpen = true; render(); } }, "log a workout"));
  } else {
    root.appendChild(buildLiftForm());
  }

  root.appendChild(el("div", { class: "section-label" }, "history"));
  state.liftSessions.forEach((s) => {
    const card = el("div", { class: "card history-item" });
    card.appendChild(el("div", { class: "history-item-meta", style: "margin-bottom:8px;" }, `${formatDate(s.date)}${s.notes ? " · " + s.notes : ""}`));
    s.exercises.forEach((e) => {
      card.appendChild(
        el("div", { class: "session-history-exercise" }, [
          el("span", {}, e.exercise),
          el("span", { class: "value" }, `${e.sets} × ${e.reps}${e.weight ? ` · ${e.weight} kg` : " · bodyweight"}`),
        ])
      );
    });
    root.appendChild(card);
  });
  if (state.liftSessions.length === 0) {
    root.appendChild(el("div", { style: "font-size:13px; color: var(--text-dim);" }, "no workouts logged yet"));
  }
}

function buildLiftForm() {
  const card = el("div", { class: "card" });

  if (liftDraftExercises.length > 0) {
    const wrap = el("div", { style: "margin-bottom:14px;" });
    liftDraftExercises.forEach((e, i) => {
      wrap.appendChild(
        el("div", { class: "draft-exercise-row" }, [
          el("div", {}, [
            el("div", { style: "font-size:14px; font-weight:600;" }, e.exercise),
            el("div", { style: "font-size:12px; color: var(--text-dim);" }, `${e.sets} × ${e.reps}${e.weight ? ` · ${e.weight} kg` : ""}`),
          ]),
          el("button", { class: "remove-btn", onclick: () => { liftDraftExercises.splice(i, 1); render(); } }, "×"),
        ])
      );
    });
    card.appendChild(wrap);
  }

  card.appendChild(
    buildSelectWithAdd({
      label: "exercise",
      options: state.exercises,
      value: liftFormExercise,
      onChange: (v) => { liftFormExercise = v; render(); },
      onAdd: (name) => {
        if (!state.exercises.includes(name)) state.exercises.push(name);
        liftFormExercise = name;
        saveState();
        render();
      },
      placeholder: "e.g. step-up, nordic curl",
    })
  );

  const currentTarget = nextLiftTarget(state.liftSessions, liftFormExercise);
  if (currentTarget) {
    card.appendChild(
      el("div", { style: "margin-bottom:10px;" }, [
        el("span", { class: "pill" }, `target ${currentTarget.suggestedReps} reps · last ${currentTarget.lastReps} @ ${currentTarget.lastWeight}kg`),
      ])
    );
  }

  const row = el("div", { style: "display:flex; gap:8px;" }, [
    buildField("sets", el("input", { inputmode: "numeric", value: liftFormSets, placeholder: "4", oninput: (e) => { liftFormSets = e.target.value; } })),
    buildField("reps", el("input", { inputmode: "numeric", value: liftFormReps, placeholder: "8", oninput: (e) => { liftFormReps = e.target.value; } })),
    buildField("weight (kg)", el("input", { inputmode: "decimal", value: liftFormWeight, placeholder: "60", oninput: (e) => { liftFormWeight = e.target.value; } })),
  ]);
  card.appendChild(row);

  card.appendChild(
    el("button", { class: "btn-ghost", style: "margin-bottom:14px;", onclick: addExerciseToDraft }, "+ add exercise to workout")
  );

  card.appendChild(buildField("notes", el("input", {
    value: liftSessionNotes, placeholder: "how did it feel?",
    oninput: (e) => { liftSessionNotes = e.target.value; },
  })));

  card.appendChild(
    el("div", { class: "btn-row" }, [
      el("button", { class: "btn-primary", onclick: saveLiftSession }, "save workout"),
      el("button", { class: "btn-ghost", onclick: () => { resetLiftForm(); render(); } }, "cancel"),
    ])
  );

  return card;
}

function addExerciseToDraft() {
  if (!liftFormSets || !liftFormReps) return;
  liftDraftExercises.push({
    exercise: liftFormExercise,
    sets: parseInt(liftFormSets),
    reps: parseInt(liftFormReps),
    weight: liftFormWeight ? parseFloat(liftFormWeight) : 0,
  });
  liftFormSets = "";
  liftFormReps = "";
  liftFormWeight = "";
  render();
}

function saveLiftSession() {
  if (liftDraftExercises.length === 0) return;
  const entry = {
    id: "ls" + Date.now(),
    date: todayStr(),
    notes: liftSessionNotes,
    exercises: liftDraftExercises,
  };
  state.liftSessions.unshift(entry);
  saveState();
  resetLiftForm();
  render();
}

// ---------- Notes page ----------

let noteFormOpen = false;
let noteFormTitle = "";
let noteFormBody = "";
let noteEditingId = null;

function resetNoteForm() {
  noteFormOpen = false;
  noteFormTitle = "";
  noteFormBody = "";
  noteEditingId = null;
}

function renderNotesPage(root) {
  root.appendChild(el("h1", { class: "page-title" }, "notes & plans"));

  if (!noteFormOpen) {
    root.appendChild(el("button", { class: "btn-primary", onclick: () => { noteFormOpen = true; render(); } }, "add a note"));
  } else {
    const card = el("div", { class: "card" });
    card.appendChild(buildField("title", el("input", {
      value: noteFormTitle, placeholder: "e.g. squat form cues",
      oninput: (e) => { noteFormTitle = e.target.value; },
    })));
    card.appendChild(buildField("notes", el("textarea", {
      placeholder: "write anything you want to remember...",
      oninput: (e) => { noteFormBody = e.target.value; },
    }, noteFormBody)));
    card.appendChild(
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn-primary", onclick: submitNote }, noteEditingId ? "update note" : "save note"),
        el("button", { class: "btn-ghost", onclick: () => { resetNoteForm(); render(); } }, "cancel"),
      ])
    );
    root.appendChild(card);
  }

  const listWrap = el("div", { style: "margin-top:16px;" });
  state.notes.forEach((n) => {
    const card = el("div", { class: "card" });
    card.appendChild(
      el("div", { class: "note-card-header" }, [
        el("div", { style: "font-size:14px; font-weight:600;" }, n.title),
        el("div", { class: "note-actions" }, [
          el("button", { onclick: () => startEditNote(n) }, "edit"),
          el("button", { onclick: () => deleteNote(n.id) }, "delete"),
        ]),
      ])
    );
    card.appendChild(el("div", { class: "note-body" }, n.body));
    listWrap.appendChild(card);
  });
  root.appendChild(listWrap);
}

function submitNote() {
  const title = noteFormTitle.trim();
  if (!title) return;
  if (noteEditingId) {
    const n = state.notes.find((x) => x.id === noteEditingId);
    if (n) { n.title = title; n.body = noteFormBody; }
  } else {
    state.notes.unshift({ id: "n" + Date.now(), title, body: noteFormBody });
  }
  saveState();
  resetNoteForm();
  render();
}

function startEditNote(n) {
  noteFormTitle = n.title;
  noteFormBody = n.body;
  noteEditingId = n.id;
  noteFormOpen = true;
  render();
}

function deleteNote(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  saveState();
  render();
}

// ---------- Shared form helpers ----------

function buildField(label, inputNode) {
  return el("div", { class: "field" }, [
    el("div", { class: "field-label" }, label),
    inputNode,
  ]);
}

const ADD_NEW_VALUE = "__add_new__";
let selectAddingState = {};

function buildSelectWithAdd({ label, options, value, onChange, onAdd, placeholder }) {
  const key = label;
  if (selectAddingState[key]) {
    const input = el("input", { autofocus: "true", placeholder, value: selectAddingState[key + "_draft"] || "" });
    input.addEventListener("input", (e) => { selectAddingState[key + "_draft"] = e.target.value; });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmAdd();
      if (e.key === "Escape") { selectAddingState[key] = false; render(); }
    });
    const confirmAdd = () => {
      const name = (selectAddingState[key + "_draft"] || "").trim();
      selectAddingState[key] = false;
      selectAddingState[key + "_draft"] = "";
      if (!name) { render(); return; }
      onAdd(name);
    };
    const addBtn = el("button", { onclick: confirmAdd }, "add");
    return el("div", { class: "field" }, [
      el("div", { class: "field-label" }, label),
      el("div", { class: "add-select-input-row" }, [input, addBtn]),
    ]);
  }

  const select = el("select", {
    onchange: (e) => {
      if (e.target.value === ADD_NEW_VALUE) {
        selectAddingState[key] = true;
        selectAddingState[key + "_draft"] = "";
        render();
      } else {
        onChange(e.target.value);
      }
    },
  });
  options.forEach((opt) => {
    const o = el("option", { value: opt }, opt);
    if (opt === value) o.setAttribute("selected", "true");
    select.appendChild(o);
  });
  select.appendChild(el("option", { value: ADD_NEW_VALUE }, "+ add new..."));

  return el("div", { class: "field" }, [
    el("div", { class: "field-label" }, label),
    select,
  ]);
}

// ---------- Init ----------

render();

// Register service worker for offline + installability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error("SW registration failed", e));
  });
}
