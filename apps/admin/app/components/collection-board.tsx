'use client';

/**
 * Moving a piece from one collection to another by dragging it.
 *
 * Two decisions worth knowing about.
 *
 * It uses pointer events, not HTML5 drag-and-drop. `draggable` does not fire on
 * touch at all, and this admin is used on a phone — a drag that only works with
 * a mouse would be a feature for one of the two people running the shop.
 *
 * And the drag lives on a grip, not on the whole card. The grip sets
 * `touch-action: none` so a drag from there is a drag; everywhere else on the
 * card the browser keeps its normal job of scrolling the page. Making the whole
 * card draggable is what turns a long list into something you cannot scroll.
 *
 * Dragging is never the only way. Every card also carries a "Move to" menu,
 * which is what a keyboard reaches and what works when a drag is fiddly.
 *
 * The board shows what it believes immediately and puts it back if the server
 * disagrees, so a failed move is visible rather than silently lost.
 */

import { useRef, useState } from 'react';
import { GripVertical, PackageSearch } from 'lucide-react';
import { formatPaise } from '@mridul/utils';
import { moveProductToCollection } from '../actions/collections';

export type BoardCollection = { id: string; name: string; slug: string };
export type BoardProduct = {
  id: string;
  name: string;
  pricePaise: number;
  imageUrl: string;
};

type Groups = Record<string, BoardProduct[]>;

/** How far a pointer must travel before this counts as a drag and not a tap. */
const DRAG_THRESHOLD = 6;

export function CollectionBoard({
  collections,
  initialGroups,
}: {
  collections: BoardCollection[];
  initialGroups: Groups;
}) {
  const [groups, setGroups] = useState<Groups>(initialGroups);
  const [dragging, setDragging] = useState<{
    productId: string;
    fromId: string;
    name: string;
  } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useRef<Map<string, HTMLElement>>(new Map());
  const start = useRef<{ x: number; y: number; productId: string; fromId: string } | null>(
    null,
  );

  /** The column under the pointer, by geometry — elementFromPoint would find
   *  the floating ghost, which is always under the pointer by definition. */
  function columnAt(x: number, y: number): string | null {
    for (const [id, node] of columns.current) {
      const box = node.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        return id;
      }
    }
    return null;
  }

  async function commit(productId: string, fromId: string, toId: string) {
    if (fromId === toId) return;

    const before = groups;
    // Show it in the new place at once; a move that waits for the network
    // feels broken even when it works.
    setGroups((current) => {
      const moved = current[fromId]?.find((product) => product.id === productId);
      if (!moved) return current;
      return {
        ...current,
        [fromId]: current[fromId].filter((product) => product.id !== productId),
        [toId]: [moved, ...(current[toId] ?? [])],
      };
    });

    setBusy(true);
    const result = await moveProductToCollection(productId, fromId, toId);
    setBusy(false);

    if (!result.ok) {
      setGroups(before);
      setNote({ ok: false, text: result.message });
      return;
    }
    const to = collections.find((collection) => collection.id === toId);
    setNote({ ok: true, text: `Moved to ${to?.name ?? 'the collection'}.` });
  }

  /*
   * The move and release listeners go on the window rather than on the grip.
   *
   * Pointer capture would keep them coming to the grip, but it is a single
   * point of failure — if the capture is lost or refused, every later move
   * event goes somewhere else and the drag dies halfway across the screen,
   * still showing the piece as being dragged. Listening on the window cannot
   * lose the pointer, and it is what makes a drag that leaves the card, the
   * column, or the window behave.
   */
  function onPointerDown(
    event: React.PointerEvent<HTMLElement>,
    product: BoardProduct,
    fromId: string,
  ) {
    if (busy || event.button !== 0) return;
    event.preventDefault();

    start.current = {
      x: event.clientX,
      y: event.clientY,
      productId: product.id,
      fromId,
    };
    setNote(null);

    let live = false;
    let over: string | null = null;

    const move = (moveEvent: PointerEvent) => {
      const from = start.current;
      if (!from) return;

      if (!live) {
        const far =
          Math.abs(moveEvent.clientX - from.x) > DRAG_THRESHOLD ||
          Math.abs(moveEvent.clientY - from.y) > DRAG_THRESHOLD;
        if (!far) return;
        live = true;
        setDragging({ productId: from.productId, fromId: from.fromId, name: product.name });
      }

      over = columnAt(moveEvent.clientX, moveEvent.clientY);
      setGhost({ x: moveEvent.clientX, y: moveEvent.clientY });
      setOverId(over);
    };

    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);

      const from = start.current;
      start.current = null;

      if (live && from && over && over !== from.fromId) {
        void commit(from.productId, from.fromId, over);
      }
      setDragging(null);
      setGhost(null);
      setOverId(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  }

  return (
    <div className="collection-board">
      <p className="collection-board-hint">
        Drag a piece by its grip into another collection, or use “Move to” on the
        piece itself. A piece belongs to one collection here — moving it takes it
        out of the one it came from.
      </p>

      {note && (
        <p className={`form-note ${note.ok ? 'is-ok' : 'is-bad'}`} role="status">
          {note.text}
        </p>
      )}

      <div className="collection-columns">
        {collections.map((collection) => {
          const items = groups[collection.id] ?? [];
          return (
            <section
              aria-label={collection.name}
              className={`collection-column${overId === collection.id ? ' is-over' : ''}`}
              key={collection.id}
              ref={(node) => {
                if (node) columns.current.set(collection.id, node);
                else columns.current.delete(collection.id);
              }}
            >
              <header>
                <h3>{collection.name}</h3>
                <span>{items.length}</span>
              </header>

              {items.length === 0 ? (
                <p className="collection-column-empty">
                  <PackageSearch aria-hidden="true" />
                  Nothing here yet. Drop a piece in.
                </p>
              ) : (
                <ul>
                  {items.map((product) => (
                    <li
                      className={`collection-chip${
                        dragging?.productId === product.id ? ' is-dragging' : ''
                      }`}
                      key={product.id}
                    >
                      <button
                        aria-label={`Drag ${product.name} to another collection`}
                        className="collection-grip"
                        onPointerDown={(event) =>
                          onPointerDown(event, product, collection.id)
                        }
                        type="button"
                      >
                        <GripVertical aria-hidden="true" />
                      </button>

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="collection-chip-photo" src={product.imageUrl} />

                      <span className="collection-chip-body">
                        <strong>{product.name}</strong>
                        <small>{formatPaise(product.pricePaise)}</small>
                      </span>

                      {/* The way in that does not need a pointer at all. */}
                      <label className="collection-move">
                        <span className="sr-only">
                          Move {product.name} to another collection
                        </span>
                        <select
                          disabled={busy}
                          onChange={(event) => {
                            const toId = event.target.value;
                            event.target.value = '';
                            if (toId) void commit(product.id, collection.id, toId);
                          }}
                          value=""
                        >
                          <option value="">Move to…</option>
                          {collections
                            .filter((other) => other.id !== collection.id)
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {dragging && ghost && (
        <div
          aria-hidden="true"
          className="collection-ghost"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {dragging.name}
        </div>
      )}
    </div>
  );
}
