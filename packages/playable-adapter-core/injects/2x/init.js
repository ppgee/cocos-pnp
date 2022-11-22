"use strict";
window.__adapter_init = function () {
  function base64toArrayBuffer(base64) {
    var bstr = window.atob(base64.substring(base64.indexOf(',') + 1));
    let index = bstr.length;
    let u8arr = new Uint8Array(index);
    while (index--) {
      u8arr[index] = bstr.charCodeAt(index);
    }
    return u8arr.buffer;
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

  function convertBase64(data) {
    let regExp = new RegExp('-', 'g')
    data = data.replace(regExp, '+');
    data = data.replace(regExp, '/');
    return data;
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

  function loadText(url, options, onComplete) {
    options.responseType = "text";
    const data = __adapter_get_resource(url);
    onComplete(null, data);
  }

  // Json
  function loadJson(url, options, onComplete) {
    const data = JSON.parse(__adapter_get_resource(url));
    onComplete(null, data);
  }

  // binary
  function loadArrayBuffer(url, options, onComplete) {
    let data = __adapter_get_resource(url);
    data = base64toArrayBuffer(data);
    onComplete(null, data);
  }

  // js
  function loadScript(url, options, onComplete) {
    let data = __adapter_get_resource(url)
    if (!data) {
      console.error(url + ' isn\'t load')
    }
    eval(data);
    onComplete && onComplete(null);
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
    let data = __adapter_get_resource(url);
    data = convertBase64(data);
    data = base64toArrayBuffer(data);
    onComplete && onComplete(null, data);
  };

  function loadDomAudio(url, onComplete) {
    // Audio
    const __audioSupport = cc.sys.__audioSupport;
    const dom = document.createElement('audio');
    dom.muted = false;
    let data = __adapter_get_resource(url.split("?")[0]);
    data = base64ToBlob(data, "audio/mpeg");

    if (window.URL) {
      dom.src = window.URL.createObjectURL(data);
    } else {
      dom.src = data;
    }

    const clearEvent = function () {
      clearTimeout(timer);
      dom.removeEventListener("canplaythrough", success, false);
      dom.removeEventListener("error", failure, false);
      if (__audioSupport.USE_LOADER_EVENT) {
        dom.removeEventListener(__audioSupport.USE_LOADER_EVENT, success, false);
      }
    };

    const timer = setTimeout(function () {
      if (dom.readyState === 0)
        failure();
      else
        success();
    }, 8000);

    const success = function () {
      clearEvent();
      onComplete && onComplete(null, dom);
    };

    const failure = function () {
      clearEvent();
      const message = 'load audio failure - ' + url;
      cc.log(message);
      onComplete && onComplete(new Error(message));
    };

    dom.addEventListener("canplaythrough", success, false);
    dom.addEventListener("error", failure, false);
    if (__audioSupport.USE_LOADER_EVENT) {
      dom.addEventListener(__audioSupport.USE_LOADER_EVENT, success, false);
    }
    return dom;
  }

  function loadWebAudio(url, onComplete) {
    // Audio
    const __audioSupport = cc.sys.__audioSupport;
    const __audioContext = __audioSupport.context;
    if (!__audioContext) callback(new Error('Audio Downloader: no web audio context.'));

    let data = base64toArrayBuffer(__adapter_get_resource(url));
    if (data) {
      __audioContext["decodeAudioData"](data, function (buffer) {
        onComplete(null, buffer);
      }, function () {
        onComplete('decode error - ' + url, null);
      });
    } else {
      onComplete('request error - ' + url, null);
    }
  }

  function loadAudio(url, options, onComplete) {
    // Audio
    const __audioSupport = cc.sys.__audioSupport;
    const formatSupport = __audioSupport.format;
    if (formatSupport.length === 0) {
      return new Error('Audio Downloader: audio not supported on this browser!');
    }

    // If WebAudio is not supported, load using DOM mode
    if (!__audioSupport.WEB_AUDIO) {
      loadDomAudio(url, onComplete);
    } else {
      loadWebAudio(url, onComplete);
    }
  }

  // Font
  function loadFont(url, options, onComplete) {
    const fontFamilyName = url.replace(/[.\/ "'\\]*/g, '');
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
      cc.warnID(4933, fontFamilyName);
      onComplete(null, fontFamilyName);
    });
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

  const downloaderList = {
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
    // Audio
    '.mp3': loadAudio,
    '.ogg': loadAudio,
    '.wav': loadAudio,
    '.m4a': loadAudio,
    // Txt
    '.txt': loadText,
    '.xml': loadText,
    '.vsh': loadText,
    '.fsh': loadText,
    '.atlas': loadText,
    '.tmx': loadText,
    '.tsx': loadText,
    '.plist': loadText,
    '.fnt': loadText,
    // Json
    '.json': loadJson,
    '.ExportJson': loadJson,
    // Video
    '.mp4': loadVideo,
    '.avi': loadVideo,
    '.mov': loadVideo,
    '.mpg': loadVideo,
    '.mpeg': loadVideo,
    '.rm': loadVideo,
    '.rmvb': loadVideo,
    // Binary
    '.binary': loadArrayBuffer,
    '.bin': loadArrayBuffer,
    '.dbbin': loadArrayBuffer,
    '.skel': loadArrayBuffer,
    '.pvr': loadArrayBuffer,
    '.pkm': loadArrayBuffer,
    // Font
    '.ttf': loadFont,
    '.font': loadFont,
    '.eot': loadFont,
    '.woff': loadFont,
    '.svg': loadFont,
    '.ttc': loadFont,
    ".js": loadScript,
    'bundle': loadBundle,
    'default': loadText
  }
  cc.assetManager.downloader.loadScript = loadScript;
  Object.keys(downloaderList).forEach((extname) => {
    cc.assetManager.downloader.register(extname, downloaderList[extname]);
  })

  if (cc.VideoPlayer) {
    const setURL = cc.VideoPlayer.Impl.prototype.setURL;
    cc.VideoPlayer.Impl.prototype.setURL = function (url, muted) {
      var res = __adapter_get_resource(url);
      if (res) {
        res = base64ToBlob(res);
        res = URL.createObjectURL(res);
        return setURL.call(this, res, muted);
      }
      return setURL.call(this, url, muted);
    };
  }

  window.boot && window.boot();
}
