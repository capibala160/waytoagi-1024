/* ============================================================
   内容包
   venue = 会场包：6 个会场目的地 + 5 站寻宝/A-B 路线
   city  = 城市包：6 个城市目的地，不带走宝路线

   切换：?pack=venue / ?pack=city，或首页右上角的包名按钮。
   ============================================================ */

(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get('pack');
  // 锦创杯现场默认用「春熙」包；旧链接 ?pack=venue / ?pack=city 仍然可用
  const key = requested === 'venue' || requested === 'city' ? requested : 'chunxi';

  const packs = {
    chunxi: {
      key: 'chunxi',
      name: '春熙',
      destinations: window.CHUNXI_DESTINATIONS || [],
      levelSets: {}
    },
    venue: {
      key: 'venue',
      name: '会场',
      destinations: window.DESTINATIONS || [],
      levelSets: window.LEVEL_SETS || {}
    },
    city: {
      key: 'city',
      name: '城市',
      destinations: window.CITY_DESTINATIONS || [],
      levelSets: {}
    }
  };

  window.PACKS = packs;
  window.ACTIVE_PACK = packs[key];
  window.DESTINATIONS = packs[key].destinations;
  window.LEVEL_SETS = packs[key].levelSets;
})();
