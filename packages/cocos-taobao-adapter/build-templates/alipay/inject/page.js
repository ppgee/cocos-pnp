my.onPageShow = function (cb) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.pageShowCB) {
    currentPage.pageShowCB.push(cb)
  }
}

my.offPageShow = function (cb) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.pageShowCB) {
    currentPage.pageShowCB = currentPage.pageShowCB.filter(item => item !== cb)
  }
}

my.onPageHide = function (cb) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.pageHideCB) {
    currentPage.pageHideCB.push(cb)
  }
}

my.offPageHide = function (cb) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.pageHideCB) {
    currentPage.pageHideCB = currentPage.pageHideCB.filter(item => item !== cb)
  }
}