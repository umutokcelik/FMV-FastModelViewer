import { uiScaleLimits } from '../lib/ui-scale.mjs';

export default function Settings({ dark, language, leftShelf, uiScale, onChange, onClose, text }) {
  return (
    <>
      <button type="button" className="header-icon-button settings-button" popoverTarget="workspace-settings"
        aria-label={text.settings} title={text.settings}>
        <svg className="settings-icon" viewBox="0 0 512 512" aria-hidden="true">
          <use href="/settings-icon.svg#settings-gear" />
        </svg>
      </button>
      <div id="workspace-settings" className="settings-panel" popover="auto"
        role="group" aria-labelledby="settings-title" onToggle={(event) => {
          if (event.newState === 'closed') onClose();
        }}>
        <h2 id="settings-title">{text.settings}</h2>
        <div className="settings-option">
          <span id="dark-mode-label">{text.darkMode}</span>
          <button type="button" className="switch-track" role="switch" aria-checked={dark}
            aria-labelledby="dark-mode-label" onClick={() => onChange('theme', dark ? 'light' : 'dark')} />
        </div>
        <div className="settings-option" role="group" aria-labelledby="ui-scale-setting">
          <span id="ui-scale-setting">{text.uiScale}</span>
          <div className="ui-scale-options">
            <button type="button" aria-label={text.decreaseUiScale} title={text.decreaseUiScale}
              disabled={uiScale <= uiScaleLimits.min} onClick={() => onChange('uiScale', uiScale - uiScaleLimits.step)}>−</button>
            <output>{text.uiScaleValue(uiScale)}</output>
            <button type="button" aria-label={text.increaseUiScale} title={text.increaseUiScale}
              disabled={uiScale >= uiScaleLimits.max} onClick={() => onChange('uiScale', uiScale + uiScaleLimits.step)}>+</button>
          </div>
        </div>
        <div className="settings-option" role="group" aria-labelledby="language-setting">
          <span id="language-setting">{text.language}</span>
          <div className="language-options">
            <button type="button" lang="tr" aria-label="Türkçe" title="Türkçe"
              aria-pressed={language === 'tr'} onClick={() => onChange('language', 'tr')}>
              <svg viewBox="0 0 30 20" aria-hidden="true">
                <path fill="#E30A17" d="M0 0h30v20H0z" />
                <circle cx="10" cy="10" r="5" fill="#fff" />
                <circle cx="11.25" cy="10" r="4" fill="#E30A17" />
                <path fill="#fff" d="m14.17 10 4.53-1.47-2.8 3.85V7.62l2.8 3.85z" />
              </svg>
            </button>
            <button type="button" lang="en" aria-label="English" title="English"
              aria-pressed={language === 'en'} onClick={() => onChange('language', 'en')}>
              <svg viewBox="0 0 60 30" aria-hidden="true">
                <path fill="#012169" d="M0 0h60v30H0z" />
                <path stroke="#fff" strokeWidth="6" d="M0 0 60 30M60 0 0 30" />
                <path fill="#c8102e" d="M0 0v2.24L25.53 15H30zM60 0h-4.47L30 12.76V15zM60 30v-2.24L34.47 15H30zM0 30h4.47L30 17.24V15z" />
                <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
                <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
              </svg>
            </button>
          </div>
        </div>
        <label className="settings-option">
          <span>{text.moveShelfLeft}</span>
          <input type="checkbox" className="shelf-checkbox" checked={leftShelf}
            onChange={(event) => onChange('leftShelf', event.target.checked)} />
        </label>
      </div>
    </>
  );
}
