// src/components/LoginGate.jsx
import React, { useImperativeHandle, useRef, useState, forwardRef } from "react";
import Login from "./auth/Login.jsx";
import Signup from "./auth/Signup.jsx";
import { usePlayer } from "../store/playerContext.jsx";

function LoginGateImpl(_, ref) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const resumeActionRef = useRef(null);
  const { registerLoginGate } = usePlayer() || {};

  useImperativeHandle(ref, () => ({
    open: ({ to = "login", resumeAction } = {}) => {
      setMode(to);
      resumeActionRef.current = resumeAction || null;
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  // 讓 PlayerProvider 能拿到 open/close
  registerLoginGate?.({ open: ({to,resumeAction}) => setOpen(true) || setMode(to||"login") || (resumeActionRef.current = resumeAction||null), close: () => setOpen(false) });

  if (!open) return null;

  return (
    <div style={wrap}>
      <div style={{position:"absolute", inset:0, background:"rgba(0,0,0,.4)"}} onClick={()=>setOpen(false)} />
      <div style={{position:"relative", zIndex:1}}>
        {mode === "login" ? (
          <Login
            onClose={() => setOpen(false)}
            goSignup={() => setMode("signup")}
            resumeAction={() => { resumeActionRef.current?.(); resumeActionRef.current = null; }}
          />
        ) : (
          <Signup
            onClose={() => setOpen(false)}
            goLogin={() => setMode("login")}
            resumeAction={() => { resumeActionRef.current?.(); resumeActionRef.current = null; }}
          />
        )}
      </div>
    </div>
  );
}

const LoginGate = forwardRef(LoginGateImpl);
export default LoginGate;

const wrap = { position:"fixed", inset:0, display:"grid", placeItems:"center", zIndex:100 };
