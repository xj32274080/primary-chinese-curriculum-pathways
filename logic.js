function kbPageText(it){
  if(it && it.pageSpan && it.pdfPageSpan){
    return '印刷页 ' + it.pageSpan + '／PDF页 ' + it.pdfPageSpan;
  }
  const p = (it && it.page) || 0;
  return '印刷页 ' + p + '／PDF页 ' + (p + 3);
}

const U = D.units, L = D.lines, LINKS = D.links;

/* ================= 通用工具 ================= */
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function getUnlinkedReview(eid){
  return (D.unlinkedReview||{})[eid] || {label:"未纳入现有脉络",note:"目前没有建立关联记录；不据此推断教材或课标没有相关要求。"};
}
function el(eid){
  const uid = eid.slice(0, eid.lastIndexOf("-"));
  const u = U[uid]; if(!u) return null;
  const e = u.elements.find(x=>x.eid===eid);
  return e ? {u, e, uid} : null;
}
const VOL_LIST = ["一上","一下","二上","二下","三上","三下","四上","四下","五上","五下","六上","六下"];
const CN_NUMS = "一二三四五六七八九十";
function volOrder(v){return VOL_LIST.indexOf(v);}

function nodeOrderKey(eid){
  const parts = eid.split("-");
  const v = parts[0], u = parts[1], seq = parseInt(parts[2]||"1", 10);
  return volOrder(v) * 1000 + (CN_NUMS.indexOf(u)+1) * 10 + seq;
}

/* 来源信息：低年级教参 / 教材导语原文（导出版沿用既有口径，不改写） */
function getSourceInfo(u, e){
  if(u.xueduan === 1){
    if(e && e.sourceInfo){
      return {type:e.sourceInfo.type||"教参单元说明",badge:e.sourceInfo.badge||"教师用书单元说明原页",desc:e.sourceInfo.display||"",bookPageText:e.sourceInfo.display||""};
    }
    return {
      type: "教参单元说明",
      badge: "教参单元说明（页码待补）",
      desc: "课本不设导语页（起始第 "+u.page+" 页）；要素取自教师教学用书「单元说明」（教参页码待补）",
      bookPageText: "课本起始第 "+u.page+" 页（不设导语页）"
    };
  } else {
    if(e && e.sourceInfo){
      return {
        type: "教材导语原文",
        badge: e.sourceInfo.badge || "教材＋教参原页已核",
        desc: "课本第 "+u.page+" 页导语页原文；教参说明与核验：" + e.sourceInfo.display,
        bookPageText: "课本第 "+u.page+" 页导语页"
      };
    }
    return {
      type: "教材导语原文",
      badge: "教材导语原文",
      desc: "课本第 "+u.page+" 页导语页原文",
      bookPageText: "课本第 "+u.page+" 页导语页"
    };
  }
}

function getUnitThemeInfo(u){
  const text = u.theme || u['人文主题'] || "";
  if(!text) return null;
  return { text, sourceLabel: u.xueduan === 1 ? "教参单元说明" : "教材单元导语" };
}

const SCOPE_NOTE = D.meta.scopeNote || "本表当前整理五条试验脉络；其他已收录要素尚未建立关联记录，不据此判断教材或课标要求。";
function themeClusterForUnit(uid){
  return (D.humanThemeClusters||[]).find(cluster=>(cluster.units||[]).some(item=>item.unitId===uid)) || null;
}
function themeSourceText(item){
  const source = item.source||{};
  return [source.title, source.file, "印刷页 "+source.printPage+"／PDF页 "+source.pdfPage].filter(Boolean).join("；");
}
function themeUnitLabel(item){
  const u = U[item.unitId];
  if(!u) return item.unitId;
  const vs = D.versions[u.vol]||{};
  return (vs.name0||u.vol)+" 第"+u.unit+"单元";
}

function kbCard(xd, dom, no){
  const items = (D.kbiao[xd] && D.kbiao[xd].domains[dom]) || [];
  return items.find(x=>x.no===no) || null;
}

/* ================= 统一的依据选择逻辑（页面、PNG、PDF、Markdown 完全共用） ================= */
function evidenceLinksOf(eid, viewLinks){
  return viewLinks.length ? viewLinks : ((D.unitEvidenceMap||{})[eid] ? [{line:"本单元目标",unitOnly:true}] : []);
}
function getElementEvidences(eid, lk){
  const g = el(eid);
  if(!g || !lk) return { directTargets: [], otherTargets: [], directQualities: [], otherQualities: [] };
  const { u, e } = g;
  const lineName = lk.line;
  const L2 = L[lineName] || {};
  const curXdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "第三学段";

  const directTargets = [];
  const otherTargets = [];
  const seenKb = {};

  const elemMap = lk.unitOnly ? (D.unitEvidenceMap||{})[eid] : (D.elementEvidenceMap && D.elementEvidenceMap[eid] && D.elementEvidenceMap[eid][lineName]) || null;

  if(elemMap && elemMap.directTargets && elemMap.directTargets.length > 0){
    for(const dt of elemMap.directTargets){
      const k = dt.xd + dt.dom + dt.no;
      if(seenKb[k]) continue;
      seenKb[k] = 1;
      const it = kbCard(dt.xd, dt.dom, dt.no);
      if(it){
        directTargets.push({
          xd: dt.xd, dom: dt.dom, no: dt.no, it: it,
          desc: dt.reason || lk.line,
          reason: dt.reason || lk.line,
          isDirect: true
        });
      }
    }
  } else if(elemMap && elemMap.perElement === true){
    // An audited empty direct list means this item has no direct course-target mapping.
  } else {
    for(const [xd, dom, no] of (L2.kbiao || [])){
      if(xd === curXdName){
        const k = xd + dom + no;
        if(seenKb[k]) continue;
        seenKb[k] = 1;
        const it = kbCard(xd, dom, no);
        if(!it) continue;
        directTargets.push({
          xd: xd, dom: dom, no: no, it: it,
          desc: "【本学段直接目标】" + lk.line,
          reason: "【本学段直接目标】" + lk.line,
          isDirect: true
        });
      }
    }
  }

  if(elemMap && elemMap.perElement === true){
    for(const ot of (elemMap.otherTargets || [])){
      const k = ot.xd + ot.dom + ot.no;
      if(seenKb[k]) continue;
      seenKb[k] = 1;
      const it = kbCard(ot.xd, ot.dom, ot.no);
      if(it) otherTargets.push({xd:ot.xd,dom:ot.dom,no:ot.no,it:it,desc:ot.reason||lk.line,reason:ot.reason||lk.line,isDirect:false});
    }
  } else {
    for(const [xd, dom, no] of (L2.kbiao || [])){
      const k = xd + dom + no;
      if(seenKb[k]) continue;
      seenKb[k] = 1;
      const it = kbCard(xd, dom, no);
      if(!it) continue;
      otherTargets.push({
        xd: xd, dom: dom, no: no, it: it,
        desc: "【其他相关目标】" + lk.line,
        reason: "【其他相关目标】" + lk.line,
        isDirect: false
      });
    }
  }

  let directQualities = [];
  let otherQualities = [];

  if(elemMap && Array.isArray(elemMap.directQualities) && Array.isArray(elemMap.otherQualities)){
    directQualities = elemMap.directQualities.slice();
    otherQualities = elemMap.otherQualities.slice();
  } else if(curXdName !== "第三学段"){
    directQualities = [];
    otherQualities = (L2.quality || []).slice();
  } else {
    if(elemMap && elemMap.directQualities){
      directQualities = (elemMap.directQualities || []).slice();
      otherQualities = (elemMap.otherQualities || []).slice();
    } else {
      if(lineName === "资料运用"){
        directQualities = [];
        otherQualities = [];
      } else {
        directQualities = (L2.quality || []).slice();
        otherQualities = [];
      }
    }
  }

  return { directTargets, otherTargets, directQualities, otherQualities };
}

/* 全部路径视图：按条目合并依据，保留路径归属与关联性质 */
function mergeEvidences(eid, viewLinks){
  const targetMap = new Map(), qualityMap = new Map();
  const push = (map, k, item, lineName, isDirect, fallbackReason)=>{
    const reason = item.reason || item.desc || fallbackReason;
    const ex = map.get(k);
    if(ex){
      if(!ex.paths.includes(lineName)) ex.paths.push(lineName);
      if(!ex.reasons.includes(reason)) ex.reasons.push(reason);
      ex.isDirect = ex.isDirect || isDirect;
      if(!ex.pathRelations.some(r=>r.line===lineName && r.reason===reason && r.isDirect===isDirect)){
        ex.pathRelations.push({line:lineName, reason, isDirect});
      }
    } else {
      map.set(k, Object.assign({}, item, {
        paths:[lineName], reasons:[reason], isDirect,
        pathRelations:[{line:lineName, reason, isDirect}]
      }));
    }
  };
  for(const lk of evidenceLinksOf(eid, viewLinks)){
    const ev = getElementEvidences(eid, lk);
    for(const t of ev.directTargets) push(targetMap, t.xd+t.dom+t.no, t, lk.line, true, "【直接目标】"+lk.line);
    for(const t of ev.otherTargets) push(targetMap, t.xd+t.dom+t.no, t, lk.line, false, "【其他相关目标】"+lk.line);
    for(const q of ev.directQualities) push(qualityMap, q.xueduan+(q.printPage||"")+(q.short||""), q, lk.line, true, "【直接质量参照】"+lk.line);
    for(const q of ev.otherQualities) push(qualityMap, q.xueduan+(q.printPage||"")+(q.short||""), q, lk.line, false, "【综合拓展参照】"+lk.line);
  }
  const targets = [...targetMap.values()], qualities = [...qualityMap.values()];
  return {
    directTargets: targets.filter(x=>x.isDirect),
    otherTargets: targets.filter(x=>!x.isDirect),
    directQualities: qualities.filter(x=>x.isDirect),
    otherQualities: qualities.filter(x=>!x.isDirect)
  };
}

/* ================= 状态 ================= */
let filterVol = "全部", filterState = "全部", scrollY = 0, curEid = null;
let curView = "all"; // "all" 或路径序号
let themePanelOpen = false;

/* ================= 要素页的相关阅读方法：辅助比较与迁移建议 ================= */
function relatedReadingMethodsOf(eid){
  const comparison = D.strategyComparison;
  const own = comparison.rows.find(row=>row.eid===eid);
  const support = (D.methodSupportMap||{})[eid];
  if(!own && !support) return null;
  return {rows:own ? comparison.rows : comparison.rows.filter(row=>support.methodEids.includes(row.eid)),support};
}
function methodSourceText(row){
  return row.source.split(/[\\/]/).pop()+' · 印刷第'+row.printPage+'页／PDF第'+row.pdfPage+'页';
}
function relatedReadingMethodsHTML(eid){
  const related = relatedReadingMethodsOf(eid);
  if(!related) return "";
  const comparison = D.strategyComparison;
  let rows = "", sources = "";
  for(const row of related.rows){
    const current = row.eid === eid;
    rows += '<tr'+(current?' class="strategy-current"':'')+'><th scope="row"><b>'+esc(row.strategy)+'</b>'+
      (current ? '<span class="strategy-current-unit">'+esc(row.unit)+' · 当前要素</span>' : '<button class="strategy-unit" data-strategy-eid="'+esc(row.eid)+'">'+esc(row.unit)+'</button>')+'</th>'+
      '<td data-label="主要阅读问题">'+esc(row.problem)+'</td>'+
      '<td data-label="怎样运用 · 教参归纳">'+esc(row.method)+'</td>'+
      '<td data-label="可观察表现 · 课堂建议">'+esc(row.observable)+'</td></tr>';
    sources += '<article><h3>'+esc(row.unit)+'</h3><p class="strategy-original">'+esc(row.text)+'</p>'+
      '<p>'+esc(methodSourceText(row))+'</p>'+
      '<p>'+esc(row.boundary)+'</p></article>';
  }
  const support = related.support;
  return '<details class="strategy-related"><summary class="details-summary">相关阅读方法 <span class="lbl jd">'+(support?esc(support.relationType):'教研比较')+'</span></summary><div class="strategy-panel">'+
    (support?'<p class="strategy-support">'+esc(support.reason)+'</p>':'')+
    '<table class="strategy-table" aria-label="相关阅读方法用途比较"><thead><tr><th scope="col">方法与单元</th><th scope="col">主要阅读问题</th>'+ 
    '<th scope="col">怎样运用<span>教参归纳</span></th><th scope="col">可观察表现<span>课堂观察建议</span></th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<details class="strategy-sources"><summary class="details-summary">教材原句与教参依据</summary><div class="details-body">'+
    '<p>'+esc(comparison.nature)+'。'+esc(comparison.sequenceNote)+'</p>'+
    (support?'<p><b>适用条件：</b>'+esc(support.conditions)+'</p><p><b>课堂观察建议：</b>'+esc(support.observable)+'</p><p>'+esc(support.provenance)+'</p>':'<p>'+esc(comparison.scopeNote)+'</p>')+
    '<div class="strategy-source-grid">'+sources+'</div>'+
    (support?'':'<p>'+esc(comparison.arrangementNote)+'</p>')+'</div></details></div></details>';
}

