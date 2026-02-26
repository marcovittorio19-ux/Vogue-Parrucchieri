import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

/* ================= DURATE ESATTE ================= */

const DURATE_SERVIZI = {
  "Taglio": 30,
  "Taglio e barba": 45,
  "Taglio e piega": 75,
  "Taglio piega e colore": 125,
  "Piega e colore": 90,
  "Piega": 30
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [miePrenotazioni, setMiePrenotazioni] = useState([]);
  const [occupiedSlots, setOccupiedSlots] = useState([]);

  const [form, setForm] = useState({
    nome: "",
    telefono: "",
    servizio: "",
    parrucchiere: "",
    data: "",
    ora: ""
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (form.data && form.parrucchiere) {
      fetchOccupiedSlots();
    }
  }, [form.data, form.parrucchiere]);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      if (!data.user.email_confirmed_at) {
        alert("Devi confermare la mail prima di entrare.");
        await supabase.auth.signOut();
        return;
      }

      setUser(data.user);

      const { data: profilo } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profilo?.role === "admin") {
        setRole("admin");
        fetchPrenotazioni();
      } else {
        setRole("user");
        fetchMiePrenotazioni(data.user.id);
      }
    }
  };

  /* ================= ORARI 15 MINUTI ================= */

const generaOrari = () => {
  if (!form.data) return [];

  const giorno = new Date(form.data).getDay();

  // Domenica (0) e Lunedì (1) chiuso
  if (giorno === 0 || giorno === 1) return [];

  // Sabato 7:30 - 20, altri giorni 8 - 20
  let start = giorno === 6 ? 7.5 : 8;
  let end = 20;

  let orari = [];

  for (let i = start; i < end; i += 0.25) {
    let ore = Math.floor(i);
    let minuti = Math.round((i % 1) * 60);
    let minutiStr = minuti === 0 ? "00" : minuti.toString().padStart(2, "0");
    let slot = `${ore}:${minutiStr}`;

    if (!occupiedSlots.includes(slot)) {
      orari.push(slot);
    }
  }

  return orari;
};

  /* ================= PRENOTAZIONE ================= */

  const prenota = async () => {
    if (
      !form.nome ||
      !form.telefono ||
      !form.servizio ||
      !form.parrucchiere ||
      !form.data ||
      !form.ora
    ) {
      alert("Compila tutti i campi");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const dataSelezionata = new Date(form.data);
const giorno = dataSelezionata.getDay();

if (giorno === 0 || giorno === 1) {
  alert("Il salone è chiuso la Domenica e il Lunedì.");
  return;
}
    if (form.data < today) {
      alert("Non puoi prenotare giorni passati.");
      return;
    }

    const durata = DURATE_SERVIZI[form.servizio];
    const [h, m] = form.ora.split(":").map(Number);
    let start = h * 60 + m;

    const { data: existing } = await supabase
      .from("prenotazioni")
      .select("*")
      .eq("data", form.data)
      .eq("parrucchiere", form.parrucchiere)
      .neq("stato", "rifiutata");

    for (let p of existing) {
      const durataEsistente = DURATE_SERVIZI[p.servizio];
      const [h2, m2] = p.ora.split(":").map(Number);
      let start2 = h2 * 60 + m2;
      let end2 = start2 + durataEsistente;

      if (start < end2 && start + durata > start2) {
        alert("Questo parrucchiere è occupato in quell'orario.");
        return;
      }
    }

    await supabase.from("prenotazioni").insert([
      { ...form, user_id: user.id, stato: "in attesa" }
    ]);

    alert("Prenotazione inviata! Attendi che uno dei nostri parrucchieri accetti o rifiuti la tua prenotazione e ricarica il sito");

    fetchOccupiedSlots();
    fetchMiePrenotazioni(user.id);

    setForm({
      nome: "",
      telefono: "",
      servizio: "",
      parrucchiere: "",
      data: "",
      ora: ""
    });
  };

  const fetchMiePrenotazioni = async (id) => {
    const { data } = await supabase
      .from("prenotazioni")
      .select("*")
      .eq("user_id", id)
      .order("data", { ascending: true });

    setMiePrenotazioni(data || []);
  };

const fetchPrenotazioni = async () => {
  const { data } = await supabase
    .from("prenotazioni")
    .select("*")
    .order("data", { ascending: true });

  setPrenotazioni(data || []);
};

const fetchOccupiedSlots = async () => {
  const { data } = await supabase
    .from("prenotazioni")
    .select("*")
    .eq("data", form.data)
    .eq("parrucchiere", form.parrucchiere)
    .neq("stato", "rifiutata");

  if (!data) return;

  let slots = [];

  for (let p of data) {
    const durata = DURATE_SERVIZI[p.servizio];
    const [h, m] = p.ora.split(":").map(Number);

    let start = h * 60 + m;

    for (let i = 0; i < durata; i += 15) {
      let minutiTotali = start + i;
      let ore = Math.floor(minutiTotali / 60);
      let minuti = minutiTotali % 60;
      let minutiStr =
        minuti === 0 ? "00" : minuti.toString().padStart(2, "0");

      slots.push(`${ore}:${minutiStr}`);
    }
  }

  setOccupiedSlots(slots);
};

const updateStato = async (id, stato) => {
  await supabase
    .from("prenotazioni")
    .update({ stato })
    .eq("id", id);

  fetchPrenotazioni();
};

const signOut = async () => {
  await supabase.auth.signOut();
  location.reload();
};

  /* ================= ADMIN ================= */

  if (role === "admin")
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard Admin</h1>

        {prenotazioni.map((p) => (
          <div key={p.id} className="bg-white p-5 mb-4 rounded-xl shadow-lg">
            <p className="font-bold text-lg">{p.nome}</p>
            <p>{p.servizio} - {p.parrucchiere}</p>
            <p>{p.data} • {p.ora}</p>
            <p className="mt-2 font-semibold">{p.stato}</p>

            <div className="mt-3 flex gap-2">
              <button onClick={() => updateStato(p.id, "accettata")} className="bg-green-600 text-white px-3 py-1 rounded-lg">
                Accetta
              </button>
              <button onClick={() => updateStato(p.id, "rifiutata")} className="bg-red-600 text-white px-3 py-1 rounded-lg">
                Rifiuta
              </button>
            </div>
          </div>
        ))}

        <button onClick={signOut} className="mt-6 bg-black text-white px-4 py-2 rounded-xl">
          Logout
        </button>
      </div>
    );

  /* ================= USER ================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl shadow-xl">

        <img src="/logo.jpg" className="w-20 mx-auto mb-4" />

        <h2 className="text-xl font-bold mb-4 text-center">
          Prenota il tuo appuntamento
        </h2>

        <input className="w-full border p-2 mb-3 rounded-lg"
          placeholder="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />

        <input className="w-full border p-2 mb-3 rounded-lg"
          placeholder="Telefono"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />

        <select
          className="w-full border p-2 mb-3 rounded-lg"
          value={form.servizio}
          onChange={(e) => setForm({ ...form, servizio: e.target.value })}
        >
          <option value="">Seleziona servizio</option>
          {Object.keys(DURATE_SERVIZI).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select className="w-full border p-2 mb-3 rounded-lg"
          value={form.parrucchiere}
          onChange={(e) => setForm({ ...form, parrucchiere: e.target.value })}
        >
          <option value="">Seleziona parrucchiere</option>
          <option value="Jonny">Jonny</option>
          <option value="Arianna">Arianna</option>
          <option value="Angela">Angela</option>
        </select>

<Calendar
  minDate={new Date()}
  tileDisabled={({ date }) => {
    const day = date.getDay();
    return day === 0 || day === 1;
  }}
  onChange={(date) => {
    const localDate = date.toLocaleDateString("sv-SE");
    setForm({ ...form, data: localDate });
  }}
/>
        <select className="w-full border p-2 mt-3 rounded-lg"
          value={form.ora}
          onChange={(e) => setForm({ ...form, ora: e.target.value })}
        >
          <option value="">Seleziona orario</option>
          {generaOrari().map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>

        <button onClick={prenota}
          className="w-full bg-black text-white p-3 mt-4 rounded-xl">
          Prenota
        </button>

        <h3 className="mt-6 font-bold">Le mie prenotazioni</h3>

        {miePrenotazioni.map((p) => (
          <div key={p.id} className="bg-gray-100 p-3 mt-2 rounded-xl">
            <p>{p.servizio} - {p.parrucchiere}</p>
            <p>{p.data} • {p.ora}</p>
            <p className="font-semibold">{p.stato}</p>
          </div>
        ))}

        <button onClick={signOut}
          className="w-full mt-6 bg-gray-300 p-2 rounded-xl">
          Logout
        </button>
      </div>
    </div>
  );
}

/* ================= AUTH ================= */

function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) onLogin();
  };

  const register = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) alert("Controlla la mail per confermare l'account.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
        <img src="/logo.jpg" className="w-16 mx-auto mb-4" />
        <input className="w-full border p-2 mb-2 rounded-lg"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input type="password"
          className="w-full border p-2 mb-4 rounded-lg"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}
          className="w-full bg-black text-white p-2 mb-2 rounded-lg">
          Login
        </button>
        <button onClick={register}
          className="w-full bg-gray-200 p-2 rounded-lg">
          Registrati
        </button>
      </div>
    </div>
  );
}
