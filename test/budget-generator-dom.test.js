import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../assets/budget-generator.js",import.meta.url),"utf8");
const context=vm.createContext({Number,String,Date,Math,JSON,Intl,crypto:{randomUUID:()=>"dom-id"}});
vm.runInContext(source,context);
const B=context.BudgetGenerator._test;

class FakeInput{
  constructor(value=""){this.value=value;this.listeners={};}
  addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
  dispatch(type){for(const listener of this.listeners[type]||[])listener({type,target:this});}
}

test("quantity, cost y margin actualizan estado y preview durante el evento input sin perder sus valores",()=>{
  const item=B.normalizeItem({description:"Producción",quantity:1,unit:"proyecto",cost:0,margin:0,price:0});
  let preview=B.calculate({discount:0,vat:21,items:[item]}),renders=0;
  const update=(target,field,value,rerender)=>{
    B.applyItemValue(target,field,value);
    preview=B.calculate({discount:0,vat:21,items:[target]});
    if(rerender)renders++;
  };
  const quantity=new FakeInput("2"),cost=new FakeInput("1000"),margin=new FakeInput("30");
  B.bindItemControl(quantity,item,"quantity",update);
  B.bindItemControl(cost,item,"cost",update);
  B.bindItemControl(margin,item,"margin",update);

  quantity.dispatch("input");cost.dispatch("input");margin.dispatch("input");

  assert.deepEqual([quantity.value,cost.value,margin.value],["2","1000","30"],"los controles conservan lo tecleado");
  assert.deepEqual(JSON.parse(JSON.stringify(item)),{id:"dom-id",description:"Producción",quantity:2,unit:"proyecto",cost:1000,margin:30,price:1300});
  assert.equal(preview.subtotal,2600);
  assert.equal(preview.vat,546);
  assert.equal(preview.total,3146);
  assert.equal(preview.profit,600);
  assert.equal(renders,0,"input live no reconstruye la fila ni roba el foco");

  margin.dispatch("change");
  assert.equal(renders,1,"change conserva la reconciliación final de la fila");
});
