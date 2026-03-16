import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

export default function WhatsAppSimulator() {
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('123-456-7890');
  const [status, setStatus] = useState('');

  const sendOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('Sending...');
    try {
      const res = await fetch('/api/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Order placed successfully!');
        setMessage('');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Failed to send order.');
    }
    
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
      <div className="bg-emerald-500 p-3 text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        <h3 className="font-bold text-sm">WhatsApp Simulator</h3>
      </div>
      <div className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover">
        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl mb-4 text-xs text-slate-700 shadow-sm">
          Try sending an order like:<br/>
          <strong className="font-mono text-emerald-700">"2 milk, 1 bread"</strong><br/>
          Available: Milk, Bread, Eggs
        </div>
        
        <form onSubmit={sendOrder} className="flex flex-col gap-2">
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Your Phone Number"
            className="text-sm p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 text-sm p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500"
            />
            <button 
              type="submit"
              className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
        {status && (
          <div className={`mt-2 text-xs text-center font-medium p-1 rounded ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
