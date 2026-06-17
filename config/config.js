require('dotenv').config();

module.exports = {
	development: {
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'mobora',
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		dialect: 'mysql',
		logging: false
	},
	test: {
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		database: (process.env.DB_NAME || 'mobora') + '_test',
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		dialect: 'mysql',
		logging: false
	},
	production: {
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'mobora',
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		dialect: 'mysql',
		logging: false
	}
};
