import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Chat from "./pages/Chat";
import AddData from "./pages/AddData";

function Nav() {
  return (
    <nav className="border-b border-stone-800 bg-stone-900/50 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-6">
        <NavLink
          to="/"
          className={({ isActive }: { isActive: boolean }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-emerald-400" : "text-stone-400 hover:text-stone-200"}`
          }
        >
          Chat
        </NavLink>
        <NavLink
          to="/add"
          className={({ isActive }: { isActive: boolean }) =>
            `text-sm font-medium transition-colors ${isActive ? "text-emerald-400" : "text-stone-400 hover:text-stone-200"}`
          }
        >
          Add data
        </NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="pb-8">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/add" element={<AddData />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
