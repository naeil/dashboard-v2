import { useEffect, useRef, useState } from 'react'
import {
  getAllCostData, uploadCostExcel,
  saveChannelProduct, updateChannelProduct, deleteChannelProduct,
  saveSku, updateSku, deleteSku,
  saveLogisticsFee, deleteLogisticsFee,
} from '../../api/productCostApi'

const pct = (v) => v != null ? (Number(v)*100).toFixed(1)+'%' : '-'
const won = (v) => v != null ? Number(v).toLocaleString('ko-KR')+'원' : '-'
const amount = (v) => { const n=Number(String(v??0).replace(/,/g,'')); return Number.isFinite(n)?n:0 }
const toRate = (s) => { if(s===''||s==null)return 0; const f=parseFloat(String(s).replace('%','')); if(isNaN(f))return 0; return f>1?f/100:f }

// 탭명 localStorage
const TAB_LABEL_KEY = 'product_cost_tab_labels_v1'
const COL_LABEL_KEY = 'product_cost_col_labels_v1'

function loadTabLabels() {
  try { return JSON.parse(localStorage.getItem(TAB_LABEL_KEY)||'{}') } catch { return {} }
}
function saveTabLabel(key, label) {
  try { const s=loadTabLabels(); s[key]=label; localStorage.setItem(TAB_LABEL_KEY,JSON.stringify(s)) } catch {}
}
function loadColLabels(channelKey) {
  try { const all=JSON.parse(localStorage.getItem(COL_LABEL_KEY)||'{}'); return all[channelKey]||{} } catch { return {} }
}
function saveColLabel(channelKey, colKey, label) {
  try {
    const all=JSON.parse(localStorage.getItem(COL_LABEL_KEY)||'{}')
    if(!all[channelKey]) all[channelKey]={}
    all[channelKey][colKey]=label
    localStorage.setItem(COL_LABEL_KEY,JSON.stringify(all))
  } catch {}
}

const CHANNELS_DEFAULT = ['스마트스토어팜','쿠팡','자사물','11번가','지마켓','옥션','카카오톡스토어','해외(국가별)','오프라인(납품처별)']

const CHANNEL_COLS_DEFAULT = [
  {key:'product_code',label:'상품코드',type:'text',width:130},
  {key:'product_name',label:'제품명',type:'text',width:180},
  {key:'sku_code',label:'SKU',type:'text',width:70},
  {key:'qty_per_unit',label:'수량',type:'int',width:55},
  {key:'production_cost',label:'생산원가',type:'won',width:90},
  {key:'list_price',label:'정가',type:'won',width:90},
  {key:'consumer_price',label:'소비자가',type:'won',width:90},
  {key:'channel_fee_rate',label:'채널수수료',type:'rate',width:80},
  {key:'marketing_rate',label:'마케팅비',type:'rate',width:75},
  {key:'ad_rate',label:'광고비',type:'rate',width:75},
  {key:'opex_rate',label:'운영판관비',type:'rate',width:80},
  {key:'consumer_ship_fee',label:'배송비(소비자)',type:'won',width:100},
  {key:'storage_fee_unit',label:'보관비',type:'won',width:75},
]

const OFFLINE_COLS_DEFAULT = [
  {key:'product_code',label:'상품코드',type:'text',width:130},
  {key:'product_name',label:'제품명',type:'text',width:160},
  {key:'sku_code',label:'SKU',type:'text',width:80},
  {key:'buyer_country',label:'국가',type:'text',width:90},
  {key:'buyer_name',label:'바이어명',type:'text',width:120},
  {key:'trade_channel',label:'유통채널',type:'text',width:90},
  {key:'trade_terms',label:'거래조건',type:'text',width:80},
  {key:'currency',label:'통화',type:'text',width:60},
  {key:'exchange_rate',label:'환율',type:'int',width:70},
  {key:'list_price',label:'수출공급가(KRW)',type:'won',width:130},
  {key:'production_cost',label:'제조원가',type:'won',width:90},
  {key:'consumer_ship_fee',label:'국제배송비',type:'won',width:90},
  {key:'channel_fee_rate',label:'관세비율',type:'rate',width:80},
  {key:'storage_fee_unit',label:'인증비',type:'won',width:80},
  {key:'marketing_rate',label:'샘플비용',type:'won',width:80},
  {key:'ad_rate',label:'현지유통마진율',type:'rate',width:110},
  {key:'opex_rate',label:'운영판관비율',type:'rate',width:100},
]

const OFFLINE_NOTE_FIELDS = ['buyer_country','buyer_name','trade_channel','trade_terms','currency','exchange_rate']
function parseOfflineRow(row) { if(!row)return row; let d={}; try{d=row.note?JSON.parse(row.note):{}}catch{}; return {...row,...d} }
function packOfflineNote(row) { const o={}; OFFLINE_NOTE_FIELDS.forEach(f=>{if(row[f]!=null)o[f]=row[f]}); return JSON.stringify(o) }

const EMPTY_CHANNEL_ROW = {product_code:'',product_name:'',sku_code:'',qty_per_unit:1,production_cost:0,list_price:0,consumer_price:0,channel_fee_rate:0,marketing_rate:0.03,ad_rate:0.10,opex_rate:0.15,consumer_ship_fee:0,storage_fee_unit:0}
const EMPTY_OFFLINE_ROW = {product_code:'',product_name:'',sku_code:'',buyer_country:'',buyer_name:'',trade_channel:'offline',trade_terms:'EXW',currency:'KRW',exchange_rate:1,list_price:0,production_cost:0,consumer_ship_fee:0,channel_fee_rate:0,storage_fee_unit:0,marketing_rate:0,ad_rate:0,opex_rate:0}

