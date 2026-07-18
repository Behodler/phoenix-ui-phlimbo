import { useEffect, useMemo, useState } from 'react';
import type { FAQData } from '../../types/vault';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';

/**
 * FAQ Editor (admin-only)
 *
 * A no-code editor for the FAQ content served from /faq-data.json. It loads the
 * live document, lets an admin pick a tab group and an item via two dropdowns,
 * edit the title/body, add/delete items and groups, then Publish the whole
 * document back through the FAQ write API (API Gateway + Lambda).
 *
 * Security note: the admin tab that hosts this component is UX gating only. The
 * real control is the Lambda, which independently checks the password and
 * re-validates the payload before writing to S3. The password entered here is
 * held in component state for the session only — never persisted, never bundled.
 *
 * Configure the write endpoint at build time via VITE_FAQ_API_URL. Reads use the
 * public /faq-data.json directly (no auth needed).
 */

// Whole-document shape: a map of tab-group key -> its FAQ block.
type FaqDoc = Record<string, FAQData>;

const FAQ_API_URL: string = import.meta.env.VITE_FAQ_API_URL ?? '';

// Deep-clone helper so edits never mutate the loaded reference in place.
function cloneDoc(doc: FaqDoc): FaqDoc {
  return JSON.parse(JSON.stringify(doc)) as FaqDoc;
}

// Validate the document shape client-side before publishing. The Lambda repeats
// this server-side (authoritative); this pass just gives fast, friendly feedback.
function validateDoc(doc: FaqDoc): string | null {
  const groups = Object.keys(doc);
  if (groups.length === 0) return 'Document has no tab groups.';
  for (const key of groups) {
    const block = doc[key];
    if (!block || typeof block !== 'object') return `Group "${key}" is malformed.`;
    if (block.componentName !== key) {
      return `Group "${key}" has a mismatched componentName ("${block.componentName}").`;
    }
    if (!Array.isArray(block.items)) return `Group "${key}" has no items array.`;
    for (let i = 0; i < block.items.length; i++) {
      const item = block.items[i];
      if (!item || typeof item.title !== 'string' || typeof item.body !== 'string') {
        return `Item ${i + 1} in "${key}" is malformed.`;
      }
      if (!item.title.trim()) return `Item ${i + 1} in "${key}" has an empty title.`;
      if (!item.body.trim()) return `"${item.title}" in "${key}" has an empty body.`;
    }
  }
  return null;
}

