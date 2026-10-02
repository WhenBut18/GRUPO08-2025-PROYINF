const database = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const sendServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};

// Utilidades RUT (Chile)
const normalizeRut = (raw) => {
  if (!raw) return null;
  let s = String(raw).trim().toUpperCase();
  s = s.replace(/\./g, '').replaceAll(/[–—]/g, '-');
  if (!s.includes('-')) {
    const body = s.slice(0, -1);
    const dv = s.slice(-1);
    s = `${body}-${dv}`;
  }
  const [body, dv] = s.split('-');
  if (!/^\d+$/.test(body) || !/^[0-9K]$/.test(dv)) return null;
  return `${Number.parseInt(body, 10)}-${dv}`; // sin ceros a la izquierda
};

const rutDv = (body) => {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number.parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return '0';
  if (res === 10) return 'K';
  return String(res);
};

const isValidRut = (rutNorm) => {
  if (!rutNorm) return false;
  const [bodyStr, dv] = rutNorm.split('-');
  const body = bodyStr.replace(/^0+/, '');
  if (!/^\d+$/.test(body)) return false;
  return rutDv(body) === dv;
};

// POST /auth/register  |  POST /users
const register = async (req, res) => {
  try {
    const { email, password, full_name, rut } = req.body || {};
    if (!email || !password || !rut) {
      return res.status(400).json({ error: 'missing_fields', detail: 'email, password and rut are required' });
    }

    const rutNorm = normalizeRut(rut);
    if (!isValidRut(rutNorm)) {
      return res.status(422).json({ error: 'invalid_rut' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(String(password), 10);
    const meta = JSON.stringify({ full_name: full_name || '' });

    const sql = 'INSERT INTO users (id, email, password_hash, meta_data) VALUES (?, ?, ?, ?)';
    database.query(sql, [id, email, passwordHash, meta], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'email_exists' });
        }
        return sendServerError(res, err);
      }
      // set rut in profile created by trigger
      database.query('UPDATE profiles SET rut = ? WHERE id = ?', [rutNorm, id], (err2) => {
        if (err2) {
          if (err2.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'rut_exists' });
          }
          return sendServerError(res, err2);
        }
        return res.status(201).json({ id, email, rut: rutNorm });
      });
    });
  } catch (err) {
    return sendServerError(res, err);
  }
};

// POST /auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields', detail: 'email and password are required' });
    }

    const sql = 'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1';
    database.query(sql, [email], async (err, results) => {
      if (err) return sendServerError(res, err);
      if (!results || results.length === 0) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const user = results[0];
      const ok = await bcrypt.compare(String(password), user.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
      return res.json({ id: user.id, email: user.email });
    });
  } catch (err) {
    return sendServerError(res, err);
  }
};

// GET /users/:id
const getUser = (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const sql = `
    SELECT 
      u.id, u.email, u.meta_data,
      p.full_name, p.phone, p.address, p.city, p.rut,
      u.created_at AS user_created_at, u.updated_at AS user_updated_at,
      p.created_at AS profile_created_at, p.updated_at AS profile_updated_at
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = ?
    LIMIT 1`;

  database.query(sql, [id], (err, results) => {
    if (err) return sendServerError(res, err);
    if (!results || results.length === 0) return res.status(404).json({ error: 'not_found' });

    const row = results[0];
    let meta = null;
    try { meta = row.meta_data ? JSON.parse(row.meta_data) : null; } catch (error) {
      console.error('Error al parsear meta_data:', {
        error: error.message,
        meta_data: row.meta_data?.substring(0, 100) // Truncar para logging
      });
    }

    return res.json({
      id: row.id,
      email: row.email,
      meta_data: meta,
      profile: {
        full_name: row.full_name,
        phone: row.phone,
        address: row.address,
        city: row.city,
        rut: row.rut
      },
      created_at: row.user_created_at,
      updated_at: row.user_updated_at
    });
  });
};

// PUT /users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const { email, password, full_name, phone, address, city, rut } = req.body || {};

    const tasks = [];

    if (email) {
      tasks.push(new Promise((resolve) => {
        database.query('UPDATE users SET email = ? WHERE id = ?', [email, id], (err) => {
          if (err?.code === 'ER_DUP_ENTRY') return resolve({ status: 409, body: { error: 'email_exists' } });
          if (err) return resolve({ status: 500, body: null, err });
          resolve(null);
        });
      }));
    }

    if (password) {
      const hash = await bcrypt.hash(String(password), 10);
      tasks.push(new Promise((resolve) => {
        database.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id], (err) => {
          if (err) return resolve({ status: 500, body: null, err });
          resolve(null);
        });
      }));
    }

    if (full_name || phone || address || city || rut) {
      tasks.push(new Promise((resolve) => {
        const fields = [];
        const values = [];
        if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
        if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
        if (address !== undefined) { fields.push('address = ?'); values.push(address); }
        if (city !== undefined) { fields.push('city = ?'); values.push(city); }
        if (rut !== undefined) { fields.push('rut = ?'); values.push(rut); }

        if (fields.length === 0) return resolve(null);

        const sql = `UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);
        database.query(sql, values, (err) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY' && rut !== undefined) {
              return resolve({ status: 409, body: { error: 'rut_exists' } });
            }
            return resolve({ status: 500, body: null, err });
          }
          resolve(null);
        });
      }));
    }

    if (full_name !== undefined) {
      tasks.push(new Promise((resolve) => {
        const selectSql = 'SELECT meta_data FROM users WHERE id = ? LIMIT 1';
        database.query(selectSql, [id], (err, results) => {
          if (err) return resolve({ status: 500, body: null, err });
          const current = results[0].meta_data ? (() => { try { return JSON.parse(results[0].meta_data); } catch { return {}; } })() : {};
          current.full_name = full_name;
          const updated = JSON.stringify(current);
          database.query('UPDATE users SET meta_data = ? WHERE id = ?', [updated, id], (err2) => {
            if (err2) return resolve({ status: 500, body: null, err: err2 });
            resolve(null);
          });
        });
      }));
    }

    const results = await Promise.all(tasks);
    const failure = results && results.find(Boolean);
    if (failure) {
      if (failure.err) return sendServerError(res, failure.err);
      return res.status(failure.status).json(failure.body);
    }

    return res.json({ ok: true });
  } catch (err) {
    return sendServerError(res, err);
  }
};

// DELETE /users/:id
const deleteUser = (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'missing_id' });
  database.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) return sendServerError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    return res.status(204).send();
  });
};

const createUser = (req, res) => register(req, res);

module.exports = {
  register,
  login,
  getUser,
  createUser,
  updateUser,
  deleteUser
};