/* ================= 同单元读写／实践关系：独立于跨单元脉络 ================= */
function sameUnitRelationsOf(eid){
  return (D.sameUnitRelations||[]).filter(row=>row.from===eid || row.to===eid).map(row=>({
    row,
    otherEid: row.from===eid ? row.to : row.from
  }));
}
function elementLabel(eid){
  const g = el(eid); if(!g) return eid;
  const v = D.versions[g.u.vol] || {};
  return (v.name0||g.u.vol)+' 第'+g.u.unit+'单元';
}
function relationSourceText(source){
  if(!source) return '';
  const file = (source.file||'').split(/[\\/]/).pop();
  return (source.title||'教师用书原页')+' · '+file+' · 印刷页 '+(source.printPage||'待补')+'／PDF页 '+(source.pdfPage||'待补');
}
function sameUnitRelationHTML(eid){
  const rows = sameUnitRelationsOf(eid);
  if(!rows.length) return '';
  let cards = '';
  for(const item of rows){
    const r = item.row, g2 = el(item.otherEid);
    if(!g2) continue;
    const source = r.source||{};
    cards += '<article class="same-unit-rel-card">'+
      '<div class="same-unit-rel-head"><span class="lbl jd">'+esc(r.relationType||'同单元相关')+'</span> '+
      '<button class="same-unit-rel-link" type="button" data-same-unit-eid="'+esc(item.otherEid)+'">'+esc(elementLabel(item.otherEid))+'</button></div>'+
      '<p class="same-unit-rel-element">'+esc(g2.e.text)+'</p>'+
      '<p class="same-unit-rel-summary">'+esc(r.summary||'')+'</p>'+
      '<details class="same-unit-rel-source"><summary class="details-summary">依据与边界</summary><div class="details-body">'+
      '<p>'+esc(r.boundary||'')+'</p>'+
      '<p><b>教参定位：</b>'+esc(relationSourceText(source))+'</p>'+ 
      '<p><b>教参原句：</b>'+esc(source.quote||'')+'</p>'+ 
      (source.versionNote?'<p><b>版本备注：</b>'+esc(source.versionNote)+'</p>':'')+
      '<p><b>核定状态：</b>'+esc(r.status||'')+'</p></div></details></article>';
  }
  if(!cards) return '';
  return '<details class="same-unit-relations"><summary class="details-summary">同单元相关 <span class="lbl jd">读写／实践配合</span></summary><div class="same-unit-rel-panel">'+
    '<p class="same-unit-rel-note">这里记录同一单元内阅读、习作或实践任务的配合关系，不计入跨单元能力脉络，也不表示先修顺序。</p>'+cards+'</div></details>';
}
function sameUnitRelationPrintHTML(eid){
  const rows = sameUnitRelationsOf(eid);
  if(!rows.length) return '';
  let cards = '';
  for(const item of rows){
    const r = item.row, g2 = el(item.otherEid);
    if(!g2) continue;
    const source = r.source||{};
    cards += '<div class="p-rel-card"><div><strong>'+esc(elementLabel(item.otherEid))+'</strong>　<span class="p-rel-type">'+esc(r.relationType||'同单元相关')+'</span></div>'+ 
      '<div class="p-rel-element">'+esc(g2.e.text)+'</div><p>'+esc(r.summary||'')+'</p>'+ 
      '<p class="p-rel-boundary">边界：'+esc(r.boundary||'')+'</p>'+ 
      '<p class="p-rel-source">依据：'+esc(relationSourceText(source))+'<br>原句：'+esc(source.quote||'')+(source.versionNote?'<br>版本备注：'+esc(source.versionNote):'')+'</p></div>';
  }
  if(!cards) return '';
  return '<div class="p-same-relations"><div class="p-std-title">同单元相关（读写／实践配合）</div>'+ 
    '<p class="p-rel-intro">同单元关系不计入跨单元能力脉络，也不表示先修顺序。</p>'+cards+'</div>';
}

/* ================= 第一层：全表 ================= */
function renderTools(){
  const vols = ["全部"].concat(Object.keys(D.versions).sort((a,b)=>volOrder(a)-volOrder(b)));
  let h = '<span style="font-size:12px;color:var(--muted)">按册定位</span>';
  for(const v of vols){
    h += '<button class="btn" data-vol="'+v+'" aria-pressed="'+(v===filterVol)+'">'+v+'</button>';
  }
  h += '<span style="font-size:12px;color:var(--muted);margin-left:8px">关联状态</span>';
  for(const s of ["全部","有已整理关联","未进入现有脉络"]){
    h += '<button class="btn" data-state="'+s+'" aria-pressed="'+(s===filterState)+'">'+s+'</button>';
  }
  h += '<span class="spacer"></span>';
  h += '<button class="btn" id="expandAll">查看全表</button>';
  document.getElementById("tools").innerHTML = h;
  document.querySelectorAll("[data-vol]").forEach(b=>b.addEventListener("click",()=>{
    filterVol = b.dataset.vol; renderTools(); renderTable();
  }));
  document.querySelectorAll("[data-state]").forEach(b=>b.addEventListener("click",()=>{
    filterState = b.dataset.state; renderTools(); renderTable();
  }));
  document.getElementById("expandAll").addEventListener("click",()=>{
    document.getElementById("table").scrollIntoView({behavior:"smooth",block:"start"});
  });
}

function renderTable(){
  const vols = Object.keys(D.versions).sort((a,b)=>volOrder(a)-volOrder(b));
  let h = "";
  for(const v of vols){
    if(filterVol !== "全部" && filterVol !== v) continue;
    const vs = D.versions[v];
    const us = Object.values(U).filter(u=>u.vol===v).sort((a,b)=>"一二三四五六七八".indexOf(a.unit)-"一二三四五六七八".indexOf(b.unit));
    h += '<div class="volhead"><b>'+esc(vs.name0||v)+'</b></div><div class="units">';
    for(const u of us){
      let n = 0;
      let els = "";
      for(const e of u.elements){
        const lk = LINKS[e.eid] || [];
        const linked = lk.length > 0;
        if(linked) n++;
        if(filterState === "有已整理关联" && !linked) continue;
        if(filterState === "未进入现有脉络" && linked) continue;
        const badge = linked ? lk.map(x=>x.line).join(" · ") : getUnlinkedReview(e.eid).label;
        els += '<button class="el'+(linked?" linked":"")+'" data-eid="'+e.eid+'">'+
               '<span class="no">'+e.seq+'</span>'+esc(e.text)+
               '<span class="badge'+(linked?"":" todo")+'">'+esc(badge)+'</span></button>';
      }
      if(filterState !== "全部" && !els) continue; // 该单元在当前筛选下无可列要素
      const uTheme = getUnitThemeInfo(u);
      const srcInfo = getSourceInfo(u);
      h += '<div class="unit"><h4>第'+u.unit+'单元 <span>'+esc(srcInfo.bookPageText)+'</span>'+
           (n?'<span class="badge" style="background:#eef4f1;color:#2f5d50;border:1px solid #bcd3ca">已整理 '+n+'/'+u.elements.length+'</span>':'')+
           '</h4>'+
            (uTheme ? '<div class="theme">🌿 单元主题表述（'+esc(uTheme.sourceLabel)+'）：'+esc(uTheme.text)+'</div>' : '')+
           (els || '<div class="empty" style="padding:8px 10px">本单元要素在当前筛选下无可列条目。</div>')+'</div>';
    }
    h += '</div>';
  }
  document.getElementById("table").innerHTML = h;
  document.querySelectorAll("#table [data-eid]").forEach(b=>b.addEventListener("click",()=>openElement(b.dataset.eid)));
}

/* ================= 第二层：脉络图 ================= */
function openElement(eid){
  if(document.getElementById("table").style.display !== "none") scrollY = window.scrollY;
  curEid = eid; curView = "all";
  themePanelOpen = false;
  document.getElementById("table").style.display = "none";
  document.getElementById("detail").style.display = "block";
  renderDetail();
  window.scrollTo(0,0);
}
function closeDetail(){
  document.getElementById("detail").style.display = "none";
  document.getElementById("table").style.display = "block";
  window.scrollTo(0, scrollY);
}

function viewLinksOf(){
  const links = LINKS[curEid] || [];
  if(!links.length) return [];
  return curView === "all" ? links : [links[curPathSafe()]];
}
function curPathSafe(){
  const links = LINKS[curEid] || [];
  return Math.min(parseInt(curView,10)||0, links.length-1);
}

/* 当前要素关联说明：节点说明 → 路径说明 → 原文（与原文重复时返回空，避免重复展示） */
function currentLinkNote(e, lk, curNode){
  const raw = (curNode && curNode.link) || (lk && lk.link) || "";
  if(!raw || raw === e.text) return "";
  return raw;
}

function pathNoteHTML(lineName){
  const note = L[lineName] && L[lineName].note;
  return note ? '<details class="path-note"><summary class="details-summary">脉络说明</summary>'+ 
    '<div class="details-body">'+esc(note)+'</div></details>' : "";
}

/* ---- 中心要素卡片（查看依据收纳元信息） ---- */
function makeCenterCard(g, linkNoteText, extraClass){
  const {u, e} = g;
  const vs = D.versions[u.vol] || {};
  const srcInfo = getSourceInfo(u, e);
  const uTheme = getUnitThemeInfo(u);
  const themeCluster = themeClusterForUnit(u.id);
  const xdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "";
  return '<div class="center '+(extraClass||'')+'">'+
         '<div class="ch"><b>'+esc(vs.name0||u.vol)+' 第'+u.unit+'单元</b><span>'+esc(xdName)+'</span>'+ 
         '<button type="button" class="details-toggle" data-details-toggle aria-expanded="false">查看依据</button></div>'+ 
         '<div class="ct">'+esc(e.text)+'</div>'+
         '<div class="cm">'+
         '<span class="source-tag">'+esc(srcInfo.badge)+'</span>'+
         (LINKS[e.eid]&&LINKS[e.eid].length?'':'<span class="lbl2 todo">'+esc(getUnlinkedReview(e.eid).label)+'</span>')+
         (e.orient ? '<span class="lbl2 src">'+esc(e.orient)+'</span>' : '')+
          (uTheme ? '<span class="theme-tag">🌿 '+esc(uTheme.sourceLabel)+'：'+esc(uTheme.text)+'</span>' : '')+
         (themeCluster ? '<button class="theme-open-btn" type="button" data-theme-toggle>'+(themePanelOpen?'收起主题检索':'查看同主题单元')+'</button>' : '')+
         '</div>'+ 
         (linkNoteText ? '<div class="cnote"><b>关联概括：</b>'+esc(linkNoteText)+'</div>' : '')+
         '<div class="details-body center-details-body toggle-details-body" hidden>'+ 
         '<div class="row"><span class="k">来源：</span>'+esc(srcInfo.desc)+'</div>'+ 
         (LINKS[e.eid]&&LINKS[e.eid].length?'':'<div class="row"><span class="k">脉络状态：</span>'+esc(getUnlinkedReview(e.eid).note)+'</div>')+
         (e.orient ? '<div class="row"><span class="k">取向标注：</span>'+esc(e.orient)+'（'+esc(e.orientNote||"")+'）——整理分类，非教材原文</div>' : '')+ 
         '<div class="row"><span class="k">要素编号：</span>'+esc(e.eid)+'（第 '+e.seq+' 条）</div>'+ 
          (e.historyId ? '<div class="row"><span class="k">历史编号与迁移：</span>原ID '+esc(e.historyId)+'；'+esc(e.migrationNote||"")+'</div>' : '')+ 
         '</div>'+ 
         '</div>';
}

