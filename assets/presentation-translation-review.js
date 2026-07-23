(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdmiraPresentationTranslationReview=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var VERSION=1;
  var LANGUAGES=['es','ca','en'];
  var LABELS={
    es:{name:'Castellano',review:'Revisar idiomas',title:'Revisión lingüística',ready:'Versiones completas',issues:'Revisión necesaria',empty:'Falta este texto',residual:'Posible texto residual',term:'Terminología del cliente',close:'Cerrar',rerun:'Repetir revisión',blocking:'bloqueantes',warnings:'avisos',missingTerm:'Falta',duplicate:'Campo o bloque duplicado',extra:'Bloques extra',order:'El orden de diapositivas no coincide con ES'},
    ca:{name:'Català',review:'Revisar idiomes',title:'Revisió lingüística',ready:'Versions completes',issues:'Cal revisar',empty:'Falta aquest text',residual:'Possible text residual',term:'Terminologia del client',close:'Tancar',rerun:'Repetir revisió',blocking:'bloquejants',warnings:'avisos',missingTerm:'Falta',duplicate:'Camp o bloc duplicat',extra:'Blocs addicionals',order:"L'ordre de diapositives no coincideix amb ES"},
    en:{name:'English',review:'Review languages',title:'Language review',ready:'Versions complete',issues:'Review required',empty:'This text is missing',residual:'Possible residual text',term:'Client terminology',close:'Close',rerun:'Run review again',blocking:'blocking',warnings:'warnings',missingTerm:'Missing',duplicate:'Duplicate field or block',extra:'Extra blocks',order:'Slide order does not match ES'}
  };
  var LANGUAGE_HINTS={
    es:['objetivo','siguiente','presentación','para','que','cliente'],
    ca:['objectiu','següent','presentació','què','aquest'],
    en:['the','and','for','with','next','objective','presentation']
  };
  function text(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
  function normalized(value){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
  function fields(locale){
    var result=[];
    function add(path,value){result.push({path:path,text:text(value)})}
    locale=locale||{};
    add('hero.eyebrow',locale.hero&&locale.hero.eyebrow);add('hero.title',locale.hero&&locale.hero.title);add('hero.summary',locale.hero&&locale.hero.summary);add('objective',locale.objective);
    (locale.skeleton||[]).forEach(function(item,index){var id=text(item&&item.id)||String(index+1);add('skeleton.'+id+'.title',item&&item.title);add('skeleton.'+id+'.message',item&&item.message);add('skeleton.'+id+'.detail',item&&item.detail)});
    add('closing.title',locale.closing&&locale.closing.title);add('closing.action',locale.closing&&locale.closing.action);add('labels.objective',locale.labels&&locale.labels.objective);add('labels.next',locale.labels&&locale.labels.next);
    return result;
  }
  function blockIds(locale){return(locale&&locale.skeleton||[]).map(function(item,index){return text(item&&item.id)||String(index+1)})}
  function contains(haystack,needle){return needle&&normalized(haystack).indexOf(normalized(needle))>=0}
  function containsApproved(haystack,needle){return needle&&String(haystack||'').normalize('NFC').indexOf(String(needle).normalize('NFC'))>=0}
  function hintCount(value,language){var words=' '+normalized(value)+' ';return(LANGUAGE_HINTS[language]||[]).filter(function(word){return words.indexOf(' '+normalized(word)+' ')>=0}).length}
  function terminologyIssues(language,field,terminology,sourceText){
    var issues=[];
    (terminology||[]).forEach(function(entry){
      var expected=text(entry&&entry[language]);if(!expected)return;
      var variants=LANGUAGES.filter(function(candidate){return candidate!==language}).map(function(candidate){return text(entry&&entry[candidate])}).filter(function(value){return value&&normalized(value)!==normalized(expected)});
      var used=variants.find(function(value){return containsApproved(field.text,value)});
      if(used&&!containsApproved(field.text,expected))issues.push({severity:'warning',type:'terminology',language:language,path:field.path,title:LABELS[language].term,detail:'“'+used+'” → “'+expected+'”'});
      else if(language!=='es'&&containsApproved(sourceText,entry.es)&&!containsApproved(field.text,expected))issues.push({severity:'warning',type:'terminology',language:language,path:field.path,title:LABELS[language].term,detail:LABELS[language].missingTerm+' “'+expected+'”'});
    });
    return issues;
  }
  function review(options){
    options=options||{};var locales=options.locales||{},languages=(options.languages||Object.keys(locales)).filter(function(language){return LANGUAGES.indexOf(language)>=0}),issues=[],sourceFields=fields(locales.es),sourceByPath=Object.fromEntries(sourceFields.map(function(field){return[field.path,field.text]}));
    var sourceIds=blockIds(locales.es);
    languages.forEach(function(language){
      if(!locales[language]){issues.push({severity:'blocking',type:'missing-locale',language:language,path:'locale',title:LABELS[language].empty,detail:LABELS[language].name});return}
      var localeFields=fields(locales[language]);
      var localeMap=new Map(),duplicates=new Set();
      localeFields.forEach(function(field){if(localeMap.has(field.path))duplicates.add(field.path);else localeMap.set(field.path,field)});
      duplicates.forEach(function(path){issues.push({severity:'blocking',type:'structure',language:language,path:path,title:LABELS[language].empty,detail:LABELS[language].duplicate})});
      if(language!=='es'){
        var targetIds=blockIds(locales[language]),sourceSet=new Set(sourceIds),targetSet=new Set(targetIds);
        var extra=targetIds.filter(function(id){return!sourceSet.has(id)});
        if(extra.length)issues.push({severity:'blocking',type:'structure',language:language,path:'skeleton',title:LABELS[language].empty,detail:LABELS[language].extra+': '+extra.join(', ')});
        if(sourceIds.length===targetIds.length&&sourceIds.every(function(id){return targetSet.has(id)})&&sourceIds.join('|')!==targetIds.join('|'))issues.push({severity:'blocking',type:'structure',language:language,path:'skeleton',title:LABELS[language].empty,detail:LABELS[language].order});
      }
      var expectedFields=language==='es'?localeFields:sourceFields;
      expectedFields.forEach(function(expectedField){
        var field=localeMap.get(expectedField.path);
        if(!field){issues.push({severity:'blocking',type:'missing-field',language:language,path:expectedField.path,title:LABELS[language].empty,detail:expectedField.path});return}
        if(!field.text){issues.push({severity:'blocking',type:'empty',language:language,path:field.path,title:LABELS[language].empty,detail:field.path});return}
        if(language!=='es'){
          var source=sourceByPath[field.path]||'',same=normalized(source)===normalized(field.text);
          if(same&&field.text.length>8&&hintCount(field.text,'es')>0)issues.push({severity:'warning',type:'residual',language:language,path:field.path,title:LABELS[language].residual,detail:field.text});
          else{
            var foreign=LANGUAGES.filter(function(candidate){return candidate!==language}).reduce(function(total,candidate){return total+hintCount(field.text,candidate)},0);
            if(foreign>=2&&hintCount(field.text,language)===0)issues.push({severity:'warning',type:'residual',language:language,path:field.path,title:LABELS[language].residual,detail:field.text});
          }
        }
        issues.push.apply(issues,terminologyIssues(language,field,options.terminology,sourceByPath[field.path]||''));
      });
    });
    issues.sort(function(a,b){return LANGUAGES.indexOf(a.language)-LANGUAGES.indexOf(b.language)||a.path.localeCompare(b.path)||a.type.localeCompare(b.type)});
    return {version:VERSION,languages:languages,fieldsPerLanguage:sourceFields.length,blocking:issues.filter(function(issue){return issue.severity==='blocking'}).length,warnings:issues.filter(function(issue){return issue.severity==='warning'}).length,issues:issues};
  }
  function mount(options){
    options=options||{};if(typeof document==='undefined'||new URLSearchParams(location.search).get('audience')==='1')return null;
    var state=options.state||window.__ADMIRA_PRESENTATION_STATE__;if(!state||!state.locales)return null;
    var host=document.createElement('aside');host.className='translation-review';host.hidden=true;host.setAttribute('data-presenter-private','');host.setAttribute('aria-live','polite');host.setAttribute('role','dialog');host.setAttribute('aria-modal','false');host.setAttribute('aria-labelledby','translationReviewTitle');
    var head=document.createElement('div');head.className='translation-review-head';
    var title=document.createElement('strong'),close=document.createElement('button');title.id='translationReviewTitle';close.type='button';close.className='translation-review-close';head.append(title,close);
    var summary=document.createElement('p');summary.className='translation-review-summary';
    var list=document.createElement('div');list.className='translation-review-list';
    var rerun=document.createElement('button');rerun.type='button';rerun.className='translation-review-rerun';
    host.append(head,summary,list,rerun);document.body.append(host);
    var trigger=document.createElement('button');trigger.type='button';trigger.className='translation-review-trigger';trigger.setAttribute('data-presenter-private','');trigger.setAttribute('aria-expanded','false');document.querySelector('.languages')?.append(trigger);
    function language(){return LANGUAGES.indexOf(state.language)>=0?state.language:'es'}
    function render(){
      var active=language(),labels=LABELS[active],result=review({locales:state.locales,languages:state.languages||Object.keys(state.locales),terminology:state.terminology||[]});
      trigger.textContent=labels.review;title.textContent=labels.title;close.textContent=labels.close;rerun.textContent=labels.rerun;
      summary.textContent=result.blocking||result.warnings?labels.issues+' · '+result.blocking+' '+labels.blocking+' · '+result.warnings+' '+labels.warnings:labels.ready+' · '+result.languages.map(function(item){return item.toUpperCase()}).join(' · ');
      list.textContent='';
      if(!result.issues.length){var clean=document.createElement('p');clean.className='translation-review-clean';clean.textContent=labels.ready;list.append(clean)}
      result.issues.forEach(function(issue){
        var item=document.createElement('button');item.type='button';item.className='translation-review-issue';item.dataset.severity=issue.severity;
        var meta=document.createElement('span'),copy=document.createElement('strong'),detail=document.createElement('small');meta.textContent=issue.language.toUpperCase()+' · '+issue.path;copy.textContent=issue.title;detail.textContent=issue.detail;item.append(meta,copy,detail);
        item.addEventListener('click',function(){
          if(typeof window.__ADMIRA_APPLY_LANGUAGE__==='function')window.__ADMIRA_APPLY_LANGUAGE__(issue.language);
          var target=null,parts=issue.path.split('.');
          if(parts[0]==='skeleton'){var slide=[].slice.call(document.querySelectorAll('[data-block-id]')).find(function(node){return node.dataset.blockId===parts[1]});target=slide&&slide.querySelector('[data-edit-field="skeleton.'+parts[2]+'"]')}
          else target=document.querySelector('[data-edit-field="'+issue.path+'"]');
          if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'center'});
        });
        list.append(item);
      });
      return result;
    }
    function hide(){host.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus()}
    trigger.addEventListener('click',function(){render();host.hidden=false;trigger.setAttribute('aria-expanded','true');close.focus()});close.addEventListener('click',hide);rerun.addEventListener('click',render);
    host.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();hide()}});
    document.addEventListener('admira:language',function(){if(!host.hidden)render();else trigger.textContent=LABELS[language()].review});
    trigger.textContent=LABELS[language()].review;
    return {host:host,trigger:trigger,review:render,destroy:function(){host.remove();trigger.remove()}};
  }
  function autoMount(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){mount()},{once:true});else mount()}
  if(typeof window!=='undefined')autoMount();
  return {VERSION:VERSION,fields:fields,review:review,mount:mount,LABELS:LABELS};
});
