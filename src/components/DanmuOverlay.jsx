// src/components/DanmuOverlay.jsx
import React, { useEffect, useState } from "react";

export default function DanmuOverlay(){
  // 由 window 全域事件收到彈幕 (用 CustomEvent 來簡單廣播)
  const [danmus, setDanmus] = useState([]);

  useEffect(()=>{
    function handler(e){
      const payload = e.detail;
      setDanmus(prev => [...prev, payload]);
      // 自動清除 (在 addDanmu 裡面也會 set timeout)
      setTimeout(()=> setDanmus(prev => prev.filter(d=> d.id !== payload.id)), 8500);
    }
    window.addEventListener("gb_danmu", handler);
    return ()=> window.removeEventListener("gb_danmu", handler);
  },[]);

  return (
    <div style={{position:"fixed", left:0, top:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:9999}}>
      {danmus.map(d=> (
        <div key={d.id}
          className={`danmu-item ${d.type==="order" ? "danmu-order" : "danmu-chat"}`}
          style={{ top: d.top, right: "-10%", animationDuration: (d.duration || 8) + "s" }}
        >
          {d.text}
        </div>
      ))}
    </div>
  );
}
