// TruPrice v2.0k
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const UNIT_GROUPS = [
  { label:'Weight', units:['kg','g','lb','oz','斤(HK)','兩(HK)','斤(CN)','兩(CN)'] },
  { label:'Volume', units:['L','ml','fl oz'] },
  { label:'Count',  units:['count','pack'] },
];
const TO_BASE = { g:1,kg:1000,lb:453.592,oz:28.3495,'斤(HK)':604.79,'兩(HK)':37.799,'斤(CN)':500,'兩(CN)':50,ml:1,L:1000,'fl oz':29.5735,count:1,pack:1 };
const UNIT_TYPE = { g:'weight',kg:'weight',lb:'weight',oz:'weight','斤(HK)':'weight','兩(HK)':'weight','斤(CN)':'weight','兩(CN)':'weight',ml:'volume',L:'volume','fl oz':'volume',count:'count',pack:'pack' };
const BASE_LABEL = { weight:'per 100g', volume:'per 100ml', count:'per unit', pack:'per pack' };
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
  'Condiments & Sauces','Beverages','Dairy','Frozen','Cleaning & Personal Care',
  'Alcohols','Baking','Chinese Pastries','Frozen Dessert','Soup Ingredients','家品',
];

const SECTION_MAP = [
  { name:'Food', color:'#4CAF50', categories:['Meat & Poultry','Seafood','Vegetables','Fruits','Tofu & Eggs','Dairy','Frozen','Frozen Dessert','Snacks','Chinese Pastries','Beverages','Rice & Grains','Noodles & Pasta','Dry Goods','Canned & Bottled','Condiments & Sauces','Baking','Soup Ingredients','Chinese Herbs'] },
  { name:'Alcohol', color:'#FF8F00', categories:['Alcohols'] },
  { name:'Medicine & Supplements', color:'#1a73e8', categories:['Health Foods','Supplements'] },
  { name:'Household', color:'#7F77DD', categories:['Cleaning & Personal Care','家品'] },
];
const SECTION_OTHER = { name:'Other', color:'#888' };

function getSectionForTag(tag) {
  if(!tag) return SECTION_OTHER;
  const found=SECTION_MAP.find(s=>s.categories.includes(tag));
  return found||SECTION_OTHER;
}
const today = () => new Date().toISOString().slice(0,10);
const EMPTY = { name:'',brand:'',store:'',tag:'',pricingType:'single',price:'',qty:'',unit:'g',bundleQty:'2',origPrice:'',origUnitPrice:'',buyX:'2',getY:'1',note:'',priceDate:today(),currency:'HKD',purchased:false };
const ff = 'system-ui,-apple-system,sans-serif';

function normalizePrice(price,qty,unit,pricingType,bundleQty,buyX,getY) {
  const q=parseFloat(qty);
  if(!q||isNaN(q)||q===0) return null;
  const totalBase=q*(TO_BASE[unit]||1);
  const type=UNIT_TYPE[unit];
  const divisor=(type==='count'||type==='pack')?1:100;
  let effectivePrice=null;
  if(pricingType==='single') {
    const p=parseFloat(price);
    if(!p||isNaN(p)) return null;
    effectivePrice=p;
  } else if(pricingType==='bundle') {
    const p=parseFloat(price),b=parseFloat(bundleQty)||1;
    if(!p||isNaN(p)) return null;
    effectivePrice=p/b;
  } else if(pricingType==='buyxgety') {
    const p=parseFloat(price),x=parseFloat(buyX)||1,y=parseFloat(getY)||1;
    if(!p||isNaN(p)) return null;
    effectivePrice=(x*p)/(x+y);
  }
  if(effectivePrice===null) return null;
  return { normalized:parseFloat(((effectivePrice/totalBase)*divisor).toFixed(1)), label:BASE_LABEL[type], type };
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} };
const loadFxCache = () => { try { return JSON.parse(localStorage.getItem(FX_CACHE_KEY))||null; } catch { return null; } };
const saveFxCache = d => { try { localStorage.setItem(FX_CACHE_KEY,JSON.stringify(d)); } catch {} };
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY))||{ selectedCurrencies:DEFAULT_SELECTED,displayCurrency:'HKD' }; } catch { return { selectedCurrencies:DEFAULT_SELECTED,displayCurrency:'HKD' }; } };
const savePrefs = d => { try { localStorage.setItem(PREFS_KEY,JSON.stringify(d)); } catch {} };
const groupKey = e => e.name.trim()+'|||'+(e.brand||'').trim()+'|||'+(e.store||'').trim();

function timeAgo(dateStr) {
  const now=new Date(), then=new Date(dateStr);
  const months=Math.round((now-then)/(1000*60*60*24*30));
  if(months<1) return 'recently';
  if(months===1) return '1 month ago';
  if(months<12) return months+' months ago';
  const years=Math.floor(months/12);
  return years===1?'1 year ago':years+' years ago';
}

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

function PlusIcon() {
  return (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'>
      <line x1='12' y1='5' x2='12' y2='19'/>
      <line x1='5' y1='12' x2='19' y2='12'/>
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/>
      <polyline points='9 22 9 12 15 12 15 22'/>
    </svg>
  );
}

function NewIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
      <line x1='12' y1='5' x2='12' y2='19'/>
      <line x1='5' y1='12' x2='19' y2='12'/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='3'/>
      <path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'/>
    </svg>
  );
}

function DetailIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/>
      <polyline points='14 2 14 8 20 8'/>
      <line x1='16' y1='13' x2='8' y2='13'/>
      <line x1='16' y1='17' x2='8' y2='17'/>
    </svg>
  );
}

function MenuDotsIcon() {
  return (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
      <circle cx='5' cy='12' r='2'/>
      <circle cx='12' cy='12' r='2'/>
      <circle cx='19' cy='12' r='2'/>
    </svg>
  );
}

