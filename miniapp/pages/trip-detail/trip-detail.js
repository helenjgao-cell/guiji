const { getCities, getPhotoPath } = require('../../utils/storage.js')
const { clusterIntoTrips, formatDateRange } = require('../../utils/trips.js')
const { getCityEmoji } = require('../../utils/emoji.js')

Page({
  data: {
    trip: null,
    coverPath: '',
    dateRange: '',
    cityList: [],
    photos: [],
  },

  async onLoad(options) {
    const tripId = decodeURIComponent(options.id || '')
    const cities = getCities()
    const trips = clusterIntoTrips(cities)
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) {
      this.setData({ trip: null })
      return
    }

    const cityByName = new Map(cities.map((c) => [c.name, c]))
    const cityList = []
    const photoPaths = []
    let coverPath = ''
    for (const name of trip.cityNames) {
      const c = cityByName.get(name)
      if (!c) continue
      const photoPath = await getPhotoPath(name)
      if (photoPath) {
        photoPaths.push(photoPath)
        if (!coverPath) coverPath = photoPath
      }
      cityList.push({
        name: c.name,
        date: c.date,
        subtitle: c.parent ? `${c.parent} · ${c.province}` : c.province,
        emoji: getCityEmoji(c.name),
        photoPath: photoPath || '',
      })
    }

    this.setData({
      trip,
      coverPath,
      dateRange: formatDateRange(trip.startDate, trip.endDate),
      cityList,
      photos: photoPaths,
    })

    wx.setNavigationBarTitle({ title: trip.title })
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.photos,
    })
  },

  onShareAppMessage() {
    return {
      title: this.data.trip ? this.data.trip.title : '我的旅行',
      path: `/pages/trip-detail/trip-detail?id=${encodeURIComponent(this.data.trip ? this.data.trip.id : '')}`,
    }
  },
})
