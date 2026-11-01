// Shared editing core for owned sites and presentations. This module never executes
// a document, fetches a URL or publishes it. Source adapters own those operations.
export const PROJECT = 'ainimation-refinement-project';
export const CHANGESET = 'ainimation-refinement-changes';
const MAX_BYTES = 2000000;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
const FORBIDDEN = new Set(['__proto__','prototype','constructor']);
const TYPES = new Set(['text','number','color','choice','boolean']);
const validId=value=>typeof value==='string'&&ID.test(value);

function fail(message) { throw Error(message); }
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function jsonCopy(value) {
  // Bound depth and reject objects that would change meaning when serialized.
  function visit(v,depth=0) {
    if(depth>50)fail('El proyecto tiene demasiados niveles.');
    if(v===null||typeof v==='string'||typeof v==='boolean')return;
    if(typeof v==='number'&&Number.isFinite(v))return;
    if(typeof v!=='object'||!v||(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype))fail('El proyecto debe contener datos JSON.');
    for(const [key,child] of Object.entries(v)) {
      if(FORBIDDEN.has(key))fail('El proyecto contiene una clave no compatible.');
      visit(child,depth+1);
    }
    if(Array.isArray(v)&&Object.keys(v).length!==v.length)fail('La lista contiene posiciones vacías.');
  }
  visit(value);
  const raw=JSON.stringify(value);
  if(new TextEncoder().encode(raw).length>MAX_BYTES)fail('El proyecto supera 2 MB.');
  return JSON.parse(raw);
}
function sourceRef(source) {
  if(!source||!validId(source.adapter)||!validId(source.id)||typeof source.revision!=='string'||!source.revision||source.revision.length>200)fail('Falta la identidad o revisión del origen.');
  return {adapter:source.adapter,id:source.id,revision:source.revision};
}
function locate(document,path) {
  let node=document;
  for(const key of path) {
    if(!node||typeof node!=='object'||!Object.hasOwn(node,key))fail('No se encuentra el componente original.');
    if(Array.isArray(node)&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=node.length))fail('La ruta no identifica un componente de la lista.');
    node=node[key];
  }
  return node;
}
function validValue(field,value) {
  if(field.type==='text')return typeof value==='string'&&value.length<=field.maxLength;
  if(field.type==='color')return typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
  if(field.type==='number')return typeof value==='number'&&Number.isFinite(value)&&value>=field.min&&value<=field.max;
  if(field.type==='boolean')return typeof value==='boolean';
  if(field.type==='choice')return field.options.includes(value);
  return false;
}
function fieldDefinition(input,document) {
  if(!input||!validId(input.id)||typeof input.label!=='string'||!input.label.trim()||input.label.length>160||!TYPES.has(input.type))fail('Campo editable no compatible.');
  if(!Array.isArray(input.path)||!input.path.length||input.path.length>30||input.path.some(k=>typeof k!=='string'||!k||k.length>160||FORBIDDEN.has(k)))fail('Ruta de componente no compatible.');
  const field={id:input.id,label:input.label,type:input.type,path:[...input.path]};
  if(field.type==='text') {
    if(!Number.isInteger(input.maxLength)||input.maxLength<1||input.maxLength>20000)fail('Límite de texto no compatible.');
    field.maxLength=input.maxLength;
  }
  if(field.type==='number') {
    if(!Number.isFinite(input.min)||!Number.isFinite(input.max)||input.min>input.max)fail('Rango numérico no compatible.');
    field.min=input.min;field.max=input.max;
  }
  if(field.type==='choice') {
    if(!Array.isArray(input.options)||input.options.length<1||input.options.length>100||input.options.some(v=>typeof v!=='string'||!v||v.length>160)||new Set(input.options).size!==input.options.length)fail('Opciones no compatibles.');
    field.options=[...input.options];
  }
  if(!validValue(field,locate(document,field.path)))fail('El componente original no coincide con su campo editable.');
  return field;
}
export function validateProject(input) {
  if(!input||input.format!==PROJECT||input.version!==1||!['site','presentation'].includes(input.kind)||typeof input.title!=='string'||!input.title.trim()||input.title.length>220)fail('Proyecto editable no compatible.');
  const source=sourceRef(input.source),document=jsonCopy(input.document);
  if(!document||typeof document!=='object'||Array.isArray(document))fail('Falta la estructura del proyecto.');
  if(!Array.isArray(input.fields)||input.fields.length>1000)fail('Lista de campos no compatible.');
  const fields=input.fields.map(f=>fieldDefinition(f,document)),ids=new Set(),paths=new Set();
  for(const field of fields) {
    const path=JSON.stringify(field.path);
    if(ids.has(field.id)||paths.has(path))fail('Un componente no puede declararse dos veces.');
    ids.add(field.id);paths.add(path);
  }
  return {format:PROJECT,version:1,kind:input.kind,title:input.title,source,document,fields};
}
function put(document,path,value) {
  let node=document;for(const key of path.slice(0,-1))node=node[key];node[path.at(-1)]=value;
}
export function editField(input,id,value) {
  const project=validateProject(input),field=project.fields.find(f=>f.id===id);
  if(!field)fail('El origen no permite editar ese componente.');
  if(!validValue(field,value))fail('El ajuste no respeta los límites del componente.');
  put(project.document,field.path,value);return project;
}
export function changesBetween(original,draft) {
  const base=validateProject(original),edited=validateProject(draft);
  if(!same(base.source,edited.source)||base.kind!==edited.kind||base.title!==edited.title||!same(base.fields,edited.fields))fail('El borrador pertenece a otro proyecto o contrato.');
  const changes=[];
  for(const field of base.fields) {
    const before=locate(base.document,field.path),after=locate(edited.document,field.path);
    if(!same(before,after))changes.push({field:field.id,before,after});
  }
  // Changes outside the declared fields must never silently disappear on save.
  const replay=jsonCopy(base.document);
  for(const change of changes)put(replay,base.fields.find(f=>f.id===change.field).path,change.after);
  if(!same(replay,edited.document))fail('Hay cambios fuera de los componentes editables.');
  return {format:CHANGESET,version:1,source:{...base.source},changes};
}
export function applyChanges(input,changeset) {
  const project=validateProject(input);
  if(changeset?.format!==CHANGESET||changeset.version!==1||!same(project.source,sourceRef(changeset.source)))fail('El origen cambió de revisión. Conserva el borrador y compara antes de guardar.');
  if(!Array.isArray(changeset.changes)||changeset.changes.length>project.fields.length)fail('Lista de ajustes no compatible.');
  const seen=new Set();
  for(const change of changeset.changes) {
    const field=project.fields.find(f=>f.id===change.field);
    if(!field||seen.has(change.field)||!same(locate(project.document,field.path),change.before)||!validValue(field,change.after))fail('El componente cambió o el ajuste no es válido.');
    seen.add(change.field);put(project.document,field.path,change.after);
  }
  return project;
}

// Adapters must read current source and check revision/permissions again when
// committing. A successful local apply does not acknowledge a remote save.
export function reverseChanges(changeset) {
  if(changeset?.format!==CHANGESET||changeset.version!==1||!Array.isArray(changeset.changes))fail('Lista de ajustes no compatible.');
  return {format:CHANGESET,version:1,source:sourceRef(changeset.source),changes:changeset.changes.map(c=>({field:c.field,before:c.after,after:c.before}))};
}
