import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../teacher/Tabs.module.css';

const StudentLiveClassTab = () => {
    const { user } = useAuth();
    const [isLive, setIsLive] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', message: 'Waiting for teacher to start the class...' });
    
    // New States
    const [isMuted, setIsMuted] = useState(false); // Refers to the local microphone
    const [isTeacherMuted, setIsTeacherMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const remoteVideoRef = useRef(null);
    const containerRef = useRef(null);
    const socketRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);

    useEffect(() => {
        // Connect to signaling server
        socketRef.current = io('');
        
        // 1. Capture local audio for two-way communication
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                localStreamRef.current = stream;
                
                // 2. Register as watcher, passing name
                socketRef.current.emit('watcher', { room: 'live-class', name: user?.email });
            }).catch(err => {
                console.error("Microphone access denied or unavailable", err);
                // Fallback to viewing without sending audio
                socketRef.current.emit('watcher', { room: 'live-class', name: user?.email });
            });
        } else {
            console.error("mediaDevices API not available (requires HTTPS or localhost). Falling back to view-only mode.");
            socketRef.current.emit('watcher', { room: 'live-class', name: user?.email });
        }

        socketRef.current.on('offer', (id, description) => {
            peerConnectionRef.current = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            // Add local audio track to connection so teacher can hear
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    peerConnectionRef.current.addTrack(track, localStreamRef.current);
                });
            }

            peerConnectionRef.current.ontrack = event => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
                setIsLive(true);
                setStatusMsg({ type: 'success', message: 'Connected to live class!' });
            };

            peerConnectionRef.current.onicecandidate = event => {
                if (event.candidate) {
                    socketRef.current.emit('candidate', id, event.candidate);
                }
            };

            peerConnectionRef.current.setRemoteDescription(description)
                .then(() => peerConnectionRef.current.createAnswer())
                .then(sdp => peerConnectionRef.current.setLocalDescription(sdp))
                .then(() => {
                    socketRef.current.emit('answer', id, peerConnectionRef.current.localDescription);
                });
        });

        socketRef.current.on('candidate', (id, candidate) => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        socketRef.current.on('broadcaster', () => {
            // Teacher just came online, request stream
            socketRef.current.emit('watcher', { room: 'live-class', name: user?.email });
        });

        socketRef.current.on('broadcaster-disconnected', () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            setIsLive(false);
            setStatusMsg({ type: 'error', message: 'Teacher ended the live session.' });
        });

        socketRef.current.on('disconnectPeer', () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            setIsLive(false);
            setStatusMsg({ type: 'error', message: 'Connection lost.' });
        });

        // Force mute command from teacher
        socketRef.current.on('force-mute', (mute) => {
            if (localStreamRef.current) {
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !mute;
                    setIsMuted(mute);
                }
            }
        });

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            if (peerConnectionRef.current) peerConnectionRef.current.close();
            if (socketRef.current) socketRef.current.disconnect();
            if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        };
    }, [user?.email]);

    const toggleLocalMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleTeacherMute = () => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
            setIsTeacherMuted(remoteVideoRef.current.muted);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current && containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else if (remoteVideoRef.current && remoteVideoRef.current.webkitEnterFullscreen) {
                // iOS Fallback
                remoteVideoRef.current.webkitEnterFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', margin: 0 }}>Live Class</h2>

            {statusMsg.message && (
                <div className={statusMsg.type === 'error' ? styles.errorMsg : (statusMsg.type === 'success' ? styles.successMsg : '')} style={{ marginBottom: '1.5rem', color: statusMsg.type === '' ? 'var(--color-text-muted)' : undefined }}>
                    {statusMsg.message}
                </div>
            )}

            <div 
                ref={containerRef}
                style={{ 
                    width: '100%', 
                    aspectRatio: '16/9', 
                    background: '#000', 
                    borderRadius: isFullscreen ? '0' : '8px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: isFullscreen ? 'none' : '1px solid var(--color-border)'
                }}
            >
                {isLive && (
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'red', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', zIndex: 10, animation: 'pulse 2s infinite' }}>
                        LIVE
                    </div>
                )}



                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline
                    muted={isTeacherMuted}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                ></video>
                
                {!isLive ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                        <div className={styles.loader}></div>
                    </div>
                ) : (
                    <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '1rem', zIndex: 10 }}>
                        <button onClick={toggleLocalMute} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', background: isMuted ? 'var(--color-danger)' : 'var(--color-border)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(4px)' }}>
                            {isMuted ? '🔇 Mic Muted' : '🎤 Mic Active'}
                        </button>
                        <button onClick={toggleFullscreen} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', background: 'var(--color-secondary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                            {isFullscreen ? '↙️ Exit Fullscreen' : '↗️ Full Screen'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentLiveClassTab;
