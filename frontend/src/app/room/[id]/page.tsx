"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, PhoneOff, MessageSquare, Send, Link, Check, Moon, Sun, Hand, SmilePlus, Info, Users, Copy, Sparkles } from "lucide-react";
import styles from "./page.module.css";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoPlayer from "@/components/VideoPlayer";
import { useTheme } from "@/context/ThemeContext";

const EMOJIS = ["👍", "❤️", "😂", "👏", "🎉", "😮"];

export default function Room() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();

    const [userName, setUserName] = useState("");
    const [namePrompt, setNamePrompt] = useState("");
    const [needsName, setNeedsName] = useState(false);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Interactions State
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        const name = localStorage.getItem("skysync_username");
        if (!name) {
            setNeedsName(true);
        } else {
            setUserName(name);
        }
    }, []);

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (namePrompt.trim()) {
            localStorage.setItem("skysync_username", namePrompt.trim());
            setUserName(namePrompt.trim());
            setNeedsName(false);
        }
    };

    const {
        localStream, peers, messages, sendMessage, shareScreen,
        stopScreenShare, toggleAudio, toggleVideo, error, isWaiting,
        isHost, joinRequests, isJoined, respondToJoinRequest,
        reactions, raisedHands, systemNotifications, sendReaction, toggleHand
    } = useWebRTC(id, userName || "Guest");

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isChatOpen]);

    if (needsName) {
        return (
            <div className={styles.container}>
                <div className={styles.namePromptOverlay}>
                    <form onSubmit={handleNameSubmit} className={`glass-panel ${styles.namePromptCard}`} style={{ maxWidth: 400, padding: 32, borderRadius: 16 }}>
                        <h2 style={{ marginBottom: 8, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Join Meeting</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Please enter your display name to join the call.</p>

                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>YOUR NAME</label>
                        <input
                            type="text"
                            className={styles.chatInputNeo}
                            style={{ width: '100%', padding: '14px 20px', borderRadius: 10, background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                            placeholder="e.g. Alex"
                            value={namePrompt}
                            onChange={e => setNamePrompt(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className={`btn btn-primary`} style={{ marginTop: 24, width: '100%', borderRadius: 10 }}>
                            Join Meeting
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (!userName) return null;

    const handleToggleMute = () => {
        toggleAudio(isMuted);
        setIsMuted(!isMuted);
    };

    const handleToggleVideo = () => {
        toggleVideo(isVideoOff);
        setIsVideoOff(!isVideoOff);
    };

    const handleToggleScreen = async () => {
        if (isScreenSharing) {
            await stopScreenShare();
            setIsScreenSharing(false);
        } else {
            const success = await shareScreen(() => setIsScreenSharing(false));
            if (success) setIsScreenSharing(true);
        }
    };

    const handleToggleHand = () => {
        setIsHandRaised(!isHandRaised);
        toggleHand();
    };

    const handleSendReaction = (emoji: string) => {
        sendReaction(emoji);
        setShowEmojiPicker(false);
    };

    const handleLeave = () => {
        window.location.href = "/";
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/room/${id}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            sendMessage(chatInput);
            setChatInput("");
        }
    };

    const renderReactions = (targetSocketId: string | 'local') => {
        const peerIds = peers.map(p => p.socketId);
        const userReactions = reactions.filter(r => {
            if (targetSocketId === 'local') return !peerIds.includes(r.socketId);
            return r.socketId === targetSocketId;
        });

        return userReactions.map(r => (
            <div key={r.id} className={styles.floatingReaction}>
                {r.emoji}
            </div>
        ));
    };

    // Dynamic grid layout class based on number of participants
    const participantCount = peers.length + 1;
    let gridClass = styles.grid1;
    if (participantCount === 2) gridClass = styles.grid2;
    else if (participantCount === 3 || participantCount === 4) gridClass = styles.grid3_4;
    else if (participantCount > 4) gridClass = styles.gridMore;

    const toggleChat = () => {
        if (!isChatOpen) setIsInfoOpen(false);
        setIsChatOpen(!isChatOpen);
    };

    const toggleInfo = () => {
        if (!isInfoOpen) setIsChatOpen(false);
        setIsInfoOpen(!isInfoOpen);
    };

    return (
        <div className={styles.container}>
            {/* Waiting Room */}
            {isWaiting && !isJoined && (
                <div className={styles.waitingOverlay}>
                    <div className={styles.waitingCard}>
                        <div className={styles.ambientGlowWaiting}></div>
                        <div className={styles.waitingSpinner}></div>
                        <h2>Asking to join...</h2>
                        <p>You will join the meeting when the host lets you in.</p>
                        <button className={styles.pillBtnSecondary} onClick={handleLeave} style={{ marginTop: 24 }}>
                            Leave
                        </button>
                    </div>
                </div>
            )}

            {/* Host Join Requests Toast */}
            {isHost && joinRequests.length > 0 && (
                <div className={styles.hostToasts}>
                    {joinRequests.map(req => (
                        <div key={req.socketId} className={styles.toastCard}>
                            <p><strong>{req.userName}</strong> wants to join this meeting.</p>
                            <div className={styles.toastActions}>
                                <button className={styles.toastBtnDeny} onClick={() => respondToJoinRequest(req.socketId, false)}>Deny</button>
                                <button className={styles.toastBtnAdmit} onClick={() => respondToJoinRequest(req.socketId, true)}>Admit</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* System Notifications (Join/Leave log) */}
            <div className={styles.systemNotifications}>
                {systemNotifications.map(notification => (
                    <div key={notification.id} className={styles.notificationToast}>
                        {notification.message}
                    </div>
                ))}
            </div>

            {/* Subtle Top-Left Info (Time, Name placeholder, Logo) */}
            <div className={styles.topLeftOverlay}>
                <div className={styles.meetingLogoWrap}>
                    <Sparkles size={18} className={styles.meetingLogoIcon} />
                    <span className={styles.meetingLogoText}>SkySync</span>
                </div>
                <div className={styles.timeDisplay}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={styles.roomBadgeMini}>
                    {id}
                </div>
            </div>

            {/* Main Content Area */}
            <div className={styles.mainContent}>
                {error && (
                    <div className={styles.errorBanner}>{error}</div>
                )}

                <div className={`${styles.videoGridContainer} ${(isChatOpen || isInfoOpen) ? styles.shrink : ""}`}>
                    <div className={`${styles.videoGrid} ${gridClass}`}>
                        {/* Local Video */}
                        <div className={styles.videoContainerWrapper}>
                            <VideoPlayer
                                stream={isVideoOff ? null : localStream}
                                userName="You"
                                isLocal={true}
                                isMuted={isMuted}
                            />
                            {isVideoOff && (
                                <div className={styles.avatarPlaceholder}>
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className={styles.videoOverlayLabel}>
                                {isMuted ? <MicOff size={16} className={styles.mutedIconLabel} /> : null}
                                You {isHost && "(Host)"}
                            </div>
                            {isHandRaised && <div className={styles.handIndicator}><Hand size={20} color="#eab308" /></div>}
                            {renderReactions('local')}
                        </div>

                        {/* Remote Peers */}
                        {peers.map((peer) => (
                            <div key={peer.socketId} className={styles.videoContainerWrapper}>
                                <VideoPlayer
                                    stream={peer.stream}
                                    userName={peer.userName}
                                    isLocal={false}
                                />
                                <div className={styles.videoOverlayLabel}>
                                    {peer.userName}
                                </div>
                                {raisedHands.includes(peer.socketId) && <div className={styles.handIndicator}><Hand size={20} color="#eab308" /></div>}
                                {renderReactions(peer.socketId)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Unified Sidebar Area for Chat or Info */}
                <div className={`${styles.sidePanel} ${(isChatOpen || isInfoOpen) ? styles.open : ""}`}>
                    {/* Chat Panel Content */}
                    {isChatOpen && (
                        <>
                            <div className={styles.sideHeader}>
                                <h3>Meeting Chat</h3>
                                <button className="btn-icon" style={{ width: 32, height: 32, background: 'transparent' }} onClick={() => setIsChatOpen(false)}>
                                    &times;
                                </button>
                            </div>
                            <div className={styles.chatMessages}>
                                <div className={styles.systemMessage}>Messages sent during this meeting are secure.</div>
                                {messages.map((msg) => {
                                    const isMine = msg.senderName === userName;
                                    return (
                                        <div key={msg.id} className={`${styles.chatBubbleWrapper} ${isMine ? styles.chatBubbleWrapperSelf : ""}`}>
                                            {!isMine && <div className={styles.chatSender}>{msg.senderName}</div>}
                                            <div className={`${styles.chatBubble} ${isMine ? styles.chatBubbleSelf : styles.chatBubbleOther}`}>
                                                <div className={styles.chatText}>{msg.message}</div>
                                                <div className={styles.chatTime}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>
                            <form className={styles.chatInputArea} onSubmit={handleSendMessage}>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="text"
                                        placeholder="Send a message"
                                        className={styles.chatInputNeo}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                    />
                                    <button type="submit" className={styles.sendNeoBtn} disabled={!chatInput.trim()}>
                                        <Send size={18} />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* Info Panel Content */}
                    {isInfoOpen && (
                        <>
                            <div className={styles.sideHeader}>
                                <h3>Meeting Details</h3>
                                <button className="btn-icon" style={{ width: 32, height: 32, background: 'transparent' }} onClick={() => setIsInfoOpen(false)}>
                                    &times;
                                </button>
                            </div>
                            <div className={styles.infoContent}>
                                <div className={styles.infoSection}>
                                    <h4>Joining Info</h4>
                                    <p className={styles.infoDesc}>Share this link with others so they can join.</p>
                                    <div className={styles.copyBox}>
                                        <div className={styles.linkText}>{`${window.location.origin}/room/${id}`}</div>
                                        <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
                                            {linkCopied ? <Check size={18} /> : <Copy size={18} />} Copy join info
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.infoSection}>
                                    <h4>Participants ({participantCount})</h4>
                                    <div className={styles.participantList}>
                                        <div className={styles.participantRow}>
                                            <div className={styles.userProfileIconSmall}>{userName.charAt(0).toUpperCase()}</div>
                                            <span>{userName} (You) {isHost && <span className={styles.hostBadgeSubtle}>Host</span>}</span>
                                        </div>
                                        {peers.map(p => (
                                            <div key={p.socketId} className={styles.participantRow}>
                                                <div className={styles.userProfileIconSmall}>{p.userName.charAt(0).toUpperCase()}</div>
                                                <span>{p.userName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Bottom Google Meet-style Controls Bar */}
            <footer className={styles.bottomControlsBar}>
                <div className={styles.controlsGroupLeft}>
                    {/* Left side info space */}
                    <div className={styles.bottomTime}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className={styles.separator}>|</div>
                    <div className={styles.bottomRoomId}>{id}</div>
                </div>

                <div className={styles.centerControls}>
                    <button
                        className={`${styles.controlBtn} ${isMuted ? styles.controlBtnDanger : ""}`}
                        onClick={handleToggleMute}
                        title={isMuted ? "Turn on microphone" : "Turn off microphone"}
                    >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    <button
                        className={`${styles.controlBtn} ${isVideoOff ? styles.controlBtnDanger : ""}`}
                        onClick={handleToggleVideo}
                        title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    >
                        {isVideoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
                    </button>

                    <button
                        className={`${styles.controlBtn} ${isScreenSharing ? styles.controlBtnActive : ""}`}
                        onClick={handleToggleScreen}
                        title="Present now"
                    >
                        <MonitorUp size={22} />
                    </button>

                    <button
                        className={`${styles.controlBtn} ${isHandRaised ? styles.controlBtnActive : ""}`}
                        onClick={handleToggleHand}
                        title={isHandRaised ? "Lower hand" : "Raise hand"}
                    >
                        <Hand size={22} />
                    </button>

                    <div className={styles.reactionWrapper}>
                        <button
                            className={`${styles.controlBtn}`}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            title="Send a reaction"
                        >
                            <SmilePlus size={22} />
                        </button>
                        {showEmojiPicker && (
                            <div className={styles.emojiPickerPopup}>
                                {EMOJIS.map(e => (
                                    <button key={e} onClick={() => handleSendReaction(e)} className={styles.emojiBtn}>{e}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className={styles.leavePillBtn} onClick={handleLeave} title="Leave call">
                        <PhoneOff size={24} />
                    </button>
                </div>

                <div className={styles.controlsGroupRight}>
                    <button
                        className={`${styles.rightToolBtn} ${isInfoOpen ? styles.toolBtnActive : ""}`}
                        onClick={toggleInfo}
                        title="Meeting details"
                    >
                        <Info size={20} />
                    </button>
                    <button
                        className={`${styles.rightToolBtn}`}
                        title="Show everyone"
                    >
                        <Users size={20} />
                        <span className={styles.badgeCount}>{participantCount}</span>
                    </button>
                    <button
                        className={`${styles.rightToolBtn} ${isChatOpen ? styles.toolBtnActive : ""}`}
                        onClick={toggleChat}
                        title="Chat with everyone"
                    >
                        <MessageSquare size={20} />
                    </button>
                    <button className={styles.themeToggleNav} onClick={toggleTheme} title="Toggle Theme">
                        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </footer>
        </div>
    );
}
