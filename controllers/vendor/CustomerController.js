const fs = require('fs');
const path = require('path');
const { Customer, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const { saveBase64File } = require('../../utils/fileUploadHelper');

/**
 * Format database record to API response shape
 */
function formatCustomer(c) {
  return {
    id: c.id.toString(),
    name: c.name,
    email: c.email || '',
    phone: c.phone,
    status: c.status,
    totalOrders: c.total_orders,
    totalSpent: c.total_spent,
    joinedDate: c.joined_date,
    address: c.address || '',
    profileImg: c.profile_img || null,
    purchases: []
  };
}

/**
 * Get all customers for logged-in vendor.
 */
async function getCustomers(req, res) {
  try {
    const vendorId = req.user.id;
    const { search, status, spent, sortBy, sortOrder } = req.query;

    const where = { vendor_id: vendorId };

    // 1. Search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    // 2. Status filter
    if (status && status !== 'All') {
      where.status = status;
    }

    // 3. Spent filter
    if (spent) {
      if (spent === 'High') {
        where.total_spent = { [Op.gte]: 50000 };
      } else if (spent === 'Low') {
        where.total_spent = { [Op.lt]: 50000 };
      }
    }

    // 4. Sorting
    let orderColumn = 'id';
    if (sortBy === 'name') {
      orderColumn = 'name';
    } else if (sortBy === 'totalSpent') {
      orderColumn = 'total_spent';
    } else if (sortBy === 'joinedDate') {
      orderColumn = 'joined_date';
    }
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Query customers
    const list = await Customer.findAll({
      where,
      order: [[orderColumn, direction]]
    });

    // Query metrics (aggregate statistics independent of filters)
    const metricsResult = await Customer.findOne({
      where: { vendor_id: vendorId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCustomers'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'Active' THEN 1 ELSE 0 END")), 'activeCustomers'],
        [sequelize.fn('SUM', sequelize.col('total_spent')), 'totalSpent']
      ],
      raw: true
    });

    const metrics = {
      totalCustomers: parseInt(metricsResult.totalCustomers || 0, 10),
      activeCustomers: parseInt(metricsResult.activeCustomers || 0, 10),
      totalSpent: parseInt(metricsResult.totalSpent || 0, 10)
    };

    const formatted = list.map(formatCustomer);
    return sendSuccess(res, 'Customers retrieved successfully.', { 
      customers: formatted,
      metrics
    });
  } catch (error) {
    console.error('[CustomerController] getCustomers error:', error.message);
    return sendError(res, 'Internal server error retrieving customers.', {}, 500);
  }
}

/**
 * Get single customer details
 */
async function getCustomer(req, res) {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;
    
    const customer = await Customer.findOne({
      where: { id, vendor_id: vendorId }
    });

    if (!customer) {
      return sendError(res, 'Customer not found.', {}, 404);
    }

    return sendSuccess(res, 'Customer retrieved successfully.', { customer: formatCustomer(customer) });
  } catch (error) {
    console.error('[CustomerController] getCustomer error:', error.message);
    return sendError(res, 'Internal server error retrieving customer.', {}, 500);
  }
}

/**
 * Create new customer
 */
async function createCustomer(req, res) {
  try {
    const vendorId = req.user.id;
    const { name, email, phone, status, address } = req.body;
    let profile_img = req.body.profile_img || req.body.profileImg || null;

    if (profile_img) {
      profile_img = saveBase64File(profile_img, 'customer');
    }

    const formattedJoinedDate = new Date().toISOString().split('T')[0];

    const newCustomer = await Customer.create({
      vendor_id: vendorId,
      name,
      email: email || null,
      phone,
      status: status || 'Active',
      address: address || null,
      profile_img,
      joined_date: formattedJoinedDate,
      total_orders: 0,
      total_spent: 0
    });

    return sendSuccess(res, 'Customer created successfully.', { customer: formatCustomer(newCustomer) });
  } catch (error) {
    console.error('[CustomerController] createCustomer error:', error.message);
    return sendError(res, 'Internal server error creating customer.', {}, 500);
  }
}

/**
 * Update customer profile details
 */
async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;
    const updates = { ...req.body };

    // Map profileImg to profile_img if present
    if (updates.profileImg !== undefined) {
      updates.profile_img = updates.profileImg;
      delete updates.profileImg;
    }

    if (updates.profile_img) {
      updates.profile_img = saveBase64File(updates.profile_img, 'customer');
    }

    const allowedFields = ['name', 'email', 'phone', 'status', 'address', 'profile_img', 'total_orders', 'total_spent'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    const [affectedCount] = await Customer.update(filteredUpdates, {
      where: { id, vendor_id: vendorId }
    });

    if (affectedCount === 0) {
      // Check if it exists or if nothing changed
      const exists = await Customer.findOne({ where: { id, vendor_id: vendorId } });
      if (!exists) {
        return sendError(res, 'Customer not found.', {}, 404);
      }
    }

    const updated = await Customer.findOne({ where: { id, vendor_id: vendorId } });
    return sendSuccess(res, 'Customer updated successfully.', { customer: formatCustomer(updated) });
  } catch (error) {
    console.error('[CustomerController] updateCustomer error:', error.message);
    return sendError(res, 'Internal server error updating customer.', {}, 500);
  }
}

/**
 * Delete customer
 */
async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;
    
    const affectedRows = await Customer.destroy({
      where: { id, vendor_id: vendorId }
    });

    if (affectedRows === 0) {
      return sendError(res, 'Customer not found.', {}, 404);
    }

    return sendSuccess(res, 'Customer deleted successfully.', { success: true });
  } catch (error) {
    console.error('[CustomerController] deleteCustomer error:', error.message);
    return sendError(res, 'Internal server error deleting customer.', {}, 500);
  }
}

/**
 * Bulk delete customers
 */
async function bulkDelete(req, res) {
  try {
    const vendorId = req.user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'Customer IDs list is required.', {}, 400);
    }

    const deletedCount = await Customer.destroy({
      where: {
        id: { [Op.in]: ids },
        vendor_id: vendorId
      }
    });

    return sendSuccess(res, 'Selected customers deleted successfully.', { deletedCount });
  } catch (error) {
    console.error('[CustomerController] bulkDelete error:', error.message);
    return sendError(res, 'Internal server error deleting customers.', {}, 500);
  }
}

/**
 * Bulk update customer statuses
 */
async function bulkUpdateStatus(req, res) {
  try {
    const vendorId = req.user.id;
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return sendError(res, 'Customer IDs list and status are required.', {}, 400);
    }

    if (status !== 'Active' && status !== 'Inactive') {
      return sendError(res, 'Status must be either Active or Inactive.', {}, 400);
    }

    const [updatedCount] = await Customer.update({ status }, {
      where: {
        id: { [Op.in]: ids },
        vendor_id: vendorId
      }
    });

    return sendSuccess(res, 'Selected customers status updated successfully.', { updatedCount });
  } catch (error) {
    console.error('[CustomerController] bulkUpdateStatus error:', error.message);
    return sendError(res, 'Internal server error updating status.', {}, 500);
  }
}

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  bulkDelete,
  bulkUpdateStatus
};
