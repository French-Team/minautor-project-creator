"""Fix chat-stream-stats CSS: full-width row inside header-center column"""
import os

css_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'styles', 'default.css')

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """.chat-stream-stats {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;"""

new = """.chat-stream-stats {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;"""

if old in content:
    content = content.replace(old, new, 1)
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ chat-stream-stats CSS updated: full-width, 4px padding top/bottom')
else:
    print('❌ Could not find old CSS block')
    if '.chat-stream-stats' in content:
        print('Found .chat-stream-stats but content mismatch. Current:')
        import re
        m = re.search(r'\.chat-stream-stats\s*\{[^}]+', content)
        if m:
            print(m.group(0)[:200])
