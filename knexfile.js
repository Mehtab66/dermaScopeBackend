require('dotenv').config();

module.exports = {
    client: 'mysql2',
    connection: {
        database: process.env.MYSQL_DB || 'dermascope',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASS || '',
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || 3306,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
};

