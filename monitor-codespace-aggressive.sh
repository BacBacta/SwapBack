#!/bin/bash

# ===========================================
# SWAPBACK CODESPACE MONITOR - VERSION AGRESSIVE
# ===========================================
# Surveillance RAM toutes les 30 secondes
# Nettoyage automatique si > 70% RAM
# Kill processus lourds (TypeScript, ESLint, Extension Host)
# ===========================================

LOG_FILE="/workspaces/SwapBack/codespace-monitor.log"
THRESHOLD=70  # RAM threshold en %
CHECK_INTERVAL=30  # secondes

echo "$(date): 🚀 SWAPBACK CODESPACE MONITOR STARTED (AGRESSIVE MODE)" >> "$LOG_FILE"
echo "$(date): Threshold: ${THRESHOLD}%, Interval: ${CHECK_INTERVAL}s" >> "$LOG_FILE"

while true; do
    # Get RAM usage percentage
    RAM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    echo "$(date): RAM Usage: ${RAM_USAGE}%" >> "$LOG_FILE"
    
    if [ "$RAM_USAGE" -gt "$THRESHOLD" ]; then
        echo "$(date): ⚠️  HIGH RAM DETECTED (${RAM_USAGE}%) - CLEANING..." >> "$LOG_FILE"
        
        # Kill TypeScript servers (most memory intensive)
        TSLANG_COUNT=$(ps aux | grep -E "tsserver|typescript.*server" | grep -v grep | wc -l)
        if [ "$TSLANG_COUNT" -gt 1 ]; then
            echo "$(date): Killing ${TSLANG_COUNT} TypeScript servers..." >> "$LOG_FILE"
            ps aux | grep -E "tsserver|typescript.*server" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        fi
        
        # Kill ESLint servers
        ESLINT_COUNT=$(ps aux | grep eslint | grep -v grep | wc -l)
        if [ "$ESLINT_COUNT" -gt 0 ]; then
            echo "$(date): Killing ${ESLINT_COUNT} ESLint servers..." >> "$LOG_FILE"
            ps aux | grep eslint | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        fi
        
        # Kill redundant Extension Hosts (keep only 1)
        EXT_HOST_COUNT=$(ps aux | grep "extension host" | grep -v grep | wc -l)
        if [ "$EXT_HOST_COUNT" -gt 1 ]; then
            echo "$(date): Killing ${EXT_HOST_COUNT} redundant Extension Hosts..." >> "$LOG_FILE"
            ps aux | grep "extension host" | grep -v grep | tail -n +2 | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        fi
        
        # Kill Tailwind servers
        TAILWIND_COUNT=$(ps aux | grep tailwind | grep -v grep | wc -l)
        if [ "$TAILWIND_COUNT" -gt 1 ]; then
            echo "$(date): Killing ${TAILWIND_COUNT} redundant Tailwind servers..." >> "$LOG_FILE"
            ps aux | grep tailwind | grep -v grep | tail -n +2 | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        fi
        
        # Force garbage collection if Node.js processes exist
        NODE_PROCESSES=$(ps aux | grep node | grep -v grep | wc -l)
        if [ "$NODE_PROCESSES" -gt 5 ]; then
            echo "$(date): Too many Node processes (${NODE_PROCESSES}) - sending SIGUSR1 for GC..." >> "$LOG_FILE"
            ps aux | grep node | grep -v grep | awk '{print $2}' | head -5 | xargs kill -USR1 2>/dev/null || true
        fi
        
        # Wait 5 seconds for cleanup
        sleep 5
        
        # Check RAM after cleanup
        RAM_AFTER=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        echo "$(date): ✅ CLEANUP COMPLETE - RAM now: ${RAM_AFTER}%" >> "$LOG_FILE"
        
        if [ "$RAM_AFTER" -gt "$THRESHOLD" ]; then
            echo "$(date): 🚨 STILL HIGH RAM (${RAM_AFTER}%) - EMERGENCY MODE" >> "$LOG_FILE"
            # Emergency: Kill all non-essential processes
            ps aux | grep -E "(prettier|stylelint|webpack|parcel)" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        fi
    fi
    
    sleep "$CHECK_INTERVAL"
done
