// Copyright 2026, GuLiN Terminal
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { atoms, getApi } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

interface GulinBridgeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_BRIDGE_URL = "https://gulin-bridge.738rw5vk4n066.us-east-1.cs.amazonlightsail.com";

export const GulinBridgeModal: React.FC<GulinBridgeModalProps> = ({ isOpen, onClose }) => {
    const settings = useAtomValue(atoms.settingsAtom);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        url: DEFAULT_BRIDGE_URL,
        email: "",
        password: "",
        confirmPassword: ""
    });

    useEffect(() => {
        if (isOpen) {
            setErrorMsg(null);
            setSuccessMsg(null);
            setFormData(prev => ({
                ...prev,
                url: settings?.["gulinbridge:url"] || DEFAULT_BRIDGE_URL,
                email: settings?.["gulinbridge:email"] || prev.email || "",
                password: "",
                confirmPassword: ""
            }));
        }
    }, [isOpen, settings]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!formData.url || !formData.email || !formData.password) {
            setErrorMsg("Por favor completa todos los campos requeridos.");
            return;
        }

        if (isRegisterMode && formData.password !== formData.confirmPassword) {
            setErrorMsg("Las contraseñas no coinciden.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isRegisterMode) {
                await RpcApi.GulinBridgeRegisterCommand(TabRpcClient, {
                    url: formData.url,
                    email: formData.email,
                    password: formData.password
                });
                setSuccessMsg("¡Cuenta creada y conectada con éxito!");
            } else {
                await RpcApi.GulinBridgeLoginCommand(TabRpcClient, {
                    url: formData.url,
                    email: formData.email,
                    password: formData.password
                });
                setSuccessMsg("¡Conexión exitosa con Gulin Bridge!");
            }

            // Refrescar sincronización de modelos
            try {
                await RpcApi.GulinBridgeSyncModelsCommand(TabRpcClient);
            } catch (syncErr) {
                console.warn("Aviso al sincronizar modelos:", syncErr);
            }

            setTimeout(() => {
                onClose();
            }, 900);
        } catch (err: any) {
            setErrorMsg(err?.message || "Error al conectar con Gulin Bridge");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div 
                className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative text-zinc-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header con gradiente decorativo */}
                <div className="relative p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-accent-500/10 to-transparent">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/40 flex items-center justify-center text-accent-400 text-lg shadow-inner">
                                <i className={`fa-solid ${isRegisterMode ? "fa-user-plus" : "fa-shield-halved"}`} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    {isRegisterMode ? "Crear Cuenta en Gulin Bridge" : "Acceder a Gulin Bridge"}
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    {isRegisterMode 
                                        ? "Regístrate para habilitar IA privada y sincronizada" 
                                        : "Inicia sesión con tu cuenta de Gulin Bridge"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-xmark text-sm" />
                        </button>
                    </div>
                </div>

                {/* Body / Formulario */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errorMsg && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
                            <i className="fa-solid fa-triangle-exclamation mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-start gap-2.5">
                            <i className="fa-solid fa-circle-check mt-0.5" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* URL del Bridge */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            URL del Servidor Bridge
                        </label>
                        <div className="relative">
                            <i className="fa-solid fa-server absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-500/50 focus:bg-zinc-900 transition-all"
                                placeholder={DEFAULT_BRIDGE_URL}
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs" />
                            <input
                                type="email"
                                className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-500/50 focus:bg-zinc-900 transition-all"
                                placeholder="tu-correo@ecogulin.cl"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Contraseña */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Contraseña
                        </label>
                        <div className="relative">
                            <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs" />
                            <input
                                type="password"
                                className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-500/50 focus:bg-zinc-900 transition-all"
                                placeholder="••••••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Confirmar Contraseña (Registro) */}
                    {isRegisterMode && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Confirmar Contraseña
                            </label>
                            <div className="relative">
                                <i className="fa-solid fa-shield-check absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs" />
                                <input
                                    type="password"
                                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-500/50 focus:bg-zinc-900 transition-all"
                                    placeholder="••••••••••••"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Acceso externo al Dashboard */}
                    <button
                        type="button"
                        onClick={() => {
                            if (formData.url) {
                                getApi().openExternal(formData.url);
                            }
                        }}
                        className="w-full py-2 px-3 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-xl border border-white/5 flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                    >
                        <span className="flex items-center gap-2">
                            <i className="fa-solid fa-globe text-accent-400 text-xs" />
                            Abrir Dashboard web en navegador
                        </span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                    </button>

                    {/* Botón de Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.email || !formData.password || !formData.url}
                        className="w-full mt-2 py-3 bg-gradient-to-r from-accent-600 to-indigo-600 hover:from-accent-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <i className="fa-solid fa-spinner-third fa-spin text-sm" />
                                <span>Conectando...</span>
                            </>
                        ) : (
                            <>
                                <i className={`fa-solid ${isRegisterMode ? "fa-user-plus" : "fa-bolt"} text-xs`} />
                                <span>{isRegisterMode ? "Crear Cuenta y Conectar" : "Iniciar Sesión"}</span>
                            </>
                        )}
                    </button>

                    {/* Switch Login / Registro */}
                    <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                        <span>{isRegisterMode ? "¿Ya tienes cuenta?" : "¿No tienes cuenta en Bridge?"}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setErrorMsg(null);
                                setSuccessMsg(null);
                            }}
                            className="text-accent-400 hover:text-accent-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
                        >
                            {isRegisterMode ? "Iniciar Sesión" : "Registrarse"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
