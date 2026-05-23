# Gamescape — Design Decisions

---

## Work Items & Structure

**Types of work items:** Milestones, Design Docs, Tasks, Subtasks

**Hierarchy:**
- Tasks can exist free-floating (no required Milestone)
- Design Docs must be associated with a Milestone
- Subtasks belong to any object type (Milestone, Task, Design Doc)

**Subtasks:** Simple text + checkbox only. No priority/tags/status. Any object can have subtasks. A completion bar appears on the parent object only once at least one subtask exists.

**Common fields (all object types):** Priority, tags/labels, status, description

**Design Doc extra field:** Implementation — value is either `Optional` or `Required`

**Status values:** New, In Progress, On Hold, Rejected, Closed

**File format:** JSON (one file per work item, human-readable)

---

## Relations & Blocking

**Relation types:** "Blocked By" or "Related To" (configurable per link)

**Blocking enforcement:** A blocked object cannot move to Closed while its blocker is unresolved

**Milestone completion %:** Auto-calculated from child tasks

---

## Views

**Views:** Folder/tree view (like VSCode explorer, filterable by object type and status) + Kanban

**Kanban columns:** Configurable per project. Default columns match status field: New → In Progress → On Hold → Rejected → Closed

**Kanban shows:** All object types

---

## Storage Format

**Format:** One JSON file per work item, human-readable

---

## Multi-Project

**Multi-project:** Yes — multiple projects manageable side-by-side

---

## Look & Feel

**Aesthetic:** Terminal style — monospace font, green-on-black primarily, other colors mixed in

**Animations:** Confetti on closing out an object, other fun touches as appropriate

**Hyperlinking:** Objects must be linkable to each other within the tool

**Object IDs:** Every object has a unique auto-incrementing numeric ID, referenceable as `#1`, `#23`, `#5432`, etc. (global across the project)

---

## Technical

**Stack:** Node.js (dev: `node server.js` or similar), packaged executable for distribution

**Launch:** Runnable via Node during development, distributable as an executable for normal use
