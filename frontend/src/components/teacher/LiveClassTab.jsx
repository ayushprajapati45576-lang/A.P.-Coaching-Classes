import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import styles from './Tabs.module.css';

const LiveClassTab = () => {
    const [isLive, setIsLive] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

    // Media States
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Students List State
    const [students, setStudents] = useState([]); // [{id, name, isMuted}]

    const localVideoRef = useRef(null);
    const containerRef = useRef(null);
    const socketRef = useRef(null);
    const peerConnectionsRef = useRef({}); // SocketId -> RTCPeerConnection
    const originalStreamRef = useRef(null);
    const screenTrackRef = useRef(null);
    const studentAudioStreamsRef = useRef({}); // SocketId -> MediaStream

    const startClass = async () => {
        try {
            // 1. Get local media stream
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera/Microphone access requires a secure connection (HTTPS) or localhost.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 24, max: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            originalStreamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // 2. Connect to signaling server
            socketRef.current = io('');

            // 3. Register as broadcaster
            socketRef.current.emit('broadcaster', { room: 'live-class' });

            // 4. Handle incoming watcher connections
            socketRef.current.on('watcher', (id, name) => {
                const peerConnection = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });

                peerConnectionsRef.current[id] = peerConnection;

                // Add student to list
                setStudents(prev => [...prev.filter(s => s.id !== id), { id, name: name || 'Student', isMuted: false }]);

                // Receive audio from student
                peerConnection.ontrack = event => {
                    studentAudioStreamsRef.current[id] = event.streams[0];
                    // Trigger re-render to attach stream to audio element
                    setStudents(prev => [...prev]);
                };

                // Add current local tracks (camera or screen) to peer connection
                const currentStream = localVideoRef.current.srcObject;
                currentStream.getTracks().forEach(track => peerConnection.addTrack(track, currentStream));

                // Send ICE candidates to watcher
                peerConnection.onicecandidate = event => {
                    if (event.candidate) {
                        socketRef.current.emit('candidate', id, event.candidate);
                    }
                };

                // Create offer
                peerConnection.createOffer()
                    .then(sdp => peerConnection.setLocalDescription(sdp))
                    .then(() => {
                        socketRef.current.emit('offer', id, peerConnection.localDescription);
                    });
            });

            // 5. Handle answers & candidates from watchers
            socketRef.current.on('answer', (id, description) => {
                if (peerConnectionsRef.current[id]) {
                    peerConnectionsRef.current[id].setRemoteDescription(description);
                }
            });
            socketRef.current.on('candidate', (id, candidate) => {
                if (peerConnectionsRef.current[id]) {
                    peerConnectionsRef.current[id].addIceCandidate(new RTCIceCandidate(candidate));
                }
            });

            // 6. Handle disconnects
            socketRef.current.on('disconnectPeer', id => {
                if (peerConnectionsRef.current[id]) {
                    peerConnectionsRef.current[id].close();
                    delete peerConnectionsRef.current[id];
                }
                delete studentAudioStreamsRef.current[id];
                setStudents(prev => prev.filter(s => s.id !== id));
            });

            setIsLive(true);
            setIsMuted(false);
            setIsVideoOff(false);
            setIsScreenSharing(false);
            setStatusMsg({ type: 'success', message: 'You are now LIVE!' });

        } catch (err) {
            setStatusMsg({ type: 'error', message: 'Failed to start class. Please ensure camera/microphone permissions are granted.' });
            console.error(err);
        }
    };

    const stopClass = () => {
        if (originalStreamRef.current) {
            originalStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (screenTrackRef.current) {
            screenTrackRef.current.stop();
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        Object.keys(peerConnectionsRef.current).forEach(id => {
            peerConnectionsRef.current[id].close();
        });
        peerConnectionsRef.current = {};
        studentAudioStreamsRef.current = {};

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        setIsLive(false);
        setStudents([]);
        setStatusMsg({ type: '', message: '' });

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    };

    const toggleMute = () => {
        if (originalStreamRef.current) {
            const audioTrack = originalStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (originalStreamRef.current) {
            const videoTrack = originalStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 15, max: 30 }
                    }
                });
                const newVideoTrack = displayStream.getVideoTracks()[0];

                newVideoTrack.onended = () => {
                    revertToCamera();
                };

                const audioTrack = originalStreamRef.current.getAudioTracks()[0];
                const newStream = new MediaStream([newVideoTrack]);
                if (audioTrack) newStream.addTrack(audioTrack);

                localVideoRef.current.srcObject = newStream;

                Object.values(peerConnectionsRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track.kind === 'video');
                    if (sender) sender.replaceTrack(newVideoTrack);
                });

                setIsScreenSharing(true);
                screenTrackRef.current = newVideoTrack;
            } else {
                revertToCamera();
            }
        } catch (err) {
            console.error("Screen sharing failed:", err);
        }
    };

    const revertToCamera = () => {
        if (originalStreamRef.current) {
            const cameraVideoTrack = originalStreamRef.current.getVideoTracks()[0];
            localVideoRef.current.srcObject = originalStreamRef.current;

            Object.values(peerConnectionsRef.current).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(cameraVideoTrack);
            });

            setIsScreenSharing(false);

            if (screenTrackRef.current) {
                screenTrackRef.current.stop();
                screenTrackRef.current = null;
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };

    useEffect(() => {
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            stopClass();
        };
    }, []);

    const toggleStudentMute = (studentId, currentMuteState) => {
        const newMuteState = !currentMuteState;

        // Update local state so UI reflects it
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, isMuted: newMuteState } : s));

        // Emit to the specific student to force mute their microphone
        if (socketRef.current) {
            socketRef.current.emit('force-mute', { targetId: studentId, mute: newMuteState });
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
            {/* Hidden audio tags for student streams */}
            {students.map(s => (
                <audio
                    key={s.id}
                    autoPlay
                    muted={s.isMuted} // Mute playback locally if teacher mutes them
                    ref={el => {
                        if (el && studentAudioStreamsRef.current[s.id] && el.srcObject !== studentAudioStreamsRef.current[s.id]) {
                            el.srcObject = studentAudioStreamsRef.current[s.id];
                        }
                    }}
                />
            ))}

            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Live Class Broadcasting</h2>
                    {!isLive ? (
                        <button onClick={startClass} className={styles.submitBtn} style={{ margin: 0 }}>
                            ▶ Start Live Session
                        </button>
                    ) : (
                        <button onClick={stopClass} className={styles.submitBtn} style={{ margin: 0, background: 'var(--color-danger)' }}>
                            ■ End Live Session
                        </button>
                    )}
                </div>

                {statusMsg.message && (
                    <div className={statusMsg.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginBottom: '1.5rem' }}>
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

                    {isLive && (
                        <button
                            onClick={toggleFullscreen}
                            style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', zIndex: 10 }}
                        >
                            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </button>
                    )}

                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    ></video>

                    {!isLive ? (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                            <p>Camera is off. Click "Start Live Session" to begin.</p>
                        </div>
                    ) : (
                        <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '1rem', zIndex: 10 }}>
                            <button onClick={toggleMute} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', background: isMuted ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                            </button>
                            <button onClick={toggleVideo} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', background: isVideoOff ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isVideoOff ? '📷 Video Off' : '📷 Video On'}
                            </button>
                            <button onClick={toggleScreenShare} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', background: isScreenSharing ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isScreenSharing ? '🛑 Stop Share' : '💻 Share Screen'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Students Sidebar */}
            <div style={{ width: '300px', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                    Connected Students ({students.length})
                </div>
                <div style={{ padding: '1rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {students.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>No students connected yet.</p>
                    ) : (
                        students.map(s => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                <button
                                    onClick={() => toggleStudentMute(s.id, s.isMuted)}
                                    style={{
                                        background: s.isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                        color: s.isMuted ? 'var(--color-danger)' : 'white',
                                        border: 'none',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {s.isMuted ? 'Unmute' : 'Mute'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveClassTab;
