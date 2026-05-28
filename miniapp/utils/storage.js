// 小程序存储：cities → wx.storage（小数据）；photos → wx.fs（大文件）
const STORAGE_KEY = 'suyep_cities_v1'
const PHOTOS_DIR = `${wx.env.USER_DATA_PATH}/suyep_photos`

function getCities() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || []
  } catch (e) {
    console.warn('[storage] getCities', e)
    return []
  }
}

function saveCities(cities) {
  try {
    wx.setStorageSync(STORAGE_KEY, cities)
  } catch (e) {
    console.warn('[storage] saveCities', e)
  }
}

function addCity(city) {
  const cities = getCities()
  const idx = cities.findIndex((c) => c.name === city.name)
  if (idx >= 0) {
    if ((city.date || '') > (cities[idx].date || '')) {
      cities[idx].date = city.date
      cities[idx].latest_visit_date = city.date
    }
  } else {
    cities.push(city)
  }
  saveCities(cities)
  return cities
}

function clearCities() {
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {}
}

// 照片：用文件系统存
function ensurePhotosDir() {
  return new Promise((resolve) => {
    const fs = wx.getFileSystemManager()
    fs.access({
      path: PHOTOS_DIR,
      success: () => resolve(),
      fail: () => {
        fs.mkdir({
          dirPath: PHOTOS_DIR,
          recursive: true,
          success: () => resolve(),
          fail: () => resolve(),
        })
      },
    })
  })
}

/**
 * 把临时照片复制到持久目录，返回最终 path
 * @param {string} cityKey 城市名作为 key（一城一图）
 * @param {string} tempPath wx.chooseMedia 返回的临时路径
 */
async function savePhoto(cityKey, tempPath) {
  await ensurePhotosDir()
  const safeName = cityKey.replace(/[^\w一-龥]/g, '_')
  const target = `${PHOTOS_DIR}/${safeName}.jpg`
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.copyFile({
      srcPath: tempPath,
      destPath: target,
      success: () => resolve(target),
      fail: (err) => reject(err),
    })
  })
}

function getPhotoPath(cityKey) {
  const safeName = cityKey.replace(/[^\w一-龥]/g, '_')
  const target = `${PHOTOS_DIR}/${safeName}.jpg`
  return new Promise((resolve) => {
    const fs = wx.getFileSystemManager()
    fs.access({
      path: target,
      success: () => resolve(target),
      fail: () => resolve(null),
    })
  })
}

function clearAllPhotos() {
  return new Promise((resolve) => {
    const fs = wx.getFileSystemManager()
    fs.rmdir({
      dirPath: PHOTOS_DIR,
      recursive: true,
      success: () => resolve(),
      fail: () => resolve(),
    })
  })
}

module.exports = {
  getCities,
  saveCities,
  addCity,
  clearCities,
  savePhoto,
  getPhotoPath,
  clearAllPhotos,
}
