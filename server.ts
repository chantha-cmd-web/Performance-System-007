import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-2026';

// Initialize SQLite DB
const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');

// Setup DB Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    khmerName TEXT,
    campus TEXT,
    department TEXT,
    position TEXT,
    category TEXT,
    supervisorId TEXT,
    supporterId TEXT,
    managementId TEXT,
    evalCondition TEXT,
    evalModel TEXT,
    evalPeriod TEXT,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId TEXT NOT NULL,
    employeeName TEXT NOT NULL,
    campus TEXT NOT NULL,
    position TEXT NOT NULL,
    appraiser TEXT NOT NULL,
    reviewDate TEXT NOT NULL,
    weightScheme TEXT NOT NULL,
    evaluationType TEXT DEFAULT 'management',
    totalSelf REAL NOT NULL,
    totalSuper REAL NOT NULL,
    overallScore REAL NOT NULL,
    createdBy TEXT NOT NULL,
    createdByName TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS criteria_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluationId INTEGER,
    criteriaId INTEGER,
    selfScore REAL,
    superScore REAL,
    supporterScore REAL,
    managementScore REAL,
    aspScore REAL,
    FOREIGN KEY(evaluationId) REFERENCES evaluations(id)
  );

  CREATE TABLE IF NOT EXISTS peer_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluationId INTEGER,
    peerName TEXT,
    feedback TEXT,
    score REAL,
    FOREIGN KEY(evaluationId) REFERENCES evaluations(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE evaluations ADD COLUMN evaluationType TEXT DEFAULT "management"');
} catch (e) {
  // column already exists
}

try { db.exec('ALTER TABLE criteria_scores ADD COLUMN supporterScore REAL DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE criteria_scores ADD COLUMN managementScore REAL DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE criteria_scores ADD COLUMN aspScore REAL DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE evaluations ADD COLUMN evaluatorComments TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE evaluations ADD COLUMN status TEXT DEFAULT "Draft"'); } catch(e) {}
try { db.exec('ALTER TABLE evaluations ADD COLUMN department TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE evaluations ADD COLUMN evalPeriod TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE evaluations ADD COLUMN supporter TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE employees ADD COLUMN managementId TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE employees ADD COLUMN evalCondition TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE employees ADD COLUMN status TEXT DEFAULT "Active"'); } catch(e) {}
try { db.exec('ALTER TABLE employees ADD COLUMN email TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE employees ADD COLUMN role TEXT DEFAULT "user"'); } catch(e) {}

try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN position TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN department TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN campus TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN supervisorId TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN supporterId TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN evalModel TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "Active"'); } catch(e) {}

// Seed Default Users if not exist
const seedUsers = () => {
  const insert = db.prepare('INSERT OR IGNORE INTO users (id, name, password, role) VALUES (?, ?, ?, ?)');
  const superHash = bcrypt.hashSync('super@2026', 10);
  const adminHash = bcrypt.hashSync('admin@123', 10);
  
  insert.run('superadmin', 'Super Administrator', superHash, 'superadmin');
  insert.run('admin', 'Administrator', adminHash, 'admin');
};
seedUsers();

