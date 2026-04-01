import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const UNIT_GROUPS = [
  { label:"Weight", units:["g","kg","oz","lb"] },
  { label:"Volume", units:["ml","L","fl oz"] },
  { label:"Count",  units:["count"] },
];
const TO_BASE = { g:1,kg:1000,oz:28.3495,lb:453.592,ml:1,L:1000,"fl oz":29.5735,count:1 };
const UNIT_TYPE = { g:"weight",kg:"weight",oz:"weight",lb:"weight",ml:"volume",L:"volume","fl oz":"volume",count:"count" };
const BASE_LABEL = { weight:"per 100g", volume:"per 100ml", count:"per unit" };
const COLORS = ["#378ADD","#1D9E75","#D85A30","#7F77DD","#BA7517","#D4537E","#639922","#888780"];
const STORAGE_KEY = "price_tracker_v2";
const today = () => new Date().toISOString().slice(0,10);
const EMPTY = { name:"",brand:"",store:"",pricingType:"single",price:"",qty:"",unit:"g",bundleQty:"2",origPrice:"",note:"" };

function normalizePrice(price,qty,unit,bundleQty=1) {
  const p=parseFloat(price),q=parseFloat(qty),b=parseFloat(bundleQty)||1;
  if(!p||!q||isNaN(p)||isNaN(q)||q===0) return null;
  const totalBase=q*(TO_BASE[unit]||1);
  const type=UNIT_TYPE[unit];
  const divisor=type==="count"?1:100;
  return { normalized:(p/b/totalBase)*divisor, label:BASE_LABEL[type], type };
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} };

