const db = require('../config/db');

/**
 * Insert a new vendor record into the database.
 * Uses parameterized queries to prevent SQL injection.
 */
async function createVendor({ name, email, password, status = 'pending' }) {
  const sql = `
    INSERT INTO vendors (name, email, password, status)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await db.query(sql, [name, email, password, status]);
  return { id: result.insertId, name, email, status };
}

/**
 * Find a vendor by their email address.
 */
async function findVendorByEmail(email) {
  const sql = `
    SELECT * FROM vendors WHERE email = ? LIMIT 1
  `;
  const [rows] = await db.query(sql, [email]);
  return rows[0] || null;
}

/**
 * Find a vendor by their unique ID, omitting sensitive details like passwords.
 */
async function findVendorById(id) {
  const sql = `
    SELECT id, name, email, status, phone, shop_name, address, payment_methods, profile_img, created_at, updated_at 
    FROM vendors WHERE id = ? LIMIT 1
  `;
  const [rows] = await db.query(sql, [id]);
  return rows[0] || null;
}

async function updateVendorProfile(id, updates) {
  const fields = [];
  const values = [];
  const allowedFields = ['name', 'email', 'phone', 'shop_name', 'address', 'payment_methods', 'profile_img'];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (fields.length > 0) {
    const sql = `
      UPDATE vendors 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    values.push(id);
    await db.query(sql, values);
  }

  return findVendorById(id);
}

/**
 * Update a vendor's password.
 */
async function updateVendorPassword(id, hashedPassword) {
  const sql = `
    UPDATE vendors
    SET password = ?
    WHERE id = ?
  `;
  await db.query(sql, [hashedPassword, id]);
}

module.exports = {
  createVendor,
  findVendorByEmail,
  findVendorById,
  updateVendorProfile,
  updateVendorPassword
};