const seedSettings = () => {
  const existing = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('evaluation_config');
  if (!existing) {
    const defaultConfig = {
      types: [
        { id: 'management', label: 'Management / ការគ្រប់គ្រង' },
        { id: 'teacher', label: 'Teacher / គ្រូបង្រៀន' },
        { id: 'operations', label: 'Operations / ប្រតិបត្តិការ' }
      ],
      weightingSchemes: [
        { id: 'campus_60_40', label: 'Direct Supervisor 60% (campus) / Supporter 40% (central)' },
        { id: 'campus_50_50', label: 'Direct Supervisor 50% (campus) / Supporter 50% (central)' },
        { id: 'campus_100', label: 'Direct Supervisor (campus) 100%' },
        { id: 'central_100', label: 'Direct Supervisor 100% (central)' },
        { id: 'management_100', label: 'Management 100%' },
        { id: 'asp_100', label: 'ASP 100%' }
      ],
      criteriaSets: {
        management: [
          { id: 1, kh: 'អាកប្បកិរិយា', khDesc: 'ចំណាប់អារម្មណ៍ និងភាពសាទរ', en: 'Attitude', desc: 'Enthusiasm and dedication', max: 10 },
          { id: 2, kh: 'ចំណេះដឹងការងារ', khDesc: 'ការយល់ដឹងអំពីការងារ', en: 'Job Knowledge', desc: 'Understanding of work and skills', max: 10 },
          { id: 3, kh: 'គំនិតផ្តួចផ្តើម', khDesc: 'ការអភិវឌ្ឍន៍ និងដោះស្រាយបញ្ហា', en: 'Initiative', desc: 'Proactive thinking and development', max: 10 },
          { id: 4, kh: 'ការវិនិច្ឆ័យ និងការយល់ដឹង', khDesc: 'ការសម្រេចចិត្ត', en: 'Judgment and Awareness', desc: 'Problem-solving and decision making', max: 10 },
          { id: 5, kh: 'ការអភិវឌ្ឍន៍បុគ្គលិក', khDesc: 'ការកសាងសមត្ថភាព', en: 'Employee Development', desc: 'Effectiveness of capacity building', max: 10 },
          { id: 6, kh: 'ការចូលរួមក្នុងការគ្រប់គ្រង់ផ្នែក', khDesc: 'ការអនុលោមតាមទិសដៅ', en: 'Participation in Management', desc: 'Adherence to work directives', max: 10 },
          { id: 7, kh: 'វិន័យបុគ្គលិក', khDesc: 'ការគោរពវិន័យ', en: 'Employee Discipline', desc: 'Adherence to discipline', max: 10 },
          { id: 8, kh: 'ការទំនាក់ទំនង', khDesc: 'ការទំនាក់ទំនងជាមួយមិត្តរួមការងារ', en: 'Communication', desc: 'Interactions with colleagues', max: 10 },
          { id: 9, kh: 'ភាពជាអ្នកដឹកនាំ', khDesc: 'ការកសាងក្រុម', en: 'Leadership', desc: 'Leadership qualities and team building', max: 10 },
          { id: 10, kh: 'ការប្រើប្រាស់ប្រព័ន្ធបច្ចេកវិទ្យា', khDesc: 'ជំនាញបច្ចេកវិទ្យា', en: 'Technology Use', desc: 'Proficiency in office technology', max: 10 },
        ],
        teacher: [
          { id: 11, kh: 'ការរៀបចំមេរៀន', khDesc: 'ការរៀបចំផែនការបង្រៀន', en: 'Lesson Preparation', desc: 'Planning and preparing lessons', max: 10 },
          { id: 12, kh: 'វិធីសាស្ត្របង្រៀន', khDesc: 'ប្រសិទ្ធភាពនៃការបង្រៀន', en: 'Teaching Methodology', desc: 'Effective teaching methods', max: 10 },
          { id: 13, kh: 'ការគ្រប់គ្រងថ្នាក់រៀន', khDesc: 'ការគ្រប់គ្រងសិស្ស', en: 'Classroom Management', desc: 'Managing student behavior', max: 10 },
          { id: 14, kh: 'ការវាយតម្លៃសិស្ស', khDesc: 'ការតាមដានការសិក្សា', en: 'Student Assessment', desc: 'Evaluating student progress', max: 10 },
          { id: 15, kh: 'ទំនាក់ទំនងជាមួយមាតាបិតា', khDesc: 'ការប្រាស្រ័យទាក់ទង', en: 'Parent Communication', desc: 'Engaging with parents', max: 10 },
          { id: 16, kh: 'វិន័យនិងអាកប្បកិរិយា', khDesc: 'ក្រមសីលធម៌វិជ្ជាជីវៈ', en: 'Discipline & Attitude', desc: 'Professional conduct', max: 10 },
          { id: 17, kh: 'ការប្រើប្រាស់សម្ភារៈ', khDesc: 'ការប្រើប្រាស់សម្ភារៈឧបទ្ទេស', en: 'Use of Materials', desc: 'Effective use of teaching aids', max: 10 },
          { id: 18, kh: 'ការចូលរួមសកម្មភាពសាលា', khDesc: 'ការចូលរួមកម្មវិធី', en: 'School Activity Participation', desc: 'Involvement in school events', max: 10 },
          { id: 19, kh: 'ការអភិវឌ្ឍន៍ខ្លួន', khDesc: 'ការសិក្សាបន្ត', en: 'Self-Development', desc: 'Continuous learning', max: 10 },
          { id: 20, kh: 'ការសហការជាមួយមិត្តរួមការងារ', khDesc: 'ការធ្វើការងារជាក្រុម', en: 'Collaboration', desc: 'Teamwork with peers', max: 10 },
        ],
        operations: [
          { id: 21, kh: 'គុណភាពសេវាកម្ម', khDesc: 'ការផ្តល់សេវាកម្ម', en: 'Service Quality', desc: 'Delivering high-quality service', max: 10 },
          { id: 22, kh: 'ការអនុលោមតាមនីតិវិធី', khDesc: 'ការគោរពតាមគោលការណ៍', en: 'Compliance', desc: 'Following rules and protocols', max: 10 },
          { id: 23, kh: 'ប្រសិទ្ធភាពការងារ', khDesc: 'ល្បឿននិងភាពត្រឹមត្រូវ', en: 'Operational Efficiency', desc: 'Speed and accuracy of work', max: 10 },
          { id: 24, kh: 'ការដោះស្រាយបញ្ហា', khDesc: 'ការដោះស្រាយបញ្ហាជាក់ស្តែង', en: 'Problem Solving', desc: 'Handling operational issues', max: 10 },
          { id: 25, kh: 'សុវត្ថិភាពនិងអនាម័យ', khDesc: 'ការរក្សាបរិស្ថានល្អ', en: 'Safety & Hygiene', desc: 'Maintaining a safe environment', max: 10 },
          { id: 26, kh: 'ការថែទាំឧបករណ៍', khDesc: 'ការថែរក្សាសម្ភារៈ', en: 'Equipment Maintenance', desc: 'Proper care of tools and equipment', max: 10 },
          { id: 27, kh: 'ការធ្វើការជាក្រុម', khDesc: 'ការសហការ', en: 'Teamwork', desc: 'Working well with others', max: 10 },
          { id: 28, kh: 'ភាពជឿជាក់និងការទទួលខុសត្រូវ', khDesc: 'ការទទួលខុសត្រូវ', en: 'Reliability & Responsibility', desc: 'Dependability in duties', max: 10 },
          { id: 29, kh: 'ការទំនាក់ទំនងអតិថិជន', khDesc: 'ការបម្រើអតិថិជន', en: 'Customer Communication', desc: 'Interacting with clients effectively', max: 10 },
          { id: 30, kh: 'ការគ្រប់គ្រងពេលវេលា', khDesc: 'ការបំពេញការងារទាន់ពេល', en: 'Time Management', desc: 'Completing tasks on time', max: 10 },
        ]
      }
    };
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('evaluation_config', JSON.stringify(defaultConfig));
  }
};
seedSettings();

