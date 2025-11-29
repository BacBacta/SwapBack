#!/bin/bash
# Script to install Husky hooks for local development
# Run this after npm install in local development environment

if [ -n "$CI" ] || [ -n "$VERCEL" ]; then
  echo "Skipping husky install in CI/deployment environment"
  exit 0
fi

if command -v husky &> /dev/null; then
  echo "Installing husky hooks..."
  husky install
else
  echo "Husky not found, skipping hook installation"
fi
