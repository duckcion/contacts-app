const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database');

function createContactsRouter(db) {
  const all  = (sql, p) => dbAll(db, sql, p);
  const get  = (sql, p) => dbGet(db, sql, p);
  const run  = (sql, p) => dbRun(db, sql, p);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // GET /api/contacts
  router.get('/', async (req, res) => {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let rows, total;
      if (search) {
        const t = `%${search}%`;
        rows  = await all(`SELECT * FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY last_name, first_name LIMIT ? OFFSET ?`, [t,t,t,t, parseInt(limit), offset]);
        const r = await get(`SELECT COUNT(*) as total FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?`, [t,t,t,t]);
        total = r.total;
      } else {
        rows  = await all(`SELECT * FROM contacts ORDER BY last_name, first_name LIMIT ? OFFSET ?`, [parseInt(limit), offset]);
        const r = await get(`SELECT COUNT(*) as total FROM contacts`, []);
        total = r.total;
      }

      res.json({ data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch contacts', details: err.message }); }
  });

  // GET /api/contacts/:id
  router.get('/:id', async (req, res) => {
    try {
      const contact = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      res.json(contact);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch contact', details: err.message }); }
  });

  // POST /api/contacts
  router.post('/', async (req, res) => {
    try {
      const { first_name, last_name, email, phone, address, company } = req.body;
      if (!first_name || !last_name || !email) return res.status(400).json({ error: 'first_name, last_name, and email are required' });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email format' });

      const result = await run(
        `INSERT INTO contacts (first_name, last_name, email, phone, address, company) VALUES (?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, email, phone||null, address||null, company||null]
      );
      const contact = await get('SELECT * FROM contacts WHERE id = ?', [result.lastID]);
      res.status(201).json(contact);
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A contact with this email already exists' });
      res.status(500).json({ error: 'Failed to create contact', details: err.message });
    }
  });

  // PUT /api/contacts/:id
  router.put('/:id', async (req, res) => {
    try {
      const existing = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Contact not found' });

      const { first_name, last_name, email, phone, address, company } = req.body;
      if (!first_name || !last_name || !email) return res.status(400).json({ error: 'first_name, last_name, and email are required' });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email format' });

      await run(
        `UPDATE contacts SET first_name=?, last_name=?, email=?, phone=?, address=?, company=? WHERE id=?`,
        [first_name, last_name, email, phone||null, address||null, company||null, req.params.id]
      );
      res.json(await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]));
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A contact with this email already exists' });
      res.status(500).json({ error: 'Failed to update contact', details: err.message });
    }
  });

  // PATCH /api/contacts/:id
  router.patch('/:id', async (req, res) => {
    try {
      const existing = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Contact not found' });

      const allowed = ['first_name','last_name','email','phone','address','company'];
      const updates = {};
      allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
      if (updates.email && !EMAIL_RE.test(updates.email)) return res.status(400).json({ error: 'Invalid email format' });

      const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await run(`UPDATE contacts SET ${setClause} WHERE id = ?`, [...Object.values(updates), req.params.id]);
      res.json(await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]));
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A contact with this email already exists' });
      res.status(500).json({ error: 'Failed to update contact', details: err.message });
    }
  });

  // DELETE /api/contacts/:id
  router.delete('/:id', async (req, res) => {
    try {
      const existing = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Contact not found' });
      await run('DELETE FROM contacts WHERE id = ?', [req.params.id]);
      res.status(204).send();
    } catch (err) { res.status(500).json({ error: 'Failed to delete contact', details: err.message }); }
  });

  return router;
}

module.exports = { createContactsRouter };
