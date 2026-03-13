/**
 * Adds username column to users table.
 */

exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('users', 'username');
    if (!hasColumn) {
        await knex.schema.alterTable('users', (table) => {
            table.string('username').unique().nullable().after('id');
        });
    }
};

exports.down = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('users', 'username');
    if (hasColumn) {
        await knex.schema.alterTable('users', (table) => {
            table.dropColumn('username');
        });
    }
};