// Radial menu: buttons defined by page context
// buttons: array of { icon, label, onClick, angle } where angle in degrees (0=right, 90=up)
function RadialMenu({ buttons, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const RADIUS = 72;

  function getPos(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: Math.round(RADIUS * Math.cos(rad)),
      y: Math.round(RADIUS * Math.sin(rad)),
    };
  }

  return (
    <>
      {/* Overlay — captures all taps when menu open */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 299,
            background: 'rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* Radial buttons */}
      {open && buttons.map((btn, i) => {
        const pos = getPos(btn.angleDeg);
        return (
          <div
            key={i}
            onClick={() => { setOpen(false); btn.onClick(); }}
            style={{
              position: 'fixed',
              bottom: 28 + pos.y,
              right: 24 - pos.x,
              zIndex: 301,
              width: 44, height: 44, borderRadius: 22,
              background: '#fff',
              border: '1px solid #ddd',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: '#444441',
            }}
            title={btn.label}
          >
            {btn.icon}
          </div>
        );
      })}

      {/* Menu trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 24,
          width: 52, height: 52, borderRadius: 26,
          background: open ? '#666' : '#444441',
          color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 302,
          transition: 'background 0.15s',
        }}
      >
        <MenuDotsIcon />
      </button>
    </>
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

// Left strip back navigation

export default function App() {
  const [entries,setEntries] = useState(load);
  const [view,setView] = useState('record');
  const [detailKey,setDetailKey] = useState(null);
  const [vizItemName,setVizItemName] = useState(null);
  const [form,setForm] = useState(EMPTY);
  const [editId,setEditId] = useState(null);
  const [editFromDetail,setEditFromDetail] = useState(false);
  const [viewBy,setViewBy] = useState('item');
  const [filterValue,setFilterValue] = useState('__all__');
  const [filterTag,setFilterTag] = useState('__all__');
  const [vizStoreFilter,setVizStoreFilter] = useState('__all__');
  const [showPersonalization,setShowPersonalization] = useState(false);
  const [prefs,setPrefs] = useState(loadPrefs);
  const [mixedBundleMsg,setMixedBundleMsg] = useState(false);
  const [expandedCategories,setExpandedCategories] = useState({});

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
      const res=await fetch('https://api.frankfurter.dev/v1/latest?from=HKD&to=CAD,CNY,EUR,GBP,JPY,SGD,USD');
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
    normalizePrice(form.price,form.qty,form.unit,form.pricingType,form.bundleQty,form.buyX,form.getY),
    [form.price,form.qty,form.unit,form.pricingType,form.bundleQty,form.buyX,form.getY]);

  const discountInfo = useMemo(()=>{
    if(form.pricingType==='single') {
      const sp=parseFloat(form.price),op=parseFloat(form.origPrice);
      if(!sp||!op||op===0) return null;
      return { advertised:((op-sp)/op*100).toFixed(1),isHigher:sp>op };
    }
    if(form.pricingType==='bundle'||form.pricingType==='buyxgety') {
      const op=parseFloat(form.origUnitPrice);
      if(!op||op===0||!norm) return null;
      let effectiveUnitPrice=null;
      if(form.pricingType==='bundle') {
        const p=parseFloat(form.price),b=parseFloat(form.bundleQty)||1;
        if(p&&b) effectiveUnitPrice=p/b;
      } else {
        const p=parseFloat(form.price),x=parseFloat(form.buyX)||1,y=parseFloat(form.getY)||1;
        if(p) effectiveUnitPrice=(x*p)/(x+y);
      }
      if(effectiveUnitPrice===null) return null;
      return { advertised:((op-effectiveUnitPrice)/op*100).toFixed(1),isHigher:effectiveUnitPrice>op };
    }
    return null;
  },[form.price,form.origPrice,form.origUnitPrice,form.pricingType,form.bundleQty,form.buyX,form.getY,norm]);

  function handleEdit(e, fromDetail=false) {
    setForm({ name:e.name,brand:e.brand||'',store:e.store||'',tag:e.tag||'',
      pricingType:e.pricingType||'single',price:String(e.price),qty:String(e.qty),unit:e.unit,
      bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):'',
      origUnitPrice:e.origUnitPrice?String(e.origUnitPrice):'',
      buyX:String(e.buyX||2),getY:String(e.getY||1),
      note:e.note||'',priceDate:e.priceDate||today(),currency:e.currency||'HKD',purchased:e.purchased||false });
    setEditId(e.id);
    setEditFromDetail(fromDetail);
    setView('add');
  }

  function handleDuplicate(e) {
    setForm({ name:e.name,brand:e.brand||'',store:e.store||'',tag:e.tag||'',
      pricingType:e.pricingType||'single',price:String(e.price),qty:String(e.qty),unit:e.unit,
      bundleQty:String(e.bundleQty||2),origPrice:e.origPrice?String(e.origPrice):'',
      origUnitPrice:e.origUnitPrice?String(e.origUnitPrice):'',
      buyX:String(e.buyX||2),getY:String(e.getY||1),
      note:e.note||'',priceDate:today(),currency:e.currency||'HKD',purchased:false });
    setEditId(null);
    setEditFromDetail(false);
    setView('add');
  }

  function handleSave() {
    if(!form.name.trim()){ showToast('Item name is required.'); return; }
    if(!form.price){ showToast('Price is required.'); return; }
    if(!form.qty||!form.unit){ showToast('Package size and unit are required.'); return; }
    if(form.pricingType==='bundle'&&(!form.bundleQty||parseFloat(form.bundleQty)<2)){ showToast('Bundle requires 2 or more packs.'); return; }
    if(form.pricingType==='buyxgety'){
      const x=parseFloat(form.buyX),y=parseFloat(form.getY);
      if(!x||!y||x<1||y<1||!Number.isInteger(x)||!Number.isInteger(y)){ showToast('Buy X Get Y requires whole numbers ≥ 1.'); return; }
    }
    const effectiveDate=form.priceDate||today();
    const entryData={
      name:form.name.trim(),brand:form.brand.trim(),store:form.store.trim(),tag:form.tag.trim(),
      pricingType:form.pricingType,price:parseFloat(form.price),qty:parseFloat(form.qty),unit:form.unit,
      bundleQty:form.pricingType==='bundle'?parseFloat(form.bundleQty):1,
      buyX:form.pricingType==='buyxgety'?parseFloat(form.buyX):null,
      getY:form.pricingType==='buyxgety'?parseFloat(form.getY):null,
      origPrice:form.pricingType==='single'&&form.origPrice?parseFloat(form.origPrice):null,
      origUnitPrice:(form.pricingType==='bundle'||form.pricingType==='buyxgety')&&form.origUnitPrice?parseFloat(form.origUnitPrice):null,
      note:form.note.trim(),date:effectiveDate,priceDate:form.priceDate||null,createdAt:today(),
      currency:form.currency||'HKD',purchased:form.purchased||false,
      normalized:norm?norm.normalized:null,normLabel:norm?norm.label:null,
    };
    if(editId){
      setEntries(prev=>prev.map(e=>e.id===editId?{...entryData,id:editId}:e));
      showToast('Record updated!');
      setEditId(null);
      if(editFromDetail){ setView('detail'); setEditFromDetail(false); }
      else { setView('record'); }
    } else {
      setEntries(prev=>[{...entryData,id:Date.now()},...prev]);
      showToast('Entry saved!');
      setView('record');
    }
    setForm(EMPTY);
  }

  function handleCancel() {
    setForm(EMPTY);
    setEditId(null);
    if(editFromDetail){ setView('detail'); setEditFromDetail(false); }
    else { setView('record'); }
  }

  function competitionInfo(itemName, myDispNorm, myUnit) {
    if(myDispNorm==null) return null;
    const myUnitType=UNIT_TYPE[myUnit];
    const sameItem=entries.filter(e=>e.name===itemName&&!e.purchased&&e.normalized&&UNIT_TYPE[e.unit]===myUnitType);
    // latest record per brand+store group
    const latestPerGroup={};
    sameItem.forEach(e=>{
      const k=groupKey(e);
      if(!latestPerGroup[k]||e.date>latestPerGroup[k].date) latestPerGroup[k]=e;
    });
    const all=Object.values(latestPerGroup).map(e=>({ ...e,dn:parseFloat(toDisplay(toHKD(e.normalized,e.currency||'HKD')).toFixed(1)) }));
    if(all.length<=1) return null;
    const minNorm=Math.min(...all.map(e=>e.dn));
    const isLowest=Math.abs(myDispNorm-minNorm)<0.05;
    const cheapest=all.find(e=>Math.abs(e.dn-minNorm)<0.05);
    return { isLowest,cheapestLabel:(cheapest?.brand?cheapest.brand+' @ ':'')+( cheapest?.store||''),minNorm,cheapestGk:cheapest?groupKey(cheapest):null };
  }

  function getHeadlineEntry(gEntries) {
    const nonPurchased=gEntries.filter(e=>!e.purchased);
    return nonPurchased.length>0?nonPurchased[0]:gEntries[0];
  }

  function getHistoricalLow(gEntries, headlineDispNorm) {
    const withNorm=gEntries.filter(e=>e.normalized);
    if(withNorm.length<=1) return null;
    const dispNorms=withNorm.map(e=>({ e,dn:dispNormOf(e) })).filter(x=>x.dn!=null);
    const minDn=Math.min(...dispNorms.map(x=>x.dn));
    if(Math.abs(minDn-(headlineDispNorm||0))<0.05) return null;
    const lowEntry=dispNorms.find(x=>Math.abs(x.dn-minDn)<0.05);
    return { dn:minDn, date:lowEntry?.e.date };
  }

  function isHistoricalLowEntry(e, gEntries) {
    const withNorm=gEntries.filter(x=>x.normalized);
    if(withNorm.length<=1) return false;
    const dispNorms=withNorm.map(x=>dispNormOf(x)).filter(v=>v!=null);
    const minDn=Math.min(...dispNorms);
    const eDn=dispNormOf(e);
    return eDn!=null&&Math.abs(eDn-minDn)<0.05;
  }

  // Obs 7: intelligence banner content for detail page
  function bannerContent(gEntries) {
    const itemName=gEntries[0]?.name;
    const currentGk=groupKey(gEntries[0]);
    const currentStore=gEntries[0]?.store||'';
    const currentBrand=gEntries[0]?.brand||'';
    const myUnitType=UNIT_TYPE[gEntries[0]?.unit];

    // all groups for same item, matching unit type
    const sameItemGroups={};
    entries.filter(e=>e.name===itemName&&UNIT_TYPE[e.unit]===myUnitType).forEach(e=>{
      const k=groupKey(e);
      if(!sameItemGroups[k]) sameItemGroups[k]=[];
      sameItemGroups[k].push(e);
    });
    const allGroupKeys=Object.keys(sameItemGroups);
    const multiStore=allGroupKeys.length>1;

    // latest per group
    const latestPerGroup={};
    allGroupKeys.forEach(k=>{
      const sorted=[...sameItemGroups[k]].sort((a,b)=>b.date.localeCompare(a.date));
      latestPerGroup[k]=sorted[0];
    });

    const currentLatest=latestPerGroup[currentGk]||gEntries[0];
    const currentDn=dispNormOf(currentLatest);
    const normLabel=currentLatest?.normLabel||'';

    // historical low within this group
    const withNorm=gEntries.filter(e=>e.normalized);
    const allDns=withNorm.map(e=>({ e,dn:dispNormOf(e) })).filter(x=>x.dn!=null);
    const minDn=allDns.length?Math.min(...allDns.map(x=>x.dn)):null;
    const lowEntry=allDns.find(x=>Math.abs(x.dn-minDn)<0.05);
    const isCurrentLow=currentDn!=null&&minDn!=null&&Math.abs(currentDn-minDn)<0.05;

    // Scenario 1: single record, single store
    if(!multiStore&&withNorm.length<=1) {
      const e=gEntries[0];
      return 'Last seen'+(currentStore?' at '+currentStore:'')+' — '+currSymbol+(currentDn||'—')+(normLabel?' '+normLabel:'')+', '+timeAgo(e?.date);
    }

    // Scenario 2: multiple records, single store
    if(!multiStore) {
      if(isCurrentLow) {
        return 'Record low at '+(currentStore||'this store')+' — '+currSymbol+minDn+(normLabel?' '+normLabel:'')+', last seen '+timeAgo(lowEntry?.e.date);
      }
      return 'Price at '+(currentStore||'this store')+' is up from the record low of '+currSymbol+minDn+(normLabel?' '+normLabel:'')+', last seen '+timeAgo(lowEntry?.e.date);
    }

    // multi-store: find cheapest latest
    const allLatest=Object.values(latestPerGroup).filter(e=>e.normalized);
    const allLatestDns=allLatest.map(e=>({ e,dn:dispNormOf(e) })).filter(x=>x.dn!=null);
    if(!allLatestDns.length) return 'No price data available.';
    const cheapestDn=Math.min(...allLatestDns.map(x=>x.dn));
    const cheapestEntry=allLatestDns.find(x=>Math.abs(x.dn-cheapestDn)<0.05)?.e;
    const cheapestGk=cheapestEntry?groupKey(cheapestEntry):null;
    const isThisCheapest=cheapestGk===currentGk;
    const cheapestLabel=(cheapestEntry?.brand?cheapestEntry.brand+' @ ':'')+( cheapestEntry?.store||'');

    // Scenario 3/4: multiple stores
    if(isThisCheapest) {
      return 'Record low at '+(currentStore||'this store')+' — '+currSymbol+minDn+(normLabel?' '+normLabel:'')+', last seen '+timeAgo(lowEntry?.e.date);
    }
    return 'Better deal at '+cheapestLabel+' — '+currSymbol+cheapestDn+(cheapestEntry?.normLabel?' '+cheapestEntry.normLabel:'')+', seen '+timeAgo(cheapestEntry?.date)+' vs '+currSymbol+(currentDn||'—')+' at '+(currentStore||'here');
  }

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
    Object.values(map).forEach(arr=>arr.sort((a,b)=>b.date.localeCompare(a.date)));
    // Sort groups: A-Z by item name, then by most recent date within same name
    return Object.entries(map).sort((a,b)=>{
      const nameA=a[1][0].name.toLowerCase();
      const nameB=b[1][0].name.toLowerCase();
      if(nameA!==nameB) return nameA.localeCompare(nameB);
      return b[1][0].date.localeCompare(a[1][0].date);
    });
  },[entries,filterValue,viewBy,filterTag]);

  // Section → Category → grouped items structure
  const groupedBySectionCategory = useMemo(()=>{
    const sectionCatMap={};
    grouped.forEach(([gk,gEntries])=>{
      const tag=gEntries[0]?.tag||'';
      const section=getSectionForTag(tag);
      const sectionName=section.name;
      const catName=tag||'Untagged';
      if(!sectionCatMap[sectionName]) sectionCatMap[sectionName]={ section, categories:{} };
      if(!sectionCatMap[sectionName].categories[catName]) sectionCatMap[sectionName].categories[catName]=[];
      sectionCatMap[sectionName].categories[catName].push([gk,gEntries]);
    });

    // Sort categories A-Z within each section
    const ordered=[];
    [...SECTION_MAP,SECTION_OTHER].forEach(s=>{
      if(sectionCatMap[s.name]){
        const sortedCats={};
        Object.keys(sectionCatMap[s.name].categories).sort((a,b)=>a.localeCompare(b)).forEach(k=>{
          sortedCats[k]=sectionCatMap[s.name].categories[k];
        });
        ordered.push({ section:s, categories:sortedCats });
      }
    });
    return ordered;
  },[grouped]);

  // detail page entries
  const detailEntries = useMemo(()=>{
    if(!detailKey) return [];
    return entries.filter(e=>groupKey(e)===detailKey).sort((a,b)=>b.date.localeCompare(a.date));
  },[entries,detailKey]);

  // viz chart data
  const vizEntries = useMemo(()=>{
    if(!vizItemName) return [];
    let src=entries.filter(e=>e.name===vizItemName&&e.normalized);
    if(vizStoreFilter!=='__all__') src=src.filter(e=>e.store===vizStoreFilter);
    return src;
  },[entries,vizItemName,vizStoreFilter]);

  const vizStores = useMemo(()=>{
    if(!vizItemName) return [];
    return [...new Set(entries.filter(e=>e.name===vizItemName).map(e=>e.store).filter(Boolean))].sort();
  },[entries,vizItemName]);

  const vizChartData = useMemo(()=>{
    const byStore={};
    vizEntries.forEach(e=>{
      const k=e.store||'Unknown';
      const converted=parseFloat(toDisplay(toHKD(e.normalized,e.currency||'HKD')).toFixed(1));
      if(!byStore[k]) byStore[k]={};
      if(!byStore[k][e.date]) byStore[k][e.date]=[];
      byStore[k][e.date].push(converted);
    });
    const dates=[...new Set(vizEntries.map(e=>e.date))].sort();
    return dates.map(d=>{
      const row={date:d};
      Object.keys(byStore).forEach(k=>{ if(byStore[k][d]) row[k]=parseFloat((byStore[k][d].reduce((a,b)=>a+b,0)/byStore[k][d].length).toFixed(1)); });
      return row;
    });
  },[vizEntries,fxRates,displayCurrency]);

  const vizChartKeys = useMemo(()=>[...new Set(vizEntries.map(e=>e.store||'Unknown'))].sort(),[vizEntries]);

  const vizChartMin = useMemo(()=>{
    const vals=vizChartData.flatMap(d=>vizChartKeys.map(k=>d[k]).filter(v=>v!=null));
    if(!vals.length) return 'auto';
    return parseFloat((Math.min(...vals)*0.9).toFixed(1));
  },[vizChartData,vizChartKeys]);

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
    const now=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const filename='TruPrice_'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds())+'.json';
    const blob=new Blob([JSON.stringify(entries,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  }

  function handleImport(e) {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ try { const d=JSON.parse(ev.target.result); if(Array.isArray(d)){ setEntries(d); showToast('Imported '+d.length+' entries.'); } else showToast('Invalid file.'); } catch { showToast('Failed to read file.'); } };
    r.readAsText(file); e.target.value='';
  }

  function navigateToDetail(gk) { setDetailKey(gk); setView('detail'); }
  function navigateToRecord() { setView('record'); setDetailKey(null); }
  function navigateToViz(itemName) { setVizItemName(itemName); setVizStoreFilter('__all__'); setView('viz'); }

  const fxUpdatedLabel=fxUpdated?new Date(fxUpdated).toLocaleDateString():null;

  // responsive max width
  const isTablet = typeof window!=='undefined'&&window.innerWidth>=600&&window.innerWidth<1024;

  const inp={ padding:'7px 10px',border:'1px solid #aaa',borderRadius:8,background:'#fff',color:'#222',fontSize:14,width:'100%',boxSizing:'border-box',fontFamily:ff };
  const lbl=(t,req)=>(<label style={{fontSize:12,color:'#666',display:'block',marginBottom:3,fontFamily:ff}}>{t}{req&&<span style={{color:'red',marginLeft:2}}>*</span>}</label>);
  const field=(children,cols)=>(<div style={{display:'grid',gridTemplateColumns:cols||'1fr',gap:10,marginBottom:12}}>{children}</div>);
  const toggleBtn=active=>({ padding:'5px 14px',fontSize:12,cursor:'pointer',borderRadius:6,border:active?'1px solid #444441':'1px solid #aaa',background:active?'#444441':'transparent',color:active?'#fff':'#666',fontFamily:ff });

  const containerPad='1rem 0.75rem';

  return (
    <div style={{padding:containerPad,maxWidth:isTablet?900:'100%',margin:'0 auto',fontFamily:ff,boxSizing:'border-box'}}>
      {toast&&<div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#fff',border:'1px solid #ccc',borderRadius:8,padding:'10px 20px',fontSize:13,zIndex:999,color:'#222',whiteSpace:'nowrap',fontFamily:ff}}>{toast}</div>}

      {/* ── RECORD VIEW ── */}
      {view==='record'&&(
        <div>
          {/* Header */}
          <div style={{textAlign:'center',marginBottom:14,position:'relative'}}>
            <span style={{fontSize:13,color:'#444441',fontFamily:ff}}>TruPrice - Your Grocery Shopping Companion</span>
            <button onClick={()=>setShowPersonalization(p=>!p)} style={{position:'absolute',right:0,top:0,background:'none',border:'none',cursor:'pointer',color:showPersonalization?'#444441':'#aaa',padding:4}}>
              <UserIcon/>
            </button>
            <span style={{position:'absolute',left:0,bottom:-12,fontSize:10,color:'#ccc',fontFamily:ff}}>v2.0</span>
          </div>

          {/* Personalization */}
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

          {/* Currency + FX strip */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:'#f9f9f9',border:'1px solid #eee',borderRadius:8}}>
            <span style={{fontSize:12,color:'#666',fontFamily:ff}}>Display:</span>
            {selectedCurrencies.map(c=>(<button key={c} onClick={()=>updatePrefs({ displayCurrency:c })} style={{...toggleBtn(displayCurrency===c),padding:'4px 10px',fontSize:12}}>{c}</button>))}
            <button onClick={fetchFx} disabled={fxLoading} style={{marginLeft:'auto',fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #aaa',background:'transparent',color:'#666',cursor:'pointer',fontFamily:ff}}>{fxLoading?'...':'Rates'}</button>
            {fxUpdatedLabel&&<span style={{fontSize:10,color:'#aaa',fontFamily:ff}}>{fxUpdatedLabel}</span>}
          </div>
          {fxError&&<div style={{fontSize:12,color:'#c0392b',marginBottom:10,fontFamily:ff}}>{fxError}</div>}

          {/* Filters — Category first, then View by + Filter */}
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <label style={{fontSize:12,color:'#666',whiteSpace:'nowrap',fontFamily:ff}}>Category:</label>
            <select style={{...inp,width:'auto',minWidth:110,flex:1}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
              <option value='__all__'>All categories</option>
              {userTags.filter(t=>entries.some(e=>e.tag===t)).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
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
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:14}}>
            <button onClick={handleExport} style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:'1px solid #aaa',background:'transparent',color:'#666',fontFamily:ff}}>Export</button>
            <label style={{padding:'6px 14px',fontSize:13,cursor:'pointer',borderRadius:8,border:'1px solid #aaa',background:'transparent',color:'#666',fontFamily:ff}}>Import<input type='file' accept='.json' style={{display:'none'}} onChange={handleImport}/></label>
          </div>

          {grouped.length===0&&<p style={{color:'#888',fontSize:14,fontFamily:ff}}>No entries yet. Tap + to add your first item.</p>}

          {groupedBySectionCategory.map(({section,categories})=>{
            const sectionItemCount=Object.values(categories).reduce((sum,grps)=>sum+grps.length,0);
            return (
              <div key={section.name}>
                {/* Section separator */}
                <div style={{display:'flex',alignItems:'center',gap:8,margin:'16px 0 10px',fontFamily:ff}}>
                  <div style={{flex:1,height:'1px',background:'#e0e0e0'}}/>
                  <span style={{fontSize:11,color:'#aaa',whiteSpace:'nowrap'}}>{section.name} ({sectionItemCount})</span>
                  <div style={{flex:1,height:'1px',background:'#e0e0e0'}}/>
                </div>

                {/* Categories */}
                {Object.entries(categories).map(([catName,catGroups])=>{
                  const catKey=section.name+'|||'+catName;
                  const isExpanded=!!expandedCategories[catKey];
                  return (
                    <div key={catKey} style={{marginBottom:6}}>
                      {/* Category row */}
                      <div
                        onClick={()=>setExpandedCategories(prev=>({...prev,[catKey]:!prev[catKey]}))}
                        style={{
                          display:'flex',alignItems:'center',gap:10,
                          background:'#fafafa',
                          border:'1px solid #eee',
                          borderRadius:isExpanded?'8px 8px 0 0':'8px',
                          cursor:'pointer',
                          padding:'10px 14px 10px 10px',
                        }}
                      >
                        <div style={{width:10,height:10,borderRadius:5,background:section.color,flexShrink:0}}/>
                        <span style={{flex:1,fontSize:13,color:'#444',fontFamily:ff,fontWeight:500}}>{catName}</span>
                        <span style={{fontSize:11,color:'#aaa',fontFamily:ff}}>{catGroups.length} item{catGroups.length!==1?'s':''}</span>
                        <span style={{fontSize:11,color:'#aaa'}}>{isExpanded?'▼':'▶'}</span>
                      </div>

                      {/* Items within category */}
                      {isExpanded&&(
                        <div style={{marginTop:6}}>
                          {catGroups.map(([gk,gEntries])=>{
                            const latest=gEntries[0];
                            const headline=getHeadlineEntry(gEntries);
                            const headlineDispNorm=dispNormOf(headline);
                            const headlineCurr=headline.currency||'HKD';
                            const headlineSymbol=CURRENCY_SYMBOLS[headlineCurr]||headlineCurr;
                            const headlineDispPrice=parseFloat(convertPrice(headline.price,headlineCurr).toFixed(2));
                            const histLow=getHistoricalLow(gEntries,headlineDispNorm);
                            const comp=competitionInfo(latest.name,headlineDispNorm,headline.unit);
                            const summaryRows=gEntries.slice(1,3);
                            const moreCount=gEntries.length>3?gEntries.length-3:0;

                            return (
                              <div key={gk} style={{background:comp?.isLowest?'#f0faf4':'#fff',border:'1px solid '+(comp?.isLowest?'#a8d5b5':'#ddd'),borderRadius:12,marginBottom:8,display:'flex',alignItems:'stretch'}}>
                                <div style={{width:4,background:section.color,flexShrink:0,margin:'8px 0 8px 8px',borderRadius:2}}/>
                                <div style={{flex:1,padding:'12px 14px'}}>
                                {/* Headline */}
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                                  <span style={{fontWeight:500,fontSize:15,fontFamily:ff}}>{latest.name}</span>
                                  <span style={{fontSize:12,color:'#888',fontFamily:ff,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:4}}>
                                    {latest.date}{headline.purchased&&<BagIcon size={11} color='#aaa'/>}
                                  </span>
                                </div>
                                {(latest.store||latest.brand)&&(
                                  <div style={{fontSize:11,color:'#999',fontFamily:ff,marginTop:2,display:'flex',gap:12}}>
                                    {latest.store&&<span>Store: {latest.store}</span>}
                                    {latest.brand&&<span>Brand: {latest.brand}</span>}
                                  </div>
                                )}
                                {latest.pricingType==='bundle'&&<span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:'#fff8e1',color:'#b26a00',fontFamily:ff,display:'inline-block',marginTop:4}}>bundle x{latest.bundleQty}</span>}
                                {latest.pricingType==='buyxgety'&&<span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:'#fff8e1',color:'#b26a00',fontFamily:ff,display:'inline-block',marginTop:4}}>buy {latest.buyX} get {latest.getY} free</span>}

                                <div style={{display:'flex',gap:16,marginTop:6,flexWrap:'wrap',fontSize:13,fontFamily:ff,alignItems:'center'}}>
                                  <span><span style={{color:'#888'}}>Price: </span>{headlineCurr===displayCurrency?headlineSymbol+headline.price.toFixed(2):headlineSymbol+headline.price.toFixed(2)+' ('+currSymbol+headlineDispPrice+')'}</span>
                                  <span><span style={{color:'#888'}}>Size: </span>{headline.qty}{headline.unit}</span>
                                  {headlineDispNorm!=null&&<span style={{color:'#1a73e8',fontWeight:500}}>{currSymbol}{headlineDispNorm} {headline.normLabel}</span>}
                                </div>
                                {histLow&&<div style={{fontSize:11,color:'#888',marginTop:4,fontFamily:ff}}>Record Low: {currSymbol}{histLow.dn} · {histLow.date}</div>}
                                {comp&&!comp.isLowest&&<div style={{fontSize:11,color:'#888',marginTop:2,fontFamily:ff}}>Cheaper: {comp.cheapestLabel} at {currSymbol}{comp.minNorm.toFixed(1)} {headline.normLabel}</div>}
                                {comp?.isLowest&&<div style={{fontSize:11,color:'#1e7e34',marginTop:2,fontFamily:ff}}>Best price among stores</div>}

                                {/* Summary table */}
                                {summaryRows.length>0&&(
                                  <div onClick={()=>navigateToDetail(gk)} style={{marginTop:8,borderTop:'1px solid #f0f0f0',paddingTop:8,cursor:'pointer'}}>
                                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:ff,tableLayout:'fixed'}}>
                                      <colgroup><col style={{width:'28%'}}/><col style={{width:'42%'}}/><col style={{width:'30%'}}/></colgroup>
                                      <tbody>
                                        {summaryRows.map(e=>{
                                          const eDn=dispNormOf(e);
                                          const isLow=isHistoricalLowEntry(e,gEntries);
                                          return (
                                            <tr key={e.id} style={{background:isLow?'#edfbf3':'transparent'}}>
                                              <td style={{padding:'4px 6px 4px 0',color:'#666',whiteSpace:'nowrap',overflow:'hidden'}}>
                                                {e.date}{e.purchased&&<span style={{marginLeft:4,display:'inline-flex',verticalAlign:'middle'}}><BagIcon size={11} color='#aaa'/></span>}
                                              </td>
                                              <td style={{padding:'4px 6px',color:'#aaa',fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.note||''}</td>
                                              <td style={{padding:'4px 0 4px 6px',textAlign:'right',color:'#1a73e8',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden'}}>{eDn!=null?currSymbol+eDn+' '+(e.normLabel||''):'—'}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    {moreCount>0&&<div style={{fontSize:11,color:'#888',marginTop:4,textAlign:'right',fontFamily:ff,textDecoration:'underline',cursor:'pointer'}}>and {moreCount} more...</div>}
                                  </div>
                                )}

                                {/* Single record — See detail */}
                                {gEntries.length===1&&(
                                  <div onClick={()=>navigateToDetail(gk)} style={{marginTop:8,borderTop:'1px solid #f0f0f0',paddingTop:8,cursor:'pointer',textAlign:'right'}}>
                                    <span style={{fontSize:11,color:'#888',fontFamily:ff,textDecoration:'underline'}}>See detail...</span>
                                  </div>
                                )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Floating + button */}
          <button
            onClick={()=>{ setForm(EMPTY); setEditId(null); setView('add'); }}
            style={{
              position:'fixed',bottom:28,right:24,
              width:52,height:52,borderRadius:26,
              background:'#444441',color:'#fff',
              border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
              zIndex:200,
            }}
          >
            <PlusIcon/>
          </button>
        </div>
      )}

      {/* ── ADD / EDIT VIEW ── */}
      {view==='add'&&(
        <div>
          {/* Header — same as Record view for seamless transition */}
          <div style={{textAlign:'center',marginBottom:14,position:'relative'}}>
            <span style={{fontSize:13,color:'#444441',fontFamily:ff}}>TruPrice - Your Grocery Shopping Companion</span>
            <button onClick={()=>setShowPersonalization(p=>!p)} style={{position:'absolute',right:0,top:0,background:'none',border:'none',cursor:'pointer',color:showPersonalization?'#444441':'#aaa',padding:4}}>
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

          <div>
            <p style={{fontSize:13,color:editId?'#1a73e8':'#444441',marginBottom:4,marginTop:0,fontFamily:ff}}>
              {editId?'Editing existing record':'New Entry'}
            </p>
            <p style={{fontSize:11,color:'#aaa',marginBottom:12,marginTop:0,fontFamily:ff}}>Fields marked * are required</p>

            {/* Item name */}
            <div style={{marginBottom:12}}>
              {lbl('Item name',true)}
              <AutocompleteInput value={form.name} onChange={v=>setF('name',v)} suggestions={itemNames} placeholder='Type or select a previous item' style={inp}/>
            </div>

            {/* Category */}
            <div style={{marginBottom:12}}>
              {lbl('Category')}
              <AutocompleteInput value={form.tag} onChange={v=>setF('tag',v)} suggestions={userTags} placeholder='e.g. Fruits' style={inp}/>
            </div>

            {/* Brand + Store */}
            {field(<>
              <div>{lbl('Brand')}<AutocompleteInput value={form.brand} onChange={v=>setF('brand',v)} suggestions={brandNames} placeholder='e.g. Quaker' style={inp}/></div>
              <div>{lbl('Store')}<AutocompleteInput value={form.store} onChange={v=>setF('store',v)} suggestions={storeNames} placeholder='e.g. Walmart' style={inp}/></div>
            </>,'1fr 1fr')}

            {/* Price date + Purchased on same row */}
            <div style={{display:'flex',gap:20,marginBottom:12,alignItems:'flex-end'}}>
              <div style={{flex:'0 0 auto'}}>
                {lbl('Price date')}
                <input style={{...inp,width:'auto'}} type='date' value={form.priceDate} onChange={e=>setF('priceDate',e.target.value)}/>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#666',cursor:'pointer',fontFamily:ff,paddingBottom:8,whiteSpace:'nowrap'}}>
                <input type='checkbox' checked={form.purchased} onChange={e=>setF('purchased',e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/>
                Purchased?
              </label>
            </div>

            {/* Pricing type — all 4 on one row */}
            <div style={{marginBottom:12}}>
              {lbl('Pricing type',true)}
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                {[{key:'single',label:'Single'},{key:'bundle',label:'Bundle'},{key:'buyxgety',label:'Buy X Get Y'}].map(t=>(
                  <button key={t.key} onClick={()=>setF('pricingType',t.key)} style={{padding:'7px 12px',fontSize:12,cursor:'pointer',borderRadius:8,border:form.pricingType===t.key?'1px solid #444441':'1px solid #aaa',background:form.pricingType===t.key?'#444441':'transparent',color:form.pricingType===t.key?'#fff':'#666',fontFamily:ff}}>{t.label}</button>
                ))}
                <button onClick={()=>setMixedBundleMsg(m=>!m)} style={{padding:'7px 12px',fontSize:12,cursor:'not-allowed',borderRadius:8,border:'1px solid #ddd',background:'#f5f5f5',color:'#bbb',fontFamily:ff}}>Mixed Bundle</button>
              </div>
              {mixedBundleMsg&&<p style={{fontSize:12,color:'#aaa',margin:'6px 0 0',fontFamily:ff}}>This feature is under development.</p>}
            </div>

            {/* Currency */}
            <div style={{marginBottom:12}}>
              {lbl('Currency')}
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {selectedCurrencies.map(c=>(<button key={c} onClick={()=>setF('currency',c)} style={{padding:'6px 12px',fontSize:12,cursor:'pointer',borderRadius:8,border:form.currency===c?'1px solid #444441':'1px solid #aaa',background:form.currency===c?'#444441':'transparent',color:form.currency===c?'#fff':'#666',fontFamily:ff}}>{c}</button>))}
              </div>
            </div>

            {/* Single pricing */}
            {form.pricingType==='single'&&(
              field(<>
                <div>{lbl('Price',true)}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.price} onChange={v=>setF('price',v)} placeholder='e.g. 4.99'/></div>
                <div>{lbl('Original / listed price')}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.origPrice} onChange={v=>setF('origPrice',v)} placeholder='e.g. 6.99'/></div>
              </>,'1fr 1fr')
            )}

            {/* Bundle pricing */}
            {form.pricingType==='bundle'&&(
              <div style={{background:'#f9f9f9',border:'1px solid #ddd',borderRadius:8,padding:'10px 12px',marginBottom:12}}>
                {field(<>
                  <div>{lbl('Total bundle price',true)}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.price} onChange={v=>setF('price',v)} placeholder='e.g. 9.99'/></div>
                  <div>{lbl('Packs in bundle',true)}<ClearableInput style={inp} type='number' min='2' step='1' value={form.bundleQty} onChange={v=>setF('bundleQty',v)} placeholder='e.g. 2'/></div>
                </>,'1fr 1fr')}
                {form.price&&form.bundleQty&&<p style={{fontSize:12,color:'#666',margin:'4px 0 8px',fontFamily:ff}}>Price per pack: {CURRENCY_SYMBOLS[form.currency]||form.currency}{(parseFloat(form.price)/parseFloat(form.bundleQty)).toFixed(2)}</p>}
                <div>{lbl('Original unit price')}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.origUnitPrice} onChange={v=>setF('origUnitPrice',v)} placeholder='e.g. 6.99 per pack'/></div>
              </div>
            )}

            {/* Buy X Get Y pricing */}
            {form.pricingType==='buyxgety'&&(
              <div style={{background:'#f9f9f9',border:'1px solid #ddd',borderRadius:8,padding:'10px 12px',marginBottom:12}}>
                {field(<>
                  <div>{lbl('Regular unit price',true)}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.price} onChange={v=>setF('price',v)} placeholder='e.g. 15.00'/></div>
                  <div>{lbl('Original unit price')}<ClearableInput style={inp} type='number' min='0' step='0.01' value={form.origUnitPrice} onChange={v=>setF('origUnitPrice',v)} placeholder='e.g. 18.00'/></div>
                </>,'1fr 1fr')}
                {field(<>
                  <div>{lbl('Buy (X)',true)}<ClearableInput style={inp} type='number' min='1' step='1' value={form.buyX} onChange={v=>setF('buyX',v)} placeholder='e.g. 3'/></div>
                  <div>{lbl('Get (Y) free',true)}<ClearableInput style={inp} type='number' min='1' step='1' value={form.getY} onChange={v=>setF('getY',v)} placeholder='e.g. 1'/></div>
                </>,'1fr 1fr')}
                {form.price&&form.buyX&&form.getY&&(
                  <p style={{fontSize:12,color:'#666',margin:'4px 0 0',fontFamily:ff}}>
                    Effective price per unit: {CURRENCY_SYMBOLS[form.currency]||form.currency}{((parseFloat(form.buyX)*parseFloat(form.price))/(parseFloat(form.buyX)+parseFloat(form.getY))).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Package size + Unit */}
            {field(<>
              <div>{lbl('Package size',true)}<ClearableInput style={inp} type='number' min='0' step='any' value={form.qty} onChange={v=>setF('qty',v)} placeholder='e.g. 500'/></div>
              <div>{lbl('Unit',true)}
                <select style={inp} value={form.unit} onChange={e=>setF('unit',e.target.value)}>
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

            {/* Note */}
            <div style={{marginBottom:12}}>{lbl('Note')}<ClearableInput style={inp} value={form.note} onChange={v=>setF('note',v)} placeholder='Optional note'/></div>

            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={handleCancel} style={{padding:'9px 20px',background:'transparent',color:'#666',border:'1px solid #aaa',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:ff}}>Cancel</button>
              <button onClick={handleSave} style={{padding:'9px 20px',background:'#444441',color:'#fff',border:'1px solid #444441',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:500,fontFamily:ff}}>{editId?'Update':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {view==='detail'&&detailEntries.length>0&&(()=>{
        const gEntries=detailEntries;
        const banner=bannerContent(gEntries);
        const headline=gEntries[0];

        return (
          <div style={{paddingBottom:80}}>
            {/* Full header */}
            <div style={{textAlign:'center',marginBottom:14,position:'relative'}}>
              <span style={{fontSize:13,color:'#444441',fontFamily:ff}}>TruPrice - Your Grocery Shopping Companion</span>
              <button onClick={()=>setShowPersonalization(p=>!p)} style={{position:'absolute',right:0,top:0,background:'none',border:'none',cursor:'pointer',color:showPersonalization?'#444441':'#aaa',padding:4}}>
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
            {/* Unified header: item name + store/brand + intelligence summary — fully tappable → viz */}
            <div
              onClick={()=>navigateToViz(headline.name)}
              style={{
                background:'#f9f9f9',
                border:'1px solid #eee',
                borderRadius:12,
                padding:'12px 16px',
                marginBottom:12,
                cursor:'pointer',
              }}
            >
              <div style={{fontWeight:600,fontSize:16,fontFamily:ff,marginBottom:2}}>{headline.name}</div>
              <div style={{fontSize:12,color:'#888',fontFamily:ff,display:'flex',gap:12,flexWrap:'wrap',marginBottom:6}}>
                {headline.store&&<span>Store: {headline.store}</span>}
                {headline.brand&&<span>Brand: {headline.brand}</span>}
                {headline.tag&&<span>Tag: {headline.tag}</span>}
              </div>
              <div style={{fontSize:12,color:'#444',fontFamily:ff}}>{banner}</div>
              <div style={{fontSize:10,color:'#aaa',fontFamily:ff,marginTop:4}}>Tap to view price chart →</div>
            </div>

            {/* Price history cards */}
            <div style={{fontSize:11,color:'#aaa',fontFamily:ff,marginBottom:8}}>Price history · {gEntries.length} records</div>
            {gEntries.map(e=>{
              const eCurr=e.currency||'HKD';
              const eSymbol=CURRENCY_SYMBOLS[eCurr]||eCurr;
              const eDn=dispNormOf(e);
              const isLow=isHistoricalLowEntry(e,gEntries);
              return (
                <div key={e.id} style={{
                  background:isLow?'#edfbf3':'#fff',
                  border:'1px solid '+(isLow?'#a8d5b5':'#ddd'),
                  borderRadius:10,
                  padding:'10px 14px',
                  marginBottom:8,
                }}>
                  {/* Date + purchased + record low badge + normalized */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:13,color:'#444',fontFamily:ff,fontWeight:500}}>{e.date}</span>
                      {e.purchased&&<BagIcon size={14} color='#888'/>}
                      {isLow&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:'#1e7e34',color:'#fff',fontFamily:ff}}>Record Low</span>}
                    </div>
                    <span style={{fontSize:13,color:'#1a73e8',fontWeight:500,fontFamily:ff}}>{eDn!=null?currSymbol+eDn+' '+(e.normLabel||''):'—'}</span>
                  </div>
                  {/* Price + size + pricing badge + note inline, wrapping freely */}
                  <div style={{fontSize:12,color:'#666',fontFamily:ff}}>
                    <span>{eSymbol}{e.price.toFixed(2)}</span>
                    <span style={{marginLeft:12,color:'#aaa'}}>{e.qty}{e.unit}</span>
                    {e.pricingType==='bundle'&&<span style={{marginLeft:8,fontSize:11,color:'#b26a00'}}>bundle x{e.bundleQty}</span>}
                    {e.pricingType==='buyxgety'&&<span style={{marginLeft:8,fontSize:11,color:'#b26a00'}}>buy {e.buyX} get {e.getY} free</span>}
                    {e.note&&<span style={{marginLeft:8,fontSize:11,color:'#999',fontStyle:'italic'}}>{e.note}</span>}
                  </div>
                  {/* Actions */}
                  <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
                    <button
                      onClick={()=>handleEdit(e,true)}
                      style={{fontSize:11,padding:'3px 10px',border:'1px solid '+(isLow?'#a8d5b5':'#ddd'),borderRadius:5,background:'transparent',color:isLow?'#1e7e34':'#888',cursor:'pointer',fontFamily:ff}}
                    >Edit</button>
                    <button
                      onClick={()=>{
                        if(window.confirm('Delete this record?')){
                          const remaining=entries.filter(x=>x.id!==e.id);
                          setEntries(remaining);
                          const stillExists=remaining.some(x=>groupKey(x)===detailKey);
                          if(!stillExists) navigateToRecord();
                        }
                      }}
                      style={{fontSize:11,padding:'3px 10px',border:'1px solid #f5c6c6',borderRadius:5,background:'transparent',color:'#c0392b',cursor:'pointer',fontFamily:ff}}
                    >Delete</button>
                  </div>
                </div>
              );
            })}
            {/* Group actions */}
            <div style={{marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
              <button onClick={()=>handleDuplicate(gEntries[0])} style={{fontSize:12,padding:'5px 14px',border:'1px solid #aaa',borderRadius:6,background:'transparent',color:'#444',cursor:'pointer',fontFamily:ff}}>Duplicate latest</button>
              <button
                onClick={()=>{
                  if(window.confirm('Delete all '+gEntries.length+' records for this item?')){
                    setEntries(prev=>prev.filter(x=>groupKey(x)!==detailKey));
                    navigateToRecord();
                  }
                }}
                style={{fontSize:12,padding:'5px 14px',border:'1px solid #ddd',borderRadius:6,background:'transparent',color:'#c0392b',cursor:'pointer',fontFamily:ff}}
              >Delete all</button>
            </div>

            {/* Radial menu — Detail page */}
            <RadialMenu
              buttons={[
                { icon:<NewIcon/>, label:'New record', angleDeg:180, onClick:()=>{ setForm(EMPTY); setEditId(null); setView('add'); } },
                { icon:<HomeIcon/>, label:'Back to records', angleDeg:135, onClick:navigateToRecord },
                { icon:<SettingsIcon/>, label:'Settings', angleDeg:90, onClick:()=>setShowPersonalization(p=>!p) },
              ]}
            />
          </div>
        );
      })()}

      {/* ── VISUALIZATION VIEW ── */}
      {view==='viz'&&(()=>{
        const vizNormLabel=[...new Set(vizEntries.map(e=>e.normLabel).filter(Boolean))][0]||'';
        return (
        <div style={{paddingBottom:80}}>
          {/* Full header */}
          <div style={{textAlign:'center',marginBottom:14,position:'relative'}}>
            <span style={{fontSize:13,color:'#444441',fontFamily:ff}}>TruPrice - Your Grocery Shopping Companion</span>
            <button onClick={()=>setShowPersonalization(p=>!p)} style={{position:'absolute',right:0,top:0,background:'none',border:'none',cursor:'pointer',color:showPersonalization?'#444441':'#aaa',padding:4}}>
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

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:600,fontSize:16,fontFamily:ff,marginBottom:4}}>{vizItemName}</div>
            <div style={{fontSize:12,color:'#888',fontFamily:ff}}>Normalized price over time</div>
          </div>

          {/* Store filter */}
          {vizStores.length>1&&(
            <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'#666',fontFamily:ff}}>Store:</span>
              <button onClick={()=>setVizStoreFilter('__all__')} style={{...toggleBtn(vizStoreFilter==='__all__')}}>All</button>
              {vizStores.map(s=>(<button key={s} onClick={()=>setVizStoreFilter(s)} style={{...toggleBtn(vizStoreFilter===s)}}>{s}</button>))}
            </div>
          )}

          {/* Currency strip */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:'#f9f9f9',border:'1px solid #eee',borderRadius:8}}>
            <span style={{fontSize:12,color:'#666',fontFamily:ff}}>Display:</span>
            {selectedCurrencies.map(c=>(<button key={c} onClick={()=>updatePrefs({ displayCurrency:c })} style={{...toggleBtn(displayCurrency===c),padding:'4px 10px',fontSize:12}}>{c}</button>))}
          </div>

          {vizChartData.length===0
            ? <p style={{color:'#888',fontSize:14,fontFamily:ff}}>No data to display.</p>
            : <div style={{background:'#fff',border:'1px solid #ddd',borderRadius:12,padding:'1rem'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:12}}>
                  {vizChartKeys.map((k,i)=>(<span key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#666',fontFamily:ff}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:'inline-block'}}></span>{k}</span>))}
                </div>
                <ResponsiveContainer width='100%' height={300}>
                  <LineChart data={vizChartData} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(128,128,128,0.15)'/>
                    <XAxis dataKey='date' tick={{fontSize:11,fontFamily:ff}}/>
                    <YAxis tick={{fontSize:11,fontFamily:ff}} tickFormatter={v=>currSymbol+v.toFixed(1)} width={62} domain={[vizChartMin,'auto']}/>
                    <Tooltip content={<CustomTooltip currSymbol={currSymbol} entries={vizEntries} chartGroupBy='store'/>}/>
                    {vizChartKeys.map((k,i)=>(<Line key={k} type='monotone' dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:4}} activeDot={{r:6}} connectNulls={false}/>))}
                  </LineChart>
                </ResponsiveContainer>
                <p style={{fontSize:11,color:'#888',marginTop:8,textAlign:'center',fontFamily:ff}}>Normalized price in {displayCurrency}{vizNormLabel?' '+vizNormLabel:''}</p>
              </div>
          }

          {/* Radial menu — Viz page */}
          <RadialMenu
            buttons={[
              { icon:<DetailIcon/>, label:'Back to details', angleDeg:180, onClick:()=>setView('detail') },
              { icon:<HomeIcon/>, label:'Back to records', angleDeg:135, onClick:navigateToRecord },
              { icon:<SettingsIcon/>, label:'Settings', angleDeg:90, onClick:()=>setShowPersonalization(p=>!p) },
            ]}
          />
        </div>
        );
      })()}
    </div>
  );
}
