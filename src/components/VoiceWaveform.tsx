import { motion } from "framer-motion";

// 20-bar audio visualizer driven by amplitude data (0-1)
export function VoiceWaveform({ data }: { data: number[] }) {
  return (
    <div className="flex h-10 items-center justify-center gap-1">
      {data.map((v, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-400"
          animate={{ height: `${Math.max(4, v * 40)}px` }}
          transition={{ duration: 0.1 }}
        />
      ))}
    </div>
  );
}
