import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { k:"Ctrl + K", d:"Command Palette — किसी भी फीचर पर जाओ" },
  { k:"Ctrl + Space", d:"Push-to-Talk — माइक ऑन/ऑफ" },
  { k:"F", d:"Fullscreen toggle" },
  { k:"?", d:"यह Shortcuts Help" },
  { k:"Esc", d:"Palette / Dialog बंद करो" },
];

export function ShortcutsHelp(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.key==="?" && (e.target as HTMLElement)?.tagName!=="INPUT" && (e.target as HTMLElement)?.tagName!=="TEXTAREA"){
        e.preventDefault(); setOpen(v=>!v);
      }
      if(e.key==="Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[open]);
  return (
    <>
      <button onClick={()=>setOpen(true)} title="Shortcuts (?)" className="fixed bottom-4 right-4 z-30 hidden lg:flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10">
        <Keyboard size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setOpen(false)} className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{y:12, opacity:0}} animate={{y:0, opacity:1}} exit={{y:8, opacity:0}} onClick={e=>e.stopPropagation()} className="w-full max-w-md rounded-2xl glass-strong border border-white/15 p-5">
              <div className="mb-3 flex items-center gap-2 text-white"><Keyboard size={18} style={{color:"var(--accent)"}} /> <span className="font-semibold">शॉर्टकट्स</span><span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">?</span></div>
              <div className="space-y-2">
                {SHORTCUTS.map(s=>(
                  <div key={s.k} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-xs text-white/60">{s.d}</span>
                    <code className="rounded bg-[var(--accent)]/20 px-2 py-1 text-xs font-mono text-[var(--accent)] border border-[var(--accent)]/20">{s.k}</code>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-white/30">Hint: Futurist / Standard toggle TopBar में है • Ctrl+K से सब कुछ 1 सेकंड में</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
