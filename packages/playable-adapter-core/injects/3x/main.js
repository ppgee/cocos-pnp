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

  // 如果不存在pako，则直接运行js
  if (!window['pako']) {
    __adapter_exec_js();
    return;
  }
  __adapter_unzip();
})();