/* ---- 侧边节点卡片：册别单元 + 完整原文 + 关联与出处（按需展开） ---- */
function nodeCardHTML(n, hidden, viewedLineSet){
  const g2 = el(n.eid); if(!g2) return "";
  const u2 = g2.u;
  const vs2 = D.versions[u2.vol] || {};
  const src2 = getSourceInfo(u2, g2.e);
  const lks2 = D.links[n.eid] || [];
  const otherLines = lks2.map(x=>x.line).filter(ln=>!viewedLineSet.has(ln));
  let rows = "";
  if(n.link && n.link !== g2.e.text){
    rows += '<div class="row"><span class="link-label">关联解读</span>'+esc(n.link)+'</div>';
  }
  rows += '<div class="row"><span class="k">来源：</span>'+esc(src2.badge)+'　'+esc(src2.bookPageText)+'</div>';
  rows += '<div class="row"><span class="k">要素编号：</span>'+esc(n.eid)+'</div>';
  if(g2.e.sourceInfo && g2.e.sourceInfo.display && g2.e.sourceInfo.display !== src2.bookPageText){
    rows += '<div class="row"><span class="k">出处说明：</span>'+esc(g2.e.sourceInfo.display)+'</div>';
  }
  if(otherLines.length) rows += '<div class="row"><span class="k">该要素还关联：</span>'+esc(otherLines.join("、"))+'</div>';
  return '<div class="node"'+(hidden?' data-hidden style="display:none"':'')+'>'+
         '<div class="nh"><b>'+esc(vs2.name0||u2.vol)+' 第'+u2.unit+'单元</b>'+ 
         '<button type="button" class="details-toggle" data-details-toggle aria-expanded="false">关联与出处</button></div>'+ 
         '<div class="node-text">'+esc(g2.e.text)+'</div>'+ 
         '<div class="details-body node-details-body toggle-details-body" hidden>'+rows+'</div>'+ 
         '</div>';
}

/* ---- 一侧栏：代表节点规则沿用（key 优先；无 key 时 pre 取末2 / post 取前2） ---- */
function sideColumnHTML(list, kind, viewedLineSet){
  if(!list.length) return '<div class="empty">本侧暂无可列节点。</div>';
  let keys = list.filter(n=>n.key);
  if(!keys.length) keys = (kind === "pre") ? list.slice(-2) : list.slice(0,2);
  else keys = (kind === "pre") ? keys.slice(-2) : keys.slice(0,2);
  const showSet = new Set(keys.map(n=>n.eid));
  let h = "";
  for(const n of list){
    h += nodeCardHTML(n, !showSet.has(n.eid), viewedLineSet);
  }
  const nHidden = list.length - showSet.size;
  if(nHidden > 0){
    h += '<button class="more" data-more>展开其余相关节点（还有 '+nHidden+' 个）</button>';
  }
  return h;
}

/* ---- 课标依据区（学段目标 / 学业质量参照） ---- */
function kbItemHTML(t, opts){
  const o = opts || {};
  const unitOnly = t.paths && t.paths.length === 1 && t.paths[0] === "本单元目标";
  const refLine = esc(t.xd+'　'+t.dom+' 第'+t.no+'条');
  const pathTag = (!unitOnly && t.paths && t.paths.length)
    ? '　<span class="lbl jd">'+esc(t.paths.join("、"))+'</span>' : '';
  const kinds = t.pathRelations
    ? [...new Set(t.pathRelations.map(r=>{const m=(r.reason||"").match(/^【([^】]+)】/); return m?m[1]:"";}).filter(Boolean))]
    : (t.reasons||[]).map(r=>r.replace(/^【|】.*$/g,"").slice(0,6));
  const nature = kinds.length ? '　<span class="lbl">'+esc(kinds.join("／"))+'</span>' : '';
  let fullRows = '<div class="row"><span class="lbl src">课标原文</span>'+esc(t.it.text)+'</div>'+
    '<div class="row"><span class="k">定位：</span>'+esc(t.xd+' '+t.dom+' 第'+t.no+'条　'+kbPageText(t.it))+'</div>';
  if(t.it.note) fullRows += '<div class="row"><span class="k">附注：</span>'+esc(t.it.note)+'</div>';
  if(t.pathRelations && t.pathRelations.length){
    fullRows += '<div class="row"><span class="k">'+(unitOnly?'对应性质：':'路径与关联性质：')+'</span>'+esc(t.pathRelations.map(r=>r.line+'：'+r.reason).join("；"))+'</div>';
  } else if(t.reasons && t.reasons.length){
    fullRows += '<div class="row"><span class="k">关联性质：</span>'+esc(t.reasons.join("；"))+'</div>';
  }
  if(!t.pathRelations && t.paths && t.paths.length){
    fullRows += '<div class="row"><span class="k">关联路径：</span>'+esc(t.paths.join("、"))+'</div>';
  }
  return '<div class="kbitem'+(o.dim?' style="opacity:0.85;margin-top:6px"':'')+'">'+
         '<div class="ref">'+refLine+pathTag+nature+'</div>'+
         '<div class="short"><span class="short-text">'+esc(t.it.short || t.it.text)+'</span>'+ 
         '<details class="kb-details"><summary class="details-summary">查看原文与出处</summary>'+ 
         '<div class="details-body">'+fullRows+'</div></details></div>'+ 
         '</div>';
}

function quItemHTML(q, label, opts){
  const o = opts || {};
  const unitOnly = q.paths && q.paths.length === 1 && q.paths[0] === "本单元目标";
  const pathTag = (!unitOnly && q.paths && q.paths.length)
    ? '　<span class="lbl jd">'+esc(q.paths.join("、"))+'</span>' : '';
  let fullRows = '<div class="row"><span class="lbl src">课标原文</span>'+esc(q.text)+'</div>'+
    '<div class="row"><span class="k">定位：</span>'+esc(q.chapter+'　印刷页 '+q.printPage+'／PDF页 '+q.pdfPage)+'</div>'+
    '<div class="row"><span class="k">要点：</span>'+esc(q.short)+'</div>';
  if(q.scope) fullRows += '<div class="row"><span class="k">适用范围：</span>'+esc(q.scope)+'</div>';
  if(q.pathRelations && q.pathRelations.length) fullRows += '<div class="row"><span class="k">'+(unitOnly?'参照性质：':'路径与参照性质：')+'</span>'+esc(q.pathRelations.map(r=>r.line+'：'+r.reason).join("；"))+'</div>';
  else if(q.paths && q.paths.length) fullRows += '<div class="row"><span class="k">关联路径：</span>'+esc(q.paths.join("、"))+'</div>';
  return '<div class="kbitem'+(o.dim?' style="opacity:0.85;margin-top:6px"':'')+'">'+
         '<div class="ref">'+esc(label)+pathTag+'</div>'+ 
         '<div class="short"><span class="short-text"><span class="point-badge">要点·概括</span>'+esc(q.short)+'</span>'+ 
         '<details class="kb-details"><summary class="details-summary">查看原文与出处</summary>'+ 
         '<div class="details-body">'+fullRows+'</div></details></div>'+ 
         '</div>';
}

function qualityReferenceGroups(qualities, currentStage){
  const stageOrder = {"第一学段":1,"第二学段":2,"第三学段":3};
  const currentOrder = stageOrder[currentStage] || 0;
  const groups = { same:[], later:[], earlier:[] };
  for(const q of qualities || []){
    const order = stageOrder[q.xueduan] || 0;
    if(order === currentOrder) groups.same.push(q);
    else if(order > currentOrder) groups.later.push(q);
    else groups.earlier.push(q);
  }
  return groups;
}

function themePanelHTML(u){
  const cluster = themeClusterForUnit(u&&u.id);
  if(!themePanelOpen || !cluster) return "";
  const relatedHTML = cluster.units.map(item=>{
    const relatedUnit = U[item.unitId];
    if(!relatedUnit) return "";
    const relatedTheme = getUnitThemeInfo(relatedUnit);
    const vs = D.versions[relatedUnit.vol] || {};
    const elements = relatedUnit.elements.map(e=>
      '<button class="theme-element" type="button" data-theme-eid="'+esc(e.eid)+'">'+
      '<span class="theme-element-kind">'+esc(e.orient||"单元要素")+'</span>'+esc(e.text)+
      '<span class="theme-element-action">查看该要素脉络 →</span></button>'
    ).join("");
    const source = item.source||{};
    const support = item.supportSource||null;
    return '<article class="theme-candidate'+(relatedUnit.id===u.id?' is-current':'')+'">'+
      '<div class="theme-candidate-head"><b>'+esc(themeUnitLabel(item))+'</b>'+ 
      '<span>'+(relatedUnit.id===u.id?'当前单元 · ':'')+esc(vs.state||"版本待核")+'</span></div>'+
      (relatedTheme ? '<blockquote><span>单元主题 · '+esc(item.kind||source.type||"主题表述")+'</span>“'+esc(relatedTheme.text)+'”</blockquote>' : '')+
      '<p class="theme-reason">'+esc(item.reason)+'</p>'+
      '<details class="theme-source"><summary class="details-summary">主题出处</summary><div>'+esc(source.type||"来源类型待核")+'；'+esc(source.title||"")+'；'+esc(source.file||"")+'，印刷页 '+esc(source.printPage||"待补")+'／PDF页 '+esc(source.pdfPage||"待补")+'。'+
      (support?'<br>辅助理解：'+esc(support.type)+'；'+esc(support.title)+'；'+esc(support.publication||"")+'。<br><a href="'+esc(support.url||"#")+'" target="_blank" rel="noopener">打开出版社刊载原文（PDF）</a>':'')+'</div></details>'+
      '<details class="theme-elements"><summary class="details-summary">选择查看该单元的语文要素（'+relatedUnit.elements.length+'条）</summary>'+elements+'</details>'+ 
      '</article>';
  }).join("");
  return '<section class="theme-panel" id="theme-panel"><div class="theme-panel-heading">主题检索：'+esc(cluster.label)+' <span>教研归类</span></div>'+ 
    '<p class="theme-caution">'+esc(cluster.boundary)+'</p>'+ 
    '<h4>同主题单元（主题表述与语文要素分别查看）</h4>'+relatedHTML+'</section>';
}

