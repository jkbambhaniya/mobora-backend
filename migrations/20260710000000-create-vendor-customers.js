'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const { sequelize } = queryInterface;

		// 1. Create vendor_customers table
		await queryInterface.createTable('vendor_customers', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			vendor_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'vendors',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			customer_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'customers',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			total_orders: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			total_spent: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			joined_date: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
			}
		});

		// Add composite unique index on vendor_id and customer_id
		await queryInterface.addIndex('vendor_customers', ['vendor_id', 'customer_id'], {
			unique: true,
			name: 'vendor_customer_unique'
		});

		// 2. Deduplicate customers in `customers` table by `phone`
		const [duplicates] = await sequelize.query(
			"SELECT phone, COUNT(*) as cnt FROM customers GROUP BY phone HAVING cnt > 1;"
		);

		for (const row of duplicates) {
			const { phone } = row;
			const [records] = await sequelize.query(
				"SELECT id, vendor_id, total_orders, total_spent, joined_date FROM customers WHERE phone = ? ORDER BY id ASC;",
				{ replacements: [phone] }
			);

			if (records.length > 1) {
				const primaryRecord = records[0];
				const primaryId = primaryRecord.id;
				const duplicateIds = records.slice(1).map(r => r.id);

				for (const dupId of duplicateIds) {
					// Check KYC record conflict
					const [primaryKyc] = await sequelize.query(
						"SELECT id FROM customer_kycs WHERE customer_id = ? LIMIT 1;",
						{ replacements: [primaryId] }
					);

					if (primaryKyc.length > 0) {
						// Primary already has KYC, delete duplicate KYC
						await sequelize.query(
							"DELETE FROM customer_kycs WHERE customer_id = ?;",
							{ replacements: [dupId] }
						);
					} else {
						// Primary doesn't have KYC, repoint duplicate KYC
						await sequelize.query(
							"UPDATE customer_kycs SET customer_id = ? WHERE customer_id = ?;",
							{ replacements: [primaryId, dupId] }
						);
					}

					// Repoint customer_kyc_documents
					await sequelize.query(
						"UPDATE customer_kyc_documents SET customer_id = ? WHERE customer_id = ?;",
						{ replacements: [primaryId, dupId] }
					);

					// Repoint transactions
					await sequelize.query(
						"UPDATE transactions SET partner_id = ? WHERE partner_id = ? AND partner_type = 'Customer';",
						{ replacements: [primaryId, dupId] }
					);

					// Repoint invoices
					await sequelize.query(
						"UPDATE invoices SET partner_id = ? WHERE partner_id = ? AND partner_type = 'Customer';",
						{ replacements: [primaryId, dupId] }
					);

					// Delete the duplicate customer record
					await sequelize.query(
						"DELETE FROM customers WHERE id = ?;",
						{ replacements: [dupId] }
					);
				}
			}
		}

		// 3. Add unique index/constraint on phone in customers table
		try {
			await queryInterface.addIndex('customers', ['phone'], {
				unique: true,
				name: 'customers_phone_unique'
			});
		} catch (e) {
			console.warn("[Migration] Index customers_phone_unique might already exist:", e.message);
		}

		// 4. Populate vendor_customers table from existing customers & transactions/invoices
		// First: Seed from the customer records themselves (representing their creators)
		const [allCustomers] = await sequelize.query(
			"SELECT id, vendor_id, joined_date FROM customers;"
		);

		for (const cust of allCustomers) {
			const { id, vendor_id, joined_date } = cust;
			try {
				await sequelize.query(
					"INSERT IGNORE INTO vendor_customers (vendor_id, customer_id, joined_date, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW());",
					{ replacements: [vendor_id, id, joined_date] }
				);
			} catch (e) {
				console.error("[Migration] Failed to insert vendor_customer link:", e.message);
			}
		}

		// Second: Seed from transactions (for other dealers who did transactions with this customer)
		const [txPairs] = await sequelize.query(
			"SELECT DISTINCT vendor_id, partner_id FROM transactions WHERE partner_type = 'Customer' AND partner_id IS NOT NULL;"
		);

		for (const tx of txPairs) {
			const { vendor_id, partner_id } = tx;
			const [firstTx] = await sequelize.query(
				"SELECT date FROM transactions WHERE vendor_id = ? AND partner_id = ? AND partner_type = 'Customer' ORDER BY date ASC LIMIT 1;",
				{ replacements: [vendor_id, partner_id] }
			);
			const joinedDate = firstTx.length > 0 ? firstTx[0].date : new Date().toISOString().split('T')[0];

			try {
				await sequelize.query(
					"INSERT IGNORE INTO vendor_customers (vendor_id, customer_id, joined_date, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW());",
					{ replacements: [vendor_id, partner_id, joinedDate] }
				);
			} catch (e) {
				// Ignore duplicate key errors if already seeded
			}
		}

		// Third: Seed from invoices (just in case there are invoices without transactions, though rare)
		const [invPairs] = await sequelize.query(
			"SELECT DISTINCT vendor_id, partner_id FROM invoices WHERE partner_type = 'Customer' AND partner_id IS NOT NULL;"
		);

		for (const inv of invPairs) {
			const { vendor_id, partner_id } = inv;
			const [firstInv] = await sequelize.query(
				"SELECT date FROM invoices WHERE vendor_id = ? AND partner_id = ? AND partner_type = 'Customer' ORDER BY date ASC LIMIT 1;",
				{ replacements: [vendor_id, partner_id] }
			);
			const joinedDate = firstInv.length > 0 ? firstInv[0].date : new Date().toISOString().split('T')[0];

			try {
				await sequelize.query(
					"INSERT IGNORE INTO vendor_customers (vendor_id, customer_id, joined_date, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW());",
					{ replacements: [vendor_id, partner_id, joinedDate] }
				);
			} catch (e) {
				// Ignore duplicate key errors
			}
		}

		// 5. Calculate and update total_orders and total_spent for each vendor_customers entry
		const [associations] = await sequelize.query(
			"SELECT id, vendor_id, customer_id FROM vendor_customers;"
		);

		for (const assoc of associations) {
			const { id, vendor_id, customer_id } = assoc;

			const [txStats] = await sequelize.query(
				"SELECT COUNT(*) as count, IFNULL(SUM(amount), 0) as spent FROM transactions WHERE vendor_id = ? AND partner_id = ? AND partner_type = 'Customer';",
				{ replacements: [vendor_id, customer_id] }
			);

			const totalOrders = txStats[0].count;
			const totalSpent = txStats[0].spent;

			await sequelize.query(
				"UPDATE vendor_customers SET total_orders = ?, total_spent = ? WHERE id = ?;",
				{ replacements: [totalOrders, totalSpent, id] }
			);
		}

		// 6. Remove total_orders and total_spent columns from customers table
		try {
			await queryInterface.removeColumn('customers', 'total_orders');
			await queryInterface.removeColumn('customers', 'total_spent');
		} catch (e) {
			console.warn("[Migration] Could not remove columns from customers:", e.message);
		}
	},

	down: async (queryInterface, Sequelize) => {
		// Restore columns to customers
		try {
			await queryInterface.addColumn('customers', 'total_orders', {
				type: Sequelize.INTEGER,
				defaultValue: 0
			});
			await queryInterface.addColumn('customers', 'total_spent', {
				type: Sequelize.INTEGER,
				defaultValue: 0
			});
		} catch (e) {
			// Ignore
		}

		// Drop unique index on phone in customers
		try {
			await queryInterface.removeIndex('customers', 'customers_phone_unique');
		} catch (e) {
			// Ignore
		}

		// Drop vendor_customers table
		await queryInterface.dropTable('vendor_customers');
	}
};
