import AsyncStorage from '@react-native-async-storage/async-storage';
export type QueuedOp = { id:string; type:'milk-collection'|'payment'|'advance'; payload:any; createdAt:number; retries:number };
const KEY='milkey_offline_queue_v1';

export async function getQueue():Promise<QueuedOp[]>{ try{ const s=await AsyncStorage.getItem(KEY); return s?JSON.parse(s):[]; }catch{ return []; } }
export async function setQueue(q:QueuedOp[]){ await AsyncStorage.setItem(KEY, JSON.stringify(q)); }
export async function enqueue(op:Omit<QueuedOp,'id'|'createdAt'|'retries'>){
  const q=await getQueue();
  q.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), createdAt:Date.now(), retries:0, ...op } as QueuedOp);
  await setQueue(q); return q.length;
}
export async function dequeue(id:string){ const q=await getQueue(); await setQueue(q.filter(x=>x.id!==id)); }
export async function clearQueue(){ await AsyncStorage.removeItem(KEY); }

export async function syncQueue(apiCall: (op:QueuedOp)=>Promise<boolean>){
  const q=await getQueue(); if(!q.length) return { synced:0, failed:0 };
  let synced=0, failed=0;
  for(const op of q){
    try{
      const ok = await apiCall(op);
      if(ok){ await dequeue(op.id); synced++; } else { failed++; }
    }catch{ failed++; }
  }
  return { synced, failed };
}

// Helper to check online via fetch (NetInfo optional if installed)
export async function isOnlineNow(): Promise<boolean>{
  try{
    const mod:any = (()=>{ try{ return require('@react-native-community/netinfo'); } catch{ return null; } })();
    if(mod?.fetch){
      const state = await mod.fetch();
      if(state && typeof state.isConnected==='boolean') return !!state.isConnected;
    }
  }catch{}
  try{
    const ctrl = new AbortController(); const t=setTimeout(()=>ctrl.abort(),3000);
    const r = await fetch('https://www.google.com/generate_204',{ method:'HEAD', signal:ctrl.signal } as any);
    clearTimeout(t); return r.ok || (r as any).type==='opaque';
  }catch{ return false; }
}
