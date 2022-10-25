var touchstartCB;
var touchcancelCB;
var touchendCB;
var touchmoveCB;

function handleTouchEvent(event) {
  let changedTouches = event.changedTouches;
  if (changedTouches) {
    for (let touch of changedTouches) {
      touch.clientX = touch.x;
      touch.clientY = touch.y;
    }
  }
}

Page({
  // data: {
  //   expend: true
  // },
  onLoad(options) {
    let query = options.query ? options.query : options
    this.getPageQuery(query)

    this.pageShowCB = [];
    this.pageHideCB = [];
  },
  onShow() {
    if (this.pageShowCB.length > 0) {
      this.pageShowCB.forEach(cb => {
        cb && cb();
      });
    }
  },
  onHide() {
    if (this.pageHideCB.length > 0) {
      this.pageHideCB.forEach(cb => {
        cb && cb();
      });
    }
  },
  getPageQuery(query = {}) {
    const extConfig = my.getExtConfigSync() || {}
    Object.assign(getApp().globalData, {
      ...extConfig,
      ...query
    })
  },
  canvasOnReady() {
    my.createCanvas({
      id: 'GameCanvas',
      success(canvas) {
        $global.screencanvas = canvas;
        $global.__cocosCallback({
          afterAdapterInit: () => {
            $global.__globalAdapter.onTouchStart = function (cb) {
              touchstartCB = cb;
            }
            $global.__globalAdapter.onTouchCancel = function (cb) {
              touchcancelCB = cb;
            }
            $global.__globalAdapter.onTouchEnd = function (cb) {
              touchendCB = cb;
            }
            $global.__globalAdapter.onTouchMove = function (cb) {
              touchmoveCB = cb;
            }
          }
        });
      },
      fail(err) {
        console.error('failed to init on screen canvas', err)
      }
    });
  },
  onError(err) {
    console.error('error in page: ', err);
  },
  onTouchStart(event) {
    handleTouchEvent(event);
    touchstartCB && touchstartCB(event);
  },
  onTouchCancel(event) {
    handleTouchEvent(event);
    touchcancelCB && touchcancelCB(event);
  },
  onTouchEnd(event) {
    handleTouchEvent(event);
    touchendCB && touchendCB(event);
  },
  onTouchMove(event) {
    handleTouchEvent(event);
    touchmoveCB && touchmoveCB(event);
  },
  onShareAppMessage() {
    const { shareInfo } = getApp().msMpSdk
    const { path, title, imageUrl, desc } = shareInfo

    console.log('分享链接', path)
    return {
      title,
      desc,
      path,
      imageUrl
    }
  },
});
