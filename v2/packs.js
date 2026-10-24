/* ============================================================
   内容包
   venue = 会场包：6 个会场目的地 + 5 站寻宝/A-B 路线
   city  = 城市包：6 个城市目的地，不带走宝路线

   切换：?pack=venue / ?pack=city，或首页右上角的包名按钮。
   ============================================================ */

(() => {
  const params = new URLSearchParams(location.search);
  const key = params.get('pack') === 'city' ? 'city' : 'venue';

  const packs = {
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
