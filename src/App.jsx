// TruPrice v1.15
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const UNIT_GROUPS = [
  { label:'Weight', units:['kg','g','lb','oz','斤(HK)','兩(HK)','斤(CN)','兩(CN)'] },
  { label:'Volume', units:['L','ml','fl oz'] },
  { label:'Count',  units:['count'] },
];
const TO_BASE = { g:1,kg:1000,lb:453.592,oz:28.3495,'斤(HK)':604.79,'兩(HK)':37.799,'斤(CN)':500,'兩(CN)':50,ml:1,L:1000,'fl oz':29.5735,count:1 };
const UNIT_TYPE = { g:'weight',kg:'weight',lb:'weight',oz:'weight','斤(HK)':'weight','兩(HK)':'weight','斤(CN)':'weight','兩(CN)':'weight',ml:'volume',L:'volume','fl oz':'volume',count:'count' };
const BASE_LABEL = { weight:'per 100g', volume:'per 100ml', count:'per unit' };
const COLORS = ['#378ADD','#1D9E75','#D85A30','#7F77DD','#BA7517','#D4537E','#639922','#888780'];
const STORAGE_KEY = 'price_tracker_v2';
const FX_CACHE_KEY = 'truprice_fx_cache';
const PREFS_KEY = 'truprice_prefs';
const ALL_CURRENCIES = ['CAD','CNY','EUR','GBP','HKD','JPY','SGD','USD'];
const CURRENCY_SYMBOLS = { CAD:'CA$',CNY:'CN¥',EUR:'€',GBP:'£',HKD:'HK$',JPY:'JP¥',SGD:'SG$',USD:'US$' };
const DEFAULT_SELECTED = ['HKD','USD','CAD'];
const PRESET_TAGS = [
  'Meat & Poultry','Seafood','Vegetables','Fruits','Tofu & Eggs',
  'Dry Goods','Canned & Bottled','Rice & Grains','Noodles & Pasta','Snacks',
  'Chinese Herbs','Health Foods','Supplements',
  'Condiments & Sauces','Beverages','Dairy','Frozen','Cleaning & Personal Care'
];
const today = () => new Date().toISOString().slice(0,10);
const EMPTY = { name:'',brand:'',store:'',tag:'',pricingType:'single',price:'',qty:'',unit:'g',bundleQty:'2',origPrice:'',note:'',priceDate:today(),currency:'HKD',purchased:false };
const ff = 'system-ui,-apple-system,sans-serif';

function normalizePrice(price,qty,unit,bundleQty=1) {
  const p=parseFloat(price),q=parseFloat(qty),b=parseFloat(bundleQty)||1;
  if(!p||!q||isNaN(p)||isNaN(q)||q===0) return null;
  const totalBase=q*(TO_BASE[unit]||1);
  const type=UNIT_TYPE[unit];
  const divisor=type==='count'?1:100;
  return { normalized:parseFloat(((p/b/totalBase)*divisor).toFixed(1)), label:BASE_LABEL[type], type };
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} };
const loadFxCache = () => { try { return JSON.parse(localStorage.getItem(FX_CACHE_KEY))||null; } catch { return null; } };
const saveFxCache = d => { try { localStorage.setItem(FX_CACHE_KEY,JSON.stringify(d)); } catch {} };
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY))||{ selectedCurrencies:DEFAULT_SELECTED,displayCurrency:'HKD' }; } catch { return { selectedCurrencies:DEFAULT_SELECTED,displayCurrency:'HKD' }; } };
const savePrefs = d => { try { localStorage.setItem(PREFS_KEY,JSON.stringify(d)); } catch {} };

const groupKey = e => e.name.trim()+'|||'+(e.brand||'').trim()+'|||'+(e.store||'').trim();

function BagIcon({ size=14, color='currentColor' }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/>
      <line x1='3' y1='6' x2='21' y2='6'/>
      <path d='M16 10a4 4 0 01-8 0'/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='8' r='4'/>
      <path d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/>
    </svg>
  );
}

