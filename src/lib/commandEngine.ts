// ============================================================================
// Pika AI — commandEngine.ts  (Advanced v3 — 70+ rules)
// ============================================================================
import { WEBSITE_LIST } from "./constants";
import { safeCalc } from "./utils";

export interface ParsedCommand {
  category: string;
  action: string;
  params: Record<string, unknown>;
  needsConfirmation: boolean;
  confirmMessage?: string;
}

export interface CommandResult {
  parsed: ParsedCommand | null;
  reply: string;
  toast?: { type: "success" | "error" | "info" | "warning"; message: string };
  openUrl?: string;
  isLLM?: boolean;
}

const NEED_CONFIRM: Record<string, string[]> = {
  system: ["shutdown", "restart", "sleep", "hibernate"],
  files: ["delete", "delete_folder"],
  processes: ["kill"],
  disk: ["cleanup_temp"],
};

function needsConfirm(c: string, a: string): boolean {
  return NEED_CONFIRM[c]?.includes(a) ?? false;
}

type Handler = (m: RegExpMatchArray) => CommandResult;
interface Rule { re: RegExp; handle: Handler; }

function stripFiller(s: string): string {
  // Hindi filler at end: "to jara", "zara", "to", "please", "karke dikhao", "kar do", "ek bar" — strip without removing real app names
  return s.replace(/\s+(?:to\s*jara|jara|zara|to\s*zara|please|karke\s*dikhao|kar\s*do|karo\s*jara|ek\s*bar|thoda|jara\s*sa)\s*$/i, "").trim()
    .replace(/\s+to\s*$/i, "").trim();
}

function cmd(
  category: string, action: string,
  params: Record<string, unknown>, reply: string,
  extra?: Partial<CommandResult>
): CommandResult {
  return {
    parsed: { category, action, params, needsConfirmation: needsConfirm(category, action) },
    reply, ...extra,
  };
}

