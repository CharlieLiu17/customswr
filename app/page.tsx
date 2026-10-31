import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <section className="hero">
        <Image src="/images/customspfp.png" alt="Customs WR" width={1687} height={955} className="hero-img" priority />
        <h1 className="hero-title">Customs WR</h1>
        <h2 className="hero-tagline">
          <span>Climbing ranked? <span className="x">✗</span></span>
          <span>Climbing against your friends? <span className="check">✓</span></span>
          <span>Matchmaking for the FAC Community.</span>
        </h2>
        <div className="hero-actions">
          <Link href="/matchmaking" className="btn primary big">Start Matchmaking</Link>
          <Link href="/records" className="btn big">View Records</Link>
        </div>
      </section>

      <section className="about">
        <h2>About</h2>
        <p>
          For 3 years, Charlie Liu and Devanshu Tiwari have managed a{' '}
          <a href="https://docs.google.com/spreadsheets/d/157hWVNEJWMWAsZIbV5a3Pt0DtVzC3lJbTbi6zb1hcQg/edit?gid=0#gid=0" target="_blank" rel="noopener noreferrer">
            Google spreadsheet
          </a>{' '}
          that matchmade their friend group, developing an in-house matchmaking algorithm and placement process.
        </p>
        <p>
          We developed advanced statistical analysis. You can compare with your friends, see who you work well with, and who you can't seem to win against.
        </p>
        <p>
          Our matchmaking algorithm takes these synergies and opposing scores together to further refine the matchmaking, creating the most balanced games possible.
        </p>
      </section>
    </>
  );
}
