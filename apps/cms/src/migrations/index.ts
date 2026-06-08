import * as migration_20260605_101947_init from './20260605_101947_init';

export const migrations = [
  {
    up: migration_20260605_101947_init.up,
    down: migration_20260605_101947_init.down,
    name: '20260605_101947_init'
  },
];
