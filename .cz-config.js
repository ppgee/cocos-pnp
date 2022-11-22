module.exports = {
  types: [
    { value: 'feat', name: '✅ feat:     A new feature' },
    { value: 'fix', name: '🐛 fix:      A bug fix' },
    {
      value: 'style',
      name:
        '🎨 style:    Changes that do not affect the meaning of the code\n            (white-space, formatting, missing semi-colons, etc)',
    },
    {
      value: 'refactor',
      name:
        '✨ refactor: A code change that neither fixes a bug nor adds a feature',
    },
    { value: 'revert', name: '🪃  revert:   Revert to a commit' },
    {
      value: 'chore',
      name:
        '🖇️  chore:    Changes to the build process or auxiliary tools\n            and libraries such as documentation generation',
    },
    { value: 'docs', name: '📝 docs:     Documentation only changes' },
    {
      value: 'perf',
      name: '🚀 perf:     A code change that improves performance',
    },
  ],

  scopes: [
    { name: 'cocos-taobao-adapter' },
    { name: 'playable-ads-adapter' },
    { name: 'playable-adapter-core' },
  ],

  messages: {
    type: "Select the type of change that you're committing:",
    scope: "\n Select the scope of change that you're committing:",
    // used if allowCustomScopes is true
    customScope: 'Denote the custom scope:',
    subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
    body:
      'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
    breaking: 'List any BREAKING CHANGES (optional):\n',
    footer:
      'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n',
    confirmCommit: 'Are you sure you want to proceed with the commit above?',
  },

  allowCustomScopes: true,
}
