'use client';

import { MessageCircle, Send, Smile } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatMessage { id: number; text: string; sender: 'patient' | 'provider'; time: string; }

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, text: 'Hello James, I can see you. How have you been feeling today?', sender: 'provider', time: '14:02' },
    { id: 2, text: 'Much better, thank you doctor. The fever reduced last night.', sender: 'patient', time: '14:03' },
    { id: 3, text: 'That is good to hear. I will send a short prescription after this call.', sender: 'provider', time: '14:04' }
  ]);
  const [message, setMessage] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); const text = message.trim(); if (!text) return; setMessages((current) => [...current, { id: Date.now(), text, sender: 'patient', time: 'Now' }]); setMessage(''); }
  return <div className="flex h-full min-h-96 flex-col rounded-xl border border-[var(--color-gray-200)] bg-white"><div className="flex items-center gap-2 border-b border-[var(--color-gray-100)] px-4 py-3"><MessageCircle className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-extrabold">Secure chat</h2><span className="ml-auto text-[11px] font-semibold text-[var(--color-gray-500)]">End-to-end protected</span></div><div className="flex-1 space-y-4 overflow-y-auto p-4">{messages.map((item) => <div key={item.id} className={`flex ${item.sender === 'patient' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${item.sender === 'patient' ? 'rounded-br-md bg-[var(--color-primary)] text-white' : 'rounded-bl-md bg-[var(--color-gray-100)] text-[var(--color-gray-700)]'}`}><p>{item.text}</p><p className={`mt-1 text-[10px] ${item.sender === 'patient' ? 'text-green-100' : 'text-[var(--color-gray-500)]'}`}>{item.time}</p></div></div>)}</div><form onSubmit={submit} className="flex gap-2 border-t border-[var(--color-gray-100)] p-3"><Button type="button" variant="ghost" size="icon" aria-label="Add emoji"><Smile className="h-4 w-4" /></Button><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a secure message…" aria-label="Chat message" /><Button type="submit" size="icon" aria-label="Send message"><Send className="h-4 w-4" /></Button></form></div>;
}
