/* ============================================================
   城市包 · 目的地
   坐标口径同 destinations.js：GCJ-02 占位，运行时转 WGS-84；
   现场实测后更新 lat/lon、datum 与 entrance。
   ============================================================ */

window.CITY_DESTINATIONS = [
  {
    id: 'kuanzhai',
    name: '宽窄巷子',
    blurb: '两条老巷子，屋檐压得很低',
    image: 'assets/dest/kuanzhai.webp',
    lat: 30.669000,
    lon: 104.055000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'renmin',
    name: '人民公园',
    blurb: '喝茶、掏耳朵、看人下棋',
    image: 'assets/dest/renmin.webp',
    lat: 30.657000,
    lon: 104.055500,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'yulin',
    name: '玉林路',
    blurb: '小酒馆和旧居民楼',
    image: 'assets/dest/yulin.webp',
    lat: 30.630000,
    lon: 104.055000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  },
  {
    id: 'dongjiao',
    name: '东郊记忆',
    blurb: '旧工厂改的园区，烟囱还在',
    image: 'assets/dest/dongjiao.webp',
    lat: 30.670000,
    lon: 104.130000,
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
    id: 'jianshe',
    name: '建设路',
    blurb: '晚上最热闹的小吃街',
    image: 'assets/dest/jianshe.webp',
    lat: 30.670000,
    lon: 104.115000,
    datum: 'gcj02',
    source: '高德/腾讯占位',
    entrance: '入口待实测'
  }
];
