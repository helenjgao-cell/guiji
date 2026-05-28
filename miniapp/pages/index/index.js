const { reverseGeocode } = require('../../utils/geocode.js')
const { getCities, addCity, savePhoto } = require('../../utils/storage.js')
const { computeStats } = require('../../utils/stats.js')
const { getCityEmoji } = require('../../utils/emoji.js')
const { readEXIF } = require('../../utils/exif.js')

Page({
  data: {
    cities: [],
    recentCities: [],
    markers: [],
    mapCenter: { lat: 35.8617, lng: 104.1954 },
    mapScale: 4,
    stats: {
      cityCount: 0, provinceCount: 0, tripCount: 0, thisYearCount: 0,
      cnCityCount: 0, cnProgressPctText: '0.0',
    },
    selectedCity: null,
    selectedEmoji: '',
    checkingIn: false,
    processing: false,
  },

  onLoad() {
    this.loadCities()
  },

  onShow() {
    // 从其他 tab 切回来时刷新（备份恢复后等场景）
    this.loadCities()
  },

  loadCities() {
    const cities = getCities()
    const stats = computeStats(cities)
    const markers = cities.map((c, i) => ({
      id: i,
      latitude: c.lat,
      longitude: c.lng,
      title: c.name,
      iconPath: '', // 默认 marker
      width: 24,
      height: 24,
      callout: {
        content: getCityEmoji(c.name) + ' ' + c.name,
        color: '#5c544a',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 6,
        display: 'BYCLICK',
        textAlign: 'center',
      },
    }))

    // 最近 10 条（按 addedAt 倒序）
    const recent = [...cities]
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, 10)
      .map((c) => ({
        ...c,
        emoji: getCityEmoji(c.name),
        subtitle: c.parent ? `${c.parent} · ${c.province}` : c.province,
      }))

    this.setData({
      cities,
      recentCities: recent,
      markers,
      stats: {
        ...stats,
        cnProgressPctText: stats.cnProgressPct.toFixed(1),
      },
    })

    // 自动 fit
    if (cities.length === 1) {
      this.setData({
        mapCenter: { lat: cities[0].lat, lng: cities[0].lng },
        mapScale: 8,
      })
    } else if (cities.length > 1) {
      // 计算包含所有点的中心 + 合适 zoom
      const lats = cities.map((c) => c.lat)
      const lngs = cities.map((c) => c.lng)
      this.setData({
        mapCenter: {
          lat: (Math.max(...lats) + Math.min(...lats)) / 2,
          lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
        },
        mapScale: 4,
      })
    }
  },

  onMarkerTap(e) {
    const id = e.markerId
    const city = this.data.cities[id]
    if (!city) return
    this.setData({
      selectedCity: city,
      selectedEmoji: getCityEmoji(city.name),
      mapCenter: { lat: city.lat, lng: city.lng },
      mapScale: 8,
    })
  },

  onRowTap(e) {
    const name = e.currentTarget.dataset.name
    const city = this.data.cities.find((c) => c.name === name)
    if (!city) return
    this.setData({
      selectedCity: city,
      selectedEmoji: getCityEmoji(city.name),
      mapCenter: { lat: city.lat, lng: city.lng },
      mapScale: 8,
    })
  },

  closeSelected() {
    this.setData({ selectedCity: null })
  },

  // === 现场打卡 ===
  async onLiveCheckIn() {
    this.setData({ checkingIn: true })
    try {
      const pos = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'wgs84',
          isHighAccuracy: true,
          success: resolve,
          fail: reject,
        })
      })
      const { latitude: lat, longitude: lng } = pos
      console.log('[checkin] GPS', lat, lng)
      const result = reverseGeocode(lat, lng)
      if (!result) {
        wx.showToast({ title: '当前位置不在已知城市范围', icon: 'none' })
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const wasExisting = getCities().some((c) => c.name === result.city)
      addCity({
        name: result.city,
        province: result.province,
        parent: result.parent,
        adcode: result.adcode,
        lat, lng,
        date: today,
        addedAt: Date.now(),
      })
      wx.showToast({
        title: wasExisting ? `已点亮过：${result.city}` : `🎉 点亮 ${result.city}`,
        icon: 'none',
        duration: 2000,
      })
      this.loadCities()
    } catch (e) {
      console.error('[checkin] error', e)
      const errMsg = (e && e.errMsg) || ''
      let msg = '定位失败'
      if (errMsg.indexOf('auth') >= 0 || errMsg.indexOf('deny') >= 0) {
        msg = '需要授权"定位"权限\n去 我的 → 关于 → 设置中心 开启'
      } else if (errMsg.indexOf('timeout') >= 0) {
        msg = '定位超时，再试一次'
      }
      wx.showModal({ title: msg, showCancel: false })
    } finally {
      this.setData({ checkingIn: false })
    }
  },

  // === 选照片识别 ===
  async onChoosePhoto() {
    this.setData({ processing: true })
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 9,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          camera: 'back',
          success: resolve,
          fail: reject,
        })
      })
      let okCount = 0
      let noGpsCount = 0
      for (const f of res.tempFiles) {
        const exif = await readEXIF(f.tempFilePath)
        if (!exif) {
          noGpsCount++
          continue
        }
        const result = reverseGeocode(exif.lat, exif.lng)
        if (!result) {
          noGpsCount++
          continue
        }
        addCity({
          name: result.city,
          province: result.province,
          parent: result.parent,
          adcode: result.adcode,
          lat: exif.lat,
          lng: exif.lng,
          date: exif.date,
          addedAt: Date.now(),
        })
        try {
          await savePhoto(result.city, f.tempFilePath)
        } catch (e) {
          console.warn('[photo] save error', e)
        }
        okCount++
      }
      const msg = `点亮 ${okCount} 城${noGpsCount > 0 ? ` · ${noGpsCount} 张无 GPS` : ''}`
      wx.showToast({ title: msg, icon: 'none', duration: 2200 })
      this.loadCities()
    } catch (e) {
      // 用户取消选择不报错
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return
      console.error('[photo] error', e)
      wx.showToast({ title: '选择照片失败', icon: 'none' })
    } finally {
      this.setData({ processing: false })
    }
  },

  onShareAppMessage() {
    return {
      title: `我已点亮 ${this.data.stats.cityCount} 座城市`,
      path: '/pages/index/index',
    }
  },
})
