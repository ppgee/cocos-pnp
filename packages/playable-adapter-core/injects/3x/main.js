; (function () {
  function __adapter_unzip() {
    console.time("load resource");
    window.__adapter_resource__ = window.__adapter_resource__ || {};
    const zipper = new JSZip();
    let progress = 0;
    zipper.loadAsync(window.__adapter_zip__, {
      base64: true
    }).then((zip) => {
      for (const filePath in zip.files) {
        if (zip.files[filePath].dir) {
          continue;
        }
        progress++;
        // console.log(filePath, type);
        let key = filePath;
        zip.file(key).async("string").then((data) => {
          window.__adapter_resource__[key] = data;
          progress--;
          if (progress == 0) {
            console.timeEnd("load resource");
            __adapter_exec_js();
          }
        });
      }
      ;
    }).catch((err) => {
      throw err;
    });
  }
  function __adapter_exec_js() {
    window.__adapter_js__ = {};
    for (const filePath in window.__adapter_resource__) {
      let dirArr = filePath.split('.');
      if (dirArr[dirArr.length - 1] === 'js') {
        window.__adapter_js__[filePath] = window.__adapter_resource__[filePath];
      }
    }
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
    __adapter_console();
    window.__adapter_init && window.__adapter_init();
  }

  // 如果不存在jszip，则直接运行js
  if (!window['JSZip']) {
    __adapter_exec_js();
    return;
  }
  __adapter_unzip();
})();
