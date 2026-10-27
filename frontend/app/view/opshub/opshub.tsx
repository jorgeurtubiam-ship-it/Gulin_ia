// Copyright 2026, GuLiN Enterprise
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useEffect, useMemo } from "react";
import { FullBlockProps } from "@/app/block/blocktypes";
import { createBlock } from "@/store/global";

// ─── Tipos e Interfaces ────────────────────────────────────────────────────────

export type OpsTab = "fleet" | "scheduler" | "workflows" | "incidents";

interface HostNode {
    id: string;
    hostname: string;
    ip: string;
    os: string;
    status: "healthy" | "warning" | "critical" | "offline";
    cpu: number;
    mem: number;
    disk: number;
    load: string;
    tags: string[];
    uptime: string;
    lastPing: string;
}

interface CronJob {
    id: string;
    name: string;
    schedule: string;
    scheduleType: "cron" | "interval" | "webhook" | "ondemand";
    targets: string;
    command: string;
    status: "idle" | "running" | "success" | "failed";
    lastRun: string;
    duration: string;
    nextRun: string;
    maxMemory?: string;
    maxRunTime?: string;
}

interface WorkflowNode {
    id: string;
    title: string;
    type: "trigger" | "script" | "condition" | "split" | "approval" | "action";
    category: string;
    status?: "idle" | "running" | "success" | "error";
    target?: string;
    x: number;
    y: number;
    config?: Record<string, any>;
}

interface IncidentSnapshot {
    id: string;
    title: string;
    host: string;
    severity: "critical" | "warning" | "info";
    timestamp: string;
    status: "active" | "mitigated" | "resolved";
    metricTrigger: string;
    topProcesses: { pid: number; user: string; cpu: number; mem: number; command: string }[];
    snapshotLogs: string[];
    aiDiagnosis: string;
    aiRemediation: string;
    remediationApplied: boolean;
}

// ─── Datos Iniciales / Mock Data ──────────────────────────────────────────────

const initialHosts: HostNode[] = [
    {
        id: "node-1",
        hostname: "web-prod-01",
        ip: "192.168.10.11",
        os: "Ubuntu 24.04 LTS",
        status: "healthy",
        cpu: 24,
        mem: 58,
        disk: 42,
        load: "0.45, 0.62, 0.58",
        tags: ["@prod", "@web", "@chile-central"],
        uptime: "48d 12h",
        lastPing: "hace 2s",
    },
    {
        id: "node-2",
        hostname: "db-primary-pg",
        ip: "192.168.10.20",
        os: "Debian 12 Bookworm",
        status: "healthy",
        cpu: 48,
        mem: 74,
        disk: 65,
        load: "1.82, 1.45, 1.30",
        tags: ["@prod", "@database", "@postgres"],
        uptime: "120d 4h",
        lastPing: "hace 1s",
    },
    {
        id: "node-3",
        hostname: "worker-batch-02",
        ip: "192.168.10.35",
        os: "RedHat 9.2",
        status: "warning",
        cpu: 89,
        mem: 88,
        disk: 78,
        load: "4.12, 3.80, 2.95",
        tags: ["@batch", "@workers", "@heavy-jobs"],
        uptime: "14d 6h",
        lastPing: "hace 5s",
    },
    {
        id: "node-4",
        hostname: "edge-gateway-eu",
        ip: "10.200.4.15",
        os: "Alpine Linux 3.20",
        status: "healthy",
        cpu: 12,
        mem: 32,
        disk: 21,
        load: "0.15, 0.12, 0.08",
        tags: ["@edge", "@proxy", "@nginx"],
        uptime: "95d 18h",
        lastPing: "hace 3s",
    },
];

