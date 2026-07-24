import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './src/db/index.ts';
import { users, employees, evaluations, criteriaScores, peerFeedback, appSettings, auditLogs } from './src/db/schema.ts';
import { eq, ne, and, or, sql, desc, asc } from 'drizzle-orm';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-2026';

// Seed Default Users if not exist
const seedUsers = async () => {
  try {
    const existing = await db.select().from(users).where(eq(users.id, 'superadmin')).limit(1);
    if (existing.length === 0) {
      const superHash = bcrypt.hashSync('super@2026', 10);
      const adminHash = bcrypt.hashSync('admin@123', 10);
      
      await db.insert(users).values([
        { id: 'superadmin', name: 'Super Administrator', password: superHash, role: 'superadmin', status: 'Active' },
        { id: 'admin', name: 'Administrator', password: adminHash, role: 'admin', status: 'Active' }
      ]);
      console.log('Seeded default admin and superadmin users.');
    }
  } catch (error) {
    console.error('Error seeding default users:', error);
  }
};

const seedSettings = async () => {
  try {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, 'evaluation_config')).limit(1);
    if (existing.length === 0) {
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
      await db.insert(appSettings).values({
        key: 'evaluation_config',
        value: JSON.stringify(defaultConfig)
      });
      console.log('Seeded default evaluation settings.');
    }
  } catch (error) {
    console.error('Error seeding settings:', error);
  }
};

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

const logAudit = async (userId: string, userName: string, action: string, details?: string) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      userName,
      action,
      details: details || null,
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};

