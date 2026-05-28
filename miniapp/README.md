# 素页 · 微信小程序

跟根目录 H5 版（Vite + React）**完全独立**，但**共享同一套核心算法**（城市数据、地理编码、统计、聚类、印章）。两边数据格式一致，未来可双向导出导入。

## 文件结构

```
miniapp/
├── project.config.json    # 项目配置（appid 等）
├── sitemap.json
├── app.json               # 全局：页面 / tabBar / 权限
├── app.js
├── app.wxss
├── images/                # 图标资源（先用默认）
│
├── utils/                 # 业务逻辑（端口自 H5 src/lib）
│   ├── cities.js          # 404 个城市经纬度（从 cities.ts 端口）
│   ├── emoji.js           # 城市 → emoji
│   ├── geocode.js         # 离线 Haversine 找最近城市
│   ├── stats.js           # 统计计算
│   ├── trips.js           # 旅行聚类（≤7 天间隔）
│   ├── stamp.js           # 印章 SVG 生成
│   ├── storage.js         # wx.storage + 文件系统包装
│   └── exif.js            # 纯 JS JPEG EXIF GPS 解析（小程序里 file API 不能用）
│
└── pages/
    ├── index/             # 主页：地图 + 现场打卡 + 选照片
    ├── trips/             # 旅行列表
    ├── trip-detail/       # 单次旅行详情
    └── profile/           # 我的：数据概览 + 清除
```

## 启动指南

### 第一次跑

1. **下载微信开发者工具**：[https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. **打开开发者工具** → 「+」 → 「导入项目」
3. **目录** 选 `/Users/mi/opencode/guiji/miniapp/`
4. **AppID** 填你个体工商户主体下的小程序 AppID（**还没有的话**先到 [https://mp.weixin.qq.com](https://mp.weixin.qq.com) 用个体工商户营业执照注册一个新小程序，名字「素页」）
   - 测试期可以勾「使用测试号」，但用真实 AppID 体验更接近线上
5. 点「确定」，开发者工具会编译并打开

### 编辑 AppID

`project.config.json` 第 5 行：
```json
"appid": "touristappid"   ← 改成你的真实 AppID
```

### 在手机上预览

开发者工具顶部 → **「预览」** → 弹出二维码 → 微信扫码 → 在手机上跑（含真实 GPS 权限）

### 真机调试（推荐）

「真机调试」按钮 → 扫码 → **可以看到手机上的 console 日志**，方便排查问题

## 跟 H5 的差异

| 维度 | H5 (Vite + React) | 小程序 |
|---|---|---|
| 框架 | React + TypeScript | 原生 WXML/WXSS/JS |
| 地图 | 高德 JS API 2.0 | 微信原生 `<map>` 组件（基于腾讯地图）|
| 行政区边界 | 拉 DataV GeoJSON 渲染 polygon | **未实现**（需配置域名白名单 + 不同的 polygon API）|
| 照片选择 | `<input type=file>` + drag/drop | `wx.chooseMedia` |
| EXIF GPS 解析 | exifreader 库 | 自写纯 JS JPEG 解析器（utils/exif.js）|
| HEIC 支持 | heic2any 转 JPEG | **不支持**（让用户在 iPhone 设置里把相机改成"兼容性最佳"）|
| 数据存储 | localStorage + IndexedDB | `wx.setStorage` + `wx.getFileSystemManager` |
| 当前 GPS | navigator.geolocation | `wx.getLocation` |
| 路由 | 单页 + 视图切换 | tabBar 三个页面 + 详情页 |
| 分享 | 海报截图（待做）| `onShareAppMessage` 原生卡片（已支持）|

## 注意事项

### 已知限制

1. **iPhone HEIC 照片**：小程序内不能解码 HEIC 的 EXIF。
   - 解法：iPhone「设置 → 相机 → 格式」改成「**兼容性最佳**」，之后拍的就是 JPEG
   - 或：照片传到电脑后，再到 H5 版上传（H5 有 heic-to/heic2any 转换链）

2. **无行政区 polygon 渲染**：小程序原生 map 支持 polygon，但需要拉 GeoJSON 数据。当前未实现，目前只显示 marker 点。
   - 如果要做：把 `geo.datav.aliyun.com` 加到小程序「服务器域名」白名单（mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名）

3. **个人主体小程序无微信支付**：变现暂时只能走"实体明信片走淘宝/微店"。

### 提审需要做的事

- 注册个体工商户主体小程序（已有）
- 微信认证 ¥300/年（仅在要发布时做）
- 设置服务器域名白名单（如果要拉 DataV）
- 隐私协议（描述为何要定位、为何要存照片）
- 提交审核 → 通常 1-3 天

## 共享逻辑维护

`miniapp/utils/cities.js` 和 H5 的 `src/data/cities.ts` 必须**保持同步**。任何一方改了城市数据，要手动同步另一方（或写个脚本）：

```bash
# 端口 cities.ts → cities.js（在 guiji/ 根目录跑）
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/data/cities.ts', 'utf-8');
const m = src.match(/export const CITIES[^=]*=\s*(\[[\s\S]*?\n\])/);
const out = '// 端口自 src/data/cities.ts\n\n' + 'const CITIES = ' + m[1] + '\n\nmodule.exports = { CITIES }\n';
fs.writeFileSync('miniapp/utils/cities.js', out);
console.log('synced cities.js, entries:', (m[1].match(/\{ name:/g) || []).length);
"
```

其他 utils（emoji / geocode / stats / trips / stamp）：纯 JS 算法，跟 H5 的 .ts 保持人工同步。

## TODO（v0.2 想做的）

- [ ] 拉 DataV 行政区 boundary，渲染浅灰未点亮 + 橙色点亮
- [ ] 集邮册视图（印章网格）
- [ ] 一键生成分享卡片图（含统计 + 印章九宫格）
- [ ] 与 H5 双向同步：导出 JSON 二维码 → 另一端扫码导入
- [ ] AI 旅行游记（接 API）
