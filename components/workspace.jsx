'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ModelShelf, { ThumbnailJob } from './model-shelf.jsx';
import ModelStage from './model-stage.jsx';
import Settings from './settings.jsx';
import IconButton from './icon-button.jsx';
import { browserSelection, droppedFiles, launchSelection, pickedFiles } from '../lib/local-files.js';
import { isModelPath, modelExtensions } from '../lib/model-paths.mjs';
import { languageFor, messages } from '../lib/i18n.js';
import { isZoomKey, readUiScale, uiScaleLimits } from '../lib/ui-scale.mjs';

const preferenceCookies = {
  theme: 'fmv_theme', language: 'fmv_language', leftShelf: 'fmv_shelf_left', uiScale: 'fmv_ui_scale',
};

export default function Workspace() {
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const importId = useRef(0);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const dragDepth = useRef(0);
  const dragTimer = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState(null);
  const [preferences, setPreferences] = useState({
    theme: 'auto', language: 'auto', leftShelf: false, uiScale: uiScaleLimits.initial,
  });
  const [systemLanguage, setSystemLanguage] = useState('en');
  const [systemDark, setSystemDark] = useState(false);
  const [previewShelf, setPreviewShelf] = useState(false);
  const [{ models, selected }, setCollection] = useState({ models: [], selected: null });
  const [notice, setNotice] = useState('');
  const language = preferences.language === 'auto' ? systemLanguage : preferences.language;
  const dark = preferences.theme === 'auto' ? systemDark : preferences.theme === 'dark';
  const text = messages[language];

  const clearDrag = useCallback(() => {
    clearTimeout(dragTimer.current);
    dragDepth.current = 0;
    setDragging(false);
    setTarget(null);
  }, []);

  useEffect(() => {
    window.addEventListener('blur', clearDrag);
    return () => {
      clearTimeout(dragTimer.current);
      window.removeEventListener('blur', clearDrag);
    };
  }, [clearDrag]);

  useEffect(() => {
    function preventPageZoom(event) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && isZoomKey(event.key, event.code)) {
        event.preventDefault();
      }
    }
    window.addEventListener('keydown', preventPageZoom, true);
    return () => window.removeEventListener('keydown', preventPageZoom, true);
  }, []);

  const importSelection = useCallback((pending, append, errorKey) => {
    const id = ++importId.current;
    if (!append) {
      generation.current++;
      queue.current = Promise.resolve();
    }
    const current = generation.current;
    const result = pending.catch(() => null);
    queue.current = queue.current.then(async () => {
      const selection = await result;
      if (current !== generation.current) return;
      if (!selection) {
        setNotice(errorKey);
        return;
      }
      const paths = selection.paths.filter(isModelPath).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (!paths.length) {
        setNotice('noModels');
        return;
      }
      const incoming = paths.map((path, index) => ({ id: `${id}:${index}`, path, selection }));
      const initial = incoming.find((model) => model.path === selection.initial) || incoming[0];
      setCollection((previous) => ({
        models: append ? [...previous.models, ...incoming] : incoming,
        selected: (append && previous.selected) || initial.id,
      }));
      if (append && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setNotice('');
    });
  }, []);

  useEffect(() => {
    const cookies = new Map(document.cookie.split(';').map((cookie) => cookie.trim().split('=', 2)));
    const theme = cookies.get(preferenceCookies.theme);
    const legacyTheme = cookies.get('fmv_dark_theme');
    const language = cookies.get(preferenceCookies.language);
    setPreferences({
      theme: ['auto', 'dark', 'light'].includes(theme)
        ? theme : legacyTheme === '1' ? 'dark' : legacyTheme === '0' ? 'light' : 'auto',
      language: language === 'tr' || language === 'en' ? language : 'auto',
      leftShelf: cookies.get(preferenceCookies.leftShelf) === '1',
      uiScale: readUiScale(cookies.get(preferenceCookies.uiScale)),
    });
    function detectLanguage() {
      setSystemLanguage(languageFor(window.fmvSystemLanguage || navigator.languages?.[0] || navigator.language));
    }
    detectLanguage();
    window.addEventListener('languagechange', detectLanguage);
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const detectTheme = () => setSystemDark(colorScheme.matches);
    detectTheme();
    colorScheme.addEventListener('change', detectTheme);
    return () => {
      window.removeEventListener('languagechange', detectLanguage);
      colorScheme.removeEventListener('change', detectTheme);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `FMV · ${text.appLabel}`;
  }, [language, text]);

  useEffect(() => {
    const token = location.hash.slice(1);
    if (!/^[a-f0-9]{48}$/.test(token)) return;
    const controller = new AbortController();
    importSelection(launchSelection(token, controller.signal), false, 'startupFiles');
    return () => controller.abort();
  }, [importSelection]);

  function changePreference(name, value) {
    const stored = name === 'leftShelf' ? Number(value) : value;
    document.cookie = `${preferenceCookies[name]}=${stored}; Path=/; Max-Age=31536000; SameSite=Strict`;
    setPreferences((previous) => ({ ...previous, [name]: value }));
    if (name === 'leftShelf') setPreviewShelf(true);
  }

  const onThumbnail = useCallback((id, image) => {
    setCollection((previous) => {
      const model = previous.models.find((item) => item.id === id);
      if (!model || model.thumbnail === image || (model.thumbnail && !image)) return previous;
      return {
        ...previous,
        models: previous.models.map((item) => item.id === id ? { ...item, thumbnail: image } : item),
      };
    });
  }, []);

  function pick(event) {
    const files = pickedFiles(event.target.files);
    event.target.value = '';
    if (files.size) importSelection(Promise.resolve(browserSelection(files)), false);
  }

  function updateDrag(event) {
    const zone = event.target.closest('[data-drop-zone]')?.dataset.dropZone ?? null;
    setDragging(true);
    setTarget(zone);
    // Some canceled drags stop emitting events without sending dragleave.
    clearTimeout(dragTimer.current);
    dragTimer.current = setTimeout(clearDrag, 1100);
    return zone;
  }

  function drop(event) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    clearDrag();
    const zone = event.target.closest('[data-drop-zone]')?.dataset.dropZone;
    if (!zone) return;
    importSelection(
      droppedFiles(event.dataTransfer).then(browserSelection),
      zone === 'shelf',
      'dropFailed',
    );
  }

  const activeModel = models.find((model) => model.id === selected);
  const showShelf = models.length > 1;
  const showShelfZone = showShelf || dragging || previewShelf;
  const previewJob = showShelf && models.find((model) => model.id !== selected && model.thumbnail === undefined);
  const shelf = showShelfZone && (
    <ModelShelf models={showShelf ? models : []} selected={selected} text={text}
      dropActive={target === 'shelf'} onSelect={(id) => {
        setCollection((previous) => ({ ...previous, selected: id }));
      }} />
  );

  return (
    <div className="workspace" data-theme={preferences.theme}
      style={{ '--ui-scale': preferences.uiScale / 100 }}
      data-shelf-side={preferences.leftShelf ? 'left' : 'right'}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current++;
        updateDrag(event);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        const zone = updateDrag(event);
        event.dataTransfer.dropEffect = zone ? 'copy' : 'none';
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) clearDrag();
      }}
      onDrop={drop}>
      <header className="app-header">
        <div className="brand"><img src="/fmv-icon.png" alt="" width="32" height="32" /><h1>FMV</h1></div>
        <span className="app-label">Fast Model Viewer</span>
        <div className="header-actions">
          <input hidden type="file" multiple ref={fileInput} onChange={pick} />
          <input hidden type="file" multiple webkitdirectory="" ref={folderInput} onChange={pick} />
          <IconButton className="header-icon-button" icon="file" label={text.openFile} onClick={() => fileInput.current.click()} />
          <IconButton className="header-icon-button" icon="folder" label={text.openFolder} onClick={() => folderInput.current.click()} />
          <Settings dark={dark} language={language} leftShelf={preferences.leftShelf} uiScale={preferences.uiScale}
            onChange={changePreference} onClose={() => setPreviewShelf(false)} text={text} />
        </div>
      </header>
      <main className={`workbench${showShelfZone ? ' has-shelf' : ''}`}>
        <div className="preview">
          {notice && <p className="selection-notice" role="alert">{text[notice]}</p>}
          {activeModel ? (
            <ModelStage key={activeModel.id} model={activeModel} onThumbnail={onThumbnail} text={text}
              dropActive={target === 'viewer'} />
          ) : (
            <section className="stage empty-stage" aria-label={text.modelDropArea}
              data-drop-zone="viewer" data-drop-active={target === 'viewer' || undefined}>
              <div className="empty-content">
                <span className="drop-mark" aria-hidden="true">↓</span>
                <h2>{text.dropModel}</h2>
                <p>{text.dropDescription}</p>
                <details className="supported-formats">
                  <summary>{text.formats}</summary>
                  <p>{modelExtensions.map((ext) => ext.toUpperCase()).join(' · ')}</p>
                </details>
              </div>
            </section>
          )}
        </div>
        {shelf}
      </main>
      {previewJob && <ThumbnailJob key={previewJob.id} model={previewJob} onThumbnail={onThumbnail} />}
    </div>
  );
}
