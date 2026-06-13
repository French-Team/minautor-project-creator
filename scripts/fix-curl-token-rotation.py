"""Fix the sed -i.bak (Linux-only) → mv (multi-platform) in curl example #9."""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Use a simpler, unique anchor that doesn't require escaping
old_block = '''echo "$NEW_TOKEN" > .env.new

# Mettre à jour .env
sed -i.bak "s|^CANVAS_API_TOKEN=.*|CANVAS_API_TOKEN=$NEW_TOKEN|" .env
echo "Old token expires at: $(echo "$RESPONSE" | jq -r '.data.oldTokenExpiresAt')"'''

new_block = '''echo "$NEW_TOKEN" > .env.tmp

# Mettre à jour .env (multi-plateforme : Windows PowerShell, macOS, Linux)
mv .env.tmp .env
# Alternative Linux/macOS : sed -i.bak "s|^CANVAS_API_TOKEN=.*|CANVAS_API_TOKEN=$NEW_TOKEN|" .env && rm .env.bak
echo "Old token expires at: $(echo "$RESPONSE" | jq -r '.data.oldTokenExpiresAt')"'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print('FIX 1 (curl multi-platform): OK')
else:
    print('FIX 1: anchor not found')
    raise SystemExit(1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'File updated: {filepath}')
print(f'Final size: {len(content)} chars')
