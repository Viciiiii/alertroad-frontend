import "./InfoSections.css";

const features = [
  {
    title: "Damage Detection",
    description: "Potholes and cracks, with confidence scores.",
    accentClass: "accent-yellow",
  },
  {
    title: "Traffic awareness",
    description: "Vehicle counts feed the risk score.",
    accentClass: "accent-red",
  },
  {
    title: "Mapped results",
    description: "Pinned by location and time.",
    accentClass: "accent-slate",
  },
];

const steps = [
  { number: "01", title: "Upload", subtitle: "Photo or Video" },
  { number: "02", title: "Detect", subtitle: "Damage + Traffic" },
  { number: "03", title: "Classify", subtitle: "Low / Med / High" },
  { number: "04", title: "Review", subtitle: "Map + History" },
];

function InfoSections() {
  return (
    <div className="info-sections">
      <section id="overview" className="info-section info-section-light">
        <p className="info-eyebrow">Overview</p>
        <h2 className="info-heading">One upload, a complete risk picture</h2>
        <p className="info-subtext">
          A single photo or recorded video is all it takes, detection,
          feature extraction, and risk scoring happen automatically.
        </p>
      </section>

      <section id="features" className="info-section info-section-dark">
        <p className="info-eyebrow">Features</p>
        <h2 className="info-heading">Built for how roads get monitored</h2>

        <div className="feature-cards">
          {features.map((feature) => (
            <div key={feature.title} className="feature-card">
              <div className={`feature-accent ${feature.accentClass}`} />
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="info-section info-section-light">
        <p className="info-eyebrow">How it works</p>
        <h2 className="info-heading">From upload to risk level</h2>

        <div className="steps-row">
          {steps.map((step, index) => (
            <div key={step.number} className="step-item">
              <div className="step-circle">{step.number}</div>
              <p className="step-title">{step.title}</p>
              <p className="step-subtitle">{step.subtitle}</p>
              {index < steps.length - 1 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default InfoSections;