#!/usr/bin/env bash
# Installation du pre-commit hook offline
# Usage: bash scripts/install-offline-hook.sh

set -e

HOOK_PATH=".git/hooks/pre-commit"

cat > "$HOOK_PATH" << 'EOF'
#!/usr/bin/env bash
exec bash scripts/guard-offline.sh
EOF

chmod +x "$HOOK_PATH"

echo "✅ Pre-commit hook installé : $HOOK_PATH"
echo "   Test : bash scripts/guard-offline.sh"
