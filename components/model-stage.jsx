'use client';

import { useEffect, useRef, useState } from 'react';
import { viewModeGroups } from '../lib/viewer/modes.js';
import IconButton from './icon-button.jsx';

export default function ModelStage({ model, onThumbnail, dropActive, text }) {
  const { id, selection, path } = model;
  const host = useRef(null);
  const stage = useRef(null);
  const viewer = useRef(null);
  const [run, setRun] = useState(0);
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState('final');
  const [rotating, setRotating] = useState(false);
  const [status, setStatus] = useState({ key: 'loading' });
  const [error, setError] = useState(false);
  const [lightNote, setLightNote] = useState('');
  const [fullscreenError, setFullscreenError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timer = useRef(null);
  const name = path.split('/').at(-1);

  useEffect(() => {
    let active = true;
    let instance;
    const asset = selection.createAsset(path);
    const failed = (key, detail) => {
      if (!active) return;
      setInfo(null);
      setStatus({ key, detail });
      setError(true);
      onThumbnail(id, null);
    };

    import('../lib/viewer/engine.js').then(({ createModelViewer }) => {
      if (!active) return;
      instance = createModelViewer(host.current, asset, {
        onProgress(percent) {
          if (active && percent !== null) setStatus({ key: 'loadingProgress', detail: percent });
        },
        onReady(details) {
          if (!active) return;
          setInfo(details);
          try {
            onThumbnail(id, instance.captureThumbnail());
          } catch {
            onThumbnail(id, null);
          }
        },
        onError: (_message, key, detail) => failed(key, detail),
        onLightChange({ dragging }) {
          if (!active) return;
          clearTimeout(timer.current);
          setLightNote(dragging ? 'lightDragging' : 'lightUpdated');
          timer.current = setTimeout(() => setLightNote(''), 1400);
        },
      });
      viewer.current = instance;
    }).catch((cause) => {
      console.error(cause);
      failed('webglUnavailable');
    });

    return () => {
      active = false;
      clearTimeout(timer.current);
      viewer.current = null;
      instance?.dispose();
      asset.release?.();
    };
  }, [id, onThumbnail, path, run, selection]);

  useEffect(() => {
    viewer.current?.setCanvasLabel(text.canvasLabel(name, info?.usesSceneLighting));
  }, [info, name, text]);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  function retry() {
    setError(false);
    setMode('final');
    setRotating(false);
    setStatus({ key: 'loading' });
    setRun(run + 1);
  }

  function changeMode(event) {
    const value = event.target.value;
    viewer.current.setViewMode(value);
    setMode(value);
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement === stage.current) await document.exitFullscreen();
      else await stage.current.requestFullscreen();
      setFullscreenError(false);
    } catch {
      setFullscreenError(true);
    }
  }

  const statusText = text[status.key];
  const statistics = info && [
    info.points ? text.points(info.points) : null,
    info.meshes ? text.triangles(info.triangles) : null,
    text.materials(info.materials.length),
    text.textures(info.textureCount),
  ].filter(Boolean).join(' · ');

  return (
    <>
    <section className="stage" ref={stage} aria-label={text.viewer}
      data-drop-zone="viewer" data-drop-active={dropActive || undefined}>
      <div className="stage-canvas" ref={host} />
      <div className="stage-header">
        <div className="stage-title">
          <span className="format">{name.split('.').at(-1).toUpperCase()}</span>
          <h2 title={name}>{name}</h2>
        </div>
        <div className="viewer-toolbar" aria-label={text.cameraControls} role="group">
          <IconButton icon="reset" label={text.reset} disabled={!info} onClick={() => viewer.current.reset()} />
          <IconButton icon="rotate" label={text.rotate} disabled={!info} aria-pressed={rotating} onClick={() => {
            viewer.current.setAutoRotate(!rotating);
            setRotating(!rotating);
          }} />
          <IconButton icon="light" label={text.resetLighting} disabled={!info?.usesSceneLighting} onClick={() => viewer.current.resetLighting()} />
          <IconButton icon={isFullscreen ? 'exitFullscreen' : 'fullscreen'}
            label={isFullscreen ? text.exitFullscreen : text.fullscreen} onClick={fullscreen} />
        </div>
      </div>
      {!info && <div className="stage-message" role={error ? 'alert' : 'status'}>
        <p>{typeof statusText === 'function' ? statusText(status.detail) : statusText}</p>
        {error && <button type="button" onClick={retry}>{text.retry}</button>}
      </div>}
      <div className="stage-notice" role="status">{fullscreenError ? text.fullscreenFailed : text[lightNote]}</div>
      {dropActive && <span className="drop-hint" aria-hidden="true">{text.replaceModel}</span>}
      {info && (
        <div className="stage-footer">
          <label className="mode-picker">
            <span className="sr-only">{text.inspectionMode}</span>
            <select value={mode} onChange={changeMode}>
              {viewModeGroups.map((group) => {
                const modes = group.items.filter(({ id }) => info.availableModes.includes(id));
                return modes.length > 0 && (
                  <optgroup key={group.id} label={text.modeGroups?.[group.id] ?? group.label}>
                    {modes.map(({ id, label }) => <option key={id} value={id}>{text.modes?.[id] ?? label}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <details className="model-info">
            <summary>{statistics}</summary>
            {info.meshes > 0 && <p>{text.uvCoverage(info.uvMeshes, info.meshes)}</p>}
            <ul>{info.materials.map((material, index) => <li key={index}>{material || text.unnamedMaterial}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
    {info && <p className="gesture-hint">{text.drag} <span>{text.rotate}</span> · {text.wheel} <span>{text.zoom}</span>
      {info.usesSceneLighting && <> · {text.altDrag} <span>{text.moveLight}</span></>}
    </p>}
    </>
  );
}
