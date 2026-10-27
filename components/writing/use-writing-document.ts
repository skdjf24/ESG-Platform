"use client";

import { useEffect, useReducer, useRef, useState } from 'react';
import type { WritingDocument } from '@/lib/types/writing';
import { createWritingDocument, parseStoredDocument, reconcileCitations } from '@/lib/writing/document';

export const STORAGE_KEY = 'esg:hualan-2025:writing:v1';
interface State { doc: WritingDocument; past: WritingDocument[]; future: WritingDocument[]; dirty: boolean }
type Action = { type: 'load'; doc: WritingDocument } | { type: 'edit'; doc: WritingDocument } | { type: 'saved'; doc: WritingDocument } | { type: 'undo' | 'redo' };
function reducer(state: State, action: Action): State {
  if (action.type === 'load') return { doc: action.doc, past: [], future: [], dirty: false };
  if (action.type === 'saved') return { ...state, doc: action.doc, dirty: false };
  if (action.type === 'edit') return { doc: reconcileCitations(action.doc), past: [...state.past.slice(-49), state.doc], future: [], dirty: true };
  const stack = action.type === 'undo' ? state.past : state.future;
  const previous = stack.at(-1);
  if (!previous) return state;
  const doc = reconcileCitations({ ...previous, versions: state.doc.versions, savedAt: state.doc.savedAt });
  return action.type === 'undo'
    ? { doc, past: state.past.slice(0, -1), future: [...state.future, state.doc], dirty: true }
    : { doc, past: [...state.past, state.doc], future: state.future.slice(0, -1), dirty: true };
}

export function useWritingDocument() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ doc: createWritingDocument(), past: [], future: [], dirty: false }));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const baseline = useRef<WritingDocument | null>(null);
  const storageBlocked = useRef(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const restored = raw ? parseStoredDocument(raw) : null;
        if (raw && !restored) { storageBlocked.current = true; setMessage('本地存档格式不兼容，已保留原数据。请备份后再清理浏览器存储；当前编辑不会覆盖该存档。'); }
        const doc = restored ? reconcileCitations(restored) : createWritingDocument();
        baseline.current = doc;
        dispatch({ type: 'load', doc });
      } catch { storageBlocked.current = true; setMessage('浏览器不允许访问本地存储，当前编辑仅保留在本页。'); }
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [state.dirty]);

  function save(label = '手动保存') {
    if (!ready || storageBlocked.current) { setMessage('保存不可用：请检查浏览器存储权限或备份不兼容的存档。'); return false; }
    const now = new Date().toISOString();
    const changed = state.doc.chapters.filter(chapter => JSON.stringify(chapter) !== JSON.stringify(baseline.current?.chapters.find(item => item.id === chapter.id)) || !state.doc.versions.some(v => v.chapterId === chapter.id));
    const versions = changed.map(chapter => ({ id: crypto.randomUUID(), chapterId: chapter.id, number: Math.max(0, ...state.doc.versions.filter(v => v.chapterId === chapter.id).map(v => v.number)) + 1, savedAt: now, label, snapshot: structuredClone(chapter) }));
    const doc = { ...state.doc, savedAt: now, versions: [...state.doc.versions, ...versions] };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      baseline.current = doc;
      dispatch({ type: 'saved', doc });
      setMessage('已保存到此浏览器，版本记录已更新。');
      return true;
    } catch { setMessage('保存失败：浏览器存储不可用或已满。当前编辑仍保留，请勿关闭页面。'); return false; }
  }
  return { ...state, ready, message, setMessage, save, edit: (doc: WritingDocument) => dispatch({ type: 'edit', doc }), undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }) };
}
