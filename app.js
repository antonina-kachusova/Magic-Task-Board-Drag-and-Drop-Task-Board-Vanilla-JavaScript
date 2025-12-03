const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const STORE_KEY = 'kanban.board.v2';
const COLUMNS = ['Start', 'Progress', 'Done'];

const THEME_KEY = 'kanban.theme';

function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

function setTheme(v) {
  try {
    localStorage.setItem(THEME_KEY, v);
  } catch { }
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
  }
}

const AUTO_SORT_KEY = 'kanban.autosort';

function isAutoSort() {
  try {
    return localStorage.getItem(AUTO_SORT_KEY) === '1';
  } catch {
    return false;
  }
}

function setAutoSort(v) {
  try {
    localStorage.setItem(AUTO_SORT_KEY, v ? '1' : '0');
  } catch { }
}


const Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return {
        Start: [],
        Progress: [],
        Done: []
      };
      const d = JSON.parse(raw);
      for (const c of COLUMNS) d[c] ||=[];
      return d;
    } catch (e) {
      return {
        Start: [],
        Progress: [],
        Done: []
      };
    }
  },
  save(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(STORE_KEY);
  }
};

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);


// ----- Priority helpers & sorting
function priorityRank(p) {
  return p === 'high' ? 0 : p === 'med' ? 1 : 2;
}

function sortPlace(place) {
  const items = [...place.querySelectorAll('.item')];
  items.sort((a, b) => priorityRank(a.dataset.priority || 'low') - priorityRank(b.dataset.priority || 'low'));
  items.forEach(n => place.appendChild(n));
}

function sortAll() {
  $$('.place').forEach(sortPlace);
}

// ----- Clamp helpers
function needsClamp(titleEl) {
  const was = titleEl.classList.contains('clamp-4');
  titleEl.classList.add('clamp-4');
  const over = titleEl.scrollHeight > titleEl.clientHeight + 1;
  if (!was) titleEl.classList.remove('clamp-4');
  return over;
}

function applyClamp(node) {
  const title = node.querySelector('.title');
  const btn = node.querySelector('.show-more');
  if (!title || !btn) return;
  const show = needsClamp(title);
  btn.style.display = show ? 'inline-block' : 'none';
  if (show && !btn.dataset.expanded) title.classList.add('clamp-4');
}

// ----- DnD
let dragged = null;
let dropIndicator = document.createElement('div');
dropIndicator.className = 'drop-indicator';

function addDragHandlers(node) {
  node.addEventListener('dragstart', (e) => {
    dragged = node;
    node.classList.add('dragging', 'hold');
    node.setAttribute('aria-grabbed', 'true');
    e.dataTransfer.setData('text/plain', node.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  node.addEventListener('dragend', () => {
    node.classList.remove('dragging', 'hold');
    node.setAttribute('aria-grabbed', 'false');
    dragged = null;
    removeDropIndicator();
    Board.syncFromDOMandSave();
  });
}

function removeDropIndicator() {
  if (dropIndicator.parentElement) dropIndicator.parentElement.removeChild(dropIndicator);
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return {
        offset,
        element: child
      };
    }
    return closest;
  }, {
    offset: Number.NEGATIVE_INFINITY
  }).element;
}

function handlePlaceDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const place = e.currentTarget;
  place.classList.add('hovered');
  const after = getDragAfterElement(place, e.clientY);
  if (after == null) place.appendChild(dropIndicator);
  else place.insertBefore(dropIndicator, after);
}

function handlePlaceDragEnter(e) {
  e.currentTarget.classList.add('hovered');
}

function handlePlaceDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('hovered');
}

function handlePlaceDrop(e) {
  e.preventDefault();
  const place = e.currentTarget;
  place.classList.remove('hovered');
  if (!dragged) return;
  const after = getDragAfterElement(place, e.clientY);
  if (after == null) place.appendChild(dragged);
  else place.insertBefore(dragged, after);
  removeDropIndicator();
  if (isAutoSort()) sortPlace(place);
}

// ----- UI
function renderBadgePriority(p) {
  const span = document.createElement('span');
  span.className = `badge priority-${p === 'high' ? 'high' : p === 'med' ? 'med' : 'low'}`;
  span.textContent = p === 'high' ? 'High' : p === 'med' ? 'Med' : 'Low';
  span.title = 'Click to change priority';
  return span;
}

function cyclePriority(p) {
  return p === 'low' ? 'med' : p === 'med' ? 'high' : 'low';
}

function setPriorityOnNode(node, p) {
  const badges = node.querySelector('.badges');
  badges.innerHTML = '';
  badges.append(renderBadgePriority(p));
  node.dataset.priority = p;
}

const template = $('#item-template');

function makeItemNode(item) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.dataset.priority = item.priority || 'low';
  const title = node.querySelector('.title');
  title.textContent = item.title;
  const badgesBox = node.querySelector('.badges');
  badgesBox.append(renderBadgePriority(item.priority || 'low'));

  // Show more/less
  const btnMore = node.querySelector('.show-more');
  btnMore.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const liveTitle = node.querySelector('.title');
    const expanded = btnMore.dataset.expanded === '1';
    if (expanded) {
      liveTitle.classList.add('clamp-4');
      btnMore.textContent = 'Show more';
      btnMore.dataset.expanded = '';
    } else {
      liveTitle.classList.remove('clamp-4');
      btnMore.textContent = 'Show less';
      btnMore.dataset.expanded = '1';
    }
  });
  queueMicrotask(() => applyClamp(node));

  // Badge click to cycle
  badgesBox.addEventListener('click', () => {
    const current = node.dataset.priority || 'low';
    const next = cyclePriority(current);
    setPriorityOnNode(node, next);
    if (isAutoSort()) sortPlace(node.closest('.place'));
    Board.syncFromDOMandSave();
  });

  // Actions
  node.querySelector('.delete').addEventListener('click', () => {
    if (confirm('Delete this task?')) {
      node.remove();
      Board.syncFromDOMandSave();
    }
  });
  node.addEventListener('dblclick', () => editItemInline(node));
  node.querySelector('.edit').addEventListener('click', () => editItemInline(node));

  // DnD
  node.draggable = true;
  addDragHandlers(node);
  return node;
}

