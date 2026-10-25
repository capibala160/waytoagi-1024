/* ============================================================
   自由行 · 目的地
   坐标口径：本文件为 GCJ-02（高德/腾讯）占位坐标；浏览器 GPS 为 WGS-84，
   v2/game.js 会先转成 WGS-84 再算距离/方位。
   现场实测后：更新 lat/lon，把 datum 改成 'wgs84'（或保留 gcj02 继续转换），
   并把 entrance 填成可进入的公共入口（例如「南门」「商场 1F 东侧」）。
   ============================================================ */

window.DESTINATIONS = [
  {
    id: 'taikoo',
    name: '太古里',
    blurb: '成都的十字路口，人最多的地方',
    image: 'assets/dest/taikoo.webp',
    lat: 30.652000,
    lon: 104.081500,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'chunxi',
    name: '春熙路',
    blurb: '老牌步行街，去找那只爬墙熊猫',
    image: 'assets/dest/chunxi.webp',
    lat: 30.657200,
    lon: 104.080000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'hejiangting',
    name: '合江亭',
    blurb: '两条河汇合的地方',
    image: 'assets/dest/hejiangting.webp',
    lat: 30.644800,
    lon: 104.090500,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'jiuyanqiao',
    name: '九眼桥',
    blurb: '桥上有九个眼，晚上最热闹',
    image: 'assets/dest/jiuyanqiao.webp',
    lat: 30.641800,
    lon: 104.087500,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'wangping',
    name: '望平街',
    blurb: '河边一条街，咖啡馆挨着茶馆',
    image: 'assets/dest/wangping.webp',
    lat: 30.657500,
    lon: 104.096000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'dongmen',
    name: '东门大桥',
    blurb: '过桥就是东边',
    image: 'assets/dest/dongmen.webp',
    lat: 30.649500,
    lon: 104.092000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  }
];
