/**
 * API Route for protocol logs - GET and POST
 * Stores logs in a JSON file for persistence across restarts
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

interface ProtocolLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'critical';
  category: string;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

const LOGS_DIR = path.join(process.cwd(), "logs");
const LOGS_FILE = path.join(LOGS_DIR, "protocol-logs.json");
const MAX_LOGS = 500;

async function ensureLogsDir(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function readLogs(): Promise<ProtocolLog[]> {
  try {
    await ensureLogsDir();
    const data = await fs.readFile(LOGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeLogs(logs: ProtocolLog[]): Promise<void> {
  await ensureLogsDir();
  await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
}

/**
 * GET - Retrieve all protocol logs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const unresolvedOnly = searchParams.get("unresolved") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");

    let logs = await readLogs();

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    if (category) {
      logs = logs.filter(log => log.category === category);
    }
    if (unresolvedOnly) {
      logs = logs.filter(log => !log.resolved);
    }

    // Limit results
    logs = logs.slice(0, limit);

    // Get counts
    const allLogs = await readLogs();
    const counts = {
      total: allLogs.length,
      critical: allLogs.filter(l => l.level === "critical").length,
      error: allLogs.filter(l => l.level === "error").length,
      warning: allLogs.filter(l => l.level === "warning").length,
      info: allLogs.filter(l => l.level === "info").length,
      unresolved: allLogs.filter(l => !l.resolved).length,
    };

    return NextResponse.json({
      success: true,
      logs,
      counts,
    });
  } catch (error) {
    console.error("Error reading protocol logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read logs", logs: [], counts: {} },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a new protocol log
 */
export async function POST(request: NextRequest) {
  try {
    const log: ProtocolLog = await request.json();

    // Validate required fields
    if (!log.id || !log.timestamp || !log.level || !log.category || !log.title || !log.message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Read existing logs
    const logs = await readLogs();

    // Add new log at the beginning
    logs.unshift(log);

    // Trim old logs
    const trimmedLogs = logs.slice(0, MAX_LOGS);

    // Write back
    await writeLogs(trimmedLogs);

    // Console log for server monitoring
    const icons: Record<string, string> = {
      critical: "🚨",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    console.log(
      `${icons[log.level] || "📝"} [${log.category.toUpperCase()}] ${log.title}: ${log.message}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving protocol log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save log" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update a log (mark as resolved)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, resolved, resolvedBy } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Log ID required" },
        { status: 400 }
      );
    }

    const logs = await readLogs();
    const logIndex = logs.findIndex(l => l.id === id);

    if (logIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Log not found" },
        { status: 404 }
      );
    }

    logs[logIndex] = {
      ...logs[logIndex],
      resolved: resolved ?? true,
      resolvedAt: resolved ? new Date().toISOString() : undefined,
      resolvedBy: resolvedBy || undefined,
    };

    await writeLogs(logs);

    return NextResponse.json({ success: true, log: logs[logIndex] });
  } catch (error) {
    console.error("Error updating protocol log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update log" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Clear all logs or specific log
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await writeLogs([]);
      return NextResponse.json({ success: true, message: "All logs cleared" });
    }

    if (id) {
      const logs = await readLogs();
      const filteredLogs = logs.filter(l => l.id !== id);
      await writeLogs(filteredLogs);
      return NextResponse.json({ success: true, message: "Log deleted" });
    }

    return NextResponse.json(
      { success: false, error: "Specify log ID or all=true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting protocol logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete logs" },
      { status: 500 }
    );
  }
}
