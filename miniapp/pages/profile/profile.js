const { getCities, clearCities, clearAllPhotos } = require('../../utils/storage.js')
const { computeStats } = require('../../utils/stats.js')

Page({
  data: {
    stats: {
      cityCount: 0, cnCityCount: 0, provinceCount: 0,
      tripCount: 0, thisYearCount: 0, cnProgressPctText: '0.0',
      northName: '', southName: '',
    },
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const cities = getCities()
    const stats = computeStats(cities)
    this.setData({
      stats: {
        ...stats,
        cnProgressPctText: stats.cnProgressPct.toFixed(1),
        northName: stats.north ? stats.north.name : '',
        southName: stats.south ? stats.south.name : '',
      },
    })
  },

  onClear() {
    wx.showModal({
      title: '清除所有数据',
      content: '将删除所有点亮的城市和照片，且不可恢复。',
      confirmText: '确认清除',
      confirmColor: '#b85c4a',
      success: (res) => {
        if (!res.confirm) return
        clearCities()
        clearAllPhotos().then(() => {
          wx.showToast({ title: '已清除', icon: 'success' })
          this.loadStats()
        })
      },
    })
  },

  onShareApp() {
    wx.showToast({
      title: '点右上角 ⋯ 选"分享给朋友"',
      icon: 'none',
      duration: 2500,
    })
  },

  onShareAppMessage() {
    return {
      title: '素页 — 我的城市足迹',
      path: '/pages/index/index',
    }
  },
})