const initialJobs: CronJob[] = [
    {
        id: "job-1",
        name: "PostgreSQL Daily Dump & S3 Sync",
        schedule: "0 3 * * *",
        scheduleType: "cron",
        targets: "@database",
        command: "pg_dumpall -U postgres | gzip | aws s3 cp - s3://gulin-backups/daily/",
        status: "success",
        lastRun: "Hoy, 03:00:15",
        duration: "4m 12s",
        nextRun: "Mañana, 03:00:00",
        maxMemory: "2 GB",
        maxRunTime: "30 min",
    },
    {
        id: "job-2",
        name: "Log Rotation & Temp Purge",
        schedule: "*/30 * * * *",
        scheduleType: "interval",
        targets: "Toda la flota (4 nodos)",
        command: "journalctl --vacuum-time=7d && rm -rf /tmp/gulin_cache/*",
        status: "running",
        lastRun: "Hace 12 min",
        duration: "18s",
        nextRun: "En 18 min",
        maxMemory: "512 MB",
        maxRunTime: "5 min",
    },
    {
        id: "job-3",
        name: "SSL Certificate Expiry Checker",
        schedule: "0 8 * * 1",
        scheduleType: "cron",
        targets: "@web",
        command: "certbot renew --dry-run && curl -X POST $SLACK_WEBHOOK",
        status: "success",
        lastRun: "Lunes, 08:00:02",
        duration: "45s",
        nextRun: "Próx. Lunes",
        maxMemory: "256 MB",
        maxRunTime: "5 min",
    },
    {
        id: "job-4",
        name: "AI Embedding Cache Refresh",
        schedule: "Webhook Trigger",
        scheduleType: "webhook",
        targets: "worker-batch-02",
        command: "python3 /opt/gulin/reindex_embeddings.py --batch-size 500",
        status: "failed",
        lastRun: "Ayer, 22:15:00",
        duration: "12m 40s",
        nextRun: "On Webhook",
        maxMemory: "4 GB",
        maxRunTime: "60 min",
    },
];

const initialIncidents: IncidentSnapshot[] = [
    {
        id: "inc-1042",
        title: "High Memory Saturation & OOM Danger",
        host: "worker-batch-02",
        severity: "critical",
        timestamp: "Hoy, 08:42:10 UTC-3",
        status: "active",
        metricTrigger: "Memoria RAM > 88% durante más de 10 min",
        topProcesses: [
            { pid: 48912, user: "gulin", cpu: 78.4, mem: 62.1, command: "python3 reindex_embeddings.py --leak-mode" },
            { pid: 1042, user: "redis", cpu: 8.2, mem: 14.5, command: "redis-server 0.0.0.0:6379" },
            { pid: 882, user: "root", cpu: 1.5, mem: 3.2, command: "/usr/bin/dockerd -H fd://" },
            { pid: 914, user: "systemd", cpu: 0.1, mem: 1.0, command: "systemd-journald" },
        ],
        snapshotLogs: [
            "[08:41:55] [worker-batch-02] WARN: Memory pressure exceeded watermark 80%",
            "[08:42:01] [worker-batch-02] CRITICAL: Process PID 48912 allocated +1.4GB in 30s",
            "[08:42:05] [worker-batch-02] ALERT: System Swap usage at 92%",
            "[08:42:10] [worker-batch-02] SNAPSHOT CAPTURED: Frozen process table and network sockets.",
        ],
        aiDiagnosis: "El proceso python3 (PID 48912) presenta un buffer no liberado en la cola de embeddings que saturó 6.2GB de RAM.",
        aiRemediation: "Enviar señal SIGTERM al PID 48912, vaciar caché temporal de worker y reiniciar servicio con límite `MaxMemory: 2GB`.",
        remediationApplied: false,
    },
    {
        id: "inc-1039",
        title: "Connection Pool Exhaustion en Postgres",
        host: "db-primary-pg",
        severity: "warning",
        timestamp: "Ayer, 18:30:00 UTC-3",
        status: "resolved",
        metricTrigger: "Conexiones activas > 95% del límite (190/200)",
        topProcesses: [
            { pid: 3120, user: "postgres", cpu: 34.1, mem: 28.0, command: "postgres: app_user db_prod [idle in transaction]" },
            { pid: 3125, user: "postgres", cpu: 22.0, mem: 22.4, command: "postgres: app_user db_prod [idle in transaction]" },
        ],
        snapshotLogs: [
            "[18:29:40] [db-primary-pg] WARN: Max connections reached (192/200)",
            "[18:30:00] [db-primary-pg] AI Auto-Remediation executed: terminated 14 idle connections.",
        ],
        aiDiagnosis: "Fugas de conexiones inactivas (idle in transaction) originadas desde el pool de microservicios.",
        aiRemediation: "Terminar transacciones inactivas mayores a 5 min y configurar `idle_in_transaction_session_timeout = 300000`.",
        remediationApplied: true,
    },
];

