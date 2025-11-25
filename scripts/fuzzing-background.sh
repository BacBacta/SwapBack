#!/bin/bash
# Lance le fuzzing en arrière-plan
cd /workspaces/SwapBack/programs/swapback_router/fuzz
nohup cargo hfuzz run fuzz_swap > fuzzing.log 2>&1 &
echo $! > fuzzing.pid
echo "✅ Fuzzing lancé en arrière-plan (PID: $(cat fuzzing.pid))"
echo "📊 Logs: tail -f /workspaces/SwapBack/programs/swapback_router/fuzz/fuzzing.log"
echo "🛑 Stop: kill $(cat fuzzing.pid)"
