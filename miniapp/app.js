App({
  onLaunch() {
    const sysInfo = wx.getSystemInfoSync()
    this.globalData.platform = sysInfo.platform
    this.globalData.statusBarHeight = sysInfo.statusBarHeight
  },

  globalData: {
    platform: '',
    statusBarHeight: 0,
  },
})