function renderDetail(){
  const g = el(curEid);
  if(!g){ document.getElementById("detail").innerHTML = '<div class="empty">未找到该要素</div>'; return; }
  const {u, e} = g;
  const links = LINKS[curEid] || [];
  const vs = D.versions[u.vol] || {};
  const curXdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "第三学段";
  let h = '<div class="crumb">'+
          '<div><button id="back">← 返回教材全表</button>　'+
          esc(vs.name0||u.vol)+' 第'+u.unit+'单元　<span style="color:var(--muted)">'+esc(e.eid)+'</span></div>'+
          '<div class="exp-menu-wrap">'+
          '<button class="btn p" id="exp-btn">📥 导出</button>'+
          '<div class="exp-dropdown" id="exp-dd">'+
          '<button class="exp-item" data-exp="png">保存图片（PNG 概览）</button>'+
          '<button class="exp-item" data-exp="pdf">打印／另存为 PDF（完整脉络）</button>'+
          '<button class="exp-item" data-exp="md">导出 Markdown</button>'+
          '<div class="exp-hint">图片展示各路径代表节点；PDF 包含完整脉络与出处。打印时选横向、关闭「页眉和页脚」，目标选「另存为 PDF」。</div>'+ 
          '</div></div></div>';

  const viewLinks = viewLinksOf();
  const viewedLineSet = new Set(viewLinks.map(x=>x.line));
  const curNodeAll = links.length ? {cur: null} : null;

  // 各路径的当前节点说明（供中心卡片在单路径视图使用）
  let centerNote = "";
  if(links.length === 1){
    const L2 = L[links[0].line];
    const cn = L2.nodes.find(n=>n.eid===curEid);
    centerNote = currentLinkNote(e, links[0], cn);
  }

  /* 窄屏置顶中心卡片（与宽屏卡片互斥可见） */
  h += makeCenterCard(g, centerNote, "center-mobile");

  /* --- 课标依据 --- */
  h += '<div class="kbzone"><h3>课标依据'+
       '<span style="font-size:12px;color:var(--muted);font-weight:400">（学段目标与学业质量参照'+
       (curView==="all"&&links.length>1?"，按当前查看的全部路径汇总去重，保留路径归属":"")+'）</span></h3>';
  if(evidenceLinksOf(curEid, viewLinks).length){
    const ev = mergeEvidences(curEid, viewLinks);
    let targetColHtml = "";
    for(const t of ev.directTargets) targetColHtml += kbItemHTML(t);
    targetColHtml = targetColHtml || '<div class="empty">'+((D.unitEvidenceMap||{})[curEid]?'暂无直接对应目标。':'当前学段（'+curXdName+'）尚未建立直接目标条目。')+'</div>';
    if(ev.otherTargets.length){
      let oth = "";
      for(const t of ev.otherTargets) oth += kbItemHTML(t, {dim:true});
      targetColHtml += '<details style="margin-top:8px"><summary class="details-summary">其他相关目标（'+ev.otherTargets.length+'条，默认收起）</summary>'+
                       '<div style="margin-top:6px">'+oth+'</div></details>';
    }

    let quH = "";
    const qualityGroups = qualityReferenceGroups(ev.otherQualities, curXdName);
    if(!ev.directQualities.length){
      quH += '<div class="empty">'+((D.unitEvidenceMap||{})[curEid]?'暂无直接对应的质量参照。':'当前要素学业质量直接对应尚未单独建立，不自动填充不相关条款。')+'</div>';
    } else {
      for(const q of ev.directQualities) quH += quItemHTML(q, q.xueduan+'　学业质量描述');
    }
    const renderQualityGroup = (items, title, label)=>{
      if(!items.length) return;
      let content = "";
      for(const q of items) content += quItemHTML(q, q.xueduan+'（'+label+'）', {dim:true});
      quH += '<details style="margin-top:8px"><summary class="details-summary">'+title+'（'+items.length+'条）</summary>'+ 
             '<div style="margin-top:6px">'+content+'</div></details>';
    };
    renderQualityGroup(qualityGroups.same, "同学段综合表现参照", "综合表现参照");
    renderQualityGroup(qualityGroups.later, "后续学段终结性参照", "终结表现参照");
    renderQualityGroup(qualityGroups.earlier, "前置学段综合参照", "综合表现参照");

    h += '<div class="kbcol">'+
         '<div><div class="sideh">学段目标（'+curXdName+'）<span class="point-badge">整理概括</span></div>'+
         targetColHtml+'</div>'+
         '<div><div class="sideh">学业质量参照（'+curXdName+'）</div>'+
         '<div class="kb-section-desc">学业质量为学段结束时的综合表现参照，不等同于本单元达成要求。</div>'+
         quH+'</div></div>';
  } else {
    h += '<div class="empty">尚未建立本要素的课标对应关系；依据与状态说明收在中心卡片的「查看依据」中。</div>';
  }
  h += '</div>';

  /* --- 路径与脉络 --- */
  if(!links.length){
    h += '<div class="board"><div class="side pre-side"><div class="sideh">此前相关教材要素</div><div class="empty">当前版本暂无已整理的此前节点。</div></div>'+
         makeCenterCard(g, "", "center-desktop")+
         '<div class="side post-side"><div class="sideh">此后相关教材要素</div><div class="empty">当前版本暂无已整理的此后节点。</div></div></div>';
  } else {
    // 路径切换
    h += '<div class="pathtabs"><span style="font-size:12.5px;color:var(--muted)">关联路径</span>';
    h += '<button class="btn" data-view="all" aria-pressed="'+(curView==="all")+'">全部路径（'+links.length+'条）</button>';
    links.forEach((x,i)=>{
      h += '<button class="btn" data-view="'+i+'" aria-pressed="'+(String(curView)===String(i))+'">'+
           x.line+'（'+x.total+' 个节点）</button>';
    });
    h += '</div>';
    // 逐路径分组
    const sameUnitAll = new Map();
    if(curView !== "all"){
      const lk = viewLinks[0];
      const arr = L[lk.line].nodes;
      const parts = splitNodes(arr, g.uid, curEid);
      h += '<div class="board">';
      h += '<div class="side pre-side"><div class="sideh">此前相关教材要素<span class="side-count">显示'+shownCount(parts.pre)+'项，共'+parts.pre.length+'项</span></div>'+sideColumnHTML(parts.pre, "pre", viewedLineSet)+'</div>';
      const cn = arr.find(n=>n.eid===curEid);
      h += makeCenterCard(g, currentLinkNote(e, lk, cn), "center-desktop");
      h += '<div class="side post-side"><div class="sideh">此后相关教材要素<span class="side-count">显示'+shownCount(parts.post)+'项，共'+parts.post.length+'项</span></div>'+sideColumnHTML(parts.post, "post", viewedLineSet)+'</div>';
      h += '</div>';
      h += pathNoteHTML(lk.line);
      for(const n of parts.sameUnit) if(!sameUnitAll.has(n.eid)) sameUnitAll.set(n.eid, {n, lines:[lk.line]});
    } else {
      // 全部路径：中心卡片只出现一次（宽屏），各路径成组
      h += makeCenterCard(g, centerNote, "center-desktop");
      for(const lk of viewLinks){
        const arr = L[lk.line].nodes;
        const parts = splitNodes(arr, g.uid, curEid);
        const cn = arr.find(n=>n.eid===curEid);
        const note = currentLinkNote(e, lk, cn);
        h += '<div class="board" data-line="'+esc(lk.line)+'">'+
             '<div class="side pre-side"><div class="sideh">'+esc(lk.line)+' · 此前相关<span class="side-count">显示'+shownCount(parts.pre)+'项，共'+parts.pre.length+'项</span></div>'+sideColumnHTML(parts.pre, "pre", viewedLineSet)+'</div>'+
             '<div class="side" style="justify-content:center">'+
             '<div class="same-unit-box" style="text-align:center"><b>当前要素 · '+esc(lk.line)+'</b><br>'+
             '<span style="font-size:11.5px">这条线上第 '+(lk.index+1)+'/'+lk.total+' 个节点</span>'+
             (note?'<div class="su-note" style="text-align:left;margin-top:5px">关联概括：'+esc(note)+'</div>':'')+
             '</div></div>'+
              '<div class="side post-side"><div class="sideh">'+esc(lk.line)+' · 此后相关<span class="side-count">显示'+shownCount(parts.post)+'项，共'+parts.post.length+'项</span></div>'+sideColumnHTML(parts.post, "post", viewedLineSet)+'</div>'+ 
              '</div>';
         h += pathNoteHTML(lk.line);
         for(const n of parts.sameUnit) if(!sameUnitAll.has(n.eid)) sameUnitAll.set(n.eid, {n, lines:[lk.line]});
      }
    }

    // 同单元相关：独立一列
    if(sameUnitAll.size){
      h += '<div class="legend"><div class="same-unit-title">同单元相关（非此前／此后）</div>';
      for(const {n, lines} of sameUnitAll.values()){
        const g2 = el(n.eid); if(!g2) continue;
        h += '<div class="su-item">▪ <b>'+esc(g2.e.text)+'</b>　<span class="su-note">'+esc(lines.join("、"))+
             (n.link && n.link!==g2.e.text ? '　关联解读：'+esc(n.link) : '')+'</span></div>';
      }
      h += '</div>';
    }
  }

  h += sameUnitRelationHTML(curEid);
  h += relatedReadingMethodsHTML(curEid);
  h += themePanelHTML(u);

  h += '<div class="legend"><b>图例</b>：要素保留教材／教参原文；「关联解读」属于教研判断，不是教材或课标的官方对应；教材先后不等于能力发展阶梯。'+
       '<details style="margin-top:4px"><summary class="details-summary">阅读说明</summary><div class="details-body">'+
       '<div class="row">每侧默认显示 2 个代表性节点（沿用既有代表节点选择规则），完整条目点「展开其余相关节点」或导出 PDF 查看。</div>'+
        '<div class="row">'+esc(SCOPE_NOTE)+'</div>'+ 
       '<div class="row">课标引文页码换算：印刷页码 = PDF 页码 − 3。</div>'+
       '</div></details></div>';

  document.getElementById("detail").innerHTML = h;

  const b = document.getElementById("back"); if(b) b.addEventListener("click", closeDetail);
  document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>{
    curView = x.dataset.view === "all" ? "all" : parseInt(x.dataset.view,10);
    renderDetail();
  }));
  document.querySelectorAll("[data-theme-toggle]").forEach(x=>x.addEventListener("click",()=>{
    themePanelOpen = !themePanelOpen;
    renderDetail();
  }));
  document.querySelectorAll("#detail [data-theme-eid]").forEach(x=>x.addEventListener("click",()=>openElement(x.dataset.themeEid)));
  document.querySelectorAll("#detail [data-strategy-eid]").forEach(x=>x.addEventListener("click",()=>openElement(x.dataset.strategyEid)));
  document.querySelectorAll("#detail [data-same-unit-eid]").forEach(x=>x.addEventListener("click",()=>openElement(x.dataset.sameUnitEid)));
  document.querySelectorAll("[data-details-toggle]").forEach(x=>x.addEventListener("click",()=>{
    const panel = x.closest(".node, .center").querySelector(".toggle-details-body");
    panel.hidden = !panel.hidden;
    x.setAttribute("aria-expanded", String(!panel.hidden));
  }));
  document.querySelectorAll("[data-more]").forEach(x=>x.addEventListener("click",()=>{
    x.parentElement.querySelectorAll("[data-hidden]").forEach(y=>{
      y.style.display = "block";
      y.removeAttribute("data-hidden");
    });
    x.remove();
  }));

  // 导出菜单
  const dd = document.getElementById("exp-dd");
  document.getElementById("exp-btn").addEventListener("click", ev=>{
    ev.stopPropagation();
    dd.classList.toggle("show");
  });
  document.addEventListener("click", function closeDD(){
    dd.classList.remove("show");
  });
  dd.querySelectorAll(".exp-item").forEach(x=>x.addEventListener("click", ()=>{
    dd.classList.remove("show");
    const kind = x.dataset.exp;
    if(kind === "md") exportMarkdown();
    else if(kind === "png") exportPNG();
    else if(kind === "pdf") exportPDF();
  }));
}

/* 严格按真实教材时间划分此前 / 同单元 / 此后 */
function splitNodes(arr, curUid, curEid){
  const curOrder = nodeOrderKey(curEid);
  const pre = [], post = [], sameUnit = [];
  for(const n of arr){
    if(n.eid === curEid) continue;
    const nOrder = nodeOrderKey(n.eid);
    const nUid = n.eid.slice(0, n.eid.lastIndexOf("-"));
    if(nUid === curUid) sameUnit.push(n);
    else if(nOrder < curOrder) pre.push(n);
    else post.push(n);
  }
  return {pre, post, sameUnit};
}
function shownCount(list){
  let keys = list.filter(n=>n.key);
  if(!keys.length) keys = list.slice(0,2);
  return Math.min(keys.length, 2);
}