// --- API ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { userId, password } = req.body;
  try {
    const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userList[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userList = await db.select({
      id: users.id,
      name: users.name,
      role: users.role,
      email: users.email,
      position: users.position,
      department: users.department,
      campus: users.campus,
      supervisorId: users.supervisorId,
      supporterId: users.supporterId,
      evalModel: users.evalModel,
      status: users.status,
    }).from(users).where(eq(users.id, req.user!.id)).limit(1);
    
    const user = userList[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userList = await db.select({
      id: users.id,
      name: users.name,
      role: users.role,
      email: users.email,
      position: users.position,
      department: users.department,
      campus: users.campus,
      supervisorId: users.supervisorId,
      supporterId: users.supporterId,
      evalModel: users.evalModel,
      status: users.status,
    }).from(users);
    res.json(userList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id, name, role, password } = req.body;
  
  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User ID already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    
    await db.insert(users).values({
      id,
      name,
      password: hash,
      role,
      status: 'Active',
    });
    
    logAudit(req.user!.id, req.user!.name, 'create_user', `Created user ${name} (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, password } = req.body;

  try {
    const updateData: any = { name, role };
    if (password) {
      updateData.password = bcrypt.hashSync(password, 10);
    }
    await db.update(users).set(updateData).where(eq(users.id, id));
    logAudit(req.user!.id, req.user!.name, 'update_user', `Updated user ${name} (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  if (id === 'superadmin') {
    return res.status(400).json({ error: 'Cannot delete the default superadmin' });
  }

  try {
    await db.delete(users).where(eq(users.id, id));
    logAudit(req.user!.id, req.user!.name, 'delete_user', `Deleted user (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Endpoints
app.get('/api/settings/evaluation_config', authenticateToken, async (req, res) => {
  try {
    const rowList = await db.select().from(appSettings).where(eq(appSettings.key, 'evaluation_config')).limit(1);
    const row = rowList[0];
    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/evaluation_config', authenticateToken, requireSuperAdmin, async (req, res) => {
  const data = req.body;
  try {
    await db.insert(appSettings)
      .values({ key: 'evaluation_config', value: JSON.stringify(data) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(data) } });
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated evaluation configuration');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/self_eval_profiles', authenticateToken, async (req, res) => {
  try {
    const rowList = await db.select().from(appSettings).where(eq(appSettings.key, 'self_eval_profiles')).limit(1);
    const row = rowList[0];
    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/self_eval_profiles', authenticateToken, requireSuperAdmin, async (req, res) => {
  const data = req.body;
  try {
    await db.insert(appSettings)
      .values({ key: 'self_eval_profiles', value: JSON.stringify(data) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(data) } });
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated Self Evaluation profiles');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/hr_profiles', authenticateToken, async (req, res) => {
  try {
    const rowList = await db.select().from(appSettings).where(eq(appSettings.key, 'hr_profiles')).limit(1);
    const row = rowList[0];
    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/hr_profiles', authenticateToken, requireSuperAdmin, async (req, res) => {
  const data = req.body;
  try {
    await db.insert(appSettings)
      .values({ key: 'hr_profiles', value: JSON.stringify(data) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(data) } });
    logAudit(req.user!.id, req.user!.name, 'update_settings', 'Updated HR Profile Settings');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications: { id: string, message: string, type: string, link: string }[] = [];
    const userId = req.user!.id;
    
    // Check if user is an employee with pending self evaluations
    const myEvalsRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(evaluations)
      .where(and(
        eq(evaluations.employeeId, userId),
        or(eq(evaluations.status, 'Draft'), eq(evaluations.status, 'Self Evaluation Pending'))
      ));
    const myEvalsCount = myEvalsRes[0]?.count || 0;
    if (myEvalsCount > 0) {
      notifications.push({
        id: 'self-eval',
        message: `You have ${myEvalsCount} self-evaluation(s) to complete.`,
        type: 'warning',
        link: '/dashboard'
      });
    }

    // Check if user is appraiser
    const superEvalsRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(evaluations)
      .where(and(
        eq(evaluations.appraiser, userId),
        eq(evaluations.status, 'Waiting for Supervisor')
      ));
    const superEvalsCount = superEvalsRes[0]?.count || 0;
    if (superEvalsCount > 0) {
      notifications.push({
        id: 'super-eval',
        message: `You have ${superEvalsCount} evaluation(s) waiting for your supervisor review.`,
        type: 'info',
        link: '/dashboard'
      });
    }

    // Check if user is supporter
    const supporterEvalsRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(evaluations)
      .where(and(
        eq(evaluations.supporter, userId),
        eq(evaluations.status, 'Waiting for Supporter')
      ));
    const supporterEvalsCount = supporterEvalsRes[0]?.count || 0;
    if (supporterEvalsCount > 0) {
      notifications.push({
        id: 'supporter-eval',
        message: `You have ${supporterEvalsCount} evaluation(s) waiting for your supporter review.`,
        type: 'info',
        link: '/dashboard'
      });
    }

    // Admin notifications
    if (req.user!.role === 'superadmin' || req.user!.role === 'admin') {
      const allPendingRes = await db.select({ count: sql<number>`count(*)::int` })
        .from(evaluations)
        .where(and(
          ne(evaluations.status, 'Completed'),
          ne(evaluations.status, 'Approved')
        ));
      const allPendingCount = allPendingRes[0]?.count || 0;
      if (allPendingCount > 0) {
        notifications.push({
          id: 'admin-pending',
          message: `There are ${allPendingCount} evaluation(s) in progress across the system.`,
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

app.get('/api/data/export', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const usersList = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
    const evaluationsList = await db.select().from(evaluations);
    const criteriaScoresList = await db.select().from(criteriaScores);
    const settingsList = await db.select().from(appSettings);
    
    logAudit(req.user!.id, req.user!.name, 'export_data', 'Exported full system backup');
    res.json({ users: usersList, evaluations: evaluationsList, criteriaScores: criteriaScoresList, settings: settingsList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/import', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { users: importedUsers, evaluations: importedEvaluations, criteriaScores: importedCriteriaScores, settings } = req.body;
  
  try {
    await db.transaction(async (tx) => {
      if (importedEvaluations && Array.isArray(importedEvaluations)) {
        for (const e of importedEvaluations) {
          await tx.insert(evaluations).values({
            id: e.id,
            employeeId: e.employeeId,
            employeeName: e.employeeName,
            campus: e.campus,
            position: e.position,
            appraiser: e.appraiser,
            reviewDate: e.reviewDate,
            weightScheme: e.weightScheme,
            evaluationType: e.evaluationType || 'management',
            totalSelf: Number(e.totalSelf),
            totalSuper: Number(e.totalSuper),
            overallScore: Number(e.overallScore),
            createdBy: e.createdBy,
            createdByName: e.createdByName,
            createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
            evaluatorComments: e.evaluatorComments || '',
            status: e.status || 'Draft',
            department: e.department || '',
            evalPeriod: e.evalPeriod || '',
            supporter: e.supporter || '',
          }).onConflictDoUpdate({
            target: evaluations.id,
            set: {
              employeeId: e.employeeId,
              employeeName: e.employeeName,
              campus: e.campus,
              position: e.position,
              appraiser: e.appraiser,
              reviewDate: e.reviewDate,
              weightScheme: e.weightScheme,
              evaluationType: e.evaluationType || 'management',
              totalSelf: Number(e.totalSelf),
              totalSuper: Number(e.totalSuper),
              overallScore: Number(e.overallScore),
              createdBy: e.createdBy,
              createdByName: e.createdByName,
              createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
              evaluatorComments: e.evaluatorComments || '',
              status: e.status || 'Draft',
              department: e.department || '',
              evalPeriod: e.evalPeriod || '',
              supporter: e.supporter || '',
            }
          });
        }
      }

      if (importedCriteriaScores && Array.isArray(importedCriteriaScores)) {
        for (const c of importedCriteriaScores) {
          await tx.insert(criteriaScores).values({
            id: c.id,
            evaluationId: c.evaluationId,
            criteriaId: c.criteriaId,
            selfScore: c.selfScore !== null && c.selfScore !== undefined ? Number(c.selfScore) : null,
            superScore: c.superScore !== null && c.superScore !== undefined ? Number(c.superScore) : null,
            supporterScore: c.supporterScore !== null && c.supporterScore !== undefined ? Number(c.supporterScore) : 0,
            managementScore: c.managementScore !== null && c.managementScore !== undefined ? Number(c.managementScore) : 0,
            aspScore: c.aspScore !== null && c.aspScore !== undefined ? Number(c.aspScore) : 0,
          }).onConflictDoUpdate({
            target: criteriaScores.id,
            set: {
              evaluationId: c.evaluationId,
              criteriaId: c.criteriaId,
              selfScore: c.selfScore !== null && c.selfScore !== undefined ? Number(c.selfScore) : null,
              superScore: c.superScore !== null && c.superScore !== undefined ? Number(c.superScore) : null,
              supporterScore: c.supporterScore !== null && c.supporterScore !== undefined ? Number(c.supporterScore) : 0,
              managementScore: c.managementScore !== null && c.managementScore !== undefined ? Number(c.managementScore) : 0,
              aspScore: c.aspScore !== null && c.aspScore !== undefined ? Number(c.aspScore) : 0,
            }
          });
        }
      }

      if (settings && Array.isArray(settings)) {
        for (const s of settings) {
          await tx.insert(appSettings).values({
            key: s.key,
            value: s.value
          }).onConflictDoUpdate({
            target: appSettings.key,
            set: { value: s.value }
          });
        }
      }
    });

    logAudit(req.user!.id, req.user!.name, 'import_data', 'Imported data from backup');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/reset/:type', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { type } = req.params;
  
  try {
    if (type === 'evaluations') {
      await db.delete(criteriaScores);
      await db.delete(peerFeedback);
      await db.delete(evaluations);
      logAudit(req.user!.id, req.user!.name, 'reset_data', 'Reset all appraisal records');
    } else if (type === 'users') {
      await db.delete(users).where(ne(users.id, 'superadmin'));
      logAudit(req.user!.id, req.user!.name, 'reset_data', 'Reset all users (except superadmin)');
    } else if (type === 'all') {
      await db.delete(criteriaScores);
      await db.delete(peerFeedback);
      await db.delete(evaluations);
      await db.delete(users).where(ne(users.id, 'superadmin'));
      await db.delete(appSettings);
      await seedSettings(); // Restore default config
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
app.delete('/api/evaluations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const evList = await db.select({ createdBy: evaluations.createdBy }).from(evaluations).where(eq(evaluations.id, Number(id))).limit(1);
    const ev = evList[0];
    if (!ev) return res.status(404).json({ error: 'Evaluation not found' });
    
    if (req.user!.role !== 'superadmin' && ev.createdBy !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to delete this evaluation' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(criteriaScores).where(eq(criteriaScores.evaluationId, Number(id)));
      await tx.delete(peerFeedback).where(eq(peerFeedback.evaluationId, Number(id)));
      await tx.delete(evaluations).where(eq(evaluations.id, Number(id)));
    });
    
    logAudit(req.user!.id, req.user!.name, 'delete_evaluation', `Deleted evaluation #${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const evalList = await db.select().from(evaluations).where(eq(evaluations.id, Number(id))).limit(1);
    const evalRecord = evalList[0];
    if (!evalRecord) return res.status(404).json({ error: 'Evaluation not found' });
    
    const scores = await db.select().from(criteriaScores).where(eq(criteriaScores.evaluationId, Number(id)));
    const peerFeedbacks = await db.select().from(peerFeedback).where(eq(peerFeedback.evaluationId, Number(id)));
    
    res.json({ ...evalRecord, scores, peerFeedbacks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/evaluations', authenticateToken, async (req, res) => {
  const data = req.body;
  const createdBy = req.user!.id;
  const createdByName = req.user!.name;

  try {
    let evalId: number;

    const insertedEval = await db.insert(evaluations).values({
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      campus: data.campus,
      department: data.department || '',
      position: data.position,
      appraiser: data.appraiser,
      supporter: data.supporter || '',
      reviewDate: data.reviewDate,
      weightScheme: data.weightScheme,
      evaluationType: data.evaluationType || 'management',
      evalPeriod: data.evalPeriod || '',
      totalSelf: Number(data.totalSelf),
      totalSuper: Number(data.totalSuper),
      overallScore: Number(data.overallScore),
      createdBy,
      createdByName,
      evaluatorComments: data.evaluatorComments || '',
      status: data.status || 'Draft',
    }).returning({ id: evaluations.id });

    evalId = insertedEval[0].id;

    if (data.criteriaScores && Array.isArray(data.criteriaScores)) {
      for (const c of data.criteriaScores) {
        await db.insert(criteriaScores).values({
          evaluationId: evalId,
          criteriaId: c.criteriaId,
          selfScore: c.selfScore !== null && c.selfScore !== undefined ? Number(c.selfScore) : null,
          superScore: c.superScore !== null && c.superScore !== undefined ? Number(c.superScore) : null,
          supporterScore: c.supporterScore !== null && c.supporterScore !== undefined ? Number(c.supporterScore) : 0,
          managementScore: c.managementScore !== null && c.managementScore !== undefined ? Number(c.managementScore) : 0,
          aspScore: c.aspScore !== null && c.aspScore !== undefined ? Number(c.aspScore) : 0,
        });
      }
    }

    if (data.peerFeedbacks && Array.isArray(data.peerFeedbacks)) {
      for (const p of data.peerFeedbacks) {
        await db.insert(peerFeedback).values({
          evaluationId: evalId,
          peerName: p.peerName,
          feedback: p.feedback,
          score: p.score !== null && p.score !== undefined ? Number(p.score) : null,
        });
      }
    }

    logAudit(createdBy, createdByName, 'create_evaluation', `Created evaluation for employee ID: ${data.employeeId} (${data.employeeName})`);

    res.json({ success: true, id: evalId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/evaluations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  try {
    const evList = await db.select({
      createdBy: evaluations.createdBy,
      appraiser: evaluations.appraiser,
      supporter: evaluations.supporter
    }).from(evaluations).where(eq(evaluations.id, Number(id))).limit(1);
    const ev = evList[0];
    if (!ev) return res.status(404).json({ error: 'Evaluation not found' });
    
    if (req.user!.role !== 'superadmin' && ev.createdBy !== req.user!.id && ev.appraiser !== req.user!.id && ev.supporter !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to edit this evaluation' });
    }

    await db.transaction(async (tx) => {
      await tx.update(evaluations).set({
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        campus: data.campus,
        department: data.department || '',
        position: data.position,
        appraiser: data.appraiser,
        supporter: data.supporter || '',
        reviewDate: data.reviewDate,
        weightScheme: data.weightScheme,
        evaluationType: data.evaluationType || 'management',
        evalPeriod: data.evalPeriod || '',
        totalSelf: Number(data.totalSelf),
        totalSuper: Number(data.totalSuper),
        overallScore: Number(data.overallScore),
        evaluatorComments: data.evaluatorComments || '',
        status: data.status || 'Draft',
      }).where(eq(evaluations.id, Number(id)));
      
      await tx.delete(criteriaScores).where(eq(criteriaScores.evaluationId, Number(id)));
      if (data.criteriaScores && Array.isArray(data.criteriaScores)) {
        for (const score of data.criteriaScores) {
          await tx.insert(criteriaScores).values({
            evaluationId: Number(id),
            criteriaId: score.criteriaId,
            selfScore: score.selfScore !== null && score.selfScore !== undefined ? Number(score.selfScore) : null,
            superScore: score.superScore !== null && score.superScore !== undefined ? Number(score.superScore) : null,
            supporterScore: score.supporterScore !== null && score.supporterScore !== undefined ? Number(score.supporterScore) : 0,
            managementScore: score.managementScore !== null && score.managementScore !== undefined ? Number(score.managementScore) : 0,
            aspScore: score.aspScore !== null && score.aspScore !== undefined ? Number(score.aspScore) : 0,
          });
        }
      }

      await tx.delete(peerFeedback).where(eq(peerFeedback.evaluationId, Number(id)));
      if (data.peerFeedbacks && data.peerFeedbacks.length > 0) {
        for (const peer of data.peerFeedbacks) {
          await tx.insert(peerFeedback).values({
            evaluationId: Number(id),
            peerName: peer.peerName,
            feedback: peer.feedback,
            score: peer.score !== null && peer.score !== undefined ? Number(peer.score) : null,
          });
        }
      }
    });

    logAudit(req.user!.id, req.user!.name, 'update_evaluation', `Updated evaluation #${id} for ${data.employeeName}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluations', authenticateToken, async (req, res) => {
  try {
    let evals;
    if (req.user?.role === 'superadmin') {
      evals = await db.select().from(evaluations).orderBy(desc(evaluations.createdAt));
    } else {
      evals = await db.select().from(evaluations)
        .where(or(
          eq(evaluations.createdBy, req.user!.id),
          eq(evaluations.appraiser, req.user!.id),
          eq(evaluations.supporter, req.user!.id)
        ))
        .orderBy(desc(evaluations.createdAt));
    }
    res.json(evals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Employees Endpoints
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { id } = req.query;
    if (id) {
        const employeeList = await db.select().from(employees).where(eq(employees.id, String(id))).limit(1);
        const employee = employeeList[0];
        return res.json(employee || null);
    }
    const employeesList = await db.select().from(employees).orderBy(asc(employees.name));
    res.json(employeesList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', authenticateToken, requireSuperAdmin, async (req, res) => {
  const data = req.body;
  try {
    await db.insert(employees).values({
      id: data.id,
      name: data.name,
      khmerName: data.khmerName || '',
      email: data.email || '',
      campus: data.campus || '',
      department: data.department || '',
      position: data.position || '',
      category: data.category || '',
      supervisorId: data.supervisorId || '',
      supporterId: data.supporterId || '',
      managementId: data.managementId || '',
      evalCondition: data.evalCondition || '',
      evalModel: data.evalModel || '',
      evalPeriod: data.evalPeriod || '',
      status: data.status || 'Active',
      role: data.role || 'user',
    }).onConflictDoUpdate({
      target: employees.id,
      set: {
        name: data.name,
        khmerName: data.khmerName || '',
        email: data.email || '',
        campus: data.campus || '',
        department: data.department || '',
        position: data.position || '',
        category: data.category || '',
        supervisorId: data.supervisorId || '',
        supporterId: data.supporterId || '',
        managementId: data.managementId || '',
        evalCondition: data.evalCondition || '',
        evalModel: data.evalModel || '',
        evalPeriod: data.evalPeriod || '',
        status: data.status || 'Active',
        role: data.role || 'user',
      }
    });

    // Auto-create/sync corresponding user profile in the users table
    const existingUserList = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, data.id)).limit(1);
    const existingUser = existingUserList[0];
    const resolvedRole = data.role || 'user';
    
    if (!existingUser) {
      const defaultPasswordHash = bcrypt.hashSync(data.id, 10);
      await db.insert(users).values({
        id: data.id,
        name: data.name,
        password: defaultPasswordHash,
        role: resolvedRole,
        email: data.email || '',
        position: data.position || '',
        department: data.department || '',
        campus: data.campus || '',
        supervisorId: data.supervisorId || '',
        supporterId: data.supporterId || '',
        evalModel: data.evalModel || '',
        status: data.status || 'Active',
      });
      logAudit(req.user!.id, req.user!.name, 'auto_create_user', `Automatically created user account for employee ${data.name} (${data.id})`);
    } else {
      await db.update(users).set({
        name: data.name,
        role: resolvedRole,
        email: data.email || '',
        position: data.position || '',
        department: data.department || '',
        campus: data.campus || '',
        supervisorId: data.supervisorId || '',
        supporterId: data.supporterId || '',
        evalModel: data.evalModel || '',
        status: data.status || 'Active',
      }).where(eq(users.id, data.id));
      logAudit(req.user!.id, req.user!.name, 'sync_user', `Synced user account for employee ${data.name} (${data.id})`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await db.delete(employees);
      await db.delete(users).where(and(ne(users.role, 'superadmin'), ne(users.role, 'admin')));
      logAudit(req.user!.id, req.user!.name, 'reset_employees', 'Reset all employee profiles and associated user accounts');
    } else {
      await db.delete(employees).where(eq(employees.id, req.params.id));
      const existingUserList = await db.select({ role: users.role }).from(users).where(eq(users.id, req.params.id)).limit(1);
      const existingUser = existingUserList[0];
      if (existingUser && existingUser.role !== 'superadmin' && existingUser.role !== 'admin') {
        await db.delete(users).where(eq(users.id, req.params.id));
      }
      logAudit(req.user!.id, req.user!.name, 'delete_employee', `Deleted employee and associated user (${req.params.id})`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Endpoint
app.get('/api/audit-logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(500);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API 404 Fallback
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Vite Middleware / Static serving
async function startServer() {
  // Ensure default users and settings are seeded on startup
  await seedUsers();
  await seedSettings();

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