const RULES: Rule[] = [
  // ══════ SYSTEM & POWER TOOLS ══════
  { re: /(?:shutdown|shut down|switch off|pc band|computer band|band kar)/i, handle: () => cmd("system","shutdown",{delay:30},"⚠️ Shutdown confirm…") },
  { re: /(?:restart|reboot|dobara shuru)/i, handle: () => cmd("system","restart",{delay:30},"⚠️ Restart confirm…") },
  { re: /(?:sleep|so ja|sone do)/i, handle: () => cmd("system","sleep",{},"⚠️ Sleep…") },
  { re: /(?:lock|lok)\s*(?:screen)?/i, handle: () => cmd("system","lock",{},"🔒 Locked",{toast:{type:"success",message:"Locked"}}) },
  { re: /(?:log.?off|log.?out)/i, handle: () => cmd("system","logoff",{},"🚪 Logging out…") },
  { re: /(?:hibernate|hibernet)/i, handle: () => cmd("system","hibernate",{},"⚠️ Hibernate…") },
  { re: /(?:empty\s*recycle\s*bin|recycle\s*bin\s*(?:empty|khali|saaf)|kachra\s*saaf)/i, handle: () => cmd("system","empty_recycle_bin",{},"🗑️ Emptying Recycle Bin…",{toast:{type:"success",message:"Recycle Bin Emptied"}}) },
  { re: /(?:flush\s*dns|dns\s*flush|dns\s*saaf)/i, handle: () => cmd("system","flush_dns",{},"🌐 Flushing DNS…",{toast:{type:"success",message:"DNS Flushed"}}) },
  { re: /(?:clean\s*temp|temp\s*files?\s*saaf|junk\s*saaf)/i, handle: () => cmd("system","temp_clean",{},"🧹 Cleaning Temp files…",{toast:{type:"success",message:"Temp Cleaned"}}) },

  // ══════ FOLDERS & DRIVES ══════
  { re: /(?:open|kholo)\s+(?:folder\s+)?(downloads|documents|desktop|pictures|photos|videos|music)/i, handle: (m) => cmd("apps","open",{name:m[1].toLowerCase() === "photos" ? "pictures" : m[1].toLowerCase()},`📂 Opening ${m[1]}`,{toast:{type:"success",message:`Opening ${m[1]}`}}) },
  { re: /(?:open|kholo)\s+([cde])\s*drive/i, handle: (m) => cmd("files","open_explorer",{path:`${m[1].toUpperCase()}:\\`},`💾 Opening ${m[1].toUpperCase()}: Drive`,{toast:{type:"success",message:`${m[1].toUpperCase()}: Drive`}}) },

  // ══════ VOLUME ══════
  { re: /(?:volume|aawaz|sound)\s*(\d{1,3})/i, handle: (m) => cmd("volume","set",{percent:+m[1]},`🔊 Volume ${m[1]}%`,{toast:{type:"success",message:`Volume ${m[1]}%`}}) },
  { re: /(?:volume up|aawaz badhaao|louder|tez karo)/i, handle: () => cmd("volume","up",{amount:10},"🔊 Volume Up",{toast:{type:"success",message:"Volume +10"}}) },
  { re: /(?:volume down|aawaz kam|quieter|dhimi)/i, handle: () => cmd("volume","down",{amount:10},"🔉 Volume Down",{toast:{type:"success",message:"Volume -10"}}) },
  { re: /^(?:mute|myut)\s*(?:karo)?$/i, handle: () => cmd("volume","mute",{},"🔇 Muted",{toast:{type:"success",message:"Muted"}}) },
  { re: /(?:unmute|aawaz chalu)/i, handle: () => cmd("volume","unmute",{},"🔊 Unmuted") },

  // ══════ BRIGHTNESS ══════
  { re: /(?:brightness|braitnes)\s*(\d{1,3})/i, handle: (m) => cmd("screen","brightness_set",{percent:+m[1]},`☀️ Brightness ${m[1]}%`,{toast:{type:"success",message:`Brightness ${m[1]}%`}}) },
  { re: /(?:brightness up|brightness badhao|brighten|ujala karo)/i, handle: () => cmd("screen","brightness_up",{},"☀️ Brightness Up",{toast:{type:"success",message:"Brightness ↑"}}) },
  { re: /(?:brightness down|brightness kam|dim screen|andhera)/i, handle: () => cmd("screen","brightness_down",{},"🌙 Brightness Down",{toast:{type:"success",message:"Brightness ↓"}}) },

  // ══════ MEDIA ══════
  { re: /(?:next|agla)\s*(?:song|track|gaana)?/i, handle: () => cmd("media","next",{},"⏭️ Next track",{toast:{type:"info",message:"Next track"}}) },
  { re: /(?:previous|prev|pichla)\s*(?:song|track)?/i, handle: () => cmd("media","previous",{},"⏮️ Previous") },
  { re: /(?:play|pause)\s*(?:music|song|media)?/i, handle: () => cmd("media","play_pause",{},"⏯️ Play/Pause",{toast:{type:"info",message:"Play/Pause"}}) },

  // ══════ WINDOW CONTROL ══════
  { re: /(?:minimize|minimise|chhota karo window)\s*(?:window)?/i, handle: () => cmd("window","minimize",{},"⬇️ Minimized",{toast:{type:"success",message:"Minimized"}}) },
  { re: /(?:maximize|maximise|bada karo window)\s*(?:window)?/i, handle: () => cmd("window","maximize",{},"⬆️ Maximized",{toast:{type:"success",message:"Maximized"}}) },
  { re: /(?:full\s*screen|fullscreen)/i, handle: () => cmd("window","fullscreen",{},"🔲 Fullscreen",{toast:{type:"info",message:"Fullscreen toggle"}}) },
  { re: /(?:snap\s*left|left\s*karo\s*window|baayein\s*karo)/i, handle: () => cmd("window","snap_left",{},"⬅️ Snap Left",{toast:{type:"info",message:"Snap Left"}}) },
  { re: /(?:snap\s*right|right\s*karo\s*window|daayein\s*karo)/i, handle: () => cmd("window","snap_right",{},"➡️ Snap Right",{toast:{type:"info",message:"Snap Right"}}) },
  { re: /(?:show desktop|desktop dikhao|sab chhupao)/i, handle: () => cmd("window","show_desktop",{},"🖥️ Show Desktop",{toast:{type:"success",message:"Desktop shown"}}) },
  { re: /(?:switch window|alt tab|agli window)/i, handle: () => cmd("window","switch",{},"🔄 Window switched",{toast:{type:"success",message:"Switched"}}) },
  { re: /(?:close window|khidki band|alt f4)/i, handle: () => cmd("window","close",{},"❌ Window closed",{toast:{type:"success",message:"Window Closed"}}) },

  // ══════ KEYBOARD SHORTCUTS ══════
  { re: /^(?:copy|kopi)\s*(?:karo)?$/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+c"},"📋 Copied",{toast:{type:"success",message:"Copied ✓"}}) },
  { re: /^(?:paste|pest)\s*(?:karo)?$/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+v"},"📋 Pasted",{toast:{type:"success",message:"Pasted ✓"}}) },
  { re: /^(?:cut|kat)\s*(?:karo)?$/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+x"},"✂️ Cut",{toast:{type:"success",message:"Cut ✓"}}) },
  { re: /(?:undo|ctrl.?z|vapis lao)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+z"},"↩️ Undo",{toast:{type:"success",message:"Undo"}}) },
  { re: /(?:redo|ctrl.?y)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+y"},"↪️ Redo",{toast:{type:"success",message:"Redo"}}) },
  { re: /(?:select all|sab chunao)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+a"},"✅ Select All",{toast:{type:"success",message:"Selected All"}}) },
  { re: /(?:new tab|nai tab)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+t"},"🆕 New Tab",{toast:{type:"success",message:"New Tab"}}) },
  { re: /(?:close tab|tab band)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+w"},"❌ Tab Closed",{toast:{type:"success",message:"Tab Closed"}}) },
  { re: /(?:refresh|reload|taza karo)/i, handle: () => cmd("keyboard","hotkey",{keys:"f5"},"🔄 Refreshed",{toast:{type:"success",message:"Refreshed"}}) },
  { re: /(?:task manager|task managar)/i, handle: () => cmd("keyboard","hotkey",{keys:"ctrl+shift+esc"},"⚙️ Task Manager") },
  { re: /(?:press|hotkey|shortcut)\s+(.+)/i, handle: (m) => cmd("keyboard","hotkey",{keys:m[1].trim().toLowerCase().replace(/\s+plus\s+|\s+and\s+/gi,"+").replace(/\s+/g,"+")},`⌨️ ${m[1].trim()}`,{toast:{type:"success",message:`Pressed: ${m[1].trim()}`}}) },
  { re: /(?:type|taaip|likho)\s+(.+)/i, handle: (m) => cmd("keyboard","type",{text:m[1].trim()},`⌨️ Typed`,{toast:{type:"success",message:"Typed ✓"}}) },

  // ══════ APPS ══════
  { re: /(?:mere|mera|pc|computer)\s*(?:mein|me|pe)?\s*(?:kaun\s*kaun\s*se\s*apps?|installed\s*apps?|software|apps?\s*list|konsi\s*app|kya\s*kya\s*install\s*hai)/i, handle: () => cmd("apps","list",{},"📦 Scanning installed apps…",{toast:{type:"info",message:"Scanning apps…"}}) },
  { re: /^(?:apps?\s*list|installed\s*apps?|list\s*apps?|software\s*list|show\s*installed\s*apps)$/i, handle: () => cmd("apps","list",{},"📦 Scanning installed apps…",{toast:{type:"info",message:"Scanning apps…"}}) },
  { re: /(?:close|band karo|quit|exit)\s+(.+)/i, handle: (m) => { const n=stripFiller(m[1].trim()); return cmd("apps","close",{name:n},`❌ Closed ${n}`,{toast:{type:"success",message:`Closed`}}) } },
  // High-priority exact app names — before generic open, with filler strip (fixes "notepad kholo to jara" → notepad)
  { re: /^(?:notepad|editor)(?:\s+(?:kholo|open|launch|to|jara|zara|please))*\s*$/i, handle: () => cmd("apps","open",{name:"notepad"},`📝 Notepad खोल रहा हूँ`,{toast:{type:"success",message:"Notepad"}}) },
  { re: /notepad|editor/i, handle: () => cmd("apps","open",{name:"notepad"},`📝 Notepad खोल रहा हूँ`,{toast:{type:"success",message:"Notepad"}}) },
  { re: /paint|mspaint/i, handle: () => cmd("apps","open",{name:"paint"},`🎨 Paint खोल रहा हूँ`) },
  { re: /(?:calculator|calc)(?:\s+(?:kholo|open))?.*/i, handle: () => cmd("apps","open",{name:"calc"},`🧮 Calculator`) },
  { re: /task manager|taskmgr/i, handle: () => cmd("apps","open",{name:"task manager"},`⚙️ Task Manager`) },
  { re: /file explorer|explorer/i, handle: () => cmd("apps","open",{name:"explorer"},`📂 Explorer`) },
  { re: /(?:open|kholo|launch|start|chalaao|chalao)\s+(?:omniroute|omnoirout|omni\s*route)/i, handle: () => cmd("apps","open",{name:"omniroute"},"🌐 Opening OmniRoute",{openUrl:"http://127.0.0.1:20128",toast:{type:"success",message:"Opening OmniRoute 🌐"}}) },
  { re: /(?:open|kholo|launch|start|chalaao)\s+(.+)/i, handle: (m) => {
    let raw = stripFiller(m[1].trim());
    // If after stripping we got empty or just filler, don't fallback to google
    if (!raw || /^to$/i.test(raw)) return { parsed: null, reply: "", isLLM: true };
    const t=raw.toLowerCase();
      const s=WEBSITE_LIST.find((w)=>w.name.toLowerCase().includes(t)||t.includes(w.name.toLowerCase().split(" ")[0]));
      if(s) return cmd("web","open_site",{name:s.name},`🌐 Opening ${s.name}`,{toast:{type:"success",message:`Opening ${s.name}`}});
      return cmd("apps","open",{name:raw},`🚀 Opening ${raw}`,{toast:{type:"success",message:`Opening`}});
    }},

  // ══════ OBSIDIAN .md direct (bina obsidian prefix) — "open daily_note_...md" fix
  { re: /(?:open|kholo|padho|dikhao)\s+(.+?\.md)\s*$/i, handle: (m) => { const p=stripFiller(m[1].trim()); return cmd("obsidian","read_file",{path:p},`📖 Obsidian: ${p} पढ़ रहा हूँ…`,{toast:{type:"info",message:"Obsidian "+p}}) } },
  { re: /^(.+?\.md)\s*$/i, handle: (m) => { const p=m[1].trim(); if(p.includes(" ")) return {parsed:null,reply:"",isLLM:true}; return cmd("obsidian","read_file",{path:p},`📖 Obsidian: ${p}`) } },
  // ══════ INFO ══════
  { re: /(?:battery|bateri|batery).*?(?:check|status|kitni|level|report|health|percentage)?|(?:check|show|batao|dikhao).*?(?:battery|bateri)/i, handle: () => cmd("info","battery",{},"🔋 Battery info…") },
  { re: /(?:cpu|processor)\s*(?:usage|load)?/i, handle: () => cmd("info","cpu",{},"🖥️ CPU info…") },
  { re: /(?:ram|memory)\s*(?:usage|kitni)?/i, handle: () => cmd("info","ram",{},"💾 RAM info…") },
  { re: /(?:disk|disk space)\s*(?:space|jagah)?/i, handle: () => cmd("info","disk",{},"💿 Disk info…") },
  { re: /(?:ip address|mera ip|my ip)/i, handle: () => cmd("network","ip",{},"🌐 IP info…") },
  { re: /(?:time|samay|clock)\s*(?:kya hai|batao)?/i, handle: () => { const t=new Date().toLocaleTimeString("hi-IN"); return cmd("info","time",{},t); } },
  { re: /(?:date|taarikh|aaj)\s*(?:kya hai|batao)?/i, handle: () => { const d=new Date().toLocaleDateString("hi-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); return cmd("info","date",{},d); } },
  { re: /(?:system info|full report)/i, handle: () => cmd("info","full_report",{},"📊 Full report…") },

  // ══════ WEB ══════
  { re: /(?:internet|google|chrome|web)\s*(?:par|mein|pe)?\s*(.+?)\s*(?:search|khojo|dhundo)\s*(?:karo|kar|kijiye)?$/i, handle: (m) => {
    const q = m[1].replace(/^(?:par|mein|pe)\s*/i, "").trim();
    return cmd("web","search",{query:q},`🔍 Searching: ${q}`,{toast:{type:"info",message:`Searching ${q}`}});
  }},
  { re: /(?:search|sarch|google|khojo|dhundo)\s+(?:for\s+)?(.+?)(?:\s*(?:karo|kar|kijiye|on\s*google|internet\s*par))?$/i, handle: (m) => {
    const q = m[1].replace(/\s*(?:karo|kar|kijiye)$/i, "").trim();
    if (!q || q === "karo" || q === "kar") return { parsed: null, reply: "", isLLM: true };
    return cmd("web","search",{query:q},`🔍 Searching: ${q}`,{toast:{type:"info",message:`Searching ${q}`}});
  }},
  { re: /(?:youtube|yutub)\s*(?:par|mein|me|pr)?\s*(.+?)\s*(?:song|gaana|video)?\s*(?:bajao|play karo|play|chalao|shuru karo)/i, handle: (m) => cmd("web","youtube_play",{query:m[1].trim()},`🎵 YouTube पर ${m[1].trim()} चला रहा हूँ...`,{toast:{type:"success",message:`Playing ${m[1].trim()} 🎵`}}) },
  { re: /(.+?)\s*(?:song|gaana|video)?\s*(?:bajao|play karo|play|chalao)\s*(?:youtube|yutub)\s*(?:mein|par|me|pr)/i, handle: (m) => cmd("web","youtube_play",{query:m[1].trim()},`🎵 YouTube पर ${m[1].trim()} चला रहा हूँ...`,{toast:{type:"success",message:`Playing ${m[1].trim()} 🎵`}}) },
  { re: /(?:play|bajao|chalao)\s*(.+?)\s*(?:song|gaana|video)?\s*(?:on|in|par|mein)?\s*(?:youtube|yutub)/i, handle: (m) => cmd("web","youtube_play",{query:m[1].trim()},`🎵 YouTube पर ${m[1].trim()} चला रहा हूँ...`,{toast:{type:"success",message:`Playing ${m[1].trim()} 🎵`}}) },
  { re: /(?:youtube|yutub)\s*(?:search|par)?\s+(.+)/i, handle: (m) => cmd("web","youtube_search",{query:m[1].trim()},`▶️ YouTube: ${m[1].trim()}`) },
  // Generic: "blue hai pani song bajao" — no youtube word, assume YouTube play
  { re: /^(.+?)\s+(?:song|gaana|gana|music|gaane)\s+(?:bajao|play karo|play|chalao|chala|suno|sunao|sun)/i, handle: (m) => cmd("web","youtube_play",{query:m[1].trim()},`🎵 YouTube पर "${m[1].trim()}" बजा रहा हूँ...`,{toast:{type:"success",message:`Playing: ${m[1].trim()} 🎵`}}) },
  { re: /^(.+?)\s+(?:bajao|bajao na|bajao bhai|play karo|play karo na|chalao|chala do)$/i, handle: (m) => {
    const q = m[1].trim();
    // skip if it's obviously not music (short single word that could be command)
    if (q.split(" ").length < 2) return { parsed: null, reply: "", isLLM: true };
    return cmd("web","youtube_play",{query:q},`🎵 YouTube पर "${q}" बजा रहा हूँ...`,{toast:{type:"success",message:`Playing: ${q} 🎵`}});
  }},
  { re: /(?:weather|mausam)\s*(?:of|in|ka)?\s*(.+)?/i, handle: (m) => cmd("weather","get",{location:m[1]?.trim()||"Delhi"},`🌤️ Weather: ${m[1]?.trim()||"Delhi"}…`) },
  
  // ══════ SOCIAL & COMMUNICATION ══════
  { re: /(?:es name se save hain|is name se save hai)?\s*(?:whatsapp|vatsap).*(?:message|msg|send|bhejo).*(?:hi|hello|hy|hai)/i, handle: () => cmd("apps","whatsapp_msg",{text:"hi"}, `📱 WhatsApp खोल रहा हूँ`) },
  { re: /(.+?)\s*(?:naam se|name se|ko)?.*(?:whatsapp|vatsap).*(?:message|msg|send|bhejo).*(hi|hello|hy|hai)/i, handle: (m) => cmd("apps","whatsapp_msg",{name:m[1].trim(), text:m[2]}, `📱 WhatsApp: ${m[1].trim()} को मैसेज`) },

  // ══════ SCREEN ══════
  { re: /(?:take\s+)?screenshot\s+(?:of\s+)?(.+)/i, handle: (m) => { const w=stripFiller(m[1].trim()); return cmd("screen","screenshot",{window:w, app:w},"📸 Screenshot: "+w+"…",{toast:{type:"info",message:"Capturing "+w}}) } },
  { re: /(?:screenshot|screen shot|screen\s*shot\s*lo|screen\s*shot\s*le|स्क्रीनशॉट)(?:\s+lo|\s+le)?/i, handle: () => cmd("screen","screenshot",{},"📸 Screenshot taken!",{toast:{type:"success",message:"Saved ✓"}}) },
  { re: /(?:start|shuru|chalu|surur?u)\s*(?:screen)?\s*(?:recording|record|रिकॉर्डिंग)/i, handle: () => cmd("screen","start_recording",{},"🎬 Recording started",{toast:{type:"info",message:"Recording…"}}) },
  { re: /(?:stop|ruko|band|rok)\s*(?:screen)?\s*(?:recording|record|रिकॉर्डिंग)?/i, handle: () => cmd("screen","stop_recording",{},"⏹️ Recording stopped",{toast:{type:"success",message:"Saved ✓"}}) },
  { re: /(?:screen\s*recording|recording)\s*(?:ka|ki)?\s*status/i, handle: () => cmd("screen","recording_status",{},"🎬 Status…") },

  // ══════ FILES ══════
  { re: /(?:open|kholo)\s+(?:file)?\s*(?:explorer|folder)\s*(?:in|mein)?\s*(desktop|documents|downloads|pictures|music|videos|.+)?/i, handle: (m) => cmd("files","open_explorer",{path:m[1]?.trim()||"home"},"📂 Explorer opened",{toast:{type:"success",message:"Explorer ✓"}}) },
  { re: /(?:show|list)\s+(?:drives|drive)/i, handle: () => cmd("disk","list_drives",{},"💾 Drives…") },

  // ══════ CLIPBOARD ══════
  { re: /(?:save)\s+(?:clipboard)/i, handle: () => cmd("clipboard","save",{},"💾 Clipboard saved") },
  { re: /(?:clear)\s+(?:clipboard)/i, handle: () => cmd("clipboard","clear",{},"🗑️ Clipboard cleared") },
  { re: /(?:clipboard).+(?:kya|dekho|what)/i, handle: () => cmd("clipboard","get",{},"📋 Clipboard content…") },

  // ══════ PROCESSES ══════
  { re: /(?:list|show)\s+(?:processes|running apps)/i, handle: () => cmd("processes","list",{},"📊 Processes…") },
  { re: /(?:kill|force close)\s+(?:process)?\s+(.+)/i, handle: (m) => cmd("processes","kill",{name_or_pid:m[1].trim()},`⚠️ Kill: ${m[1].trim()}`) },

  // ══════ REMINDERS ══════
  { re: /(?:remind|yaad dilao)\s*(?:me)?\s*(.+?)\s+in\s+(\d+)\s*(min|minute|minutes|hour|hours|sec|second)/i, handle: (m) => {
      const n=+m[2];const u=m[3].toLowerCase();
      const s=u.startsWith("h")?n*3600:u.startsWith("s")?n:n*60;
      return cmd("reminders","create",{text:m[1].trim(),seconds:s},`⏰ Reminder: ${m[1].trim()}`,{toast:{type:"success",message:"Reminder set ✓"}});
    }},
  { re: /(?:set|lagao)\s+(?:timer)\s+(\d+)\s*(min|minute|hour|sec|second)/i, handle: (m) => {
      const n=+m[1];const u=m[2].toLowerCase();
      const s=u.startsWith("h")?n*3600:u.startsWith("s")?n:n*60;
      return cmd("reminders","timer",{seconds:s},`⏱️ Timer: ${n} ${m[2]}`,{toast:{type:"success",message:"Timer set ✓"}});
    }},

  // ══════ CALCULATOR ══════
  { re: /(?:calculate|kitna|what is)\s+(.+)/i, handle: (m) => {
      const r=safeCalc(m[1]);
      return cmd("calculator","eval",{expression:m[1].trim()},r.ok?`🧮 ${m[1].trim()} = ${r.value}`:r.error||"error");
    }},

  // ══════ PASSWORD ══════
  { re: /(?:generate|banao)\s+(?:password)\s*(\d+)?/i, handle: (m) => cmd("password","generate",{length:m[1]?+m[1]:16},"🔐 Password generated") },

  // ══════ TRANSLATOR ══════
  { re: /(?:translate|anuvad)\s+(.+?)\s+(?:to|mein)\s+(hindi|english|french|german|spanish|japanese|chinese)/i, handle: (m) => cmd("translator","translate",{text:m[1].trim(),target_lang:m[2]},`🌍 Translating: ${m[1].trim()}`) },

  // ══════ QR CODE ══════
  { re: /(?:qr|qr code)\s*(?:banao|generate)?\s+(?:for)?\s*(.+)/i, handle: (m) => cmd("qrcode","generate",{data:m[1].trim()},`📱 QR: ${m[1].trim()}`) },

  // ══════ NETWORK ══════
  { re: /(?:speed test|speedtest|internet speed)/i, handle: () => cmd("network","speed_test",{},"⚡ Speed testing…") },
  { re: /(?:list|show)\s+(?:wifi|wi-fi|networks)/i, handle: () => cmd("network","list_wifi",{},"📶 WiFi networks…") },

  // ══════ OCR ══════
  { re: /(?:ocr|read text from screen|screen text)/i, handle: () => cmd("ocr","capture_and_read",{},"👁️ Reading screen text…") },

  // ══════ DISK CLEANUP ══════
  { re: /(?:clean.?up|clean)\s*(?:temp|junk|garbage)?/i, handle: () => cmd("disk","cleanup_temp",{},"⚠️ Cleanup confirm…") },

  // ══════ UI MODE & NAVIGATION VOICE (STANDARD ↔ FUTURIST) ══════
  { re: /(?:futurist|future|futuristic|future\s*mode)\s*(?:mode|on|kholo|chalu|enable)/i, handle: () => cmd("ui","switch_mode",{mode:"futurist"},`🚀 Futurist Mode ON`,{toast:{type:"success",message:"Futurist Mode 🌌"}}) },
  { re: /(?:standard|normal|classic|simple)\s*(?:mode|on|kholo|chalu)/i, handle: () => cmd("ui","switch_mode",{mode:"standard"},`🎨 Standard Mode ON`,{toast:{type:"success",message:"Standard Mode"}}) },
  { re: /(?:clear|saaf|khali|delete)\s*(?:chat|conversation|history|messages?)/i, handle: () => cmd("ui","clear_chat",{},"🧹 Chat saaf kar diya",{toast:{type:"success",message:"Chat cleared"}}) },
  { re: /(?:show|kholo|open)\s*(?:settings|setting)\s*(?:panel)?/i, handle: () => cmd("ui","open_tab",{tab:"settings"},`⚙️ Settings khol raha hoon`) },
  { re: /(?:show|kholo|open)\s*(?:controls?|control\s*panel)/i, handle: () => cmd("ui","open_tab",{tab:"controls"},`🎮 Controls`) },
  { re: /(?:show|kholo|open)\s*(?:tools?|tool\s*panel)/i, handle: () => cmd("ui","open_tab",{tab:"tools"},`🛠️ Tools`) },
  { re: /(?:show|kholo|open)\s*(?:macros?|macro)/i, handle: () => cmd("ui","open_tab",{tab:"macros"},`🔁 Macros`) },
  { re: /(?:show|kholo|open)\s*(?:reminders?|reminder)/i, handle: () => cmd("ui","open_tab",{tab:"reminders"},`⏰ Reminders`) },
  { re: /(?:show|kholo|open)\s*(?:processes?|process|task\s*manager)/i, handle: () => cmd("ui","open_tab",{tab:"processes"},`⚙️ Processes`) },
  { re: /(?:show|kholo|open)\s*(?:scheduler|schedule)/i, handle: () => cmd("ui","open_tab",{tab:"scheduler"},`📅 Scheduler`) },
  { re: /(?:show|kholo|open)\s*(?:chat|home)/i, handle: () => cmd("ui","open_tab",{tab:"chat"},`💬 Chat`) },
  { re: /(?:toggle|switch)\s*(?:theme|dark|light)/i, handle: () => cmd("ui","toggle_theme",{},"🎨 Theme toggled") },

  // ══════ AI PROVIDER ══════
  { re: /(?:switch|badlo|use)\s*(?:to)?\s*(groq|gemini|mistral|cerebras|openrouter|zai|deepseek)/i, handle: (m) => cmd("config","switch_provider",{provider:m[1].toLowerCase()},`🔄 Provider: ${m[1]}`,{toast:{type:"success",message:`Provider: ${m[1]}`}}) },
  // ══════ OBSIDIAN VAULT COMMANDS ══════
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:daily note|aaj ka note|din ka note)\s*(?:banao|likho|kholo)?/i, handle: () => cmd("obsidian","daily_note",{},"📝 Obsidian में आज का डेली नोट बना रहा हूँ...",{toast:{type:"success",message:"Obsidian Daily Note 📝"}}) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:files|notes|list)\s*(?:dikhao|list karo|check karo)?/i, handle: () => cmd("obsidian","list_files",{},"📂 Obsidian की फाइलें ला रहा हूँ...") },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:search|khojo|dhundo)\s+(.+)/i, handle: (m) => cmd("obsidian","search",{query:m[1].trim()},`🔍 Obsidian में सर्च कर रहा हूँ: ${m[1].trim()}`) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:read|padho|kholo)\s+(.+)/i, handle: (m) => cmd("obsidian","read_file",{path:m[1].trim()},`📖 Obsidian नोट पढ़ रहा हूँ: ${m[1].trim()}`) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:note|file)\s*(?:banao|likho)\s+([^\s]+)(?:\s+(?:content|mein|likho|with)\s+(.+))?/i, handle: (m) => cmd("obsidian","create_file",{path:m[1].endsWith(".md")?m[1]:`${m[1]}.md`,content:m[2]||`# ${m[1]}\n\nCreated by Pika AI.`},`📝 Obsidian में नोट बना रहा हूँ: ${m[1]}`,{toast:{type:"success",message:"Note Created 📝"}}) },

  // ══════ MULTIMODAL SCREEN VISION ══════
  { re: /(?:screen\s*(?:par\s*kya\s*hai|dekho|samjhao|analyze)|kya\s*(?:chal|dikha)\s*raha\s*hai|is\s*(?:error|page|screen|photo)\s*(?:ko)?\s*(?:samjhao|explain|read|dekho))/i, handle: (m) => cmd("vision","analyze",{query:m[0]},"👁️ स्क्रीन देख रहा हूँ...",{toast:{type:"info",message:"Screen Vision 👁️"}}) },
  { re: /(?:what\s*is|explain|analyze|describe)\s*(?:on\s*my)?\s*screen/i, handle: (m) => cmd("vision","analyze",{query:m[0]},"👁️ Analyzing screen...",{toast:{type:"info",message:"Screen Vision 👁️"}}) },

  // ══════ BLUETOOTH / WIFI / NETWORK HARDWARE — real toggle (open only fallback) ══════
  { re: /(?:bluetooth|blututh)(?:\s+(on|off|chalu|band|enable|disable|kholo|toggle))?/i, handle: (m) => {
      const t = m[0].toLowerCase();
      const on = /(on|chalu|enable)/.test(t);
      const off = /(off|band|disable)/.test(t);
      const action = on ? "on" : off ? "off" : "toggle";
      return cmd("system","bluetooth",{action, toggle: action},`📶 Bluetooth ${action} — toggle kar raha hoon`,{toast:{type:"success",message:`Bluetooth ${action}`}});
    }},
  { re: /(?:wifi|wi-fi|wify)(?:\s+(on|off|chalu|band|enable|disable|kholo|toggle|connect))?/i, handle: (m) => {
      const t = m[0].toLowerCase();
      const on = /(on|chalu|enable|connect)/.test(t);
      const off = /(off|band|disable)/.test(t);
      const action = on ? "on" : off ? "off" : "toggle";
      return cmd("system","wifi",{action},`📶 WiFi ${action} — toggle`,{toast:{type:"success",message:`WiFi ${action}`}});
    }},
  { re: /(?:airplane|flight)\s*mode\s*(?:on|off|kholo|band|toggle)?/i, handle: (m) => {
      const t = m[0].toLowerCase();
      const on = /on/.test(t); const off = /off|band/.test(t);
      const action = on ? "on" : off ? "off" : "toggle";
      return cmd("system","airplane",{action},`✈️ Airplane ${action}`,{toast:{type:"info",message:`Airplane ${action}`}});
    }},
  { re: /(?:display|screen)\s*(?:settings|kholo|resolution|scale)/i, handle: () => cmd("apps","open",{name:"display"},`🖥️ Display Settings`,{toast:{type:"success",message:"Display"}}) },
  { re: /(?:sound|audio|speaker)\s*(?:settings|kholo|mixer)/i, handle: () => cmd("apps","open",{name:"sound"},`🔊 Sound Settings`,{toast:{type:"success",message:"Sound"}}) },
  { re: /(?:settings|seting)\s*(?:kholo|open)/i, handle: () => cmd("apps","open",{name:"settings"},`⚙️ Settings खोल रहा हूँ`,{toast:{type:"success",message:"Settings"}}) },
  { re: /(?:control panel|control pannel)\s*(?:kholo|open)?/i, handle: () => cmd("apps","open",{name:"control panel"},`🎛️ Control Panel`,{toast:{type:"success",message:"Control Panel"}}) },
  { re: /(?:dark mode|night light|theme)\s*(?:on|off|kholo|lagao)/i, handle: () => cmd("apps","open",{name:"display"},`🌙 Display — Night Light`,{toast:{type:"info",message:"Night Light"}}) },

  // ══════ FULL FILE VOICE CONTROL ══════
  { re: /(?:create|banao|naya)\s+(?:file\s+)?(.+?\.(?:txt|md|json|py|js|html|cpp))\s*(?:mein|me)?\s*(.+)?/i, handle: (m) => cmd("files","create_file",{path:m[1].trim(), content:m[2]||""},`📄 File बना रहा हूँ: ${m[1].trim()}`,{toast:{type:"success",message:"File Created"}}) },
  { re: /(?:create|banao)\s+(?:folder|directory)\s+(.+)/i, handle: (m) => cmd("files","create_folder",{path:m[1].trim()},`📁 Folder बना रहा हूँ: ${m[1].trim()}`,{toast:{type:"success",message:"Folder Created"}}) },
  { re: /(?:read|padho|kholo|dikhao)\s+(?:file\s+)?(.+?\.(?:txt|md|json|py|js|html|log))/i, handle: (m) => cmd("files","read",{path:m[1].trim()},`📖 पढ़ रहा हूँ: ${m[1].trim()}`) },
  { re: /(?:delete|hatao|remove)\s+(?:file\s+)?(.+?\.(?:txt|md|json|py|js|html))/i, handle: (m) => cmd("files","delete",{path:m[1].trim()},`⚠️ Delete confirm: ${m[1].trim()}`) },
  { re: /(?:search|khojo|dhundo)\s+(?:files?|folder)\s+(.+)/i, handle: (m) => cmd("files","list",{path:m[1].trim()},`🔍 Searching files: ${m[1].trim()}`) },
  { re: /(?:rename|naam badlo)\s+(.+?)\s+(?:to|se)\s+(.+)/i, handle: (m) => cmd("files","rename",{path:m[1].trim(), new_path:m[2].trim()},`✏️ Rename: ${m[1].trim()} → ${m[2].trim()}`) },

  // ══════ NOTEPAD / EDITOR / TASK MANAGER DIRECT ══════
  { re: /(?:notepad|editor)\s*(?:kholo|open|launch)?/i, handle: () => cmd("apps","open",{name:"notepad"},`📝 Notepad खोल रहा हूँ`,{toast:{type:"success",message:"Notepad"}}) },
  { re: /(?:paint|mspaint)\s*(?:kholo|open)?/i, handle: () => cmd("apps","open",{name:"paint"},`🎨 Paint खोल रहा हूँ`) },
  { re: /(?:calculator|calc)\s*(?:kholo|open)?/i, handle: () => cmd("apps","open",{name:"calc"},`🧮 Calculator`) },
  { re: /(?:task manager|taskmgr)\s*(?:kholo|open)?/i, handle: () => cmd("apps","open",{name:"task manager"},`⚙️ Task Manager`) },
  { re: /(?:file explorer|explorer)\s*(?:kholo|open)?/i, handle: () => cmd("apps","open",{name:"explorer"},`📂 Explorer`) },
  { re: /(?:terminal|cmd|powershell)\s*(?:kholo|open)?/i, handle: (m) => cmd("apps","open",{name:m[0].toLowerCase().includes("powershell")?"powershell":m[0].toLowerCase().includes("cmd")?"cmd":"terminal"},`💻 Terminal`) },

  // ══════ UIA / CURSOR — additive, high-priority cursor (bina purana hataye) ══════
  { re: /cursor\s*(?:ko)?\s*(?:center|beech|middle)\s*(?:le\s*jao|lao|karo)?/i, handle: () => cmd("uia","move",{x:960,y:540},`🖱️ Cursor center → (960,540)`,{toast:{type:"success",message:"Center"}}) },
  { re: /(?:right\s*click|right\s*click\s*karo|daaya\s*click|daya\s*click|right\s*click\s*kar)/i, handle: () => cmd("uia","right_click",{},`🖱️ Right click`) },
  { re: /(?:double\s*click|double\s*click\s*karo|do\s*bar\s*click|double\s*click\s*kar)/i, handle: () => cmd("uia","double_click",{},`🖱️ Double click`) },
  { re: /(?:drag|kheecho|drag\s*&?\s*drop|kheench)\s*(?:from\s*)?(\d+)\s*[, ]\s*(\d+)\s*(?:to|tak|se)?\s*(\d+)\s*[, ]\s*(\d+)/i, handle: (m) => cmd("uia","drag",{x:+m[1],y:+m[2],x2:+m[3],y2:+m[4]},`🖱️ Drag (${m[1]},${m[2]})→(${m[3]},${m[4]})`) },
  { re: /(?:move|le\s*jao)\s*(?:cursor\s*)?(?:to\s*)?(\d+)\s*[, ]\s*(\d+)/i, handle: (m) => cmd("uia","move",{x:+m[1],y:+m[2]},`🖱️ Move (${m[1]},${m[2]})`) },
  { re: /(?:is|yeh|ye|us)\s*(?:button|batan)\s*(?:pe|par)?\s*(?:click\s*karo|click|dabao)/i, handle: (m) => cmd("uia","click",{name:"button", text:"button"},`🖱️ Button click (image/OCR) — template upload ya OCR`) },
  { re: /(?:dusre|dusra|second|monitor\s*2)\s*(?:monitor|screen)\s*(?:pe|par)?\s*(?:click|j ao)?/i, handle: () => cmd("uia","get_monitors",{},`🖥️ Monitors check`) },
  { re: /(?:click|tap)\s*(?:on\s+)?(.+)?/i, handle: (m) => { const n=stripFiller(m[1]?.trim()||""); if(n && /(button|batan)/i.test(n)) return cmd("uia","find_text",{text:n},`🔍 OCR find: ${n}`); return cmd("uia","click",{name:n, text:n},`🖱️ Click: ${n||"center"}`) } },
  { re: /(?:scroll|niche|upar)\s*(?:karo|kar)?\s*(up|down)?/i, handle: (m) => cmd("uia","scroll",{direction:m[1]||"down"},`↕️ Scroll ${m[1]||"down"}`) },
  { re: /(?:yahan|yahaan)\s*(?:type\s*karo|likho|type)\s*[:\-]?\s*(.+)/i, handle: (m) => cmd("uia","type",{text:m[1].trim()},`⌨️ Type: ${m[1].trim().slice(0,30)}`) },
  { re: /(?:browser|chrome|edge)\s*(?:mein|me)?\s*(.+?)\s*(?:kholo|open|jao)/i, handle: (m) => cmd("browser","open",{url:m[1].trim()},`🌐 Browser: ${m[1].trim()}`) },
  { re: /(?:connect|jodo)\s+(gmail|calendar|slack|notion|github|drive)/i, handle: (m) => cmd("connectors","connect",{id:m[1].toLowerCase()},`🔌 Connecting ${m[1]}`) },
  { re: /(?:disconnect|hatao)\s+(gmail|calendar|slack|notion|github|drive)/i, handle: (m) => cmd("connectors","disconnect",{id:m[1].toLowerCase()},`🔌 Disconnected ${m[1]}`) },

  // ══════ DESKTOP .TXT DAILY NOTE — exact Hindi fix (additive)
  { re: /desktop\s*(?:pr|par|pe|mein)?\s*(?:\.txt|txt)?\s*(?:mein)?\s*(?:daily\s*note|note)?\s*(?:banao|create)/i, handle: () => {
    const d=new Date().toISOString().slice(0,10).replace(/-/g,"_");
    const p=`Desktop/daily_note_${d}.txt`;
    return cmd("files","create_file",{path:p, content:`# Daily Note ${d}\n\n- Battery: via info\n- Tasks: aaj ke kaam\n- Context: memory vault se\n\nGenerated by Pika`},`📄 Desktop pe daily note bana raha hoon: ${p}`,{toast:{type:"info",message:"Desktop daily note"}})
  } },
  // ══════ CALENDAR (additive — bina hataye) ══════
  { re: /(?:calendar|calender)\s*(?:me|mein)?\s*(?:events?|list|dikhao|kya hai)/i, handle: () => cmd("calendar","list",{},`📅 Calendar events la raha hoon`) },
  { re: /(?:calendar|calender)\s*(?:me|mein)?\s*(?:free|khali|available)\s*(?:kab|time|slot)?/i, handle: () => cmd("calendar","find_available_times",{},`📅 Free slots check kar raha hoon`) },
  { re: /(?:calendar|calender)\s*(?:me|mein)?\s*(?:add|banao|create)\s+(.+?)(?:\s+at\s+(.+))?/i, handle: (m) => cmd("calendar","create_event",{title:m[1].trim(), when:m[2]?.trim()||""},`📅 Event: ${m[1].trim()}`) },
  // ══════ SCHEDULER VOICE ══════
  { re: /(?:schedule|shuru karo)\s+(.+?)\s+(?:har|every)\s*(.+)/i, handle: (m) => cmd("scheduler","add",{name:m[1].trim(), command:m[1].trim(), schedule:`every ${m[2].trim()}`},`⏰ Schedule: ${m[1].trim()} every ${m[2].trim()}`) },
  { re: /(?:scheduled|shudule)\s*(?:tasks?|jobs?)?\s*(?:dikhao|list|kya hai)/i, handle: () => cmd("scheduler","list",{},`⏰ Scheduled jobs dikha raha hoon`) },

  // ══════ LONG-TERM MEMORY VAULT ══════
  { re: /(?:yaad|yad)\s*(?:rakho|rakhna)\s*(?:ki|ye)?\s*(.+)/i, handle: (m) => cmd("memory","add",{fact:m[1].trim()},`🧠 याद रख रहा हूँ: ${m[1].trim()}`,{toast:{type:"success",message:"Memory Saved 🧠"}}) },
  { re: /(?:meri|mera)\s*(?:profile|yaadein|memory|facts)\s*(?:dikhao|kya hai|batao|check)/i, handle: () => cmd("memory","get",{},"🧠 मेमोरी वॉल्ट खोल रहा हूँ...") },
  { re: /(?:memory|yaadein)\s*(?:delete|clear|saaf)\s*(?:karo|kar)/i, handle: () => cmd("memory","clear",{},"🧹 मेमोरी वॉल्ट खाली कर रहा हूँ...",{toast:{type:"info",message:"Memory Cleared 🧹"}}) },

  // ══════ ULTRA-FAST INSTANT CONVERSATION ══════
  { re: /^(?:hii+|hey+|hello+|namaste|pranam|namaskar|salaam|yo)\b/i, handle: () => ({ parsed: null, reply: "नमस्ते! 😊 मैं पिका हूँ। बताओ आज क्या करना है?", isLLM: false }) },
  { re: /^(?:kaise\s*ho|kaisa\s*hai|how\s*are\s*you|kya\s*haal\s*hai)\b/i, handle: () => ({ parsed: null, reply: "मैं बिल्कुल बढ़िया और तैयार हूँ! ⚡ बताओ क्या काम करना है?", isLLM: false }) },
  { re: /^(?:thank\s*you|shukriya|dhanyawad|thanks|dhanyawaad)\b/i, handle: () => ({ parsed: null, reply: "अरे कोई बात नहीं दोस्त! 😊 कभी भी याद कर लेना।", isLLM: false }) },
  { re: /^(?:bye|alvida|good\s*night|chalta\s*hoon)\b/i, handle: () => ({ parsed: null, reply: "बाय बाय! 👋 अपना ध्यान रखना, फिर मिलेंगे!", isLLM: false }) },
  { re: /(?:tera\s*naam|aap\s*ka\s*naam|tum\s*kaun)\s*(?:ho|hai)?/i, handle: () => ({ parsed: null, reply: "Main Pika hoon! ⚡ Tumhara personal AI assistant. Batao kya help chahiye?", isLLM: false }) },
  { re: /(?:kitna\s*baja|time\s*batao|samay\s*batao)/i, handle: () => { const t=new Date().toLocaleTimeString("hi-IN"); return { parsed: null, reply: `⏰ अभी ${t} बज रहे हैं`, isLLM: false }; } },
  { re: /(?:hey\s*pika|pika\s*sun|pika\s*suno|pika\s*help)/i, handle: () => ({ parsed: null, reply: "Haan bhai! 😊 Batao kya chahiye?", isLLM: false }) },
];

export function parseCommand(text: string): CommandResult {
  const trimmed = text.trim();
  for (const rule of RULES) {
    const m = trimmed.match(rule.re);
    if (m) return rule.handle(m);
  }
  return { parsed: null, reply: "", isLLM: true };
}
