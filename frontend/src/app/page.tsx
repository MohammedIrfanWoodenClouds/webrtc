"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Sparkles, ArrowRight, Copy, Share2, PlayCircle, Shield, Zap, MonitorUp, Sun, Moon } from "lucide-react";
import styles from "./page.module.css";
import { useTheme } from "@/context/ThemeContext";

export default function Home() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");

  const [showNameModal, setShowNameModal] = useState<"create" | "join" | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("skysync_username");
    if (savedName) setUserName(savedName);
  }, []);

  const handleStartMeetingClick = () => {
    setShowNameModal("create");
  };

  const handleJoinMeetingClick = () => {
    if (!roomId.trim()) return;
    setShowNameModal("join");
  };

  const submitNameAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    localStorage.setItem("skysync_username", userName.trim());

    if (showNameModal === "create") {
      const newRoomId = Math.random().toString(36).substring(2, 9);

      // Register this user as the creator of this room
      const owned = JSON.parse(localStorage.getItem("skysync_owned_rooms") || "[]");
      if (!owned.includes(newRoomId)) {
        owned.push(newRoomId);
        localStorage.setItem("skysync_owned_rooms", JSON.stringify(owned));
      }

      setCreatedRoomId(newRoomId);
      setShowNameModal(null);
      setShowShareModal(true);
    } else if (showNameModal === "join") {
      setShowNameModal(null);
      router.push(`/room/${roomId.trim()}`);
    }
  };

  const proceedToRoom = () => {
    router.push(`/room/${createdRoomId}`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${createdRoomId}`);
  };

  const shareViaWhatsApp = () => {
    const text = `Join my secure video meeting!\n\nMeeting ID: ${createdRoomId}\nLink: ${window.location.origin}/room/${createdRoomId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <main className={styles.container}>
      {/* Dynamic Background */}
      <div className={styles.ambientBackground}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      {/* Header */}
      <nav className={styles.navbar}>
        <div className={styles.logoInfo}>
          <div className={styles.brandIcon}>
            <Sparkles size={20} className={styles.iconSparkle} />
          </div>
          <span className={styles.logoText}>SkySync</span>
        </div>
        <div className={styles.navActions}>
          <button className={styles.themeToggleBtn} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className={styles.signInBtn}>Sign In</button>
        </div>
      </nav>

      {/* Name Modal */}
      {showNameModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={submitNameAndProceed} className={styles.modalCard}>
            <h2>{showNameModal === "create" ? "Start a Meeting" : "Join Meeting"}</h2>
            <p>Please enter your display name to continue.</p>
            <label className={styles.inputLabel}>YOUR NAME</label>
            <input
              type="text"
              className={styles.styledInput}
              placeholder="e.g. Alex"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActionsRow}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowNameModal(null)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={!userName.trim()}>
                Continue <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Share Modal Interstitial */}
      {showShareModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2>Meeting Ready</h2>
              <p>Share this link with others so they can join.</p>
            </div>

            <div className={styles.idBox}>
              <span className={styles.idLabel}>Meeting ID</span>
              <strong className={styles.idValue}>{createdRoomId}</strong>
            </div>

            <div className={styles.modalActionsCol}>
              <button className={styles.secondaryBtn} onClick={copyToClipboard}>
                <Copy size={18} /> Copy Link
              </button>
              <button className={styles.whatsappBtn} onClick={shareViaWhatsApp}>
                <Share2 size={18} /> Share via WhatsApp
              </button>
            </div>

            <button className={styles.enterBtn} onClick={proceedToRoom}>
              Enter Room <ArrowRight size={18} style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.badgeLabel}>
            <span className={styles.badgeDot}></span>
            Next-Gen Communication
          </div>
          <h1 className={styles.heroTitle}>Connect Instantly.<br /><span className={styles.gradientText}>Sync Seamlessly.</span></h1>
          <p className={styles.heroSubtitle}>
            Experience crystal-clear video calls and instant messaging without limits. Designed for those who value speed, privacy, and aesthetic excellence.
          </p>

          <div className={styles.actionContainer}>
            <button className={styles.primaryActionBtn} onClick={handleStartMeetingClick}>
              <Video size={20} /> Start a Meeting
            </button>

            <div className={styles.joinContainer}>
              <div className={styles.joinInputWrapper}>
                <input
                  type="text"
                  placeholder="Enter Meeting ID"
                  className={styles.joinInputNeo}
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                />
                <button
                  className={styles.joinBtnNeo}
                  onClick={handleJoinMeetingClick}
                  disabled={!roomId.trim()}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
          <div className={styles.trustIndicators}>
            <span className={styles.trustItem}><Shield size={14} /> End-to-End Encrypted</span>
            <span className={styles.trustItem}><Zap size={14} /> Low Latency</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.glassMockup}>
            <div className={styles.mockupHeader}>
              <div className={styles.mockupDots}><span></span><span></span><span></span></div>
              <div className={styles.mockupTitle}>SkySync Room</div>
            </div>
            <div className={styles.mockupBody}>
              <div className={styles.avatarGrid}>
                <div className={styles.avatarMain}>
                  <div className={styles.ripple}></div>
                  <Video size={48} className={styles.avatarIcon} />
                </div>
                <div className={styles.avatarSideContainer}>
                  <div className={styles.avatarSmall}></div>
                  <div className={styles.avatarSmall}></div>
                  <div className={styles.avatarSmall}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} SkySync. All rights reserved.</p>
      </footer>
    </main>
  );
}
