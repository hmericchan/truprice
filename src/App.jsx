// TruPrice v1.12
import { useState, useEffect, useMemo, useRef, useCallback } from “react”;
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from “recharts”;

const UNIT_GROUPS = [
{ label:“Weight”, units:[“kg”,“g”,“lb”,“oz”,“斤(HK)”,“兩(HK)”,“斤(CN)”,“兩(CN)”] },
{ label:“Volume”, units:[“L”,“ml”,“fl oz”] },
{ label:“Count”,  units:[“count”] },
];
const TO_BASE = { g:1,kg:1000,lb:453.592,oz:28.3495,“斤(HK)”:604.79,“兩(HK)”:37.799,“斤(CN)”:500,“兩(CN)”:50,ml:1,L:1000,“fl oz”:29.5735,count:1 };
const UNIT_TYPE = { g:“weight”,kg:“weight”,lb:“weight”,oz:“weight”,“斤(HK)”:“weight”,“兩(HK)”:“weight”,“斤(CN)”:“weight”,“兩(CN)”:“weight”,ml:“volume”,L:“volume”,“fl oz”:“volume”,count:“count” };
const BASE_LABEL = { weight:“per 100g”, volume:“per 100ml”, count:“per unit” };
const COLORS = [”#378ADD”,”#1D9E75”,”#D85A30”,”#7F77DD”,”#BA7517”,”#D4537E”,”#639922”,”#888780”];
const STORAGE_KEY = “price_tracker_v2”;
const FX_CACHE_KEY = “truprice_fx_cache”;
const CURRENCIES = [“HKD”,“USD”,“CAD”];
const CURRENCY_SYMBOLS = { HKD:“HK$”, USD:“US$”, CAD:“CA$” };

const PRESET_TAGS = [
“Meat & Poultry”,“Seafood”,“Vegetables”,“Fruits”,“Tofu & Eggs”,
“Dry Goods 乾貨”,“Canned & Bottled”,“Rice & Grains”,“Noodles & Pasta”,“Snacks”,
“Chinese Herbs 中藥材”,“Health Foods”,“Supplements”,
“Condiments & Sauces”,“Beverages”,“Dairy”,“Frozen”,“Cleaning & Personal Care”
];

const ITEM_TAG_MAP = {
“玉竹”:“Chinese Herbs 中藥材”,“海玉竹”:“Chinese Herbs 中藥材”,“雪耳”:“Chinese Herbs 中藥材”,
“木耳”:“Chinese Herbs 中藥材”,“淮山”:“Chinese Herbs 中藥材”,“蓮子”:“Chinese Herbs 中藥材”,
“紅棗”:“Chinese Herbs 中藥材”,“杞子”:“Chinese Herbs 中藥材”,“百合”:“Chinese Herbs 中藥材”,
“沙參”:“Chinese Herbs 中藥材”,“玉米鬚”:“Chinese Herbs 中藥材”,“茯苓”:“Chinese Herbs 中藥材”,
“川貝”:“Chinese Herbs 中藥材”,“陳皮”:“Chinese Herbs 中藥材”,“黨參”:“Chinese Herbs 中藥材”,
“北芪”:“Chinese Herbs 中藥材”,“當歸”:“Chinese Herbs 中藥材”,“鐵棍淮山片”:“Chinese Herbs 中藥材”,
“雞翼”:“Meat & Poultry”,“雞腿”:“Meat & Poultry”,“雞胸”:“Meat & Poultry”,
“全雞”:“Meat & Poultry”,“無激素雞翼”:“Meat & Poultry”,“無激素雞扒”:“Meat & Poultry”,
“豬肉”:“Meat & Poultry”,“豬扒”:“Meat & Poultry”,“豬腩”:“Meat & Poultry”,
“牛肉”:“Meat & Poultry”,“牛扒”:“Meat & Poultry”,“羊肉”:“Meat & Poultry”,
“三文魚”:“Seafood”,“蝦”:“Seafood”,“帶子”:“Seafood”,“花甲”:“Seafood”,
“青口”:“Seafood”,“魚柳”:“Seafood”,“墨魚”:“Seafood”,“蟹”:“Seafood”,
“白菜”:“Vegetables”,“菜心”:“Vegetables”,“芥蘭”:“Vegetables”,“西蘭花”:“Vegetables”,
“番茄”:“Vegetables”,“青椒”:“Vegetables”,“洋蔥”:“Vegetables”,“薯仔”:“Vegetables”,
“紅蘿蔔”:“Vegetables”,“節瓜”:“Vegetables”,“冬瓜”:“Vegetables”,“苦瓜”:“Vegetables”,
“蘋果”:“Fruits”,“橙”:“Fruits”,“香蕉”:“Fruits”,“提子”:“Fruits”,
“西瓜”:“Fruits”,“芒果”:“Fruits”,“奇異果”:“Fruits”,“草莓”:“Fruits”,
“白米”:“Rice & Grains”,“糙米”:“Rice & Grains”,“泰國香米”:“Rice & Grains”,
“有機米”:“Rice & Grains”,“燕麥”:“Rice & Grains”,“粟米片”:“Rice & Grains”,
“公仔麵”:“Noodles & Pasta”,“意粉”:“Noodles & Pasta”,“烏冬”:“Noodles & Pasta”,
“米粉”:“Noodles & Pasta”,“河粉”:“Noodles & Pasta”,“蛋麵”:“Noodles & Pasta”,
“豉油”:“Condiments & Sauces”,“生抽”:“Condiments & Sauces”,“老抽”:“Condiments & Sauces”,
“蠔油”:“Condiments & Sauces”,“鹽”:“Condiments & Sauces”,“糖”:“Condiments & Sauces”,
“醋”:“Condiments & Sauces”,“麻油”:“Condiments & Sauces”,“米糠油”:“Condiments & Sauces”,
“花生油”:“Condiments & Sauces”,“橄欖油”:“Condiments & Sauces”,“椰子油”:“Condiments & Sauces”,
“茶葉”:“Beverages”,“咖啡”:“Beverages”,“豆漿”:“Beverages”,“橙汁”:“Beverages”,
“可樂”:“Beverages”,“礦泉水”:“Beverages”,“綠茶”:“Beverages”,“菊花茶”:“Beverages”,
“牛奶”:“Dairy”,“芝士”:“Dairy”,“乳酪”:“Dairy”,“忌廉”:“Dairy”,“牛油”:“Dairy”,
“豆腐”:“Tofu & Eggs”,“雞蛋”:“Tofu & Eggs”,“皮蛋”:“Tofu & Eggs”,“鹹蛋”:“Tofu & Eggs”,
“豆腐花”:“Tofu & Eggs”,“腐竹”:“Tofu & Eggs”,
“冬菇”:“Dry Goods 乾貨”,“蝦米”:“Dry Goods 乾貨”,“瑤柱”:“Dry Goods 乾貨”,
“髮菜”:“Dry Goods 乾貨”,“海帶”:“Dry Goods 乾貨”,“紫菜”:“Dry Goods 乾貨”,
“腰果”:“Dry Goods 乾貨”,“合桃”:“Dry Goods 乾貨”,“杏仁”:“Dry Goods 乾貨”,
“急凍蝦”:“Frozen”,“急凍魚”:“Frozen”,“急凍雞”:“Frozen”,“雪糕”:“Frozen”,“急凍餃子”:“Frozen”,
“午餐肉”:“Canned & Bottled”,“茄汁豆”:“Canned & Bottled”,“粟米罐”:“Canned & Bottled”,
“吞拿魚罐”:“Canned & Bottled”,“沙丁魚罐”:“Canned & Bottled”,
};

const today = () => new Date().toISOString().slice(0,10);
const EMPTY = { name:””,brand:””,store:””,tag:””,pricingType:“single”,price:””,qty:””,unit:“g”,bundleQty:“2”,origPrice:””,note:””,priceDate:today(),currency:“HKD” };
const ff = “system-ui,-apple-system,sans-serif”;

function normalizePrice(price,qty,unit,bundleQty=1) {
const p=parseFloat(price),q=parseFloat(qty),b=parseFloat(bundleQty)||1;
if(!p||!q||isNaN(p)||isNaN(q)||q===0) return null;
const totalBase=q*(TO_BASE[unit]||1);
const type=UNIT_TYPE[unit];
const divisor=type===“count”?1:100;
return { normalized:parseFloat(((p/b/totalBase)*divisor).toFixed(1)), label:BASE_LABEL[type], type };
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} };
const loadFxCache = () => { try { return JSON.parse(localStorage.getItem(FX_CACHE_KEY))||null; } catch { return null; } };
const saveFxCache = d => { try { localStorage.setItem(FX_CACHE_KEY,JSON.stringify(d)); } catch {} };

