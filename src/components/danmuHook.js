// src/components/danmuHook.js
// 提供 useDanmu() hook，回傳 addDanmu(text, type)
export function useDanmu(){
  return function addDanmu(text, type="order"){
    const payload = {
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      text,
      type,
      top: Math.floor(Math.random()* (window.innerHeight * 0.6)), // 隨機高度
      duration: 8
    };
    // 發一個 CustomEvent，讓 DanmuOverlay 接收
    window.dispatchEvent(new CustomEvent("gb_danmu", { detail: payload }));
    return payload.id;
  }
}
