export const metadata = { title: "Setup" };

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

export default function SetupPage() {
  return (
    <section className="state-card">
      <p className="eyebrow">Configuration</p>
      <h1>Connect ENERGYDEX.</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code>, then provide
        these server and public bindings:
      </p>
      <ul>
        {requiredVariables.map((variable) => (
          <li key={variable}>
            <code>{variable}</code>
          </li>
        ))}
      </ul>
      <p>See SETUP.md for local Supabase and provider instructions.</p>
    </section>
  );
}
