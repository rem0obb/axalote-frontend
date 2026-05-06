#!/bin/bash

echo "🧹 Clearing Vite development cache..."

# Stop any running dev server
pkill -f "vite" 2>/dev/null || true

# Clear all possible caches
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .vite
rm -rf dist
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Clear browser cache instruction
echo "🌐 Please also clear your browser cache:"
echo "   - Chrome/Edge: Ctrl+Shift+R or F12 > Network tab > Disable cache"
echo "   - Firefox: Ctrl+Shift+R or F12 > Network tab > Settings > Disable cache"

echo "✅ Cache cleared! Now restart your dev server with: npm run dev"