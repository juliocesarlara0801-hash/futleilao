import React from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';

interface LocalPassDeviceProps {
  teamName: string;
  ownerName: string;
  subtitle?: string;
  onReady: () => void;
}

export default function LocalPassDevice({ teamName, ownerName, subtitle, onReady }: LocalPassDeviceProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 bg-pitch-darker flex flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="text-6xl">📱➡️</div>
      <div>
        <p className="text-white/60 text-lg">Passe o aparelho para</p>
        <h2 className="text-4xl sm:text-5xl font-extrabold text-gold mt-1">{ownerName}</h2>
        <p className="text-white/50 mt-1">({teamName})</p>
      </div>
      {subtitle && <p className="text-white/70 max-w-xs">{subtitle}</p>}
      <Button onClick={onReady} className="text-lg px-8 py-4">
        👀 Sou eu, pode mostrar
      </Button>
      <p className="text-white/30 text-xs max-w-xs">Os outros não devem olhar a tela agora — o lance é secreto até o fim da rodada.</p>
    </motion.div>
  );
}