function ClearableInput({ value, onChange, style, …props }) {
return (
<div style={{position:“relative”,display:“flex”,alignItems:“center”}}>
<input style={{…style,paddingRight:value?“30px”:style.padding||“7px 10px”}} value={value} onChange={e=>onChange(e.target.value)} {…props}/>
{value&&<button onMouseDown={e=>{e.preventDefault();onChange(””);}} style={{position:“absolute”,right:8,background:“none”,border:“none”,cursor:“pointer”,fontSize:14,color:”#aaa”,padding:0,lineHeight:1}}>×</button>}
</div>
);
}

function AutocompleteInput({ value, onChange, suggestions, placeholder, style }) {
const [open,setOpen] = useState(false);
const ref = useRef();
const filtered = useMemo(()=>{
const q=value.trim().toLowerCase();
return q ? suggestions.filter(s=>s.toLowerCase().includes(q)) : suggestions;
},[value,suggestions]);
useEffect(()=>{
const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
document.addEventListener(“mousedown”,h);
return ()=>document.removeEventListener(“mousedown”,h);
},[]);
return (
<div style={{position:“relative”}} ref={ref}>
<div style={{position:“relative”,display:“flex”,alignItems:“center”}}>
<input style={{…style,paddingRight:value?“30px”:style.padding||“7px 10px”}} value={value}
onChange={e=>{onChange(e.target.value);setOpen(true);}}
onFocus={()=>setOpen(true)} placeholder={placeholder}/>
{value&&<button onMouseDown={e=>{e.preventDefault();onChange(””);setOpen(false);}} style={{position:“absolute”,right:8,background:“none”,border:“none”,cursor:“pointer”,fontSize:14,color:”#aaa”,padding:0,lineHeight:1}}>×</button>}
</div>
{open&&filtered.length>0&&(
<div style={{position:“absolute”,top:“100%”,left:0,right:0,zIndex:50,background:”#fff”,border:“1px solid #ccc”,borderRadius:8,maxHeight:160,overflowY:“auto”,marginTop:2}}>
{filtered.map(s=>(
<div key={s} onMouseDown={()=>{onChange(s);setOpen(false);}}
style={{padding:“8px 12px”,fontSize:13,cursor:“pointer”,color:”#333”,fontFamily:ff}}
onMouseEnter={e=>e.currentTarget.style.background=”#f5f5f5”}
onMouseLeave={e=>e.currentTarget.style.background=“transparent”}>{s}</div>
))}
</div>
)}
</div>
);
}

function CustomTooltip({ active, payload, label, currSymbol, entries, chartGroupBy }) {
if(!active||!payload||!payload.length) return null;
return (
<div style={{background:”#fff”,border:“1px solid #aaa”,borderRadius:8,padding:“10px 14px”,fontSize:12,fontFamily:ff,maxWidth:220}}>
<div style={{fontWeight:500,marginBottom:6,color:”#444”}}>{label}</div>
{payload.map((p,i)=>{
const keyEntries=entries.filter(e=>{
const k=chartGroupBy===“item”?e.name:chartGroupBy===“brand”?e.brand:e.store;
return k===p.dataKey&&e.date===label;
});
const brands=[…new Set(keyEntries.map(e=>e.brand).filter(Boolean))].join(”, “);
const stores=[…new Set(keyEntries.map(e=>e.store).filter(Boolean))].join(”, “);
return (
<div key={i} style={{marginBottom:4}}>
<span style={{display:“inline-block”,width:8,height:8,borderRadius:2,background:p.color,marginRight:6}}></span>
<span style={{color:p.color,fontWeight:500}}>{p.dataKey}: {currSymbol}{p.value}</span>
{brands&&<div style={{color:”#888”,marginLeft:14}}>Brand: {brands}</div>}
{stores&&<div style={{color:”#888”,marginLeft:14}}>Store: {stores}</div>}
</div>
);
})}
</div>
);
}

export default function App() {
const [entries,setEntries] = useState(load);
const [tab,setTab] = useState(“history”);
const [form,setForm] = useState(EMPTY);
const [editId,setEditId] = useState(null);
const [viewBy,setViewBy] = useState(“item”);
const [filterValue,setFilterValue] = useState(”**all**”);
const [filterTag,setFilterTag] = useState(”**all**”);
const [chartGroupBy,setChartGroupBy] = useState(“store”);
const [displayCurrency,setDisplayCurrency] = useState(“HKD”);
const [fxRates,setFxRates] = useState(null);
const [fxUpdated,setFxUpdated] = useState(null);
const [fxLoading,setFxLoading] = useState(false);
const [fxError,setFxError] = useState(null);
const [toast,setToast] = useState(null);

useEffect(()=>{ save(entries); },[entries]);
useEffect(()=>{
const cache=loadFxCache();
if(cache){ setFxRates(cache.rates); setFxUpdated(cache.updated); }
else fetchFx();
},[]);

const fetchFx = useCallback(async()=>{
setFxLoading(true); setFxError(null);
try {
const res=await fetch(“https://api.frankfurter.app/latest?from=HKD&to=USD,CAD”);
if(!res.ok) throw new Error();
const data=await res.json();
const rates={ HKD:1,…data.rates };
const updated=new Date().toISOString();
setFxRates(rates); setFxUpdated(updated);
saveFxCache({ rates, updated });
} catch { setFxError(“Could not fetch rates. Using cached or 1:1.”); }
finally { setFxLoading(false); }
},[]);

function convertPrice(price,fromCurrency) {
if(!fxRates||!fromCurrency||fromCurrency===displayCurrency) return price;
const hkd=fromCurrency===“HKD”?price:price/(fxRates[fromCurrency]||1);
return displayCurrency===“HKD”?hkd:hkd*(fxRates[displayCurrency]||1);
}
function toHKD(norm,curr) { if(!fxRates||curr===“HKD”) return norm; return norm/(fxRates[curr]||1); }
function toDisplay(hkd) { if(!fxRates||displayCurrency===“HKD”) return hkd; return hkd*(fxRates[displayCurrency]||1); }

const currSymbol=CURRENCY_SYMBOLS[displayCurrency]||displayCurrency;
const setF=(k,v)=>setForm(f=>({…f,[k]:v}));
const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(null),3000); };

const itemNames  = useMemo(()=>[…new Set(entries.map(e=>e.name))].filter(Boolean).sort(),[entries]);
const brandNames = useMemo(()=>[…new Set(entries.map(e=>e.brand))].filter(Boolean).sort(),[entries]);
const storeNames = useMemo(()=>[…new Set(entries.map(e=>e.store))].filter(Boolean).sort(),[entries]);
const userTags   = useMemo(()=>[…new Set([…PRESET_TAGS,…entries.map(e=>e.tag).filter(Boolean)])].sort(),[entries]);

const tagSuggestions = useMemo(()=>{
const suggested=ITEM_TAG_MAP[form.name.trim()];
if(!suggested) return userTags;
return [suggested,…userTags.filter(t=>t!==suggested)];
},[form.name,userTags]);

const filterOptions = useMemo(()=>{
if(viewBy===“brand”) return brandNames;
if(viewBy===“store”) return storeNames;
if(viewBy===“tag”) return userTags;
return itemNames;
},[viewBy,itemNames,brandNames,storeNames,userTags]);

const norm = useMemo(()=>
normalizePrice(form.price,form.qty,form.unit,form.pricingType===“bundle”?form.bundleQty:1),
[form.price,form.qty,form.unit,form.bundleQty,form.pricingType]);

const discountInfo = useMemo(()=>{
const sp=parseFloat(form.price),op=parseFloat(form.origPrice);
if(!sp||!op||op===0) return null;
return { advertised:((op-sp)/op*100).toFixed(1), isHigher:sp>op };
},[form.price,form.origPrice]);

function handleEdit(e) {
setForm({ name:e.name,brand:e.brand||””,store:e.store||””,tag:e.tag||””,
pricingType:e.pricingType||“single”,price:String(e.price),qty:String(e.qty),unit:e.unit,
bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):””,
note:e.note||””,priceDate:e.priceDate||today(),currency:e.currency||“HKD” });
setEditId(e.id); setTab(“add”);
}
function handleDuplicate(e) {
setForm({ name:e.name,brand:e.brand||””,store:e.store||””,tag:e.tag||””,
pricingType:e.pricingType||“single”,price:String(e.price),qty:String(e.qty),unit:e.unit,
bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):””,
note:e.note||””,priceDate:today(),currency:e.currency||“HKD” });
setEditId(null); setTab(“add”);
}

function handleSave() {
if(!form.name.trim()){ showToast(“Item name is required.”); return; }
if(!form.price){ showToast(“Price is required.”); return; }
if(!form.qty||!form.unit){ showToast(“Package size and unit are required.”); return; }
if(form.pricingType===“bundle”&&(!form.bundleQty||parseFloat(form.bundleQty)<2)){ showToast(“Bundle requires 2 or more packs.”); return; }
const effectiveDate=form.priceDate||today();
const entryData={
name:form.name.trim(),brand:form.brand.trim(),store:form.store.trim(),tag:form.tag.trim(),
pricingType:form.pricingType,price:parseFloat(form.price),qty:parseFloat(form.qty),unit:form.unit,
bundleQty:form.pricingType===“bundle”?parseFloat(form.bundleQty):1,
origPrice:form.origPrice?parseFloat(form.origPrice):null,
note:form.note.trim(),date:effectiveDate,priceDate:form.priceDate||null,createdAt:today(),
currency:form.currency||“HKD”,
normalized:norm?norm.normalized:null,normLabel:norm?norm.label:null,
};
if(editId){ setEntries(prev=>prev.map(e=>e.id===editId?{…entryData,id:editId}:e)); showToast(“Record updated!”); setEditId(null); }
else { setEntries(prev=>[{…entryData,id:Date.now()},…prev]); showToast(“Entry saved!”); }
setForm(EMPTY); setTab(“history”);
}
function handleCancel() { setForm(EMPTY); setEditId(null); setTab(“history”); }

function shrinkAlert(entry) {
const same=entries.filter(e=>e.name===entry.name&&e.brand===entry.brand).sort((a,b)=>a.date.localeCompare(b.date));
const idx=same.findIndex(e=>e.id===entry.id);
if(idx<=0) return null;
const prev=same[idx-1],cur=same[idx];
const pt=UNIT_TYPE[prev.unit],ct=UNIT_TYPE[cur.unit];
if(pt===ct&&pt!==“count”){
const pb=prev.qty*(TO_BASE[prev.unit]||1),cb=cur.qty*(TO_BASE[cur.unit]||1);
if(cb<pb*0.99) return `Volume dropped: ${prev.qty}${prev.unit} → ${cur.qty}${cur.unit}`;
}
return null;
}

function competitionInfo(entry) {
if(!entry.normalized) return null;
const sameItem=entries.filter(e=>e.name===entry.name&&e.normalized);
const brands=[…new Set(sameItem.map(e=>e.brand||””))];
if(brands.length<=1) return null;
const latestPerBrand={};
sameItem.forEach(e=>{ const b=e.brand||””; if(!latestPerBrand[b]||e.date>latestPerBrand[b].date) latestPerBrand[b]=e; });
const converted=Object.values(latestPerBrand).map(e=>({ …e,dispNorm:parseFloat(toDisplay(toHKD(e.normalized,e.currency||“HKD”)).toFixed(1)) }));
const minNorm=Math.min(…converted.map(e=>e.dispNorm));
const myDispNorm=parseFloat(toDisplay(toHKD(entry.normalized,entry.currency||“HKD”)).toFixed(1));
const isLowest=Math.abs(myDispNorm-minNorm)<0.05;
const cheapest=converted.find(e=>Math.abs(e.dispNorm-minNorm)<0.05);
return { isLowest,cheapestBrand:cheapest?.brand||””,minNorm };
}

const filtered = useMemo(()=>{
let list=[…entries];
if(filterValue!==”**all**”){
if(viewBy===“brand”) list=list.filter(e=>e.brand===filterValue);
else if(viewBy===“store”) list=list.filter(e=>e.store===filterValue);
else if(viewBy===“tag”) list=list.filter(e=>e.tag===filterValue);
else list=list.filter(e=>e.name===filterValue);
}
if(filterTag!==”**all**”) list=list.filter(e=>e.tag===filterTag);
return […list].sort((a,b)=>b.date.localeCompare(a.date));
},[entries,filterValue,viewBy,filterTag]);

const getChartKey = useCallback((e)=>{
if(chartGroupBy===“item”) return e.name;
if(chartGroupBy===“brand”) return e.brand||””;
return e.store||””;
},[chartGroupBy]);

const chartSrc = useMemo(()=>{
let src=filterValue===”**all**”?entries:entries.filter(e=>{
if(viewBy===“brand”) return e.brand===filterValue;
if(viewBy===“store”) return e.store===filterValue;
if(viewBy===“tag”) return e.tag===filterValue;
return e.name===filterValue;
});
if(filterTag!==”**all**”) src=src.filter(e=>e.tag===filterTag);
return src;
},[entries,filterValue,viewBy,filterTag]);

const chartKeys = useMemo(()=>[…new Set(chartSrc.filter(e=>e.normalized&&getChartKey(e)).map(getChartKey))].sort(),[chartSrc,getChartKey]);

const chartData = useMemo(()=>{
const byKey={};
chartSrc.forEach(e=>{
if(!e.normalized) return;
const k=getChartKey(e); if(!k) return;
const converted=parseFloat(toDisplay(toHKD(e.normalized,e.currency||“HKD”)).toFixed(1));
if(!byKey[k]) byKey[k]={};
if(!byKey[k][e.date]) byKey[k][e.date]=[];
byKey[k][e.date].push(converted);
});
const dates=[…new Set(chartSrc.map(e=>e.date))].sort();
return dates.map(d=>{
const row={date:d};
Object.keys(byKey).forEach(k=>{ if(byKey[k][d]) row[k]=parseFloat((byKey[k][d].reduce((a,b)=>a+b,0)/byKey[k][d].length).toFixed(1)); });
return row;
});
},[chartSrc,getChartKey,fxRates,displayCurrency]);

const chartMin = useMemo(()=>{
const vals=chartData.flatMap(d=>chartKeys.map(k=>d[k]).filter(v=>v!=null));
if(!vals.length) return “auto”;
return parseFloat((Math.min(…vals)*0.9).toFixed(1));
},[chartData,chartKeys]);

const inp={ padding:“7px 10px”,border:“1px solid #aaa”,borderRadius:8,background:”#fff”,color:”#222”,fontSize:14,width:“100%”,boxSizing:“border-box”,fontFamily:ff };
const lbl=(t,req)=>(<label style={{fontSize:12,color:”#666”,display:“block”,marginBottom:3,fontFamily:ff}}>{t}{req&&<span style={{color:“red”,marginLeft:2}}>*</span>}</label>);
const field=(children,cols)=>(<div style={{display:“grid”,gridTemplateColumns:cols||“1fr”,gap:10,marginBottom:12}}>{children}</div>);
const btnTab=active=>({ flex:1,padding:“7px 0”,fontSize:13,cursor:“pointer”,borderRadius:8,border:active?“1px solid #444441”:“1px solid #aaa”,background:active?”#444441”:“transparent”,color:active?”#fff”:”#666”,fontFamily:ff });
const toggleBtn=active=>({ padding:“5px 14px”,fontSize:12,cursor:“pointer”,borderRadius:6,border:active?“1px solid #444441”:“1px solid #aaa”,background:active?”#444441”:“transparent”,color:active?”#fff”:”#666”,fontFamily:ff });
const AnalysisIcon=()=>(<svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor"><path d="M80 320 L180 200 L260 270 L340 140 L420 200" stroke="currentColor" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="340" cy="360" r="90" stroke="currentColor" strokeWidth="48" fill="none"/><line x1="405" y1="425" x2="460" y2="480" stroke="currentColor" strokeWidth="52" strokeLinecap="round"/></svg>);

function handleExport() {
const blob=new Blob([JSON.stringify(entries,null,2)],{type:“application/json”});
const a=document.createElement(“a”); a.href=URL.createObjectURL(blob); a.download=“truprice_records.json”; a.click();
}
function handleImport(e) {
const file=e.target.files[0]; if(!file) return;
const r=new FileReader();
r.onload=ev=>{ try { const d=JSON.parse(ev.target.result); if(Array.isArray(d)){ setEntries(d); showToast(“Imported “+d.length+” entries.”); } else showToast(“Invalid file.”); } catch { showToast(“Failed to read file.”); } };
r.readAsText(file); e.target.value=””;
}

const fxUpdatedLabel=fxUpdated?new Date(fxUpdated).toLocaleDateString():null;

return (
<div style={{padding:“1rem 0.75rem”,maxWidth:680,margin:“0 auto”,fontFamily:ff}}>
{toast&&<div style={{position:“fixed”,top:16,left:“50%”,transform:“translateX(-50%)”,background:”#fff”,border:“1px solid #ccc”,borderRadius:8,padding:“10px 20px”,fontSize:13,zIndex:999,color:”#222”,whiteSpace:“nowrap”,fontFamily:ff}}>{toast}</div>}

```
  <div style={{textAlign:"center",marginBottom:14}}>
    <span style={{fontSize:13,color:"#444441",fontFamily:ff}}>TruPrice — Your Grocery Shopping Companion</span>
  </div>

  <div style={{display:"flex",gap:8,marginBottom:14}}>
    {[{key:"history",label:"Record"},{key:"add",label:editId?"Edit":"+ New"},{key:"chart",label:"chart"}].map(({key,label})=>(
      <button key={key} onClick={()=>setTab(key)} style={btnTab(tab===key)}>
        {key==="chart"?<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><AnalysisIcon/>Analysis</span>:label}
      </button>
    ))}
  </div>

  {tab!=="add"&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 12px",background:"#f9f9f9",border:"1px solid #eee",borderRadius:8}}>
    <span style={{fontSize:12,color:"#666",fontFamily:ff}}>Display:</span>
    {CURRENCIES.map(c=>(<button key={c} onClick={()=>setDisplayCurrency(c)} style={{...toggleBtn(displayCurrency===c),padding:"4px 10px",fontSize:12}}>{c}</button>))}
    <button onClick={fetchFx} disabled={fxLoading} style={{marginLeft:"auto",fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid #aaa",background:"transparent",color:"#666",cursor:"pointer",fontFamily:ff}}>{fxLoading?"…":"⟳ Rates"}</button>
    {fxUpdatedLabel&&<span style={{fontSize:10,color:"#aaa",fontFamily:ff}}>{fxUpdatedLabel}</span>}
  </div>}
  {fxError&&tab!=="add"&&<div style={{fontSize:12,color:"#c0392b",marginBottom:10,fontFamily:ff}}>{fxError}</div>}

  {/* ADD / EDIT */}
  {tab==="add"&&(
    <div style={{background:"#fff",border:"1px solid #ddd",borderRadius:12,padding:"1.25rem"}}>
      {editId&&<p style={{fontSize:12,color:"#1a73e8",marginBottom:12,marginTop:0,fontFamily:ff}}>Editing existing record</p>}
      <div style={{marginBottom:12}}>
        {lbl("Item name",true)}
        <AutocompleteInput value={form.name} onChange={v=>{
          setF("name",v);
          const suggested=ITEM_TAG_MAP[v.trim()];
          if(suggested&&!form.tag) setForm(f=>({...f,name:v,tag:suggested}));
        }} suggestions={itemNames} placeholder="Type or select a previous item" style={inp}/>
      </div>
      {field(<>
        <div>{lbl("Brand")}<AutocompleteInput value={form.brand} onChange={v=>setF("brand",v)} suggestions={brandNames} placeholder="e.g. Quaker" style={inp}/></div>
        <div>{lbl("Store")}<AutocompleteInput value={form.store} onChange={v=>setF("store",v)} suggestions={storeNames} placeholder="e.g. Walmart" style={inp}/></div>
      </>,"1fr 1fr")}
      <div style={{marginBottom:12}}>
        {lbl("Category tag")}
        <AutocompleteInput value={form.tag} onChange={v=>setF("tag",v)} suggestions={tagSuggestions} placeholder="e.g. Dry Goods 乾貨 (optional, private)" style={inp}/>
      </div>
      <div style={{marginBottom:12}}>
        {lbl("Pricing type",true)}
        <div style={{display:"flex",gap:8}}>
          {["single","bundle"].map(t=>(<button key={t} onClick={()=>setF("pricingType",t)} style={{padding:"7px 16px",fontSize:13,cursor:"pointer",borderRadius:8,border:form.pricingType===t?"1px solid #444441":"1px solid #aaa",background:form.pricingType===t?"#444441":"transparent",color:form.pricingType===t?"#fff":"#666",textTransform:"capitalize",fontFamily:ff}}>{t}</button>))}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        {lbl("Currency")}
        <div style={{display:"flex",gap:8}}>
          {CURRENCIES.map(c=>(<button key={c} onClick={()=>setF("currency",c)} style={{padding:"6px 16px",fontSize:13,cursor:"pointer",borderRadius:8,border:form.currency===c?"1px solid #444441":"1px solid #aaa",background:form.currency===c?"#444441":"transparent",color:form.currency===c?"#fff":"#666",fontFamily:ff}}>{c}</button>))}
        </div>
      </div>
      {form.pricingType==="bundle"?(
        <div style={{background:"#f9f9f9",border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
          {field(<>
            <div>{lbl("Total bundle price",true)}<ClearableInput style={inp} type="number" min="0" step="0.01" value={form.price} onChange={v=>setF("price",v)} placeholder="e.g. 9.99"/></div>
            <div>{lbl("Packs in bundle",true)}<ClearableInput style={inp} type="number" min="2" step="1" value={form.bundleQty} onChange={v=>setF("bundleQty",v)} placeholder="e.g. 2"/></div>
          </>,"1fr 1fr")}
          {form.price&&form.bundleQty&&<p style={{fontSize:12,color:"#666",margin:"4px 0 0",fontFamily:ff}}>Price per pack: {CURRENCY_SYMBOLS[form.currency]||form.currency}{(parseFloat(form.price)/parseFloat(form.bundleQty)).toFixed(2)}</p>}
        </div>
      ):(
        field(<>
          <div>{lbl("Price",true)}<ClearableInput style={inp} type="number" min="0" step="0.01" value={form.price} onChange={v=>setF("price",v)} placeholder="e.g. 4.99"/></div>
          <div>{lbl("Original / listed price")}<ClearableInput style={inp} type="number" min="0" step="0.01" value={form.origPrice} onChange={v=>setF("origPrice",v)} placeholder="e.g. 6.99 (optional)"/></div>
        </>,"1fr 1fr")
      )}
      {field(<>
        <div>{lbl("Package size",true)}<ClearableInput style={inp} type="number" min="0" step="any" value={form.qty} onChange={v=>setF("qty",v)} placeholder="e.g. 500"/></div>
        <div>{lbl("Unit",true)}
          <select style={{...inp,height:"36px"}} value={form.unit} onChange={e=>setF("unit",e.target.value)}>
            {UNIT_GROUPS.map(g=>(<optgroup key={g.label} label={g.label}>{g.units.map(u=><option key={u} value={u}>{u}</option>)}</optgroup>))}
          </select>
        </div>
      </>,"1fr 1fr")}
      {norm&&(
        <div style={{background:"#e8f0fe",border:"1px solid #aac4f5",borderRadius:8,padding:"9px 14px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"#1a73e8",fontFamily:ff}}>Normalized ({form.currency}):</span>
            <span style={{fontSize:16,fontWeight:500,color:"#1a73e8",fontFamily:ff}}>{CURRENCY_SYMBOLS[form.currency]||form.currency}{norm.normalized.toFixed(1)}<span style={{fontSize:12,fontWeight:400}}> {norm.label}</span></span>
          </div>
          {form.currency!==displayCurrency&&fxRates&&(
            <div style={{fontSize:12,color:"#555",marginTop:4,fontFamily:ff}}>≈ {currSymbol}{convertPrice(norm.normalized,form.currency).toFixed(1)} {norm.label} ({displayCurrency})</div>
          )}
        </div>
      )}
      {discountInfo&&(
        <div style={{background:discountInfo.isHigher?"#fdecea":"#e6f4ea",border:"1px solid",borderColor:discountInfo.isHigher?"#f5c6c6":"#a8d5b5",borderRadius:8,padding:"8px 12px",fontSize:13,color:discountInfo.isHigher?"#c0392b":"#1e7e34",marginBottom:12,fontFamily:ff}}>
          {discountInfo.isHigher?"Current price is HIGHER than the original listed price!":`Actual discount: ${discountInfo.advertised}% lower than listed`}
        </div>
      )}
      <div style={{marginBottom:12}}>{lbl("Note")}<ClearableInput style={inp} value={form.note} onChange={v=>setF("note",v)} placeholder="Optional note"/></div>
      {field(<><div>{lbl("Price date")}<input style={inp} type="date" value={form.priceDate} onChange={e=>setF("priceDate",e.target.value)}/></div></>)}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={handleCancel} style={{padding:"9px 20px",background:"transparent",color:"#666",border:"1px solid #aaa",borderRadius:8,fontSize:14,cursor:"pointer",fontFamily:ff}}>Cancel</button>
        <button onClick={handleSave} style={{padding:"9px 20px",background:"#444441",color:"#fff",border:"1px solid #444441",borderRadius:8,fontSize:14,cursor:"pointer",fontWeight:500,fontFamily:ff}}>{editId?"Update":"Save"}</button>
      </div>
    </div>
  )}

  {/* RECORD */}
  {tab==="history"&&(
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>View by:</label>
        <select style={{...inp,width:"auto",minWidth:90,background:"#fff"}} value={viewBy} onChange={e=>{setViewBy(e.target.value);setFilterValue("__all__");}}>
          <option value="item">Item</option>
          <option value="brand">Brand</option>
          <option value="store">Store</option>
          <option value="tag">Tag</option>
        </select>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Filter:</label>
        <select style={{...inp,width:"auto",minWidth:110,flex:1}} value={filterValue} onChange={e=>setFilterValue(e.target.value)}>
          <option value="__all__">All</option>
          {filterOptions.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        {entries.length>0&&<span style={{fontSize:12,color:"#888",whiteSpace:"nowrap",fontFamily:ff}}>{filtered.length}</span>}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Tag:</label>
        <select style={{...inp,width:"auto",minWidth:110,flex:1}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
          <option value="__all__">All tags</option>
          {userTags.filter(t=>entries.some(e=>e.tag===t)).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length===0&&<p style={{color:"#888",fontSize:14,fontFamily:ff}}>No entries yet.</p>}
      {filtered.map(e=>{
        const shrink=shrinkAlert(e);
        const comp=competitionInfo(e);
        const entryCurr=e.currency||"HKD";
        const entrySymbol=CURRENCY_SYMBOLS[entryCurr]||entryCurr;
        const dispNorm=e.normalized?parseFloat(toDisplay(toHKD(e.normalized,entryCurr)).toFixed(1)):null;
        const dispPrice=parseFloat(convertPrice(e.price,entryCurr).toFixed(2));
        return (
          <div key={e.id} style={{background:comp?.isLowest?"#f0faf4":"#fff",border:`1px solid ${comp?.isLowest?"#a8d5b5":"#ddd"}`,borderRadius:12,padding:"12px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
              <span style={{fontWeight:500,fontSize:15,fontFamily:ff}}>{e.name}</span>
              <span style={{fontSize:12,color:"#888",fontFamily:ff,whiteSpace:"nowrap"}}>{e.date}</span>
            </div>
            {(e.store||e.brand)&&(
              <div style={{fontSize:11,color:"#999",fontFamily:ff,marginTop:2,display:"flex",gap:12}}>
                {e.store&&<span>Store: {e.store}</span>}
                {e.brand&&<span>Brand: {e.brand}</span>}
              </div>
            )}
            {e.tag&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"#f0f0f0",color:"#666",fontFamily:ff,display:"inline-block",marginTop:4}}>{e.tag}</span>}
            {e.pricingType==="bundle"&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:6,background:"#fff8e1",color:"#b26a00",fontFamily:ff,display:"inline-block",marginTop:4,marginLeft:4}}>bundle ×{e.bundleQty}</span>}
            <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap",fontSize:13,fontFamily:ff}}>
              <span><span style={{color:"#888"}}>Price: </span>{entryCurr===displayCurrency?`${entrySymbol}${e.price.toFixed(2)}`:`${entrySymbol}${e.price.toFixed(2)} (${currSymbol}${dispPrice})`}</span>
              <span><span style={{color:"#888"}}>Size: </span>{e.qty}{e.unit}</span>
              {dispNorm&&<span style={{color:"#1a73e8",fontWeight:500}}>{currSymbol}{dispNorm} {e.normLabel}</span>}
            </div>
            {e.origPrice&&(
              <div style={{fontSize:12,marginTop:5,color:e.price>e.origPrice?"#c0392b":"#888",fontFamily:ff}}>
                Listed: {entrySymbol}{e.origPrice} → Observed: {entrySymbol}{e.price.toFixed(2)}
                {e.price>e.origPrice&&" — higher than listed price!"}
                {e.price<e.origPrice&&` — ${(((e.origPrice-e.price)/e.origPrice)*100).toFixed(1)}% lower`}
              </div>
            )}
            {shrink&&<div style={{fontSize:12,marginTop:5,color:"#b26a00",fontFamily:ff}}>⚠ Shrinkflation: {shrink}</div>}
            {comp&&!comp.isLowest&&<div style={{fontSize:12,marginTop:5,color:"#888",fontFamily:ff}}>💡 Cheaper: {comp.cheapestBrand} at {currSymbol}{comp.minNorm.toFixed(1)} {e.normLabel}</div>}
            {comp?.isLowest&&<div style={{fontSize:12,marginTop:5,color:"#1e7e34",fontFamily:ff}}>✓ Best price among stores</div>}
            {e.note&&<div style={{fontSize:12,marginTop:4,color:"#888",fontStyle:"italic",fontFamily:ff}}>{e.note}</div>}
            <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>handleEdit(e)} style={{fontSize:12,padding:"5px 14px",border:"1px solid #aaa",borderRadius:6,background:"transparent",color:"#444",cursor:"pointer",fontFamily:ff}}>Edit</button>
                <button onClick={()=>handleDuplicate(e)} style={{fontSize:12,padding:"5px 14px",border:"1px solid #aaa",borderRadius:6,background:"transparent",color:"#444",cursor:"pointer",fontFamily:ff}}>Duplicate</button>
              </div>
              <button onClick={()=>setEntries(prev=>prev.filter(x=>x.id!==e.id))} style={{fontSize:12,padding:"5px 14px",border:"1px solid #ddd",borderRadius:6,background:"transparent",color:"#aaa",cursor:"pointer",fontFamily:ff}}>Delete</button>
            </div>
          </div>
        );
      })}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
        <button onClick={handleExport} style={{padding:"8px 18px",fontSize:13,cursor:"pointer",borderRadius:8,border:"1px solid #aaa",background:"transparent",color:"#666",fontFamily:ff}}>Export</button>
        <label style={{padding:"8px 18px",fontSize:13,cursor:"pointer",borderRadius:8,border:"1px solid #aaa",background:"transparent",color:"#666",fontFamily:ff}}>Import<input type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/></label>
      </div>
    </div>
  )}

  {/* ANALYSIS */}
  {tab==="chart"&&(
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>View by:</label>
        <select style={{...inp,width:"auto",minWidth:90}} value={viewBy} onChange={e=>{setViewBy(e.target.value);setFilterValue("__all__");}}>
          <option value="item">Item</option>
          <option value="brand">Brand</option>
          <option value="store">Store</option>
          <option value="tag">Tag</option>
        </select>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Filter:</label>
        <select style={{...inp,width:"auto",minWidth:110,flex:1}} value={filterValue} onChange={e=>setFilterValue(e.target.value)}>
          <option value="__all__">All</option>
          {filterOptions.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Tag:</label>
        <select style={{...inp,width:"auto",minWidth:110,flex:1}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
          <option value="__all__">All tags</option>
          {userTags.filter(t=>entries.some(e=>e.tag===t)).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <span style={{fontSize:12,color:"#666",fontFamily:ff}}>Group by:</span>
        {["item","brand","store"].map(g=>(<button key={g} onClick={()=>setChartGroupBy(g)} style={{...toggleBtn(chartGroupBy===g),textTransform:"capitalize"}}>{g}</button>))}
      </div>
      {chartData.length===0
        ? <p style={{color:"#888",fontSize:14,fontFamily:ff}}>No data to display.</p>
        : <div style={{background:"#fff",border:"1px solid #ddd",borderRadius:12,padding:"1rem"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:12}}>
              {chartKeys.map((k,i)=>(<span key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#666",fontFamily:ff}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:"inline-block"}}></span>{k}</span>))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)"/>
                <XAxis dataKey="date" tick={{fontSize:11,fontFamily:ff}}/>
                <YAxis tick={{fontSize:11,fontFamily:ff}} tickFormatter={v=>`${currSymbol}${v.toFixed(1)}`} width={62} domain={[chartMin,"auto"]}/>
                <Tooltip content={<CustomTooltip currSymbol={currSymbol} entries={chartSrc} chartGroupBy={chartGroupBy}/>}/>
                {chartKeys.map((k,i)=>(<Line key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:4}} activeDot={{r:6}} connectNulls={false}/>))}
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:11,color:"#888",marginTop:8,textAlign:"center",fontFamily:ff}}>Normalized price in {displayCurrency} over time</p>
          </div>
      }
    </div>
  )}
</div>
```

);
}
