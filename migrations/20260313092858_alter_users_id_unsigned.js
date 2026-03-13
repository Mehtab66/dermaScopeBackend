exports.up = function (knex) {
    return knex.raw(
      'ALTER TABLE `users` MODIFY `id` INT UNSIGNED NOT NULL AUTO_INCREMENT'
    );
  };
  
  exports.down = function (knex) {
    return knex.raw(
      'ALTER TABLE `users` MODIFY `id` INT NOT NULL AUTO_INCREMENT'
    );
  };