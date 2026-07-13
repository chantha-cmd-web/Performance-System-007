const originalFetch = window.fetch;

// Initialize mock DB
if (!localStorage.getItem('mock_db')) {
  localStorage.setItem('mock_db', JSON.stringify({
    users: [{ id: 'admin', name: 'Admin User', password: 'password', role: 'superadmin' }],
    employees: [],
    evaluations: [],
    auditLogs: [],
    settings: {
      evaluation_config: '{}',
      self_eval_profiles: '[]',
      hr_profiles: '[]'
    }
  }));
}

const getDb = () => JSON.parse(localStorage.getItem('mock_db') || '{}');
const saveDb = (db: any) => localStorage.setItem('mock_db', JSON.stringify(db));

window.fetch = async (input, init) => {
  let url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
  if (url.startsWith('/api/')) {
    const db = getDb();
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : null;
    
    // Simulate delay
    await new Promise(r => setTimeout(r, 100));

    // Auth
    if (url === '/api/auth/login' && method === 'POST') {
      const user = db.users.find((u: any) => u.id === body.userId && u.password === body.password);
      if (user) {
        return new Response(JSON.stringify({ token: 'mock-token', user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Invalid User ID or Password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Generic Settings Getters
    if (url.startsWith('/api/settings/') && method === 'GET') {
      const key = url.split('/').pop()!;
      let data = db.settings[key];
      try { data = JSON.parse(data); } catch (e) {}
      return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Generic Settings Setters
    if (url.startsWith('/api/settings/') && method === 'POST') {
      const key = url.split('/').pop()!;
      db.settings[key] = typeof body === 'string' ? body : JSON.stringify(body);
      saveDb(db);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Employees
    if (url.startsWith('/api/employees')) {
      if (method === 'GET') {
        const id = new URL(url, 'http://localhost').searchParams.get('id');
        if (id) {
           const emp = db.employees.find((e: any) => e.id === id);
           return new Response(JSON.stringify(emp || null), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(db.employees), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST') {
        const idx = db.employees.findIndex((e: any) => e.id === body.id);
        if (idx >= 0) db.employees[idx] = body;
        else db.employees.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE') {
        const id = url.split('/').pop();
        db.employees = db.employees.filter((e: any) => e.id !== id);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Evaluations
    if (url.startsWith('/api/evaluations')) {
      const idMatch = url.match(/\/api\/evaluations\/(\d+|mock-[\w-]+)/);
      const id = idMatch ? idMatch[1] : null;

      if (method === 'GET') {
        if (id) {
          const ev = db.evaluations.find((e: any) => e.id == id);
          if (ev) return new Response(JSON.stringify(ev), { status: 200, headers: { 'Content-Type': 'application/json' } });
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(db.evaluations), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST') {
        body.id = 'mock-' + Date.now();
        body.createdAt = new Date().toISOString();
        db.evaluations.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true, id: body.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PUT' && id) {
        const idx = db.evaluations.findIndex((e: any) => e.id == id);
        if (idx >= 0) {
          db.evaluations[idx] = { ...db.evaluations[idx], ...body, id: db.evaluations[idx].id };
          saveDb(db);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE' && id) {
        db.evaluations = db.evaluations.filter((e: any) => e.id != id);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Users
    if (url.startsWith('/api/users')) {
      const id = url.split('/').pop();
      if (method === 'GET') return new Response(JSON.stringify(db.users), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method === 'POST') {
        db.users.push(body);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PUT' && id && id !== 'users') {
        const idx = db.users.findIndex((u: any) => u.id === id);
        if (idx >= 0) {
           db.users[idx] = { ...db.users[idx], ...body, id: db.users[idx].id };
           saveDb(db);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE' && id && id !== 'users') {
        db.users = db.users.filter((u: any) => u.id !== id);
        saveDb(db);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Audit Logs
    if (url === '/api/audit-logs' && method === 'GET') {
      return new Response(JSON.stringify(db.auditLogs), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Notifications
    if (url === '/api/notifications' && method === 'GET') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Data Management
    if (url === '/api/data/export' && method === 'GET') {
      return new Response(JSON.stringify(db), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="data.json"' } });
    }
    if (url === '/api/data/import' && method === 'POST') {
      saveDb(body);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.startsWith('/api/data/reset/') && method === 'POST') {
      const type = url.split('/').pop()!;
      if (type === 'all') {
        db.users = [{ id: 'admin', name: 'Admin User', password: 'password', role: 'superadmin' }];
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
  return originalFetch(input, init);
};
