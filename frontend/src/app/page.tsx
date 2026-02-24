"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Sparkles, ArrowRight, Copy, Share2, Sun, Moon, Keyboard } from "lucide-react";
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

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("skysync_username");
    if (savedName) setUserName(savedName);

    // Update time block exactly like Meets
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 60);
    return () => clearInterval(interval);
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
      const newRoomId = Math.random().toString(36).substring(2, 11).match(/.{1,3}/g)?.join('-') || "abc-def-ghi"; // Like Google Meet

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
    const text = `Join my secure video meeting!\n\nMeeting URL: ${window.location.origin}/room/${createdRoomId}\nMeeting Code: ${createdRoomId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <main className={styles.container}>
      {/* Name Modal */}
      {showNameModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={submitNameAndProceed} className={styles.modalCard}>
            <h2>{showNameModal === "create" ? "Start a Meeting" : "Join Meeting"}</h2>
            <p>Please enter your display name to continue.</p>
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
                Continue
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
              <h2>Here's the link to your meeting</h2>
              <p>Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later, too.</p>
            </div>

            <div className={styles.copyLinkArea}>
              <span className={styles.linkTextUrl}>{`${window.location.origin}/room/${createdRoomId}`}</span>
              <button className={styles.copyLinkIconBtn} onClick={copyToClipboard} title="Copy meeting link">
                <Copy size={20} />
              </button>
            </div>

            <div className={styles.modalActionsCol}>
              <button className={styles.whatsappBtn} onClick={shareViaWhatsApp}>
                <Share2 size={18} /> Share via WhatsApp
              </button>
            </div>

            <button className={styles.enterBtn} onClick={proceedToRoom}>
              Join now
            </button>
          </div>
        </div>
      )}

      {/* Header aligned with Meet */}
      <nav className={styles.header}>
        <div className={styles.logoInfo}>
          <div className={styles.brandIcon}>
            <Sparkles size={20} className={styles.iconSparkle} />
          </div>
          <span className={styles.logoText}>SkySync</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.dateTimeText}>
            {currentTime} • {currentDate}
          </div>
          <button className={styles.iconButton} onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
          </button>
        </div>
      </nav>

      {/* Main Content mimicking Google Meet */}
      <section className={styles.content}>
        <div className={styles.leftCol}>
          <h1 className={styles.mainHeadline}>Premium video meetings.<br />Now available for everyone.</h1>
          <p className={styles.subHeadline}>
            We built SkySync for secure and instant communication, making it free and available for all without any limits.
          </p>

          <div className={styles.meetActions}>
            <button className={styles.newMeetingBtn} onClick={handleStartMeetingClick}>
              <Video size={20} /> New meeting
            </button>

            <div className={styles.joinInputBox}>
              <Keyboard size={20} className={styles.inputIcon} />
              <input
                type="text"
                placeholder="Enter a code or link"
                className={styles.codeInput}
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinMeetingClick();
                }}
              />
            </div>
            {roomId.trim() && (
              <button className={styles.joinTextBtn} onClick={handleJoinMeetingClick}>Join</button>
            )}
          </div>
          <div className={styles.separatorLine}></div>
          <div className={styles.learnMore}>
            <a href="#">Learn more</a> about SkySync.
          </div>
        </div>

        {/* Right column stylized Meet Carousel */}
        <div className={styles.rightCol}>
          <div className={styles.carouselVisual}>
            <div className={styles.carouselCircle1}></div>
            <div className={styles.carouselCircle2}></div>
            <div className={styles.carouselGraphic}>
              <div className={styles.glassMockCard}>
                <Sparkles size={40} className={styles.mockupIcon} />
                <div className={styles.mockupLines}>
                  <div className={styles.mockLineLong}></div>
                  <div className={styles.mockLineShort}></div>
                </div>
              </div>
              <div className={styles.glassMockCardOverlay}>
                <Video size={30} className={styles.mockupIconSmall} />
              </div>
            </div>
          </div>

          <div className={styles.carouselText}>
            <h3>Get a link you can share</h3>
            <p>Click <strong>New meeting</strong> to get a link you can send to people you want to meet with</p>
          </div>
          <div className={styles.carouselDots}>
            <span className={styles.dotActive}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        </div>
      </section>
    </main>
  );
}
