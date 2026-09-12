export default function Home() {
  const endpoints = [
    "POST /api/auth/signup",
    "POST /api/auth/login",
    "POST /api/auth/logout",
    "GET/POST /api/contacts",
    "PATCH/DELETE /api/contacts/:id",
    "GET/POST /api/sos",
    "GET /api/sos/active",
    "GET/PATCH /api/sos/:id",
    "GET/POST /api/sos/:id/location",
    "GET/POST /api/incidents",
    "GET/PATCH/DELETE /api/incidents/:id",
    "GET /api/health",
  ];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Women Safety API</h1>
      <p>Backend is running. Available endpoints:</p>
      <ul>
        {endpoints.map((e) => (
          <li key={e}>
            <code>{e}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