// ─── Componente Principal OpsHubView ──────────────────────────────────────────

export const OpsHubView: React.FC<FullBlockProps> = ({ nodeModel, viewModel }) => {
    // Determinar pestaña inicial según el viewType del bloque
    const initialTab: OpsTab = useMemo(() => {
        const vt = viewModel?.viewType;
        if (vt === "cron-view") return "scheduler";
        if (vt === "workflow-canvas") return "workflows";
        if (vt === "alerts-view") return "incidents";
        return "fleet";
    }, [viewModel?.viewType]);

    const [activeTab, setActiveTab] = useState<OpsTab>(initialTab);
    const [hosts, setHosts] = useState<HostNode[]>(initialHosts);
    const [jobs, setJobs] = useState<CronJob[]>(initialJobs);
    const [incidents, setIncidents] = useState<IncidentSnapshot[]>(initialIncidents);
    const [selectedHost, setSelectedHost] = useState<HostNode | null>(initialHosts[0]);
    const [selectedIncident, setSelectedIncident] = useState<IncidentSnapshot | null>(initialIncidents[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRemediating, setIsRemediating] = useState(false);

    const handleApplyRemediation = (incId: string) => {
        setIsRemediating(true);
        setTimeout(() => {
            setIncidents(prev =>
                prev.map(inc => inc.id === incId ? { ...inc, status: "resolved", remediationApplied: true } : inc)
            );
            setIsRemediating(false);
        }, 1200);
    };

    const handleOpenSSH = (host: HostNode) => {
        createBlock({ meta: { view: "term", connection: host.hostname } as any }, false);
    };

    return (
        <div className="w-full h-full bg-[#09090b] text-zinc-200 flex flex-col font-sans select-none overflow-hidden">
            {/* Header de la Vista OpsHub */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-zinc-950/60 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-accent-500/20 border border-accent-500/40 flex items-center justify-center text-accent-400 text-xs font-bold shadow-sm">
                        <i className="fa-solid fa-server"></i>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-100">GuLiN Ops & Automation</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent-500/20 text-accent-300 border border-accent-500/40 rounded-full">
                                CONTROL PLANE
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">Orquestación, Monitoreo en Vivo y Remediación de Infraestructura</p>
                    </div>
                </div>

                {/* Tabs de Navegación Interna */}
                <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-0.5 gap-1">
                    <button
                        onClick={() => setActiveTab("fleet")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === "fleet"
                                ? "bg-accent-500/20 text-accent-200 font-semibold border border-accent-500/40 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        }`}
                    >
                        <i className="fa-solid fa-server text-xs"></i>
                        <span>Fleet Monitor</span>
                        <span className="text-[10px] px-1 bg-white/10 rounded-full">{hosts.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("scheduler")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === "scheduler"
                                ? "bg-accent-500/20 text-accent-200 font-semibold border border-accent-500/40 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        }`}
                    >
                        <i className="fa-solid fa-calendar-days text-xs"></i>
                        <span>Scheduler & Jobs</span>
                        <span className="text-[10px] px-1 bg-white/10 rounded-full">{jobs.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("workflows")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === "workflows"
                                ? "bg-accent-500/20 text-accent-200 font-semibold border border-accent-500/40 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        }`}
                    >
                        <i className="fa-solid fa-route text-xs"></i>
                        <span>Visual Workflows</span>
                        <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">DAG</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("incidents")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === "incidents"
                                ? "bg-accent-500/20 text-accent-200 font-semibold border border-accent-500/40 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        }`}
                    >
                        <i className="fa-solid fa-triangle-exclamation text-xs text-amber-400"></i>
                        <span>Incidents & Alerts</span>
                        {incidents.filter(i => i.status === "active").length > 0 && (
                            <span className="text-[10px] px-1.5 bg-red-500/30 text-red-300 font-bold rounded-full animate-pulse">
                                {incidents.filter(i => i.status === "active").length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Contenido Dinámico por Pestaña */}
            <div className="flex-1 overflow-hidden p-4">
                
                {/* ─── TAB 1: FLEET MONITORING ────────────────────────────────────────── */}
                {activeTab === "fleet" && (
                    <div className="h-full flex gap-4 overflow-hidden">
                        {/* Grid / Lista de Servidores */}
                        <div className="w-1/2 flex flex-col gap-3 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-zinc-400">
                                    Servidores Monitoreados ({hosts.length})
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Filtrar por host, IP o tag..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="text-xs bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-accent-500/50 w-48"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                                {hosts
                                    .filter(h => h.hostname.toLowerCase().includes(searchQuery.toLowerCase()) || h.tags.some(t => t.includes(searchQuery)))
                                    .map((host) => {
                                        const isSelected = selectedHost?.id === host.id;
                                        return (
                                            <div
                                                key={host.id}
                                                onClick={() => setSelectedHost(host)}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-accent-500/10 border-accent-500/50 shadow-md"
                                                        : "bg-zinc-900/50 border-white/10 hover:border-white/20 hover:bg-zinc-900"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            host.status === "healthy" ? "bg-emerald-400" :
                                                            host.status === "warning" ? "bg-amber-400 animate-pulse" : "bg-red-500"
                                                        }`} />
                                                        <span className="font-bold text-xs text-zinc-100">{host.hostname}</span>
                                                        <span className="text-[10px] text-zinc-500">({host.ip})</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {host.tags.map((tag, idx) => (
                                                            <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-zinc-400 rounded-md font-mono">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Barras de Recursos */}
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    <div>
                                                        <div className="flex justify-between text-[10px] mb-1">
                                                            <span className="text-zinc-400">CPU</span>
                                                            <span className={`font-mono font-bold ${host.cpu > 80 ? "text-red-400" : "text-zinc-200"}`}>{host.cpu}%</span>
                                                        </div>
                                                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                            <div className={`h-full rounded-full ${host.cpu > 80 ? "bg-red-500" : "bg-accent-400"}`} style={{ width: `${host.cpu}%` }} />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="flex justify-between text-[10px] mb-1">
                                                            <span className="text-zinc-400">RAM</span>
                                                            <span className={`font-mono font-bold ${host.mem > 80 ? "text-amber-400" : "text-zinc-200"}`}>{host.mem}%</span>
                                                        </div>
                                                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                            <div className={`h-full rounded-full ${host.mem > 80 ? "bg-amber-400" : "bg-accent-400"}`} style={{ width: `${host.mem}%` }} />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="flex justify-between text-[10px] mb-1">
                                                            <span className="text-zinc-400">Disco</span>
                                                            <span className="font-mono text-zinc-200">{host.disk}%</span>
                                                        </div>
                                                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                            <div className="h-full bg-accent-400 rounded-full" style={{ width: `${host.disk}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* Detalle del Servidor Seleccionado */}
                        {selectedHost && (
                            <div className="w-1/2 bg-zinc-900/40 border border-white/10 rounded-2xl p-4 flex flex-col justify-between overflow-hidden">
                                <div>
                                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                                                <span>{selectedHost.hostname}</span>
                                                <span className="text-xs px-2 py-0.5 bg-accent-500/20 text-accent-300 rounded-md font-mono">
                                                    {selectedHost.os}
                                                </span>
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">Uptime: {selectedHost.uptime} · Load Avg: {selectedHost.load}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenSSH(selectedHost)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 border border-accent-500/40 rounded-lg text-xs font-medium transition-all cursor-pointer"
                                            >
                                                <i className="fa-solid fa-terminal text-[10px]"></i>
                                                <span>SSH Directo</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Métricas en vivo y procesos */}
                                    <div className="mt-4 space-y-3">
                                        <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                                            <i className="fa-solid fa-microchip text-accent-400"></i>
                                            <span>Procesos Principales (Top CPU/RAM)</span>
                                        </div>

                                        <div className="bg-black/40 border border-white/5 rounded-xl p-2 font-mono text-[11px] space-y-1">
                                            <div className="text-zinc-500 text-[10px] flex justify-between border-b border-white/5 pb-1">
                                                <span>PID / COMANDO</span>
                                                <span>CPU / MEM</span>
                                            </div>
                                            <div className="flex justify-between text-zinc-300">
                                                <span>14209 / python3 worker_pool.py</span>
                                                <span className="text-accent-300 font-bold">42.1% · 2.1GB</span>
                                            </div>
                                            <div className="flex justify-between text-zinc-400">
                                                <span>3120 / postgres: db_prod</span>
                                                <span>18.4% · 1.4GB</span>
                                            </div>
                                            <div className="flex justify-between text-zinc-400">
                                                <span>892 / nginx: worker process</span>
                                                <span>4.2% · 128MB</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                                    <span>Telemetría provista por GuLiN Telemetry Daemon</span>
                                    <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                                        <i className="fa-solid fa-circle text-[7px]"></i> Conectado en vivo
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── TAB 2: SCHEDULER & JOBS ────────────────────────────────────────── */}
                {activeTab === "scheduler" && (
                    <div className="h-full flex flex-col gap-3 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-zinc-300">Tareas Programadas ({jobs.length})</span>
                                <span className="text-[10px] text-zinc-500">Ejecución distribuida sobre flotas</span>
                            </div>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 border border-accent-500/40 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer">
                                <i className="fa-solid fa-plus text-xs"></i>
                                <span>Nuevo Job</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-white/10 rounded-2xl bg-zinc-950/40 overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                        <th className="p-3">Nombre del Job</th>
                                        <th className="p-3">Schedule / Trigger</th>
                                        <th className="p-3">Destino (Target)</th>
                                        <th className="p-3">Límites</th>
                                        <th className="p-3">Última Corrida</th>
                                        <th className="p-3">Próxima</th>
                                        <th className="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {jobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-semibold text-zinc-200">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        job.status === "success" ? "bg-emerald-400" :
                                                        job.status === "running" ? "bg-accent-400 animate-spin" : "bg-red-400"
                                                    }`} />
                                                    <span>{job.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono text-[11px] text-accent-300">
                                                {job.schedule}
                                            </td>
                                            <td className="p-3 text-zinc-400">
                                                <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
                                                    {job.targets}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[11px] text-zinc-500">
                                                {job.maxMemory} · {job.maxRunTime}
                                            </td>
                                            <td className="p-3 text-[11px] text-zinc-400">
                                                {job.lastRun} ({job.duration})
                                            </td>
                                            <td className="p-3 text-[11px] text-zinc-500">
                                                {job.nextRun}
                                            </td>
                                            <td className="p-3 text-right space-x-2">
                                                <button className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-zinc-300 font-semibold cursor-pointer">
                                                    Ejecutar Ya
                                                </button>
                                                <button className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-zinc-400 cursor-pointer">
                                                    Logs
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── TAB 3: VISUAL WORKFLOWS ───────────────────────────────────────── */}
                {activeTab === "workflows" && (
                    <div className="h-full flex flex-col gap-3 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-zinc-300">Editor Visual de Workflows (DAG Canvas)</span>
                                <span className="text-[10px] text-zinc-500">Pipelines con branching, paralelismo y aprobación humana</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                                    <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                                    <span>✨ Generar con GuLiN IA</span>
                                </button>
                                <button className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-500/20 text-accent-300 border border-accent-500/40 rounded-xl text-xs font-semibold cursor-pointer">
                                    <i className="fa-solid fa-plus text-xs"></i>
                                    <span>Agregar Nodo</span>
                                </button>
                            </div>
                        </div>

                        {/* Canvas Mockup interactivo inspirado en XyOps */}
                        <div className="flex-1 bg-[#0d0e12] border border-white/10 rounded-2xl relative overflow-hidden flex items-center justify-center p-6 bg-radial-dots">
                            
                            {/* Nodos del DAG */}
                            <div className="flex items-center gap-8 z-10">
                                
                                {/* Nodo 1: Trigger */}
                                <div className="p-3 bg-zinc-900 border-2 border-amber-500/60 rounded-xl shadow-lg w-48 text-xs">
                                    <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                                        <i className="fa-solid fa-clock text-xs"></i>
                                        <span>Schedule Trigger</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400">Todos los días a las 03:00 AM</p>
                                    <div className="mt-2 text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded font-mono">
                                        0 3 * * *
                                    </div>
                                </div>

                                <i className="fa-solid fa-arrow-right text-zinc-600 text-sm"></i>

                                {/* Nodo 2: Script */}
                                <div className="p-3 bg-zinc-900 border-2 border-accent-500/60 rounded-xl shadow-lg w-56 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-accent-300 flex items-center gap-1.5">
                                            <i className="fa-solid fa-terminal text-xs"></i>
                                            <span>DB Backup Dump</span>
                                        </span>
                                        <span className="text-[9px] px-1 bg-accent-500/20 text-accent-300 rounded">Bash</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400">Target: @database-cluster</p>
                                    <div className="mt-2 text-[9px] px-1.5 py-0.5 bg-black/40 text-emerald-400 rounded font-mono">
                                        pg_dump | gzip &gt; /backup.sql.gz
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[9px] text-zinc-500">
                                        <span>Max Time: 15m</span>
                                        <span className="text-emerald-400 font-bold">On Success ›</span>
                                    </div>
                                </div>

                                <i className="fa-solid fa-arrow-right text-zinc-600 text-sm"></i>

                                {/* Nodo 3: Branching & Actions */}
                                <div className="flex flex-col gap-3">
                                    {/* Rama Éxito */}
                                    <div className="p-2.5 bg-zinc-900 border border-emerald-500/50 rounded-xl w-48 text-xs">
                                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                                            <i className="fa-solid fa-cloud-arrow-up"></i>
                                            <span>Upload S3 Sync</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-400 mt-0.5">Bucket: gulin-backups-prod</p>
                                    </div>

                                    {/* Rama Notificación Discord */}
                                    <div className="p-2.5 bg-zinc-900 border border-purple-500/50 rounded-xl w-48 text-xs">
                                        <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px]">
                                            <i className="fa-brands fa-discord"></i>
                                            <span>Discord Webhook</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-400 mt-0.5">Notificar estado del pipeline</p>
                                    </div>
                                </div>
                            </div>

                            {/* Controles del Canvas abajo a la derecha */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-zinc-900/90 border border-white/10 rounded-xl p-1 shadow-lg text-xs">
                                <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg" title="Zoom Out">
                                    <i className="fa-solid fa-magnifying-glass-minus"></i>
                                </button>
                                <span className="text-[10px] text-zinc-500 px-1 font-mono">100%</span>
                                <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg" title="Zoom In">
                                    <i className="fa-solid fa-magnifying-glass-plus"></i>
                                </button>
                                <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg" title="Guardar Grafo">
                                    <i className="fa-solid fa-floppy-disk"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 4: INCIDENTS & SNAPSHOTS ──────────────────────────────────── */}
                {activeTab === "incidents" && (
                    <div className="h-full flex gap-4 overflow-hidden">
                        {/* Lista de Incidentes */}
                        <div className="w-1/3 flex flex-col gap-2.5 overflow-y-auto pr-1">
                            <div className="text-xs font-semibold text-zinc-400">
                                Registro de Incidentes ({incidents.length})
                            </div>

                            {incidents.map((inc) => {
                                const isSelected = selectedIncident?.id === inc.id;
                                return (
                                    <div
                                        key={inc.id}
                                        onClick={() => setSelectedIncident(inc)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                            isSelected
                                                ? "bg-accent-500/10 border-accent-500/50 shadow-md"
                                                : "bg-zinc-900/40 border-white/10 hover:border-white/20"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                inc.severity === "critical" ? "bg-red-500/20 text-red-300 border border-red-500/40" :
                                                "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                            }`}>
                                                {inc.severity}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-mono">{inc.timestamp}</span>
                                        </div>

                                        <h4 className="font-bold text-xs text-zinc-100 leading-snug">{inc.title}</h4>
                                        <p className="text-[11px] text-zinc-400 mt-1">Host: <span className="font-mono text-zinc-300">{inc.host}</span></p>

                                        <div className="mt-2 flex items-center justify-between text-[10px]">
                                            <span className={`font-semibold ${
                                                inc.status === "active" ? "text-red-400" : "text-emerald-400"
                                            }`}>
                                                ● {inc.status === "active" ? "Activo (Requiere acción)" : "Resuelto / Mitigado"}
                                            </span>
                                            <span className="text-accent-400 underline">Ver Snapshot ›</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Visor de Snapshot y Auto-Remediación */}
                        {selectedIncident && (
                            <div className="w-2/3 bg-zinc-900/40 border border-white/10 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-zinc-100">{selectedIncident.title}</h3>
                                                <span className="text-[10px] px-2 py-0.5 bg-white/5 text-zinc-400 rounded-md font-mono">
                                                    {selectedIncident.id}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                                Disparado por: <span className="text-amber-300">{selectedIncident.metricTrigger}</span>
                                            </p>
                                        </div>

                                        <span className="text-[11px] px-2.5 py-1 bg-accent-500/20 text-accent-300 rounded-lg font-mono">
                                            📸 Snapshot Congelado
                                        </span>
                                    </div>

                                    {/* Procesos Capturados en el Snapshot */}
                                    <div className="space-y-1.5">
                                        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                                            <i className="fa-solid fa-camera-retro text-accent-400"></i>
                                            <span>Procesos en el Instante del Fallo</span>
                                        </span>
                                        <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 font-mono text-[11px] space-y-1">
                                            <div className="flex justify-between text-zinc-500 text-[10px] border-b border-white/5 pb-1">
                                                <span>PID / COMANDO</span>
                                                <span>CPU / MEM</span>
                                            </div>
                                            {selectedIncident.topProcesses.map((p) => (
                                                <div key={p.pid} className="flex justify-between text-zinc-300">
                                                    <span className="truncate pr-2">{p.pid} · {p.command}</span>
                                                    <span className={`font-bold ${p.cpu > 50 || p.mem > 50 ? "text-red-400" : "text-zinc-400"}`}>
                                                        {p.cpu}% CPU · {p.mem}% RAM
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Caja de Diagnóstico de GuLiN IA */}
                                    <div className="p-3 bg-gradient-to-r from-accent-500/10 to-purple-500/10 border border-accent-500/30 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-accent-300">
                                            <i className="fa-solid fa-brain"></i>
                                            <span>Diagnóstico y Sugerencia de GuLiN IA</span>
                                        </div>
                                        <p className="text-xs text-zinc-300 leading-relaxed">
                                            {selectedIncident.aiDiagnosis}
                                        </p>
                                        <div className="text-[11px] text-zinc-400 bg-black/40 p-2 rounded-lg border border-white/5">
                                            <span className="font-semibold text-accent-300">Acción de Remediación: </span>
                                            {selectedIncident.aiRemediation}
                                        </div>
                                    </div>
                                </div>

                                {/* Botón de Remediación */}
                                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                                    <span className="text-[11px] text-zinc-500">Host afectado: {selectedIncident.host}</span>
                                    {selectedIncident.status === "active" ? (
                                        <button
                                            onClick={() => handleApplyRemediation(selectedIncident.id)}
                                            disabled={isRemediating}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                                        >
                                            <i className={`fa-solid ${isRemediating ? "fa-spinner fa-spin" : "fa-shield-halved"}`}></i>
                                            <span>{isRemediating ? "Aplicando Remediación..." : "⚡ Aplicar Remediación Sugerida"}</span>
                                        </button>
                                    ) : (
                                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                                            <i className="fa-solid fa-circle-check"></i> Incidente Mitigado y Resuelto
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
