import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const UNIT_GROUPS = [
  { label:"Weight", units:["kg","g","lb","oz","斤(HK)","兩(HK)","斤(CN)","兩(CN)"] },
  { label:"Volume", units:["L","ml","fl oz"] },
  { label:"Count",  units:["count"] },
];
const TO_BASE = { g:1,kg:1000,lb:453.592,oz:28.3495,"斤(HK)":604.79,"兩(HK)":37.799,"斤(CN)":500,"兩(CN)":50,ml:1,L:1000,"fl oz":29.5735,count:1 };
const UNIT_TYPE = { g:"weight",kg:"weight",lb:"weight",oz:"weight","斤(HK)":"weight","兩(HK)":"weight","斤(CN)":"weight","兩(CN)":"weight",ml:"volume",L:"volume","fl oz":"volume",count:"count" };
const BASE_LABEL = { weight:"per 100g", volume:"per 100ml", count:"per unit" };
const COLORS = ["#378ADD","#1D9E75","#D85A30","#7F77DD","#BA7517","#D4537E","#639922","#888780"];
const STORAGE_KEY = "price_tracker_v2";
const today = () => new Date().toISOString().slice(0,10);
const EMPTY = { name:"",brand:"",store:"",pricingType:"single",price:"",qty:"",unit:"g",bundleQty:"2",origPrice:"",note:"",priceDate:today() };

function normalizePrice(price,qty,unit,bundleQty=1) {
  const p=parseFloat(price),q=parseFloat(qty),b=parseFloat(bundleQty)||1;
  if(!p||!q||isNaN(p)||isNaN(q)||q===0) return null;
  const totalBase=q*(TO_BASE[unit]||1);
  const type=UNIT_TYPE[unit];
  const divisor=type==="count"?1:100;
  const normalized=parseFloat(((p/b/totalBase)*divisor).toFixed(1));
  return { normalized, label:BASE_LABEL[type], type };
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} };