const calcPreview = (row) => {
  const base=amount(row.consumer_price)||amount(row.list_price)
  const prod=amount(row.production_cost), ship=amount(row.consumer_ship_fee), stor=amount(row.storage_fee_unit)
  const ch=base*amount(row.channel_fee_rate), mkt=base*amount(row.marketing_rate), ad=base*amount(row.ad_rate), opex=base*amount(row.opex_rate)
  const sp=base-prod, op=sp-ship-stor-ch-mkt-ad-opex
  return {base,sp,sm:base>0?sp/base:null,op,om:base>0?op/base:null}
}
const profitTone = (v) => amount(v)<0?'is-negative':'is-positive'
const CALC_COLS = [
  {key:'sp',label:'매출이익',width:95,render:r=>won(Math.round(calcPreview(r).sp)),align:'right',tone:r=>profitTone(calcPreview(r).sp)},
  {key:'sm',label:'매출이익률',width:85,render:r=>pct(calcPreview(r).sm),align:'right',tone:r=>profitTone(calcPreview(r).sp)},
  {key:'op',label:'영업이익',width:95,render:r=>won(Math.round(calcPreview(r).op)),align:'right',tone:r=>profitTone(calcPreview(r).op)},
  {key:'om',label:'영업이익률',width:85,render:r=>pct(calcPreview(r).om),align:'right',tone:r=>profitTone(calcPreview(r).op)},
]

// 편집 셀
function EditCell({value,type,onSave,width}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState('')
  const ref=useRef(null)
  const start=()=>{ let i=value??''; if(type==='rate')i=value!=null?(Number(value)*100).toFixed(1):'0'; setDraft(String(i)); setEditing(true); setTimeout(()=>ref.current?.select(),0) }
  const commit=()=>{ setEditing(false); let p=draft; if(type==='won'||type==='int'){p=parseInt(draft.replace(/,/g,''),10);if(isNaN(p))p=0}else if(type==='rate'){p=toRate(draft)}; onSave(p) }
  const disp=()=>{ if(value==null||value==='')return <span style={{color:'#999'}}>-</span>; if(type==='won')return won(value); if(type==='rate')return pct(value); return value }
  if(editing)return(<input ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}} style={{width:(width-16)+'px',padding:'2px 4px',fontSize:12,border:'1px solid #4f8ef7',borderRadius:3,outline:'none',background:'#1e3a5f',color:'#e0e8f8'}}/>)
  return(<span onClick={start} title="클릭하여 수정" style={{cursor:'pointer',borderBottom:'1px dotted #5a7fa8',minWidth:30,display:'inline-block'}}>{disp()}</span>)
}

// 컬럼명 편집 헤더
function EditableHeader({label,onRename}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState(label)
  const ref=useRef(null)
  useEffect(()=>setDraft(label),[label])
  const start=(e)=>{e.stopPropagation();setDraft(label);setEditing(true);setTimeout(()=>ref.current?.select(),0)}
  const commit=()=>{setEditing(false);if(draft.trim())onRename(draft.trim())}
  if(editing)return(<input ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}} style={{width:'90%',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #4a8fcf',borderRadius:3,color:'#cce0f5',outline:'none'}}/>)
  return(<span title="더블클릭 컬럼명 수정" onDoubleClick={start} style={{cursor:'pointer',userSelect:'none'}}>{label} <span style={{fontSize:9,color:'#4a6a8a',marginLeft:2}}>✏️</span></span>)
}

// 탭명 편집 버튼
function EditableTabName({tabKey,label,isActive,count,onSelect,onRename}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState(label)
  const ref=useRef(null)
  useEffect(()=>setDraft(label),[label])
  const startEdit=(e)=>{e.preventDefault();e.stopPropagation();setDraft(label);setEditing(true);setTimeout(()=>ref.current?.select(),0)}
  const commit=()=>{setEditing(false);if(draft.trim()&&draft.trim()!==label)onRename(draft.trim())}
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:2,
      background:isActive?'#1a4070':'none',
      borderBottom:isActive?'2px solid #4a8fcf':'2px solid transparent',
      borderRadius:'4px 4px 0 0',
      padding:'0 2px',
    }}>
      {editing?(
        <input ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}}
          onClick={e=>e.stopPropagation()}
          style={{width:Math.max(60,draft.length*8)+'px',padding:'6px 4px',fontSize:13,background:'#0d2035',border:'1px solid #4a8fcf',borderRadius:3,color:'#cce0f5',outline:'none',fontWeight:600}}
        />
      ):(
        <button onClick={()=>onSelect(tabKey)}
          style={{background:'none',color:isActive?'#7bc8ff':'#6a9abf',border:'none',padding:'8px 10px',cursor:'pointer',fontSize:13,fontWeight:isActive?600:400}}>
          {label}{count!=null&&<span style={{marginLeft:4,fontSize:10,color:'#4a8fcf'}}>({count})</span>}
        </button>
      )}
      <span title="더블클릭으로 탭명 수정" onDoubleClick={startEdit}
        style={{cursor:'pointer',fontSize:10,color:isActive?'#4a8fcf':'#3a5a7a',padding:'0 3px',userSelect:'none',lineHeight:1}}>✏️</span>
    </div>
  )
}

// 공통 검색바
function SearchBar({searchProduct,setSearchProduct,searchBuyer,setSearchBuyer,total,filtered,showBuyer=false}){
  return(
    <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,background:'#0d2035',border:'1px solid #2a4060',borderRadius:6,padding:'6px 10px'}}>
        <span style={{fontSize:13}}>🔍</span>
        <input placeholder="제품 검색 (제품명 / 코드)" value={searchProduct} onChange={e=>setSearchProduct(e.target.value)}
          style={{background:'none',border:'none',outline:'none',color:'#cce0f5',fontSize:13,width:200}}/>
        {searchProduct&&<span onClick={()=>setSearchProduct('')} style={{cursor:'pointer',color:'#6a9abf',fontSize:12}}>✕</span>}
      </div>
      {showBuyer&&(
        <div style={{display:'flex',alignItems:'center',gap:6,background:'#0d2035',border:'1px solid #2a4060',borderRadius:6,padding:'6px 10px'}}>
          <span style={{fontSize:13}}>🌏</span>
          <input placeholder="거래처 검색 (국가 / 바이어명)" value={searchBuyer} onChange={e=>setSearchBuyer(e.target.value)}
            style={{background:'none',border:'none',outline:'none',color:'#cce0f5',fontSize:13,width:200}}/>
          {searchBuyer&&<span onClick={()=>setSearchBuyer('')} style={{cursor:'pointer',color:'#6a9abf',fontSize:12}}>✕</span>}
        </div>
      )}
      <span style={{fontSize:11,color:'#4a7a9a'}}>전체 {total}건{filtered!==total?' / 필터 '+filtered+'건':''} | 컬럼명 더블클릭 수정</span>
    </div>
  )
}

