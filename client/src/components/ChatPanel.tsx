import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';

export default function ChatPanel() {
  const { state, sendChat } = useGame();
  const [message, setMessage] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    sendChat(message.trim());
    setMessage('');
  }

  return (
    <div className="flex flex-col bg-white/5 border border-white/10 rounded-2xl h-full max-h-[70vh] lg:max-h-full">
      <div className="px-4 py-3 border-b border-white/10 font-bold text-gold">💬 Chat da sala</div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 min-h-[200px]">
        {state.chat.map((c) => (
          <div key={c.id} className={`text-sm ${c.system ? 'text-white/40 italic' : 'text-white/90'}`}>
            {!c.system && <span className="font-semibold text-gold/90">{c.playerName}: </span>}
            {c.message}
          </div>
        ))}
        {state.chat.length === 0 && <p className="text-white/30 text-sm">Nenhuma mensagem ainda. Provoca a galera!</p>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Pagou caro demais! 😂"
          maxLength={280}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <button type="submit" className="px-3 py-2 rounded-lg bg-gold text-pitch-darker font-bold text-sm">
          Enviar
        </button>
      </form>
    </div>
  );
}
