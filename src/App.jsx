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

    // DOMENICA (0) E LUNEDI (1) CHIUSO
    if (giorno === 0 || giorno === 1) return [];

    // SABATO 7:30 - 20
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

  const fetchOccupiedSlots = async () => {
    const { data } = await supabase
      .from("prenotazioni")
      .select("*")
      .eq("data", form.data)
      .eq("parrucchiere", form.parrucchiere)
      .neq("stato", "rifiutata");

    let slots = [];

    data?.forEach(p => {
      const durata = DURATE_SERVIZI[p.servizio];
      const [h, m] = p.ora.split(":").map(Number);
      let start = h * 60 + m;

      for (let i = 0; i < durata; i += 15) {
        let tot = start + i;
        let hh = Math.floor(tot / 60);
        let mm = tot % 60;
        let mmStr = mm.toString().padStart(2, "0");
        slots.push(`${hh}:${mmStr}`);
      }
    });

    setOccupiedSlots(slots);
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

    const dataSelezionata = new Date(form.data);
    const giorno = dataSelezionata.getDay();

    // BLOCCO SICUREZZA DOMENICA E LUNEDI
    if (giorno === 0 || giorno === 1) {
      alert("Il salone è chiuso la Domenica e il Lunedì.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
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

    alert("Prenotazione inviata! Attendi conferma.");

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

  if (!user) return <Auth onLogin={checkUser} />;

  if (role === "admin") {
    return <div>Admin invariato</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl shadow-xl">

        <img src="/logo.jpg" className="w-20 mx-auto mb-4" />

        <h2 className="text-xl font-bold mb-4 text-center">
          Prenota il tuo appuntamento
        </h2>

        {/* CAMBIO IMPORTANTE QUI */}
        <Calendar
          minDate={new Date()}
          tileDisabled={({ date }) => {
            const day = date.getDay();
            return day === 0 || day === 1; // disabilita domenica e lunedì
          }}
          onChange={(date) =>
            setForm({ ...form, data: date.toISOString().split("T")[0] })
          }
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

      </div>
    </div>
  );
}
