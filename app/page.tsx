import ChatWindow from './components/ChatWindow';

export default function HomePage() {
  return (
    <div className="rounded-3xl bg-slate-900/60 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">BarberAI</h1>
          <p className="text-sm text-slate-300">
            Virtual barber assistant for smooth bookings, fresh advice, and friendly service.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-300">
          Always Fresh
        </span>
      </header>
      <ChatWindow />
    </div>
  );
}
