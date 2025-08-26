// src/components/ChatBox.jsx
import React, { useEffect, useState } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";
import { useDanmu } from "./danmuHook";

export default function ChatBox(){
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const addDanmu = useDanmu();

  useEffect(()=>{
    const chatRef = ref(db, "chat");
    return onValue(chatRef, snap=>{
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, d])=>({ id, ...d }));
      arr.sort((a,b)=> a.createdAt - b.createdAt);
      setMsgs(arr);
    });
  }, []);

  async function handleSend(){
    if(!text.trim()) return;
    const payload = { name: "訪客", text: text.trim(), createdAt: Date.now() };
    await push(ref(db, "chat"), payload);
    addDanmu(`${payload.name}: ${payload.text}`, "chat");
    setText("");
  }

  return (
    <div className="card">
      <h3>即時聊天</h3>
      <div style={{maxHeight:160, overflowY:"auto", border:"1px solid #eef2f7", padding:8, borderRadius:8, marginTop:8}}>
        {msgs.map(m=> <div key={m.id} style={{marginBottom:6}}><strong>{m.name}:</strong> {m.text}</div>)}
        {msgs.length===0 && <div style={{color:"#64748b"}}>尚無訊息</div>}
      </div>

      <div style={{display:"flex", gap:8, marginTop:8}}>
        <input className="input" placeholder="輸入訊息" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=> e.key==="Enter" && handleSend()} />
        <button className="button" onClick={handleSend}>送出</button>
      </div>
    </div>
  );
}

