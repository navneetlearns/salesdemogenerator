#!/bin/bash
set -e
echo "=== Vercel Build Script ==="
echo "CWD: $(pwd)"
echo "Files in root: $(ls -1 | head -20)"

# Run the main build
npm run build:dist

echo "=== Checking dist output ==="
ls -la dist/ 2>/dev/null || echo "dist/ not found"
ls -la dist/haldirams/ 2>/dev/null || echo "dist/haldirams not found"

# Copy dist into public for static serving
echo "=== Copying dist into public/dist ==="
rm -rf public/dist
cp -rv dist public/dist

echo "=== Verifying public/dist ==="
ls -la public/dist/ 2>/dev/null || echo "public/dist not found"
ls public/dist/haldirams/ 2>/dev/null || echo "public/dist/haldirams not found"

echo "=== Build complete ==="
