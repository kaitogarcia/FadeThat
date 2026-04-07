export default function SocialLinks() {
  return (
    <div className="social-links">
      <a
        className="social-link spotify-link"
        href="https://open.spotify.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="Open FadeThat on Spotify"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm4.86 15.2a.78.78 0 0 1-1.07.27 9.79 9.79 0 0 0-7.63-.93.78.78 0 1 1-.46-1.49 11.35 11.35 0 0 1 8.84 1.08.78.78 0 0 1 .32 1.07Zm1.52-2.62a.97.97 0 0 1-1.33.35 12.2 12.2 0 0 0-9.37-1.15.97.97 0 1 1-.53-1.86 14.14 14.14 0 0 1 10.88 1.33.97.97 0 0 1 .35 1.33Zm.13-2.75a1.16 1.16 0 0 1-1.59.42c-3.3-1.96-8.34-2.14-11.5-.96a1.16 1.16 0 1 1-.81-2.17c3.63-1.35 9.26-1.09 13.5 1.35a1.16 1.16 0 0 1 .4 1.36Z" />
        </svg>
      </a>

      <a
        className="social-link instagram-link"
        href="https://instagram.com/i_______am_____"
        target="_blank"
        rel="noreferrer"
        aria-label="Open FadeThat on Instagram"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5.5A5.5 5.5 0 1 0 12 18.5 5.5 5.5 0 0 0 12 7.5Zm0 2A3.5 3.5 0 1 1 8.5 13 3.5 3.5 0 0 1 12 9.5Zm5.75-2.5a1.25 1.25 0 1 0 1.25 1.25A1.25 1.25 0 0 0 17.75 7Z" />
        </svg>
      </a>
    </div>
  );
}
