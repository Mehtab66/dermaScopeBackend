/**
 * Ensure clinician_patient.clinician_id is UNSIGNED and its foreign key
 * is compatible with users.id (also UNSIGNED).
 *
 * We drop and recreate the foreign key with the correct type.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Drop the existing foreign key if it exists, then change the column type and recreate the FK.
  // These statements are safe to run even if the FK name is missing (we guard with information_schema).

  // 1) Drop existing FK constraint clinician_patient_ibfk_1 if present
  await knex.raw(`
    SET @fk_name := (
      SELECT CONSTRAINT_NAME
      FROM information_schema.key_column_usage
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'clinician_patient'
        AND COLUMN_NAME = 'clinician_id'
        AND REFERENCED_TABLE_NAME = 'users'
      LIMIT 1
    );
  `);

  await knex.raw(`
    SET @sql := IF(
      @fk_name IS NOT NULL,
      CONCAT('ALTER TABLE clinician_patient DROP FOREIGN KEY ', @fk_name),
      NULL
    );
  `);

  await knex.raw(`
    PREPARE stmt FROM @sql;
  `).catch(() => {}); // If @sql is NULL, this will fail; ignore.

  await knex.raw(`
    EXECUTE stmt;
  `).catch(() => {}); // Ignore if there was nothing to execute.

  await knex.raw(`
    DEALLOCATE PREPARE stmt;
  `).catch(() => {}); // Same as above.

  // 2) Ensure clinician_id is INT UNSIGNED NOT NULL
  await knex.raw(`
    ALTER TABLE clinician_patient
      MODIFY clinician_id INT UNSIGNED NOT NULL
  `);

  // 3) Recreate the foreign key constraint with a stable name
  await knex.raw(`
    ALTER TABLE clinician_patient
      ADD CONSTRAINT clinician_patient_clinician_id_foreign
      FOREIGN KEY (clinician_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  `);
};

/**
 * Roll back: make clinician_id signed INT again and restore the FK.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Drop the FK we added
  await knex.raw(`
    ALTER TABLE clinician_patient
      DROP FOREIGN KEY clinician_patient_clinician_id_foreign
  `).catch(() => {});

  // Revert clinician_id to signed INT
  await knex.raw(`
    ALTER TABLE clinician_patient
      MODIFY clinician_id INT NOT NULL
  `);

  // Recreate a generic FK name (MySQL-style) for rollback symmetry
  await knex.raw(`
    ALTER TABLE clinician_patient
      ADD CONSTRAINT clinician_patient_ibfk_1
      FOREIGN KEY (clinician_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  `);
};

