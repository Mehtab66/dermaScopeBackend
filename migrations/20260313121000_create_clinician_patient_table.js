/**
 * Creates clinician_patient link table to track which patient is assigned to which clinician
 * and keep per-clinician patient numbering and photo stats.
 */

exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('clinician_patient');
    if (!exists) {
        await knex.schema.createTable('clinician_patient', (table) => {
            table.increments('id').primary();
            table
                .integer('clinician_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE');
            table
                .integer('patient_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('patients')
                .onDelete('CASCADE');
            table
                .integer('clinician_patient_number')
                .nullable()
                .comment('Sequential number per clinician starting from 1');
            table
                .integer('total_photos')
                .notNullable()
                .defaultTo(0);
            table
                .dateTime('last_clicked')
                .nullable();
            table.timestamps(true, true); // created_at, updated_at

            table.unique(['clinician_id', 'patient_id']);
        });
    }
};

exports.down = async function (knex) {
    const exists = await knex.schema.hasTable('clinician_patient');
    if (exists) {
        await knex.schema.dropTable('clinician_patient');
    }
};

