const { getCities, getPhotoPath } = require('../../utils/storage.js')
const { clusterIntoTrips, formatDateRange } = require('../../utils/trips.js')
const { getCityEmoji } = require('../../utils/emoji.js')

Page({
  data: {
    trips: [],
  },

  onShow() {
    this.loadTrips()
  },

  async loadTrips() {
    const cities = getCities()
    const trips = clusterIntoTrips(cities)

    // 给每个 trip 加封面图（找第一张有照片的城市）+ emoji 列 + 日期 range
    const enriched = await Promise.all(
      trips.map(async (t) => {
        let coverPath = ''
        for (const name of t.cityNames) {
          const p = await getPhotoPath(name)
          if (p) {
            coverPath = p
            break
          }
        }
        return {
          ...t,
          coverPath,
          dateRange: formatDateRange(t.startDate, t.endDate),
          emojiList: t.cityNames.slice(0, 8).map(getCityEmoji),
        }
      }),
    )

    this.setData({ trips: enriched })
  },

  onTripTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/trip-detail/trip-detail?id=${encodeURIComponent(id)}`,
    })
  },

  onShareAppMessage() {
    return {
      title: '我的旅行小书',
      path: '/pages/trips/trips',
    }
  },
})
