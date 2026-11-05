// 境界表 —— 15 个 stage。公式见 DESIGN.md §3。名称见 LORE.md §2。
export const realms = [
  {id:"lianqi_1",stage:0,name:"炼气前期",major:"炼气",majorIndex:0,qiCost:4200,baseRate:2,minorChance:0.9,lifespan:100,baseStats:{hp:120,mp:60,atk:14,def:8,spd:10,crit:0.05},tribulation:null},
  {id:"lianqi_2",stage:1,name:"炼气中期",major:"炼气",majorIndex:0,qiCost:12000,baseRate:3.6,minorChance:0.9,lifespan:100,baseStats:{hp:170,mp:81,atk:20,def:11,spd:12,crit:0.05},tribulation:null},
  {id:"lianqi_3",stage:2,name:"炼气后期",major:"炼气",majorIndex:0,qiCost:33000,baseRate:6.48,minorChance:0.9,lifespan:100,baseStats:{hp:240,mp:110,atk:27,def:16,spd:14,crit:0.05},tribulation:{name:"初雷劫",rounds:3,power:1.8,lethal:false}},
  {id:"zhuji_1",stage:3,name:"筑基前期",major:"筑基",majorIndex:1,qiCost:98000,baseRate:11.7,minorChance:0.85,lifespan:220,baseStats:{hp:330,mp:150,atk:38,def:22,spd:16,crit:0.06},tribulation:null},
  {id:"zhuji_2",stage:4,name:"筑基中期",major:"筑基",majorIndex:1,qiCost:270000,baseRate:21,minorChance:0.85,lifespan:220,baseStats:{hp:460,mp:200,atk:54,def:31,spd:18,crit:0.06},tribulation:null},
  {id:"zhuji_3",stage:5,name:"筑基后期",major:"筑基",majorIndex:1,qiCost:640000,baseRate:37.8,minorChance:0.85,lifespan:220,baseStats:{hp:650,mp:270,atk:75,def:43,spd:20,crit:0.06},tribulation:{name:"三九雷劫",rounds:5,power:4.8,lethal:false}},
  {id:"jindan_1",stage:6,name:"金丹前期",major:"金丹",majorIndex:2,qiCost:1700000,baseRate:68,minorChance:0.8,lifespan:500,baseStats:{hp:900,mp:360,atk:110,def:60,spd:22,crit:0.07},tribulation:null},
  {id:"jindan_2",stage:7,name:"金丹中期",major:"金丹",majorIndex:2,qiCost:4100000,baseRate:122,minorChance:0.8,lifespan:500,baseStats:{hp:1300,mp:490,atk:150,def:84,spd:24,crit:0.07},tribulation:null},
  {id:"jindan_3",stage:8,name:"金丹后期",major:"金丹",majorIndex:2,qiCost:9100000,baseRate:220,minorChance:0.8,lifespan:500,baseStats:{hp:1800,mp:660,atk:210,def:120,spd:26,crit:0.07},tribulation:{name:"紫霄雷劫",rounds:7,power:5.5,lethal:true}},
  {id:"yuanying_1",stage:9,name:"元婴前期",major:"元婴",majorIndex:3,qiCost:20000000,baseRate:397,minorChance:0.75,lifespan:1000,baseStats:{hp:2500,mp:890,atk:290,def:170,spd:28,crit:0.08},tribulation:null},
  {id:"yuanying_2",stage:10,name:"元婴中期",major:"元婴",majorIndex:3,qiCost:45000000,baseRate:714,minorChance:0.75,lifespan:1000,baseStats:{hp:3500,mp:1200,atk:400,def:230,spd:30,crit:0.08},tribulation:null},
  {id:"yuanying_3",stage:11,name:"元婴后期",major:"元婴",majorIndex:3,qiCost:98000000,baseRate:1290,minorChance:0.75,lifespan:1000,baseStats:{hp:4900,mp:1600,atk:570,def:320,spd:32,crit:0.08},tribulation:{name:"九幽心雷劫",rounds:9,power:6.0,lethal:true}},
  {id:"huashen_1",stage:12,name:"化神前期",major:"化神",majorIndex:4,qiCost:200000000,baseRate:2310,minorChance:0.7,lifespan:2000,baseStats:{hp:6800,mp:2200,atk:790,def:450,spd:34,crit:0.09},tribulation:null},
  {id:"huashen_2",stage:13,name:"化神中期",major:"化神",majorIndex:4,qiCost:420000000,baseRate:4160,minorChance:0.7,lifespan:2000,baseStats:{hp:9500,mp:3000,atk:1100,def:630,spd:36,crit:0.09},tribulation:null},
  {id:"huashen_3",stage:14,name:"化神后期",major:"化神",majorIndex:4,qiCost:980000000,baseRate:7500,minorChance:0.7,lifespan:2000,baseStats:{hp:13000,mp:4000,atk:1600,def:890,spd:38,crit:0.09},tribulation:{name:"登穹雷劫",rounds:9,power:6.5,lethal:true}},
];
