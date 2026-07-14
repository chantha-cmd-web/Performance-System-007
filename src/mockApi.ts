// Initialize mock DB
const initMockDb = () => {
  try {
    let db = JSON.parse(localStorage.getItem('mock_db') || 'null');
    if (!db) {
      db = {
        users: [{ id: 'superadmin', name: 'Super Admin', password: 'super@2026', role: 'superadmin' }],
        employees: [],
        evaluations: [],
        auditLogs: [],
        settings: {
          evaluation_config: '{}',
          self_eval_profiles: '[]',
          hr_profiles: '{}'
        }
      };
    } else {
      if (!db.users) db.users = [];
      const superadminIndex = db.users.findIndex((u: any) => u.id === 'superadmin');
      if (superadminIndex === -1) {
        db.users.push({ id: 'superadmin', name: 'Super Admin', password: 'super@2026', role: 'superadmin' });
      } else {
        db.users[superadminIndex].password = 'super@2026';
      }
    }
    localStorage.setItem('mock_db', JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage not available', e);
  }
};
initMockDb();

const getDb = () => {
  try {
    return JSON.parse(localStorage.getItem('mock_db') || '{}');
  } catch (e) {
    return {};
  }
};
const saveDb = (db: any) => {
  try {
    localStorage.setItem('mock_db', JSON.stringify(db));
  } catch (e) {}
};

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof (input as any).toString === 'function') {
    url = (input as any).toString();
  }

  if (url.includes('/api/')) {
    const db = getDb();
    const method = init?.method || 'GET';
    let body: any = null;
    try {
      if (init?.body && typeof init.body === 'string') {
        body = JSON.parse(init.body);
      }
    } catch (e) {
      console.error('Error parsing fetch body in mock', e);
    }
    
    // Simulate delay
    await new Promise(r => setTimeout(r, 100));

    // Auth
    if (url.includes('/api/auth/login') && method === 'POST') {
      const user = db.users?.find((u: any) => u.id === body?.userId && u.password === body?.password);
      if (user) {
        return new Response(JSON.stringify({ token: 'mock-token', user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Invalid User ID or Password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Generic Settings Getters
    if (url.includes('/api/settings/') && method === 'GET') {
      const key = url.split('/').pop()!;
      let data = db.settings?.[key];
      try { data = JSON.parse(data); } catch (e) {}
      return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Generic Settings Setters
    if (url.includes('/api/settings/') && method === 'POST') {
      const key = url.split('/').pop()!;
      if (!db.settings) db.settings = {};
      db.settings[key] = typeof body === 'string' ? body : JSON.stringify(body);
      saveDb(db);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Employees
    if (url.includes('/api/employees')) {
      if (method === 'GET') {
        const id = new URL(url, window.location.origin).searchParams.get('id');
        if (id) {
           const emp = db.employees?.find((e: any) => e.id === id);
           return new Response(JSON.stringify(emp || null), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(db.employees || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST') {
        if (!db.employees) db.employees = [];
        const idx = db.employees.findIndex((e: any) => e.id === body?.id);
        if (idx >= 0) db.employees[idx] = body;
        else db.employees.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE') {
        const id = url.split('/').pop();
        if (id === 'all') {
          db.employees = [];
        } else if (db.employees) {
          db.employees = db.employees.filter((e: any) => e.id !== id);
        }
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Evaluations
    if (url.includes('/api/evaluations')) {
      const idMatch = url.match(/\/api\/evaluations\/(\d+|mock-[\w-]+)/);
      const id = idMatch ? idMatch[1] : null;

      if (method === 'GET') {
        if (id) {
          const ev = db.evaluations?.find((e: any) => e.id == id);
          if (ev) return new Response(JSON.stringify(ev), { status: 200, headers: { 'Content-Type': 'application/json' } });
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(db.evaluations || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST') {
        if (!db.evaluations) db.evaluations = [];
        body.id = 'mock-' + Date.now();
        body.createdAt = new Date().toISOString();
        db.evaluations.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true, id: body.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PUT' && id) {
        if (!db.evaluations) db.evaluations = [];
        const idx = db.evaluations.findIndex((e: any) => e.id == id);
        if (idx >= 0) {
          db.evaluations[idx] = { ...db.evaluations[idx], ...body, id: db.evaluations[idx].id };
          saveDb(db);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE' && id) {
        if (db.evaluations) db.evaluations = db.evaluations.filter((e: any) => e.id != id);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Users
    if (url.includes('/api/users')) {
      const id = url.split('/').pop();
      if (method === 'GET') return new Response(JSON.stringify(db.users || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method === 'POST') {
        if (!db.users) db.users = [];
        db.users.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PUT' && id && !url.endsWith('/users')) {
        if (!db.users) db.users = [];
        const idx = db.users.findIndex((u: any) => u.id === id);
        if (idx >= 0) {
           db.users[idx] = { ...db.users[idx], ...body, id: db.users[idx].id };
           saveDb(db);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE' && id && !url.endsWith('/users')) {
        if (db.users) db.users = db.users.filter((u: any) => u.id !== id);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Audit Logs
    if (url.includes('/api/audit-logs')) {
      if (method === 'GET') {
        return new Response(JSON.stringify(db.auditLogs || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST') {
        if (!db.auditLogs) db.auditLogs = [];
        const newLog = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          ...body
        };
        db.auditLogs.unshift(newLog);
        saveDb(db);
        return new Response(JSON.stringify({ success: true, log: newLog }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Notifications
    if (url.includes('/api/notifications') && method === 'GET') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Data Management
    if (url.includes('/api/data/export') && method === 'GET') {
      return new Response(JSON.stringify(db), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="data.json"' } });
    }
    if (url.includes('/api/data/import') && method === 'POST') {
      saveDb(body);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/data/reset/') && method === 'POST') {
      const type = url.split('/').pop()!;
      if (type === 'all') {
        db.users = [{ id: 'superadmin', name: 'Super Admin', password: 'super@2026', role: 'superadmin' }];
        db.employees = [];
        db.evaluations = [];
        db.auditLogs = [];
      } else if (type === 'evaluations') {
        db.evaluations = [];
      }
      saveDb(db);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Default fallback
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return window.fetch(input, init);
};