function editItemInline(node) {
  const titleSpan = node.querySelector('.title');
  const old = titleSpan.textContent;
  const ta = document.createElement('textarea');
  ta.className = 'inline-edit';
  ta.rows = 2;
  ta.value = old;
  titleSpan.replaceWith(ta);
  ta.focus();
  ta.select();
  const finish = (commit) => {
    const val = commit ? ta.value.trim() : old;
    const span = document.createElement('span');
    span.className = 'title clamp-4';
    span.textContent = val || old;
    ta.replaceWith(span);
    const btn = node.querySelector('.show-more');
    if (btn) {
      btn.dataset.expanded = '';
      btn.textContent = 'Show more';
    }
    applyClamp(node);
    Board.syncFromDOMandSave();
  };
  ta.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter') && (e.ctrlKey || e.metaKey)) finish(true);
    if (e.key === 'Escape') finish(false);
  });
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
  ta.dispatchEvent(new Event('input'));
  ta.addEventListener('blur', () => finish(true));
}

// ----- Board
const Board = {
  init() {
    const state = Store.load();
    // THEME: init & bind
    applyTheme(getTheme());
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
        applyTheme(next);
        setTheme(next);
      });
    }

    const places = $$('.place');
    COLUMNS.forEach((col, i) => {
      const place = places[i];
      place.dataset.col = col;
      place.addEventListener('dragover', handlePlaceDragOver);
      place.addEventListener('dragenter', handlePlaceDragEnter);
      place.addEventListener('dragleave', handlePlaceDragLeave);
      place.addEventListener('drop', handlePlaceDrop);
      for (const it of state[col]) place.appendChild(makeItemNode(it));
    });
    // demo if empty
    if (COLUMNS.every(c => state[c].length === 0)) {
      places[0].append(
        makeItemNode({
          id: uid(),
          title: 'Try to drag me',
          priority: 'med',
          createdAt: Date.now()
        }),
        makeItemNode({
          id: uid(),
          title: 'Double‑click — edit',
          priority: 'low',
          createdAt: Date.now()
        }),
      );
    }
    if (isAutoSort()) sortAll();
    this.updateCounts();

    // init sort toggle UI
    const toggle = $('#sort-toggle');
    if (toggle) {
      const on = isAutoSort();
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.textContent = 'Auto sort: ' + (on ? 'on' : 'off');
      toggle.addEventListener('click', () => {
        const now = !isAutoSort();
        setAutoSort(now);
        toggle.setAttribute('aria-pressed', now ? 'true' : 'false');
        toggle.textContent = 'Auto sort: ' + (now ? 'on' : 'off');
        if (now) sortAll();
        Board.syncFromDOMandSave();
      });
    }

    // form
    $('#new-task').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#title').value.trim();
      if (!title) return;
      const priority = $('#priority').value || 'low';
      const item = {
        id: uid(),
        title,
        priority,
        createdAt: Date.now()
      };
      const node = makeItemNode(item);
      places[0].appendChild(node);
      if (isAutoSort()) sortPlace(places[0]);
      $('#title').value = '';
      this.syncFromDOMandSave();
    });

    // export/import/clear
    $('#export-btn').addEventListener('click', () => {
      sortAll();
      const data = this.readFromDOM();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kanban-board.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    $('#import-btn').addEventListener('click', () => $('#import-input').click());
    $('#import-input').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        this.renderState(data);
        Store.save(data);
      } catch {
        alert('Failed to import JSON');
      } finally {
        e.target.value = '';
      }
    });
    $('#clear-btn').addEventListener('click', () => {
      if (confirm('Clear the entire board?')) {
        Store.clear();
        this.renderState({
          Start: [],
          Progress: [],
          Done: []
        });
      }
    });
  },
  renderState(state) {
    const places = $$('.place');
    places.forEach(p => p.innerHTML = '');
    COLUMNS.forEach((col, i) => {
      const place = places[i];
      for (const it of state[col] || []) place.appendChild(makeItemNode(it));
      if (isAutoSort()) sortPlace(place);
    });
    this.updateCounts();
  },
  readFromDOM() {
    const state = {
      Start: [],
      Progress: [],
      Done: []
    };
    const places = $$('.place');
    COLUMNS.forEach((col, i) => {
      const items = [...places[i].querySelectorAll('.item')].map(el => ({
        id: el.dataset.id,
        title: el.querySelector('.title')?.textContent || '',
        priority: el.dataset.priority || 'low',
        createdAt: Date.now()
      }));
      state[col] = items;
    });
    return state;
  },
  syncFromDOMandSave() {
    if (isAutoSort()) sortAll();
    const state = this.readFromDOM();
    Store.save(state);
    this.updateCounts();
  },
  updateCounts() {
    $$('.column').forEach(col => col.querySelector('.count').textContent = col.querySelectorAll('.item').length);
  }
};

window.addEventListener('DOMContentLoaded', () => Board.init());
