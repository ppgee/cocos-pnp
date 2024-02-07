; (function () {
  function base64toArrayBuffer(base64) {
    var bstr = window.atob(base64.substring(base64.indexOf(',') + 1));
    let index = bstr.length;
    let u8arr = new Uint8Array(index);
    while (index--) {
      u8arr[index] = bstr.charCodeAt(index);
    }
    return u8arr.buffer;
  }
  function __adapter_eval(txt) {
    txt && eval.call(window, txt);
  }
  function __adapter_unzip() {
    console.time("load resource");
    try {
      const zipData = base64toArrayBuffer(window.__adapter_zip__);
      const decompressed = pako.inflate(zipData, { to: 'string' });
      window.__adapter_resource__ = JSON.parse(decompressed);
      __adapter_exec_js();
    } catch (error) {
      console.error(error)
      throw error;
    }
    console.timeEnd("load resource");
  }
  function __adapter_init_plugins() {
    if (!window.__adapter_plugins__ || window.__adapter_plugins__.length === 0) {
      return;
    }

    window.__adapter_plugins__.forEach((scriptPath) => {
      const fileName = 'src/' + scriptPath
      if (!window.__adapter_js__[fileName]) {
        console.warn('window.__adapter_js__ is not found ', fileName)
        return
      }

      __adapter_eval(window.__adapter_js__[fileName])
      delete window.__adapter_js__[fileName];
    })
  }
  function __adapter_exec_js() {
    window.__adapter_js__ = {};
    for (const filePath in window.__adapter_resource__) {
      let dirArr = filePath.split('.');
      if (dirArr[dirArr.length - 1] === 'js') {
        window.__adapter_js__[filePath] = window.__adapter_resource__[filePath];
      }
    }
    const jitExecList = ['src/settings.js', 'cocos2d-js.js', 'cocos2d-js-min.js', 'physics.js', 'physics-min.js', 'main.js'];
    for (let i = 0; i < jitExecList.length; i++) {
      try {
        if (!window.__adapter_js__[jitExecList[i]]) {
          console.warn(`${jitExecList[i]} is not existed`)
          continue
        }
        __adapter_eval(window.__adapter_js__[jitExecList[i]]);
        delete window.__adapter_js__[jitExecList[i]]
      } catch (error) {
        console.error(error)
      }
    }

    __adapter_init_plugins();
    __adapter_success();
  }
  function __adapter_console() {
    if (window.__adapter_js__['vconsole.min.js']) {
      eval(window.__adapter_js__['vconsole.min.js']);
      delete window.__adapter_js__['vconsole.min.js'];
      window.VConsole && (window.vConsole = new VConsole());
    }
  }
  function __adapter_success() {
    try {
      __adapter_console();
      const funGameRun = cc.game.run;
      cc.game.run = function (option, onStart) {
        option.jsList = [];
        funGameRun.call(cc.game, option, onStart);
      };
      window.__adapter_init && window.__adapter_init();
    } catch (error) {
      console.error(error)
    }
  }

  // 如果不存在pako，则直接运行js
  if (!window['pako']) {
    __adapter_exec_js();
    return;
  }
  __adapter_unzip();
})();
