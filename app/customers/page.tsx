'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';

type Customer={id:number;full_name:string;email:string;phone:string|null;plan:string|null;expiration_date:string;notes:string|null;service?:string|null;username?:string|null;password?:string|null};
const empty={full_name:'',email:'',phone:'',plan:'',expiration_date:'',notes:'',service:'',username:'',password:''};
const services=['Darkside 6lue tv','Toothless tv','Dragonfly 6lue tv'];
type CustomerForm=typeof empty;
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function daysUntil(date:string){const [y,m,d]=date.split('-').map(Number);const now=new Date();return Math.round((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);}
export default function Customers(){
 const[items,setItems]=useState<Customer[]>([]);
 const[ready,setReady]=useState(false);
 const[msg,setMsg]=useState('');
 const[form,setForm]=useState<CustomerForm>({...empty});
 const[editing,setEditing]=useState<number|null>(null);
 const[showPassword,setShowPassword]=useState(false);
 const[busy,setBusy]=useState(false);
 const[sending,setSending]=useState(false);
 const[message,setMessage]=useState('');
 const[selected,setSelected]=useState<number|null>(null);
 async function load(){
  const s=supabase();if(!s){setMsg('Configure Supabase first');return;}
  const{data,error}=await s.from('customers').select('*').order('expiration_date');
  if(error)setMsg(error.message);else setItems(data||[]);
 }
 useEffect(()=>{const c=supabase();if(!c){setMsg('Configure Supabase first');return;}
  c.auth.getUser().then(({data,error})=>{if(error||!data.user){window.location.href='/login';return;}setReady(true);void load();}).catch(()=>setMsg('Unable to check sign-in. Refresh and try again.'));
 },[]);
 function reset(){setEditing(null);setForm({...empty});setShowPassword(false);}
 function open(customer:Customer){
  setEditing(customer.id);
  setForm({full_name:customer.full_name,email:customer.email,phone:customer.phone||'',plan:customer.plan||'',expiration_date:customer.expiration_date,notes:customer.notes||'',service:customer.service||'',username:customer.username||'',password:customer.password||''});
  setShowPassword(false);setMsg('');window.scrollTo({top:0,behavior:'smooth'});
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const s=supabase();if(!s){setMsg('Configure Supabase first');return;}
  setBusy(true);setMsg('');
  try{
   const payload={...form,full_name:form.full_name.trim(),email:form.email.trim()};
   if(!payload.full_name||!payload.email||!payload.expiration_date)throw new Error('Enter a name, email, and expiration date.');
   const{data,error}=editing===null?await s.from('customers').insert(payload).select('id'):await s.from('customers').update(payload).eq('id',editing).select('id');
   if(error)throw error;if(!data?.length)throw new Error('No customer was saved. Check your sign-in and permissions.');
   const updated=editing!==null;reset();await load();setMsg(updated?'Customer changes saved':'Customer saved');
  }catch(error){setMsg(error instanceof Error?error.message:String((error as {message?:string})?.message||'Unable to save customer'));}
  finally{setBusy(false);}
 }
 async function remove(id:number){
  const s=supabase();if(!s||busy||!confirm('Delete this customer?'))return;setBusy(true);
  try{const{data,error}=await s.from('customers').delete().eq('id',id).select('id');if(error)throw error;if(!data?.length)throw new Error('Customer was not deleted. Check permissions.');if(editing===id)reset();if(selected===id){setSelected(null);setMessage('');}await load();setMsg('Customer deleted');}
  catch(error){setMsg(String((error as {message?:string})?.message||'Unable to delete customer'));}finally{setBusy(false);}
 }
 async function send(){
  const s=supabase();if(!s||selected===null||!message.trim()||sending)return;setSending(true);setMsg('');
  try{const{data,error}=await s.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Sign in again before sending email.');
   const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({customerId:selected,message})});
   const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'Unable to send email');setMsg('Email sent');
  }catch(error){setMsg(String((error as {message?:string})?.message||'Unable to send email'));}finally{setSending(false);}
 }
 function input(key:keyof CustomerForm,label:string,type='text',required=false){return <label key={key} htmlFor={key}>{label}<input id={key} type={type} required={required} value={form[key]} onChange={e=>setForm(previous=>({...previous,[key]:e.target.value}))}/></label>;}
 if(!ready)return <main className="wrap">Loading customer dashboard… {msg}</main>;
 const serviceOptions=form.service&&!services.includes(form.service)?[form.service,...services]:services;
 return <main className="wrap">
  <nav className="nav"><div className="brand">914 IPTV Customers</div><div className="row"><Link className="btn btn2" href="/">Home</Link><button className="btn" onClick={async()=>{await supabase()?.auth.signOut();location.href='/login';}}>Sign Out</button></div></nav>
  <p role="status">{msg}</p>
  <section className="grid">
   <div className="card"><div className="muted">Total customers</div><div className="big">{items.length}</div></div>
   <div className="card"><div className="muted">Expiring within 3 days</div><div className="big">{items.filter(x=>{const d=daysUntil(x.expiration_date);return d>=0&&d<=3;}).length}</div></div>
   <div className="card"><div className="muted">Expired</div><div className="big">{items.filter(x=>x.expiration_date<today()).length}</div></div>
  </section>
  <form className="card" onSubmit={save}>
   <h2>{editing===null?'Add customer':'Customer details / Edit'}</h2>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
    <div className="grid">
     {input('full_name','Full name','text',true)}{input('email','Email','email',true)}{input('phone','Phone','tel')}
     <label htmlFor="service">Service<select id="service" value={form.service} onChange={e=>setForm(previous=>({...previous,service:e.target.value}))}><option value="">Select service</option>{serviceOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     {input('username','Service username')}
     <div>{input('password','Service password',showPassword?'text':'password')}<button type="button" className="btn btn2" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide password':'Show password'}</button></div>
     {input('plan','Plan')}{input('expiration_date','Expiration date','date',true)}
    </div>
    <label htmlFor="notes">Customer notes<textarea id="notes" rows={4} value={form.notes} onChange={e=>setForm(previous=>({...previous,notes:e.target.value}))}/></label>
    <div className="row"><button type="submit" className="btn">{busy?'Saving…':editing===null?'Save customer':'Save changes'}</button>{editing!==null&&<button type="button" className="btn btn2" onClick={reset}>Cancel / Add new</button>}</div>
   </fieldset>
  </form>
  <div className="card" style={{overflowX:'auto'}}><h2>Customers</h2><p className="muted">Click a name to view and edit service details and notes.</p>
   <table><thead><tr><th>Name</th><th>Email</th><th>Service</th><th>Plan</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><button type="button" className="btn btn2" disabled={busy} onClick={()=>open(x)}>{x.full_name}</button></td><td>{x.email}</td><td>{x.service||'—'}</td><td>{x.plan}</td><td>{x.expiration_date}</td><td><button className="btn btn2" disabled={sending||busy} onClick={()=>{setSelected(x.id);setMessage('');}}>Email</button> <button className="btn btn2" disabled={busy||sending} onClick={()=>remove(x.id)}>Delete</button></td></tr>)}{!items.length&&<tr><td colSpan={6}>No customers loaded.</td></tr>}</tbody></table>
  </div>
  {selected!==null&&<div className="card"><h2>Send manual email</h2><p>To: {items.find(x=>x.id===selected)?.email}</p><textarea aria-label="Email message" rows={5} disabled={sending} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write your message"/><div className="row"><button className="btn" disabled={sending||!message.trim()} onClick={send}>{sending?'Sending…':'Send email'}</button><button className="btn btn2" disabled={sending} onClick={()=>{setSelected(null);setMessage('');}}>Close</button></div></div>}
 </main>;
}
