exports.up = async function (knex) {
  // Some MySQL versions tie the unique index to a foreign key; we must drop
  // any FK that depends on this index before dropping or changing it.

  // 1) Drop any FK on patients(patient_number) referencing clinician_patient
  const [rows] = await knex.raw(`
    SELECT CONSTRAINT_NAME AS fk_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'patients'
      AND COLUMN_NAME = 'patient_number'
      AND REFERENCED_TABLE_NAME = 'clinician_patient'
    LIMIT 1
  `);
  const first = Array.isArray(rows) ? rows[0] : null;
  const fkName = first ? (first.fk_name || first.FK_NAME) : null;
  if (fkName) {
    const safeName = '`' + String(fkName).replace(/`/g, '``') + '`';
    await knex.raw('ALTER TABLE patients DROP FOREIGN KEY ' + safeName);
  }

  // 2) Drop existing unique indexes on patient_number (there may be many duplicates)
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
    try {
      // eslint-disable-next-line no-await-in-loop
      await knex.raw(`ALTER TABLE patients DROP INDEX \`${name}\``);
    } catch (e) {
      // Index not present, ignore
    }
  }

  // 3) Add composite unique index: each clinician has their own patient_number sequence
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