function ClearableInput({ value, onChange, style, ...props }) {
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center'}}>
      <input style={{...style,paddingRight:value?'30px':style.padding||'7px 10px'}} value={value} onChange={e=>onChange(e.target.value)} {...props}/>
      {value&&<button onMouseDown={e=>{e.preventDefault();onChange('');}} style={{position:'absolute',right:8,background:'none',border:'none',cursor:'pointer',fontSize:14,color:'#aaa',padding:0,lineHeight:1}}>x</button>}
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
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  return (
    <div style={{position:'relative'}} ref={ref}>
      <div style={{position:'relative',display:'flex',alignItems:'center'}}>
        <input style={{...style,paddingRight:value?'30px':style.padding||'7px 10px'}} value={value}
          onChange={e=>{onChange(e.target.value);setOpen(true);}}
          onFocus={()=>setOpen(true)} placeholder={placeholder}/>
        {value&&<button onMouseDown={e=>{e.preventDefault();onChange('');setOpen(false);}} style={{position:'absolute',right:8,background:'none',border:'none',cursor:'pointer',fontSize:14,color:'#aaa',padding:0,lineHeight:1}}>x</button>}
      </div>
      {open&&filtered.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:50,background:'#fff',border:'1px solid #ccc',borderRadius:8,maxHeight:160,overflowY:'auto',marginTop:2}}>
          {filtered.map(s=>(
            <div key={s} onMouseDown={()=>{onChange(s);setOpen(false);}}
              style={{padding:'8px 12px',fontSize:13,cursor:'pointer',color:'#333',fontFamily:ff}}
              onMouseEnter={e=>e.currentTarget.style.background='#f5f5f5'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label, currSymbol, entries, chartGroupBy }) {
  if(!active||!payload||!payload.length) return null;
  return (
    <div style={{background:'#fff',border:'1px solid #aaa',borderRadius:8,padding:'10px 14px',fontSize:12,fontFamily:ff,maxWidth:220}}>
      <div style={{fontWeight:500,marginBottom:6,color:'#444'}}>{label}</div>
      {payload.map((p,i)=>{
        const keyEntries=entries.filter(e=>{
          const k=chartGroupBy==='item'?e.name:chartGroupBy==='brand'?e.brand:e.store;
          return k===p.dataKey&&e.date===label;
        });
        const brands=[...new Set(keyEntries.map(e=>e.brand).filter(Boolean))].join(', ');
        const stores=[...new Set(keyEntries.map(e=>e.store).filter(Boolean))].join(', ');
        return (
          <div key={i} style={{marginBottom:4}}>
            <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:p.color,marginRight:6}}></span>
            <span style={{color:p.color,fontWeight:500}}>{p.dataKey}: {currSymbol}{p.value}</span>
            {brands&&<div style={{color:'#888',marginLeft:14}}>Brand: {brands}</div>}
            {stores&&<div style={{color:'#888',marginLeft:14}}>Store: {stores}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [entries,setEntries] = useState(load);
  const [tab,setTab] = useState('history');
  const [form,setForm] = useState(EMPTY);
  const [editId,setEditId] = useState(null);
  const [viewBy,setViewBy] = useState('item');
  const [filterValue,setFilterValue] = useState('__all__');
  const [filterTag,setFilterTag] = useState('__all__');
  const [chartGroupBy,setChartGroupBy] = useState('store');
  const [showPersonalization,setShowPersonalization] = useState(false);
  const [expandedKey,setExpandedKey] = useState(null);
  const [prefs,setPrefs] = useState(loadPrefs);

  const displayCurrency=prefs.displayCurrency;
  const selectedCurrencies=prefs.selectedCurrencies;
  const updatePrefs=(updates)=>{ const n={...prefs,...updates}; setPrefs(n); savePrefs(n); };

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
      const res=await fetch('https://api.frankfurter.app/latest?from=HKD&to=CAD,CNY,EUR,GBP,JPY,SGD,USD');
      if(!res.ok) throw new Error();
      const data=await res.json();
      const rates={ HKD:1,...data.rates };
      const updated=new Date().toISOString();
      setFxRates(rates); setFxUpdated(updated);
      saveFxCache({ rates,updated });
    } catch { setFxError('Could not fetch rates. Using cached or 1:1.'); }
    finally { setFxLoading(false); }
  },[]);

  function convertPrice(price,fromCurrency) {
    if(!fxRates||!fromCurrency||fromCurrency===displayCurrency) return price;
    const hkd=fromCurrency==='HKD'?price:price/(fxRates[fromCurrency]||1);
    return displayCurrency==='HKD'?hkd:hkd*(fxRates[displayCurrency]||1);
  }
  function toHKD(norm,curr) { if(!fxRates||curr==='HKD') return norm; return norm/(fxRates[curr]||1); }
  function toDisplay(hkd) { if(!fxRates||displayCurrency==='HKD') return hkd; return hkd*(fxRates[displayCurrency]||1); }
  function dispNormOf(e) { return e.normalized?parseFloat(toDisplay(toHKD(e.normalized,e.currency||'HKD')).toFixed(1)):null; }

  const currSymbol=CURRENCY_SYMBOLS[displayCurrency]||displayCurrency;
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(null),3000); };

  const itemNames  = useMemo(()=>[...new Set(entries.map(e=>e.name))].filter(Boolean).sort(),[entries]);
  const brandNames = useMemo(()=>[...new Set(entries.map(e=>e.brand))].filter(Boolean).sort(),[entries]);
  const storeNames = useMemo(()=>[...new Set(entries.map(e=>e.store))].filter(Boolean).sort(),[entries]);
  const userTags   = useMemo(()=>[...new Set([...PRESET_TAGS,...entries.map(e=>e.tag).filter(Boolean)])].sort(),[entries]);

  const filterOptions = useMemo(()=>{
    if(viewBy==='brand') return brandNames;
    if(viewBy==='store') return storeNames;
    return itemNames;
  },[viewBy,itemNames,brandNames,storeNames]);

  const norm = useMemo(()=>
    normalizePrice(form.price,form.qty,form.unit,form.pricingType==='bundle'?form.bundleQty:1),
    [form.price,form.qty,form.unit,form.bundleQty,form.pricingType]);

  const discountInfo = useMemo(()=>{
    const sp=parseFloat(form.price),op=parseFloat(form.origPrice);
    if(!sp||!op||op===0) return null;
    return { advertised:((op-sp)/op*100).toFixed(1),isHigher:sp>op };
  },[form.price,form.origPrice]);

  function handleEdit(e) {
    setForm({ name:e.name,brand:e.brand||'',store:e.store||'',tag:e.tag||'',
      pricingType:e.pricingType||'single',price:String(e.price),qty:String(e.qty),unit:e.unit,
      bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):'',
      note:e.note||'',priceDate:e.priceDate||today(),currency:e.currency||'HKD',purchased:e.purchased||false });
    setEditId(e.id); setTab('add');
  }
  function handleDuplicate(e) {
    setForm({ name:e.name,brand:e.brand||'',store:e.store||'',tag:e.tag||'',
      pricingType:e.pricingType||'single',price:String(e.price),qty:String(e.qty),unit:e.unit,
      bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):'',
      note:e.note||'',priceDate:today(),currency:e.currency||'HKD',purchased:false });
    setEditId(null); setTab('add');
  }

  function handleSave() {
    if(!form.name.trim()){ showToast('Item name is required.'); return; }
    if(!form.price){ showToast('Price is required.'); return; }
    if(!form.qty||!form.unit){ showToast('Package size and unit are required.'); return; }
    if(form.pricingType==='bundle'&&(!form.bundleQty||parseFloat(form.bundleQty)<2)){ showToast('Bundle requires 2 or more packs.'); return; }
    const effectiveDate=form.priceDate||today();
    const entryData={
      name:form.name.trim(),brand:form.brand.trim(),store:form.store.trim(),tag:form.tag.trim(),
      pricingType:form.pricingType,price:parseFloat(form.price),qty:parseFloat(form.qty),unit:form.unit,
      bundleQty:form.pricingType==='bundle'?parseFloat(form.bundleQty):1,
      origPrice:form.origPrice?parseFloat(form.origPrice):null,
      note:form.note.trim(),date:effectiveDate,priceDate:form.priceDate||null,createdAt:today(),
      currency:form.currency||'HKD',purchased:form.purchased||false,
      normalized:norm?norm.normalized:null,normLabel:norm?norm.label:null,
    };
    if(editId){ setEntries(prev=>prev.map(e=>e.id===editId?{...entryData,id:editId}:e)); showToast('Record updated!'); setEditId(null); }
    else { setEntries(prev=>[{...entryData,id:Date.now()},...prev]); showToast('Entry saved!'); }
    setForm(EMPTY); setTab('history');
  }
  function handleCancel() { setForm(EMPTY); setEditId(null); setTab('history'); }

  // Competition: compare latest observed price across different brand+store combos for same item
  function competitionInfo(name, myDispNorm) {
    if(myDispNorm==null) return null;
    const sameItem=entries.filter(e=>e.name===name&&!e.purchased&&e.normalized);
    const keys=[...new Set(sameItem.map(groupKey))];
    if(keys.length<=1) return null;
    const latestPerKey={};
    sameItem.forEach(e=>{ const k=groupKey(e); if(!latestPerKey[k]||e.date>latestPerKey[k].date) latestPerKey[k]=e; });
    const all=Object.values(latestPerKey).map(e=>({ ...e,dn:parseFloat(toDisplay(toHKD(e.normalized,e.currency||'HKD')).toFixed(1)) }));
    const minNorm=Math.min(...all.map(e=>e.dn));
    const isLowest=Math.abs(myDispNorm-minNorm)<0.05;
    const cheapest=all.find(e=>Math.abs(e.dn-minNorm)<0.05);
    return { isLowest,cheapestLabel:(cheapest?.brand||'')+(cheapest?.store?' @ '+cheapest.store:''),minNorm };
  }

  // Group filtered entries by name+brand+store
  const grouped = useMemo(()=>{
    let list=[...entries];
    if(filterValue!=='__all__'){
      if(viewBy==='brand') list=list.filter(e=>e.brand===filterValue);
      else if(viewBy==='store') list=list.filter(e=>e.store===filterValue);
      else list=list.filter(e=>e.name===filterValue);
    }
    if(filterTag!=='__all__') list=list.filter(e=>e.tag===filterTag);

    const map={};
    list.forEach(e=>{
      const k=groupKey(e);
      if(!map[k]) map[k]=[];
      map[k].push(e);
    });
    // Sort entries within each group by date desc
    Object.values(map).forEach(arr=>arr.sort((a,b)=>b.date.localeCompare(a.date)));
    // Sort groups by most recent entry date desc
    return Object.entries(map).sort((a,b)=>b[1][0].date.localeCompare(a[1][0].date));
  },[entries,filterValue,viewBy,filterTag,fxRates,displayCurrency]);

  const getChartKey = useCallback((e)=>{
    if(chartGroupBy==='item') return e.name;
    if(chartGroupBy==='brand') return e.brand||'';
    return e.store||'';
  },[chartGroupBy]);

  const chartSrc = useMemo(()=>{
    let src=filterValue==='__all__'?entries:entries.filter(e=>{
      if(viewBy==='brand') return e.brand===filterValue;
      if(viewBy==='store') return e.store===filterValue;
      return e.name===filterValue;
    });
    if(filterTag!=='__all__') src=src.filter(e=>e.tag===filterTag);
    return src;
  },[entries,filterValue,viewBy,filterTag]);

  const chartKeys = useMemo(()=>[...new Set(chartSrc.filter(e=>e.normalized&&getChartKey(e)).map(getChartKey))].sort(),[chartSrc,getChartKey]);

  const chartData = useMemo(()=>{
    const byKey={};
    chartSrc.forEach(e=>{
      if(!e.normalized) return;
      const k=getChartKey(e); if(!k) return;
      const converted=parseFloat(toDisplay(toHKD(e.normalized,e.currency||'HKD')).toFixed(1));
      if(!byKey[k]) byKey[k]={};
      if(!byKey[k][e.date]) byKey[k][e.date]=[];
      byKey[k][e.date].push(converted);
    });
    const dates=[...new Set(chartSrc.map(e=>e.date))].sort();
    return dates.map(d=>{
      const row={date:d};
      Object.keys(byKey).forEach(k=>{ if(byKey[k][d]) row[k]=parseFloat((byKey[k][d].reduce((a,b)=>a+b,0)/byKey[k][d].length).toFixed(1)); });
      return row;
    });
  },[chartSrc,getChartKey,fxRates,displayCurrency]);

  const chartMin = useMemo(()=>{
    const vals=chartData.flatMap(d=>chartKeys.map(k=>d[k]).filter(v=>v!=null));
    if(!vals.length) return 'auto';
    return parseFloat((Math.min(...vals)*0.9).toFixed(1));
  },[chartData,chartKeys]);

  function toggleCurrencySelection(c) {
    let updated=[...selectedCurrencies];
    if(updated.includes(c)){
      if(updated.length<=1) return;
      updated=updated.filter(x=>x!==c);
      if(displayCurrency===c) updatePrefs({ selectedCurrencies:updated,displayCurrency:updated[0] });
      else updatePrefs({ selectedCurrencies:updated });
    } else {
      if(updated.length>=3) updated=updated.slice(1);
      updated=[...updated,c];
      updatePrefs({ selectedCurrencies:updated });
    }
  }

  function handleExport() {
    const blob=new Blob([JSON.stringify(entries,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='truprice_records.json'; a.click();
  }
  function handleImport(e) {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ try { const d=JSON.parse(ev.target.result); if(Array.isArray(d)){ setEntries(d); showToast('Imported '+d.length+' entries.'); } else showToast('Invalid file.'); } catch { showToast('Failed to read file.'); } };
    r.readAsText(file); e.target.value='';
  }

  const fxUpdatedLabel=fxUpdated?new Date(fxUpdated).toLocaleDateString():null;
  const inp={ padding:'7px 10px',border:'1px solid #aaa',borderRadius:8,background:'#fff',color:'#222',fontSize:14,width:'100%',boxSizing:'border-box',fontFamily:ff };
  const lbl=(t,req)=>(<label style={{fontSize:12,color:'#666',display:'block',marginBottom:3,fontFamily:ff}}>{t}{req&&<span style={{color:'red',marginLeft:2}}>*</span>}</label>);
  const field=(children,cols)=>(<div style={{display:'grid',gridTemplateColumns:cols||'1fr',gap:10,marginBottom:12}}>{children}</div>);
  const btnTab=active=>({ flex:1,padding:'7px 0',fontSize:13,cursor:'pointer',borderRadius:8,border:active?'1px solid #444441':'1px solid #aaa',background:active?'#444441':'transparent',color:active?'#fff':'#666',fontFamily:ff });
  const toggleBtn=active=>({ padding:'5px 14px',fontSize:12,cursor:'pointer',borderRadius:6,border:active?'1px solid #444441':'1px solid #aaa',background:active?'#444441':'transparent',color:active?'#fff':'#666',fontFamily:ff });
  const AnalysisIcon=()=>(<svg width='14' height='14' viewBox='0 0 512 512' fill='currentColor'><path d='M80 320 L180 200 L260 270 L340 140 L420 200' stroke='currentColor' strokeWidth='48' strokeLinecap='round' strokeLinejoin='round' fill='none'/><circle cx='340' cy='360' r='90' stroke='currentColor' strokeWidth='48' fill='none'/><line x1='405' y1='425' x2='460' y2='480' stroke='currentColor' strokeWidth='52' strokeLinecap='round'/></svg>);

  return (
    <div style={{padding:'1rem 0.75rem',maxWidth:680,margin:'0 auto',fontFamily:ff}}>
      {toast&&<div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#fff',border:'1px solid #ccc',borderRadius:8,padding:'10px 20px',fontSize:13,zIndex:999,color:'#222',whiteSpace:'nowrap',fontFamily:ff}}>{toast}</div>}

      <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,position:'relative'}}>
        <span style={{fontSize:13,color:'#444441',fontFamily:ff}}>TruPrice - Your Grocery Shopping Companion</span>
        <button onClick={()=>setShowPersonalization(p=>!p)} style={{position:'absolute',right:0,background:'none',border:'none',cursor:'pointer',color:showPersonalization?'#444441':'#aaa',padding:4}}>
          <UserIcon/>
        </button>
      </div>

      {showPersonalization&&(
        <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'1rem',marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:500,color:'#444441',margin:'0 0 8px',fontFamily:ff}}>Personalization</p>
          <p style={{fontSize:12,color:'#666',margin:'0 0 8px',fontFamily:ff}}>Select 3 currencies for quick switch:</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
            {ALL_CURRENCIES.map(c=>{ const sel=selectedCurrencies.includes(c); return <button key={c} onClick={()=>toggleCurrencySelection(c)} style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:sel?'1px solid #444441':'1px solid #aaa',background:sel?'#444441':'transparent',color:sel?'#fff':'#666',fontFamily:ff}}>{c}</button>; })}
          </div>
          <p style={{fontSize:12,color:'#666',margin:'0 0 6px',fontFamily:ff}}>Default display currency:</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {selectedCurrencies.map(c=>(<button key={c} onClick={()=>updatePrefs({ displayCurrency:c })} style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:displayCurrency===c?'1px solid #444441':'1px solid #aaa',background:displayCurrency===c?'#444441':'transparent',color:displayCurrency===c?'#fff':'#666',fontFamily:ff}}>{c}</button>))}
          </div>
          <p style={{fontSize:11,color:'#aaa',marginTop:12,marginBottom:0,fontFamily:ff}}>More personalization options coming soon.</p>
        </div>
      )}

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[{key:'history',label:'Record'},{key:'add',label:editId?'Edit':'+ New'},{key:'chart',label:'chart'}].map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key)} style={btnTab(tab===key)}>
            {key==='chart'?<span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}><AnalysisIcon/>Analysis</span>:label}
          </button>
        ))}
      </div>

      {tab!=='add'&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:'#f9f9f9',border:'1px solid #eee',borderRadius:8}}>
        <span style={{fontSize:12,color:'#666',fontFamily:ff}}>Display:</span>
        {selectedCurrencies.map(c=>(<button key={c} onClick={()=>updatePrefs({ displayCurrency:c })} style={{...toggleBtn(displayCurrency===c),padding:'4px 10px',fontSize:12}}>{c}</button>))}
        <button onClick={fetchFx} disabled={fxLoading} style={{marginLeft:'auto',fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #aaa',background:'transparent',color:'#666',cursor:'pointer',fontFamily:ff}}>{fxLoading?'...':'Rates'}</button>
        {fxUpdatedLabel&&<span style={{fontSize:10,color:'#aaa',fontFamily:ff}}>{fxUpdatedLabel}</span>}
      </div>}
      {fxError&&tab!=='add'&&<div style={{fontSize:12,color:'#c0392b',marginBottom:10,fontFamily:ff}}>{fxError}</div>}

      {/* ADD / EDIT */}
      {tab==='add'&&(
        <div style={{background:'#fff',border:'1px solid #ddd',borderRadius:12,padding:'1.25rem'}}>
          {editId&&<p style={{fontSize:12,color:'#1a73e8',marginBottom:12,marginTop:0,fontFamily:ff}}>Editing existing record</p>}
          <div style={{marginBottom:12}}>
            {lbl('Item name',true)}
            <AutocompleteInput value={form.name} onChange={v=>setF('name',v)} suggestions={itemNames} placeholder='Type or select a previous item' style={inp}/>
          </div>
          {field(<>
            <div>{lbl('Brand')}<AutocompleteInput value={form.brand} onChange={v=>setF('brand',v)} suggestions={brandNames} placeholder='e.g. Quaker' style={inp}/></div>
            <div>{lbl('Store')}<AutocompleteInput value={form.store} onChange={v=>setF('store',v)} suggestions={storeNames} placeholder='e.g. Walmart' style={inp}/></div>
          </>,'1fr 1fr')}
          <div style={{marginBottom:12}}>
            {lbl('Category tag')}
            <AutocompleteInput value={form.tag} onChange={v=>setF('tag',v)} suggestions={userTags} placeholder='e.g. Dry Goods (optional, private)' style={inp}/>
          </div>
          <div style={{marginBottom:12}}>
            {lbl('Pricing type',true)}
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              {['single','bundle'].map(t=>(<button key={t} onClick={()=>setF('pricingType',t)} style={{padding:'7px 16px',fontSize:13,cursor:'pointer',borderRadius:8,border:form.pricingType===t?'1px solid #444441':'1px solid #aaa',background:form.pricingType===t?'#444441':'transparent',color:form.pricingType===t?'#fff':'#666',textTransform:'capitalize',fontFamily:ff}}>{t}</button>))}
              <label style={{display:'flex',alignItems:'center',gap:6,marginLeft:8,fontSize:13,color:'#666',cursor:'pointer',fontFamily:ff}}>
                <input type='checkbox' checked={form.purchased} onChange={e=>setF('purchased',e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/>
                Purchased?
              </label>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            {lbl('Currency')}
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {ALL_CURRENCIES.map(c=>(<button key={c} onClick={()=>setF('currency',c)} style={{padding:'6px 12px',fontSize:12,cursor:'pointer',borderRadius:8,border:form.currency===c?'1px solid #444441':'1px solid #aaa',background:form.currency===c?'#444441':'transparent',color:form.currency===c?'#fff':'#666',fontFamily:ff}}>{c}</button>))}
            </div>
          </div>
          {form.pricingType==='bundle'?(
            <div style={{background:'#f9f9f9',border:'1px solid #ddd',borderRadius:8,padding:'10px 12px',marginBottom:12}}>
              {field(<>
                <div>{lbl('Total bundle price',true)}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.price} onChange={v=>setF('price',v)} placeholder='e.g. 9.99'/></div>
                <div>{lbl('Packs in bundle',true)}<ClearableInput style={inp} type='number' min='2' step='1' value={form.bundleQty} onChange={v=>setF('bundleQty',v)} placeholder='e.g. 2'/></div>
              </>,'1fr 1fr')}
              {form.price&&form.bundleQty&&<p style={{fontSize:12,color:'#666',margin:'4px 0 0',fontFamily:ff}}>Price per pack: {CURRENCY_SYMBOLS[form.currency]||form.currency}{(parseFloat(form.price)/parseFloat(form.bundleQty)).toFixed(2)}</p>}
            </div>
          ):(
            field(<>
              <div>{lbl('Price',true)}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.price} onChange={v=>setF('price',v)} placeholder='e.g. 4.99'/></div>
              <div>{lbl('Original / listed price')}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.origPrice} onChange={v=>setF('origPrice',v)} placeholder='e.g. 6.99 (optional)'/></div>
            </>,'1fr 1fr')
          )}
          {field(<>
            <div>{lbl('Package size',true)}<ClearableInput style={inp} type='number' min='0' step='any' value={form.qty} onChange={v=>setF('qty',v)} placeholder='e.g. 500'/></div>
            <div>{lbl('Unit',true)}
              <select style={{...inp,height:'36px'}} value={form.unit} onChange={e=>setF('unit',e.target.value)}>
                {UNIT_GROUPS.map(g=>(<optgroup key={g.label} label={g.label}>{g.units.map(u=><option key={u} value={u}>{u}</option>)}</optgroup>))}
              </select>
            </div>
          </>,'1fr 1fr')}
          {norm&&(
            <div style={{background:'#e8f0fe',border:'1px solid #aac4f5',borderRadius:8,padding:'9px 14px',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,color:'#1a73e8',fontFamily:ff}}>Normalized ({form.currency}):</span>
                <span style={{fontSize:16,fontWeight:500,color:'#1a73e8',fontFamily:ff}}>{CURRENCY_SYMBOLS[form.currency]||form.currency}{norm.normalized.toFixed(1)}<span style={{fontSize:12,fontWeight:400}}> {norm.label}</span></span>
              </div>
              {form.currency!==displayCurrency&&fxRates&&(
                <div style={{fontSize:12,color:'#555',marginTop:4,fontFamily:ff}}>approx {currSymbol}{convertPrice(norm.normalized,form.currency).toFixed(1)} {norm.label} ({displayCurrency})</div>
              )}
            </div>
          )}
          {discountInfo&&(
            <div style={{background:discountInfo.isHigher?'#fdecea':'#e6f4ea',border:'1px solid',borderColor:discountInfo.isHigher?'#f5c6c6':'#a8d5b5',borderRadius:8,padding:'8px 12px',fontSize:13,color:discountInfo.isHigher?'#c0392b':'#1e7e34',marginBottom:12,fontFamily:ff}}>
              {discountInfo.isHigher?'Current price is HIGHER than the original listed price!':'Actual discount: '+discountInfo.advertised+'% lower than listed'}
            </div>
          )}
          <div style={{marginBottom:12}}>{lbl('Note')}<ClearableInput style={inp} value={form.note} onChange={v=>setF('note',v)} placeholder='Optional note'/></div>
          {field(<><div>{lbl('Price date')}<input style={inp} type='date' value={form.priceDate} onChange={e=>setF('priceDate',e.target.value)}/></div></>)}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <button onClick={handleCancel} style={{padding:'9px 20px',background:'transparent',color:'#666',border:'1px solid #aaa',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:ff}}>Cancel</button>
            <button onClick={handleSave} style={{padding:'9px 20px',background:'#444441',color:'#fff',border:'1px solid #444441',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:500,fontFamily:ff}}>{editId?'Update':'Save'}</button>
          </div>
        </div>
      )}

      {/* RECORD */}
      {tab==='history'&&(
        <div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>View by:</label>
            <select style={{...inp,width:'auto',minWidth:90,background:'#fff'}} value={viewBy} onChange={e=>{setViewBy(e.target.value);setFilterValue('__all__');}}>
              <option value='item'>Item</option>
              <option value='brand'>Brand</option>
              <option value='store'>Store</option>
            </select>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>Filter:</label>
            <select style={{...inp,width:'auto',minWidth:110,flex:1}} value={filterValue} onChange={e=>setFilterValue(e.target.value)}>
              <option value='__all__'>All</option>
              {filterOptions.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            {grouped.length>0&&<span style={{fontSize:12,color:'#888',whiteSpace:'nowrap',fontFamily:ff}}>{grouped.length}</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>Tag:</label>
            <select style={{...inp,width:'auto',minWidth:110,flex:1}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
              <option value='__all__'>All tags</option>
              {userTags.filter(t=>entries.some(e=>e.tag===t)).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:14}}>
            <button onClick={handleExport} style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:'1px solid #aaa',background:'transparent',color:'#666',fontFamily:ff}}>Export</button>
            <label style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:'1px solid #aaa',background:'transparent',color:'#666',fontFamily:ff}}>Import<input type='file' accept='.json' style={{display:'none'}} onChange={handleImport}/></label>
          </div>
          {grouped.length===0&&<p style={{color:'#888',fontSize:14,fontFamily:ff}}>No entries yet.</p>}
          {grouped.map(([gk,gEntries])=>{
            const latest=gEntries[0];
            const entryCurr=latest.currency||'HKD';
            const entrySymbol=CURRENCY_SYMBOLS[entryCurr]||entryCurr;

            // Best observed (lowest normalized) in this group
            const observed=gEntries.filter(e=>!e.purchased&&e.normalized);
            const purchased=gEntries.filter(e=>e.purchased&&e.normalized);
            const bestObs=observed.length?observed.reduce((b,e)=>{ const d=dispNormOf(e); return d<(dispNormOf(b)??Infinity)?e:b; }):null;
            const latestPurchase=purchased.length?purchased[0]:null;

            // Headline entry = best observed if exists, else latest purchased
            const headline=bestObs||latest;
            const headlineDispNorm=dispNormOf(headline);
            const headlineCurr=headline.currency||'HKD';
            const headlineSymbol=CURRENCY_SYMBOLS[headlineCurr]||headlineCurr;
            const headlineDispPrice=parseFloat(convertPrice(headline.price,headlineCurr).toFixed(2));

            const hasPurchase=purchased.length>0;
            const comp=competitionInfo(latest.name,headlineDispNorm);
            const isExpanded=expandedKey===gk;

            return (
              <div key={gk} style={{background:comp?.isLowest?'#f0faf4':'#fff',border:'1px solid '+(comp?.isLowest?'#a8d5b5':'#ddd'),borderRadius:12,padding:'12px 16px',marginBottom:10}}>
                {/* Clickable summary */}
                <div onClick={()=>setExpandedKey(isExpanded?null:gk)} style={{cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                    <span style={{fontWeight:500,fontSize:15,fontFamily:ff}}>{latest.name}</span>
                    <span style={{fontSize:12,color:'#888',fontFamily:ff,whiteSpace:'nowrap'}}>{latest.date}</span>
                  </div>
                  {(latest.store||latest.brand)&&(
                    <div style={{fontSize:11,color:'#999',fontFamily:ff,marginTop:2,display:'flex',gap:12}}>
                      {latest.store&&<span>Store: {latest.store}</span>}
                      {latest.brand&&<span>Brand: {latest.brand}</span>}
                    </div>
                  )}
                  {latest.tag&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:6,background:'#f0f0f0',color:'#666',fontFamily:ff,display:'inline-block',marginTop:4}}>{latest.tag}</span>}
                  {latest.pricingType==='bundle'&&<span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:'#fff8e1',color:'#b26a00',fontFamily:ff,display:'inline-block',marginTop:4,marginLeft:4}}>bundle x{latest.bundleQty}</span>}

                  {/* Headline price row */}
                  <div style={{display:'flex',gap:16,marginTop:6,flexWrap:'wrap',fontSize:13,fontFamily:ff,alignItems:'center'}}>
                    <span><span style={{color:'#888'}}>Price: </span>{headlineCurr===displayCurrency?headlineSymbol+headline.price.toFixed(2):headlineSymbol+headline.price.toFixed(2)+' ('+currSymbol+headlineDispPrice+')'}</span>
                    <span><span style={{color:'#888'}}>Size: </span>{headline.qty}{headline.unit}</span>
                    {headlineDispNorm!=null&&(
                      <span style={{display:'flex',alignItems:'center',gap:4,color:'#1a73e8',fontWeight:500}}>
                        {currSymbol}{headlineDispNorm} {headline.normLabel}
                        {hasPurchase&&<BagIcon size={13} color='#1a73e8'/>}
                      </span>
                    )}
                  </div>
                  {gEntries.length>1&&<div style={{fontSize:11,color:'#aaa',marginTop:4,fontFamily:ff}}>{gEntries.length} records</div>}
                </div>

                {/* Expanded */}
                {isExpanded&&(
                  <div style={{marginTop:10,borderTop:'1px solid #eee',paddingTop:10}}>

                    {/* Competition info */}
                    {comp&&!comp.isLowest&&<div style={{fontSize:12,marginBottom:6,color:'#888',fontFamily:ff}}>Cheaper: {comp.cheapestLabel} at {currSymbol}{comp.minNorm.toFixed(1)} {headline.normLabel}</div>}
                    {comp?.isLowest&&<div style={{fontSize:12,marginBottom:6,color:'#1e7e34',fontFamily:ff}}>Best price among stores</div>}

                    {/* Most recent purchase */}
                    {latestPurchase&&(
                      <div style={{fontSize:12,marginBottom:8,color:'#666',fontFamily:ff,display:'flex',alignItems:'center',gap:6}}>
                        <BagIcon size={12} color='#666'/>
                        Last purchased: {latestPurchase.date} at {currSymbol}{dispNormOf(latestPurchase)} {latestPurchase.normLabel}
                      </div>
                    )}

                    {/* All entries list */}
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:'#aaa',fontFamily:ff,marginBottom:6}}>All records</div>
                      {gEntries.map(e=>{
                        const eCurr=e.currency||'HKD';
                        const eSymbol=CURRENCY_SYMBOLS[eCurr]||eCurr;
                        const eDn=dispNormOf(e);
                        return (
                          <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f5f5f5',fontSize:12,fontFamily:ff}}>
                            <div>
                              <span style={{color:'#666'}}>{e.date}</span>
                              {e.purchased&&<span style={{marginLeft:6,display:'inline-flex',alignItems:'center'}}><BagIcon size={11} color='#aaa'/></span>}
                              {e.note&&<span style={{color:'#aaa',marginLeft:6,fontStyle:'italic'}}>{e.note}</span>}
                            </div>
                            <div style={{textAlign:'right'}}>
                              <span style={{color:'#444'}}>{eSymbol}{e.price.toFixed(2)}</span>
                              {eDn!=null&&<span style={{color:'#1a73e8',marginLeft:8}}>{currSymbol}{eDn} {e.normLabel}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Discount info from latest */}
                    {latest.origPrice&&(
                      <div style={{fontSize:12,marginBottom:6,color:latest.price>latest.origPrice?'#c0392b':'#888',fontFamily:ff}}>
                        {'Listed: '+(CURRENCY_SYMBOLS[latest.currency]||latest.currency)+latest.origPrice+' - Observed: '+(CURRENCY_SYMBOLS[latest.currency]||latest.currency)+latest.price.toFixed(2)}
                        {latest.price>latest.origPrice&&' - higher than listed!'}
                        {latest.price<latest.origPrice&&' - '+(((latest.origPrice-latest.price)/latest.origPrice)*100).toFixed(1)+'% lower'}
                      </div>
                    )}

                    <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>handleEdit(latest)} style={{fontSize:12,padding:'5px 14px',border:'1px solid #aaa',borderRadius:6,background:'transparent',color:'#444',cursor:'pointer',fontFamily:ff}}>Edit latest</button>
                        <button onClick={()=>handleDuplicate(latest)} style={{fontSize:12,padding:'5px 14px',border:'1px solid #aaa',borderRadius:6,background:'transparent',color:'#444',cursor:'pointer',fontFamily:ff}}>Duplicate</button>
                      </div>
                      <button onClick={()=>{ if(window.confirm('Delete all '+gEntries.length+' records for this item?')) setEntries(prev=>prev.filter(x=>groupKey(x)!==gk)); }} style={{fontSize:12,padding:'5px 14px',border:'1px solid #ddd',borderRadius:6,background:'transparent',color:'#aaa',cursor:'pointer',fontFamily:ff}}>Delete all</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ANALYSIS */}
      {tab==='chart'&&(
        <div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>View by:</label>
            <select style={{...inp,width:'auto',minWidth:90}} value={viewBy} onChange={e=>{setViewBy(e.target.value);setFilterValue('__all__');}}>
              <option value='item'>Item</option>
              <option value='brand'>Brand</option>
              <option value='store'>Store</option>
            </select>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>Filter:</label>
            <select style={{...inp,width:'auto',minWidth:110,flex:1}} value={filterValue} onChange={e=>setFilterValue(e.target.value)}>
              <option value='__all__'>All</option>
              {filterOptions.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>Tag:</label>
            <select style={{...inp,width:'auto',minWidth:110,flex:1}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
              <option value='__all__'>All tags</option>
              {userTags.filter(t=>entries.some(e=>e.tag===t)).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center'}}>
            <span style={{fontSize:12,color:'#666',fontFamily:ff}}>Group by:</span>
            {['item','brand','store'].map(g=>(<button key={g} onClick={()=>setChartGroupBy(g)} style={{...toggleBtn(chartGroupBy===g),textTransform:'capitalize'}}>{g}</button>))}
          </div>
          {chartData.length===0
            ? <p style={{color:'#888',fontSize:14,fontFamily:ff}}>No data to display.</p>
            : <div style={{background:'#fff',border:'1px solid #ddd',borderRadius:12,padding:'1rem'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:12}}>
                  {chartKeys.map((k,i)=>(<span key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#666',fontFamily:ff}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:'inline-block'}}></span>{k}</span>))}
                </div>
                <ResponsiveContainer width='100%' height={300}>
                  <LineChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(128,128,128,0.15)'/>
                    <XAxis dataKey='date' tick={{fontSize:11,fontFamily:ff}}/>
                    <YAxis tick={{fontSize:11,fontFamily:ff}} tickFormatter={v=>currSymbol+v.toFixed(1)} width={62} domain={[chartMin,'auto']}/>
                    <Tooltip content={<CustomTooltip currSymbol={currSymbol} entries={chartSrc} chartGroupBy={chartGroupBy}/>}/>
                    {chartKeys.map((k,i)=>(<Line key={k} type='monotone' dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:4}} activeDot={{r:6}} connectNulls={false}/>))}
                  </LineChart>
                </ResponsiveContainer>
                <p style={{fontSize:11,color:'#888',marginTop:8,textAlign:'center',fontFamily:ff}}>Normalized price in {displayCurrency} over time</p>
              </div>
          }
        </div>
      )}
    </div>
  );
}
