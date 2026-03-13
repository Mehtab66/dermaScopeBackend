exports.up = async function (knex) {
  // Drop existing unique indexes on patient_number (there are many duplicates)
  const indexNames = [
    'patient_number',
    'patient_number_2',
    'patient_number_3',
    'patient_number_4',
    'patient_number_5',
    'patient_number_6',
    'patient_number_7',
    'patient_number_8',
    'patient_number_9',
    'patient_number_10',
    'patient_number_11',
    'patient_number_12',
    'patient_number_13',
    'patient_number_14',
    'patient_number_15',
    'patient_number_16',
    'patient_number_17',
    'patient_number_18',
    'patient_number_19',
  ];

  for (const name of indexNames) {
    // Ignore errors if an index does not exist
    try {
      // MySQL syntax for dropping an index
      // eslint-disable-next-line no-await-in-loop
      await knex.raw(`ALTER TABLE patients DROP INDEX \`${name}\``);
    } catch (e) {
      // console.log(`Index ${name} not found, skipping`);
    }
  }

  // Add composite unique index: each clinician has their own patient_number sequence
  await knex.schema.alterTable('patients', (table) => {
    table.unique(['clinician_id', 'patient_number'], 'patients_clinician_patient_number_unique');
  });
};

exports.down = async function (knex) {
  // Drop composite unique index
  await knex.schema.alterTable('patients', (table) => {
    table.dropUnique(['clinician_id', 'patient_number'], 'patients_clinician_patient_number_unique');
  });

  // Restore a simple unique index on patient_number (previous behavior)
  await knex.schema.alterTable('patients', (table) => {
    table.unique('patient_number', 'patient_number');
  });
};

