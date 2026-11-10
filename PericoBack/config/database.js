const { Sequelize } = require('sequelize');
require('dotenv').config({ quiet: true });
const { url, options } = require('./database-options')();

module.exports = url
  ? new Sequelize(url, options)
  : new Sequelize(
      process.env.DB_NAME || 'perico_db',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || 'postgres',
      {
        ...options,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
      }
    );
