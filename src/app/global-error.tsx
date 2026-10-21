'use client';

// Last-resort error screen when the root layout itself fails. Plain styles: the app CSS may not load.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8f7f0', color: '#202820', margin: 0 }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px' }}>
          <h1 style={{ fontSize: 32, color: '#103b28' }}>AgriLink is having trouble</h1>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>Something went wrong while loading the site. Please try again in a moment.</p>
          {error.digest ? <p style={{ fontSize: 14, color: '#5c665c' }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, minHeight: 44, padding: '0 20px', borderRadius: 8, border: 0, background: '#174c32', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
