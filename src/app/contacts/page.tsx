"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuthGate } from "@/components/RequireAuthGate";
import { Phone, Trash2, Plus, Bell, Users, BellOff } from "lucide-react";
import { TulipBloom } from "@/components/TulipBloom";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

interface Reminder {
  id: string;
  label: string;
  time_of_day: string;
  days_of_week: number[];
  enabled: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ContactsPage() {
  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <RequireAuthGate message="Sign in to save your emergency contacts & enable automatic alerts.">
          <ContactsManager />
        </RequireAuthGate>
      </main>
    </>
  );
}

function ContactsManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", relationship: "" });
  const [reminderTime, setReminderTime] = useState("20:00");
  const [error, setError] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [addingReminder, setAddingReminder] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  async function loadContacts() {
    const res = await fetch("/api/contacts");
    if (res.ok) setContacts((await res.json()).contacts);
  }

  async function loadReminders() {
    const res = await fetch("/api/reminders");
    if (res.ok) setReminders((await res.json()).reminders);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    loadContacts();
    loadReminders();
  }, []);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (addingContact) return; // guard against a double-tap firing two inserts on a slow network
    setError(null);
    setAddingContact(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setForm({ name: "", phone: "", relationship: "" });
      // Append the row the server just returned instead of re-fetching the whole list — on a
      // slow phone connection a second full round trip after the save is what made this feel
      // like it was hanging.
      setContacts((prev) => [...prev, data.contact]);
    } catch {
      setError("Network error while saving the contact. Please try again.");
    } finally {
      setAddingContact(false);
    }
  }

  async function deleteContact(id: string) {
    if (deletingContactId) return;
    setDeletingContactId(id);
    const previous = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== id)); // optimistic — feels instant on slow networks
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) setContacts(previous); // roll back on failure
    } catch {
      setContacts(previous);
    } finally {
      setDeletingContactId(null);
    }
  }

  async function addReminder() {
    if (addingReminder) return;
    setAddingReminder(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_of_day: reminderTime, days_of_week: [1, 2, 3, 4, 5], label: "Share my location" }),
      });
      if (res.ok) {
        const data = await res.json();
        setReminders((prev) => [...prev, data.reminder]);
      }
    } finally {
      setAddingReminder(false);
    }
  }

  async function toggleReminder(reminder: Reminder) {
    if (busyReminderId) return;
    setBusyReminderId(reminder.id);
    const previous = reminders;
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, enabled: !r.enabled } : r)));
    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !reminder.enabled }),
      });
      if (!res.ok) setReminders(previous);
    } catch {
      setReminders(previous);
    } finally {
      setBusyReminderId(null);
    }
  }

  async function deleteReminder(id: string) {
    if (busyReminderId) return;
    setBusyReminderId(id);
    const previous = reminders;
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (!res.ok) setReminders(previous);
    } catch {
      setReminders(previous);
    } finally {
      setBusyReminderId(null);
    }
  }

  return (
    <>
      <section className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "1rem" }}>
            <TulipBloom
              size={40}
              openness={1}
              petals={Math.max(3, Math.min(contacts.length, 10))}
              title={`Your Trusted Circle — ${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
            />
            <div>
              <h2 style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.1rem" }}>
                <Users size={18} style={{ color: "var(--accent-strong)" }} /> Your Trusted Circle
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
                Every contact you add is another petal of protection around you.
              </p>
            </div>
          </div>
          <form onSubmit={addContact} className="mobile-stack" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="field" style={inputStyle} />
            <input placeholder="+91 phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="field" style={inputStyle} />
            <input placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="field" style={inputStyle} />
            <button
              type="submit"
              disabled={addingContact}
              className="btn-accent mobile-full field"
              style={{ ...smallBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", opacity: addingContact ? 0.7 : 1, cursor: addingContact ? "wait" : "pointer" }}
            >
              <Plus size={16} /> {addingContact ? "Adding..." : "Add"}
            </button>
          </form>
          {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>}
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {contacts.map((c) => (
              <li key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.7rem 0.8rem", border: "1px solid var(--border)", borderRadius: "0.6rem" }}>
                <span style={{ minWidth: 0 }}>
                  <strong>{c.name}</strong>{" "}
                  <span style={{ color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                    {c.phone} {c.relationship ? `· ${c.relationship}` : ""}
                  </span>
                </span>
                <span style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <a href={`tel:${c.phone}`} className="icon-btn" style={iconBtn}>
                    <Phone size={16} />
                  </a>
                  <button
                    onClick={() => deleteContact(c.id)}
                    disabled={deletingContactId === c.id}
                    className="icon-btn"
                    style={{ ...iconBtn, opacity: deletingContactId === c.id ? 0.5 : 1, cursor: deletingContactId === c.id ? "wait" : "pointer" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
            {contacts.length === 0 && (
              <div className="empty-state">
                <Users size={22} />
                No contacts yet — add someone you trust so you can reach them fast in an emergency.
              </div>
            )}
          </ul>
        </section>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
            <Bell size={16} style={{ display: "inline", marginRight: "0.4rem" }} />
            Location Reminders (Alarm)
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "1rem" }}>
            Reminds you to share your location at set times. You will always be asked for consent before anything is sent.
          </p>
          <div className="mobile-stack" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="field" style={inputStyle} />
            <button
              onClick={addReminder}
              disabled={addingReminder}
              className="btn-accent mobile-full field"
              style={{ ...smallBtn, opacity: addingReminder ? 0.7 : 1, cursor: addingReminder ? "wait" : "pointer" }}
            >
              {addingReminder ? "Adding..." : "Add Weekday Reminder"}
            </button>
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {reminders.map((r) => (
              <li key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.7rem 0.8rem", border: "1px solid var(--border)", borderRadius: "0.6rem" }}>
                <span>
                  {r.time_of_day.slice(0, 5)} — {r.days_of_week.map((d) => DAY_LABELS[d]).join(", ")}
                </span>
                <span style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button
                    onClick={() => toggleReminder(r)}
                    disabled={busyReminderId === r.id}
                    className="icon-btn"
                    style={{ ...iconBtn, color: r.enabled ? "var(--accent-strong)" : "var(--foreground-muted)", opacity: busyReminderId === r.id ? 0.5 : 1, cursor: busyReminderId === r.id ? "wait" : "pointer" }}
                  >
                    {r.enabled ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    disabled={busyReminderId === r.id}
                    className="icon-btn"
                    style={{ ...iconBtn, opacity: busyReminderId === r.id ? 0.5 : 1, cursor: busyReminderId === r.id ? "wait" : "pointer" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
            {reminders.length === 0 && (
              <div className="empty-state">
                <BellOff size={22} />
                No reminders set — add one so HerLane nudges you to share your location on a schedule.
              </div>
            )}
          </ul>
      </section>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  padding: "0.55rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.85rem",
};

const smallBtn: React.CSSProperties = {
  padding: "0.55rem 0.9rem",
  borderRadius: "0.5rem",
  border: "none",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  cursor: "pointer",
};
