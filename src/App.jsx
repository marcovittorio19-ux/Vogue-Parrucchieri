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
  const [showInstallGuide, setShowInstallGuide] = useState(false);

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
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const alreadySeen = localStorage.getItem("installGuideSeen");

  if (!isStandalone && !alreadySeen) {
    setShowInstallGuide(true);
  }
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

  // Domenica (0) e Lunedì (1) chiusi
  if (giorno === 0 || giorno === 1) return [];

  // Sabato inizia alle 7:30
  let startMinutes = giorno === 6 ? 7 * 60 + 30 : 8 * 60;
  let endMinutes = 20 * 60;

  let orari = [];

  for (let i = startMinutes; i < endMinutes; i += 15) {
    let ore = Math.floor(i / 60);
    let minuti = i % 60;
    let minutiStr = minuti.toString().padStart(2, "0");
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
// 🔔 Notifica admin
await supabase.functions.invoke("send-notification", {
  body: {
    type: "new_booking"
  }
});
    alert("Prenotazione inviata! Attendi che uno dei nostri parrucchieri accetti o rifiuti la tua prenotazione. Non dimenticarti di cliccare il tasto verde ATTIVA NOTIFICHE e rimarrai aggiornato in tempo reale.");

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
//
const updateStato = async (id, stato) => {
  await supabase
    .from("prenotazioni")
    .update({ stato })
    .eq("id", id);

  // recupera la prenotazione aggiornata
  const { data } = await supabase
    .from("prenotazioni")
    .select("*")
    .eq("id", id)
    .single();

if (stato === "accettata") {
  await supabase.functions.invoke("send-notification", {
    body: {
      type: "booking_accepted",
      user_id: data.user_id
    }
  });
}

if (stato === "rifiutata") {
  await supabase.functions.invoke("send-notification", {
    body: {
      type: "booking_rejected",
      user_id: data.user_id
    }
  });
}

  fetchPrenotazioni();
};

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };
  function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
const attivaNotifiche = async () => {
  if (!user) {
    alert("Devi essere loggato");
    return;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push non supportate");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permesso negato");
      return;
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      alert("Notifiche già attive");
      return;
    }

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(
    "BPnchfwJTwabIDTXJOMupw-ydZ-kURHsZIAKrFpcX2IET_0etPwIFyhlY4HmrPRiEv1roXWZdybyiqBZo14_GlY"
  )
});

    const { error } = await supabase
      .from("subscriptions")
      .insert([
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.toJSON().keys.p256dh,
          auth: subscription.toJSON().keys.auth
        }
      ]);

if (error) {
  console.log("ERRORE SUPABASE:", error);
  alert("Errore: " + error.message);
  return;
}

    alert("Notifiche attivate 🔥");
  } catch (err) {
    console.log("ERRORE:", err);
  }
};
const InstallGuide = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  const closeGuide = () => {
    localStorage.setItem("installGuideSeen", "true");
    setShowInstallGuide(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 z-50 rounded-t-2xl shadow-2xl">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg mb-2">
            Aggiungi Vogue Parrucchieri alla Home 📲
          </h3>

          {isIOS && (
            <p className="text-sm">
              1️⃣ Tocca Condividi in basso  
              2️⃣ Premi "Aggiungi alla schermata Home"  
              3️⃣ Tocca Aggiungi
            </p>
          )}

          {isAndroid && (
            <p className="text-sm">
              1️⃣ Tocca i tre puntini in alto  
              2️⃣ Premi "Aggiungi alla schermata Home"  
              3️⃣ Conferma con Aggiungi
            </p>
          )}
        </div>

        <button
          onClick={closeGuide}
          className="ml-4 text-red-400 font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
  if (!user) return <Auth onLogin={checkUser} />;

  /* ================= ADMIN ================= */

if (role === "admin")
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Admin</h1>

      <button
        onClick={attivaNotifiche}
        className="mb-6 bg-green-600 text-white px-4 py-2 rounded-xl"
      >
        Attiva notifiche
      </button>

        {prenotazioni.map((p) => (
          <div key={p.id} className="bg-white p-5 mb-4 rounded-xl shadow-lg">
            <p className="font-bold text-lg">{p.nome}</p>
            <p className="text-gray-600">📞 {p.telefono}</p>
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

      {showInstallGuide && <InstallGuide />}

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
        <button
  onClick={attivaNotifiche}
  className="w-full bg-green-600 text-white p-2 mb-4 rounded-xl"
>
  Attiva notifiche
</button>

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
    return day === 0 || day === 1; // 0 = Domenica, 1 = Lunedì chiusi
  }}
  onChange={(date) =>
    setForm({
      ...form,
      data: date.toLocaleDateString("sv-SE") // evita bug timezone
    })
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

        <button
          onClick={signOut}
          className="w-full mt-6 bg-gray-300 p-2 rounded-xl">
          Logout
        </button>
      </div>

      {showInstallGuide && <InstallGuide />}

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
    if (!error) alert("Controlla la mail per confermare l'account. Se non è arrivata la mail controlla di aver inserito correttamente la email o la cartella spam.");
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
