const typeEnum = require('./.cz-config');

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', typeEnum.types.map((i) => i.value)],
    'scope-enum': [2, 'always', typeEnum.scopes.map((i) => i.name)],
    'scope-empty': [2, 'never'],
  },
};