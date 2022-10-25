var window = $global;

window.boot = function () {
  var settings = window._CCSettings;
  window._CCSettings = undefined;

  var onStart = function () {

    $global.cc.view.enableRetina(true);
    $global.cc.view.resizeWithBrowserSize(true);

    var launchScene = settings.launchScene;

    // load scene
    $global.cc.director.loadScene(launchScene, null,
      function () {
        console.log('Success to load scene: ' + launchScene);
      }
    );
  };

  var option = {
    id: 'GameCanvas',
    debugMode: settings.debug ? $global.cc.debug.DebugMode.INFO : $global.cc.debug.DebugMode.ERROR,
    showFPS: settings.debug,
    frameRate: 60,
    groupList: settings.groupList,
    collisionMatrix: settings.collisionMatrix,
  }

  $global.cc.assetManager.init({
    bundleVers: settings.bundleVers,
    subpackages: settings.subpackages,
    remoteBundles: settings.remoteBundles,
    server: settings.server
  });

  var RESOURCES = $global.cc.AssetManager.BuiltinBundleName.RESOURCES;
  var INTERNAL = $global.cc.AssetManager.BuiltinBundleName.INTERNAL;
  var MAIN = $global.cc.AssetManager.BuiltinBundleName.MAIN;
  var START_SCENE = $global.cc.AssetManager.BuiltinBundleName.START_SCENE;
  var bundleRoot = [INTERNAL];
  settings.hasResourcesBundle && bundleRoot.push(RESOURCES);
  settings.hasStartSceneBundle && bundleRoot.push(MAIN);

  var count = 0;
  function cb(err) {
    if (err) return console.error(err.message, err.stack);
    count++;
    if (count === bundleRoot.length + 1) {
      // if there is start-scene bundle. should load start-scene bundle in the last stage. 
      // Otherwise the main bundle should be the last
      $global.cc.assetManager.loadBundle(settings.hasStartSceneBundle ? START_SCENE : MAIN, function (err) {
        console.log = $global.cc.log;
        if (!err) $global.cc.game.run(option, onStart);
      });
    }
  }

  // load plugins
  $global.cc.assetManager.loadScript(settings.jsList.map(function (x) { return 'src/' + x; }), cb);

  // load bundles
  for (var i = 0; i < bundleRoot.length; i++) {
    $global.cc.assetManager.loadBundle(bundleRoot[i], cb);
  }
};