export default function App() {
  const [entries,setEntries] = useState(load);
  const [tab,setTab] = useState("history");
  const [form,setForm] = useState(EMPTY);
  const [filterItem,setFilterItem] = useState("__all__");
  const [toast,setToast] = useState(null);
  const [nameOpen,setNameOpen] = useState(false);
  const nameRef = useRef();

  useEffect(()=>{ save(entries); },[entries]);
  useEffect(()=>{
    const h = e => { if(nameRef.current&&!nameRef.current.contains(e.target)) setNameOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const itemNames = useMemo(()=>[...new Set(entries.map(e=>e.name))].sort(),[entries]);
  const filteredNames = useMemo(()=>{
    const q=form.name.trim().toLowerCase();
    return q ? itemNames.filter(n=>n.toLowerCase().includes(q)) : itemNames;
  },[form.name,itemNames]);

  const norm = useMemo(()=>
    normalizePrice(form.price,form.qty,form.unit,form.pricingType==="bundle"?form.bundleQty:1),
    [form.price,form.qty,form.unit,form.bundleQty,form.pricingType]);

  const discountInfo = useMemo(()=>{
    const sp=parseFloat(form.price),op=parseFloat(form.origPrice);
    if(!sp||!op||op===0) return null;
    return { advertised:((op-sp)/op*100).toFixed(1), isHigher:sp>op };
  },[form.price,form.origPrice]);

  function handleAdd() {
    if(!form.name.trim()){ showToast("Item name is required."); return; }
    if(!form.price){ showToast("Sale price is required."); return; }
    if(!form.qty||!form.unit){ showToast("Quantity and unit are required."); return; }
    if(form.pricingType==="bundle"&&(!form.bundleQty||parseFloat(form.bundleQty)<2)){ showToast("Bundle requires 2 or more items."); return; }
    const entry = {
      id:Date.now(), name:form.name.trim(), brand:form.brand.trim(), store:form.store.trim(),
      pricingType:form.pricingType, price:parseFloat(form.price), qty:parseFloat(form.qty), unit:form.unit,
      bundleQty:form.pricingType==="bundle"?parseFloat(form.bundleQty):1,
      origPrice:form.origPrice?parseFloat(form.origPrice):null,
      note:form.note.trim(), date:today(),
      normalized:norm?norm.normalized:null, normLabel:norm?norm.label:null,
    };
    setEntries(prev=>[entry,...prev]);
    setForm(f=>({...EMPTY,name:f.name,brand:f.brand,store:f.store,unit:f.unit}));
    showToast("Entry saved!");
    setTab("history");
  }

  function shrinkAlert(name) {
    const sorted=entries.filter(e=>e.name===name).sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<sorted.length;i++){
      const p=sorted[i-1],c=sorted[i];
      const pt=UNIT_TYPE[p.unit],ct=UNIT_TYPE[c.unit];
      if(pt===ct&&pt!=="count"){
        const pb=p.qty*(TO_BASE[p.unit]||1),cb=c.qty*(TO_BASE[c.unit]||1);
        if(cb<pb*0.99) return `Volume dropped: ${p.qty}${p.unit} → ${c.qty}${c.unit}`;
      }
    }
    return null;
  }

  const filtered = useMemo(()=>{
    const list=filterItem==="__all__"?entries:entries.filter(e=>e.name===filterItem);
    return [...list].sort((a,b)=>a.date.localeCompare(b.date));
  },[entries,filterItem]);

  const chartItems = useMemo(()=>[...new Set(filtered.filter(e=>e.normalized).map(e=>e.name))],[filtered]);
  const chartData = useMemo(()=>{
    const byItem={};
    filtered.forEach(e=>{
      if(!e.normalized) return;
      if(!byItem[e.name]) byItem[e.name]={};
      if(!byItem[e.name][e.date]) byItem[e.name][e.date]=[];
      byItem[e.name][e.date].push(e.normalized);
    });
    const dates=[...new Set(filtered.map(e=>e.date))].sort();
    return dates.map(d=>{
      const row={date:d};
      Object.keys(byItem).forEach(name=>{
        if(byItem[name][d]) row[name]=parseFloat((byItem[name][d].reduce((a,b)=>a+b,0)/byItem[name][d].length).toFixed(4));
      });
      return row;
    });
  },[filtered]);

  const inp = { padding:"7px 10px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:14,width:"100%",boxSizing:"border-box" };
  const lbl = (t,req) => (
    <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>
      {t}{req && <span style={{color:"var(--color-text-danger)",marginLeft:2}}>*</span>}
    </label>
  );
  const field = (children,cols) => (
    <div style={{display:"grid",gridTemplateColumns:cols||"1fr",gap:10,marginBottom:12}}>{children}</div>
  );
  const btnTab = active => ({
    flex:1, padding:"7px 0", fontSize:13, cursor:"pointer",
    borderRadius:"var(--border-radius-md)",
    border: active ? "1px solid #444441" : "1px solid #aaa",
    background: active ? "#444441" : "transparent",
    color: active ? "#ffffff" : "var(--color-text-secondary)",
  });

  const AnalysisIcon = () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M80 320 L180 200 L260 270 L340 140 L420 200" stroke="currentColor" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="340" cy="360" r="90" stroke="currentColor" strokeWidth="48" fill="none"/>
      <line x1="405" y1="425" x2="460" y2="480" stroke="currentColor" strokeWidth="52" strokeLinecap="round"/>
    </svg>
  );

  function handleExport() {
    const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="price_records.json";
    a.click();
  }

  function handleImport(e) {
    const file=e.target.files[0];
    if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{
      try {
        const data=JSON.parse(ev.target.result);
        if(Array.isArray(data)){ setEntries(data); showToast("Imported "+data.length+" entries."); }
        else showToast("Invalid file format.");
      } catch { showToast("Failed to read file."); }
    };
    r.readAsText(file);
    e.target.value="";
  }

  return (
    <div style={{padding:"1rem 0",maxWidth:680,margin:"0 auto"}}>
      {toast && (
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 20px",fontSize:13,zIndex:999,color:"var(--color-text-primary)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
        {[{key:"history",label:"Record"},{key:"add",label:"+ New"},{key:"chart",label:"chart"}].map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key)} style={btnTab(tab===key)}>
            {key==="chart"
              ? <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><AnalysisIcon/>Analysis</span>
              : label}
          </button>
        ))}
      </div>

      {/* ADD ENTRY */}
      {tab==="add" && (
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem"}}>
          <div style={{marginBottom:12,position:"relative"}} ref={nameRef}>
            {lbl("Item name",true)}
            <input style={inp} value={form.name}
              onChange={e=>{setF("name",e.target.value);setNameOpen(true);}}
              onFocus={()=>setNameOpen(true)}
              placeholder="Type or select a previous item"/>
            {nameOpen && filteredNames.length>0 && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",maxHeight:160,overflowY:"auto",marginTop:2}}>
                {filteredNames.map(n=>(
                  <div key={n} onMouseDown={()=>{setF("name",n);setNameOpen(false);}}
                    style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:"var(--color-text-primary)"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>

          {field(<>
            <div>{lbl("Brand")}<input style={inp} value={form.brand} onChange={e=>setF("brand",e.target.value)} placeholder="e.g. Quaker"/></div>
            <div>{lbl("Store")}<input style={inp} value={form.store} onChange={e=>setF("store",e.target.value)} placeholder="e.g. Walmart"/></div>
          </>,"1fr 1fr")}

          <div style={{marginBottom:12}}>
            {lbl("Pricing type",true)}
            <div style={{display:"flex",gap:8}}>
              {["single","bundle"].map(t=>(
                <button key={t} onClick={()=>setF("pricingType",t)} style={{
                  padding:"7px 16px",fontSize:13,cursor:"pointer",borderRadius:"var(--border-radius-md)",
                  border: form.pricingType===t ? "1px solid #444441" : "1px solid #aaa",
                  background: form.pricingType===t ? "#444441" : "transparent",
                  color: form.pricingType===t ? "#ffffff" : "var(--color-text-secondary)",
                  textTransform:"capitalize"
                }}>{t}</button>
              ))}
            </div>
          </div>

          {form.pricingType==="bundle" ? (
            <div style={{background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",marginBottom:12}}>
              {field(<>
                <div>{lbl("Total bundle price ($)",true)}<input style={inp} type="number" min="0" step="0.01" value={form.price} onChange={e=>setF("price",e.target.value)} placeholder="e.g. 9.99"/></div>
                <div>{lbl("Items in bundle",true)}<input style={inp} type="number" min="2" step="1" value={form.bundleQty} onChange={e=>setF("bundleQty",e.target.value)} placeholder="e.g. 2"/></div>
              </>,"1fr 1fr")}
              {form.price&&form.bundleQty&&<p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"4px 0 0"}}>Price per item: ${(parseFloat(form.price)/parseFloat(form.bundleQty)).toFixed(2)}</p>}
            </div>
          ) : (
            field(<>
              <div>{lbl("Sale price ($)",true)}<input style={inp} type="number" min="0" step="0.01" value={form.price} onChange={e=>setF("price",e.target.value)} placeholder="e.g. 4.99"/></div>
              <div>{lbl("Original / pre-discount price ($)")}<input style={inp} type="number" min="0" step="0.01" value={form.origPrice} onChange={e=>setF("origPrice",e.target.value)} placeholder="e.g. 6.99 (optional)"/></div>
            </>,"1fr 1fr")
          )}

          {field(<>
            <div>{lbl("Quantity",true)}<input style={inp} type="number" min="0" step="any" value={form.qty} onChange={e=>setF("qty",e.target.value)} placeholder="e.g. 500"/></div>
            <div>{lbl("Unit",true)}
              <select style={inp} value={form.unit} onChange={e=>setF("unit",e.target.value)}>
                {UNIT_GROUPS.map(g=>(
                  <optgroup key={g.label} label={g.label}>
                    {g.units.map(u=><option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </>,"1fr 1fr")}

          {norm && (
            <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-info)",borderRadius:"var(--border-radius-md)",padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:"var(--color-text-info)"}}>Normalized:</span>
              <span style={{fontSize:16,fontWeight:500,color:"var(--color-text-info)"}}>${norm.normalized.toFixed(4)}<span style={{fontSize:12,fontWeight:400}}> {norm.label}</span></span>
            </div>
          )}

          {discountInfo && (
            <div style={{background:discountInfo.isHigher?"var(--color-background-danger)":"var(--color-background-success)",border:"0.5px solid",borderColor:discountInfo.isHigher?"var(--color-border-danger)":"var(--color-border-success)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",fontSize:13,color:discountInfo.isHigher?"var(--color-text-danger)":"var(--color-text-success)",marginBottom:12}}>
              {discountInfo.isHigher
                ? `Current price ($${form.price}) is HIGHER than the original ($${form.origPrice})!`
                : `Actual discount: ${discountInfo.advertised}% off (original $${form.origPrice})`}
            </div>
          )}

          <div style={{marginBottom:14}}>{lbl("Note")}<input style={inp} value={form.note} onChange={e=>setF("note",e.target.value)} placeholder="Optional note"/></div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Date: {today()}</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setForm(EMPTY);setTab("history");}} style={{padding:"9px 20px",background:"transparent",color:"var(--color-text-secondary)",border:"1px solid #aaa",borderRadius:"var(--border-radius-md)",fontSize:14,cursor:"pointer"}}>Cancel</button>
              <button onClick={handleAdd} style={{padding:"9px 20px",background:"#444441",color:"#ffffff",border:"1px solid #444441",borderRadius:"var(--border-radius-md)",fontSize:14,cursor:"pointer",fontWeight:500}}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD / HISTORY */}
      {tab==="history" && (
        <div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <label style={{fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>Filter:</label>
            <select style={{...inp,width:"auto",minWidth:160}} value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
              <option value="__all__">All items</option>
              {itemNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            {entries.length>0 && <span style={{fontSize:12,color:"var(--color-text-secondary)",marginLeft:"auto"}}>{filtered.length} entries</span>}
          </div>

          {filtered.length===0 && <p style={{color:"var(--color-text-secondary)",fontSize:14}}>No entries yet.</p>}

          {[...filtered].reverse().map(e=>{
            const alert=shrinkAlert(e.name);
            return (
              <div key={e.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"12px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:500,fontSize:15}}>{e.name}</span>
                    {e.brand&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{e.brand}</span>}
                    {e.store&&<span style={{fontSize:12,padding:"2px 7px",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)"}}>{e.store}</span>}
                    {e.pricingType==="bundle"&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:"var(--border-radius-md)",background:"var(--color-background-warning)",color:"var(--color-text-warning)"}}>bundle ×{e.bundleQty}</span>}
                  </div>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{e.date}</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap",fontSize:13}}>
                  <span><span style={{color:"var(--color-text-secondary)"}}>Paid: </span>${e.price.toFixed(2)}</span>
                  <span><span style={{color:"var(--color-text-secondary)"}}>Qty: </span>{e.qty}{e.unit}</span>
                  {e.normalized&&<span style={{color:"var(--color-text-info)",fontWeight:500}}>${e.normalized.toFixed(4)} {e.normLabel}</span>}
                </div>
                {e.origPrice&&(
                  <div style={{fontSize:12,marginTop:5,color:e.price>e.origPrice?"var(--color-text-danger)":"var(--color-text-secondary)"}}>
                    Original: ${e.origPrice} → Paid: ${e.price.toFixed(2)}
                    {e.price>e.origPrice&&" — paid MORE than original!"}
                    {e.price<e.origPrice&&` — saved ${(((e.origPrice-e.price)/e.origPrice)*100).toFixed(1)}%`}
                  </div>
                )}
                {alert&&<div style={{fontSize:12,marginTop:5,color:"var(--color-text-warning)"}}>⚠ Shrinkflation: {alert}</div>}
                {e.note&&<div style={{fontSize:12,marginTop:4,color:"var(--color-text-secondary)",fontStyle:"italic"}}>{e.note}</div>}
                <button onClick={()=>setEntries(prev=>prev.filter(x=>x.id!==e.id))} style={{marginTop:8,fontSize:11,padding:"3px 10px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer"}}>Delete</button>
              </div>
            );
          })}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={handleExport} style={{padding:"8px 18px",fontSize:13,cursor:"pointer",borderRadius:"var(--border-radius-md)",border:"1px solid #aaa",background:"transparent",color:"var(--color-text-secondary)"}}>Export</button>
            <label style={{padding:"8px 18px",fontSize:13,cursor:"pointer",borderRadius:"var(--border-radius-md)",border:"1px solid #aaa",background:"transparent",color:"var(--color-text-secondary)"}}>
              Import
              <input type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
            </label>
          </div>
        </div>
      )}

      {/* ANALYSIS / CHART */}
      {tab==="chart" && (
        <div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <label style={{fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>Filter:</label>
            <select style={{...inp,width:"auto",minWidth:160}} value={filterItem} onChange={e=>setFilterItem(e.target.value)}>
              <option value="__all__">All items</option>
              {itemNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {chartData.length<2
            ? <p style={{color:"var(--color-text-secondary)",fontSize:14}}>Add at least 2 entries for the same item on different dates to see a trend.</p>
            : <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:12}}>
                  {chartItems.map((name,i)=>(
                    <span key={name} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--color-text-secondary)"}}>
                      <span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:"inline-block"}}></span>{name}
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)"/>
                    <XAxis dataKey="date" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`$${v.toFixed(3)}`} width={62}/>
                    <Tooltip formatter={(v,name)=>[`$${parseFloat(v).toFixed(4)}`,name]} contentStyle={{fontSize:12,borderRadius:8,border:"0.5px solid #ccc"}}/>
                    {chartItems.map((name,i)=>(
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:4}} activeDot={{r:6}}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:8,textAlign:"center"}}>Normalized price over time</p>
              </div>
          }
        </div>
      )}
    </div>
  );
}
