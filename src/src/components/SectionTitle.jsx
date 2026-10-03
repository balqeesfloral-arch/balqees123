export default function SectionTitle({ eyebrow, title, body, center = false }) {
  return (
    <div className={`section-title ${center ? 'center' : ''}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}