/* ================= 导出 1：Markdown（沿用既有完整结构） ================= */
function exportMarkdown(){
  const g = el(curEid); if(!g) return;
  const {u,e} = g, links = LINKS[curEid]||[];
  const vs = D.versions[u.vol]||{};
  const curXdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "第三学段";
  const srcInfo = getSourceInfo(u, e);
  const uTheme = getUnitThemeInfo(u);
  const themeCluster = themeClusterForUnit(u.id);
  const kbiaoSourceTitle = String(D.meta.kbiaoSource || "义务教育语文课程标准").replace(/_可搜索\.pdf(?:\.txt)?$/, "");

  let versionDesc = "";
  if(vs.state && vs.state.includes("统编旧版")){
    versionDesc = "教育部统编语文教材（旧版已确认；" + vs.detail + "）";
  } else if(vs.state && vs.state.includes("教参来源")){
    versionDesc = "教育部统编语文教材（低年级·教参说明；" + vs.detail + "）";
  } else {
    versionDesc = "教育部统编语文教材（导语页逐页提取；" + vs.detail + "）";
  }

  const o = [
    "# 单元要素脉络 · "+(vs.name0||u.vol)+" 第"+u.unit+"单元", "",
    "## 教材版本与出处说明",
    "- **所属册别与单元**："+(vs.name0||u.vol)+" 第"+u.unit+"单元",
    "- **教材版本定性**："+versionDesc,
    "- **来源类型**："+srcInfo.badge+"（"+srcInfo.desc+"）",
    "- **要素标识**：`"+e.eid+"`",
    (e.historyId ? "- **历史编号与迁移**：原任务ID `"+e.historyId+"`；"+(e.migrationNote||"") : ""),
    "- **取向标注**："+e.orient+"（"+e.orientNote+"）",
    "- **所属学段**："+curXdName,
    (uTheme ? "- **单元主题表述（"+uTheme.sourceLabel+"）**："+uTheme.text : "- **单元主题表述**：当前记录未提供"),
    "",
    "## 当前要素（教材/教参原文）", "",
    "> " + e.text, ""
  ];

  if(themeCluster){
    o.push("## 主题检索（教研归类）", "", "**"+themeCluster.label+"**。"+themeCluster.boundary, "");
    for(const item of themeCluster.units){
      const themeUnit = U[item.unitId];
      if(!themeUnit) continue;
      const themeInfo = getUnitThemeInfo(themeUnit);
      const source = item.source||{};
      o.push("### "+themeUnitLabel(item), "", "> "+(themeInfo?themeInfo.text:"主题表述未登记"), "",
        "- **归入理由**："+item.reason,
        "- **主题来源**："+[source.type,source.title,source.file,"印刷页 "+source.printPage+"／PDF页 "+source.pdfPage].filter(Boolean).join("；"),
        ...(item.supportSource?["- **辅助来源**："+[item.supportSource.type,item.supportSource.title,item.supportSource.publication,item.supportSource.url].filter(Boolean).join("；")]:[]), "");
    }
  }

  if(!links.length){
    const review = getUnlinkedReview(e.eid);
    o.push("## 关联状态", "", "**"+review.label+"**："+review.note, "");
  } else {
    for(const lk of links){
      const L2 = L[lk.line], arr = L2.nodes;
      const curNode = arr.find(n => n.eid === curEid);
      const parts = splitNodes(arr, g.uid, curEid);

      o.push("## 关联路径："+lk.line, "",
             "- **当前要素关联说明**："+((curNode && curNode.link) || lk.link || "当前单元明确要求：" + e.text),
             "- 本要素是这条脉络第 "+(lk.index+1)+"/"+lk.total+" 个节点。",
             ...(L2.note ? ["- **脉络说明**："+L2.note] : []),
             "- 该路径已整理范围："+lk.total+" 个节点（局部试验脉络，非完整教材链条）。", "");

      const dump = (title, list) => {
        o.push("### "+title, "");
        if(!list.length){ o.push("（本侧暂无可列节点）",""); return; }
        for(const n of list){
          const g2 = el(n.eid); if(!g2) continue;
          const v2 = D.versions[g2.u.vol]||{};
          const s2 = getSourceInfo(g2.u, g2.e);
          let v2State = v2.state ? (v2.state.includes("统编旧版") ? "统编旧版（经用户核定）" : v2.state) : "版本待核";
          o.push("- **"+(v2.name0||g2.u.vol)+" 第"+g2.u.unit+"单元**（"+s2.bookPageText+"）"+(n.key?"　［代表性节点］":""),
                 "  - 原文："+g2.e.text,
                 "  - 来源："+s2.badge,
                 "  - 版本定性："+v2State,
                 "  - 关联说明（教研判断）："+n.link,
                 "  - 核验状态："+(n.verified ? "已回原件核对" : "沿用早前提取结果"));
        }
        o.push("");
      };

      dump("此前相关教材要素（按教材先后排列）", parts.pre);
      if(parts.sameUnit.length > 0){
        o.push("### 同单元相关要素（非前后阶梯）", "");
        for(const n of parts.sameUnit){
          const g2 = el(n.eid); if(!g2) continue;
          o.push("- **同单元要素** `"+n.eid+"`："+g2.e.text+"（"+n.link+"）");
        }
        o.push("");
      }
      dump("此后相关教材要素（按教材先后排列）", parts.post);
    }
  }

  const evidenceLinks = evidenceLinksOf(curEid, links);
  if(evidenceLinks.length){
    o.push("## 课标依据（学段目标）", "");
    for(const lk of evidenceLinks){
      o.push("### "+(lk.unitOnly?"本单元目标":"关联路径："+lk.line)+" · 学段目标依据", "");
      const ev = getElementEvidences(curEid, lk);
      if(ev.directTargets.length > 0){
        o.push("#### 直接相关依据（"+curXdName+"）", "");
        for(const t of ev.directTargets){
          o.push("- **"+t.xd+"　"+t.dom+" 第"+t.no+"条**（" + kbPageText(t.it) + "）",
                 "  - **关联性质**："+t.reason,
                 "  - **课标原文**："+t.it.text, ...(t.it.note ? ["  - **附注**："+t.it.note] : []), "");
        }
      }
      if(ev.otherTargets.length > 0){
        o.push("#### 其他相关目标参照", "");
        for(const t of ev.otherTargets){
          o.push("- **"+t.xd+"　"+t.dom+" 第"+t.no+"条**（" + kbPageText(t.it) + "）",
                 "  - **关联性质**："+t.reason,
                 "  - **课标原文**："+t.it.text, ...(t.it.note ? ["  - **附注**："+t.it.note] : []), "");
        }
      }
    }

    o.push("## 学业质量参照（学段结束时的综合表现参照）", "");
    for(const lk of evidenceLinks){
      o.push("### "+(lk.unitOnly?"本单元目标":"关联路径："+lk.line)+" · 学业质量表现参照", "");
      const ev = getElementEvidences(curEid, lk);
      if(!ev.directQualities.length){
        o.push("（当前要素所属"+curXdName+"的学业质量对应尚未单独建立，不自动填充不相关条款）", "");
      } else {
        o.push("#### 直接表现参照（"+curXdName+"）", "");
        for(const q of ev.directQualities){
          o.push("- **"+q.xueduan+" · 学业质量描述**（印刷第 "+q.printPage+" 页／PDF第 "+q.pdfPage+" 页）",
                 "  - **课标原文**："+q.text,
                 "  - **所属章节**："+q.chapter,
                 "  - **要点**："+q.short,
                 ...(q.scope ? ["  - **适用范围**："+q.scope] : []),
                 "  - **性质**：学段结束时的综合表现参照，不等同于本单元达标要求。", "");
        }
      }
      const qualityGroups = qualityReferenceGroups(ev.otherQualities, curXdName);
      const appendQualityGroup = (items, heading, noteLabel)=>{
        if(!items.length) return;
        o.push(heading, "");
        for(const q of items){
          o.push("- **"+q.xueduan+" · 学业质量描述**（印刷第 "+q.printPage+" 页／PDF第 "+q.pdfPage+" 页）",
                 "  - **课标原文**："+q.text,
                 "  - **所属章节**："+q.chapter,
                 "  - **要点**："+q.short,
                 ...(q.scope ? ["  - **适用范围**："+q.scope] : []),
                 "  - **说明**："+noteLabel+"；学段结束时的综合表现参照，不等同于当前单元达成要求。", "");
        }
      };
      appendQualityGroup(qualityGroups.same, "#### 同学段综合表现参照", "同学段综合参照");
      appendQualityGroup(qualityGroups.later, "#### 后续学段终结性参照", "后续学段参照");
      appendQualityGroup(qualityGroups.earlier, "#### 前置学段综合参照", "前置学段综合参照");
    }
  }

  const relatedMethods = relatedReadingMethodsOf(curEid);
  if(relatedMethods){
    o.push("## 相关阅读方法（"+(relatedMethods.support?relatedMethods.support.relationType:"教研比较")+"）", "", D.strategyComparison.nature+"。"+D.strategyComparison.sequenceNote, "");
    if(relatedMethods.support){
      const support = relatedMethods.support;
      o.push(support.reason, "", "- **适用条件**："+support.conditions, "- **课堂观察建议**："+support.observable, "- **建议性质与来源**："+support.provenance, "");
    }
    for(const row of relatedMethods.rows){
      o.push("### "+row.strategy+" · "+row.unit+(row.eid===curEid?"（当前要素）":""), "", "> "+row.text, "",
        "- **主要阅读问题**："+row.problem, "- **方法（教参归纳）**："+row.method, "- **可观察表现（课堂建议）**："+row.observable,
        "- **使用边界**："+row.boundary, "- **教参定位**："+methodSourceText(row), "");
    }
  }

  const sameRelations = sameUnitRelationsOf(curEid);
  if(sameRelations.length){
    o.push("## 同单元相关（读写／实践配合）", "", "> 这里记录同一单元内阅读、习作或实践任务的配合关系，不计入跨单元能力脉络，也不表示先修顺序。", "");
    for(const item of sameRelations){
      const r = item.row, g2 = el(item.otherEid); if(!g2) continue;
      const source = r.source||{};
      o.push("### "+(r.relationType||"同单元相关")+" · "+elementLabel(item.otherEid), "",
        "> "+g2.e.text, "",
        "- **关系概括**："+(r.summary||""),
        "- **边界**："+(r.boundary||""),
        "- **教参定位**："+relationSourceText(source),
        "- **教参原句**："+(source.quote||""),
        ...(source.versionNote?["- **版本备注**："+source.versionNote]:[]),
        "- **核定状态**："+(r.status||""), "");
    }
  }

  o.push("---","",
    "## 查阅说明与版本附注",
    "> 1. **课标依据来源**：《"+kbiaoSourceTitle+"》。"+(D.meta.kbiaoNote||""),
    "> 2. **教材版本依据**：三至六年级按教育部统编语文教材导语页，一二年级按教师教学用书「单元说明」。四下、五下、六下经核定确认为统编教材旧版，其余册别按各自登记信息呈现，未替用户作未核定确认。",
    "> 3. **关联性质说明**：课标原文、教材原文、关联解释已分别标注。关联解释是教研判断，不是官方逐项对应表。",
    "> 4. **排列顺序说明**：排列顺序说明教材编排次序，不表示能力发展的先后阶梯。");

  const blob = new Blob([o.join(String.fromCharCode(10))], {type:"text/markdown;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "要素脉络_"+curEid+".md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}

/* ================= 导出 2：PNG 概览（2400px 专用版式，离线 Canvas 绘制） ================= */
function exportPNG(){
  const g = el(curEid); if(!g) return;
  const {u, e} = g;
  const links = LINKS[curEid] || [];
  const vs = D.versions[u.vol] || {};
  const srcInfo = getSourceInfo(u, e);
  const uTheme = getUnitThemeInfo(u);
  const themeCluster = themeClusterForUnit(u.id);
  const audit = vs.sourceAudit || {};
  const studentRevision = audit.studentBook && audit.studentBook.revisionClass;
  const exactPairing = audit.pairing && audit.pairing.exactEditionPairingConfirmed;
  const versionSummary = studentRevision
    ? "教材版本："+studentRevision+"；教材—教参精确配套："+(exactPairing ? "已核" : "待证")
    : "教材版本："+(vs.state || "待核");
  const curXdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "第三学段";
  const ev = mergeEvidences(curEid, links);
  const pngTargets = ev.directTargets.length || links.length ? ev.directTargets : ev.otherTargets;
  const pngQualities = ev.directQualities.length || links.length ? ev.directQualities : ev.otherQualities;

  const W = 2400, M = 90, CW = W - M*2;
  const F_TITLE='700 52px "Microsoft YaHei",sans-serif';
  const F_SEC='700 38px "Microsoft YaHei",sans-serif';
  const F_TXT='400 32px "Microsoft YaHei",sans-serif';
  const F_B='600 32px "Microsoft YaHei",sans-serif';
  const F_SMALL='400 26px "Microsoft YaHei",sans-serif';
  const F_TINY='400 24px "Microsoft YaHei",sans-serif';
  const C_ACCENT="#2f5d50", C_TXT="#1f211c", C_MUTED="#6f6a5f", C_CARD="#fffdf8", C_BG="#f6f2ea", C_LN="#ded8cc";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // 先用估高绘制两遍：第一遍测高，第二遍落地
  let srcIdx = new Map(); // key -> [n]
  let srcList = [];
  function srcMark(key, desc){
    if(srcIdx.has(key)) return "["+srcIdx.get(key)+"]";
    srcIdx.set(key, srcList.length+1);
    srcList.push(desc);
    return "["+(srcList.length)+"]";
  }

  const wrap = (text, maxW, font)=>{
    ctx.font = font;
    const out = [];
    for(const seg of String(text).split("\n")){
      let line = "";
      for(const ch of seg){
        if(ctx.measureText(line + ch).width > maxW && line){ out.push(line); line = ch; }
        else line += ch;
      }
      out.push(line);
    }
    return out;
  };

  // 预先为展示对象分配来源索引
  const pathsData = links.map(lk=>{
    const arr = L[lk.line].nodes;
    const parts = splitNodes(arr, g.uid, curEid);
    const cn = arr.find(n=>n.eid===curEid);
    const pick = (list, kind)=>{
      let keys = list.filter(n=>n.key);
      if(!keys.length) keys = (kind==="pre") ? list.slice(-2) : list.slice(0,2);
      else keys = (kind==="pre") ? keys.slice(-2) : keys.slice(0,2);
      return keys;
    };
    const withMark = (n)=>{
      const g2 = el(n.eid); if(!g2) return null;
      const s2 = getSourceInfo(g2.u, g2.e);
      const mark = srcMark("node:"+n.eid, (D.versions[g2.u.vol]&&D.versions[g2.u.vol].name0||g2.u.vol)+" 第"+g2.u.unit+"单元 · "+s2.badge+" · "+s2.bookPageText);
      return {n, g2, mark};
    };
    return {
      lk, note: currentLinkNote(e, lk, cn),
      pre: pick(parts.pre,"pre").map(withMark).filter(Boolean),
      post: pick(parts.post,"post").map(withMark).filter(Boolean),
      sameUnit: parts.sameUnit.map(withMark).filter(Boolean),
      preTotal: parts.pre.length, postTotal: parts.post.length,
      otherCount: parts.pre.length + parts.post.length - pick(parts.pre,"pre").length - pick(parts.post,"post").length
    };
  });
  for(const t of pngTargets) t._m = srcMark("kb:"+t.xd+t.dom+t.no, "课标·"+t.xd+" "+t.dom+" 第"+t.no+"条 · "+kbPageText(t.it)+"（"+(links.length?t.paths.join("、"):(t.isDirect?"主要依据":"相关参照"))+"）");
  for(const q of pngQualities) q._m = srcMark("qu:"+q.xueduan+(q.printPage||"")+(q.short||""), "课标·"+q.xueduan+"学业质量 · 印刷页 "+q.printPage+"／PDF页 "+q.pdfPage+"（"+q.paths.join("、")+"）");
  const relatedMethods = relatedReadingMethodsOf(curEid);
  const supportMark = relatedMethods && relatedMethods.support ? srcMark("method:"+relatedMethods.rows[0].eid, "教参·"+methodSourceText(relatedMethods.rows[0])+"（方法依据；跨单元支持属于教研迁移建议）") : "";
  const sameRelations = sameUnitRelationsOf(curEid);
  for(const item of sameRelations){
    const source = item.row.source||{};
    item._m = srcMark("same:"+item.row.id, "教参·"+relationSourceText(source)+"（同单元关系；教研概括）");
  }
  const themeSources = themeCluster ? themeCluster.units.map(item=>{
    const themeUnit = U[item.unitId];
    const themeInfo = themeUnit && getUnitThemeInfo(themeUnit);
    return {
      item,
      mark: srcMark("theme:"+themeCluster.id+":"+item.unitId,
        "主题检索（教研归类）·"+themeUnitLabel(item)+"：“"+(themeInfo?themeInfo.text:"主题表述未登记")+"”；"+themeSourceText(item))
    };
  }) : [];

  function layout(dry){
    ctx.textBaseline = "top";
    let y = M;
    // 背景
    ctx.fillStyle = C_BG; ctx.fillRect(0,0,W, dry?100:canvas.height);
    // 标题
    ctx.fillStyle = C_ACCENT; ctx.font = F_TITLE;
    ctx.fillText((vs.name0||u.vol)+" · 第"+u.unit+"单元 · 单元要素脉络概览", M, y); y += 74;
    ctx.fillStyle = C_MUTED; ctx.font = F_SMALL;
    let sub = "要素 "+e.eid+"　|　"+srcInfo.badge+"　|　"+srcInfo.bookPageText+"　|　"+versionSummary;
    if(uTheme) sub += "　|　单元主题表述（"+uTheme.sourceLabel+"）："+uTheme.text;
    for(const ln of wrap(sub,CW,F_SMALL)){ ctx.fillText(ln,M,y); y += 36; }
    if(themeCluster){
      const themeLine = "主题检索（教研归类）："+themeCluster.label+"；相关单元："+themeSources.map(x=>themeUnitLabel(x.item)+" "+x.mark).join("、")+"。主题归类不表示学习进阶。";
      for(const ln of wrap(themeLine,CW,F_SMALL)){ ctx.fillText(ln,M,y); y += 36; }
    }
    y += 10;

    // 当前要素框
    const curLines = wrap(e.text, CW-80, F_B);
    const curH = 60 + curLines.length*46 + 30;
    if(!dry){ rr(ctx, M, y, CW, curH, 16); ctx.fillStyle=C_CARD; ctx.fill(); ctx.strokeStyle=C_ACCENT; ctx.lineWidth=3; ctx.stroke(); }
    y += 26;
    ctx.fillStyle = C_ACCENT; ctx.font = F_SMALL; ctx.fillText("当前要素（"+(e.orient||"单元")+"要素）", M+28, y); y += 38;
    ctx.fillStyle = "#182c25"; ctx.font = F_B;
    for(const ln of curLines){ ctx.fillText(ln, M+28, y); y += 46; }
    y += curH - (26+38+curLines.length*46) + 20;

    // 各路径
    for(const p of pathsData){
      y += 16;
      ctx.fillStyle = C_ACCENT; ctx.font = F_SEC;
      ctx.fillText("路径："+p.lk.line+"（第 "+(p.lk.index+1)+"/"+p.lk.total+" 个节点）", M, y); y += 56;
      if(p.note){ ctx.fillStyle = C_MUTED; ctx.font = F_SMALL; for(const ln of wrap("关联概括："+p.note, CW, F_SMALL)){ ctx.fillText(ln, M, y); y += 38; } y += 8; }

      const colW = (CW - 24) / 2;
      const colX = [M, M+colW+24];
      // 计算此前与此后两列的高度
      const nodeH = (m)=>{
        const g2 = m.g2;
        const textLines = wrap(g2.e.text, colW-32, F_TXT).length;
        const noteLines = m.n.link&&m.n.link!==g2.e.text ? wrap("关联说明："+m.n.link, colW-32, F_TINY).length : 0;
        return 58 + textLines*38 + noteLines*32 + 18;
      };
      const colBody = (title, items, x, total, kind)=>{
        let cy = y;
        ctx.fillStyle = C_MUTED; ctx.font = F_SMALL; ctx.fillText(title+"（共"+total+"项，图示"+items.length+"项代表）", x, cy); cy += 40;
        for(const m of items){
          const g2 = m.g2;
          const hgt = nodeH(m);
          if(!dry){ rr(ctx, x, cy, colW, hgt, 10); ctx.fillStyle=C_CARD; ctx.fill(); ctx.strokeStyle=C_LN; ctx.lineWidth=1.5; ctx.stroke(); }
          ctx.fillStyle = C_ACCENT; ctx.font = F_SMALL;
          ctx.fillText((D.versions[g2.u.vol]&&D.versions[g2.u.vol].name0||g2.u.vol)+" 第"+g2.u.unit+"单元 "+m.mark, x+16, cy+12);
          ctx.fillStyle = C_TXT; ctx.font = F_TXT;
          let ty = cy+52;
          for(const ln of wrap(g2.e.text, colW-32, F_TXT)){ ctx.fillText(ln, x+16, ty); ty += 38; }
          if(m.n.link&&m.n.link!==g2.e.text){
            ty += 4; ctx.fillStyle=C_MUTED; ctx.font=F_TINY;
            for(const ln of wrap("关联说明："+m.n.link, colW-32, F_TINY)){ ctx.fillText(ln, x+16, ty); ty += 32; }
          }
          cy += hgt + 14;
        }
        return cy;
      };

      const preH = 40 + p.pre.reduce((s,m)=>s+nodeH(m)+14,0);
      const postH = 40 + p.post.reduce((s,m)=>s+nodeH(m)+14,0);
      const maxH = Math.max(preH, postH);
      if(!dry){
        colBody("此前相关", p.pre, colX[0], p.preTotal, "pre");
        colBody("此后相关", p.post, colX[1], p.postTotal, "post");
      }
      y += maxH + 18;

      if(p.sameUnit.length){
        ctx.fillStyle = C_MUTED; ctx.font = F_SMALL;
        for(const ln of wrap("同单元相关（非此前／此后）：",CW,F_SMALL)){ ctx.fillText(ln,M,y); y += 36; }
        for(const m of p.sameUnit){
          const title=(D.versions[m.g2.u.vol]&&D.versions[m.g2.u.vol].name0||m.g2.u.vol)+" 第"+m.g2.u.unit+"单元 "+m.mark+" ";
          for(const ln of wrap(title+m.g2.e.text,CW,F_SMALL)){ ctx.fillText(ln,M,y); y += 34; }
          if(m.n.link&&m.n.link!==m.g2.e.text){ for(const ln of wrap("关联说明："+m.n.link,CW-24,F_TINY)){ ctx.fillText(ln,M+24,y); y += 30; } }
        }
        y += 6;
      }
      if(p.otherCount > 0){
        ctx.fillStyle = C_MUTED; ctx.font = F_TINY;
        ctx.fillText("本路径另有 "+p.otherCount+" 个相关节点未图示，完整条目见 PDF 导出。", M, y); y += 34;
      }
    }

    if(!links.length){
      ctx.fillStyle = C_MUTED; ctx.font = F_TXT;
      y += 10;
      const review = getUnlinkedReview(e.eid);
      const reviewText = (D.unitEvidenceMap||{})[curEid] ? review.label+"；当前未建立跨单元关联。" : review.label+"："+review.note;
      for(const ln of wrap(reviewText, CW, F_TXT)){ ctx.fillText(ln, M, y); y += 42; }
      y += 10;
    }

    // 课标要点（概括）
    if(pngTargets.length || pngQualities.length){
      y += 20;
      ctx.fillStyle = C_ACCENT; ctx.font = F_SEC; ctx.fillText("课标要点（整理概括，非课标原文；完整原文见 PDF 附录）", M, y); y += 54;
      const half = (CW-30)/2;
      let ly = y, ry = y;
      if(pngTargets.length){
        ctx.fillStyle = C_MUTED; ctx.font = F_SMALL; ctx.fillText("学段目标（"+curXdName+(ev.directTargets.length?"":"，相关参照")+"）", M, ly); ly += 38;
        for(const t of pngTargets){
          ctx.fillStyle = C_TXT; ctx.font = F_TXT;
          const relation = links.length ? t.pathRelations.map(r=>r.line+"："+r.reason).join("；") : (t.isDirect?"主要依据":"相关参照");
          for(const ln of wrap(t._m+" "+(t.it.short||t.it.text)+"（"+relation+"）", half, F_TXT)){ ctx.fillText(ln, M, ly); ly += 36; }
          ly += 8;
        }
      }
      if(pngQualities.length){
        ctx.fillStyle = C_MUTED; ctx.font = F_SMALL; ctx.fillText("学业质量参照（"+curXdName+"，综合表现参照）", M+half+30, ry); ry += 38;
        for(const q of pngQualities){
          ctx.fillStyle = C_TXT; ctx.font = F_TXT;
          const relation = links.length ? q.pathRelations.map(r=>r.line+"："+r.reason).join("；") : (q.isDirect?"直接参照":"相关参照");
          for(const ln of wrap(q._m+" "+q.short+"（"+relation+"）", half, F_TXT)){ ctx.fillText(ln, M+half+30, ry); ry += 36; }
          ry += 8;
        }
      }
      y = Math.max(ly, ry) + 12;
    }

    if(relatedMethods){
      y += 10;
      ctx.fillStyle = C_ACCENT; ctx.font = F_SEC;
      ctx.fillText("相关阅读方法（"+(relatedMethods.support?relatedMethods.support.relationType:"教研比较")+"）", M, y); y += 50;
      ctx.fillStyle = C_TXT; ctx.font = F_SMALL;
      const own = relatedMethods.rows.find(row=>row.eid===curEid);
      const note = relatedMethods.support ? supportMark+" "+relatedMethods.support.short+"；适用条件与观察建议见 PDF 附录。" : "当前方法："+own.strategy+"；各方法用途比较及原文依据见 PDF 附录，不表示先修顺序。";
      for(const ln of wrap(note, CW, F_SMALL)){ ctx.fillText(ln, M, y); y += 36; }
    }

    if(sameRelations.length){
      y += 10;
      ctx.fillStyle = C_ACCENT; ctx.font = F_SEC;
      ctx.fillText("同单元相关（读写／实践配合）", M, y); y += 50;
      ctx.fillStyle = C_TXT; ctx.font = F_SMALL;
      for(const item of sameRelations){
        const r = item.row, g2 = el(item.otherEid); if(!g2) continue;
        const title = item._m+" "+elementLabel(item.otherEid)+"："+g2.e.text;
        for(const ln of wrap(title, CW, F_SMALL)){ ctx.fillText(ln, M, y); y += 34; }
        for(const ln of wrap(r.summary||"", CW-24, F_TINY)){ ctx.fillText(ln, M+24, y); y += 30; }
      }
    }

    // 来源索引
    if(srcList.length){
      y += 14;
      ctx.fillStyle = C_ACCENT; ctx.font = F_SEC; ctx.fillText("来源索引", M, y); y += 50;
      ctx.fillStyle = C_MUTED; ctx.font = F_TINY;
      const half = (CW-30)/2;
      let ly = y, ry = y;
      srcList.forEach((s,i)=>{
        const ln = "["+(i+1)+"] "+s;
        const lines = wrap(ln, half, F_TINY);
        const tx = (i%2===0)? M : M+half+30;
        let ty = (i%2===0)? ly : ry;
        for(const l of lines){ ctx.fillText(l, tx, ty); ty += 32; }
        if(i%2===0) ly = ty+6; else ry = ty+6;
      });
      y = Math.max(ly, ry) + 10;
    }

    // 页脚说明
    y += 12;
    ctx.fillStyle = C_MUTED; ctx.font = F_TINY;
    const foot = [
      "节点卡片主体为教材要素原文；关联说明为教研概括。",
      "关联解读属于教研判断，不是教材或课标的官方对应；教材先后不等于能力发展的先后阶梯。",
      "当前整理范围："+(links.length ? links.map(lk=>lk.line+"（"+lk.total+" 个节点）").join("、") : "该要素未进入现有脉络（"+getUnlinkedReview(e.eid).label+"）")+"。"
    ];
    for(const f of foot){ for(const ln of wrap(f, CW, F_TINY)){ ctx.fillText(ln, M, y); y += 32; } }
    y += M;
    return y;
  }

  const totalH = layout(true);
  canvas.width = W; canvas.height = Math.ceil(totalH);
  layout(false);

  const orientLabel = e.orient ? String(e.orient).replace(/取向$/,"")+"要素" : "单元要素";
  const sameOrient = u.elements.filter(x=>x.orient===e.orient).length > 1;
  const fname = u.vol+"_第"+u.unit+"单元_"+orientLabel+(sameOrient?"_第"+e.seq+"条":"")+"_脉络概览.png";

  canvas.toBlob(blob=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  }, "image/png");
}

function rr(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

/* ================= 导出 3：打印 / 另存为 PDF（专用打印排版 + 完整附录） ================= */
function exportPDF(){
  const pv = document.getElementById("print-view");
  pv.innerHTML = buildPrintHTML();
  const cleanup = ()=>{ pv.innerHTML = ""; };
  if(window.onafterprint !== undefined){
    window.addEventListener("afterprint", cleanup, {once:true});
  }
  setTimeout(()=>{ window.print(); }, 60);
}

function buildPrintHTML(){
  const g = el(curEid); if(!g) return "";
  const {u, e} = g;
  const links = LINKS[curEid] || [];
  const vs = D.versions[u.vol] || {};
  const srcInfo = getSourceInfo(u, e);
  const uTheme = getUnitThemeInfo(u);
  const themeCluster = themeClusterForUnit(u.id);
  const curXdName = ["", "第一学段", "第二学段", "第三学段"][u.xueduan] || "第三学段";
  const ev = mergeEvidences(curEid, links);
  const esc_ = esc;

  // 全文档统一的来源编号
  const srcIdx = new Map(); let srcList = [];
  const mark = (key, desc)=>{
    if(srcIdx.has(key)) return "["+srcIdx.get(key)+"]";
    srcIdx.set(key, srcList.length+1); srcList.push(desc); return "["+srcList.length+"]";
  };
  const themeSearchHTML = ()=>{
    if(!themeCluster) return "";
    const entries = themeCluster.units.map(item=>{
      const themeUnit = U[item.unitId];
      const themeInfo = themeUnit && getUnitThemeInfo(themeUnit);
      return themeUnit ? themeUnitLabel(item)+" "+mark("theme:"+themeCluster.id+":"+item.unitId,
        "主题检索（教研归类）·"+themeUnitLabel(item)+"：“"+(themeInfo?themeInfo.text:"主题表述未登记")+"”；"+themeSourceText(item)) : "";
    }).filter(Boolean);
    return '<div class="p-theme-print"><b>主题检索（教研归类）：</b>'+esc_(themeCluster.label)+'；相关单元：'+esc_(entries.join("、"))+'。主题归类不表示学习进阶。</div>';
  };

  const headTitle = esc_((vs.name0||u.vol)+" · 第"+u.unit+"单元 · 单元要素脉络"+(links.length?"":"（"+getUnlinkedReview(e.eid).label+"）"));

  /* ---- A. 概览页：一条路径一页 ---- */
  let overview = "";
  if(!links.length){
    const unitTargets = ev.directTargets.length ? ev.directTargets : ev.otherTargets;
    const unitQualities = ev.directQualities.length ? ev.directQualities : ev.otherQualities;
    overview = '<div class="print-page"><div class="p-header"><div class="p-title">'+headTitle+'</div>'+
      '<div class="p-sub">'+esc_(e.eid)+'　'+esc_(srcInfo.badge)+'</div></div>'+
      '<div class="p-cur-box"><div class="p-cur-text">'+esc_(e.text)+'</div>'+ 
      '<div class="p-cur-meta">'+esc_(srcInfo.desc)+(e.historyId?"　|　历史编号与迁移：原ID "+esc_(e.historyId)+"；"+esc_(e.migrationNote||""):"")+(uTheme?"　|　单元主题表述（"+esc_(uTheme.sourceLabel)+"）："+esc_(uTheme.text):"")+'</div></div>'+ 
      themeSearchHTML()+
      '<div class="p-std-box" style="margin-top:8px"><div class="p-std-title">关联状态</div>'+ 
      '<p><b>'+esc_(getUnlinkedReview(e.eid).label)+'</b>：'+esc_(getUnlinkedReview(e.eid).note)+'</p></div>'+ 
      sameUnitRelationPrintHTML(curEid)+
      (evidenceLinksOf(curEid, links).length ? '<div class="p-standards avoid-break">'+
      '<div class="p-std-box"><div class="p-std-title">学段目标要点（'+(ev.directTargets.length?"主要依据":"相关参照")+'）</div>'+
      unitTargets.map(t=>'<p>'+mark("kb:"+t.xd+t.dom+t.no, "课标·"+t.xd+" "+t.dom+" 第"+t.no+"条 · "+kbPageText(t.it)+"；"+t.reason)+' '+esc_(t.it.short||t.it.text)+'</p>').join("")+'</div>'+
      '<div class="p-std-box"><div class="p-std-title">学业质量参照（学段综合表现）</div>'+
      (unitQualities.length ? unitQualities.map(q=>'<p>'+mark("qu:"+q.xueduan+(q.printPage||"")+(q.short||""), "课标·"+q.xueduan+"学业质量 · 印刷页 "+q.printPage+"／PDF页 "+q.pdfPage+"；"+q.scope)+' '+esc_(q.short)+'（'+(q.isDirect?"直接参照":"相关参照")+'）</p>').join("") : '<p>本要素暂未建立适合的学业质量参照。</p>')+'</div></div>' : '')+
      '</div>';
  } else {
  for(const lk of links){
    const arr = L[lk.line].nodes;
      const parts = splitNodes(arr, g.uid, curEid);
      const cn = arr.find(n=>n.eid===curEid);
      const note = currentLinkNote(e, lk, cn);
      const pick = (list, kind)=>{
        let keys = list.filter(n=>n.key);
        if(!keys.length) keys = (kind==="pre") ? list.slice(-2) : list.slice(0,2);
        else keys = (kind==="pre") ? keys.slice(-2) : keys.slice(0,2);
        return keys;
      };
      const preSel = pick(parts.pre,"pre"), postSel = pick(parts.post,"post");
      const pathEv = mergeEvidences(curEid, [lk]);
      const nodeP = (n)=>{
        const g2 = el(n.eid); if(!g2) return "";
        const s2 = getSourceInfo(g2.u, g2.e);
        const m = mark("node:"+n.eid, (D.versions[g2.u.vol]&&D.versions[g2.u.vol].name0||g2.u.vol)+" 第"+g2.u.unit+"单元 · "+s2.badge+" · "+s2.bookPageText+(n.verified?"（已回原件核对）":"（沿用早前提取）"));
        return '<div class="p-node"><div class="p-node-title">'+esc_((D.versions[g2.u.vol]&&D.versions[g2.u.vol].name0||g2.u.vol)+" 第"+g2.u.unit+"单元")+' '+m+'</div>'+
          '<div class="p-node-text">'+esc_(g2.e.text)+'</div>'+
          (n.link&&n.link!==g2.e.text ? '<div class="p-node-link">关联说明：'+esc_(n.link)+'</div>' : '')+
          '</div>';
      };
      const omitted = parts.pre.length + parts.post.length - preSel.length - postSel.length;
      overview += '<div class="print-page"><div class="p-header"><div class="p-title">'+headTitle+'</div>'+ 
        '<div class="p-sub">关联路径：'+esc_(lk.line)+'（第 '+(lk.index+1)+'/'+lk.total+' 个节点）　'+esc_(e.eid)+'</div></div>'+
        '<div class="p-cur-box"><div class="p-cur-text">'+esc_(e.text)+'</div>'+ 
        '<div class="p-cur-meta">'+esc_(srcInfo.badge)+'　'+esc_(srcInfo.bookPageText)+(e.orient?"　|　取向："+esc_(e.orient):"")+(uTheme?"　|　单元主题表述（"+esc_(uTheme.sourceLabel)+"）："+esc_(uTheme.text):"")+'</div>'+ 
         (e.sourceInfo && e.sourceInfo.display ? '<div class="p-cur-meta" style="margin-top:4px"><strong>出处依据：</strong>'+esc_(e.sourceInfo.display)+'</div>' : '')+ 
         (note?'<div class="p-cur-meta" style="margin-top:4px">关联概括：'+esc_(note)+'</div>':'')+ 
         (L[lk.line].note?'<div class="p-cur-meta" style="margin-top:4px"><strong>脉络说明：</strong>'+esc_(L[lk.line].note)+'</div>':'')+'</div>'+ 
        themeSearchHTML()+
        '<div class="p-board avoid-break">'+
        '<div class="p-col"><div class="p-col-title">此前相关（共'+parts.pre.length+'项，图示'+preSel.length+'项代表）</div>'+ (preSel.map(nodeP).join("") || '<p>（本侧暂无）</p>') +'</div>'+
        '<div class="p-col"><div class="p-col-title">此后相关（共'+parts.post.length+'项，图示'+postSel.length+'项代表）</div>'+ (postSel.map(nodeP).join("") || '<p>（本侧暂无）</p>') +'</div>'+ 
        '</div>'+
        (parts.sameUnit.length?'<div class="p-same-unit"><strong>同单元相关（非此前／此后）</strong>'+parts.sameUnit.map(n=>{const g2=el(n.eid); return g2?'<div>'+esc_(g2.e.text)+(n.link&&n.link!==g2.e.text?' <span>关联说明：'+esc_(n.link)+'</span>':'')+'</div>':"";}).join("")+'</div>':'')+
        (omitted>0?'<div class="p-omitted">本路径另有 '+omitted+' 个相关节点未在此页图示，完整条目见文后附录。</div>':'')+
        '<div class="p-standards avoid-break">'+
        '<div class="p-std-box"><div class="p-std-title">学段目标要点（'+esc_(curXdName)+'，整理概括）</div>'+
        (pathEv.directTargets.length ? pathEv.directTargets.map(t=>'<p>'+mark("kb:"+t.xd+t.dom+t.no+":"+lk.line, "课标·"+t.xd+" "+t.dom+" 第"+t.no+"条 · "+kbPageText(t.it)+"（"+t.pathRelations.map(r=>r.line+"："+r.reason).join("；")+"）")+' '+esc_(t.it.short||t.it.text)+'（'+esc_(t.paths.join("、"))+'）</p>').join("") : '<p>当前路径尚未建立直接目标条目。</p>')+
        '</div>'+
        '<div class="p-std-box"><div class="p-std-title">学业质量参照要点（整理概括）</div>'+
        (pathEv.directQualities.length ? pathEv.directQualities.map(q=>'<p>'+mark("qu:"+q.xueduan+(q.printPage||"")+(q.short||"")+":"+lk.line, "课标·"+q.xueduan+"学业质量 · 印刷页 "+q.printPage+"／PDF页 "+q.pdfPage+"（"+q.pathRelations.map(r=>r.line+"："+r.reason).join("；")+"）")+' '+esc_(q.short)+'（'+esc_(q.paths.join("、"))+'）</p>').join("") : '<p>'+(curXdName!=="第三学段"?"本学段（"+esc_(curXdName)+"）学业质量对应尚未整理，不借用第三学段条文填充。后续学段参照见附录。":"当前路径尚未建立直接学业质量参照。")+'</p>')+
        '</div></div>'+
        '<div class="p-footer">〔概括〕为整理概括；关联解读属教研判断，不是教材或课标的官方对应；教材先后不等于能力发展阶梯。本页来源编号对应附录「来源索引」。</div>'+
         '</div>';
    }
    const sameRelationPrint = sameUnitRelationPrintHTML(curEid);
    if(sameRelationPrint){
      overview += '<div class="print-page"><div class="p-header"><div class="p-title">'+headTitle+'</div><div class="p-sub">同单元关系　'+esc_(e.eid)+'</div></div>'+sameRelationPrint+'</div>';
    }
  }

  /* ---- B. 附录：原文与完整依据 ---- */
  let appendix = "";
  if(links.length){
    appendix += '<div class="appendix-page"><div class="p-app-title">附录一 · 全部已整理节点原文</div>';
    for(const lk of links){
      const arr = L[lk.line].nodes;
      const parts = splitNodes(arr, g.uid, curEid);
      const rowOf = (pos, n)=>{
        const g2 = el(n.eid); if(!g2) return "";
        const s2 = getSourceInfo(g2.u, g2.e);
        const v2 = D.versions[g2.u.vol]||{};
        const m = mark("node:"+n.eid, (v2.name0||g2.u.vol)+" 第"+g2.u.unit+"单元 · "+s2.badge+" · "+s2.bookPageText+(n.verified?"（已回原件核对）":"（沿用早前提取）"));
        return '<tr><td>'+esc_(pos)+'</td><td>'+esc_((v2.name0||g2.u.vol)+" 第"+g2.u.unit+"单元")+' '+m+'</td><td>'+esc_(g2.e.text)+'</td>'+
          '<td>'+esc_(s2.badge+'；'+s2.bookPageText+'；'+(v2.state||"版本待核"))+'</td>'+
          '<td>'+esc_(n.link||"")+'</td>'+
          '<td>'+esc_(n.verified?"已回原件核对":"沿用早前提取")+'</td></tr>';
      };
      appendix += '<div class="p-app-sec"><div class="p-app-sub">路径：'+esc_(lk.line)+'（共 '+lk.total+' 个节点）</div>'+
        '<table class="p-app-table"><tr><th>位置</th><th>册别单元</th><th>要素原文</th><th>来源与版本</th><th>关联解读（教研判断）</th><th>核验状态</th></tr>'+
        parts.pre.map(n=>rowOf("此前",n)).join("")+
        parts.sameUnit.map(n=>rowOf("同单元",n)).join("")+
        parts.post.map(n=>rowOf("此后",n)).join("")+
        '</table></div>';
    }
    appendix += '</div>';
  }

  if(evidenceLinksOf(curEid, links).length){
    appendix += '<div class="appendix-page"><div class="p-app-title">附录'+(links.length?"二":"一")+' · 课标原文依据</div>';
    appendix += '<div class="p-app-sec"><div class="p-app-sub">学段目标 · 直接依据（'+esc_(curXdName)+'）</div>';
    if(ev.directTargets.length){
      appendix += '<table class="p-app-table"><tr><th>条目</th><th>'+(links.length?'关联路径与性质':'对应性质')+'</th><th>课标原文</th><th>定位</th></tr>';
      for(const t of ev.directTargets){
        const m = mark("kb:"+t.xd+t.dom+t.no, "课标·"+t.xd+" "+t.dom+" 第"+t.no+"条 · "+kbPageText(t.it)+"（"+t.pathRelations.map(r=>r.line+'：'+r.reason).join("；")+"）");
        appendix += '<tr><td>'+esc_(t.xd+' '+t.dom+' 第'+t.no+'条')+' '+m+'</td><td>'+esc_(t.pathRelations ? t.pathRelations.map(r=>r.line+'：'+r.reason).join("；") : t.paths.join("、")+'；'+t.reasons.join("；"))+'</td><td>'+esc_(t.it.text)+(t.it.note?'<p>附注：'+esc_(t.it.note)+'</p>':'')+'</td><td>'+kbPageText(t.it)+'</td></tr>';
      }
      appendix += '</table>';
    } else {
      appendix += '<p>当前学段尚未建立直接目标条目。</p>';
    }
    if(ev.otherTargets.length){
      appendix += '<div class="p-app-sub">学段目标 · 其他相关目标参照</div><table class="p-app-table"><tr><th>条目</th><th>'+(links.length?'关联路径与性质':'对应性质')+'</th><th>课标原文</th><th>定位</th></tr>';
      for(const t of ev.otherTargets){
        appendix += '<tr><td>'+esc_(t.xd+' '+t.dom+' 第'+t.no+'条')+'</td><td>'+esc_(t.pathRelations ? t.pathRelations.map(r=>r.line+'：'+r.reason).join("；") : t.paths.join("、")+'；'+t.reasons.join("；"))+'</td><td>'+esc_(t.it.text)+(t.it.note?'<p>附注：'+esc_(t.it.note)+'</p>':'')+'</td><td>'+kbPageText(t.it)+'</td></tr>';
      }
      appendix += '</table>';
    }
    appendix += '</div>';

    appendix += '<div class="p-app-sec"><div class="p-app-sub">学业质量 · 直接参照（学段结束时的综合表现参照）</div>';
    if(ev.directQualities.length){
      appendix += '<table class="p-app-table"><tr><th>学段</th><th>'+(links.length?'关联路径':'参照性质')+'</th><th>课标原文</th><th>章节与页码</th></tr>';
      for(const q of ev.directQualities){
        const relationText = q.pathRelations ? q.pathRelations.map(r=>r.line+'：'+r.reason).join("；") : q.paths.join("、");
        const m = mark("qu:"+q.xueduan+(q.printPage||"")+(q.short||""), "课标·"+q.xueduan+"学业质量 · 印刷页 "+q.printPage+"／PDF页 "+q.pdfPage+"（"+relationText+"）");
        appendix += '<tr><td>'+esc_(q.xueduan)+' '+m+'</td><td>'+esc_(relationText+(q.scope?'；适用范围：'+q.scope:''))+'</td><td>'+esc_(q.text)+'</td><td>'+esc_(q.chapter)+'；印刷页 '+esc_(q.printPage)+'／PDF页 '+esc_(q.pdfPage)+'</td></tr>';
      }
      appendix += '</table>';
    } else {
      appendix += '<p>'+((D.unitEvidenceMap||{})[curEid] ? "本要素暂无可直接对应的学业质量条目；相关综合参照按已核依据列出。" : (curXdName!=="第三学段" ? "本学段（"+esc_(curXdName)+"）学业质量对应尚未整理；按规范不借用第三学段条文填充。" : "当前要素学业质量对应尚未单独建立，不自动填充不相关条款。"))+'</p>';
    }
    const qualityGroups = qualityReferenceGroups(ev.otherQualities, curXdName);
    const appendQualityTable = (items, heading)=>{
      if(!items.length) return;
      appendix += '<div class="p-app-sub">'+heading+'</div><table class="p-app-table"><tr><th>学段</th><th>'+(links.length?'关联路径':'参照性质')+'</th><th>课标原文</th><th>章节与页码</th></tr>';
      for(const q of items){
        appendix += '<tr><td>'+esc_(q.xueduan)+'</td><td>'+esc_((q.pathRelations ? q.pathRelations.map(r=>r.line+'：'+r.reason).join("；") : q.paths.join("、"))+(q.scope?'；适用范围：'+q.scope:''))+'</td><td>'+esc_(q.text)+'</td><td>'+esc_(q.chapter)+'；印刷页 '+esc_(q.printPage)+'／PDF页 '+esc_(q.pdfPage)+'</td></tr>';
      }
      appendix += '</table>';
    };
    appendQualityTable(qualityGroups.same, '学业质量 · 同学段综合参照');
    appendQualityTable(qualityGroups.later, '学业质量 · 后续学段终结性参照');
    appendQualityTable(qualityGroups.earlier, '学业质量 · 前置学段综合参照');
    appendix += '</div></div>';
  }

  const relatedMethods = relatedReadingMethodsOf(curEid);
  if(relatedMethods){
    appendix += '<div class="appendix-page"><div class="p-app-title">相关阅读方法（'+esc_(relatedMethods.support?relatedMethods.support.relationType:'教研比较')+'）</div><div class="p-app-sec">'+
      '<p>'+esc_(D.strategyComparison.nature)+'。'+esc_(D.strategyComparison.sequenceNote)+'</p>';
    if(relatedMethods.support){
      const support = relatedMethods.support;
      appendix += '<p>'+esc_(support.reason)+'</p><p><b>适用条件：</b>'+esc_(support.conditions)+'</p><p><b>课堂观察建议：</b>'+esc_(support.observable)+'</p><p>'+esc_(support.provenance)+'</p>';
    }
    appendix += '<table class="p-app-table"><tr><th>方法与要素原文</th><th>方法（教参归纳）</th><th>可观察表现（课堂建议）</th><th>使用边界与教参定位</th></tr>';
    for(const row of relatedMethods.rows){
      const m = mark("method:"+row.eid, "教参·"+methodSourceText(row)+"（相关阅读方法；教研归纳）");
      appendix += '<tr><td>'+esc_(row.strategy+' · '+row.unit)+(row.eid===curEid?'（当前要素）':'')+' '+m+'<p>'+esc_(row.text)+'</p></td>'+ 
        '<td>'+esc_(row.problem)+'<p>'+esc_(row.method)+'</p></td><td>'+esc_(row.observable)+'</td><td>'+esc_(row.boundary)+'<p>'+esc_(methodSourceText(row))+'</p></td></tr>';
    }
    appendix += '</table></div></div>';
  }

  if(themeCluster){
    appendix += '<div class="appendix-page"><div class="p-app-title">主题检索（教研归类）：'+esc_(themeCluster.label)+'</div>'+ 
      '<div class="p-app-sec"><p>'+esc_(themeCluster.boundary)+'</p>';
    for(const item of themeCluster.units){
      const themeUnit = U[item.unitId];
      if(!themeUnit) continue;
      const themeInfo = getUnitThemeInfo(themeUnit);
      const source = item.source||{};
      const sourceMark = mark("theme:"+themeCluster.id+":"+item.unitId,
        "主题检索（教研归类）·"+themeUnitLabel(item)+"：“"+(themeInfo?themeInfo.text:"主题表述未登记")+"”；"+themeSourceText(item));
      appendix += '<div class="p-app-sec"><div class="p-app-sub">'+esc_(themeUnitLabel(item))+' '+sourceMark+'</div>'+ 
        '<p><b>教材主题原文：</b>'+esc_(themeInfo?themeInfo.text:"主题表述未登记")+'</p>'+ 
        '<p><b>主题来源：</b>'+esc_([source.type,source.title,source.file,"印刷页 "+source.printPage+"／PDF页 "+source.pdfPage].filter(Boolean).join("；"))+'</p>'+ 
        '<p><b>归入理由与边界：</b>'+esc_(item.reason)+'</p>'+ 
        (item.supportSource?'<p><b>辅助来源：</b>'+esc_([item.supportSource.type,item.supportSource.title,item.supportSource.publication,item.supportSource.url].filter(Boolean).join("；"))+'</p>':'')+ 
        '</div>';
    }
    appendix += '</div></div>';
  }

  // 来源索引 + 版本登记
  let srcIdxHTML = '<div class="appendix-page"><div class="p-app-title">附录' + (links.length ? "三" : (evidenceLinksOf(curEid, links).length ? "二" : "一")) + ' · 来源索引与版本登记</div>'+
    '<div class="p-app-sec"><div class="p-app-sub">来源索引</div><div class="p-src-idx">'+
    srcList.map((s,i)=>'<div>['+(i+1)+'] '+esc_(s)+'</div>').join("")+
    '</div></div>'+
    '<div class="p-app-sec"><div class="p-app-sub">课标来源</div>'+
    '<p>'+esc_(D.meta.kbiaoSource)+'</p><p>'+esc_(D.meta.kbiaoNote)+'</p><p>'+esc_(D.meta.qualityNote)+'</p></div>'+
    '<div class="p-app-sec"><div class="p-app-sub">教材版本登记</div>'+
    '<table class="p-app-table"><tr><th>册别</th><th>状态</th><th>说明</th></tr>'+
    Object.keys(D.versions).sort((a,b)=>volOrder(a)-volOrder(b)).map(v=>'<tr><td>'+esc_(D.versions[v].name0||v)+'</td><td>'+esc_(D.versions[v].state||"")+'</td><td>'+esc_(D.versions[v].detail||"")+'</td></tr>').join("")+
    '</table><p>'+esc_(D.meta.verifyNote)+'</p></div>'+
    '<div class="p-app-sec"><div class="p-app-sub">整理范围</div><p>'+esc_(SCOPE_NOTE)+'</p></div>'+ 
    '</div>';

  let printHTML = overview + appendix + srcIdxHTML;
  printHTML = printHTML.replace(/(<table class="p-app-table">)(<tr><th>[\s\S]*?<\/tr>)/g, "$1<thead>$2</thead><tbody>");
  return printHTML.replace(/<\/table>/g, "</tbody></table>");
}

/* ================= 启动 ================= */
for(const k in D.versions){ D.versions[k].name0 = FULL[k]; }
document.getElementById("foot").innerHTML =
  '<div class="foot-meta">'+
  '<div>课标依据来源于《'+esc(D.meta.kbiaoSource.replace(/_可搜索\.pdf(?:\.txt)?$/, ""))+'》</div>'+
  '<div>教材版本：四下、五下、六下为统编旧教材。</div></div>'+
  '<details class="foot-details"><summary>整理范围与核定说明</summary><div class="foot-notes">' +
  '<p>'+esc(D.meta.kbiaoNote)+'</p><p>'+esc(D.meta.qualityNote)+'</p>'+ 
  '<p>'+esc(D.meta.verifyNote)+'</p><p>'+esc(SCOPE_NOTE)+'</p>'+ 
  '<p>数据构建：'+esc(D.meta.built)+'；本页为导出版，离线可用。</p></div></details>';
renderTools(); renderTable();
