import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};

export const useAlert = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useAlert must be used within a ConfirmProvider');
    }
    return context.alert;
};

export const ConfirmProvider = ({ children }) => {
    const [dialogState, setDialogState] = useState(null);
    const resolveRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setDialogState({
                title: options.title || 'Are you sure?',
                message: options.message || 'Do you want to proceed with this action?',
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                showCancel: options.showCancel !== false && options.cancelText !== false,
                isDanger: options.isDanger !== false,
                icon: options.icon || (options.isDanger !== false ? 'danger' : 'warning')
            });
        });
    }, []);

    const alert = useCallback((messageOrOptions) => {
        const opts = typeof messageOrOptions === 'string' ? { message: messageOrOptions } : (messageOrOptions || {});
        return confirm({
            title: opts.title || 'Notification',
            message: opts.message || '',
            confirmText: opts.confirmText || 'OK',
            showCancel: false,
            isDanger: opts.isDanger || false,
            icon: opts.icon || (opts.isDanger ? 'danger' : 'warning')
        });
    }, [confirm]);

    const handleConfirm = () => {
        if (resolveRef.current) resolveRef.current(true);
        resolveRef.current = null;
        setDialogState(null);
    };

    const handleCancel = () => {
        if (resolveRef.current) resolveRef.current(false);
        resolveRef.current = null;
        setDialogState(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!dialogState) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        if (dialogState) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dialogState]);

    return (
        <ConfirmContext.Provider value={{ confirm, alert }}>
            {children}
            {dialogState && (
                <div
                    onClick={handleCancel}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(11, 15, 25, 0.72)',
                        backdropFilter: 'blur(5px)',
                        WebkitBackdropFilter: 'blur(5px)',
                        zIndex: 100000000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.25rem',
                        animation: 'apcBackdropFade 0.15s ease'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#ffffff',
                            color: '#0f172a',
                            borderRadius: '16px',
                            padding: '1.75rem',
                            maxWidth: '430px',
                            width: '100%',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            animation: 'apcModalScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        <style>{`
                            @keyframes apcBackdropFade {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                            @keyframes apcModalScale {
                                from { opacity: 0; transform: scale(0.92); }
                                to { opacity: 1; transform: scale(1); }
                            }
                        `}</style>

                        {/* Top Icon Badge */}
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: dialogState.isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(224, 138, 0, 0.12)',
                            color: dialogState.isDanger ? '#ef4444' : '#E08A00',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem'
                        }}>
                            {dialogState.isDanger ? <AlertTriangle size={28} /> : <AlertCircle size={28} />}
                        </div>

                        {/* Title */}
                        <h3 style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: '#1B2240',
                            lineHeight: 1.3
                        }}>
                            {dialogState.title}
                        </h3>

                        {/* Message */}
                        <p style={{
                            margin: '0 0 1.5rem 0',
                            fontSize: '0.93rem',
                            color: '#475569',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-line'
                        }}>
                            {dialogState.message}
                        </p>

                        {/* Actions */}
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            width: '100%'
                        }}>
                            {dialogState.showCancel && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    style={{
                                        flex: 1,
                                        padding: '0.7rem 1rem',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        background: '#ffffff',
                                        color: '#475569',
                                        fontSize: '0.92rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {dialogState.cancelText}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleConfirm}
                                autoFocus
                                style={{
                                    flex: 1,
                                    padding: '0.7rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: dialogState.isDanger ? '#ef4444' : '#E08A00',
                                    color: '#ffffff',
                                    fontSize: '0.92rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: dialogState.isDanger ? '0 4px 12px rgba(239, 68, 68, 0.35)' : '0 4px 12px rgba(224, 138, 0, 0.35)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {dialogState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
