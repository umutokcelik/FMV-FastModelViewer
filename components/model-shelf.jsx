'use client';

import { useEffect, useRef } from 'react';
import { modelExtension } from '../lib/model-paths.mjs';

export function ThumbnailJob({ model, onThumbnail }) {
  const host = useRef(null);

  useEffect(() => {
    let active = true;
    let viewer;
    const asset = model.selection.createAsset(model.path);
    const finish = (image) => {
      if (active) onThumbnail(model.id, image);
    };

    import('../lib/viewer/engine.js').then(({ createModelViewer }) => {
      if (!active) return;
      viewer = createModelViewer(host.current, asset, {
        onReady() {
          try {
            finish(viewer.captureThumbnail());
          } catch {
            finish(null);
          }
        },
        onError: () => finish(null),
      }, { preview: true });
    }).catch(() => finish(null));

    return () => {
      active = false;
      viewer?.dispose();
      asset.release?.();
    };
  }, [model, onThumbnail]);

  return <div ref={host} className="thumbnail-renderer" aria-hidden="true" inert />;
}

export default function ModelShelf({ models, selected, onSelect, dropActive, text }) {
  return (
    <aside className={`model-shelf${models.length ? '' : ' shelf-drop-only'}`} aria-label={text.modelShelf}
      data-drop-zone="shelf" data-drop-active={dropActive || undefined}>
      <div className="shelf-heading">
        <h2>{text.modelShelf}</h2>
        {models.length > 0 && <span aria-label={text.modelCount(models.length)}>{models.length}</span>}
      </div>
      {models.length ? (
        <ul className="shelf-list">
          {models.map(({ id, path, thumbnail }) => (
            <li key={id}>
              <button type="button" className="shelf-card" title={path}
                aria-current={id === selected ? 'true' : undefined} onClick={() => onSelect(id)}>
                <span className="shelf-preview">
                  {thumbnail
                    ? <img src={thumbnail} alt="" width="256" height="160" draggable={false} />
                    : <span>{thumbnail === null ? text.previewUnavailable : text.preparing}</span>}
                </span>
                <span className="shelf-card-label">
                  <span className="format">{modelExtension(path).toUpperCase()}</span>
                  <strong>{path.split('/').at(-1)}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="shelf-drop-empty">{text.dropOnShelf}</p>}
      {dropActive && models.length > 0 && <span className="drop-hint" aria-hidden="true">{text.appendModel}</span>}
    </aside>
  );
}
