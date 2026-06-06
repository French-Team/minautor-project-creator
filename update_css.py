with open('src/styles/default.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if '/* ---- API Keys button' in line:
        start = i
    if start is not None and '/* Connection status */' in line:
        end = i
        break

if start is None or end is None:
    print(f'ERROR: start={start} end={end}')
    exit(1)

print(f'Replacing lines {start+1} to {end} ({end - start} lines)')

new_css = """
/* ---- API Keys button (provider panel) ---- */
.provider-panel__keys-btn {
  width: 100%;
  margin-top: 2px;
}

/* ---- Toast Container ---- */
.toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

/* ---- Toast ---- */
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 240px;
  max-width: 380px;
  padding: 10px 14px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  font-size: 12px;
  color: var(--text);
  pointer-events: auto;
  animation: toast-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast--exit {
  animation: toast-exit 0.25s ease-in forwards;
}
@keyframes toast-enter {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toast-exit {
  to { opacity: 0; transform: translateX(40px) scale(0.95); pointer-events: none; }
}
.toast__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}
.toast--success .toast__icon { background: var(--success); }
.toast--error   .toast__icon { background: var(--danger); }
.toast--warning .toast__icon { background: var(--warning); }
.toast--info    .toast__icon { background: var(--info); }
.toast__message {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.4;
}
.toast__close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-faint);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  transition: background var(--t-fast), color var(--t-fast);
}
.toast__close:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.toast--success { border-left: 3px solid var(--success); }
.toast--error   { border-left: 3px solid var(--danger); }
.toast--warning { border-left: 3px solid var(--warning); }
.toast--info    { border-left: 3px solid var(--info); }

/* ---- API Keys Modal ---- */
.api-keys-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--t-normal);
}
.api-keys-modal.is-open {
  pointer-events: auto;
  opacity: 1;
}
.api-keys-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 18, 25, 0.5);
}
.api-keys-modal__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  transform: translateY(12px) scale(0.97);
  transition: transform var(--t-normal);
}
.api-keys-modal.is-open .api-keys-modal__dialog {
  transform: translateY(0) scale(1);
}
.api-keys-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex: 0 0 auto;
}
.api-keys-modal__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.api-keys-modal__close {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.api-keys-modal__close:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.api-keys-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.api-keys-modal__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.api-keys-modal__item {
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.api-keys-modal__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.api-keys-modal__item-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.api-keys-modal__item-provider {
  font-size: 10px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 1px 6px;
  border-radius: 999px;
}
.api-keys-modal__item-key code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.api-keys-modal__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.api-keys-modal__action-btn {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-faint);
  cursor: pointer;
  padding: 0;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.api-keys-modal__action-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
  border-color: var(--border-soft);
}
.api-keys-modal__action-btn--danger:hover {
  background: rgba(220, 38, 38, 0.1);
  color: var(--danger);
  border-color: rgba(220, 38, 38, 0.3);
}
.api-keys-modal__add-btn {
  align-self: flex-start;
}
.api-keys-modal__empty {
  text-align: center;
  padding: 24px 8px;
}
.api-keys-modal__empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
}
.api-keys-modal__empty-text {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.api-keys-modal__empty-hint {
  font-size: 11px;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 4px;
}
/* Form */
.api-keys-modal__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.api-keys-modal__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.api-keys-modal__label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  font-weight: 600;
}
.api-keys-modal__input,
.api-keys-modal__select {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-family: inherit;
  background: var(--bg-elev);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--t-fast);
}
.api-keys-modal__input:focus,
.api-keys-modal__select:focus {
  border-color: var(--accent);
}
.api-keys-modal__select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;
}
.api-keys-modal__form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border-soft);
}
.api-keys-modal__readonly {
  font-size: 12px;
  color: var(--text);
  padding: 6px 10px;
  background: var(--bg-tert);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.api-keys-modal__readonly--key {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
