const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Data directory — resolve relative to executable when packaged with pkg
const DATA_DIR = process.env.GAMESCAPE_DATA;
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readProjects() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
}

function writeProjects(projects) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getProjectDir(dataDir) {
  return path.join(DATA_DIR, dataDir);
}

function readItem(projectDir, itemId) {
  const file = path.join(projectDir, `${itemId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeItem(projectDir, item) {
  ensureDir(projectDir);
  fs.writeFileSync(path.join(projectDir, `${item.id}.json`), JSON.stringify(item, null, 2));
}

function deleteItemFile(projectDir, itemId) {
  const file = path.join(projectDir, `${itemId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function readAllItems(projectDir) {
  if (!fs.existsSync(projectDir)) return [];
  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(projectDir, f), 'utf8')));
}

function findProject(id) {
  const projects = readProjects();
  return { projects, project: projects.find(p => String(p.id) === String(id)) };
}

const DEFAULT_COLUMNS = ['New', 'In Progress', 'On Hold', 'Rejected', 'Closed'];

// ── Projects ───────────────────────────────────────────────────────────────

app.get('/api/projects', (req, res) => {
  res.json(readProjects());
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });

  const projects = readProjects();
  const id = Date.now();
  const slug = slugify(name.trim()) + '-' + id;
  const project = {
    id,
    name: name.trim(),
    dataDir: slug,
    kanbanColumns: [...DEFAULT_COLUMNS],
    nextId: 1,
  };
  ensureDir(getProjectDir(slug));
  projects.push(project);
  writeProjects(projects);
  res.status(201).json(project);
});

app.delete('/api/projects/:id', (req, res) => {
  const { projects, project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  const dir = getProjectDir(project.dataDir);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });

  const updated = projects.filter(p => String(p.id) !== String(req.params.id));
  writeProjects(updated);
  res.json({ ok: true });
});

// ── Kanban columns ─────────────────────────────────────────────────────────

app.put('/api/projects/:id/columns', (req, res) => {
  const { columns } = req.body;
  if (!Array.isArray(columns)) return res.status(400).json({ error: 'columns must be an array' });

  const { projects, project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  project.kanbanColumns = columns;
  writeProjects(projects);
  res.json(project);
});

// ── Items ──────────────────────────────────────────────────────────────────

app.get('/api/projects/:id/items', (req, res) => {
  const { project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  let items = readAllItems(getProjectDir(project.dataDir));

  if (req.query.type) {
    items = items.filter(i => i.type === req.query.type);
  }
  if (req.query.status) {
    items = items.filter(i => i.status === req.query.status);
  }

  res.json(items);
});

app.post('/api/projects/:id/items', (req, res) => {
  const { projects, project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  const { type, title } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });

  const id = project.nextId++;
  const now = new Date().toISOString();
  const item = {
    id,
    type,
    title: title.trim(),
    status: req.body.status || 'New',
    priority: req.body.priority || 'Medium',
    tags: req.body.tags || [],
    description: req.body.description || '',
    subtasks: req.body.subtasks || [],
    relations: req.body.relations || [],
    createdAt: now,
    updatedAt: now,
  };

  if (type === 'design_doc') {
    item.implementation = req.body.implementation || 'Optional';
    item.milestoneId = req.body.milestoneId || null;
  }
  if (type === 'task') {
    item.milestoneId = req.body.milestoneId || null;
  }

  writeItem(getProjectDir(project.dataDir), item);
  writeProjects(projects);
  res.status(201).json(item);
});

app.get('/api/projects/:id/items/:itemId', (req, res) => {
  const { project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  const item = readItem(getProjectDir(project.dataDir), req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  res.json(item);
});

app.put('/api/projects/:id/items/:itemId', (req, res) => {
  const { project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  const projectDir = getProjectDir(project.dataDir);
  const existing = readItem(projectDir, req.params.itemId);
  if (!existing) return res.status(404).json({ error: 'item not found' });

  // Blocking rule: cannot close item T if another open item A has a 'blocking' relation pointing at T
  if (req.body.status === 'Closed' && existing.status !== 'Closed') {
    const itemId = existing.id;
    const allItems = readAllItems(projectDir);
    for (const other of allItems) {
      if (other.id === itemId) continue;
      if (other.status === 'Closed') continue;
      const blocksThis = (other.relations || []).some(r => r.type === 'blocking' && r.targetId === itemId);
      if (blocksThis) {
        return res.status(409).json({
          error: `Cannot close: blocked by #${other.id} (${other.title}), which is not yet Closed.`
        });
      }
    }
  }

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    type: existing.type,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  writeItem(projectDir, updated);
  res.json(updated);
});

app.delete('/api/projects/:id/items/:itemId', (req, res) => {
  const { project } = findProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });

  const projectDir = getProjectDir(project.dataDir);
  const existing = readItem(projectDir, req.params.itemId);
  if (!existing) return res.status(404).json({ error: 'item not found' });

  deleteItemFile(projectDir, req.params.itemId);
  res.json({ ok: true });
});

// ── Serve SPA ──────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`Gamescape running at http://localhost:${PORT}`);
});

module.exports = { server, PORT };
