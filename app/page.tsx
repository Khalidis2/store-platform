export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 600 }}>
      <h1>Store Platform</h1>
      <p>
        This is the root domain — where merchants sign up and create their store.
        Once a store exists, it's reachable at{" "}
        <code>&#123;subdomain&#125;.yourapp.com</code>, resolved by{" "}
        <code>middleware.ts</code> and rendered by <code>app/store/page.tsx</code>.
      </p>
      <p>
        <a href="/signup">Create a store →</a>
      </p>
    </main>
  );
}
