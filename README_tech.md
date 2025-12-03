## Magic Task Board — Tech Highlights (EN) ##

A lightweight visual task board with drag-and-drop, priorities, dark/light theme, inline editing, JSON export/import, and persistent storage in the browser. No frameworks, no backend.

# Core engineering #

HTML5 Drag & Drop with precise insertion

Custom “drop indicator” and insertion algorithm: for a given mouse Y, compute offset = y - (top + height/2) across non-dragging cards and insert before the closest negative offset.

Events: dragstart, dragover + preventDefault, drop, dragend.

Keeps DOM and state in sync after every mutation.

Client-side state & persistence

Board state serialized as { Start: Item[], Progress: Item[], Done: Item[] }.

LocalStorage module with load/save/clear and safe try/catch.

DOM ⇄ JSON reconciliation via readFromDOM() (one source of truth).

Priority system + optional auto-sort

Badge cycles Low → Med → High; priority stored in data-*.

Stable comparator priorityRank(high=0, med=1, low=2).

Toggleable auto-sort (on/off). When enabled, columns reorder High → Med → Low after create, drop, or priority change; when off, manual order is preserved.

Dark/Light theme with CSS variables

Toggle sets document.documentElement.classList.toggle('light', …).

Theme preference persisted in LocalStorage.

Multi-line preview (“line-clamp”) with reliable expand/collapse

CSS -webkit-line-clamp (4 lines) for multi-line truncation.

JS overflow detection (scrollHeight vs clientHeight) shows/hides “Show more / less”.

Handlers re-query the live .title node after inline edits to avoid stale references.

Inline editing UX

Replace title with textarea, auto-resize via scrollHeight.

Shortcuts: Ctrl/Cmd + Enter to save, Esc to cancel.

Post-edit: re-apply clamp & persist.

Data portability

Export: JSON.stringify → Blob → URL.createObjectURL → <a download>.

Import: File.text() → JSON.parse() → render & persist.

Example JSON included.

Responsive & mobile-friendly

CSS grid collapses to one column at ≤840px, centered layout, larger hit targets.

(Optional) Pointer Events long-press DnD for touch devices.

Accessibility & micro-interactions

ARIA states (aria-grabbed), live counters, titles/tooltips.

One shared drop indicator to minimize layout thrash.

# Why it matters #

Shows ability to design UI behavior from first principles (DnD insertion math, overflow detection, DOM/state reconciliation) without reaching for a framework.

Demonstrates clean state management, progressive enhancement (theme, auto-sort), and robust UX (editing shortcuts, truncation with expand).

Production-adjacent concerns: error handling, persistence, import/export, responsive design.
