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
  // ══════ SYSTEM ══════
  { re: /(?:shutdown|shut down|switch off|pc band|computer band|band kar)/i, handle: () => cmd("system","shutdown",{delay:30},"⚠️ Shutdown confirm…") },
  { re: /(?:restart|reboot|dobara shuru)/i, handle: () => cmd("system","restart",{delay:30},"⚠️ Restart confirm…") },
  { re: /(?:sleep|so ja|sone do)/i, handle: () => cmd("system","sleep",{},"⚠️ Sleep…") },
  { re: /(?:lock|lok)\s*(?:screen)?/i, handle: () => cmd("system","lock",{},"🔒 Locked",{toast:{type:"success",message:"Locked"}}) },
  { re: /(?:log.?off|log.?out)/i, handle: () => cmd("system","logoff",{},"🚪 Logging out…") },
  { re: /(?:hibernate|hibernet)/i, handle: () => cmd("system","hibernate",{},"⚠️ Hibernate…") },

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
  { re: /(?:maximize|maximise|bada karo window|fullscreen)\s*(?:window)?/i, handle: () => cmd("window","maximize",{},"⬆️ Maximized",{toast:{type:"success",message:"Maximized"}}) },
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
  { re: /(?:close|band karo|quit|exit)\s+(.+)/i, handle: (m) => cmd("apps","close",{name:m[1].trim()},`❌ Closed ${m[1].trim()}`,{toast:{type:"success",message:`Closed`}}) },
  { re: /(?:open|kholo|launch|start|chalaao)\s+(.+)/i, handle: (m) => {
      const t=m[1].trim().toLowerCase();
      const s=WEBSITE_LIST.find((w)=>w.name.toLowerCase().includes(t)||t.includes(w.name.toLowerCase().split(" ")[0]));
      if(s) return cmd("web","open_site",{name:s.name},`🌐 Opening ${s.name}`,{toast:{type:"success",message:`Opening ${s.name}`}});
      return cmd("apps","open",{name:m[1].trim()},`🚀 Opening ${m[1].trim()}`,{toast:{type:"success",message:`Opening`}});
    }},

  // ══════ INFO ══════
  { re: /(?:battery|bateri)\s*(?:kitni|level)?/i, handle: () => cmd("info","battery",{},"🔋 Battery info…") },
  { re: /(?:cpu|processor)\s*(?:usage|load)?/i, handle: () => cmd("info","cpu",{},"🖥️ CPU info…") },
  { re: /(?:ram|memory)\s*(?:usage|kitni)?/i, handle: () => cmd("info","ram",{},"💾 RAM info…") },
  { re: /(?:disk|disk space)\s*(?:space|jagah)?/i, handle: () => cmd("info","disk",{},"💿 Disk info…") },
  { re: /(?:ip address|mera ip|my ip)/i, handle: () => cmd("network","ip",{},"🌐 IP info…") },
  { re: /(?:time|samay|clock)\s*(?:kya hai|batao)?/i, handle: () => { const t=new Date().toLocaleTimeString("hi-IN"); return cmd("info","time",{},t); } },
  { re: /(?:date|taarikh|aaj)\s*(?:kya hai|batao)?/i, handle: () => { const d=new Date().toLocaleDateString("hi-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); return cmd("info","date",{},d); } },
  { re: /(?:system info|full report)/i, handle: () => cmd("info","full_report",{},"📊 Full report…") },

  // ══════ WEB ══════
  { re: /(?:search|sarch|google)\s*(?:for|karo)?\s+(.+)/i, handle: (m) => cmd("web","search",{query:m[1].trim()},`🔍 Searching: ${m[1].trim()}`,{toast:{type:"info",message:"Searching…"}}) },
  { re: /(?:youtube|yutub)\s*(?:search|par)?\s+(.+)/i, handle: (m) => cmd("web","youtube_search",{query:m[1].trim()},`▶️ YouTube: ${m[1].trim()}`) },
  { re: /(.+?)\s*(?:song|gaana|video)?\s*(?:bajao|play karo|play|chalao)\s*(?:youtube|yutub)\s*(?:mein|par|me|pr)/i, handle: (m) => cmd("web","youtube_search",{query:m[1].trim()},`▶️ YouTube: ${m[1].trim()}`) },
  { re: /(?:play|bajao|chalao)\s*(.+?)\s*(?:on|in|par|mein)?\s*(?:youtube|yutub)/i, handle: (m) => cmd("web","youtube_search",{query:m[1].trim()},`▶️ YouTube: ${m[1].trim()}`) },
  { re: /(?:weather|mausam)\s*(?:of|in|ka)?\s*(.+)?/i, handle: (m) => cmd("weather","get",{location:m[1]?.trim()||"Delhi"},`🌤️ Weather: ${m[1]?.trim()||"Delhi"}…`) },
  
  // ══════ SOCIAL & COMMUNICATION ══════
  { re: /(?:es name se save hain|is name se save hai)?\s*(?:whatsapp|vatsap).*(?:message|msg|send|bhejo).*(?:hi|hello|hy|hai)/i, handle: () => cmd("apps","whatsapp_msg",{text:"hi"}, `📱 WhatsApp खोल रहा हूँ`) },
  { re: /(.+?)\s*(?:naam se|name se|ko)?.*(?:whatsapp|vatsap).*(?:message|msg|send|bhejo).*(hi|hello|hy|hai)/i, handle: (m) => cmd("apps","whatsapp_msg",{name:m[1].trim(), text:m[2]}, `📱 WhatsApp: ${m[1].trim()} को मैसेज`) },

  // ══════ SCREEN ══════
  { re: /(?:screenshot|screen shot)/i, handle: () => cmd("screen","screenshot",{},"📸 Screenshot taken!",{toast:{type:"success",message:"Saved ✓"}}) },
  { re: /(?:start|shuru)\s*(?:screen)?\s*(?:recording|record)/i, handle: () => cmd("screen","start_recording",{},"🎬 Recording started",{toast:{type:"info",message:"Recording…"}}) },
  { re: /(?:stop|ruko|band)\s*(?:recording)/i, handle: () => cmd("screen","stop_recording",{},"⏹️ Recording stopped",{toast:{type:"success",message:"Saved ✓"}}) },

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

  // ══════ AI PROVIDER ══════
  { re: /(?:switch|badlo|use)\s*(?:to)?\s*(groq|gemini|mistral|cerebras|openrouter|zai|deepseek)/i, handle: (m) => cmd("config","switch_provider",{provider:m[1].toLowerCase()},`🔄 Provider: ${m[1]}`,{toast:{type:"success",message:`Provider: ${m[1]}`}}) },
  // ══════ OBSIDIAN VAULT COMMANDS ══════
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:daily note|aaj ka note|din ka note)\s*(?:banao|likho|kholo)?/i, handle: () => cmd("obsidian","daily_note",{},"📝 Obsidian में आज का डेली नोट बना रहा हूँ...",{toast:{type:"success",message:"Obsidian Daily Note 📝"}}) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:files|notes|list)\s*(?:dikhao|list karo|check karo)?/i, handle: () => cmd("obsidian","list_files",{},"📂 Obsidian की फाइलें ला रहा हूँ...") },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:search|khojo|dhundo)\s+(.+)/i, handle: (m) => cmd("obsidian","search",{query:m[1].trim()},`🔍 Obsidian में सर्च कर रहा हूँ: ${m[1].trim()}`) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:read|padho|kholo)\s+(.+)/i, handle: (m) => cmd("obsidian","read_file",{path:m[1].trim()},`📖 Obsidian नोट पढ़ रहा हूँ: ${m[1].trim()}`) },
  { re: /(?:obsidian)\s*(?:me|mein)?\s*(?:note|file)\s*(?:banao|likho)\s+([^\s]+)(?:\s+(?:content|mein|likho|with)\s+(.+))?/i, handle: (m) => cmd("obsidian","create_file",{path:m[1].endsWith(".md")?m[1]:`${m[1]}.md`,content:m[2]||`# ${m[1]}\n\nCreated by Pika AI.`},`📝 Obsidian में नोट बना रहा हूँ: ${m[1]}`,{toast:{type:"success",message:"Note Created 📝"}}) },

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
