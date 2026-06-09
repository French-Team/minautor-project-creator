"""Append preparation model dropdown CSS to provider-panel.css"""
import os, sys

css_block = """

/* =====================================================================
   Options select (modele de preparation, etc.)
   ===================================================================== */

.pp-options__select {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  font-size: 11.5px;
  font-family: inherit;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast);
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%239aa0ac' stroke-width='1.5'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;
}

.pp-options__select:hover {
  border-color: var(--border-strong);
  background-color: var(--bg-hover);
}

.pp-options__select:focus {
  border-color: var(--accent);
  background-color: var(--bg-elev);
}

.pp-options__select option {
  background: var(--bg-elev);
  color: var(--text);
  font-size: 11.5px;
}

.theme-dark .pp-options__select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%236b7588' stroke-width='1.5'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
}
"""

filepath = os.path.join(os.path.dirname(__file__), '..', 'src', 'styles', 'provider-panel.css')
with open(filepath, 'a', encoding='utf-8') as f:
    f.write(css_block)
print('OK')
