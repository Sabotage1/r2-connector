export function ScreensaverPage({ title, onWake }: { title: string; onWake: () => void }) {
  return (
    <main
      className="screensaver"
      aria-label="Screensaver mode"
      onClick={onWake}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onWake();
      }}
      tabIndex={0}
    >
      <div className="screensaver-panel">
        <span className="eyebrow">Machine sleeping</span>
        <h1>{title}</h1>
        <button
          type="button"
          className="ghost-button"
          onClick={(event) => {
            event.stopPropagation();
            onWake();
          }}
        >
          Tap the screen to wake
        </button>
      </div>
    </main>
  );
}
