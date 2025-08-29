// src/pages/Town.jsx
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";

const SPEED = 4;

export default function Town() {
  const { uid, profile, updatePosition } = usePlayer();
  const [players, setPlayers] = useState({});
  const keysRef = useRef({});

  // 簡單假玩家（不接 Firebase，只畫自己）
  useEffect(() => {
    setPlayers({ [uid]: profile });
  }, [profile, uid]);

  // 鍵盤事件
  useEffect(() => {
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"].includes(k)) {
        e.preventDefault();
        keysRef.current[k] = true;
        console.log("keydown", k);
      }
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"].includes(k)) {
        keysRef.current[k] = false;
        console.log("keyup", k);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // 移動 loop
  useEffect(() => {
    let raf;
    const tick = () => {
      let { x = 300, y = 300, dir = "down" } = profile;
      const k = keysRef.current;
      let moved = false;

      if (k.w || k.arrowup) { y -= SPEED; dir = "up"; moved = true; }
      if (k.s || k.arrowdown) { y += SPEED; dir = "down"; moved = true; }
      if (k.a || k.arrowleft) { x -= SPEED; dir = "left"; moved = true; }
      if (k.d || k.arrowright) { x += SPEED; dir = "right"; moved = true; }

      if (moved) {
        console.log("move to", x, y);
        updatePosition(x, y, dir);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profile, updatePosition]);

  // 畫玩家
  return (
    <div>
      {Object.entries(players).map(([id, p]) => (
        <div
          key={id}
          style={{
            position: "fixed",
            left: (p.x ?? 300) - 20,
            top: (p.y ?? 300) - 20,
            width: 40,
            height: 40,
            background: id === uid ? "tomato" : "skyblue",
            borderRadius: "50%",
          }}
        />
      ))}
    </div>
  );
}
