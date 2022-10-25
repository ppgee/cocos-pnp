import cloud from '@tbmp/mp-cloud-sdk'
import './inject/page'

var onShowCB;
var onHideCB;

App({
  cloud,
  globalData: {},
  onLaunch(options) {
    console.info('App onLaunched');
    this.getAppQuery(options)
    // my.SDKVersion
    console.log('基础库版本：', my.SDKVersion)
    cloud.init({
      // todo 上线时注意是否需要删除
      // env: 'test',
      // @ts-ignore
      options
    }).then((result) => {
      console.log('%c 【云函数初始化】', 'background-color: blue;color: white;', result ? '成功' : '失败')
    })

    // 小程序执行出错时
    my.onError(function (error) {
      console.error(['ERROR'], error);
    });
    my.onUnhandledRejection((res) => {
      console.error('[UnhandledRejection]', res.reason, res.promise);
    });
    my.onShow = function (cb) {
      onShowCB = cb;
    };
    my.onHide = function (cb) {
      onHideCB = cb;
    };

    var window = $global;

    function setup(opts) {
      require('./ccRequire');
      require('./adapter/adapter-min');
      $global.__globalAdapter.init();

      opts.afterAdapterInit();

      $global.__globalAdapter.onShow = function (cb) {
        onShowCB = cb;
      };
      $global.__globalAdapter.onHide = function (cb) {
        onHideCB = cb;
      };

      require('./adapter/cocos2d-js-min');
      require('./adapter/physics-min.js');
      $global.__globalAdapter.adaptEngine();

      require('./src/settings');
      // Introduce Cocos Service here
      require('./main');  // TODO: move to common

      // Adjust devicePixelRatio
      $global.cc.view._maxPixelRatio = 4;

      // Release Image objects after uploaded gl texture
      $global.cc.macro.CLEANUP_IMAGE_CACHE = true;

      window.boot();
    }

    $global.__cocosCallback = function (opts) {
      try {
        // my.loadSubPackage({
        //   name: 'assets',
        //   success: (res) => {
        //     console.log('loadSubPackage success', res)
        //     setup(opts)
        //   },
        //   fail: function (res) {
        //     console.log(res)
        //     console.log("download fail")
        //   }
        // })
        setup(opts)
      } catch (error) {
        console.error(error)
      }
    };
  },
  onShow(options) {
    onShowCB && onShowCB();
  },
  onHide(options) {
    onHideCB && onHideCB();
  },
  getAppQuery(options) {
    const query = options.query || {}
    const extConfig = my.getExtConfigSync()
    Object.assign(this.globalData, {
      ...extConfig,
      ...query
    })
  }
});