function AutocompleteInput({ value, onChange, suggestions, placeholder, style }) {
  const [open,setOpen] = useState(false);
  const ref = useRef();
  const filtered = useMemo(()=>{
    const q=value.trim().toLowerCase();
    return q ? suggestions.filter(s=>s.toLowerCase().includes(q)) : suggestions;
  },[value,suggestions]);
  useEffect(()=>{
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div style={{position:"relative"}} ref={ref}>
      <input style={style} value={value}
        onChange={e=>{onChange(e.target.value);setOpen(true);}}
        onFocus={()=>setOpen(true)}
        placeholder={placeholder}/>
      {open&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1px solid #ccc",borderRadius:8,maxHeight:160,overflowY:"auto",marginTop:2}}>
          {filtered.map(s=>(
            <div key={s} onMouseDown={()=>{onChange(s);setOpen(false);}}
              style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:"#333",fontFamily:"system-ui,-apple-system,sans-serif"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f5f5"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [entries,setEntries] = useState(load);
  const [tab,setTab] = useState("history");
  const [form,setForm] = useState(EMPTY);
  const [editId,setEditId] = useState(null);
  const [filterItem,setFilterItem] = useState("__all__");
  const [viewBy,setViewBy] = useState("item");
  const [chartGroupBy,setChartGroupBy] = useState("item");
  const [toast,setToast] = useState(null);

  useEffect(()=>{ save(entries); },[entries]);

  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(null),3000); };

  const itemNames  = useMemo(()=>[...new Set(entries.map(e=>e.name))].filter(Boolean).sort(),[entries]);
  const brandNames = useMemo(()=>[...new Set(entries.map(e=>e.brand))].filter(Boolean).sort(),[entries]);
  const storeNames = useMemo(()=>[...new Set(entries.map(e=>e.store))].filter(Boolean).sort(),[entries]);

  const norm = useMemo(()=>
    normalizePrice(form.price,form.qty,form.unit,form.pricingType==="bundle"?form.bundleQty:1),
    [form.price,form.qty,form.unit,form.bundleQty,form.pricingType]);

  const discountInfo = useMemo(()=>{
    const sp=parseFloat(form.price),op=parseFloat(form.origPrice);
    if(!sp||!op||op===0) return null;
    return { advertised:((op-sp)/op*100).toFixed(1), isHigher:sp>op };
  },[form.price,form.origPrice]);

  function handleEdit(e) {
    setForm({ name:e.name,brand:e.brand||"",store:e.store||"",pricingType:e.pricingType||"single",
      price:String(e.price),qty:String(e.qty),unit:e.unit,bundleQty:String(e.bundleQty||2),
      origPrice:e.origPrice?String(e.origPrice):"",note:e.note||"",priceDate:e.priceDate||today() });
    setEditId(e.id); setTab("add");
  }

  function handleDuplicate(e) {
    setForm({ name:e.name,brand:e.brand||"",store:e.store||"",pricingType:e.pricingType||"single",
      price:String(e.price),qty:String(e.qty),unit:e.unit,bundleQty:String(e.bundleQty||2),
      origPrice:e.origPrice?String(e.origPrice):"",note:e.note||"",priceDate:today() });
    setEditId(null); setTab("add");
  }

  function handleSave() {
    if(!form.name.trim()){ showToast("Item name is required."); return; }
    if(!form.price){ showToast("Sale price is required."); return; }
    if(!form.qty||!form.unit){ showToast("Quantity and unit are required."); return; }
    if(form.pricingType==="bundle"&&(!form.bundleQty||parseFloat(form.bundleQty)<2)){ showToast("Bundle requires 2 or more items."); return; }
    const effectiveDate=form.priceDate||today();
    const entryData = {
      name:form.name.trim(),brand:form.brand.trim(),store:form.store.trim(),
      pricingType:form.pricingType,price:parseFloat(form.price),qty:parseFloat(form.qty),unit:form.unit,
      bundleQty:form.pricingType==="bundle"?parseFloat(form.bundleQty):1,
      origPrice:form.origPrice?parseFloat(form.origPrice):null,
      note:form.note.trim(),date:effectiveDate,priceDate:form.priceDate||null,createdAt:today(),
      normalized:norm?norm.normalized:null,normLabel:norm?norm.label:null,
    };
    if(editId){ setEntries(prev=>prev.map(e=>e.id===editId?{...entryData,id:editId}:e)); showToast("Record updated!"); setEditId(null); }
    else { setEntries(prev=>[{...entryData,id:Date.now()},...prev]); showToast("Entry saved!"); }
    setForm(EMPTY); setTab("history");
  }

  function handleCancel() { setForm(EMPTY); setEditId(null); setTab("history"); }

  // Shrinkflation: same item AND same brand only
  function shrinkAlert(entry) {
    const sameBrand = entries.filter(e=>e.name===entry.name && e.brand===entry.brand)
      .sort((a,b)=>a.date.localeCompare(b.date));
    const idx = sameBrand.findIndex(e=>e.id===entry.id);
    if(idx<=0) return null;
    const prev=sameBrand[idx-1], cur=sameBrand[idx];
    const pt=UNIT_TYPE[prev.unit],ct=UNIT_TYPE[cur.unit];
    if(pt===ct&&pt!=="count"){
      const pb=prev.qty*(TO_BASE[prev.unit]||1),cb=cur.qty*(TO_BASE[cur.unit]||1);
      if(cb<pb*0.99) return `Volume dropped: ${prev.qty}${prev.unit} → ${cur.qty}${cur.unit}`;
    }
    return null;
  }

  // Competition: same item, different brands — find lowest normalized price
  function competitionInfo(entry) {
    if(!entry.normalized) return null;
    const sameItem = entries.filter(e=>e.name===entry.name && e.normalized);
    const brands = [...new Set(sameItem.map(e=>e.brand||""))];
    if(brands.length<=1) return null;
    // latest entry per brand
    const latestPerBrand = {};
    sameItem.forEach(e=>{
      const b=e.brand||"";
      if(!latestPerBrand[b]||e.date>latestPerBrand[b].date) latestPerBrand[b]=e;
    });
    const prices = Object.values(latestPerBrand);
    const minNorm = Math.min(...prices.map(e=>e.normalized));
    const isLowest = Math.abs(entry.normalized-minNorm)<0.00001;
    const cheapest = prices.find(e=>Math.abs(e.normalized-minNorm)<0.00001);
    return { isLowest, cheapestBrand:cheapest?.brand||"", minNorm };
  }

  const filtered = useMemo(()=>{
    let list = filterItem==="__all__" ? entries : entries.filter(e=>e.name===filterItem);
    if(viewBy==="brand") list=list.filter(e=>e.brand);
    if(viewBy==="store") list=list.filter(e=>e.store);
    return [...list].sort((a,b)=>b.date.localeCompare(a.date));
  },[entries,filterItem,viewBy]);

  // Group label for display
  function groupLabel(e) {
    if(viewBy==="brand") return e.brand||"";
    if(viewBy==="store") return e.store||"";
    return e.name;
  }

  // Chart data
  const chartKeys = useMemo(()=>{
    const src = filterItem==="__all__" ? entries : entries.filter(e=>e.name===filterItem);
    if(chartGroupBy==="item") return [...new Set(src.filter(e=>e.normalized).map(e=>e.name))].sort();
    return [...new Set(src.filter(e=>e.normalized&&e.brand).map(e=>e.brand))].sort();
  },[entries,filterItem,chartGroupBy]);

  const chartData = useMemo(()=>{
    const src = filterItem==="__all__" ? entries : entries.filter(e=>e.name===filterItem);
    const byKey={};
    src.forEach(e=>{
      if(!e.normalized) return;
      const k=chartGroupBy==="item"?e.name:(e.brand||"");
      if(!k) return;
      if(!byKey[k]) byKey[k]={};
      if(!byKey[k][e.date]) byKey[k][e.date]=[];
      byKey[k][e.date].push(e.normalized);
    });
    const dates=[...new Set(src.map(e=>e.date))].sort();
    return dates.map(d=>{
      const row={date:d};
      Object.keys(byKey).forEach(k=>{
        if(byKey[k][d]) row[k]=parseFloat((byKey[k][d].reduce((a,b)=>a+b,0)/byKey[k][d].length).toFixed(4));
      });
      return row;
    });
  },[entries,filterItem,chartGroupBy]);

  const ff="system-ui,-apple-system,sans-serif";
  const inp={ padding:"7px 10px",border:"1px solid #aaa",borderRadius:8,background:"#fff",color:"#222",fontSize:14,width:"100%",boxSizing:"border-box",fontFamily:ff };
  const lbl=(t,req)=>(
    <label style={{fontSize:12,color:"#666",display:"block",marginBottom:3,fontFamily:ff}}>
      {t}{req&&<span style={{color:"red",marginLeft:2}}>*</span>}
    </label>
  );
  const field=(children,cols)=>(
    <div style={{display:"grid",gridTemplateColumns:cols||"1fr",gap:10,marginBottom:12}}>{children}</div>
  );
  const btnTab=active=>({
    flex:1,padding:"7px 0",fontSize:13,cursor:"pointer",borderRadius:8,
    border:active?"1px solid #444441":"1px solid #aaa",
    background:active?"#444441":"transparent",
    color:active?"#fff":"#666",fontFamily:ff
  });
  const toggleBtn=active=>({
    padding:"5px 14px",fontSize:12,cursor:"pointer",borderRadius:6,
    border:active?"1px solid #444441":"1px solid #aaa",
    background:active?"#444441":"transparent",
    color:active?"#fff":"#666",fontFamily:ff
  });

  const AnalysisIcon=()=>(
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M80 320 L180 200 L260 270 L340 140 L420 200" stroke="currentColor" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="340" cy="360" r="90" stroke="currentColor" strokeWidth="48" fill="none"/>
      <line x1="405" y1="425" x2="460" y2="480" stroke="currentColor" strokeWidth="52" strokeLinecap="round"/>
    </svg>
  );

  function handleExport() {
    const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="truprice_records.json"; a.click();
  }
  function handleImport(e) {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ try { const d=JSON.parse(ev.target.result); if(Array.isArray(d)){ setEntries(d); showToast("Imported "+d.length+" entries."); } else showToast("Invalid file."); } catch { showToast("Failed to read file."); } };
    r.readAsText(file); e.target.value="";
  }

  return (
    <div style={{padding:"1rem 0.75rem",maxWidth:680,margin:"0 auto",fontFamily:ff}}>
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"#fff",border:"1px solid #ccc",borderRadius:8,padding:"10px 20px",fontSize:13,zIndex:999,color:"#222",whiteSpace:"nowrap",fontFamily:ff}}>{toast}</div>}

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[{key:"history",label:"Record"},{key:"add",label:editId?"Edit":"+ New"},{key:"chart",label:"chart"}].map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key)} style={btnTab(tab===key)}>
            {key==="chart"?<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><AnalysisIcon/>Analysis</span>:label}
          </button>
        ))}
      </div>

      {/* ADD / EDIT */}
      {tab==="add"&&(
        <div style={{background:"#fff",border:"1px solid #ddd",borderRadius:12,padding:"1.25rem"}}>
          {editId&&<p style={{fontSize:12,color:"#1a73e8",marginBottom:12,marginTop:0,fontFamily:ff}}>Editing existing record</p>}
          <div style={{marginBottom:12}}>
            {lbl("Item name",true)}
            <AutocompleteInput value={form.name} onChange={v=>setF("name",v)} suggestions={itemNames} placeholder="Type or select a previous item" style={inp}/>
          </div>
          {field(<>
            <div>{lbl("Brand")}<AutocompleteInput value={form.brand} onChange={v=>setF("brand",v)} suggestions={brandNames} placeholder="e.g. Quaker" style={inp}/></div>
            <div>{lbl("Store")}<AutocompleteInput value={form.store} onChange={v=>setF("store",v)} suggestions={storeNames} placeholder="e.g. Walmart" style={inp}/></div>
          </>,"1fr 1fr")}
          <div style={{marginBottom:12}}>
            {lbl("Pricing type",true)}
            <div style={{display:"flex",gap:8}}>
              {["single","bundle"].map(t=>(
                <button key={t} onClick={()=>setF("pricingType",t)} style={{padding:"7px 16px",fontSize:13,cursor:"pointer",borderRadius:8,border:form.pricingType===t?"1px solid #444441":"1px solid #aaa",background:form.pricingType===t?"#444441":"transparent",color:form.pricingType===t?"#fff":"#666",textTransform:"capitalize",fontFamily:ff}}>{t}</button>
              ))}
            </div>
          </div>
          {form.pricingType==="bundle"?(
            <div style={{background:"#f9f9f9",border:"1px solid #ddd",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
              {field(<>
                <div>{lbl("Total bundle price ($)",true)}<input style={inp} type="number" min="0" step="0.01" value={form.price} onChange={e=>setF("price",e.target.value)} placeholder="e.g. 9.99"/></div>
                <div>{lbl("Items in bundle",true)}<input style={inp} type="number" min="2" step="1" value={form.bundleQty} onChange={e=>setF("bundleQty",e.target.value)} placeholder="e.g. 2"/></div>
              </>,"1fr 1fr")}
              {form.price&&form.bundleQty&&<p style={{fontSize:12,color:"#666",margin:"4px 0 0",fontFamily:ff}}>Price per item: ${(parseFloat(form.price)/parseFloat(form.bundleQty)).toFixed(2)}</p>}
            </div>
          ):(
            field(<>
              <div>{lbl("Sale price ($)",true)}<input style={inp} type="number" min="0" step="0.01" value={form.price} onChange={e=>setF("price",e.target.value)} placeholder="e.g. 4.99"/></div>
              <div>{lbl("Original price ($)")}<input style={inp} type="number" min="0" step="0.01" value={form.origPrice} onChange={e=>setF("origPrice",e.target.value)} placeholder="e.g. 6.99 (optional)"/></div>
            </>,"1fr 1fr")
          )}
          {field(<>
            <div>{lbl("Quantity",true)}<input style={inp} type="number" min="0" step="any" value={form.qty} onChange={e=>setF("qty",e.target.value)} placeholder="e.g. 500"/></div>
            <div>{lbl("Unit",true)}
              <select style={{...inp,background:"#fff",border:"1px solid #aaa",height:"36px"}} value={form.unit} onChange={e=>setF("unit",e.target.value)}>
                {UNIT_GROUPS.map(g=>(
                  <optgroup key={g.label} label={g.label}>
                    {g.units.map(u=><option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </>,"1fr 1fr")}
          {norm&&(
            <div style={{background:"#e8f0fe",border:"1px solid #aac4f5",borderRadius:8,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:"#1a73e8",fontFamily:ff}}>Normalized:</span>
              <span style={{fontSize:16,fontWeight:500,color:"#1a73e8",fontFamily:ff}}>${norm.normalized.toFixed(4)}<span style={{fontSize:12,fontWeight:400}}> {norm.label}</span></span>
            </div>
          )}
          {discountInfo&&(
            <div style={{background:discountInfo.isHigher?"#fdecea":"#e6f4ea",border:"1px solid",borderColor:discountInfo.isHigher?"#f5c6c6":"#a8d5b5",borderRadius:8,padding:"8px 12px",fontSize:13,color:discountInfo.isHigher?"#c0392b":"#1e7e34",marginBottom:12,fontFamily:ff}}>
              {discountInfo.isHigher?`Current price ($${form.price}) is HIGHER than the original ($${form.origPrice})!`:`Actual discount: ${discountInfo.advertised}% off (original $${form.origPrice})`}
            </div>
          )}
          <div style={{marginBottom:12}}>{lbl("Note")}<input style={inp} value={form.note} onChange={e=>setF("note",e.target.value)} placeholder="Optional note"/></div>
          {field(<><div>{lbl("Price date")}<input style={inp} type="date" value={form.priceDate} onChange={e=>setF("priceDate",e.target.value)}/></div></>)}
          <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
            <button onClick={handleCancel} style={{padding:"9px 20px",background:"transparent",color:"#666",border:"1px solid #aaa",borderRadius:8,fontSize:14,cursor:"pointer",fontFamily:ff}}>Cancel</button>
            <button onClick={handleSave} style={{padding:"9px 20px",background:"#444441",color:"#fff",border:"1px solid #444441",borderRadius:8,fontSize:14,cursor:"pointer",fontWeight:500,fontFamily:ff}}>{editId?"Update":"Save"}</button>
          </div>
        </div>
      )}

      {/* RECORD */}
      {tab==="history"&&(
        <div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Filter:</label>
            <select style={{...inp,width:"auto",minWidth:140,background:"#fff",border:"1px solid #aaa"}} value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
              <option value="__all__">All items</option>
              {itemNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            {entries.length>0&&<span style={{fontSize:12,color:"#888",marginLeft:"auto",fontFamily:ff}}>{filtered.length} entries</span>}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
            <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>View by:</label>
            <select style={{...inp,width:"auto",minWidth:140,background:"#fff",border:"1px solid #aaa"}} value={viewBy} onChange={e=>setViewBy(e.target.value)}>
              <option value="item">Item</option>
              <option value="brand">Brand</option>
              <option value="store">Store</option>
            </select>
          </div>
          {filtered.length===0&&<p style={{color:"#888",fontSize:14,fontFamily:ff}}>No entries yet.</p>}
          {filtered.map(e=>{
            const shrink=shrinkAlert(e);
            const comp=competitionInfo(e);
            return (
              <div key={e.id} style={{background: comp?.isLowest?"#f0faf4":"#fff",border:`1px solid ${comp?.isLowest?"#a8d5b5":"#ddd"}`,borderRadius:12,padding:"12px 16px",marginBottom:10}}>
                {e.brand&&<div style={{fontSize:11,color:"#999",fontFamily:ff,marginBottom:2}}>Brand: {e.brand}</div>}
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
                {e.pricingType==="bundle"&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:6,background:"#fff8e1",color:"#b26a00",fontFamily:ff,display:"inline-block",marginTop:4}}>bundle ×{e.bundleQty}</span>}
                <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap",fontSize:13,fontFamily:ff}}>
                  <span><span style={{color:"#888"}}>Paid: </span>${e.price.toFixed(2)}</span>
                  <span><span style={{color:"#888"}}>Qty: </span>{e.qty}{e.unit}</span>
                  {e.normalized&&<span style={{color:"#1a73e8",fontWeight:500}}>${e.normalized.toFixed(1)} {e.normLabel}</span>}
                </div>
                {e.origPrice&&(
                  <div style={{fontSize:12,marginTop:5,color:e.price>e.origPrice?"#c0392b":"#888",fontFamily:ff}}>
                    Original: ${e.origPrice} → Paid: ${e.price.toFixed(2)}
                    {e.price>e.origPrice&&" — paid MORE than original!"}
                    {e.price<e.origPrice&&` — saved ${(((e.origPrice-e.price)/e.origPrice)*100).toFixed(1)}%`}
                  </div>
                )}
                {shrink&&<div style={{fontSize:12,marginTop:5,color:"#b26a00",fontFamily:ff}}>⚠ Shrinkflation: {shrink}</div>}
                {comp&&!comp.isLowest&&<div style={{fontSize:12,marginTop:5,color:"#888",fontFamily:ff}}>💡 Cheaper: {comp.cheapestBrand} at ${comp.minNorm.toFixed(1)} {e.normLabel}</div>}
                {comp?.isLowest&&<div style={{fontSize:12,marginTop:5,color:"#1e7e34",fontFamily:ff}}>✓ Best price among brands</div>}
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
            <label style={{padding:"8px 18px",fontSize:13,cursor:"pointer",borderRadius:8,border:"1px solid #aaa",background:"transparent",color:"#666",fontFamily:ff}}>
              Import<input type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
            </label>
          </div>
        </div>
      )}

      {/* ANALYSIS */}
      {tab==="chart"&&(
        <div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <label style={{fontSize:12,color:"#666",whiteSpace:"nowrap",fontFamily:ff}}>Filter:</label>
            <select style={{...inp,width:"auto",minWidth:160,background:"#fff",border:"1px solid #aaa"}} value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
              <option value="__all__">All items</option>
              {itemNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
            <span style={{fontSize:12,color:"#666",fontFamily:ff}}>Group by:</span>
            <button onClick={()=>setChartGroupBy("item")} style={toggleBtn(chartGroupBy==="item")}>Item</button>
            <button onClick={()=>setChartGroupBy("brand")} style={toggleBtn(chartGroupBy==="brand")}>Brand</button>
          </div>
          {chartData.length===0
            ? <p style={{color:"#888",fontSize:14,fontFamily:ff}}>No data to display.</p>
            : <div style={{background:"#fff",border:"1px solid #ddd",borderRadius:12,padding:"1rem"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:12}}>
                  {chartKeys.map((k,i)=>(
                    <span key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#666",fontFamily:ff}}>
                      <span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:"inline-block"}}></span>{k}
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)"/>
                    <XAxis dataKey="date" tick={{fontSize:11,fontFamily:ff}}/>
                    <YAxis tick={{fontSize:11,fontFamily:ff}} tickFormatter={v=>`$${v.toFixed(3)}`} width={62}/>
                    <Tooltip formatter={(v,name)=>[`$${parseFloat(v).toFixed(4)}`,name]} contentStyle={{fontSize:12,borderRadius:8,border:"1px solid #aaa",fontFamily:ff}}/>
                    {chartKeys.map((k,i)=>(
                      <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:4}} activeDot={{r:6}} connectNulls={false}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p style={{fontSize:11,color:"#888",marginTop:8,textAlign:"center",fontFamily:ff}}>Normalized price over time</p>
              </div>
          }
        </div>
      )}
    </div>
  );
}
