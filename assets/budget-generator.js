(function(root){
  "use strict";
  var STORAGE_KEY="admiranext.budget-generator.v1",VERSION="v.26.08.03.r1";
  function number(value){var n=Number(value);return Number.isFinite(n)?n:0}
  function clamp(value,min,max){return Math.min(max,Math.max(min,number(value)))}
  function round(value){var n=number(value);return Math.round((n+Math.sign(n)*1e-10)*100)/100}
  function id(){return root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():"b-"+Date.now().toString(36)+Math.random().toString(36).slice(2)}
  function clone(value){return JSON.parse(JSON.stringify(value))}
  function isoDate(date){var d=date||new Date(),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10)}
  function addDays(date,days){var d=new Date((date||isoDate())+"T12:00:00");d.setDate(d.getDate()+days);return isoDate(d)}
  function normalizeItem(raw){
    raw=raw||{};var cost=Math.max(0,number(raw.cost)),margin=number(raw.margin),price=raw.price==null?cost*(1+margin/100):Math.max(0,number(raw.price));
    return{id:raw.id||id(),description:String(raw.description||""),quantity:Math.max(0,number(raw.quantity==null?1:raw.quantity)),unit:String(raw.unit||"ud."),cost:round(cost),margin:round(margin),price:round(price)};
  }
  function calculate(doc){
    var items=(doc.items||[]).map(normalizeItem),subtotal=round(items.reduce(function(sum,item){return sum+item.quantity*item.price},0));
    var costs=round(items.reduce(function(sum,item){return sum+item.quantity*item.cost},0)),discountRate=clamp(doc.discount,0,100),discount=round(subtotal*discountRate/100);
    var base=round(subtotal-discount),vatRate=clamp(doc.vat,0,100),vat=round(base*vatRate/100),total=round(base+vat),profit=round(base-costs),realMargin=base?round(profit/base*100):0;
    return{items:items,subtotal:subtotal,costs:costs,discountRate:discountRate,discount:discount,base:base,vatRate:vatRate,vat:vat,total:total,profit:profit,realMargin:realMargin};
  }
  function csvCell(value){var text=String(value==null?"":value);text=text.replace(/^([\s\u0000-\u001f]*)([=+\-@])/,"$1'$2");return '"'+text.replace(/"/g,'""')+'"'}
  function csvFor(doc){
    var calc=calculate(doc),rows=[["Presupuesto",doc.number],["Cliente",doc.client],["Oportunidad",doc.opportunity],["Fecha",doc.date],[],["Descripción","Cantidad","Unidad","Coste","Margen %","Precio","Importe"]];
    calc.items.forEach(function(item){rows.push([item.description,item.quantity,item.unit,item.cost,item.margin,item.price,round(item.quantity*item.price)])});
    rows.push([], ["Subtotal",calc.subtotal],["Descuento %",calc.discountRate],["Descuento",calc.discount],["Base imponible",calc.base],["IVA %",calc.vatRate],["IVA",calc.vat],["Total",calc.total],["Coste",calc.costs],["Beneficio",calc.profit],["Margen real %",calc.realMargin]);
    return "\ufeff"+rows.map(function(row){return row.map(csvCell).join(";")}).join("\r\n");
  }
  function applyItemValue(item,field,value){
    if(field==="description"||field==="unit")item[field]=value;
    else item[field]=Math.max(field==="margin"?-100:0,number(value));
    if(field==="cost"||field==="margin")item.price=round(item.cost*(1+item.margin/100));
    if(field==="price")item.margin=item.cost?round((item.price/item.cost-1)*100):0;
    return item;
  }
  function bindItemControl(node,item,field,onUpdate){
    node.addEventListener("input",function(){onUpdate(item,field,node.value,false)});
    node.addEventListener("change",function(){onUpdate(item,field,node.value,true)});
    return node;
  }
  function newDocument(sequence){var today=isoDate();return{id:id(),number:"PRE-"+today.replace(/-/g,"")+"-"+String(sequence||1).padStart(2,"0"),date:today,validUntil:addDays(today,30),owner:"",client:"",taxId:"",contact:"",email:"",opportunity:"",discount:0,vat:21,currency:"EUR",notes:"Pago: 50 % a la aceptación y 50 % a la entrega.",items:[normalizeItem({description:"Servicios profesionales",quantity:1,unit:"proyecto",cost:0,margin:30})],versions:[],createdAt:Date.now(),updatedAt:Date.now()}}
  function emptyStore(){return{activeId:"",documents:[],trash:[]}}
  function sanitizeStore(value){var store=value&&typeof value==="object"?value:emptyStore();return{activeId:String(store.activeId||""),documents:Array.isArray(store.documents)?store.documents:[],trash:Array.isArray(store.trash)?store.trash:[]}}

  root.BudgetGenerator={_test:{number:number,round:round,normalizeItem:normalizeItem,calculate:calculate,csvCell:csvCell,csvFor:csvFor,
    applyItemValue:applyItemValue,bindItemControl:bindItemControl,newDocument:newDocument,version:VERSION}};
  if(!root.document)return;

  var document=root.document,store=loadStore(),active=null,saveTimer=null,toastTimer=null;
  var fields=["number","date","validUntil","owner","client","taxId","contact","email","opportunity","discount","vat","currency","notes"];
  var $=function(selector){return document.getElementById(selector)};
  function loadStore(){try{return sanitizeStore(JSON.parse(root.localStorage.getItem(STORAGE_KEY)||"null"))}catch(_){return emptyStore()}}
  function persist(message){try{root.localStorage.setItem(STORAGE_KEY,JSON.stringify(store));$("storageState").textContent=message||"Guardado"}catch(_){$("storageState").textContent="Sin almacenamiento"}}
  function toast(message){var box=$("toast");box.textContent=message;box.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){box.classList.remove("show")},2200)}
  function money(value,currency){try{return new Intl.NumberFormat("es-ES",{style:"currency",currency:currency||"EUR"}).format(number(value))}catch(_){return round(value).toFixed(2)+" "+(currency||"EUR")}}
  function dateLabel(value){if(!value)return"—";var d=new Date(value+"T12:00:00");return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(d)}
  function currentIndex(){return store.documents.findIndex(function(doc){return doc.id===store.activeId})}
  function ensureActive(){
    var current=store.documents.find(function(doc){return doc.id===store.activeId});
    if(!current){current=newDocument(store.documents.length+store.trash.length+1);store.documents.unshift(current);store.activeId=current.id;persist("Nuevo borrador")}
    active=current;active.items=(active.items||[]).map(normalizeItem);active.versions=Array.isArray(active.versions)?active.versions:[];
  }
  function scheduleSave(){clearTimeout(saveTimer);$("storageState").textContent="Guardando…";saveTimer=setTimeout(function(){active.updatedAt=Date.now();persist("Guardado");renderLibrary()},220)}
  function fillForm(){fields.forEach(function(name){var node=$(name);if(node)node.value=active[name]==null?"":active[name]});renderItems();renderAll()}
  function readField(event){var name=event.target.name;if(!name||fields.indexOf(name)<0)return;active[name]=["discount","vat"].indexOf(name)>=0?number(event.target.value):event.target.value;scheduleSave();renderPreview()}
  function addItem(raw){active.items.push(normalizeItem(raw||{description:"",quantity:1,unit:"ud.",cost:0,margin:30}));renderItems();renderAll();scheduleSave();setTimeout(function(){var all=document.querySelectorAll(".item-row .description");if(all.length)all[all.length-1].focus()},0)}
  function updateItem(item,field,value,rerender){
    applyItemValue(item,field,value);
    scheduleSave();if(rerender!==false)renderItems();renderPreview();
  }
  function make(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=String(text);return node}
  function control(item,field,type,extra){var node=make(type==="select"?"select":"input",field==="description"?"description":"");node.dataset.field=field;if(type==="select"){
      ["ud.","hora","día","mes","proyecto","campaña","licencia"].forEach(function(value){var option=make("option","",value);option.value=value;node.appendChild(option)});node.value=item[field];
    }else{node.type=type||"text";node.value=item[field];if(type==="number"){node.step=extra||"0.01";node.min=field==="margin"?"-100":"0"}node.setAttribute("aria-label",field+" de "+(item.description||"partida"))}
    return bindItemControl(node,item,field,updateItem)}
  function renderItems(){var list=$("itemList");list.replaceChildren();if(!active.items.length){list.appendChild(make("p","empty-state","No hay partidas. Añade una para empezar."));return}
    active.items.forEach(function(item,index){var row=make("div","item-row");row.dataset.id=item.id;row.append(control(item,"description","text"),control(item,"quantity","number","0.01"),control(item,"unit","select"),control(item,"cost","number"),control(item,"margin","number"),control(item,"price","number"));
      row.appendChild(make("output","money",money(item.quantity*item.price,active.currency)));var remove=make("button","remove-item","×");remove.type="button";remove.setAttribute("aria-label","Eliminar partida "+(index+1));remove.addEventListener("click",function(){active.items=active.items.filter(function(candidate){return candidate.id!==item.id});renderItems();renderAll();scheduleSave()});row.appendChild(remove);list.appendChild(row)})}
  function renderPreview(){var calc=calculate(active),currency=active.currency;
    $("viewNumber").textContent=active.number||"—";$("viewDate").textContent=dateLabel(active.date);$("viewClient").textContent=active.client||"Cliente por definir";$("viewContact").textContent=[active.contact,active.email,active.taxId].filter(Boolean).join(" · ")||"—";$("viewOpportunity").textContent=active.opportunity||"—";$("viewValidUntil").textContent=dateLabel(active.validUntil);$("viewNotes").textContent=active.notes||"Sin condiciones adicionales.";
    var body=$("viewItems");body.replaceChildren();calc.items.forEach(function(item){var row=make("tr");[item.description||"Partida sin descripción",item.quantity,item.unit,money(item.price,currency),money(item.quantity*item.price,currency)].forEach(function(value){row.appendChild(make("td","",value))});body.appendChild(row)});if(!calc.items.length){var empty=make("td","","Sin partidas");empty.colSpan=5;var row=make("tr");row.appendChild(empty);body.appendChild(row)}
    $("viewSubtotal").textContent=money(calc.subtotal,currency);$("viewDiscount").textContent="− "+money(calc.discount,currency);$("discountRow").hidden=!calc.discount;$("viewBase").textContent=money(calc.base,currency);$("vatLabel").textContent="IVA ("+calc.vatRate+" %)";$("viewVat").textContent=money(calc.vat,currency);$("viewTotal").textContent=money(calc.total,currency);$("viewCost").textContent=money(calc.costs,currency);$("viewProfit").textContent=money(calc.profit,currency);$("viewMargin").textContent=calc.realMargin.toLocaleString("es-ES",{maximumFractionDigits:1})+" %";$("editorTitle").textContent=active.client?"Presupuesto · "+active.client:"Presupuesto";
  }
  function renderLibrary(){var list=$("documentList");list.replaceChildren();store.documents.slice().sort(function(a,b){return b.updatedAt-a.updatedAt}).forEach(function(doc){var button=make("button","document-card"+(doc.id===active.id?" active":""));button.type="button";button.append(make("b","",doc.client||"Sin cliente"),make("span","",(doc.number||"Sin número")+" · "+dateLabel(doc.updatedAt?isoDate(new Date(doc.updatedAt)):doc.date)));button.addEventListener("click",function(){store.activeId=doc.id;ensureActive();persist();fillForm();renderLibrary()});list.appendChild(button)});
    var versions=$("versionList");versions.replaceChildren();$("versionCount").textContent=active.versions.length;active.versions.slice().reverse().forEach(function(version){var row=make("div","mini-row"),button=make("button","document-card",version.label+" · "+new Date(version.createdAt).toLocaleString("es-ES")),restore=make("button","","Restaurar");button.type="button";button.addEventListener("click",function(){toast("Versión guardada: "+version.label)});restore.type="button";restore.addEventListener("click",function(){var keep=active.versions.slice(),activeId=active.id;Object.assign(active,clone(version.data),{id:activeId,versions:keep,updatedAt:Date.now()});persist("Versión restaurada");fillForm();toast("Versión restaurada")});row.append(button,restore);versions.appendChild(row)});if(!active.versions.length)versions.appendChild(make("p","empty-state","Todavía no hay versiones."));
    var trash=$("trashList");trash.replaceChildren();$("trashCount").textContent=store.trash.length;store.trash.forEach(function(doc){var row=make("div","mini-row"),label=make("div","document-card"),restore=make("button","","Recuperar");label.append(make("b","",doc.client||"Sin cliente"),make("span","",doc.number||"Sin número"));restore.type="button";restore.addEventListener("click",function(){store.trash=store.trash.filter(function(x){return x.id!==doc.id});delete doc.deletedAt;doc.updatedAt=Date.now();store.documents.unshift(doc);store.activeId=doc.id;ensureActive();persist("Recuperado");fillForm();renderLibrary();toast("Presupuesto recuperado")});row.append(label,restore);trash.appendChild(row)});if(!store.trash.length)trash.appendChild(make("p","empty-state","La papelera está vacía."));
  }
  function renderAll(){renderPreview();renderLibrary()}
  function createNew(){var doc=newDocument(store.documents.length+store.trash.length+1);store.documents.unshift(doc);store.activeId=doc.id;ensureActive();persist("Nuevo borrador");fillForm();toast("Nuevo presupuesto")}
  function duplicate(){var copy=clone(active);copy.id=id();copy.number=(active.number||"PRE")+"-COPIA";copy.client=(active.client||"")+" (copia)";copy.versions=[];copy.createdAt=copy.updatedAt=Date.now();copy.items=copy.items.map(function(item){item.id=id();return item});store.documents.unshift(copy);store.activeId=copy.id;ensureActive();persist("Duplicado");fillForm();toast("Presupuesto duplicado")}
  function saveVersion(){var sequence=active.versions.length+1,data=clone(active);delete data.versions;active.versions.push({id:id(),label:"Versión "+sequence,createdAt:Date.now(),data:data});scheduleSave();renderLibrary();toast("Versión "+sequence+" guardada")}
  function removeActive(){if(!root.confirm("¿Mover este presupuesto a la papelera? Podrás recuperarlo."))return;var index=currentIndex(),removed=store.documents.splice(index,1)[0];removed.deletedAt=Date.now();store.trash.unshift(removed);store.activeId=store.documents[0]&&store.documents[0].id||"";ensureActive();persist("Movido a papelera");fillForm();toast("Movido a papelera")}
  function downloadCsv(){var blob=new Blob([csvFor(active)],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=(active.number||"presupuesto").replace(/[^a-z0-9_-]+/gi,"-")+".csv";document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url)},0);toast("CSV exportado")}
  function boot(){ensureActive();fields.forEach(function(name){var node=$(name);node.addEventListener("input",readField);node.addEventListener("change",readField)});$("budgetForm").addEventListener("submit",function(event){event.preventDefault()});$("addItem").addEventListener("click",function(){addItem()});$("newBudget").addEventListener("click",createNew);$("duplicateBudget").addEventListener("click",duplicate);$("saveVersion").addEventListener("click",saveVersion);$("deleteBudget").addEventListener("click",removeActive);$("exportCsv").addEventListener("click",downloadCsv);$("printBudget").addEventListener("click",function(){root.print()});fillForm();renderLibrary()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})(typeof window!=="undefined"?window:globalThis);
