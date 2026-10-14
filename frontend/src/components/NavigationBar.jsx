import './NavigationBar.css';
import speechCoachLogo from '../assets/speech-coach-logo.jpg';

function NavigationBar() {
  return (
    <header className="navigation-bar">
      <div className="site-brand">
        <img
          className="site-logo"
          src={speechCoachLogo}
          alt="AI coach helping a speaker at a podium"
        />
        <h2 className="site-title">Smart Speech Coach</h2>
      </div>
      <nav className="navigation-links" aria-label="Main navigation">
        <a href="#">Home</a>
        <a href="#">About</a>
        <a href="#">Projects</a>
        <a href="#">Contact</a>
      </nav>
    </header>
  );
}

export default NavigationBar;
