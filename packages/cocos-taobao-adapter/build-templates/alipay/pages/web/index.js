Page({
  data: {
    webUrl: ''
  },
  onLoad(options) {
    let query = options.query ? options.query : options
    this.getPageQuery(query)
  },
  getPageQuery(query = {}) {
    const { webUrl = '' } = query
    this.setData({ webUrl: decodeURIComponent(webUrl) })
  },
  onmessage(e){
    console.log(e)
  }
});
