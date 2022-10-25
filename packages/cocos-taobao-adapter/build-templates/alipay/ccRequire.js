var window = $global;

let moduleMap = {
  'assets/internal/index.js'() { return require('./assets/internal/index.js') },
  'assets/resources/index.js'() { return require('./assets/resources/index.js') },
  'assets/start-scene/index.js'() { return require('./assets/start-scene/index.js') },
  'assets/main/index.js'() { return require('./assets/main/index.js') },
  // tail
};

window.__cocos_require__ = function (moduleName) {
  let func = moduleMap[moduleName];
  if (!func) {
    console.log(`cannot find module ${moduleName}`)
    throw new Error(`cannot find module ${moduleName}`);
  }
  return func();
};