// 오프라인 테이블
function OfflineTable({rows,onRefresh,notify,channelKey}){
  const savedCols=loadColLabels(channelKey)
  const [cols,setCols]=useState(()=>OFFLINE_COLS_DEFAULT.map(c=>({...c,label:savedCols[c.key]||c.label})))
  const [adding,setAdding]=useState(false)
  const [newRow,setNewRow]=useState({...EMPTY_OFFLINE_ROW})
  const [saving,setSaving]=useState(false)
  const [tableRows,setTableRows]=useState(rows)
  const [sp,setSp]=useState('')
  const [sb,setSb]=useState('')
  useEffect(()=>setTableRows(rows.map(parseOfflineRow)),[rows])
  const handleRename=(colKey,label)=>{
    saveColLabel(channelKey,colKey,label)
    setCols(prev=>prev.map(c=>c.key===colKey?{...c,label}:c))
  }
  const handleCellSave=async(row,key,val)=>{
    const updated={...row,[key]:val}
    setTableRows(prev=>prev.map(item=>item.id===row.id?updated:item))
    try{
      const payload={...updated,note:packOfflineNote(updated)}
      if(row.id)await updateChannelProduct(row.id,payload)
      else await saveChannelProduct({...payload,channel_name:'오프라인(납품처별)'})
      onRefresh()
    }catch{setTableRows(rows.map(parseOfflineRow));notify('저장 실패','error')}
  }
  const handleDelete=async(id)=>{
    if(!window.confirm('이 항목을 삭제할까요?'))return
    try{await deleteChannelProduct(id);onRefresh();notify('삭제되었습니다.','success')}catch{notify('삭제 실패','error')}
  }
  const handleAddSave=async()=>{
    if(!newRow.product_name){notify('제품명은 필수입니다.','error');return}
    setSaving(true)
    try{
      await saveChannelProduct({...newRow,channel_name:'오프라인(납품처별)',note:packOfflineNote(newRow)})
      setNewRow({...EMPTY_OFFLINE_ROW});setAdding(false);onRefresh();notify('추가되었습니다.','success')
    }catch{notify('저장 실패','error')}finally{setSaving(false)}
  }
  const filtered=tableRows.filter(row=>{
    const ps=sp.toLowerCase(),bs=sb.toLowerCase()
    return(!ps||String(row.product_name||'').toLowerCase().includes(ps)||String(row.product_code||'').toLowerCase().includes(ps))
      &&(!bs||String(row.buyer_name||'').toLowerCase().includes(bs)||String(row.buyer_country||'').toLowerCase().includes(bs))
  })
  const dispCols=[...cols,...CALC_COLS]
  const minW=dispCols.reduce((s,c)=>s+c.width,0)+80
  return(
    <div>
      <SearchBar searchProduct={sp} setSearchProduct={setSp} searchBuyer={sb} setSearchBuyer={setSb} total={tableRows.length} filtered={filtered.length} showBuyer={true}/>
      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',minWidth:minW,fontSize:12,width:'100%'}}>
          <thead><tr style={{background:'#1a3050',color:'#8ab4d8'}}>
            {cols.map(c=>(<th key={c.key} style={{padding:'6px 8px',textAlign:'left',whiteSpace:'nowrap',width:c.width,borderBottom:'1px solid #2a4060'}}><EditableHeader label={c.label} onRename={(l)=>handleRename(c.key,l)}/></th>))}
            {CALC_COLS.map(c=>(<th key={c.key} style={{padding:'6px 8px',textAlign:'right',whiteSpace:'nowrap',width:c.width,borderBottom:'1px solid #2a4060'}}>{c.label}</th>))}
            <th style={{padding:'6px 8px',width:60,borderBottom:'1px solid #2a4060'}}>액션</th>
          </tr></thead>
          <tbody>
            {filtered.map(row=>(
              <tr key={row.id} style={{borderBottom:'1px solid #1e3050'}} onMouseEnter={e=>e.currentTarget.style.background='#162840'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                {cols.map(c=>(<td key={c.key} style={{padding:'4px 8px',whiteSpace:'nowrap'}}><EditCell value={row[c.key]} type={c.type} width={c.width} onSave={v=>handleCellSave(row,c.key,v)}/></td>))}
                {CALC_COLS.map(c=>(<td key={c.key} className={'calculated-profit '+(c.tone?c.tone(row):'')} style={{padding:'4px 8px',whiteSpace:'nowrap',textAlign:c.align||'left',fontWeight:700}}>{c.render(row)}</td>))}
                <td style={{padding:'4px 8px',textAlign:'center'}}><button onClick={()=>handleDelete(row.id)} style={{background:'none',border:'none',color:'#e57373',cursor:'pointer',fontSize:14}} title="삭제">✕</button></td>
              </tr>
            ))}
            {adding&&(<tr style={{background:'#162840',borderBottom:'1px solid #2a5080'}}>
              {cols.map(c=>(<td key={c.key} style={{padding:'4px 8px'}}>
                <input value={c.type==='rate'?(newRow[c.key]!=null?(newRow[c.key]*100).toFixed(1):''):(newRow[c.key]??'')}
                  onChange={e=>{let v=e.target.value;setNewRow(p=>({...p,[c.key]:v}))}}
                  onBlur={e=>{let v=e.target.value;if(c.type==='won'||c.type==='int')v=parseInt(v.replace(/,/g,''),10)||0;else if(c.type==='rate')v=toRate(v);setNewRow(p=>({...p,[c.key]:v}))}}
                  placeholder={c.label} style={{width:(c.width-12)+'px',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/>
              </td>))}
              {CALC_COLS.map(c=>(<td key={c.key} className={'calculated-profit '+(c.tone?c.tone(newRow):'')} style={{padding:'4px 8px',whiteSpace:'nowrap',textAlign:c.align||'left',fontWeight:700}}>{c.render(newRow)}</td>))}
              <td style={{padding:'4px 8px',textAlign:'center',whiteSpace:'nowrap'}}>
                <button onClick={handleAddSave} disabled={saving} style={{background:'#2a6496',color:'#fff',border:'none',borderRadius:3,padding:'2px 8px',cursor:'pointer',marginRight:4,fontSize:11}}>저장</button>
                <button onClick={()=>setAdding(false)} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:14}}>✕</button>
              </td>
            </tr>)}
          </tbody>
        </table>
        <div style={{marginTop:10}}>{!adding&&(<button onClick={()=>setAdding(true)} style={{background:'none',border:'1px dashed #4a7aaa',color:'#6ab0e0',borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:12}}>+ 제품 추가</button>)}</div>
      </div>
    </div>
  )
}

// 일반 채널 테이블 (검색 + 컬럼명 편집 추가)
function ChannelTable({channelName,channelKey,rows,onRefresh,notify}){
  const savedCols=loadColLabels(channelKey)
  const [cols,setCols]=useState(()=>CHANNEL_COLS_DEFAULT.map(c=>({...c,label:savedCols[c.key]||c.label})))
  const [adding,setAdding]=useState(false)
  const [newRow,setNewRow]=useState({...EMPTY_CHANNEL_ROW})
  const [saving,setSaving]=useState(false)
  const [tableRows,setTableRows]=useState(rows)
  const [sp,setSp]=useState('')
  useEffect(()=>setTableRows(rows),[rows])
  const handleRename=(colKey,label)=>{
    saveColLabel(channelKey,colKey,label)
    setCols(prev=>prev.map(c=>c.key===colKey?{...c,label}:c))
  }
  const handleCellSave=async(row,key,val)=>{
    const updated={...row,[key]:val}
    setTableRows(prev=>prev.map(item=>item.id===row.id?updated:item))
    try{
      if(row.id)await updateChannelProduct(row.id,updated)
      else await saveChannelProduct({...updated,channel_name:channelName})
      onRefresh()
    }catch{setTableRows(rows);notify('저장 실패','error')}
  }
  const handleDelete=async(id)=>{
    if(!window.confirm('이 항목을 삭제할까요?'))return
    try{await deleteChannelProduct(id);onRefresh();notify('삭제되었습니다.','success')}catch{notify('삭제 실패','error')}
  }
  const handleAddSave=async()=>{
    if(!newRow.product_code||!newRow.product_name){notify('상품코드와 제품명은 필수입니다.','error');return}
    setSaving(true)
    try{
      await saveChannelProduct({...newRow,channel_name:channelName})
      setNewRow({...EMPTY_CHANNEL_ROW});setAdding(false);onRefresh();notify('추가되었습니다.','success')
    }catch{notify('저장 실패','error')}finally{setSaving(false)}
  }
  const filtered=tableRows.filter(row=>
    !sp||String(row.product_name||'').toLowerCase().includes(sp.toLowerCase())||String(row.product_code||'').toLowerCase().includes(sp.toLowerCase())
  )
  const dispCols=[...cols,...CALC_COLS]
  const minW=dispCols.reduce((s,c)=>s+c.width,0)+80
  return(
    <div>
      <SearchBar searchProduct={sp} setSearchProduct={setSp} searchBuyer='' setSearchBuyer={()=>{}} total={tableRows.length} filtered={filtered.length} showBuyer={false}/>
      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',minWidth:minW,fontSize:12,width:'100%'}}>
          <thead><tr style={{background:'#1a3050',color:'#8ab4d8'}}>
            {cols.map(c=>(<th key={c.key} style={{padding:'6px 8px',textAlign:'left',whiteSpace:'nowrap',width:c.width,borderBottom:'1px solid #2a4060'}}><EditableHeader label={c.label} onRename={(l)=>handleRename(c.key,l)}/></th>))}
            {CALC_COLS.map(c=>(<th key={c.key} style={{padding:'6px 8px',textAlign:'right',whiteSpace:'nowrap',width:c.width,borderBottom:'1px solid #2a4060'}}>{c.label}</th>))}
            <th style={{padding:'6px 8px',width:60,borderBottom:'1px solid #2a4060'}}>액션</th>
          </tr></thead>
          <tbody>
            {filtered.map(row=>(
              <tr key={row.id} style={{borderBottom:'1px solid #1e3050'}} onMouseEnter={e=>e.currentTarget.style.background='#162840'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                {cols.map(c=>(<td key={c.key} style={{padding:'4px 8px',whiteSpace:'nowrap'}}><EditCell value={row[c.key]} type={c.type} width={c.width} onSave={v=>handleCellSave(row,c.key,v)}/></td>))}
                {CALC_COLS.map(c=>(<td key={c.key} className={'calculated-profit '+(c.tone?c.tone(row):'')} style={{padding:'4px 8px',whiteSpace:'nowrap',textAlign:c.align||'left',fontWeight:700}}>{c.render(row)}</td>))}
                <td style={{padding:'4px 8px',textAlign:'center'}}><button onClick={()=>handleDelete(row.id)} style={{background:'none',border:'none',color:'#e57373',cursor:'pointer',fontSize:14}} title="삭제">✕</button></td>
              </tr>
            ))}
            {adding&&(<tr style={{background:'#162840',borderBottom:'1px solid #2a5080'}}>
              {cols.map(c=>(<td key={c.key} style={{padding:'4px 8px'}}>
                <input value={c.type==='rate'?(newRow[c.key]!=null?(newRow[c.key]*100).toFixed(1):''):(newRow[c.key]??'')}
                  onChange={e=>{let v=e.target.value;setNewRow(p=>({...p,[c.key]:v}))}}
                  onBlur={e=>{let v=e.target.value;if(c.type==='won'||c.type==='int')v=parseInt(v.replace(/,/g,''),10)||0;else if(c.type==='rate')v=toRate(v);setNewRow(p=>({...p,[c.key]:v}))}}
                  placeholder={c.label} style={{width:(c.width-12)+'px',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/>
              </td>))}
              {CALC_COLS.map(c=>(<td key={c.key} className={'calculated-profit '+(c.tone?c.tone(newRow):'')} style={{padding:'4px 8px',whiteSpace:'nowrap',textAlign:c.align||'left',fontWeight:700}}>{c.render(newRow)}</td>))}
              <td style={{padding:'4px 8px',textAlign:'center',whiteSpace:'nowrap'}}>
                <button onClick={handleAddSave} disabled={saving} style={{background:'#2a6496',color:'#fff',border:'none',borderRadius:3,padding:'2px 8px',cursor:'pointer',marginRight:4,fontSize:11}}>저장</button>
                <button onClick={()=>setAdding(false)} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:14}}>✕</button>
              </td>
            </tr>)}
          </tbody>
        </table>
        <div style={{marginTop:10}}>{!adding&&(<button onClick={()=>setAdding(true)} style={{background:'none',border:'1px dashed #4a7aaa',color:'#6ab0e0',borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:12}}>+ 제품 추가</button>)}</div>
      </div>
    </div>
  )
}

// SKU 테이블
function SkuTable({skus,onRefresh,notify}){
  const [adding,setAdding]=useState(false)
  const [newRow,setNewRow]=useState({sku_code:'',product_name:'',weight_g:0,temp_type:'상온',production_cost:0})
  const [editingId,setEditingId]=useState(null)
  const [editRow,setEditRow]=useState(null)
  const [sp,setSp]=useState('')
  const handleDelete=async(id)=>{if(!window.confirm('삭제할까요?'))return;try{await deleteSku(id);onRefresh();notify('삭제되었습니다.','success')}catch{notify('삭제 실패','error')}}
  const handleAdd=async()=>{if(!newRow.sku_code){notify('SKU 코드는 필수입니다.','error');return};try{await saveSku(newRow);setNewRow({sku_code:'',product_name:'',weight_g:0,temp_type:'상온',production_cost:0});setAdding(false);onRefresh();notify('추가되었습니다.','success')}catch{notify('저장 실패','error')}}
  const handleEditSave=async()=>{if(!editRow?.sku_code){notify('SKU 코드는 필수입니다.','error');return};try{await updateSku(editingId,{...editRow,weight_g:parseInt(String(editRow.weight_g??0).replace(/,/g,''),10)||0,production_cost:parseInt(String(editRow.production_cost??0).replace(/,/g,''),10)||0});setEditingId(null);setEditRow(null);onRefresh();notify('SKU 정보가 수정되었습니다.','success')}catch{notify('수정 실패','error')}}
  const cols=[{key:'sku_code',label:'SKU 코드',w:90},{key:'product_name',label:'제품명',w:200},{key:'temp_type',label:'냉동/상온',w:80},{key:'weight_g',label:'무게(g)',w:80,align:'right'},{key:'production_cost',label:'생산원가',w:100,fmt:won,align:'right'},{key:'note',label:'비고',w:150}]
  const filtered=sp?skus.filter(r=>String(r.sku_code||'').toLowerCase().includes(sp.toLowerCase())||String(r.product_name||'').toLowerCase().includes(sp.toLowerCase())):skus
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:6,background:'#0d2035',border:'1px solid #2a4060',borderRadius:6,padding:'6px 10px',marginBottom:14,width:'fit-content'}}>
        <span>🔍</span>
        <input placeholder="SKU / 제품명 검색" value={sp} onChange={e=>setSp(e.target.value)} style={{background:'none',border:'none',outline:'none',color:'#cce0f5',fontSize:13,width:200}}/>
        {sp&&<span onClick={()=>setSp('')} style={{cursor:'pointer',color:'#6a9abf',fontSize:12}}>✕</span>}
        <span style={{fontSize:11,color:'#4a7a9a',marginLeft:4}}>전체 {skus.length}{filtered.length!==skus.length?' / 필터 '+filtered.length:''}건</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
          <thead><tr style={{background:'#1a3050',color:'#8ab4d8'}}>
            {cols.map(c=><th key={c.key} style={{padding:'6px 8px',textAlign:c.align||'left',width:c.w,borderBottom:'1px solid #2a4060'}}>{c.label}</th>)}
            <th style={{padding:'6px 8px',width:110,borderBottom:'1px solid #2a4060'}}>액션</th>
          </tr></thead>
          <tbody>
            {filtered.map(row=>(<tr key={row.id} style={{borderBottom:'1px solid #1e3050'}}>
              {cols.map(c=>(<td key={c.key} style={{padding:'4px 8px',textAlign:c.align||'left'}}>
                {editingId===row.id?(c.key==='temp_type'?(<select value={editRow?.temp_type||'상온'} onChange={e=>setEditRow(p=>({...p,temp_type:e.target.value}))} style={{width:(c.w-10)+'px',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5'}}><option>상온</option><option>냉동</option></select>):(<input value={editRow?.[c.key]??''} onChange={e=>setEditRow(p=>({...p,[c.key]:e.target.value}))} placeholder={c.label} style={{width:(c.w-10)+'px',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/>)):(c.key==='product_name'&&!row[c.key]?<span style={{color:'#dc2626',fontWeight:700}}>제품명 필요</span>:(c.fmt?c.fmt(row[c.key]):row[c.key]))}
              </td>))}
              <td style={{padding:'4px 8px',textAlign:'center',whiteSpace:'nowrap'}}>
                {editingId===row.id?(<><button onClick={handleEditSave} style={{background:'#0284c7',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,marginRight:4}}>저장</button><button onClick={()=>{setEditingId(null);setEditRow(null)}} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:13}}>취소</button></>):(<><button onClick={()=>{setEditingId(row.id);setEditRow({...row})}} style={{background:'none',border:'1px solid #38bdf8',color:'#0369a1',borderRadius:4,cursor:'pointer',fontSize:11,padding:'2px 7px',marginRight:4}}>수정</button><button onClick={()=>handleDelete(row.id)} style={{background:'none',border:'none',color:'#e57373',cursor:'pointer',fontSize:14}}>✕</button></>)}
              </td>
            </tr>))}
            {adding&&(<tr style={{background:'#162840'}}>
              {cols.map(c=>(<td key={c.key} style={{padding:'4px 6px'}}>{c.key==='temp_type'?(<select value={newRow.temp_type} onChange={e=>setNewRow(p=>({...p,temp_type:e.target.value}))} style={{background:'#0d2035',color:'#cce0f5',border:'1px solid #3a6090',borderRadius:3,fontSize:11,padding:'2px'}}><option>상온</option><option>냉동</option></select>):(<input value={newRow[c.key]??''} onChange={e=>setNewRow(p=>({...p,[c.key]:e.target.value}))} placeholder={c.label} style={{width:(c.w-10)+'px',padding:'2px 4px',fontSize:11,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/>)}</td>))}
              <td style={{padding:'4px 8px',textAlign:'center',whiteSpace:'nowrap'}}><button onClick={handleAdd} style={{background:'#2a6496',color:'#fff',border:'none',borderRadius:3,padding:'2px 8px',cursor:'pointer',fontSize:11,marginRight:4}}>저장</button><button onClick={()=>setAdding(false)} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:14}}>✕</button></td>
            </tr>)}
          </tbody>
        </table>
        {!adding&&(<button onClick={()=>setAdding(true)} style={{marginTop:10,background:'none',border:'1px dashed #4a7aaa',color:'#6ab0e0',borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:12}}>+ SKU 추가</button>)}
      </div>
    </div>
  )
}

// 물류비
function LogisticsTable({fees,onRefresh,notify}){
  const [adding,setAdding]=useState(false)
  const [newRow,setNewRow]=useState({temp_type:'냉동',weight_limit_g:'',fee:''})
  const handleDelete=async(id)=>{if(!window.confirm('삭제할까요?'))return;try{await deleteLogisticsFee(id);onRefresh();notify('삭제되었습니다.','success')}catch{notify('삭제 실패','error')}}
  const handleAdd=async()=>{if(!newRow.weight_limit_g||!newRow.fee){notify('모든 필드를 입력하세요.','error');return};try{await saveLogisticsFee({...newRow,weight_limit_g:parseInt(newRow.weight_limit_g),fee:parseFloat(newRow.fee)});setNewRow({temp_type:'냉동',weight_limit_g:'',fee:''});setAdding(false);onRefresh();notify('추가되었습니다.','success')}catch{notify('저장 실패','error')}}
  const frozen=fees.filter(f=>f.temp_type==='냉동'),ambient=fees.filter(f=>f.temp_type==='상온')
  const FeeGroup=({label,rows})=>(<div style={{marginBottom:20}}><div style={{color:'#8ab4d8',fontWeight:600,marginBottom:8,fontSize:13}}>{label}</div><table style={{borderCollapse:'collapse',fontSize:12,width:'100%',maxWidth:400}}><thead><tr style={{background:'#1a3050',color:'#8ab4d8'}}><th style={{padding:'6px 12px',textAlign:'left',borderBottom:'1px solid #2a4060'}}>무게 상한(g)</th><th style={{padding:'6px 12px',textAlign:'right',borderBottom:'1px solid #2a4060'}}>택배비</th><th style={{padding:'6px 12px',width:60,borderBottom:'1px solid #2a4060'}}>액션</th></tr></thead><tbody>{rows.map(r=>(<tr key={r.id} style={{borderBottom:'1px solid #1e3050'}}><td style={{padding:'4px 12px'}}>{r.weight_limit_g===999999?'초과':r.weight_limit_g.toLocaleString()+'g'}</td><td style={{padding:'4px 12px',textAlign:'right'}}>{won(r.fee)}</td><td style={{padding:'4px 12px',textAlign:'center'}}><button onClick={()=>handleDelete(r.id)} style={{background:'none',border:'none',color:'#e57373',cursor:'pointer',fontSize:14}}>✕</button></td></tr>))}</tbody></table></div>)
  return(<div><div style={{display:'flex',gap:40,flexWrap:'wrap'}}><FeeGroup label="냉동" rows={frozen}/><FeeGroup label="상온" rows={ambient}/></div>{adding?(<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}><select value={newRow.temp_type} onChange={e=>setNewRow(p=>({...p,temp_type:e.target.value}))} style={{background:'#0d2035',color:'#cce0f5',border:'1px solid #3a6090',borderRadius:3,padding:'4px 8px',fontSize:12}}><option>냉동</option><option>상온</option></select><input placeholder="무게 상한(g)" value={newRow.weight_limit_g} onChange={e=>setNewRow(p=>({...p,weight_limit_g:e.target.value}))} style={{width:160,padding:'4px 8px',fontSize:12,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/><input placeholder="택배비(원)" value={newRow.fee} onChange={e=>setNewRow(p=>({...p,fee:e.target.value}))} style={{width:120,padding:'4px 8px',fontSize:12,background:'#0d2035',border:'1px solid #3a6090',borderRadius:3,color:'#cce0f5',outline:'none'}}/><button onClick={handleAdd} style={{background:'#2a6496',color:'#fff',border:'none',borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:12}}>저장</button><button onClick={()=>setAdding(false)} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer'}}>취소</button></div>):(<button onClick={()=>setAdding(true)} style={{marginTop:8,background:'none',border:'1px dashed #4a7aaa',color:'#6ab0e0',borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:12}}>+ 구간 추가</button>)}</div>)
}

// 통합정리
function buildOverview(data,sp){
  const rows=[]
  Object.entries(data.channels||{}).forEach(([ch,chRows])=>{
    ;(chRows||[]).forEach(row=>{
      const nk=String(row.product_name||'').trim().toLowerCase()
      const ck=String(row.product_code||'').trim().toLowerCase()
      const key=nk||ck||'r'+row.id
      const p=calcPreview(row)
      rows.push({key,ch,productCode:row.product_code||'',productName:row.product_name||'',skuCode:row.sku_code||'',salesBase:p.base,om:p.om,op:p.op})
    })
  })
  const g=new Map()
  rows.forEach(r=>{
    const gr=g.get(r.key)||{key:r.key,productCode:r.productCode,productName:r.productName,skuCodes:new Set(),channels:[],total:0,minM:null,maxM:null,totOp:0}
    if(!gr.productCode&&r.productCode)gr.productCode=r.productCode
    if(!gr.productName&&r.productName)gr.productName=r.productName
    if(r.skuCode)gr.skuCodes.add(r.skuCode)
    gr.channels.push(r.ch);gr.total+=1;gr.totOp+=r.op
    if(r.om!=null){gr.minM=gr.minM==null?r.om:Math.min(gr.minM,r.om);gr.maxM=gr.maxM==null?r.om:Math.max(gr.maxM,r.om)}
    g.set(r.key,gr)
  })
  let result=Array.from(g.values()).map(r=>({...r,skuCodes:Array.from(r.skuCodes),channels:Array.from(new Set(r.channels)),dup:Math.max(0,r.total-1)}))
    .sort((a,b)=>b.dup-a.dup||String(a.productName).localeCompare(String(b.productName),'ko'))
  if(sp)result=result.filter(r=>String(r.productName||'').toLowerCase().includes(sp.toLowerCase())||String(r.productCode||'').toLowerCase().includes(sp.toLowerCase()))
  return result
}

function CostOverviewTable({data}){
  const [sp,setSp]=useState('')
  const rows=buildOverview(data,sp)
  const dup=rows.filter(r=>r.dup>0).length
  const missSku=(data.skuMaster||[]).filter(r=>!String(r.product_name||'').trim()).length
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(160px,1fr))',gap:10,marginBottom:14}}>
        <div style={{border:'1px solid #e2e8f0',borderRadius:8,padding:12,background:'#f8fafc'}}><div style={{fontSize:11,color:'#64748b',fontWeight:700}}>통합 상품</div><div style={{fontSize:20,color:'#0f172a',fontWeight:800}}>{rows.length.toLocaleString('ko-KR')}개</div></div>
        <div style={{border:'1px solid #e2e8f0',borderRadius:8,padding:12,background:'#f8fafc'}}><div style={{fontSize:11,color:'#64748b',fontWeight:700}}>중복 표시</div><div style={{fontSize:20,color:'#0f172a',fontWeight:800}}>{dup.toLocaleString('ko-KR')}개</div></div>
        <div style={{border:'1px solid #e2e8f0',borderRadius:8,padding:12,background:'#f8fafc'}}><div style={{fontSize:11,color:'#64748b',fontWeight:700}}>제품명 필요 SKU</div><div style={{fontSize:20,color:missSku?'#dc2626':'#047857',fontWeight:800}}>{missSku.toLocaleString('ko-KR')}개</div></div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,background:'#0d2035',border:'1px solid #2a4060',borderRadius:6,padding:'6px 10px',marginBottom:12,width:'fit-content'}}>
        <span>🔍</span>
        <input placeholder="제품 검색 (제품명 / 코드)" value={sp} onChange={e=>setSp(e.target.value)} style={{background:'none',border:'none',outline:'none',color:'#cce0f5',fontSize:13,width:200}}/>
        {sp&&<span onClick={()=>setSp('')} style={{cursor:'pointer',color:'#6a9abf',fontSize:12}}>✕</span>}
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,width:'100%',minWidth:980}}>
          <thead><tr>
            <th style={{padding:'7px 8px',textAlign:'left'}}>제품명</th>
            <th style={{padding:'7px 8px',textAlign:'left'}}>대표 상품코드</th>
            <th style={{padding:'7px 8px',textAlign:'left'}}>SKU</th>
            <th style={{padding:'7px 8px',textAlign:'left'}}>등록 채널</th>
            <th style={{padding:'7px 8px',textAlign:'right'}}>중복 행</th>
            <th style={{padding:'7px 8px',textAlign:'right'}}>영업이익률 범위</th>
            <th style={{padding:'7px 8px',textAlign:'right'}}>영업이익 합계</th>
          </tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.key} style={{borderBottom:'1px solid #e2e8f0'}}>
              <td style={{padding:'6px 8px',fontWeight:700}}>{r.productName||'-'}</td>
              <td style={{padding:'6px 8px'}}>{r.productCode||'-'}</td>
              <td style={{padding:'6px 8px'}}>{r.skuCodes.length?r.skuCodes.join(', '):'-'}</td>
              <td style={{padding:'6px 8px'}}>{r.channels.join(', ')}</td>
              <td style={{padding:'6px 8px',textAlign:'right',color:r.dup?'#b45309':'#64748b',fontWeight:800}}>{r.dup?'+'+r.dup:'-'}</td>
              <td style={{padding:'6px 8px',textAlign:'right'}}>{r.minM==null?'-':r.minM===r.maxM?pct(r.minM):pct(r.minM)+' ~ '+pct(r.maxM)}</td>
              <td className={'calculated-profit '+profitTone(r.totOp)} style={{padding:'6px 8px',textAlign:'right',fontWeight:800}}>{won(Math.round(r.totOp))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// 메인
export default function ProductCostPage(){
  const [data,setData]=useState({channels:{},skuMaster:[],logisticsFees:[]})
  const [activeTab,setActiveTab]=useState('통합정리')
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState(false)
  const [msg,setMsg]=useState({text:'',type:''})
  const [tabLabels,setTabLabels]=useState(()=>loadTabLabels())
  const [channels,setChannels]=useState(()=>CHANNELS_DEFAULT)
  const fileRef=useRef(null)

  const notify=(text,type='info')=>{setMsg({text,type});setTimeout(()=>setMsg({text:'',type:''}),3000)}
  const load=async()=>{setLoading(true);try{const r=await getAllCostData();setData(r.data)}catch{notify('데이터 로드 실패','error')}finally{setLoading(false)}}
  useEffect(()=>{load()},[]) // eslint-disable-line

  const handleUpload=async(e)=>{
    const file=e.target.files?.[0];if(!file)return
    setUploading(true)
    try{const r=(await uploadCostExcel(file)).data;notify('업로드 완료 — '+r.message+'. 총 '+r.totalChannelRows+'개 채널행, SKU '+r.skuMaster,'success');await load()}
    catch(err){notify(err?.response?.data?.message||'업로드 실패','error')}
    finally{setUploading(false);if(fileRef.current)fileRef.current.value=''}
  }

  const handleTabRename=(tabKey,newLabel)=>{
    saveTabLabel(tabKey,newLabel)
    setTabLabels(prev=>({...prev,[tabKey]:newLabel}))
  }

  const getTabLabel=(key)=>tabLabels[key]||key

  const STATIC_TABS=['통합정리',...channels,'SKU마스터','물류비구간']
  const msgBg={success:'#1a4a2a',error:'#4a1a1a',info:'#1a3050'}

  const getChannelCount=(tabKey)=>{
    const ch=channels.find(c=>c===tabKey)
    if(!ch)return null
    const rows=data.channels[tabKey]
    return rows?rows.length:null
  }

  return(
    <div className="product-cost-page" style={{minHeight:'100vh',background:'#0d1b2e',color:'#c8dff0',fontFamily:'sans-serif'}}>
      <div className="product-cost-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:24,lineHeight:'32px',color:'#0f172a',fontWeight:900,letterSpacing:'-0.025em'}}>제품 원가 관리</h1>
          <p style={{margin:'8px 0 0',fontSize:14,color:'#64748b',fontWeight:500}}>채널별 제품 원가·수수료율을 관리합니다. 셀을 클릭하면 바로 수정됩니다.</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{display:'none'}} id="cost-excel-upload"/>
          <label htmlFor="cost-excel-upload" style={{background:uploading?'#1a3a5c':'#1e5a9a',color:uploading?'#8ab4d8':'#fff',border:'none',borderRadius:6,padding:'8px 16px',cursor:uploading?'not-allowed':'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>upload_file</span>
            {uploading?'업로드 중...':'엑셀 업로드'}
          </label>
        </div>
      </div>

      {msg.text&&(<div style={{background:msgBg[msg.type]||'#1a3050',border:'1px solid '+(msg.type==='success'?'#2a6a3a':msg.type==='error'?'#6a2a2a':'#2a5070'),borderRadius:6,padding:'8px 14px',marginBottom:16,fontSize:13,color:msg.type==='success'?'#6ee89a':msg.type==='error'?'#f08080':'#8ab4d8'}}>{msg.text}</div>)}

      <div className="product-cost-tabs" style={{display:'flex',gap:2,marginBottom:16,borderBottom:'1px solid #1e3050',flexWrap:'wrap',alignItems:'flex-end'}}>
        {STATIC_TABS.map(tabKey=>{
          const isActive=activeTab===tabKey
          const cnt=getChannelCount(tabKey)
          return(
            <EditableTabName
              key={tabKey}
              tabKey={tabKey}
              label={getTabLabel(tabKey)}
              isActive={isActive}
              count={cnt}
              onSelect={k=>setActiveTab(k)}
              onRename={l=>handleTabRename(tabKey,l)}
            />
          )
        })}
      </div>

      {loading?(
        <div style={{color:'#6a9abf',fontSize:14,padding:20}}>로딩 중...</div>
      ):(
        <div className="product-cost-content" style={{background:'#111e2e',borderRadius:8,padding:16}}>
          {activeTab==='통합정리'&&<CostOverviewTable data={data}/>}
          {activeTab==='오프라인(납품처별)'&&(
            <OfflineTable rows={data.channels['오프라인(납품처별)']||[]} onRefresh={load} notify={notify} channelKey="offline"/>
          )}
          {channels.filter(c=>c!=='오프라인(납품처별)').includes(activeTab)&&(
            <ChannelTable channelName={activeTab} channelKey={activeTab} rows={data.channels[activeTab]||[]} onRefresh={load} notify={notify}/>
          )}
          {activeTab==='SKU마스터'&&<SkuTable skus={data.skuMaster||[]} onRefresh={load} notify={notify}/>}
          {activeTab==='물류비구간'&&<LogisticsTable fees={data.logisticsFees||[]} onRefresh={load} notify={notify}/>}
        </div>
      )}

      <div className="product-cost-formula" style={{marginTop:20,background:'#0a1828',borderRadius:8,padding:16,fontSize:12,color:'#6a9abf',border:'1px solid #1a3050'}}>
        <div style={{fontWeight:600,color:'#8ab4d8',marginBottom:8}}>💡 영업이익 계산 공식</div>
        <div style={{lineHeight:2}}>
          <span style={{color:'#4fc3f7'}}>매출(pay_amt)</span>
          {' − 생산원가 − 물류비(SKU 무게·냉동구분 기준) − 채널수수료(pay_amt×rate) − 마케팅비(3%) − 광고비 − 운영판관비(15%) = '}
          <span style={{color:'#81c784'}}>영업이익</span>
        </div>
        <div style={{marginTop:6,color:'#4a7a9a',fontSize:11}}>탭명 더블클릭 → 탭명 수정 | 컬럼명 더블클릭 → 컬럼명 수정 | 수정 후 다시 방문 시 복원</div>
      </div>
    </div>
  )
}