const app = express();
app.use(express.json());

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; name: string };
    }
  }
}

// Auth Middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user as any;
    next();
  });
};

const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Access denied. Super Admin only.' });
  next();
};

// --- API ROUTES ---

const logAudit = (userId: string, userName: string, action: string, details: string) => {
  try {
    const stmt = db.prepare('INSERT INTO audit_logs (userId, userName, action, details) VALUES (?, ?, ?, ?)');
    stmt.run(userId, userName, action, details);
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};

app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid User ID or Password' });
  }

  // Check if account status is Active (or exists and is not Active)
  if (user.status && user.status !== 'Active') {
    return res.status(403).json({ error: 'Your account is currently inactive. Please contact support.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  logAudit(user.id, user.name, 'login', `User logged in from ${req.ip || 'unknown'}`);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email || '',
      position: user.position || '',
      department: user.department || '',
      campus: user.campus || '',
      supervisorId: user.supervisorId || '',
      supporterId: user.supporterId || '',
      evalModel: user.evalModel || '',
      status: user.status || 'Active'
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, role, email, position, department, campus, supervisorId, supporterId, evalModel, status FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, role, email, position, department, campus, supervisorId, supporterId, evalModel, status FROM users').all();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireSuperAdmin, (req, res) => {
  const { id, name, role, password } = req.body;
  
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (existing) {
    return res.status(400).json({ error: 'User ID already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  
  try {
    const stmt = db.prepare('INSERT INTO users (id, name, password, role) VALUES (?, ?, ?, ?)');
    stmt.run(id, name, hash, role);
    logAudit(req.user!.id, req.user!.name, 'create_user', `Created user ${name} (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  const { id } = req.params;
  const { name, role, password } = req.body;

  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET name = ?, role = ?, password = ? WHERE id = ?').run(name, role, hash, id);
    } else {
      db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, id);
    }
    logAudit(req.user!.id, req.user!.name, 'update_user', `Updated user ${name} (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  const { id } = req.params;
  
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  if (id === 'superadmin') {
    return res.status(400).json({ error: 'Cannot delete the default superadmin' });
  }

  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logAudit(req.user!.id, req.user!.name, 'delete_user', `Deleted user (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Endpoints
app.get('/api/settings/evaluation_config', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('evaluation_config') as any;
  if (row) {
    res.json(JSON.parse(row.value));
  } else {
    res.json(null);
  }
});

app.post('/api/settings/evaluation_config', authenticateToken, requireSuperAdmin, (req, res) => {
  const data = req.body;
  try {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('evaluation_config', JSON.stringify(data));
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated evaluation configuration');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/self_eval_profiles', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('self_eval_profiles') as any;
  if (row) {
    res.json(JSON.parse(row.value));
  } else {
    res.json(null);
  }
});

app.post('/api/settings/self_eval_profiles', authenticateToken, requireSuperAdmin, (req, res) => {
  const data = req.body;
  try {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('self_eval_profiles', JSON.stringify(data));
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated Self Evaluation profiles');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/hr_profiles', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hr_profiles') as any;
  if (row) {
    res.json(JSON.parse(row.value));
  } else {
    res.json(null);
  }
});

app.post('/api/settings/hr_profiles', authenticateToken, requireSuperAdmin, (req, res) => {
  const data = req.body;
  try {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('hr_profiles', JSON.stringify(data));
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated HR Profile Settings');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const notifications: { id: string, message: string, type: string, link: string }[] = [];
    const userId = req.user!.id;
    
    // Check if user is an employee with pending self evaluations
    const myEvals = db.prepare('SELECT COUNT(*) as count FROM evaluations WHERE employeeId = ? AND status IN ("Draft", "Self Evaluation Pending")').get(userId) as any;
    if (myEvals && myEvals.count > 0) {
      notifications.push({
        id: 'self-eval',
        message: `You have ${myEvals.count} self-evaluation(s) to complete.`,
        type: 'warning',
        link: '/dashboard'
      });
    }

    // Check if user is appraiser
    const superEvals = db.prepare('SELECT COUNT(*) as count FROM evaluations WHERE appraiser = ? AND status = "Waiting for Supervisor"').get(userId) as any;
    if (superEvals && superEvals.count > 0) {
      notifications.push({
        id: 'super-eval',
        message: `You have ${superEvals.count} evaluation(s) waiting for your supervisor review.`,
        type: 'info',
        link: '/dashboard'
      });
    }

    // Check if user is supporter
    const supporterEvals = db.prepare('SELECT COUNT(*) as count FROM evaluations WHERE supporter = ? AND status = "Waiting for Supporter"').get(userId) as any;
    if (supporterEvals && supporterEvals.count > 0) {
      notifications.push({
        id: 'supporter-eval',
        message: `You have ${supporterEvals.count} evaluation(s) waiting for your supporter review.`,
        type: 'info',
        link: '/dashboard'
      });
    }

    // Admin notifications
    if (req.user!.role === 'superadmin' || req.user!.role === 'admin') {
      const allPending = db.prepare('SELECT COUNT(*) as count FROM evaluations WHERE status NOT IN ("Completed", "Approved")').get() as any;
      if (allPending && allPending.count > 0) {
        notifications.push({
          id: 'admin-pending',
          message: `There are ${allPending.count} evaluation(s) in progress across the system.`,
          type: 'default',
          link: '/dashboard'
        });
      }
    }

    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/data/export', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, role FROM users').all();
    const evaluations = db.prepare('SELECT * FROM evaluations').all();
    const criteriaScores = db.prepare('SELECT * FROM criteria_scores').all();
    const settings = db.prepare('SELECT * FROM app_settings').all();
    
    logAudit(req.user!.id, req.user!.name, 'export_data', 'Exported full system backup');
    res.json({ users, evaluations, criteriaScores, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/import', authenticateToken, requireSuperAdmin, (req, res) => {
  const { users, evaluations, criteriaScores, settings } = req.body;
  
  try {
    const insertEval = db.prepare(`
      INSERT OR REPLACE INTO evaluations (
        id, employeeId, employeeName, campus, position, appraiser, reviewDate, 
        weightScheme, evaluationType, totalSelf, totalSuper, overallScore, 
        createdBy, createdByName, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertScore = db.prepare(`
      INSERT OR REPLACE INTO criteria_scores (
        id, evaluationId, criteriaId, selfScore, superScore, supporterScore, managementScore, aspScore
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      if (evaluations && Array.isArray(evaluations)) {
        for (const e of evaluations) {
          insertEval.run(e.id, e.employeeId, e.employeeName, e.campus, e.position, e.appraiser, e.reviewDate, e.weightScheme, e.evaluationType, e.totalSelf, e.totalSuper, e.overallScore, e.createdBy, e.createdByName, e.createdAt);
        }
      }
      if (criteriaScores && Array.isArray(criteriaScores)) {
        for (const c of criteriaScores) {
          insertScore.run(c.id, c.evaluationId, c.criteriaId, c.selfScore, c.superScore, c.supporterScore, c.managementScore, c.aspScore);
        }
      }
      if (settings && Array.isArray(settings)) {
        const stmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
        for (const s of settings) {
          stmt.run(s.key, s.value);
        }
      }
    })();

    logAudit(req.user!.id, req.user!.name, 'import_data', 'Imported data from backup');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/reset/:type', authenticateToken, requireSuperAdmin, (req, res) => {
  const { type } = req.params;
  
  try {
    if (type === 'evaluations') {
      db.prepare('DELETE FROM criteria_scores').run();
      db.prepare('DELETE FROM peer_feedback').run();
      db.prepare('DELETE FROM evaluations').run();
      logAudit(req.user!.id, req.user!.name, 'reset_data', 'Reset all appraisal records');
    } else if (type === 'users') {
      db.prepare("DELETE FROM users WHERE id != 'superadmin'").run();
      logAudit(req.user!.id, req.user!.name, 'reset_data', 'Reset all users (except superadmin)');
    } else if (type === 'all') {
      db.prepare('DELETE FROM criteria_scores').run();
      db.prepare('DELETE FROM peer_feedback').run();
      db.prepare('DELETE FROM evaluations').run();
      db.prepare("DELETE FROM users WHERE id != 'superadmin'").run();
      db.prepare('DELETE FROM app_settings').run();
      seedSettings(); // Restore default config
      logAudit(req.user!.id, req.user!.name, 'reset_data', 'Factory reset entire system');
    } else {
      return res.status(400).json({ error: 'Invalid reset type' });
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluations Endpoints
app.delete('/api/evaluations/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  try {
    const ev = db.prepare('SELECT createdBy FROM evaluations WHERE id = ?').get(id) as any;
    if (!ev) return res.status(404).json({ error: 'Evaluation not found' });
    
    if (req.user!.role !== 'superadmin' && ev.createdBy !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to delete this evaluation' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM criteria_scores WHERE evaluationId = ?').run(id);
      db.prepare('DELETE FROM peer_feedback WHERE evaluationId = ?').run(id);
      db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);
    })();
    
    logAudit(req.user!.id, req.user!.name, 'delete_evaluation', `Deleted evaluation #${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluations/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const evalRecord = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as any;
    if (!evalRecord) return res.status(404).json({ error: 'Evaluation not found' });
    
    const scores = db.prepare('SELECT * FROM criteria_scores WHERE evaluationId = ?').all(id);
    const peerFeedbacks = db.prepare('SELECT * FROM peer_feedback WHERE evaluationId = ?').all(id);
    
    res.json({ ...evalRecord, scores, peerFeedbacks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/evaluations', authenticateToken, (req, res) => {
  const data = req.body;
  const createdBy = req.user!.id;
  const createdByName = req.user!.name;

  try {
    const insertEval = db.prepare(`
      INSERT INTO evaluations (employeeId, employeeName, campus, department, position, appraiser, supporter, reviewDate, weightScheme, evaluationType, evalPeriod, totalSelf, totalSuper, overallScore, createdBy, createdByName, evaluatorComments, status)
      VALUES (@employeeId, @employeeName, @campus, @department, @position, @appraiser, @supporter, @reviewDate, @weightScheme, @evaluationType, @evalPeriod, @totalSelf, @totalSuper, @overallScore, @createdBy, @createdByName, @evaluatorComments, @status)
    `);
    
    const info = insertEval.run({ 
        ...data, 
        createdBy, 
        createdByName, 
        evaluatorComments: data.evaluatorComments || '',
        status: data.status || 'Draft',
        department: data.department || '',
        evalPeriod: data.evalPeriod || '',
        supporter: data.supporter || ''
    });
    const evalId = info.lastInsertRowid;

    const insertCriteria = db.prepare('INSERT INTO criteria_scores (evaluationId, criteriaId, selfScore, superScore, supporterScore, managementScore, aspScore) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of data.criteriaScores) {
      insertCriteria.run(evalId, c.criteriaId, c.selfScore, c.superScore, c.supporterScore || 0, c.managementScore || 0, c.aspScore || 0);
    }

    if (data.peerFeedbacks) {
      const insertPeer = db.prepare('INSERT INTO peer_feedback (evaluationId, peerName, feedback, score) VALUES (?, ?, ?, ?)');
      for (const p of data.peerFeedbacks) {
        insertPeer.run(evalId, p.peerName, p.feedback, p.score);
      }
    }

    logAudit(createdBy, createdByName, 'create_evaluation', `Created evaluation for employee ID: ${data.employeeId} (${data.employeeName})`);

    res.json({ success: true, id: evalId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/evaluations/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  try {
    const ev = db.prepare('SELECT createdBy, appraiser, supporter FROM evaluations WHERE id = ?').get(id) as any;
    if (!ev) return res.status(404).json({ error: 'Evaluation not found' });
    
    // Allow superadmin, creator, appraiser, or supporter to edit
    if (req.user!.role !== 'superadmin' && ev.createdBy !== req.user!.id && ev.appraiser !== req.user!.id && ev.supporter !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to edit this evaluation' });
    }

    const updateEval = db.prepare(`
      UPDATE evaluations SET 
        employeeId = @employeeId, employeeName = @employeeName, campus = @campus, department = @department,
        position = @position, appraiser = @appraiser, supporter = @supporter, reviewDate = @reviewDate, 
        weightScheme = @weightScheme, evaluationType = @evaluationType, evalPeriod = @evalPeriod,
        totalSelf = @totalSelf, totalSuper = @totalSuper, overallScore = @overallScore,
        evaluatorComments = @evaluatorComments, status = @status
      WHERE id = @id
    `);
    
    db.transaction(() => {
      updateEval.run({ 
          ...data, 
          id, 
          evaluatorComments: data.evaluatorComments || '',
          status: data.status || 'Draft',
          department: data.department || '',
          evalPeriod: data.evalPeriod || '',
          supporter: data.supporter || ''
      });
      
      db.prepare('DELETE FROM criteria_scores WHERE evaluationId = ?').run(id);
      const insertScore = db.prepare(`
        INSERT INTO criteria_scores (evaluationId, criteriaId, selfScore, superScore, supporterScore, managementScore, aspScore)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const score of data.criteriaScores) {
        insertScore.run(id, score.criteriaId, score.selfScore || 0, score.superScore || 0, score.supporterScore || 0, score.managementScore || 0, score.aspScore || 0);
      }

      db.prepare('DELETE FROM peer_feedback WHERE evaluationId = ?').run(id);
      if (data.peerFeedbacks && data.peerFeedbacks.length > 0) {
        const insertPeer = db.prepare('INSERT INTO peer_feedback (evaluationId, peerName, feedback, score) VALUES (?, ?, ?, ?)');
        for (const peer of data.peerFeedbacks) {
          insertPeer.run(id, peer.peerName, peer.feedback, peer.score || 0);
        }
      }
    })();

    logAudit(req.user!.id, req.user!.name, 'update_evaluation', `Updated evaluation #${id} for ${data.employeeName}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluations', authenticateToken, (req, res) => {
  let evals;
  if (req.user?.role === 'superadmin') {
    evals = db.prepare('SELECT * FROM evaluations ORDER BY createdAt DESC').all();
  } else {
    // Return evaluations created by user OR assigned to user (appraiser or supporter)
    evals = db.prepare('SELECT * FROM evaluations WHERE createdBy = ? OR appraiser = ? OR supporter = ? ORDER BY createdAt DESC').all(req.user?.id, req.user?.id, req.user?.id);
  }
  res.json(evals);
});

// Employees Endpoints
app.get('/api/employees', authenticateToken, (req, res) => {
  try {
    const { id } = req.query;
    if (id) {
        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
        return res.json(employee || null);
    }
    const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all();
    res.json(employees);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', authenticateToken, requireSuperAdmin, (req, res) => {
  const data = req.body;
  try {
    const insertEmp = db.prepare(`
      INSERT OR REPLACE INTO employees (id, name, khmerName, email, campus, department, position, category, supervisorId, supporterId, managementId, evalCondition, evalModel, evalPeriod, status, role)
      VALUES (@id, @name, @khmerName, @email, @campus, @department, @position, @category, @supervisorId, @supporterId, @managementId, @evalCondition, @evalModel, @evalPeriod, @status, @role)
    `);
    insertEmp.run({
        ...data,
        khmerName: data.khmerName || '',
        email: data.email || '',
        department: data.department || '',
        category: data.category || '',
        supervisorId: data.supervisorId || '',
        supporterId: data.supporterId || '',
        managementId: data.managementId || '',
        evalCondition: data.evalCondition || '',
        evalModel: data.evalModel || '',
        evalPeriod: data.evalPeriod || '',
        status: data.status || 'Active',
        role: data.role || 'user'
    });

    // Auto-create/sync corresponding user profile in the users table so they can log in directly.
    // Default password is their Staff ID (the employee ID)
    const existingUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(data.id) as any;
    const resolvedRole = data.role || 'user';
    
    if (!existingUser) {
      const defaultPasswordHash = bcrypt.hashSync(data.id, 10);
      db.prepare(`
        INSERT INTO users (id, name, password, role, email, position, department, campus, supervisorId, supporterId, evalModel, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.id,
        data.name,
        defaultPasswordHash,
        resolvedRole,
        data.email || '',
        data.position || '',
        data.department || '',
        data.campus || '',
        data.supervisorId || '',
        data.supporterId || '',
        data.evalModel || '',
        data.status || 'Active'
      );
      logAudit(req.user!.id, req.user!.name, 'auto_create_user', `Automatically created user account for employee ${data.name} (${data.id})`);
    } else {
      // If user exists, sync all their details (name, role, email, position, department, campus, supervisorId, supporterId, evalModel, status)
      // but preserve their password hash.
      db.prepare(`
        UPDATE users 
        SET name = ?, role = ?, email = ?, position = ?, department = ?, campus = ?, supervisorId = ?, supporterId = ?, evalModel = ?, status = ?
        WHERE id = ?
      `).run(
        data.name,
        resolvedRole,
        data.email || '',
        data.position || '',
        data.department || '',
        data.campus || '',
        data.supervisorId || '',
        data.supporterId || '',
        data.evalModel || '',
        data.status || 'Active',
        data.id
      );
      logAudit(req.user!.id, req.user!.name, 'sync_user', `Synced user account for employee ${data.name} (${data.id})`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    if (req.params.id === 'all') {
      db.prepare('DELETE FROM employees').run();
      // Clean up corresponding user accounts (that are standard 'user' role)
      db.prepare("DELETE FROM users WHERE role NOT IN ('superadmin', 'admin')").run();
      logAudit(req.user!.id, req.user!.name, 'reset_employees', 'Reset all employee profiles and associated user accounts');
    } else {
      db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
      // Clean up corresponding user account (as long as it is not superadmin/admin)
      const existingUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as any;
      if (existingUser && existingUser.role !== 'superadmin' && existingUser.role !== 'admin') {
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      }
      logAudit(req.user!.id, req.user!.name, 'delete_employee', `Deleted employee and associated user (${req.params.id})`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Endpoint
app.get('/api/audit-logs', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500').all();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API 404 Fallback - Ensure APIs return JSON instead of falling through to HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Vite Middleware for Development / Static serving for Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
