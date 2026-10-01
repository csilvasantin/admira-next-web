import { DEMOS,SEEDS } from '../../_xpace-registry.js';
import { json } from '../../_xpace-auth.js';
export const onRequestGet=({request})=>json(request,{ok:true,source:'admiranext',demo:true,projects:SEEDS.filter(p=>DEMOS.some(v=>v.project_id===p.id)).map(p=>({id:p.id,name:p.label,circuit:p.circuit})),venues:DEMOS},200,true);
