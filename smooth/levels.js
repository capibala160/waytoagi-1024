/* ============================================================
   问心 · 关卡数据
   两套寻宝模式共用同一台引擎，只换这里的数据。
   自由行（目的地优先）用 destinations.js，不在这里。

   每站新增字段：
   type       tutorial / observe / combine / optional / final
   typeLabel  显示在线索卡上的小标签
   confirm    对准后出现的一句话（方向确认）
   story      这一站解锁的故事片段
   stamp      盖章的字（一个字）
   freeHint   true = 这一站的提示不消耗提示灯（教学站）
   bonus      { code, label } 可选加试题；答对拿「细节观察家」
   ============================================================ */

window.GAME_CONFIG = {
  venue: '科梦OPC 社区',
  event: 'WaytoAGI 1024',
  baseScore: 1000,
  timePenalty: 250,   // 一个 par 扣多少分
  hintSeconds: 6      // 每条提示折算多少秒
};

window.LEVEL_SETS = {

  outdoor: {
    key: 'outdoor',
    name: '出门玩',
    desc: '5 站 · 约 5 分钟 · 会场周边',
    par: 300,
    levels: [
      {
        id: 1,
        name: '第一站',
        type: 'tutorial',
        typeLabel: '教学',
        place: '（占位）门口右侧的绿植',
        code: '4821',
        bearing: 30,
        steps: 12,
        clue: '往北偏东 30°，走十二步左右。找那盆到你膝盖的绿植——纸贴在盆后面。',
        confirm: '方向确认，去找那盆到你膝盖的绿植。',
        story: '第一段记忆：你曾在这个门口，等一个迟到的人。',
        stamp: '门',
        freeHint: true,
        hints: [
          '先把手机平放，慢慢转，直到读数停在 030 附近。',
          '绿植在门口那一侧，不在签到台这边。',
          '从起点朝东北走，走到第十二步停下，往花盆背面看。'
        ]
      },
      {
        id: 2,
        name: '第二站',
        type: 'observe',
        typeLabel: '观察',
        place: '（占位）签到台旁的海报',
        code: '7306',
        bearing: 120,
        steps: 9,
        clue: '转向东南 120°，九步。海报上有三种颜色，按红黄蓝的顺序，读右下角的数字。',
        confirm: '方向确认，去找那张写着「欢迎」的海报。',
        story: '第二段记忆：海报上的三种颜色，是你那年最喜欢的。',
        stamp: '眼',
        hints: [
          '先看海报的主色，不是小字。',
          '红黄蓝对应三个数字，顺序别反。',
          '右下角有一排小数字，只取前四位。'
        ]
      },
      {
        id: 3,
        name: '第三站',
        type: 'combine',
        typeLabel: '组合',
        place: '（占位）饮水机',
        code: '1592',
        bearing: 210,
        steps: 15,
        clue: '往西南 210°，十五步。把第一站印章上的字换成笔画数，接上第二站码的后三位，就是这站的码。',
        confirm: '方向确认，去找那台一直在响的饮水机。',
        story: '第三段记忆：有人把两句话，连成了一条线。',
        stamp: '线',
        hints: [
          '第一站的印章上有一个字，第二站的码有四位。',
          '把那个字换成笔画数，只取一位。',
          '笔画数 + 第二站码的后三位。'
        ]
      },
      {
        id: 4,
        name: '第四站',
        type: 'optional',
        typeLabel: '挑战',
        place: '（占位）路演厅后墙插座',
        code: '6048',
        bearing: 300,
        steps: 10,
        clue: '往西北 300°，十步。路演厅后墙，插座旁边那张纸。可以直接走，也可以加试一题。',
        confirm: '方向确认，去找后墙的插座。',
        story: '第四段记忆：你在桥上，做了一个选择。',
        stamp: '桥',
        bonus: { code: '2077', label: '加试题：插座旁边的数字，倒过来读' },
        hints: [
          '西北是 300°，往你的右后方转。',
          '后墙没有窗户，看插座下面。',
          '张贴纸被人挡住了一半，蹲下看。'
        ]
      },
      {
        id: 5,
        name: '第五站',
        type: 'final',
        typeLabel: '揭晓',
        place: '（占位）起点旁的空桌',
        code: '3371',
        bearing: 45,
        steps: 14,
        clue: '最后一段：往东北 45°，十四步，回到起点旁边的空桌。桌上四张纸，按印章顺序拼出最后一句。',
        confirm: '方向确认，回到起点旁的空桌。',
        story: '第五段记忆：你终于想起来，这五段都是同一天。',
        stamp: '归',
        hints: [
          '东北是 45°，正好在 030 和 090 中间。',
          '你出发时坐过的那张桌子。',
          '桌上有个纸杯，码压在杯子底下。'
        ]
      }
    ]
  },

  indoor: {
    key: 'indoor',
    name: '不出门',
    desc: '3 站 · 约 90 秒 · 摊位附近',
    par: 90,
    levels: [
      {
        id: 1,
        name: '第一站',
        type: 'tutorial',
        typeLabel: '教学',
        place: '（占位）展台右角，杯子下面',
        code: '1123',
        bearing: 20,
        steps: 3,
        clue: '往北偏东 20°，三步。展台右角，纸压在杯子下面。',
        confirm: '方向确认，去展台右角。',
        story: '第一段：展台右角，杯子下面有一句话。',
        stamp: '一',
        freeHint: true,
        hints: [
          '手机平放，慢慢转到读数 020。',
          '就在你右手边的桌角。',
          '把杯子抬起来。'
        ]
      },
      {
        id: 2,
        name: '第二站',
        type: 'observe',
        typeLabel: '观察',
        place: '（占位）椅子靠背后面',
        code: '5566',
        bearing: 200,
        steps: 4,
        clue: '往南偏西 200°，四步。你刚坐的那把椅子，纸贴在靠背后面。',
        confirm: '方向确认，去那把椅子后面。',
        story: '第二段：椅背后面，藏着另一半。',
        stamp: '二',
        hints: [
          '转身，读数到 200 再走。',
          '椅子在你身后。',
          '靠背背面，摸一下。'
        ]
      },
      {
        id: 3,
        name: '第三站',
        type: 'final',
        typeLabel: '揭晓',
        place: '（占位）笔记本电脑后面',
        code: '9087',
        bearing: 300,
        steps: 3,
        clue: '往西北 300°，三步。笔记本电脑后面，码朝上。',
        confirm: '方向确认，去电脑后面。',
        story: '第三段：电脑后面是最后一句。三段拼起来，是一句「你到了」。',
        stamp: '三',
        hints: [
          '西北是 300°，在你的右后方。',
          '电脑背面。',
          '把电脑抬一点就能看到。'
        ]
      }
    ]
  }

};

// 兼容旧入口
window.LEVELS = window.LEVEL_SETS.outdoor.levels;
