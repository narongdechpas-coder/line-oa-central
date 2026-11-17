import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorPlay, Play } from 'lucide-react';

/**
 * Entry page in the InsureFlow style. The hero picture is /landing/hero.webp (AI-generated);
 * until that file exists the page shows its gradient background and hides the AI credit.
 */
export function LandingPage() {
  const [hasHero, setHasHero] = useState(false);
  return (
    <main className="landing">
      <img
        className={`landing-hero ${hasHero ? 'on' : ''}`}
        src="/landing/hero.webp"
        alt=""
        onLoad={() => setHasHero(true)}
        onError={() => setHasHero(false)}
      />
      <div className="landing-shade" aria-hidden="true" />
      <div className="landing-body">
        <img className="landing-logo" src="/brand/jacky-logo-512.webp" alt="Jacky" width="120" height="120" />
        <p className="landing-kicker">CENTRAL COMMUNICATION &amp; CASE MANAGEMENT · สำหรับบริษัทประกันวินาศภัย</p>
        <h1 className="landing-title">Jacky Central</h1>
        <p className="landing-promise">ทุก LINE OA ในที่เดียว ส่งต่องานไม่หลุดมือ</p>
        <p className="landing-sub">
          <span>ลูกค้าคุยผ่าน LINE OA เดิมของแต่ละแผนก</span>
          <span>ทีมงานเห็นทุกแชต ส่งเรื่องให้แผนกที่ถูกคน และติดตาม SLA ได้ในที่เดียว</span>
        </p>
        <div className="landing-actions">
          <Link to="/dashboard" className="landing-btn primary"><Play size={18} aria-hidden="true" /> เปิดแอป</Link>
          <a href="/presentation/" className="landing-btn ghost"><MonitorPlay size={18} aria-hidden="true" /> App Presentation</a>
        </div>
      </div>
      <p className="landing-foot">
        เดโม: ข้อมูลลูกค้า แชต และเคสในแอปเป็นข้อมูลจำลอง ไม่ได้เชื่อมต่อ LINE จริง{hasHero ? ' · ภาพพื้นหลังสร้างด้วย AI' : ''}
      </p>
    </main>
  );
}
