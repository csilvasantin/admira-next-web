// Valoración económica al final de la sala de presentaciones.
// Líneas de concepto / precio / descuento / IVA. No es un ERP: no hay NIF,
// cobro, stock ni contabilidad. El importe nunca se fía del cliente: se recalcula.

export const MAX_BUDGET_LINES = 40;
export const MAX_CONCEPT = 180;
export const DEFAULT_IVA = 21;

export function round2(n){
  const value=Number(n);
  if(!Number.isFinite(value)) return 0;
  return Math.round(value*100)/100;
}

function clampPercent(value, fallback=0){
  const n=Number(value);
  if(!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function cleanConcept(value){
  return String(value==null?'':value).replace(/\s+/g,' ').trim().slice(0, MAX_CONCEPT);
}

function lineId(value, index){
  const id=String(value==null?'':value).trim().slice(0, 80);
  return id || `line-${index+1}`;
}

export function computeLine(line={}){
  const price=Math.max(0, round2(Number(line.price)||0));
  const discount=clampPercent(line.discount, 0);
  const iva=line.iva==null||line.iva===''?DEFAULT_IVA:clampPercent(line.iva, DEFAULT_IVA);
  const net=round2(price*(1-discount/100));
  const tax=round2(net*(iva/100));
  const amount=round2(net+tax);
  return {
    id:lineId(line.id, 0),
    concept:cleanConcept(line.concept),
    price,
    discount:round2(discount),
    iva:round2(iva),
    net,
    tax,
    amount
  };
}

export function normalizeBudgetLines(raw){
  if(!Array.isArray(raw) || !raw.length) return [];
  const output=[];
  for(let index=0; index<raw.length && output.length<MAX_BUDGET_LINES; index+=1){
    const row=raw[index];
    if(!row || typeof row!=='object') continue;
    const concept=cleanConcept(row.concept ?? row.concepto);
    const price=Math.max(0, round2(Number(row.price ?? row.precio)||0));
    const discount=clampPercent(row.discount ?? row.descuento ?? row.dto, 0);
    const ivaRaw=row.iva ?? row.IVA;
    const iva=ivaRaw==null||ivaRaw===''?DEFAULT_IVA:clampPercent(ivaRaw, DEFAULT_IVA);
    output.push({
      id:lineId(row.id, output.length),
      concept,
      price,
      discount:round2(discount),
      iva:round2(iva)
    });
  }
  return output;
}

export function computeBudget(lines){
  const computed=(Array.isArray(lines)?lines:[]).map((line,index)=>{
    const result=computeLine(line);
    result.id=lineId(line?.id, index);
    return result;
  });
  let base=0, discountTotal=0, ivaTotal=0, total=0;
  for(const line of computed){
    base=round2(base+line.price);
    discountTotal=round2(discountTotal+round2(line.price-line.net));
    ivaTotal=round2(ivaTotal+line.tax);
    total=round2(total+line.amount);
  }
  return {
    lines:computed,
    totals:{base, discountTotal, ivaTotal, total, currency:'EUR'}
  };
}

export function publicBudget(budget){
  const lines=normalizeBudgetLines(budget && typeof budget==='object' ? budget.lines : budget);
  const computed=computeBudget(lines);
  return {currency:'EUR', lines:computed.lines, totals:computed.totals};
}

export function persistBudget(rawLines){
  return {currency:'EUR', lines:normalizeBudgetLines(rawLines)};
}

export function readBudgetInput(raw){
  if(!raw || typeof raw!=='object') return undefined;
  if(Object.prototype.hasOwnProperty.call(raw, 'budgetLines')) return raw.budgetLines;
  if(raw.budget && typeof raw.budget==='object' && Object.prototype.hasOwnProperty.call(raw.budget, 'lines')) return raw.budget.lines;
  return undefined;
}

export function formatMoney(n){
  const value=round2(n);
  try{
    return value.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2})+' €';
  }catch(_){
    return value.toFixed(2)+' €';
  }
}