export default function FAQEditor() {
  const { addToast } = useToast();

  const [doc, setDoc] = useState<FaqDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  // Load (or reload) the live document, cache-busted so the admin always sees
  // the current S3/CloudFront state rather than a stale edge copy.
  const loadDoc = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/faq-data.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FaqDoc;
      setDoc(data);
      const firstGroup = Object.keys(data)[0] ?? '';
      setSelectedGroup(firstGroup);
      setSelectedIndex(firstGroup && data[firstGroup].items.length > 0 ? 0 : -1);
      setDirty(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load FAQ data.');
      setDoc(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, []);

  const groups = useMemo(() => (doc ? Object.keys(doc) : []), [doc]);
  const currentItems = doc && selectedGroup ? doc[selectedGroup].items : [];
  const currentItem =
    selectedIndex >= 0 && selectedIndex < currentItems.length
      ? currentItems[selectedIndex]
      : null;

  // Apply an immutable mutation to the document and mark it dirty.
  const mutate = (fn: (draft: FaqDoc) => void) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const draft = cloneDoc(prev);
      fn(draft);
      return draft;
    });
    setDirty(true);
  };

  const handleSelectGroup = (group: string) => {
    setSelectedGroup(group);
    const items = doc?.[group].items ?? [];
    setSelectedIndex(items.length > 0 ? 0 : -1);
  };

  const handleTitleChange = (value: string) => {
    if (!selectedGroup || selectedIndex < 0) return;
    mutate((draft) => {
      draft[selectedGroup].items[selectedIndex].title = value;
    });
  };

  const handleBodyChange = (value: string) => {
    if (!selectedGroup || selectedIndex < 0) return;
    mutate((draft) => {
      draft[selectedGroup].items[selectedIndex].body = value;
    });
  };

  const handleAddItem = () => {
    if (!selectedGroup) return;
    mutate((draft) => {
      draft[selectedGroup].items.push({ title: 'New question', body: 'New answer' });
    });
    // Select the newly added item.
    setSelectedIndex(currentItems.length);
  };

  const handleDeleteItem = () => {
    if (!selectedGroup || selectedIndex < 0) return;
    const removingLabel = currentItem?.title ?? 'item';
    mutate((draft) => {
      draft[selectedGroup].items.splice(selectedIndex, 1);
    });
    setSelectedIndex((prev) => Math.max(-1, Math.min(prev, currentItems.length - 2)));
    addToast({ type: 'info', title: 'Removed', description: `Deleted "${removingLabel}" (not yet published).` });
  };

  const handleMoveItem = (dir: -1 | 1) => {
    if (!selectedGroup || selectedIndex < 0) return;
    const target = selectedIndex + dir;
    if (target < 0 || target >= currentItems.length) return;
    mutate((draft) => {
      const arr = draft[selectedGroup].items;
      [arr[selectedIndex], arr[target]] = [arr[target], arr[selectedIndex]];
    });
    setSelectedIndex(target);
  };

  const handleAddGroup = () => {
    const name = window.prompt(
      'New tab group key (must match a componentName, e.g. "MintTab"):',
    );
    if (!name) return;
    const key = name.trim();
    if (!key) return;
    if (doc && doc[key]) {
      addToast({ type: 'error', title: 'Exists', description: `Group "${key}" already exists.` });
      return;
    }
    mutate((draft) => {
      draft[key] = { componentName: key, items: [{ title: 'New question', body: 'New answer' }] };
    });
    setSelectedGroup(key);
    setSelectedIndex(0);
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    if (!window.confirm(`Delete the entire "${selectedGroup}" group and all its items?`)) return;
    const removed = selectedGroup;
    mutate((draft) => {
      delete draft[removed];
    });
    const remaining = groups.filter((g) => g !== removed);
    const next = remaining[0] ?? '';
    setSelectedGroup(next);
    setSelectedIndex(next && doc ? (doc[next].items.length > 0 ? 0 : -1) : -1);
  };

  const handlePublish = async () => {
    if (!doc) return;
    if (!FAQ_API_URL) {
      addToast({
        type: 'error',
        title: 'Not configured',
        description: 'VITE_FAQ_API_URL is not set for this build; cannot publish.',
      });
      return;
    }
    if (!password.trim()) {
      addToast({ type: 'error', title: 'Password required', description: 'Enter the FAQ editor password.' });
      return;
    }
    const validationError = validateDoc(doc);
    if (validationError) {
      addToast({ type: 'error', title: 'Invalid content', description: validationError });
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch(FAQ_API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password.trim()}`,
        },
        body: JSON.stringify(doc),
      });
      if (res.status === 401 || res.status === 403) {
        addToast({ type: 'error', title: 'Unauthorized', description: 'The password was rejected.' });
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      setDirty(false);
      addToast({
        type: 'success',
        title: 'Published',
        description: 'FAQ updated. It should be live within a few seconds.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">FAQ Editor</h3>
        <button
          type="button"
          onClick={loadDoc}
          disabled={isLoading}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : dirty ? 'Discard & reload' : 'Reload'}
        </button>
      </div>

      {loadError && (
        <p className="text-xs text-red-500 mb-3">Failed to load FAQ data: {loadError}</p>
      )}

      {!FAQ_API_URL && (
        <p className="text-xs text-yellow-500 mb-3">
          Read-only preview: <code className="px-1 bg-background rounded">VITE_FAQ_API_URL</code> is
          not configured for this build, so publishing is disabled.
        </p>
      )}

      {doc && (
        <div className="space-y-4">
          {/* Dropdown 1: tab group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tab group</label>
            <div className="flex gap-2">
              <select
                value={selectedGroup}
                onChange={(e) => handleSelectGroup(e.target.value)}
                className={inputClass}
              >
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g} ({doc[g].items.length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddGroup}
                className="px-3 py-2 text-xs whitespace-nowrap bg-background border border-border rounded-lg text-foreground hover:bg-accent/5"
              >
                + Group
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={!selectedGroup}
                className="px-3 py-2 text-xs whitespace-nowrap bg-background border border-red-500/40 rounded-lg text-red-500 hover:bg-red-500/5 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Dropdown 2: item within the group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Question</label>
            <div className="flex gap-2">
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                className={inputClass}
                disabled={currentItems.length === 0}
              >
                {currentItems.length === 0 && <option value={-1}>— no items —</option>}
                {currentItems.map((item, idx) => (
                  <option key={idx} value={idx}>
                    {idx + 1}. {item.title.slice(0, 60) || '(untitled)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedGroup}
                className="px-3 py-2 text-xs whitespace-nowrap bg-background border border-border rounded-lg text-foreground hover:bg-accent/5 disabled:opacity-50"
              >
                + Item
              </button>
            </div>
          </div>

          {/* Editable fields for the selected item */}
          {currentItem ? (
            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title (header)</label>
                <input
                  type="text"
                  value={currentItem.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Body (message)</label>
                <textarea
                  value={currentItem.body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  rows={5}
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveItem(-1)}
                  disabled={selectedIndex <= 0}
                  className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground hover:bg-accent/5 disabled:opacity-50"
                >
                  ↑ Move up
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveItem(1)}
                  disabled={selectedIndex < 0 || selectedIndex >= currentItems.length - 1}
                  className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground hover:bg-accent/5 disabled:opacity-50"
                >
                  ↓ Move down
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="px-3 py-1.5 text-xs bg-background border border-red-500/40 rounded-lg text-red-500 hover:bg-red-500/5 ml-auto"
                >
                  Delete item
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-3 border-t border-border">
              This group has no items. Use “+ Item” to add one.
            </p>
          )}

          {/* Publish controls */}
          <div className="space-y-2 pt-3 border-t-2 border-border">
            <label className="block text-sm font-medium text-foreground mb-1">Editor password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Required to publish"
              autoComplete="off"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              {dirty ? 'You have unpublished changes.' : 'No unpublished changes.'}
            </p>
            <ActionButton
              disabled={isPublishing || !FAQ_API_URL || !dirty}
              onAction={handlePublish}
              label={isPublishing ? 'Publishing…' : 'Publish FAQ'}
              variant="primary"
              isLoading={isPublishing}
            />
          </div>
        </div>
      )}
    </div>
  );
}
