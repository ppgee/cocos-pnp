"use strict";
window.__adapter_init = function () {
  class AdapterFetch {
    constructor() {
      this.response = null, this.status = 200, this.responseType = "", this.onload = function () {
        console.log("onload")
      }
    }
    open(e, t) {
      const n = __adapter_get_resource(t);
      n ? this.response = n : console.log("res", n, t)
    }
    send() {
      switch (this.responseType) {
        case "json":
          this.response = JSON.parse(this.response);
          break;
        case "text":
          this.response = this.response;
          break;
        case "arraybuffer":
          this.response = base64toArrayBuffer(this.response);
          break;
        default:
          console.err("type error", url, this.responseType)
      }
      this.onload()
    }
  }

  function base64ToBlob(base64, type) {
    let oriResBase64 = base64;
    let base64Arr = oriResBase64.split(',');
    let mime = type

    // mime-type start
    if (base64Arr.length === 2) {
      let mimeStr = base64Arr.shift()
      let regExp = new RegExp(':(.*?);')
      let array = mimeStr.match(regExp);
      mime = (array && array.length > 1 ? array[1] : type) || type;
    }
    // mime-type end

    // arraybuffer start
    let base64Str = base64Arr.shift()
    let bytes = window.atob(base64Str);
    let arrBuf = new ArrayBuffer(bytes.length);
    // arraybuffer end

    const u8arr = new Uint8Array(arrBuf);
    for (let i = 0; i < bytes.length; i++) {
      u8arr[i] = bytes.charCodeAt(i);
    }
    return new Blob([arrBuf], {
      type: mime
    });
  }

  function base64toArrayBuffer(base64) {
    var bstr = window.atob(base64.substring(base64.indexOf(',') + 1));
    let index = bstr.length;
    let u8arr = new Uint8Array(index);
    while (index--) {
      u8arr[index] = bstr.charCodeAt(index);
    }
    return u8arr.buffer;
  }

  function __adapter_init_http() {
    window.adapterFetch = AdapterFetch
  }

  function __adapter_eval(name) {
    if (!window.__adapter_js__[name]) {
      console.warn('window.__adapter_js__ is not found ', name)
      return
    }
    eval(window.__adapter_js__[name]);
    delete window.__adapter_js__[name];
  }

  function __adapter_get_base_url() {
    const hasDocument = typeof document !== 'undefined';
    let baseUrl;
    if (hasDocument) {
      let baseEl = document.querySelector('base[href]');
      if (baseEl)
        baseUrl = baseEl.href;
    }

    if (!baseUrl && typeof location !== 'undefined') {
      baseUrl = location.href.split('#')[0].split('?')[0];
      var lastSepIndex = baseUrl.lastIndexOf('/');
      if (lastSepIndex !== -1)
        baseUrl = baseUrl.slice(0, lastSepIndex + 1);
    }

    return baseUrl || ''
  }

  function __adapter_get_res_path(url, target) {
    if (target[url]) {
      return url
    }

    for (let key in target) {
      const index = url.indexOf(key);
      if (index !== -1 && (index + key.length === url.length)) {
        return key;
      }
    }
    return null;
  }

  function __adapter_get_resource(url) {
    return window.__adapter_resource__[__adapter_get_res_path(url, window.__adapter_resource__)];
  }

  function __adapter_get_imports() {
    const json = JSON.parse(__adapter_get_resource("src/import-map.json"))
    return json.imports
  }

  function __adapter_get_script(url) {
    if (url.indexOf('bullet.wasm') !== -1) {
      for (let k2 in window.__adapter_js__) {
        if (k2.indexOf('bullet.cocos') !== -1) {
          url = k2;
          break;
        }
      }
    }
    let _key = __adapter_get_res_path(url, window.__adapter_js__);
    const res = window.__adapter_js__[_key];
    if (res) {
      delete window.__adapter_js__[_key];
    }
    return res;
  }

  function __adapter_init_js() {
    const _createScript = System.__proto__.createScript
    System.__proto__.createScript = function (url) {
      let baseUrl = url.replace(__adapter_get_base_url(), '')
      let res = __adapter_get_script(baseUrl)
      if (!res) {
        console.error(`${url} 找不到资源`)
        return _createScript.call(this, url)
      }
      const script = document.createElement('script');
      script.text = res;
      const _addEventListener = script.addEventListener
      script.addEventListener = function (type, listener) {
        if (type === 'load') {
          setTimeout(() => {
            listener()
          })
        }
        _addEventListener.call(this, type, listener)
      }
      return script;
    };
  }

  function __adapter_init_cc() {
    if (window.__adapter_cc_initialized__) {
      return;
    }
    window.__adapter_cc_initialized__ = true;
    function loadScript(url, options, onComplete) {
      let scriptStr = __adapter_get_resource(url)
      if (!scriptStr) {
        console.error(url + ' isn\'t load')
      }
      eval(scriptStr);
      onComplete && onComplete(null);
    }
    // Json
    function loadJson(url, options, onComplete) {
      const data = JSON.parse(__adapter_get_resource(url));
      onComplete(null, data);
    }
    function loadBundle(url, options, onComplete) {
      const REGEX = new RegExp('^(?:\w+:\/\/|\.+\/).+')
      let bundleName = cc.path.basename(url);
      if (!REGEX.test(url)) {
        url = 'assets/' + bundleName;
      }
      const version = options.version || cc.assetManager.downloader.bundleVers[bundleName];
      let count = 0;
      const config = `${url}/config.${version ? version + '.' : ''}json`;
      let out = null, error = null;
      loadJson(config, options, function (err, response) {
        if (err) {
          error = err;
        }
        out = response;
        out && (out.base = url + '/');
        count++;
        if (count === 2) {
          onComplete && onComplete(error, out);
        }
      });
      const js = `${url}/index.${version ? version + '.' : ''}js`;
      loadScript(js, options, function (err) {
        if (err) {
          error = err;
        }
        count++;
        if (count === 2) {
          onComplete && onComplete(error, out);
        }
      });
    }
    function loadFont(url, options, onComplete) {
      const fontFamilyName = url.split('/').pop().split('.')[0]
      const data = __adapter_get_resource(url);
      if (data == null) {
        onComplete();
        return;
      }
      const fontFace = new FontFace(fontFamilyName, 'url(' + data + ')');
      document.fonts.add(fontFace);
      fontFace.load();
      fontFace.loaded.then(function () {
        onComplete(null, fontFamilyName);
      }, function () {
        console.error('url(' + url + ') load fail');
        onComplete(null, fontFamilyName);
      })
    }
    // Image
    function loadImage(url, options, onComplete) {
      const data = __adapter_get_resource(url);
      if (!data) {
        console.error(url + ' isn\'t load')
      }

      let img = new Image();
      const loadCallback = function () {
        img.removeEventListener('load', loadCallback);
        img.removeEventListener('error', errorCallback);
        onComplete && onComplete(null, img);
      }

      const errorCallback = function () {
        img.removeEventListener('load', loadCallback);
        img.removeEventListener('error', errorCallback);
        onComplete && onComplete(new Error(cc.debug.getError(4930, url)));
      }

      img.addEventListener('load', loadCallback);
      img.addEventListener('error', errorCallback);
      img.src = data;
      return img;
    }
    // Video
    function loadVideo(url, options, onComplete) {
      var video = document.createElement('video');
      var source = document.createElement('source');
      video.appendChild(source);

      let res = __adapter_get_resource(url)
      if (res) {
        res = base64ToBlob(res);
        res = URL.createObjectURL(res);
        source.src = res

        onComplete(null, video);
      } else {
        onComplete(new Error(url + "(no response)"));
      }
    }
    // Text
    function loadText(url, options, onComplete) {
      options.responseType = "text";
      const data = __adapter_get_resource(url);
      onComplete(null, data);
    }
    // ArrayBuffer
    function loadArrayBuffer(url, options, onComplete) {
      let data = __adapter_get_resource(url);
      data = base64toArrayBuffer(data);
      onComplete(null, data);
    }

    if (cc.internal.VideoPlayerImplManager) {
      const getImpl = cc.internal.VideoPlayerImplManager.getImpl;
      cc.internal.VideoPlayerImplManager.getImpl = function (comp) {
        const impl = getImpl.call(this, comp);
        const createVideoPlayer = impl.createVideoPlayer;
        impl.createVideoPlayer = function (url) {
          var res = __adapter_get_resource(url);
          if (res) {
            res = base64ToBlob(res);
            res = URL.createObjectURL(res);
            return createVideoPlayer.call(this, res);
          }
          return createVideoPlayer.call(this, url);
        };
        return impl;
      };
    }

    const downloaderList = {
      // Scripts
      '.js': loadScript,
      // Fonts
      '.font': loadFont,
      '.eot': loadFont,
      '.ttf': loadFont,
      '.woff': loadFont,
      '.svg': loadFont,
      '.ttc': loadFont,
      // Images
      '.png': loadImage,
      '.jpg': loadImage,
      '.bmp': loadImage,
      '.jpeg': loadImage,
      '.gif': loadImage,
      '.ico': loadImage,
      '.tiff': loadImage,
      '.webp': loadImage,
      '.image': loadImage,
      // Videos
      '.mp4': loadVideo,
      '.avi': loadVideo,
      '.mov': loadVideo,
      '.mpg': loadVideo,
      '.mpeg': loadVideo,
      '.rm': loadVideo,
      '.rmvb': loadVideo,
      // Text
      '.txt': loadText,
      '.xml': loadText,
      '.vsh': loadText,
      '.fsh': loadText,
      '.atlas': loadText,
      '.tmx': loadText,
      '.tsx': loadText,
      '.plist': loadText,
      '.fnt': loadText,
      // ArrayBuffer
      '.pvr': loadArrayBuffer,
      '.pkm': loadArrayBuffer,
      '.astc': loadArrayBuffer,
      '.binary': loadArrayBuffer,
      '.bin': loadArrayBuffer,
      '.dbbin': loadArrayBuffer,
      '.skel': loadArrayBuffer,

      'bundle': loadBundle,
      'default': loadText,
    }
    cc.assetManager.downloader.downloadScript = loadScript
    Object.keys(downloaderList).forEach((extname) => {
      cc.assetManager.downloader.register(extname, downloaderList[extname]);
    })
  }

  function __adapter_init_plugins() {
    if (!window.__adapter_plugins__ || window.__adapter_plugins__.length === 0) {
      return;
    }

    window.__adapter_plugins__.forEach((scriptPath) => {
      const fileName = 'src/' + scriptPath
      __adapter_eval(fileName)
    })
  }

  function __adapter_get_path(key) {
    for (var k in window.__adapter_resource__) {
      if (k.indexOf(key) == 0) {
        return k;
      }
    }
    throw Error("no find " + key);
  }

  __adapter_init_http();

  __adapter_eval(__adapter_get_path('src/polyfills.bundle'));
  __adapter_eval(__adapter_get_path('src/system.bundle'));

  __adapter_init_js();

  let prepareLoad = Promise.resolve()
  const importsKeys = Object.keys(__adapter_get_imports())
  for (let index = importsKeys.length - 1; index >= 0; index--) {
    const key = importsKeys[index];
    prepareLoad = prepareLoad.then(() => System.import(key))
  }

  prepareLoad.then(() => {
    __adapter_init_cc()
    __adapter_init_plugins()
    System.import('./' + __adapter_get_path('index')).catch((err) => {
      console.error(err);
    })
  })
};
