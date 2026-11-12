window.CCGS_DEMO=true;
window.CCGS49={
  meta:{release:'DEMO',repository:'内置演示数据',builtAt:'demo',counts:{roles:49,groups:4,inputs:98,collaboration:72,evals:49,evalsRun:36,workflows:9}},
  roles:[
    {id:'DEMO-01',slug:'creative-director',name:'创意总监',group:'创意',inputs:[{src:'brief',text:'产品方向'}],collaboration:[{to:'DEMO-03',dir:'collaborates_with',purpose:'体验方向'}],deliverables:['概念方案']},
    {id:'DEMO-02',slug:'game-designer',name:'游戏设计',group:'设计',inputs:[{src:'brief',text:'玩法目标'}],collaboration:[{to:'DEMO-04',dir:'collaborates_with',purpose:'视觉设计'}],deliverables:['玩法规格']},
    {id:'DEMO-03',slug:'experience-designer',name:'体验设计',group:'设计',inputs:[{src:'research',text:'用户反馈'}],collaboration:[{to:'DEMO-02',dir:'collaborates_with',purpose:'玩法体验'}],deliverables:['体验流程']},
    {id:'DEMO-04',slug:'art-director',name:'美术总监',group:'美术',inputs:[{src:'brief',text:'视觉方向'}],collaboration:[{to:'DEMO-05',dir:'reports_to',purpose:'质量检查'}],deliverables:['视觉规范']},
    {id:'DEMO-05',slug:'qa-lead',name:'质量保证',group:'质量',inputs:[{src:'build',text:'测试版本'}],collaboration:[{to:'DEMO-02',dir:'reports_to',purpose:'问题回报'}],deliverables:['验收报告']},
    {id:'DEMO-06',slug:'narrative-director',name:'叙事总监',group:'创意',inputs:[{src:'research',text:'文化资料'}],collaboration:[{to:'DEMO-01',dir:'reports_to',purpose:'叙事方向'}],deliverables:['叙事方案']},
    {id:'DEMO-07',slug:'audio-director',name:'音频总监',group:'美术',inputs:[{src:'brief',text:'情绪目标'}],collaboration:[],deliverables:['声音方案']},
    {id:'DEMO-08',slug:'localization-lead',name:'本地化主管',group:'质量',inputs:[{src:'copy',text:'文案草稿'}],collaboration:[],deliverables:['本地化清单']}
  ],
  sources:[{id:'brief',name:'产品简报',short:'简报',description:'演示输入',count:12,inputs:12,claims:0},{id:'research',name:'用户研究',short:'研究',description:'演示输入',count:8,inputs:8,claims:0},{id:'build',name:'测试版本',short:'构建',description:'演示输入',count:6,inputs:6,claims:0},{id:'copy',name:'文案草稿',short:'文案',description:'演示输入',count:5,inputs:5,claims:0}],
  workflows:[{id:'demo-flow-1',name:'概念评审',roles:['DEMO-01','DEMO-02','DEMO-03','DEMO-04']},{id:'demo-flow-2',name:'质量检查',roles:['DEMO-02','DEMO-04','DEMO-05']},{id:'demo-flow-3',name:'本地化交付',roles:['DEMO-06','DEMO-07','DEMO-08']}],
  runs:{generatedAt:'demo',runs:[],events:[],artifacts:{}}
};
(() => {
  const groups=['创意','设计','美术','质量'];
  const sources=['brief','research','build','copy'];
  const sourceLabels=['评审','规范','资产','脚本','研究','反馈','版本','构建','接口','文案','翻译','音频','图形','数据','测试','发布','运营','归档'];
  while(window.CCGS49.sources.length<18){
    const n=window.CCGS49.sources.length+1, id='demo-source-'+String(n).padStart(2,'0');
    window.CCGS49.sources.push({id,name:'演示资料源 '+String(n).padStart(2,'0'),short:sourceLabels[n-1],description:'演示输入',count:3+(n%7),inputs:3+(n%7),claims:0});
  }
  while(window.CCGS49.roles.length<49){
    const n=window.CCGS49.roles.length+1, id='DEMO-'+String(n).padStart(2,'0'), group=groups[(n-1)%groups.length], src=sources[(n-1)%sources.length];
    window.CCGS49.roles.push({id,slug:'demo-role-'+String(n).padStart(2,'0'),name:'演示岗位 '+String(n).padStart(2,'0'),group,inputs:[{src,text:'演示输入'}],collaboration:[{to:'DEMO-'+String(n===49?1:n+1).padStart(2,'0'),dir:'collaborates_with',purpose:'演示协作'}],deliverables:['演示交付物']});
  }
})();
